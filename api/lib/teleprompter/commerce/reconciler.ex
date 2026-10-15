defmodule Teleprompter.Commerce.Reconciler do
  @moduledoc "Bounded recovery of known invoices, independent of browser activity and new-sales availability."
  import Ecto.Query
  alias Teleprompter.{Repo, Commerce, Accounts}
  alias Teleprompter.Commerce.{Attempt, Intent, Audit, Lava}
  @limit 12
  @delays [60, 180, 600, 1800, 7200, 21600, 86400]

  def run_due(now \\ DateTime.utc_now()) do
    if Lava.configured?() do
      # A process can die after recording an attempt but before saving its invoice
      # ID. That is uncertain, never permission to issue another payable link.
      cutoff = DateTime.add(now, -900, :second)

      Repo.update_all(
        from(a in Attempt,
          where:
            a.provider == "lava" and a.environment == "production" and a.status == "creating" and
              a.updated_at < ^cutoff
        ),
        set: [status: "ambiguous", review_reason: "invoice_creation_interrupted", updated_at: now]
      )

      case claim(now) do
        nil ->
          :idle

        {:exhausted, attempt} ->
          # A crash on the final lookup must still enter review once its lease
          # expires; it must neither disappear from the queue nor get a 13th call.
          finish(attempt, {:error, :status_unconfirmed}, now)
          :reviewed

        {:check, attempt} ->
          result =
            try do
              Commerce.reconcile(attempt.id, "worker:invoice-check")
            rescue
              _ -> {:error, :status_unconfirmed}
            end

          finish(attempt, result, now)
          :checked
      end
    else
      :unconfigured
    end
  end

  defp claim(now) do
    {:ok, result} =
      Repo.transaction(fn ->
        attempt =
          Repo.one(
            from(a in Attempt,
              where:
                a.provider == "lava" and a.environment == "production" and
                  a.status in ["pending", "ambiguous"] and not is_nil(a.external_id) and
                  a.external_id != "" and is_nil(a.review_reason) and a.next_check_at <= ^now and
                  (is_nil(a.check_lease_until) or a.check_lease_until <= ^now),
              order_by: a.next_check_at,
              limit: 1,
              lock: "FOR UPDATE SKIP LOCKED"
            )
          )

        if attempt do
          exhausted = attempt.check_attempts >= @limit
          count = if exhausted, do: attempt.check_attempts, else: attempt.check_attempts + 1
          # Persist the retry before leaving the transaction. A crash or restart
          # preserves the budget and delay; no user/DB lock spans a network call.
          claimed =
            attempt
            |> Ecto.Changeset.change(
              check_attempts: count,
              check_lease_until: DateTime.add(now, 60, :second),
              next_check_at: DateTime.add(now, delay(count), :second)
            )
            |> Repo.update!()

          {if(exhausted, do: :exhausted, else: :check), claimed}
        end
      end)

    result
  end

  defp delay(count), do: Enum.at(@delays, min(count - 1, length(@delays) - 1))

  defp finish(claimed, result, now) do
    {:ok, notify} =
      Repo.transaction(fn ->
        current = Repo.one!(from(a in Attempt, where: a.id == ^claimed.id, lock: "FOR UPDATE"))

        if current.check_lease_until == claimed.check_lease_until do
          pending = current.status in ["pending", "ambiguous"]

          review =
            pending and (not is_nil(current.review_reason) or current.check_attempts >= @limit)

          reason =
            if review,
              do: current.review_reason || "payment_confirmation_delayed",
              else: current.review_reason

          next =
            cond do
              not pending or review ->
                nil

              match?({:error, {:retry_after, _}}, result) ->
                {:error, {:retry_after, seconds}} = result
                DateTime.add(now, max(delay(current.check_attempts), seconds), :second)

              true ->
                current.next_check_at
            end

          error =
            case result do
              :ok -> nil
              {:error, {:retry_after, _}} -> "provider_rate_limited"
              {:error, :payment_needs_review} -> "payment_needs_review"
              _ -> "status_unconfirmed"
            end

          current
          |> Ecto.Changeset.change(
            next_check_at: next,
            check_lease_until: nil,
            check_error: error,
            review_reason: reason
          )
          |> Repo.update!()

          if review do
            Repo.insert!(%Audit{
              attempt_id: current.id,
              actor: "worker:invoice-check",
              action: "confirmation_review",
              details: %{"checks" => current.check_attempts}
            })

            Repo.get!(Intent, current.intent_id).user_id
          end
        end
      end)

    if notify, do: Accounts.notify(notify, %{type: "purchase_changed"})
  end
end
