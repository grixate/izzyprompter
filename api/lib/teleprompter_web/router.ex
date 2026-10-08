defmodule TeleprompterWeb.Router do
  use TeleprompterWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", TeleprompterWeb do
    pipe_through :api

    get "/network", NetworkController, :show
  end
end
