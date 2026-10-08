defmodule TeleprompterWeb.SessionChannel do
  use TeleprompterWeb, :channel

  alias Teleprompter.Sessions

  @impl true
  def join("session:" <> session_id, %{"role" => role}, socket)
      when role in ["editor", "display", "remote"] do
    client_id = socket.assigns.client_id
    snapshot = Sessions.join(session_id, role, client_id)

    socket =
      socket
      |> assign(:session_id, session_id)
      |> assign(:role, role)

    send(self(), :after_join)
    {:ok, snapshot, socket}
  end

  def join(_topic, _params, _socket), do: {:error, %{reason: "invalid_role"}}

  @impl true
  def handle_info(:after_join, socket) do
    broadcast_from!(
      socket,
      "presence:update",
      Sessions.snapshot(socket.assigns.session_id).presence
    )

    {:noreply, socket}
  end

  @impl true
  def handle_in("transport:play", _payload, socket), do: transport(socket, :play)
  def handle_in("transport:pause", _payload, socket), do: transport(socket, :pause)

  def handle_in("transport:set_speed", %{"speed" => speed}, socket),
    do: transport(socket, {:set_speed, speed})

  def handle_in("transport:seek_delta", %{"delta" => delta}, socket),
    do: transport(socket, {:seek_delta, delta})

  def handle_in("transport:seek_to", %{"position" => position}, socket),
    do: transport(socket, {:seek_to, position})

  def handle_in("script:update", %{"content" => content}, socket) when is_binary(content) do
    snapshot = Sessions.update_script(socket.assigns.session_id, content)
    payload = snapshot.script
    broadcast!(socket, "script:update", payload)
    {:reply, {:ok, payload}, socket}
  end

  def handle_in(_event, _payload, socket),
    do: {:reply, {:error, %{reason: "unknown_event"}}, socket}

  @impl true
  def terminate(_reason, socket) do
    if session_id = socket.assigns[:session_id] do
      presence = Sessions.leave(session_id, socket.assigns.client_id).presence
      TeleprompterWeb.Endpoint.broadcast("session:#{session_id}", "presence:update", presence)
    end

    :ok
  end

  defp transport(socket, command) do
    snapshot = Sessions.command(socket.assigns.session_id, command)
    payload = snapshot.transport
    broadcast!(socket, "transport:update", payload)
    {:reply, {:ok, payload}, socket}
  end
end
