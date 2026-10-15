defmodule Teleprompter.Release do
  @moduledoc "Explicit release migrations. Never migrate automatically during application startup."
  def migrate do
    Application.load(:teleprompter)

    {:ok, _, _} =
      Ecto.Migrator.with_repo(Teleprompter.Repo, &Ecto.Migrator.run(&1, :up, all: true))

    :ok
  end

  @doc "Trusted release-eval support without starting the endpoint or payment worker."
  def commerce(operation) when is_function(operation, 0) do
    Application.load(:teleprompter)

    if Teleprompter.Accounts.enabled?() do
      for app <- [:ecto_sql, :postgrex, :phoenix_pubsub, :req],
          do: {:ok, _} = Application.ensure_all_started(app)

      temporary =
        if is_nil(Process.whereis(Teleprompter.PubSub)) do
          {:ok, pid} = Phoenix.PubSub.Supervisor.start_link(name: Teleprompter.PubSub)
          pid
        end

      try do
        {:ok, result, _} = Ecto.Migrator.with_repo(Teleprompter.Repo, fn _ -> operation.() end)
        result
      after
        if temporary, do: Supervisor.stop(temporary)
      end
    else
      {:error, :accounts_unavailable}
    end
  end

  @doc "Read-only launch/support summary: no credentials, personal data or provider calls."
  def payment_readiness do
    commerce(fn ->
      import Ecto.Query
      alias Teleprompter.Repo
      alias Teleprompter.Commerce.{Attempt, Event, Provider, Lava}

      %{
        schema_ready:
          match?(
            {:ok, _},
            Ecto.Adapters.SQL.query(
              Repo,
              "SELECT offer_id, check_attempts, next_check_at, check_lease_until, check_error FROM checkout_attempts LIMIT 0",
              [],
              timeout: 1000
            )
          ),
        price_minor: Teleprompter.Product.price(),
        currency: "USD",
        sales_enabled: Provider.enabled?("lava", "USD"),
        lava_configured: Lava.configured?(),
        known_pending:
          Repo.aggregate(
            from(a in Attempt,
              where:
                a.provider == "lava" and a.status in ["pending", "ambiguous"] and
                  not is_nil(a.external_id)
            ),
            :count
          ),
        attempts_needing_review:
          Repo.aggregate(from(a in Attempt, where: not is_nil(a.review_reason)), :count),
        events_needing_review:
          Repo.aggregate(from(e in Event, where: e.status == "review"), :count)
      }
    end)
  end
end
