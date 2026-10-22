defmodule TeleprompterWeb.SessionController do
  use TeleprompterWeb, :controller
  alias Teleprompter.Sessions

  def create(conn, %{"protocol_version" => 2, "content" => content, "speed" => speed} = params) do
    conn =
      conn
      |> put_resp_header("cache-control", "no-store")
      |> put_resp_header("referrer-policy", "no-referrer")

    # Optional ownership adds appearance and reading-preference privileges. Guest
    # prompting stays available when accounts or their database are unavailable.
    user = optional_user(conn)

    case Teleprompter.Diagnostics.result(
           :creation,
           Sessions.create_owned(content, speed, user, params["settings"])
         ) do
      {:ok, session} ->
        conn |> put_status(:created) |> json(session)

      {:error, :invalid_session} ->
        conn |> put_status(:unprocessable_entity) |> json(%{reason: :invalid_session})

      {:error, :session_capacity} ->
        conn
        |> put_resp_header("retry-after", "30")
        |> put_status(:service_unavailable)
        |> json(%{reason: :session_capacity})

      _ ->
        conn |> put_status(:service_unavailable) |> json(%{reason: :session_unavailable})
    end
  end

  def create(conn, _),
    do:
      conn
      |> put_resp_header("cache-control", "no-store")
      |> put_status(:bad_request)
      |> json(%{reason: :unsupported_protocol})

  defp optional_user(conn) do
    conn = fetch_session(conn)
    Teleprompter.Accounts.user_for_session(get_session(conn, :account_token))
  rescue
    _ -> nil
  end
end
