ExUnit.start()

if Teleprompter.Accounts.enabled?() do
  Ecto.Adapters.SQL.Sandbox.mode(Teleprompter.Repo, :manual)
else
  ExUnit.configure(exclude: [:database])
end
