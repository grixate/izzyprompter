defmodule Teleprompter.Sessions.Session do
  use GenServer, restart: :temporary

  require Logger

  @idle_timeout :timer.hours(6)
  @default_speed 0.86

  def start_link(id) do
    GenServer.start_link(__MODULE__, id,
      name: {:via, Registry, {Teleprompter.Sessions.Registry, id}}
    )
  end

  @impl true
  def init(id) do
    now = now_ms()
    Logger.info("session_created session_id=#{id}")

    {:ok,
     %{
       id: id,
       script: "",
       script_revision: 0,
       transport: %{
         status: "paused",
         anchor_position: 0.0,
         speed: @default_speed,
         anchor_server_time: now,
         revision: 0
       },
       clients: %{}
     }, @idle_timeout}
  end

  @impl true
  def handle_call(:snapshot, _from, state) do
    {:reply, snapshot(state), state, @idle_timeout}
  end

  def handle_call({:join, role, client_id}, _from, state) do
    clients = Map.put(state.clients, client_id, role)
    next = %{state | clients: clients}
    Logger.info("client_joined session_id=#{state.id} role=#{role} client_id=#{client_id}")
    {:reply, snapshot(next), next, @idle_timeout}
  end

  def handle_call({:leave, client_id}, _from, state) do
    Logger.info("client_left session_id=#{state.id} client_id=#{client_id}")
    next = %{state | clients: Map.delete(state.clients, client_id)}
    {:reply, snapshot(next), next, @idle_timeout}
  end

  def handle_call({:script, content}, _from, state) when is_binary(content) do
    next = %{state | script: content, script_revision: state.script_revision + 1}
    {:reply, snapshot(next), next, @idle_timeout}
  end

  def handle_call({:command, command}, _from, state) do
    now = now_ms()
    transport = apply_command(state.transport, command, now)
    next = %{state | transport: transport}
    {:reply, snapshot(next), next, @idle_timeout}
  end

  @impl true
  def handle_info(:timeout, state) do
    Logger.info("session_expired session_id=#{state.id}")
    {:stop, :normal, state}
  end

  defp apply_command(transport, :play, now) do
    anchor(transport, current_position(transport, now), now, %{status: "playing"})
  end

  defp apply_command(transport, :pause, now) do
    anchor(transport, current_position(transport, now), now, %{status: "paused"})
  end

  defp apply_command(transport, {:set_speed, speed}, now) when is_number(speed) do
    anchor(transport, current_position(transport, now), now, %{speed: clamp(speed, 0.5, 1.5)})
  end

  defp apply_command(transport, {:seek_delta, delta}, now) when is_number(delta) do
    position = max(0.0, current_position(transport, now) + delta)
    anchor(transport, position, now, %{})
  end

  defp apply_command(transport, {:seek_to, position}, now) when is_number(position) do
    anchor(transport, max(0.0, position), now, %{})
  end

  defp apply_command(transport, _unknown, _now), do: transport

  defp current_position(%{status: "playing"} = transport, now) do
    elapsed_seconds = max(0, now - transport.anchor_server_time) / 1_000
    transport.anchor_position + elapsed_seconds * 52 * transport.speed
  end

  defp current_position(transport, _now), do: transport.anchor_position

  defp anchor(transport, position, now, changes) do
    transport
    |> Map.merge(changes)
    |> Map.merge(%{
      anchor_position: position,
      anchor_server_time: now,
      revision: transport.revision + 1
    })
  end

  defp snapshot(state) do
    %{
      session_id: state.id,
      script: %{content: state.script, revision: state.script_revision},
      transport: state.transport,
      presence: presence(state.clients),
      server_time: now_ms()
    }
  end

  defp presence(clients) do
    clients
    |> Map.values()
    |> Enum.frequencies()
    |> Map.merge(%{"editor" => 0, "display" => 0, "remote" => 0}, fn _key, count, _ -> count end)
  end

  defp now_ms, do: System.system_time(:millisecond)
  defp clamp(value, min, max), do: value |> Kernel.max(min) |> Kernel.min(max)
end
