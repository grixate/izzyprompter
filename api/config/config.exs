# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :teleprompter,
  ecto_repos: [Teleprompter.Repo],
  accounts_enabled: false,
  generators: [timestamp_type: :utc_datetime]

config :teleprompter, Teleprompter.Mailer, adapter: Swoosh.Adapters.Local
config :swoosh, :api_client, false

# Configures the endpoint
config :teleprompter, TeleprompterWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  render_errors: [
    formats: [json: TeleprompterWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Teleprompter.PubSub,
  live_view: [signing_salt: "HFFw5Jn9"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Provider payloads and search queries can contain private fields we do not
# control. Deny by default instead of guessing every sensitive field name.
config :phoenix, :filter_parameters, {:keep, []}

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
