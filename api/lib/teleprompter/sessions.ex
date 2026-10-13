defmodule Teleprompter.Sessions do
  @moduledoc "Explicitly created, capability-protected ephemeral sessions."

  alias Teleprompter.Sessions.Session

  @alphabet "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  def create(content, speed, supervisor \\ Teleprompter.Sessions.Supervisor)

  def create(content, speed, supervisor) when is_binary(content) and is_number(speed) do
    if Teleprompter.Document.valid_content?(content) and speed >= 0.5 and speed <= 1.5 do
      create_session(content, speed, supervisor)
    else
      {:error, :invalid_session}
    end
  end

  def create(_, _, _), do: {:error, :invalid_session}

  def create_saved(user, script_id, preset_id \\ nil) do
    Teleprompter.SavedSessions.lock(script_id, fn ->
      with :none <- Teleprompter.SavedSessions.lookup(script_id),
           script when not is_nil(script) <- Teleprompter.Library.get(user, script_id),
           {:ok, settings} <- saved_settings(user, preset_id) do
        create_session(
          Teleprompter.Library.document_text(script.document),
          settings["speed"],
          Teleprompter.Sessions.Supervisor,
          %{
            saved: %{
              user: user,
              script_id: script.id,
              revision: script.revision,
              title: script.title
            },
            document: script.document,
            settings: settings
          }
        )
      else
        {:ok, _} -> {:error, :session_active}
        nil -> {:error, :not_found}
        error -> error
      end
    end)
  end

  defp saved_settings(user, nil) do
    default =
      if Teleprompter.Commerce.pro?(user),
        do: Enum.find(Teleprompter.Library.presets(user), & &1.is_default)

    {:ok, if(default, do: default.settings, else: Teleprompter.PromptSettings.defaults())}
  end

  defp saved_settings(_user, "standard"), do: {:ok, Teleprompter.PromptSettings.defaults()}
  defp saved_settings(user, preset_id), do: Teleprompter.Library.preset_settings(user, preset_id)

  defp create_session(content, speed, supervisor, extra \\ %{}) do
    id =
      for <<byte <- :crypto.strong_rand_bytes(6)>>,
        into: "",
        do: binary_part(@alphabet, rem(byte, 32), 1)

    tokens =
      Map.new(
        ["editor", "display", "remote"],
        &{&1, Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)}
      )

    token_hashes = Map.new(tokens, fn {role, token} -> {role, :crypto.hash(:sha256, token)} end)

    options =
      Map.merge(%{id: id, token_hashes: token_hashes, content: content, speed: speed}, extra)

    case DynamicSupervisor.start_child(supervisor, {Session, options}) do
      {:ok, _pid} -> {:ok, %{protocol_version: 2, session_id: id, tokens: tokens}}
      {:error, {:already_started, _}} -> create_session(content, speed, supervisor, extra)
      {:error, :max_children} -> {:error, :session_capacity}
      other -> other
    end
  end

  def lookup(id) when is_binary(id) do
    case Registry.lookup(Teleprompter.Sessions.Registry, id) do
      # Registry removes dead entries asynchronously. Never present a stopped
      # session as live during that short cleanup window.
      [{pid, _}] -> if Process.alive?(pid), do: {:ok, pid}, else: {:error, :session_unavailable}
      [] -> {:error, :session_unavailable}
    end
  end

  def lookup(_), do: {:error, :session_unavailable}

  def snapshot(id), do: call(id, :snapshot)
  def saved_update(id, user, params), do: call(id, {:saved_update, user, params})
  def apply_preset(id, user, settings), do: call(id, {:apply_preset, user, settings})
  def end_saved(id, user), do: call(id, {:end_saved, user})
  def join(id, role, token, connection_id), do: call(id, {:join, role, token, connection_id})
  def leave(id, connection_id), do: call(id, {:leave, connection_id})

  def command(id, role, client_id, envelope, command),
    do: call(id, {:command, role, client_id, envelope, command})

  def update_script(id, role, client_id, envelope, content),
    do: call(id, {:script, role, client_id, envelope, content})

  def checkpoint(id, connection_id, client_id, envelope),
    do: call(id, {:checkpoint, connection_id, client_id, envelope})

  def edit(id, connection_id, client_id, envelope, action),
    do: call(id, {:edit, connection_id, client_id, envelope, action})

  defp call(id, message) do
    with {:ok, pid} <- lookup(id), do: GenServer.call(pid, message)
  catch
    :exit, _ -> {:error, :session_unavailable}
  end
end
