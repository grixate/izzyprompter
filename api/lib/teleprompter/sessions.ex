defmodule Teleprompter.Sessions do
  @moduledoc "Explicitly created, capability-protected ephemeral sessions."

  alias Teleprompter.Sessions.Session

  @alphabet "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  def create(content, speed, supervisor \\ Teleprompter.Sessions.Supervisor)

  def create(content, speed, supervisor) when is_binary(content) and is_number(speed) do
    if Teleprompter.Document.valid_content?(content) and speed >= 0.2 and speed <= 1.5 do
      create_session(content, speed, supervisor)
    else
      {:error, :invalid_session}
    end
  end

  def create(_, _, _), do: {:error, :invalid_session}

  def create_owned(content, speed, user, device_settings \\ nil) do
    with true <-
           is_binary(content) and is_number(speed) and
             Teleprompter.Document.valid_content?(content) and speed >= 0.2 and speed <= 1.5,
         {:ok, device_settings} <-
           Teleprompter.PromptSettings.validate(
             if(is_nil(device_settings),
               do: Teleprompter.PromptSettings.defaults(),
               else: device_settings
             )
           ) do
      preferences = Teleprompter.ReadingPreferences.get(user)

      settings =
        preferences.settings || Map.put(device_settings, "speed", min(speed, 1.0))

      create_session(content, settings["speed"], Teleprompter.Sessions.Supervisor, %{
        appearance_owner: user,
        settings: settings,
        preferences: preferences
      })
    else
      _ -> {:error, :invalid_session}
    end
  end

  def create_saved(user, script_id, preset_id \\ nil, speed \\ nil) do
    Teleprompter.SavedSessions.lock(script_id, fn ->
      preferences = Teleprompter.ReadingPreferences.get(user)

      with :none <- Teleprompter.SavedSessions.lookup(script_id),
           script when not is_nil(script) <- Teleprompter.Library.get(user, script_id),
           {:ok, settings} <- saved_settings(user, preset_id, speed, preferences) do
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
            settings: settings,
            preferences: preferences
          }
        )
      else
        {:ok, _} -> {:error, :session_active}
        nil -> {:error, :not_found}
        error -> error
      end
    end)
  end

  defp saved_settings(user, nil, speed, preferences) do
    default =
      if Teleprompter.Commerce.pro?(user),
        do: Enum.find(Teleprompter.Library.presets(user), & &1.is_default)

    if default, do: {:ok, default.settings}, else: account_settings(preferences, speed)
  end

  defp saved_settings(_user, "standard", speed, preferences),
    do: account_settings(preferences, speed)

  defp saved_settings(user, preset_id, _speed, _preferences),
    do: Teleprompter.Library.preset_settings(user, preset_id)

  defp account_settings(preferences, speed) do
    with {:ok, fallback} <- standard_settings(speed) do
      {:ok, preferences.settings || fallback}
    end
  end

  defp standard_settings(nil), do: {:ok, Teleprompter.PromptSettings.defaults()}

  defp standard_settings(speed) when is_number(speed) and speed >= 0.2 and speed <= 1.5,
    do: {:ok, Map.put(Teleprompter.PromptSettings.defaults(), "speed", speed)}

  defp standard_settings(_), do: {:error, :invalid_settings}

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

    # Accept old saved speeds without discarding their script or other settings.
    speed = min(speed, 1.0)

    extra =
      if Map.has_key?(extra, :settings),
        do: Map.update!(extra, :settings, &Map.put(&1, "speed", speed)),
        else: extra

    options =
      Map.merge(%{id: id, token_hashes: token_hashes, content: content, speed: speed}, extra)

    case DynamicSupervisor.start_child(supervisor, {Session, options}) do
      {:ok, _pid} ->
        Teleprompter.Metrics.record("session_created")
        {:ok, %{protocol_version: 2, session_id: id, tokens: tokens}}

      {:error, {:already_started, _}} ->
        create_session(content, speed, supervisor, extra)

      {:error, :max_children} ->
        {:error, :session_capacity}

      other ->
        other
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

  def activity do
    Registry.select(Teleprompter.Sessions.Registry, [{{:"$1", :_, :_}, [], [:"$1"]}])
    |> Enum.reduce(%{sessions: 0, playing: 0, connected_devices: 0, editing: 0}, fn id, counts ->
      case snapshot(id) do
        {:ok, snapshot} ->
          %{
            sessions: counts.sessions + 1,
            playing: counts.playing + if(snapshot.transport.status == "playing", do: 1, else: 0),
            connected_devices: counts.connected_devices + Enum.sum(Map.values(snapshot.presence)),
            editing: counts.editing + if(snapshot.editing.active, do: 1, else: 0)
          }

        _ ->
          counts
      end
    end)
  end

  def appearance_owner(id, token), do: call(id, {:appearance_owner, token})
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
