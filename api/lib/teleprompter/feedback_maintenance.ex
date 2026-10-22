defmodule Teleprompter.FeedbackMaintenance do
  use GenServer
  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def init(_) do
    Process.send_after(self(), :cleanup, 60_000)
    {:ok, nil}
  end

  def handle_info(:cleanup, state) do
    try do
      Teleprompter.Feedback.purge_expired()
    rescue
      _ -> :ok
    end

    Process.send_after(self(), :cleanup, :timer.hours(24))
    {:noreply, state}
  end
end
