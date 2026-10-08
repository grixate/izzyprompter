defmodule Teleprompter.Sessions do
  @moduledoc "Ephemeral, supervised teleprompter sessions."

  alias Teleprompter.Sessions.Session

  def fetch_or_start(id) do
    normalized = id |> to_string() |> String.upcase() |> String.replace(~r/[^A-Z0-9]/, "")

    case Registry.lookup(Teleprompter.Sessions.Registry, normalized) do
      [{pid, _}] ->
        {:ok, pid}

      [] ->
        case DynamicSupervisor.start_child(
               Teleprompter.Sessions.Supervisor,
               {Session, normalized}
             ) do
          {:ok, pid} -> {:ok, pid}
          {:error, {:already_started, pid}} -> {:ok, pid}
          other -> other
        end
    end
  end

  def snapshot(id), do: call(id, :snapshot)
  def command(id, command), do: call(id, {:command, command})
  def update_script(id, content), do: call(id, {:script, content})
  def join(id, role, client_id), do: call(id, {:join, role, client_id})
  def leave(id, client_id), do: call(id, {:leave, client_id})

  defp call(id, message) do
    with {:ok, pid} <- fetch_or_start(id), do: GenServer.call(pid, message)
  end
end
