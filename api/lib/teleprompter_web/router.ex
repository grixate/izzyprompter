defmodule TeleprompterWeb.Router do
  use TeleprompterWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :browser do
    plug :accepts, ["html"]

    plug :put_secure_browser_headers, %{
      "referrer-policy" => "no-referrer",
      "x-frame-options" => "DENY"
    }
  end

  pipeline :account do
    plug TeleprompterWeb.AccountAuth
    plug :protect_from_forgery

    plug :put_secure_browser_headers, %{
      "referrer-policy" => "no-referrer",
      "x-frame-options" => "DENY"
    }
  end

  scope "/api/account", TeleprompterWeb do
    pipe_through [:api, :account]
    get "/", AccountController, :show
    post "/login-link", AccountController, :request_link
    post "/login", AccountController, :login
    post "/logout", AccountController, :logout
    post "/channel-ticket", AccountController, :ticket
    get "/scripts", LibraryController, :index
    post "/scripts", LibraryController, :create
    get "/scripts/:id", LibraryController, :show
    patch "/scripts/:id", LibraryController, :update
    delete "/scripts/:id", LibraryController, :delete
    post "/scripts/:id/duplicate", LibraryController, :duplicate
    post "/scripts/:id/restore", LibraryController, :restore
    post "/scripts/:id/session", LibraryController, :start_session
    delete "/scripts/:id/session", LibraryController, :end_session
    post "/scripts/:id/apply-preset", LibraryController, :apply_preset
    get "/presets", LibraryController, :presets
    post "/presets", LibraryController, :save_preset
    patch "/presets/:id", LibraryController, :save_preset
    delete "/presets/:id", LibraryController, :delete_preset
    get "/commerce", CommerceController, :index
    post "/checkout", CommerceController, :checkout
    post "/purchases/:id/check", CommerceController, :check
  end

  # No browser session/CSRF pipeline on provider callbacks. Each adapter
  # authenticates the notification before its durable inbox is written.
  scope "/api/payments", TeleprompterWeb do
    post "/:provider", CommerceController, :notify
  end

  scope "/auth", TeleprompterWeb do
    pipe_through [:browser, :account]
    get "/google", GoogleController, :start
    get "/google/callback", GoogleController, :callback
  end

  scope "/health", TeleprompterWeb do
    pipe_through :api
    get "/live", HealthController, :live
    get "/ready", HealthController, :ready
  end

  scope "/api", TeleprompterWeb do
    pipe_through :api

    get "/network", NetworkController, :show
    post "/sessions", SessionController, :create
  end

  # Deliberately not a catch-all: missing API routes and asset requests must
  # remain 404s, never return the application's HTML in place of JSON/JS.
  scope "/", TeleprompterWeb do
    pipe_through :browser
    get "/", AppController, :show
    get "/local", AppController, :show
    get "/local/remote", AppController, :show
    get "/display/:session_id", AppController, :show
    get "/remote/:session_id", AppController, :show
    get "/account", AppController, :show
    get "/account/login", AppController, :show
    get "/account/scripts/:id", AppController, :show
  end
end
