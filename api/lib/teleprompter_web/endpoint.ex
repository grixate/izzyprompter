defmodule TeleprompterWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :teleprompter

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_teleprompter_key",
    signing_salt: "/tHXUYst",
    http_only: true,
    max_age: 30 * 24 * 60 * 60,
    same_site: "Lax"
  ]

  socket "/socket", TeleprompterWeb.UserSocket,
    websocket: [timeout: 45_000, max_frame_size: 3 * 1024 * 1024, compress: false],
    longpoll: false

  socket "/account/socket", TeleprompterWeb.AccountSocket,
    websocket: [timeout: 45_000, max_frame_size: 16_384],
    longpoll: false

  plug TeleprompterWeb.SecurityHeaders

  # Serve at "/" the static files from "priv/static" directory.
  #
  # You should set gzip to true if you are running phx.digest
  # when deploying your static files in production.
  plug Plug.Static,
    at: "/",
    from: {:teleprompter, "priv/static/app"},
    gzip: false,
    only: ~w(assets),
    cache_control_for_etags: "public, max-age=31536000, immutable"

  plug Plug.Static,
    at: "/",
    from: {:teleprompter, "priv/static/app"},
    gzip: false,
    only: ~w(local-sw.js manifest.webmanifest offline-icon.svg favicon.svg favicon-16.png favicon-32.png apple-touch-icon.png icon-192.png icon-512.png),
    cache_control_for_etags: "no-cache"

  plug Plug.Static,
    at: "/",
    from: :teleprompter,
    gzip: false,
    only: TeleprompterWeb.static_paths()

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    plug Phoenix.CodeReloader
  end

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]
  plug TeleprompterWeb.CORS
  # Count creation attempts before parsing their bodies; other operations are
  # independent of this gate, including health, joins, and live editing.
  plug TeleprompterWeb.CreationGuard

  plug Plug.Parsers,
    parsers: [:urlencoded, :json],
    body_reader: {TeleprompterWeb.LimitedBody, :read_body, []},
    length: 3 * 1024 * 1024,
    read_length: 64 * 1024,
    read_timeout: 5_000,
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug :browser_session
  plug TeleprompterWeb.Router

  defp browser_session(conn, _) do
    secure =
      URI.parse(Application.get_env(:teleprompter, :account_origin, "http://localhost")).scheme ==
        "https"

    Plug.Session.call(conn, Plug.Session.init(Keyword.put(@session_options, :secure, secure)))
  end
end
