# Operator-only staging acceptance. No emails, invoices, grants or real user data.
path = "/app/tmp/izzy-analytics-fixture.json"
email = "campaign-analytics-review@example.invalid"

Teleprompter.Release.commerce(fn ->
  alias Teleprompter.{Accounts, Repo}
  if Accounts.origin() != "https://staging.izzyprompter.com", do: raise("Staging only")

  if System.get_env("IZZY_ANALYTICS_FIXTURE_CLEANUP") == "1" do
    data = path |> File.read!() |> Jason.decode!()
    user = Repo.get!(Accounts.User, data["id"])
    true = user.email == email
    # A campaign fixture must never acquire real commerce history.
    import Ecto.Query
    false = Repo.exists?(from(i in Teleprompter.Commerce.Intent, where: i.user_id == ^user.id))
    Repo.delete!(user)
    File.rm!(path)
    IO.puts("Synthetic campaign account removed.")
  else
    if File.exists?(path) or Repo.get_by(Accounts.User, email: email), do: raise("Clean up the prior synthetic campaign fixture first")
    true = email in Application.get_env(:teleprompter, :analytics_admin_emails, [])
    user = Repo.insert!(%Accounts.User{email: email})
    data = %{id: user.id, email: email, token: Accounts.issue_token(user.id, "login", 900)}
    File.write!(path, Jason.encode!(data))
    File.chmod!(path, 0o600)
    IO.puts("Synthetic campaign account created; credential retained in protected temporary storage.")
  end
end)
