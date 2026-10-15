defmodule Teleprompter.Commerce do
  import Ecto.Query
  alias Teleprompter.{Repo, Accounts}
  alias Teleprompter.Accounts.User
  alias Teleprompter.Commerce.{Intent, Attempt, Event, Grant, Audit, Provider}
  defp prices, do: %{"USD" => Teleprompter.Product.price()}

  def pro?(user) do
    preview = Application.get_env(:teleprompter, :preview_entitlements, false)

    Accounts.enabled?() and
      Repo.exists?(
        from(g in Grant,
          join: a in Attempt,
          on: a.id == g.attempt_id,
          where:
            g.user_id == ^user.id and g.status == "active" and
              (a.environment == "production" or
                 (^preview and a.environment == "preview" and a.provider == "local_preview"))
        )
      )
  end

  def options do
    %{
      prices: prices(),
      enabled: Application.get_env(:teleprompter, :payments_enabled, false),
      providers:
        Enum.map(["lava"], fn name ->
          %{
            id: name,
            recommended: true,
            currencies: Enum.filter(["USD"], &Provider.enabled?(name, &1))
          }
        end)
    }
  end

  def purchases(user),
    do:
      Repo.all(
        from(a in Attempt,
          join: i in Intent,
          on: i.id == a.intent_id,
          where: i.user_id == ^user.id,
          order_by: [desc: a.inserted_at],
          limit: 50
        )
      )
      |> Enum.map(&serialize/1)

  def checkout(user, provider, currency, confirm_switch \\ false) do
    if (Provider.enabled?(provider, currency) and Provider.module(provider)) &&
         Map.has_key?(prices(), currency) do
      result =
        Repo.transaction(fn ->
          Repo.one!(from(u in User, where: u.id == ^user.id, lock: "FOR UPDATE"))
          if pro?(user), do: Repo.rollback(:already_pro)

          intent =
            Repo.get_by(Intent, user_id: user.id, product: "lifetime_pro") ||
              Repo.insert!(%Intent{user_id: user.id})

          attempts =
            Repo.all(
              from(a in Attempt,
                where:
                  a.intent_id == ^intent.id and a.status in ["creating", "pending", "ambiguous"],
                order_by: [desc: a.inserted_at]
              )
            )

          same =
            Enum.find(
              attempts,
              &(&1.provider == provider and &1.currency == currency and
                  &1.environment == Provider.environment(provider))
            )

          cond do
            same && same.checkout_url ->
              {:reuse, same}

            same ->
              Repo.rollback(:payment_pending)

            attempts != [] and not confirm_switch ->
              Repo.rollback(:payment_pending)

            true ->
              attempt =
                Repo.insert!(%Attempt{
                  id: Ecto.UUID.generate(),
                  intent_id: intent.id,
                  provider: provider,
                  currency: currency,
                  amount_minor: prices()[currency],
                  environment: Provider.environment(provider),
                  offer_id: Provider.config(provider)[:offer_id]
                })

              if attempts != [],
                do:
                  Repo.insert!(%Audit{
                    attempt_id: attempt.id,
                    actor: "user:" <> user.id,
                    action: "confirmed_provider_switch"
                  })

              {:create, attempt}
          end
        end)

      case result do
        {:ok, {:reuse, attempt}} ->
          {:ok, serialize(attempt)}

        {:ok, {:create, attempt}} ->
          # Never hold database/user locks across a network request; never
          # retry a timed-out provider invoice creation automatically.
          case apply(Provider.module(provider), :checkout, [attempt, user]) do
            {:ok, details} ->
              {:ok, saved} =
                Repo.transaction(fn ->
                  current =
                    Repo.one!(from(a in Attempt, where: a.id == ^attempt.id, lock: "FOR UPDATE"))

                  changes =
                    Map.put(
                      details,
                      :status,
                      if(current.status == "creating", do: "pending", else: current.status)
                    )

                  changes =
                    if current.status == "creating",
                      do:
                        Map.put(
                          changes,
                          :next_check_at,
                          DateTime.add(DateTime.utc_now(), 60, :second)
                        ),
                      else: changes

                  current |> Ecto.Changeset.change(changes) |> Repo.update!()
                end)

              Accounts.notify(user.id, %{type: "purchase_changed"})
              {:ok, serialize(saved)}

            {:error, reason} ->
              # A verified callback may finish while the link request times out.
              # Never overwrite that result with the stale pre-request struct.
              {:ok, current} =
                Repo.transaction(fn ->
                  current =
                    Repo.one!(from(a in Attempt, where: a.id == ^attempt.id, lock: "FOR UPDATE"))

                  if current.status == "creating",
                    do:
                      current
                      |> Ecto.Changeset.change(
                        status: if(reason == :checkout_rejected, do: "failed", else: "ambiguous"),
                        review_reason: to_string(reason)
                      )
                      |> Repo.update!(),
                    else: current
                end)

              if current.status in ["paid", "refunded", "disputed", "failed"],
                do: {:ok, serialize(current)},
                else: {:error, :payment_pending}
          end

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, :payments_unavailable}
    end
  end

  def receive_event(provider, payload, headers) do
    module = Provider.module(provider)

    if module && apply(module, :authenticate, [payload, headers]) do
      # Store only normalized transaction facts, never buyer/card payloads.
      normalized = apply(module, :normalize, [payload])
      external_key = normalized[:key]

      cond do
        normalized[:type] == "unknown" ->
          {:ok, :ignored}

        is_binary(external_key) and byte_size(external_key) in 1..256 ->
          now = DateTime.utc_now()
          env = Provider.environment(provider)

          Repo.insert_all(
            Event,
            [
              %{
                id: Ecto.UUID.generate(),
                provider: provider,
                external_key: external_key,
                environment: env,
                payload: Jason.decode!(Jason.encode!(normalized)),
                status: "pending",
                inserted_at: now,
                updated_at: now
              }
            ],
            on_conflict: :nothing,
            conflict_target: [:provider, :external_key, :environment]
          )

          {:ok, :stored}

        true ->
          {:error, :invalid_event}
      end
    else
      {:error, :unauthorized}
    end
  rescue
    DBConnection.ConnectionError -> {:error, :database_unavailable}
    Postgrex.Error -> {:error, :database_unavailable}
    ArgumentError -> {:error, :invalid_event}
    Protocol.UndefinedError -> {:error, :invalid_event}
    BadMapError -> {:error, :invalid_event}
  end

  def process_events do
    Repo.all(from(e in Event, where: e.status == "pending", order_by: e.inserted_at, limit: 50))
    |> Enum.each(fn event -> process_event(event.id) end)
  end

  def process_event(id) do
    result =
      Repo.transaction(fn ->
        event = Repo.one!(from(e in Event, where: e.id == ^id, lock: "FOR UPDATE"))
        if event.status != "pending", do: Repo.rollback(:already_processed)
        data = event.payload
        external_id = data["external_id"]

        attempt =
          if is_binary(external_id),
            do:
              Repo.one(
                from(a in Attempt,
                  where:
                    a.provider == ^event.provider and a.external_id == ^external_id and
                      a.environment == ^event.environment
                )
              )

        cond do
          data["type"] == "unknown" ->
            finish_event(event, "ignored")

          is_nil(attempt) ->
            # An invoice notification can race the create-invoice response.
            # Keep it durable and retry briefly, then require operator matching.
            cutoff = DateTime.add(DateTime.utc_now(), -120, :second)

            creating =
              is_binary(external_id) and event.inserted_at > cutoff and
                Repo.exists?(
                  from(a in Attempt,
                    where:
                      a.provider == ^event.provider and
                        a.environment == ^event.environment and a.status == "creating"
                  )
                )

            if creating, do: event, else: finish_event(event, "review", "unmatched_transaction")

          data["test"] == true and attempt.environment == "production" ->
            finish_event(event, "review", "test_payment_in_production")

          true ->
            intent = Repo.get!(Intent, attempt.intent_id)
            Repo.one!(from(u in User, where: u.id == ^intent.user_id, lock: "FOR UPDATE"))

            attempt =
              Repo.one!(from(a in Attempt, where: a.id == ^attempt.id, lock: "FOR UPDATE"))

            if data["currency"] != attempt.currency or
                 (data["type"] in ["paid", "refunded"] and
                    data["amount_minor"] != attempt.amount_minor) do
              attempt
              |> Ecto.Changeset.change(
                review_reason: "amount_or_currency_mismatch",
                next_check_at: nil
              )
              |> Repo.update!()

              finish_event(event, "review", "amount_or_currency_mismatch")
            else
              apply_event(attempt, intent, data["type"])
              {finish_event(event, "processed"), intent.user_id}
            end
        end
      end)

    case result do
      {:ok, {event, user_id}} ->
        Accounts.notify(user_id, %{type: "purchase_changed"})
        {:ok, event}

      other ->
        other
    end
  end

  defp apply_event(attempt, intent, "paid") do
    unless attempt.status in ["refunded", "disputed"] do
      duplicate =
        Repo.exists?(
          from(a in Attempt,
            where:
              a.intent_id == ^intent.id and a.id != ^attempt.id and a.status == "paid" and
                a.environment == ^attempt.environment
          )
        )

      attempt
      |> Ecto.Changeset.change(
        status: "paid",
        review_reason: if(duplicate, do: "duplicate_payment_refund_review")
      )
      |> Repo.update!()

      if attempt.environment == "production" do
        Repo.insert!(%Grant{user_id: intent.user_id, attempt_id: attempt.id},
          on_conflict: :nothing,
          conflict_target: [:attempt_id]
        )
      end
    end
  end

  defp apply_event(attempt, _intent, type) when type in ["refunded", "disputed"] do
    # A delayed dispute must not turn a final refund into a restorable grant.
    unless type == "disputed" and attempt.status == "refunded" do
      attempt |> Ecto.Changeset.change(status: type) |> Repo.update!()

      Repo.update_all(from(g in Grant, where: g.attempt_id == ^attempt.id),
        set: [
          status: if(type == "refunded", do: "revoked", else: "suspended"),
          updated_at: DateTime.utc_now()
        ]
      )
    end
  end

  defp apply_event(attempt, _, "failed") do
    if attempt.status in ["creating", "pending", "ambiguous"],
      do: attempt |> Ecto.Changeset.change(status: "failed") |> Repo.update!()
  end

  defp apply_event(_, _, "partial_refund"), do: :ok

  defp finish_event(event, status, reason \\ nil),
    do: event |> Ecto.Changeset.change(status: status, review_reason: reason) |> Repo.update!()

  def serialize(a),
    do: %{
      id: a.id,
      provider: a.provider,
      amount_minor: a.amount_minor,
      currency: a.currency,
      status: a.status,
      checkout_url: a.checkout_url,
      environment: a.environment,
      review_required: not is_nil(a.review_reason)
    }

  # A browser can check only its own stored invoice. Provider IDs and return
  # query parameters never select a different purchase or prove payment.
  def check_purchase(user, id) do
    with {:ok, uuid} <- Ecto.UUID.cast(id),
         %Attempt{} = attempt <-
           Repo.one(
             from(a in Attempt,
               join: i in Intent,
               on: i.id == a.intent_id,
               where: a.id == ^uuid and i.user_id == ^user.id
             )
           ) do
      if attempt.provider == "lava" and is_binary(attempt.external_id) and
           attempt.status in ["pending", "ambiguous"] do
        # The check remains available when new sales are disabled.
        reconcile(attempt.id, "user:" <> user.id)
      end

      {:ok, serialize(Repo.get!(Attempt, attempt.id))}
    else
      _ -> {:error, :not_found}
    end
  end

  # Operator-only entry point (release eval / IEx), not a public HTTP API.
  # Proof is a provider transaction/refund reference verified in its dashboard.
  def operator_confirm(attempt_id, action, actor, proof)
      when action in ["paid", "failed", "refunded", "disputed", "partial_refund"] and
             is_binary(actor) and
             is_binary(proof) and byte_size(proof) > 0 do
    result =
      Repo.transaction(fn ->
        attempt = Repo.get!(Attempt, attempt_id)
        intent = Repo.get!(Intent, attempt.intent_id)
        Repo.one!(from(u in User, where: u.id == ^intent.user_id, lock: "FOR UPDATE"))
        attempt = Repo.one!(from(a in Attempt, where: a.id == ^attempt_id, lock: "FOR UPDATE"))

        Repo.insert!(%Audit{
          attempt_id: attempt.id,
          action: action,
          actor: actor,
          details: %{"provider_reference" => proof}
        })

        apply_event(attempt, intent, action)
        intent.user_id
      end)

    operator_result(result)
  end

  # For documented refund/dispute envelopes without invoice identity. The
  # operator must verify the provider reference; email is never a match key.
  def operator_match_event(event_id, attempt_id, actor, proof)
      when is_binary(actor) and byte_size(actor) > 0 and is_binary(proof) and byte_size(proof) > 0 do
    result =
      Repo.transaction(fn ->
        event = Repo.one!(from(e in Event, where: e.id == ^event_id, lock: "FOR UPDATE"))
        attempt = Repo.get!(Attempt, attempt_id)

        if event.status != "review" or event.provider != attempt.provider or
             event.environment != attempt.environment,
           do: Repo.rollback(:invalid_match)

        Repo.insert!(%Audit{
          attempt_id: attempt.id,
          actor: actor,
          action: "matched_event",
          details: %{"event_id" => event.id, "provider_reference" => proof}
        })

        event
        |> Ecto.Changeset.change(
          status: "pending",
          review_reason: nil,
          payload: Map.put(event.payload, "external_id", attempt.external_id)
        )
        |> Repo.update!()
      end)

    case result do
      {:ok, event} -> process_event(event.id)
      other -> other
    end
  end

  def operator_restore_dispute(attempt_id, actor, proof)
      when is_binary(actor) and byte_size(actor) > 0 and is_binary(proof) and byte_size(proof) > 0 do
    result =
      Repo.transaction(fn ->
        attempt = Repo.get!(Attempt, attempt_id)
        intent = Repo.get!(Intent, attempt.intent_id)
        Repo.one!(from(u in User, where: u.id == ^intent.user_id, lock: "FOR UPDATE"))
        attempt = Repo.one!(from(a in Attempt, where: a.id == ^attempt_id, lock: "FOR UPDATE"))
        grant = Repo.get_by(Grant, attempt_id: attempt.id, status: "suspended")
        if attempt.status != "disputed" or is_nil(grant), do: Repo.rollback(:invalid_dispute)

        Repo.insert!(%Audit{
          attempt_id: attempt.id,
          actor: actor,
          action: "dispute_won",
          details: %{"provider_reference" => proof}
        })

        grant |> Ecto.Changeset.change(status: "active") |> Repo.update!()
        attempt |> Ecto.Changeset.change(status: "paid") |> Repo.update!()
        intent.user_id
      end)

    operator_result(result)
  end

  defp operator_result({:ok, user_id}) do
    Accounts.notify(user_id, %{type: "purchase_changed"})
    {:ok, :ok}
  end

  defp operator_result(other), do: other

  def reconcile(attempt_id, actor) do
    attempt = Repo.get!(Attempt, attempt_id)

    with {:ok, data} <- apply(Provider.module(attempt.provider), :reconcile, [attempt]) do
      Repo.insert!(%Audit{attempt_id: attempt.id, actor: actor, action: "reconciled"})

      Repo.insert!(
        %Event{
          provider: attempt.provider,
          external_key: data.key,
          environment: attempt.environment,
          payload: Jason.decode!(Jason.encode!(data))
        },
        on_conflict: :nothing,
        conflict_target: [:provider, :external_key, :environment]
      )

      event =
        Repo.get_by!(Event,
          provider: attempt.provider,
          external_key: data.key,
          environment: attempt.environment
        )

      process_event(event.id)

      if Repo.get!(Event, event.id).status == "review",
        do: {:error, :payment_needs_review},
        else: :ok
    end
  end
end
