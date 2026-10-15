defmodule Teleprompter.Commerce.Worker do
  use GenServer
  require Logger
  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  def init(_) do
    send(self(), :process)
    send(self(), :prune)
    send(self(), :reconcile)
    {:ok, %{lookup: nil}}
  end

  # Slow provider calls run outside the durable-webhook worker and playback.
  # Only one lookup is in flight per application; row leases cover other nodes.
  def handle_info(:reconcile, state) do
    state =
      if is_nil(state.lookup) do
        task =
          Task.Supervisor.async_nolink(Teleprompter.CommerceTasks, fn ->
            Teleprompter.Commerce.Reconciler.run_due()
          end)

        %{state | lookup: task.ref}
      else
        state
      end

    Process.send_after(self(), :reconcile, 5_000)
    {:noreply, state}
  end

  def handle_info({ref, _result}, %{lookup: ref} = state) do
    Process.demonitor(ref, [:flush])
    {:noreply, %{state | lookup: nil}}
  end

  def handle_info({:DOWN, ref, :process, _pid, _reason}, %{lookup: ref} = state) do
    Logger.warning("Invoice check interrupted; durable schedule will retry")
    {:noreply, %{state | lookup: nil}}
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
