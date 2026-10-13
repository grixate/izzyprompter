defmodule TeleprompterWeb.UserSocket do
  use Phoenix.Socket, log: false, max_channels_per_transport: 1

  channel "session:*", TeleprompterWeb.SessionChannel

  @impl true
  def connect(%{"client_id" => client_id}, socket, _connect_info)
      when is_binary(client_id) and byte_size(client_id) >= 8 and byte_size(client_id) <= 96 do
    {:ok, assign(socket, :client_id, client_id)}
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(_socket), do: nil
end
