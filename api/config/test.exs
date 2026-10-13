import Config

config :teleprompter, :commerce_worker, false
config :teleprompter, Teleprompter.Repo, pool: Ecto.Adapters.SQL.Sandbox
config :teleprompter, Teleprompter.Mailer, adapter: Swoosh.Adapters.Test

# Tests create independent synthetic sessions in one VM; small limit scenarios
# use isolated gates/supervisors or their own production release.
config :teleprompter,
  account_auth_limits: [per_peer: 1000, total: 5000, max_peers: 1024, window_ms: 60_000],
  max_sessions: 256,
  creation_limits: [per_peer: 1000, total: 5000, max_peers: 2048, window_ms: 60_000]

config :teleprompter, http_allowed_origins: :any, lan_discovery: true

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :teleprompter, TeleprompterWeb.Endpoint,
  http: [
    ip: {127, 0, 0, 1},
    port: String.to_integer(System.get_env("TELEPROMPTER_TEST_PORT", "4002"))
  ],
  check_origin: ["//127.0.0.1:#{System.get_env("TELEPROMPTER_TEST_WEB_PORT", "4173")}"],
  secret_key_base: "G5cWtYPBtIAAAZDHo2QgCeEXDvUe4XnblIgLgD2No25GB+ZAOXXVjnSLMKmyRksl",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
