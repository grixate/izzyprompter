# Explicit operator-only synthetic acceptance fixture. No email or provider call.
path = "/app/tmp/izzy-launch-fixture.json"
if File.exists?(path), do: raise("Remove the previous synthetic fixture before seeding another.")

result =
  Teleprompter.Release.commerce(fn ->
    alias Teleprompter.{Accounts, Repo, Commerce}

    user =
      Repo.insert!(%Accounts.User{
        email: "release-probe-" <> Ecto.UUID.generate() <> "@example.invalid"
      })

    pro = System.get_env("IZZY_RELEASE_FIXTURE_PRO") == "1"

    if pro do
      intent = Repo.insert!(%Commerce.Intent{user_id: user.id})

      attempt =
        Repo.insert!(%Commerce.Attempt{
          intent_id: intent.id,
          provider: "release-fixture",
          environment: "test",
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
