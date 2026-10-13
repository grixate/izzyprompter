import Config

# Accounts are opt-in: portable/LAN guest builds still run without PostgreSQL.
if database_url = System.get_env("DATABASE_URL") do
  config :teleprompter, accounts_enabled: true

  config :teleprompter, Teleprompter.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE", "10")),
    log: false

  if System.get_env("DATABASE_SSL_VERIFY") == "true" do
    host = URI.parse(database_url).host || raise("DATABASE_URL requires a hostname")

    config :teleprompter, Teleprompter.Repo,
      ssl: [
        verify: :verify_peer,
        cacerts: :public_key.cacerts_get(),
        server_name_indication: String.to_charlist(host),
        customize_hostname_check: [match_fun: :public_key.pkix_verify_hostname_match_fun(:https)]
      ]
  end
end

config :teleprompter,
  account_origin: System.get_env("PUBLIC_ORIGIN", "http://localhost:5173"),
  mail_from: System.get_env("MAIL_FROM", "izzy@localhost"),
  payments_enabled: System.get_env("IZZY_PAYMENTS_ENABLED") == "true",
  google: [
    client_id: System.get_env("GOOGLE_CLIENT_ID"),
    client_secret: System.get_env("GOOGLE_CLIENT_SECRET")
  ]

config :teleprompter, :payment_providers, %{
  "prodamus" => [
    approved: System.get_env("PRODAMUS_APPROVED") == "true",
    environment: System.get_env("PRODAMUS_ENVIRONMENT", "test"),
    currencies: String.split(System.get_env("PRODAMUS_CURRENCIES", ""), ",", trim: true),
    url: System.get_env("PRODAMUS_URL"),
    secret: System.get_env("PRODAMUS_SECRET"),
    sys: System.get_env("PRODAMUS_SYS")
  ],
  "lava" => [
    approved: System.get_env("LAVA_APPROVED") == "true",
    environment: "production",
    currencies: String.split(System.get_env("LAVA_CURRENCIES", "USD"), ",", trim: true),
    offer_id: System.get_env("LAVA_OFFER_ID"),
    api_key: System.get_env("LAVA_API_KEY"),
    webhook_secret: System.get_env("LAVA_WEBHOOK_SECRET")
  ]
}

if config_env() == :prod and System.get_env("DATABASE_URL") do
  if not System.get_env("SMTP_HOST"), do: raise("Account-enabled production requires SMTP_HOST")

  if URI.parse(System.get_env("PUBLIC_ORIGIN", "")).scheme != "https",
    do: raise("Account-enabled production requires an HTTPS PUBLIC_ORIGIN")
end

if relay = System.get_env("SMTP_HOST") do
  config :teleprompter, Teleprompter.Mailer,
    adapter: Swoosh.Adapters.SMTP,
    relay: relay,
    username: System.get_env("SMTP_USERNAME"),
    password: System.get_env("SMTP_PASSWORD"),
    port: String.to_integer(System.get_env("SMTP_PORT", "587")),
    tls: :always,
    auth: :always,
    tls_options: [
      verify: :verify_peer,
      cacerts: :public_key.cacerts_get(),
      server_name_indication: String.to_charlist(relay),
      customize_hostname_check: [match_fun: :public_key.pkix_verify_hostname_match_fun(:https)]
    ]
end

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/teleprompter start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :teleprompter, TeleprompterWeb.Endpoint, server: true
end

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  if byte_size(secret_key_base) < 64, do: raise("SECRET_KEY_BASE must contain at least 64 bytes")
  port = String.to_integer(System.get_env("PORT") || "4000")

  profile =
    Teleprompter.RuntimeProfile.build!(
      System.get_env("IZZY_MODE", "public"),
      System.get_env("PUBLIC_ORIGIN"),
      port,
      System.get_env("IZZY_LAUNCH_ID")
    )

  public = profile.public
  admission = Teleprompter.AdmissionConfig.from_env(profile.lan)

  config :teleprompter,
    http_allowed_origins: profile.origins,
    lan_discovery: profile.lan,
    pairing_origin: profile.pairing_origin,
    lan_launch_id: profile.launch_id,
    max_sessions: admission.max_sessions,
    creation_limits: admission.limits,
    trusted_proxy_ips:
      if(profile.lan,
        do: [],
        else: Teleprompter.ClientPeer.trusted!(System.get_env("IZZY_TRUSTED_PROXY_IPS"))
      )

  config :teleprompter,
         :dns_cluster_query,
         if(profile.lan, do: nil, else: System.get_env("DNS_CLUSTER_QUERY"))

  config :teleprompter, TeleprompterWeb.Endpoint,
    url: [host: public.host, port: public.port, scheme: public.scheme],
    check_origin: profile.origins,
    http: [
      # HTTP is internal. Terminate public HTTPS/WSS at the reverse proxy.
      ip: {0, 0, 0, 0},
      port: port
    ],
    secret_key_base: secret_key_base

  # The reverse proxy owns certificates, HTTP-to-HTTPS redirects, HSTS, and
  # WebSocket upgrade forwarding. Keep this internal listener off the internet.
end
