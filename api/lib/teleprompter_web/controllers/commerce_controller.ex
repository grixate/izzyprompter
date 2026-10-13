defmodule TeleprompterWeb.CommerceController do
  use TeleprompterWeb, :controller
  import TeleprompterWeb.AccountAuth, only: [require_user: 2]
  plug :require_user when action in [:index, :checkout, :check]
  plug :checkout_budget when action in [:checkout, :check]

  defp checkout_budget(conn, _) do
    case Teleprompter.CreationGate.admit(conn.assigns.current_user.id, Teleprompter.CheckoutGate) do
      :ok ->
        conn

      {:error, :rate_limited, seconds} ->
        conn
        |> put_resp_header("retry-after", to_string(seconds))
        |> put_status(429)
        |> json(%{reason: :rate_limited})
        |> halt()

      _ ->
        conn |> put_status(503) |> json(%{reason: :payments_unavailable}) |> halt()
    end
  end

  def index(conn, _),
    do:
      json(
        conn,
        Map.put(
          Teleprompter.Commerce.options(),
          :purchases,
          Teleprompter.Commerce.purchases(conn.assigns.current_user)
        )
      )

  def checkout(conn, %{"provider" => provider, "currency" => currency} = params) do
    case Teleprompter.Commerce.checkout(
           conn.assigns.current_user,
           provider,
           currency,
           params["confirm_switch"] == true
         ) do
      {:ok, result} -> json(conn, result)
      {:error, reason} -> TeleprompterWeb.AccountController.error(conn, reason)
    end
  end

  def checkout(conn, _), do: TeleprompterWeb.AccountController.error(conn, :invalid_checkout)

  def check(conn, %{"id" => id}) do
    case Teleprompter.Commerce.check_purchase(conn.assigns.current_user, id) do
      {:ok, result} -> json(conn, result)
      {:error, reason} -> TeleprompterWeb.AccountController.error(conn, reason)
    end
  end

  def notify(conn, %{"provider" => provider}) do
    if Teleprompter.Accounts.enabled?() do
      headers =
        Map.new(get_req_header(conn, "sign") |> Enum.map(&{"sign", &1}))
        |> Map.merge(Map.new(get_req_header(conn, "x-api-key") |> Enum.map(&{"x-api-key", &1})))

      case Teleprompter.Commerce.receive_event(provider, conn.body_params, headers) do
        {:ok, _} -> send_resp(conn, 200, "success")
        {:error, :unauthorized} -> send_resp(conn, 401, "Unauthorized")
        {:error, :database_unavailable} -> send_resp(conn, 503, "Unavailable")
        _ -> send_resp(conn, 400, "Invalid event")
      end
    else
      send_resp(conn, 503, "Unavailable")
    end
  end
end
