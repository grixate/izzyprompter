defmodule TeleprompterWeb.AccountController do
  use TeleprompterWeb, :controller
  alias Teleprompter.{Accounts, Commerce}
  import TeleprompterWeb.AccountAuth, only: [require_user: 2]
  plug :require_user when action in [:logout, :ticket]

  def show(conn, _) do
    user = conn.assigns.current_user
    config = Application.get_env(:teleprompter, :google, [])

    json(conn, %{
      enabled: Accounts.enabled?(),
      csrf_token: Plug.CSRFProtection.get_csrf_token(),
      google_enabled: is_binary(config[:client_id]) and is_binary(config[:client_secret]),
      user: if(user, do: %{id: user.id, email: user.email, pro: Commerce.pro?(user)}, else: nil)
    })
  end

  def request_link(conn, %{"email" => email} = params) do
    if Accounts.enabled?() do
      case Accounts.request_login(email, params["return_to"]) do
        :ok -> json(conn, %{sent: true})
        {:error, reason} -> error(conn, reason)
      end
    else
      error(conn, :accounts_unavailable)
    end
  end

  def request_link(conn, _), do: error(conn, :invalid_email)

  def login(conn, %{"token" => token}) do
    if Accounts.enabled?() do
      case Accounts.consume_login(token) do
        {:ok, {_user, raw}} ->
          conn = signed_in(conn, raw)
          json(conn, %{signed_in: true, csrf_token: Plug.CSRFProtection.get_csrf_token()})

        {:error, reason} ->
          error(conn, reason)
      end
    else
      error(conn, :accounts_unavailable)
    end
  end

  def login(conn, _), do: error(conn, :invalid_token)

  def logout(conn, _) do
    Accounts.revoke(get_session(conn, :account_token))
    conn |> clear_session() |> configure_session(drop: true) |> json(%{signed_out: true})
  end

  def ticket(conn, _) do
    raw = get_session(conn, :account_token)
    ticket = Phoenix.Token.sign(TeleprompterWeb.Endpoint, "account_channel", raw)
    json(conn, %{ticket: ticket, user_id: conn.assigns.current_user.id})
  end

  def signed_in(conn, raw) do
    Plug.CSRFProtection.delete_csrf_token()
    conn |> clear_session() |> configure_session(renew: true) |> put_session(:account_token, raw)
  end

  def error(conn, reason) do
    status =
      case reason do
        :not_found -> 404
        :login_required -> 401
        :pro_required -> 403
        :accounts_unavailable -> 503
        :database_unavailable -> 503
        :mail_unavailable -> 503
        :session_active -> 409
        :script_limit -> 409
        :editing_active -> 409
        :save_in_progress -> 409
        :payment_pending -> 409
        _ -> 422
      end

    case reason do
      {:conflict, current} ->
        conn |> put_status(409) |> json(%{reason: :conflict, current: current})

      _ ->
        conn |> put_status(status) |> json(%{reason: reason})
    end
  end
end
