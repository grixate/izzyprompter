defmodule Teleprompter.SessionCapacityTest do
  use ExUnit.Case, async: true
  alias Teleprompter.Sessions

  test "atomic process capacity preserves existing scripts and a stopped session frees a slot" do
    supervisor = start_supervised!({DynamicSupervisor, strategy: :one_for_one, max_children: 1})
    assert {:ok, first} = Sessions.create("Keep this script", 1, supervisor)
    assert {:error, :session_capacity} = Sessions.create("Cannot fit", 1, supervisor)
    assert {:ok, snapshot} = Sessions.snapshot(first.session_id)
    assert snapshot.script.content == "Keep this script"
    assert {:ok, pid} = Sessions.lookup(first.session_id)
    :ok = DynamicSupervisor.terminate_child(supervisor, pid)
    assert {:ok, _} = Sessions.create("Replacement", 1, supervisor)
  end

  test "parallel creation cannot oversubscribe available process slots" do
    supervisor = start_supervised!({DynamicSupervisor, strategy: :one_for_one, max_children: 2})

    replies =
      1..20
      |> Task.async_stream(fn _ -> Sessions.create("Parallel", 1, supervisor) end)
      |> Enum.map(fn {:ok, reply} -> reply end)

    assert Enum.count(replies, &match?({:ok, _}, &1)) == 2
    assert Enum.count(replies, &(&1 == {:error, :session_capacity})) == 18
  end
end
