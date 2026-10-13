defmodule TeleprompterWeb.AccountSocket do
  use Phoenix.Socket, log: false, max_channels_per_transport: 1
  channel "account:*", TeleprompterWeb.AccountChannel

  def connect(%{"ticket" => ticket}, socket, _) do
    with true <- Teleprompter.Accounts.enabled?(),
         {:ok, raw} <-
           Phoenix.Token.verify(TeleprompterWeb.Endpoint, "account_channel", ticket, max_age: 60),
         user when not is_nil(user) <- Teleprompter.Accounts.user_for_session(raw) do
      {:ok, socket |> assign(:user_id, user.id) |> assign(:account_token, raw)}
    else
      _ -> :error
    end
  end

  def connect(_, _, _), do: :error

  def id(socket),
    do:
      "account_socket:" <> Base.encode16(Teleprompter.Accounts.hash(socket.assigns.account_token))
end

defmodule TeleprompterWeb.AccountChannel do
  use TeleprompterWeb, :channel

  def join("account:" <> id, _, socket) do
    if id == socket.assigns.user_id do
      Phoenix.PubSub.subscribe(Teleprompter.PubSub, "account:" <> id)

      Phoenix.PubSub.subscribe(
        Teleprompter.PubSub,
        "account_session:" <>
          Base.encode16(Teleprompter.Accounts.hash(socket.assigns.account_token))
      )

      Process.send_after(self(), :check_session, 60_000)
      {:ok, socket}
    else
      {:error, %{reason: :unauthorized}}
    end
  end

  def handle_info({:account_update, message}, socket) do
    if Teleprompter.Accounts.user_for_session(socket.assigns.account_token) do
      push(socket, "updated", message)
      {:noreply, socket}
    else
      {:stop, :normal, socket}
    end
  end

  def handle_info(:revoked, socket), do: {:stop, :normal, socket}

  def handle_info(:check_session, socket) do
    if Teleprompter.Accounts.user_for_session(socket.assigns.account_token) do
      Process.send_after(self(), :check_session, 60_000)
      {:noreply, socket}
    else
      {:stop, :normal, socket}
    end
  end
end
