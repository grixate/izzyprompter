defmodule Teleprompter.SavedSessions do
  @moduledoc "Private saved-script bindings, never included in capability snapshots."
  def lock(script_id, fun), do: :global.trans({{__MODULE__, script_id}, self()}, fun, [node()])

  def lookup(script_id) do
    case Registry.lookup(Teleprompter.SavedSessions.Registry, script_id) do
      [{pid, session_id}] -> if Process.alive?(pid), do: {:ok, session_id}, else: :none
      [] -> :none
    end
  end

  def update(session_id, user, params),
    do: Teleprompter.Sessions.saved_update(session_id, user, params)
end
