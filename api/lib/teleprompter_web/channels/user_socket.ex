defmodule TeleprompterWeb.UserSocket do
  use Phoenix.Socket

  channel "session:*", TeleprompterWeb.SessionChannel

  @impl true
  def connect(%{"client_id" => client_id}, socket, _connect_info) do
    {:ok, assign(socket, :client_id, client_id)}
  end

  def connect(_params, socket, _connect_info) do
    {:ok, assign(socket, :client_id, "anonymous-#{System.unique_integer([:positive])}")}
  end

  @impl true
  def id(socket), do: "client:#{socket.assigns.client_id}"
end
