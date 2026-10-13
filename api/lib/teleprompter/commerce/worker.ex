defmodule Teleprompter.Commerce.Worker do
  use GenServer
  require Logger
  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def init(_) do
    send(self(), :process)
    send(self(), :prune)
    {:ok, nil}
  end

  def handle_info(:process, state) do
    try do
      Teleprompter.Commerce.process_events()
    rescue
      _ -> Logger.warning("Commerce processing unavailable; durable events will retry")
    end

    Process.send_after(self(), :process, 5_000)
    {:noreply, state}
  end

  def handle_info(:prune, state) do
    try do
      Teleprompter.Maintenance.prune()
    rescue
      _ -> Logger.warning("Retention cleanup unavailable; will retry")
    end

    Process.send_after(self(), :prune, 60_000)
    {:noreply, state}
  end
end
