defmodule Teleprompter.AccountWrites do
  @moduledoc "Bounded account-write token buckets using the existing document traffic limits."
  use GenServer
  alias Teleprompter.TrafficBudget
  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  def admit(user_id, params), do: GenServer.call(__MODULE__, {:admit, user_id, params}, 1_000)

  def init(_) do
    Process.send_after(self(), :prune, 60_000)
    {:ok, %{salt: :crypto.strong_rand_bytes(32), buckets: %{}}}
  end

  def handle_call({:admit, user_id, params}, _, state) do
    now = System.monotonic_time(:millisecond)
    key = :crypto.mac(:hmac, :sha256, state.salt, user_id)

    if map_size(state.buckets) >= 2048 and not Map.has_key?(state.buckets, key) do
      {:reply, {:error, :rate_limited, 1_000}, state}
    else
      budget = Map.get(state.buckets, key, TrafficBudget.new(:channel, now))

      {reply, next} =
        case TrafficBudget.admit(budget, "script:update", params, now) do
          {:ok, next} -> {:ok, next}
          {:error, reason, retry, next} -> {{:error, reason, retry}, next}
        end

      {:reply, reply, %{state | buckets: Map.put(state.buckets, key, next)}}
    end
  end

  def handle_info(:prune, state) do
    cutoff = System.monotonic_time(:millisecond) - 60_000
    Process.send_after(self(), :prune, 60_000)

    {:noreply,
     %{state | buckets: Map.reject(state.buckets, fn {_, budget} -> budget.at < cutoff end)}}
  end
end
