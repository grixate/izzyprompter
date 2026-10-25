defmodule TeleprompterWeb.AccountAuth do
  import Plug.Conn
  def init(opts), do: opts

  def call(conn, _opts) do
    conn = conn |> fetch_session() |> put_resp_header("cache-control", "no-store")
    agent = List.first(get_req_header(conn, "user-agent"))

    case Teleprompter.Accounts.BrowserSessions.authenticate(
           get_session(conn, :account_token),
           agent
         ) do
      {user, token} ->
        refreshed = get_session(conn, :account_cookie_refreshed_at)
        now = System.system_time(:second)

        renew =
          not is_integer(refreshed) or refreshed > now or
            now - refreshed >= Teleprompter.Accounts.BrowserSessions.cookie_renew_after()

        conn =
          if renew,
            do:
              conn
              |> put_session(:account_cookie_refreshed_at, now)
              |> configure_session(renew: true),
            else: conn

        conn |> assign(:current_user, user) |> assign(:current_browser_session, token)

      nil ->
        # An old in-flight request must not overwrite a newer sign-in cookie.
        # Invalid credentials grant no access; explicit logout drops the cookie.
        conn |> assign(:current_user, nil) |> assign(:current_browser_session, nil)
    end
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
