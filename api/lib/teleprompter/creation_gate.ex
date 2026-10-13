defmodule Teleprompter.CreationGate do
  @moduledoc "Bounded, ephemeral per-peer and per-node admission for session creation only."
  use GenServer

  def start_link(options) do
    GenServer.start_link(__MODULE__, options, Keyword.take(options, [:name]))
  end

  def admit(peer, server \\ __MODULE__) do
    GenServer.call(server, {:admit, peer}, 1_000)
  catch
    :exit, _ -> {:error, :unavailable}
  end

  @impl true
  def init(options) do
    clock = Keyword.get(options, :clock, fn -> System.monotonic_time(:millisecond) end)

    limits =
      Keyword.get(options, :limits, Application.get_env(:teleprompter, :creation_limits, []))

    state = %{
      clock: clock,
      start: clock.(),
      window: Keyword.get(limits, :window_ms, 60_000),
      per_peer: Keyword.get(limits, :per_peer, 10),
      total_limit: Keyword.get(limits, :total, 60),
      max_peers: Keyword.get(limits, :max_peers, 2048),
      peers: %{},
      total: 0,
      salt: :crypto.strong_rand_bytes(32)
    }

    if Enum.all?(
         [state.window, state.per_peer, state.total_limit, state.max_peers],
         &(is_integer(&1) and &1 > 0)
       ), do: {:ok, state}, else: {:stop, :invalid_creation_limits}
  end

  @impl true
  def handle_call({:admit, peer}, _from, state) do
    now = state.clock.()

    state =
      if now - state.start >= state.window,
        do: %{state | start: now, peers: %{}, total: 0},
        else: state

    key = :crypto.mac(:hmac, :sha256, state.salt, :erlang.term_to_binary(peer))
    count = Map.get(state.peers, key, 0)
    full = count == 0 and map_size(state.peers) >= state.max_peers

    if count >= state.per_peer or state.total >= state.total_limit or full do
      seconds = max(1, div(state.window - (now - state.start) + 999, 1000))
      {:reply, {:error, :rate_limited, seconds}, state}
    else
      {:reply, :ok,
       %{state | total: state.total + 1, peers: Map.put(state.peers, key, count + 1)}}
    end
  end
end
