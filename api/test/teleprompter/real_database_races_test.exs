defmodule Teleprompter.RealDatabaseRacesTest do
  use ExUnit.Case, async: false
  alias Teleprompter.{Accounts, Library, Repo}
  @moduletag :database

  # A shared SQL Sandbox connection serializes queries, hiding real row-lock
  # races. These fixtures use separate committed connections and own UUIDs.
  defp unboxed(fun), do: Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fun)

  setup do
    user =
      unboxed(fn ->
        Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
      end)

    on_exit(fn -> unboxed(fn -> Repo.delete!(user) end) end)
    %{user: user}
  end

  test "independent connections cannot create beyond the three-script limit", %{user: user} do
    results =
      1..12
      |> Task.async_stream(
        fn n ->
          unboxed(fn -> Library.create(user, %{"title" => "Race #{n}", "content" => "Text"}) end)
        end,
        max_concurrency: 8,
        timeout: 10_000
      )
      |> Enum.to_list()

    assert Enum.count(results, &match?({:ok, {:ok, _}}, &1)) == 3
    assert Enum.count(results, &match?({:ok, {:error, :script_limit}}, &1)) == 9
    assert unboxed(fn -> length(Library.list(user)) end) == 3
  end

  test "a single login link has exactly one winner across independent connections", %{user: user} do
    token = unboxed(fn -> Accounts.issue_token(user.id, "login", 900) end)

    results =
      1..8
      |> Task.async_stream(fn _ -> unboxed(fn -> Accounts.consume_login(token) end) end,
        max_concurrency: 8,
        timeout: 10_000
      )
      |> Enum.to_list()

    assert Enum.count(results, &match?({:ok, {:ok, _}}, &1)) == 1
    assert Enum.count(results, &match?({:ok, {:error, :invalid_token}}, &1)) == 7
  end

  test "competing saved writes cannot silently overwrite the winning revision", %{user: user} do
    {:ok, script} =
      unboxed(fn -> Library.create(user, %{"title" => "Race", "content" => "Original"}) end)

    results =
      1..8
      |> Task.async_stream(
        fn n ->
          unboxed(fn ->
            Library.commit(user, script.id, %{
              "title" => "Race",
              "content" => "Edit #{n}",
              "expected_revision" => 1,
              "mutation_id" => Ecto.UUID.generate()
            })
          end)
        end,
        max_concurrency: 8,
        timeout: 10_000
      )
      |> Enum.to_list()

    assert Enum.count(results, &match?({:ok, {:ok, _}}, &1)) == 1
    assert Enum.count(results, &match?({:ok, {:error, {:conflict, _}}}, &1)) == 7
    assert unboxed(fn -> Library.get(user, script.id).revision end) == 2
  end
end
