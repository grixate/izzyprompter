defmodule TeleprompterWeb.BrowserSessionController do
  use TeleprompterWeb, :controller
  import TeleprompterWeb.AccountAuth, only: [require_user: 2]
  alias Teleprompter.Accounts
  alias Teleprompter.Accounts.BrowserSessions
  plug :require_user

  def index(conn, _) do
    json(conn, %{
      user_id: conn.assigns.current_user.id,
      sessions: BrowserSessions.list(conn.assigns.current_user, get_session(conn, :account_token))
    })
  end

  def delete(conn, %{"id" => id}) do
    case BrowserSessions.revoke_device(conn.assigns.current_user, id) do
      {:ok, hash} ->
        current = hash == Accounts.hash(get_session(conn, :account_token))

        conn =
          if current, do: conn |> clear_session() |> configure_session(drop: true), else: conn

        json(conn, %{revoked: true, signed_out: current})

      {:error, reason} ->
        TeleprompterWeb.AccountController.error(conn, reason)
    end
  end

  def delete_others(conn, _) do
    count =
      BrowserSessions.revoke_others(conn.assigns.current_user, get_session(conn, :account_token))

    json(conn, %{revoked: count})
  end
end
