import { execFileSync } from 'node:child_process'

export function accountFixture(existingId?: string, pro = false) {
  const output = execFileSync('mix', ['run', '--no-start', '-e', `
    Application.ensure_all_started(:ecto_sql)
    Application.ensure_all_started(:postgrex)
    {:ok, _} = Teleprompter.Repo.start_link()
    user = if id = System.get_env("IZZY_E2E_USER_ID"), do: Teleprompter.Repo.get!(Teleprompter.Accounts.User, id),
      else: Teleprompter.Repo.insert!(%Teleprompter.Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    if ${pro} do
      alias Teleprompter.Commerce.{Intent, Attempt, Grant}
      intent = Teleprompter.Repo.get_by(Intent, user_id: user.id) || Teleprompter.Repo.insert!(%Intent{user_id: user.id})
      attempt = Teleprompter.Repo.insert!(%Attempt{intent_id: intent.id, provider: "lava", environment: "production", currency: "USD", amount_minor: 2900, external_id: Ecto.UUID.generate(), status: "paid"})
      Teleprompter.Repo.insert!(%Grant{user_id: user.id, attempt_id: attempt.id})
    end
    IO.write("FIXTURE=" <> Jason.encode!(%{id: user.id, token: Teleprompter.Accounts.issue_token(user.id, "login", 900)}))
  `], { cwd: 'api', env: { ...process.env, MIX_ENV: 'test', DATABASE_URL: process.env.IZZY_E2E_DATABASE_URL, IZZY_E2E_USER_ID: existingId }, encoding: 'utf8' })
  const value = output.match(/FIXTURE=(\{[^\n]+\})/)?.[1]
  if (!value) throw new Error('Could not seed isolated account fixture')
  return JSON.parse(value) as { id: string; token: string }
}
