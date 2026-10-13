defmodule TeleprompterWeb.AccountAuth do
  import Plug.Conn
  def init(opts), do: opts

  def call(conn, _opts) do
    conn = conn |> fetch_session() |> put_resp_header("cache-control", "no-store")
    user = Teleprompter.Accounts.user_for_session(get_session(conn, :account_token))
    assign(conn, :current_user, user)
  end

  def require_user(conn, _) do
    cond do
      not Teleprompter.Accounts.enabled?() ->
        fail(conn, 503, :accounts_unavailable)

      is_nil(conn.assigns.current_user) ->
        fail(conn, 401, :login_required)

      conn.method in ["POST", "PATCH", "DELETE"] and
          get_req_header(conn, "x-izzy-account-id") not in [[], [conn.assigns.current_user.id]] ->
        fail(conn, 409, :account_changed)

      true ->
        conn
    end
  end

  def fail(conn, status, reason),
    do:
      conn
      |> put_resp_content_type("application/json")
      |> send_resp(status, Jason.encode!(%{reason: reason}))
      |> halt()
end
