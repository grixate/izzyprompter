path = "/app/tmp/izzy-launch-fixture.json"
fixture = path |> File.read!() |> Jason.decode!()

result =
  Teleprompter.Release.commerce(fn ->
    import Ecto.Query
    alias Teleprompter.{Repo, Accounts, Commerce}

    Repo.transaction(fn ->
      user = Repo.get!(Accounts.User, fixture["id"])

      true =
        user.email == fixture["email"] and String.starts_with?(user.email, "release-probe-") and
          String.ends_with?(user.email, "@example.invalid")

      intents = Repo.all(from(i in Commerce.Intent, where: i.user_id == ^user.id, select: i.id))
      attempts = Repo.all(from(a in Commerce.Attempt, where: a.intent_id in ^intents))
      local = System.get_env("IZZY_RELEASE_FIXTURE_LOCAL") == "1" and Accounts.origin() == "http://127.0.0.1:4173"
      stage = Accounts.origin() == "https://staging.izzyprompter.com" or local
      true = Enum.all?(attempts, &(&1.provider == "release-fixture" and stage and &1.environment in ["production", "test"]))
      ids = Enum.map(attempts, & &1.id)
      Repo.delete_all(from(g in Commerce.Grant, where: g.user_id == ^user.id))
      Repo.delete_all(from(a in Commerce.Audit, where: a.attempt_id in ^ids))
      Repo.delete_all(from(a in Commerce.Attempt, where: a.id in ^ids))
      Repo.delete_all(from(i in Commerce.Intent, where: i.id in ^intents))
      Repo.delete!(user)
      :removed
    end)
  end)

{:ok, :removed} = result
File.rm!(path)
IO.puts("Synthetic launch account and its test data removed.")
