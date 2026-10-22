defmodule Teleprompter.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    database =
      if Application.get_env(:teleprompter, :accounts_enabled), do: [Teleprompter.Repo], else: []

    product_workers =
      if Application.get_env(:teleprompter, :accounts_enabled) do
        if(Application.get_env(:teleprompter, :feedback_enabled, false),
          do: [Teleprompter.FeedbackMaintenance],
          else: []
        ) ++
          if(Application.get_env(:teleprompter, :product_metrics_enabled, false),
            do: [Teleprompter.Metrics],
            else: []
          )
      else
        []
      end

    children =
      database ++
        product_workers ++
        [
          TeleprompterWeb.Telemetry,
          {Teleprompter.Diagnostics, name: Teleprompter.Diagnostics},
          {DNSCluster, query: Application.get_env(:teleprompter, :dns_cluster_query) || :ignore},
          {Phoenix.PubSub, name: Teleprompter.PubSub},
          {Registry, keys: :unique, name: Teleprompter.Sessions.Registry},
          {Registry, keys: :unique, name: Teleprompter.SavedSessions.Registry},
          {Task.Supervisor, name: Teleprompter.PersistenceTasks},
          Teleprompter.AccountWrites,
          {DynamicSupervisor,
           strategy: :one_for_one,
           name: Teleprompter.Sessions.Supervisor,
           max_children: Application.get_env(:teleprompter, :max_sessions, 32)},
          {Teleprompter.CreationGate, name: Teleprompter.CreationGate},
          Supervisor.child_spec(
            {Teleprompter.CreationGate,
             name: Teleprompter.AccountGate,
             limits:
               Application.get_env(:teleprompter, :account_auth_limits,
                 per_peer: 8,
                 total: 100,
                 max_peers: 1024,
                 window_ms: 60_000
               )},
            id: Teleprompter.AccountGate
          ),
          Supervisor.child_spec(
            {Teleprompter.CreationGate,
             name: Teleprompter.AccountTicketGate,
             limits: [per_peer: 60, total: 600, max_peers: 1024, window_ms: 60_000]},
            id: Teleprompter.AccountTicketGate
          ),
          Supervisor.child_spec(
            {Teleprompter.CreationGate,
             name: Teleprompter.CheckoutGate,
             limits: [per_peer: 6, total: 100, max_peers: 1024, window_ms: 60_000]},
            id: Teleprompter.CheckoutGate
          ),
          # Start to serve requests, typically the last entry
          TeleprompterWeb.Endpoint
        ] ++
        if(
          Application.get_env(:teleprompter, :accounts_enabled) and
            Application.get_env(:teleprompter, :commerce_worker, true),
          do: [{Task.Supervisor, name: Teleprompter.CommerceTasks}, Teleprompter.Commerce.Worker],
          else: []
        )

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
