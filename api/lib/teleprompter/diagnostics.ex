defmodule Teleprompter.Diagnostics do
  @moduledoc "Bounded aggregate counters only; never accepts payload metadata or identifiers."
  use GenServer
  require Logger

  @operations [:creation, :join, :command, :session]
  @outcomes [
    :ok,
    :invalid,
    :forbidden,
    :unavailable,
    :capacity,
    :rate_limited,
    :oversized,
    :ended
  ]

  def start_link(options),
    do: GenServer.start_link(__MODULE__, options, Keyword.take(options, [:name]))

  def record(operation, outcome, table \\ __MODULE__)

  def record(operation, outcome, table) when operation in @operations and outcome in @outcomes do
    :ets.update_counter(table, {operation, outcome}, {2, 1})
    :ok
  rescue
    ArgumentError -> :ok
  end

  def record(_, _, _), do: :ok

  def result(operation, result) do
    outcome =
      case result do
        {:ok, _} -> :ok
        {:error, reason} when reason in [:session_capacity, :session_limit] -> :capacity
        {:error, :rate_limited} -> :rate_limited
        {:error, :payload_too_large} -> :oversized
        {:error, reason} when reason in [:unauthorized, :forbidden] -> :forbidden
        {:error, :session_unavailable} -> :unavailable
        _ -> :invalid
      end

    record(operation, outcome)
    result
  end

  def snapshot(server \\ __MODULE__), do: GenServer.call(server, :snapshot)

  @impl true
  def init(options) do
    named = Keyword.get(options, :named_table, true)

    table =
      :ets.new(
        __MODULE__,
        [:set, :public, write_concurrency: true] ++ if(named, do: [:named_table], else: [])
      )

    :ets.insert(table, for(op <- @operations, result <- @outcomes, do: {{op, result}, 0}))
    interval = Keyword.get(options, :interval, 60_000)
    if interval > 0, do: Process.send_after(self(), :report, interval)
    {:ok, %{table: table, interval: interval, started: System.monotonic_time(:second)}}
  end

  @impl true
  def handle_call(:snapshot, _, state), do: {:reply, summary(state), state}
  def handle_call(:table, _, state), do: {:reply, state.table, state}

  @impl true
  def handle_info(:report, state) do
    Logger.info(fn -> "izzy_diagnostics " <> Jason.encode!(summary(state)) end)
    if state.interval > 0, do: Process.send_after(self(), :report, state.interval)
    {:noreply, state}
  end

  defp summary(state) do
    counters =
      Map.new(@operations, fn op ->
        {op,
         Map.new(@outcomes, fn outcome ->
           {outcome, :ets.lookup_element(state.table, {op, outcome}, 2)}
         end)}
      end)

    %{uptime_seconds: max(0, System.monotonic_time(:second) - state.started), counters: counters}
  end
end
