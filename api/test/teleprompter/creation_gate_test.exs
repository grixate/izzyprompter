defmodule Teleprompter.CreationGateTest do
  use ExUnit.Case, async: true
  alias Teleprompter.CreationGate

  defp gate(limits) do
    clock = :atomics.new(1, [])

    pid =
      start_supervised!({CreationGate, limits: limits, clock: fn -> :atomics.get(clock, 1) end})

    {pid, clock}
  end

  test "per-peer exhaustion does not consume another peer's remaining node quota" do
    {gate, _} = gate(per_peer: 2, total: 3)
    assert :ok = CreationGate.admit({10, 0, 0, 1}, gate)
    assert :ok = CreationGate.admit({10, 0, 0, 1}, gate)
    assert {:error, :rate_limited, 60} = CreationGate.admit({10, 0, 0, 1}, gate)
    assert :ok = CreationGate.admit({10, 0, 0, 2}, gate)
    assert {:error, :rate_limited, 60} = CreationGate.admit({10, 0, 0, 3}, gate)
  end

  test "window expiry clears quota and peer identities and returns a bounded retry hint" do
    {gate, clock} = gate(per_peer: 1, total: 2)
    assert :ok = CreationGate.admit(:first, gate)
    :atomics.put(clock, 1, 59_001)
    assert {:error, :rate_limited, 1} = CreationGate.admit(:first, gate)
    :atomics.put(clock, 1, 60_000)
    assert :ok = CreationGate.admit(:second, gate)
    assert :sys.get_state(gate).total == 1
    assert map_size(:sys.get_state(gate).peers) == 1
  end

  test "bounded peer tracking never evicts a live bucket to permit replay" do
    {gate, _} = gate(per_peer: 3, total: 20, max_peers: 2)
    assert :ok = CreationGate.admit(:first, gate)
    assert :ok = CreationGate.admit(:second, gate)
    assert {:error, :rate_limited, _} = CreationGate.admit(:third, gate)
    assert :ok = CreationGate.admit(:first, gate)
    assert map_size(:sys.get_state(gate).peers) == 2
  end

  test "concurrent requests cannot exceed the atomic admission quota" do
    {gate, _} = gate(per_peer: 5, total: 100)

    replies =
      1..100
      |> Task.async_stream(fn _ -> CreationGate.admit(:same_peer, gate) end, max_concurrency: 20)
      |> Enum.map(fn {:ok, result} -> result end)

    assert Enum.count(replies, &(&1 == :ok)) == 5
    assert Enum.count(replies, &match?({:error, :rate_limited, _}, &1)) == 95
  end

  test "stored buckets contain only salted ephemeral keys, not raw addresses" do
    {gate, _} = gate(per_peer: 1, total: 2)
    address = {203, 0, 113, 42}
    assert :ok = CreationGate.admit(address, gate)
    [key] = Map.keys(:sys.get_state(gate).peers)
    assert is_binary(key) and byte_size(key) == 32
    refute key == :erlang.term_to_binary(address)
    refute inspect(:sys.get_state(gate)) =~ "203, 0, 113, 42"
  end

  test "unavailable gate fails closed" do
    assert {:error, :unavailable} = CreationGate.admit(:peer, :missing_creation_gate)
  end
end
