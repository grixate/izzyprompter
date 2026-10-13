defmodule Teleprompter.TrafficBudgetTest do
  use ExUnit.Case, async: true
  alias Teleprompter.TrafficBudget

  test "normal 30 Hz jog traffic stays below sustained limits for minutes" do
    for scope <- [:channel, :session] do
      final =
        Enum.reduce(0..6000, TrafficBudget.new(scope, 0), fn frame, budget ->
          assert {:ok, next} =
                   TrafficBudget.admit(
                     budget,
                     "transport:seek_delta",
                     %{"delta" => 1},
                     frame * 33
                   )

          next
        end)

      assert map_size(final.tokens) == 3
      refute inspect(final) =~ "delta"
    end
  end

  test "channel and session bursts are bounded and refill without storing a backlog" do
    for {scope, burst} <- [channel: 120, session: 240] do
      exhausted =
        Enum.reduce(1..burst, TrafficBudget.new(scope, 0), fn _, budget ->
          {:ok, next} = TrafficBudget.admit(budget, "control", %{}, 0)
          next
        end)

      assert {:error, :rate_limited, retry, next} =
               TrafficBudget.admit(exhausted, "control", %{}, 0)

      assert retry in 1..100
      assert {:ok, _} = TrafficBudget.admit(next, "control", %{}, retry)
    end
  end

  test "control payloads and patch payloads have separate size budgets" do
    budget = TrafficBudget.new(:channel, 0)

    assert {:error, :payload_too_large, 0, next} =
             TrafficBudget.admit(
               budget,
               "transport:pause",
               %{"extra" => String.duplicate("a", 4096)},
               0
             )

    assert next.tokens.messages == 119

    assert {:ok, _} =
             TrafficBudget.admit(
               next,
               "script:patch_block",
               %{"text" => String.duplicate("a", 4096)},
               0
             )

    assert {:error, :payload_too_large, _, _} =
             TrafficBudget.admit(
               budget,
               "script:update",
               %{"content" => String.duplicate("a", 3 * 1024 * 1024)},
               0
             )
  end

  test "large patches exhaust byte throughput independently of message count" do
    payload = %{"text" => String.duplicate("a", 2 * 1024 * 1024)}

    budget =
      Enum.reduce(1..3, TrafficBudget.new(:channel, 0), fn _, budget ->
        {:ok, next} = TrafficBudget.admit(budget, "script:patch_block", payload, 0)
        next
      end)

    assert {:error, :rate_limited, retry, next} =
             TrafficBudget.admit(budget, "script:patch_block", payload, 0)

    assert retry > 0
    assert {:ok, _} = TrafficBudget.admit(next, "script:patch_block", payload, retry)
  end

  test "heavy edit quota does not consume a different control operation's edit tokens" do
    exhausted =
      Enum.reduce(1..8, TrafficBudget.new(:channel, 0), fn _, budget ->
        {:ok, next} = TrafficBudget.admit(budget, "script:patch_block", %{"text" => "a"}, 0)
        next
      end)

    assert {:error, :rate_limited, _, next} =
             TrafficBudget.admit(exhausted, "script:patch_block", %{"text" => "b"}, 0)

    assert {:ok, _} = TrafficBudget.admit(next, "script:end_edit", %{}, 0)
  end

  test "malformed payloads are refused without exceptions or retained data" do
    for payload <- [nil, "private text", ["nested"]] do
      assert {:error, :invalid_command, 0, budget} =
               TrafficBudget.admit(TrafficBudget.new(:channel, 0), "control", payload, 0)

      assert budget.tokens.messages == 119
      refute inspect(budget) =~ "private text"
    end
  end
end
