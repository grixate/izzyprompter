defmodule TeleprompterWeb.GoogleController do
  use TeleprompterWeb, :controller
  alias Teleprompter.Accounts

  def start(conn, params) do
    config = config()

    if Accounts.enabled?() and is_binary(config[:client_id]) and is_binary(config[:client_secret]) do
      case Assent.Strategy.Google.authorize_url(config) do
        {:ok, %{url: url, session_params: session_params}} ->
          conn
          |> put_session(:google_oauth, %{
            params: session_params,
            at: System.system_time(:second),
            user_id: conn.assigns.current_user && conn.assigns.current_user.id,
            return_to: Teleprompter.Product.return_to(params["returnTo"])
          })
          |> redirect(external: url)

        _ ->
          login_error(conn, "google_unavailable", params["returnTo"])
      end
    else
      login_error(conn, "google_unavailable", params["returnTo"])
    end
  end

  def callback(conn, params) do
    pending = get_session(conn, :google_oauth)
    conn = delete_session(conn, :google_oauth)
    current_id = conn.assigns.current_user && conn.assigns.current_user.id

    with %{params: session_params, at: at, user_id: ^current_id} <- pending,
         true <- (System.system_time(:second) - at) in 0..599,
         {:ok, %{user: identity}} <-
           Assent.Strategy.Google.callback(
             Keyword.put(config(), :session_params, session_params),
             params
           ),
         {:ok, user} <- Accounts.google_identity(identity, conn.assigns.current_user) do
      raw = Accounts.issue_token(user.id, "session", 30 * 24 * 60 * 60)
      target = Teleprompter.Product.return_to(Map.get(pending, :return_to)) || "/account"
      conn |> TeleprompterWeb.AccountController.signed_in(raw) |> redirect(to: target)
    else
      {:error, :sign_in_to_link} -> login_error(conn, "sign_in_to_link", pending_target(pending))
      _ -> login_error(conn, "google_login_failed", pending_target(pending))
    end
  end

  defp pending_target(pending) when is_map(pending), do: Map.get(pending, :return_to)
  defp pending_target(_), do: nil

  defp login_error(conn, error, target) do
    query =
      case Teleprompter.Product.return_to(target) do
        nil -> %{"error" => error}
        safe -> %{"error" => error, "returnTo" => safe}
      end

    redirect(conn, to: "/account?" <> URI.encode_query(query))
  end

  defp config do
    Application.get_env(:teleprompter, :google, [])
    |> Keyword.put(:redirect_uri, Accounts.origin() <> "/auth/google/callback")
    |> Keyword.put(
      :http_adapter,
      {Assent.HTTPAdapter.Req, [retry: false, receive_timeout: 10_000]}
    )
  end
end
