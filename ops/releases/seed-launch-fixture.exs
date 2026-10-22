# Explicit operator-only synthetic acceptance fixture. No email or provider call.
path = "/app/tmp/izzy-launch-fixture.json"
if File.exists?(path), do: raise("Remove the previous synthetic fixture before seeding another.")

result =
  Teleprompter.Release.commerce(fn ->
    alias Teleprompter.{Accounts, Repo, Commerce}

    pro = System.get_env("IZZY_RELEASE_FIXTURE_PRO") == "1"
    local = System.get_env("IZZY_RELEASE_FIXTURE_LOCAL") == "1" and Accounts.origin() == "http://127.0.0.1:4173"
    if pro and Accounts.origin() != "https://staging.izzyprompter.com" and not local,
      do: raise("Synthetic Pro acceptance is restricted to staging or an explicit disposable local origin.")

    user =
      Repo.insert!(%Accounts.User{
        email: "release-probe-" <> Ecto.UUID.generate() <> "@example.invalid"
      })

    if pro do
      intent = Repo.insert!(%Commerce.Intent{user_id: user.id})

      attempt =
        Repo.insert!(%Commerce.Attempt{
          intent_id: intent.id,
          provider: "release-fixture",
          environment: "production",
          amount_minor: 2900,
          currency: "USD",
          status: "paid"
        })

      Repo.insert!(%Commerce.Grant{user_id: user.id, attempt_id: attempt.id})
    end

    %{
      id: user.id,
      email: user.email,
      pro: pro,
      token: Accounts.issue_token(user.id, "login", 900)
    }
  end)

true = is_map(result)
File.write!(path, Jason.encode!(result))
File.chmod!(path, 0o600)
IO.puts("Synthetic launch fixture created; private token written to protected temporary storage.")
