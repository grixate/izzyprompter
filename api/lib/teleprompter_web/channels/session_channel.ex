defmodule TeleprompterWeb.SessionChannel do
  use TeleprompterWeb, :channel

  alias Teleprompter.{Diagnostics, Sessions, TrafficBudget}

  @impl true
  def join(
        "session:" <> session_id,
        %{"protocol_version" => 2, "role" => role, "token" => token},
        socket
      )
      when role in ["editor", "display", "remote"] do
    connection_id = Base.url_encode64(:crypto.strong_rand_bytes(16), padding: false)

    with {:ok, snapshot} <- Sessions.join(session_id, role, token, connection_id),
         {:ok, session_pid} <- Sessions.lookup(session_id) do
      socket =
        socket
        |> assign(:session_id, session_id)
        |> assign(:role, role)
        |> assign(:connection_id, connection_id)
        |> assign(:session_monitor, Process.monitor(session_pid))
        |> assign(:traffic, TrafficBudget.new(:channel))

      Diagnostics.record(:join, :ok)
      send(self(), :after_join)

      {:ok,
       snapshot
       |> Map.put(:display_id, if(role == "display", do: connection_id, else: nil))
       |> Map.put(:connection_id, connection_id), socket}
    else
      {:error, reason} ->
        Diagnostics.result(:join, {:error, reason})
        {:error, %{reason: reason}}
    end
  end

  def join(_topic, _params, _socket) do
    Diagnostics.record(:join, :invalid)
    {:error, %{reason: :unsupported_protocol}}
  end

  @impl true
  def handle_info(:after_join, socket) do
    case Sessions.snapshot(socket.assigns.session_id) do
      {:ok, snapshot} ->
        # Include the joining page: its join snapshot may precede a concurrent
        # join, and must not leave its own presence readout one connection behind.
        broadcast!(socket, "presence:update", snapshot.presence)
        broadcast!(socket, "reading:update", snapshot.reading)
        broadcast!(socket, "editing:update", snapshot.editing)

      _ ->
        :ok
    end

    {:noreply, socket}
  end

  def handle_info(
        {:DOWN, ref, :process, _pid, _reason},
        %{assigns: %{session_monitor: ref}} = socket
      ) do
    # A paused page may send no commands. Notify it when its session expires
    # or crashes instead of leaving a falsely healthy CONNECTED indicator.
    push(socket, "session:ended", %{reason: :session_unavailable})
    {:stop, :normal, socket}
  end

  @impl true
  def handle_in(event, payload, socket) do
    case TrafficBudget.admit(socket.assigns.traffic, event, payload) do
      {:ok, budget} ->
        {:reply, result, socket} = handle_event(event, payload, assign(socket, :traffic, budget))

        case result do
          {:ok, _} -> Diagnostics.record(:command, :ok)
          {:error, %{reason: reason}} -> Diagnostics.result(:command, {:error, reason})
        end

        {:reply, result, socket}

      {:error, reason, retry, budget} ->
        Diagnostics.result(:command, {:error, reason})

        {:reply, {:error, %{reason: reason, retry_after_ms: retry}},
         assign(socket, :traffic, budget)}
    end
  end

  defp handle_event("transport:play", payload, socket), do: transport(socket, payload, :play)
  defp handle_event("transport:pause", payload, socket), do: transport(socket, payload, :pause)

  defp handle_event("settings:update", %{"patch" => patch} = payload, socket) do
    Sessions.command(
      socket.assigns.session_id,
      socket.assigns.role,
      socket.assigns.client_id,
      payload,
      {:settings, patch}
    )
    |> session_response(socket)
  end

  defp handle_event("settings:remember", payload, socket) do
    Sessions.command(
      socket.assigns.session_id,
      socket.assigns.role,
      socket.assigns.client_id,
      payload,
      :remember_settings
    )
    |> session_response(socket)
  end

  defp handle_event("transport:set_speed", %{"speed" => speed} = payload, socket),
    do: transport(socket, payload, {:set_speed, speed})

  defp handle_event("transport:seek_delta", %{"delta" => delta} = payload, socket),
    do: transport(socket, payload, {:seek_delta, delta})

  defp handle_event("transport:seek_to", %{"position" => position} = payload, socket),
    do: transport(socket, payload, {:seek_to, position})

  defp handle_event("transport:seek_anchor", %{"anchor" => target} = payload, socket),
    do: transport(socket, payload, {:seek_anchor, target})

  defp handle_event("transport:step_block", %{"direction" => direction} = payload, socket),
    do: transport(socket, payload, {:step_block, direction})

  defp handle_event("reading:checkpoint", payload, %{assigns: %{role: "display"}} = socket) do
    Sessions.checkpoint(
      socket.assigns.session_id,
      socket.assigns.connection_id,
      socket.assigns.client_id,
      payload
    )
    |> respond(socket, "reading:update", :reading)
  end

  defp handle_event("reading:checkpoint", _payload, socket),
    do: {:reply, {:error, %{reason: :forbidden}}, socket}

  defp handle_event("script:update", %{"content" => content} = payload, socket) do
    Sessions.update_script(
      socket.assigns.session_id,
      socket.assigns.role,
      socket.assigns.client_id,
      payload,
      content
    )
    |> respond(socket, "script:update", :script)
  end

  defp handle_event("script:begin_edit", payload, socket), do: edit(socket, payload, :begin)

  defp handle_event("script:patch_block", %{"text" => text} = payload, socket),
    do: edit(socket, payload, {:patch, text})

  defp handle_event("script:end_edit", payload, socket), do: edit(socket, payload, :end)

  defp handle_event("script:select_block", %{"block_id" => _} = payload, socket),
    do: edit(socket, payload, :select)

  defp handle_event(_event, _payload, socket),
    do: {:reply, {:error, %{reason: "unknown_event"}}, socket}

  @impl true
  def terminate(_reason, socket) do
    if session_id = socket.assigns[:session_id] do
      case Sessions.leave(session_id, socket.assigns.connection_id) do
        {:ok, snapshot} ->
          TeleprompterWeb.Endpoint.broadcast(
            "session:#{session_id}",
            "presence:update",
            snapshot.presence
          )

          TeleprompterWeb.Endpoint.broadcast(
            "session:#{session_id}",
            "reading:update",
            snapshot.reading
          )

          TeleprompterWeb.Endpoint.broadcast(
            "session:#{session_id}",
            "editing:update",
            snapshot.editing
          )

        _ ->
          :ok
      end
    end

    :ok
  end

  defp transport(socket, payload, command) do
    Sessions.command(
      socket.assigns.session_id,
      socket.assigns.role,
      socket.assigns.client_id,
      payload,
      command
    )
    |> then(fn result ->
      if match?({:set_speed, _}, command),
        do: session_response(result, socket),
        else: respond(result, socket, "transport:update", :transport)
    end)
  end

  defp session_response({:ok, snapshot}, socket) do
    broadcast!(socket, "session:update", snapshot)
    {:reply, {:ok, snapshot}, socket}
  end

  defp session_response({:error, reason}, socket),
    do: {:reply, {:error, %{reason: reason}}, socket}

  defp edit(socket, payload, action) do
    case Sessions.edit(
           socket.assigns.session_id,
           socket.assigns.connection_id,
           socket.assigns.client_id,
           payload,
           action
         ) do
      {:ok, snapshot} ->
        # Text, its restoration anchor and editing ownership are one atomic event.
        broadcast!(socket, "session:update", snapshot)
        {:reply, {:ok, snapshot}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  defp respond({:ok, snapshot}, socket, event, key) do
    payload = Map.fetch!(snapshot, key)
    broadcast!(socket, event, payload)
    if key == :script, do: broadcast!(socket, "reading:update", snapshot.reading)
    {:reply, {:ok, payload}, socket}
  end

  defp respond({:error, reason}, socket, _, _), do: {:reply, {:error, %{reason: reason}}, socket}
end
