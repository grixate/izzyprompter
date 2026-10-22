defmodule Teleprompter.Metrics do
  @moduledoc "Optional best-effort daily event totals. No visitor IDs, URLs, properties or raw event log."
  use GenServer
  import Ecto.Query
  alias Teleprompter.Repo
  @events ~w(session_created remote_connected playback_started feedback_received)

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def record(event) when event in @events do
    key = {Date.utc_today(), event}
    :ets.update_counter(__MODULE__, key, {2, 1, 1_000_000, 1_000_000}, {key, 0})
    :ok
  rescue
    ArgumentError -> :ok
  end

  def record(_), do: :ok

  def init(_) do
    :ets.new(__MODULE__, [:named_table, :public, :set, write_concurrency: true])
    Process.send_after(self(), :flush, 60_000)
    {:ok, nil}
  end

  def handle_info(:flush, state) do
    flush()
    Process.send_after(self(), :flush, 60_000)
    {:noreply, state}
  end

  def flush do
    batch =
      for {key, _} <- :ets.tab2list(__MODULE__), item <- :ets.take(__MODULE__, key), do: item

    result = persist(batch)

    if result != :ok do
      today = Date.utc_today()
      yesterday = Date.add(today, -1)

      for {{day, _} = key, count} <- batch,
          day in [today, yesterday],
          do: :ets.update_counter(__MODULE__, key, {2, count, 1_000_000, 1_000_000}, {key, 0})
    end

    result
  end

  defp persist(batch) do
    case Repo.transaction(fn ->
           for {{day, event}, count} <- batch do
             Repo.insert_all("product_metrics", [%{day: day, event: event, count: count}],
               conflict_target: [:day, :event],
               on_conflict: [inc: [count: count]]
             )
           end
         end) do
      {:ok, _} -> :ok
      _ -> :error
    end
  rescue
    _ -> :error
  end

  def report(days \\ 30) when is_integer(days) and days in 1..366 do
    cutoff = Date.add(Date.utc_today(), 1 - days)

    totals =
      Repo.all(
        from(m in "product_metrics",
          where: m.day >= ^cutoff,
          order_by: [asc: m.day, asc: m.event],
          select: %{day: m.day, event: m.event, count: m.count}
        )
      )

    # Payment counts come from durable, authenticated provider state, not events or browser clicks.
    payments =
      Repo.all(
        from(a in Teleprompter.Commerce.Attempt,
          where: a.environment == "production" and a.status in ["paid", "refunded"],
          group_by: [a.status, a.currency],
          select: %{
            status: a.status,
            currency: a.currency,
            count: count(a.id),
            amount_minor: sum(a.amount_minor)
          }
        )
      )

    %{daily_events: totals, payment_states_all_time: payments}
  end
end
