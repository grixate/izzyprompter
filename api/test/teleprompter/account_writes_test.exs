defmodule Teleprompter.AccountWritesTest do
  use ExUnit.Case, async: false

  test "account document writes retain burst and size budgets without affecting another account" do
    id = Ecto.UUID.generate()

    results =
      Enum.map(1..30, fn _ -> Teleprompter.AccountWrites.admit(id, %{"content" => "fixture"}) end)

    assert :ok in results
    assert Enum.any?(results, &match?({:error, :rate_limited, _}, &1))
    assert :ok = Teleprompter.AccountWrites.admit(Ecto.UUID.generate(), %{})

    assert {:error, :payload_too_large, _} =
             Teleprompter.AccountWrites.admit(Ecto.UUID.generate(), %{
               "content" => String.duplicate("x", 3 * 1024 * 1024)
             })
  end
end
