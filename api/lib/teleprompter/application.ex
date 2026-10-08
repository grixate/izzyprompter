defmodule Teleprompter.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      TeleprompterWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:teleprompter, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Teleprompter.PubSub},
      {Registry, keys: :unique, name: Teleprompter.Sessions.Registry},
      {DynamicSupervisor, strategy: :one_for_one, name: Teleprompter.Sessions.Supervisor},
      # Start to serve requests, typically the last entry
      TeleprompterWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Teleprompter.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    TeleprompterWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
