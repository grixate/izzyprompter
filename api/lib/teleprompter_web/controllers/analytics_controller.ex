defmodule TeleprompterWeb.AnalyticsController do
  use TeleprompterWeb, :controller
  alias Teleprompter.CampaignAnalytics
  import TeleprompterWeb.AccountAuth, only: [require_user: 2]
  plug :require_user when action == :report

  def visit(conn, params) do
    conn = put_resp_header(conn, "cache-control", "no-store")

    if collect?(conn) do
      agent = conn |> get_req_header("user-agent") |> List.first("") |> String.slice(0, 256)

      case CampaignAnalytics.visit(params, Teleprompter.ClientPeer.address(conn), agent) do
        {:ok, token} -> json(conn, %{token: token, expires_in: 1800})
        _ -> send_resp(conn, 204, "")
      end
    else
      send_resp(conn, 204, "")
    end
  end

  def event(conn, %{"event" => "start_clicked", "token" => token}) do
    if collect?(conn), do: CampaignAnalytics.record_token(token, "start_clicked")
    conn |> put_resp_header("cache-control", "no-store") |> send_resp(204, "")
  end

  def event(conn, _),
    do: conn |> put_resp_header("cache-control", "no-store") |> send_resp(204, "")

  def report(conn, params) do
    if CampaignAnalytics.admin?(conn.assigns.current_user) do
      days =
        case Integer.parse(to_string(params["days"] || "30")) do
          {days, ""} when days in 1..366 -> days
          _ -> 30
        end

      conn |> put_resp_header("cache-control", "no-store") |> json(CampaignAnalytics.report(days))
    else
      conn |> put_status(403) |> json(%{reason: "forbidden"})
    end
  end

  defp collect?(conn) do
    CampaignAnalytics.enabled?() and
      get_req_header(conn, "origin") == [Teleprompter.Accounts.origin()] and
      get_req_header(conn, "dnt") != ["1"] and get_req_header(conn, "sec-gpc") != ["1"] and
      not Enum.any?(
        get_req_header(conn, "user-agent"),
        &Regex.match?(~r/bot|crawler|spider|headless|preview|facebookexternalhit/i, &1)
      )
  end
end
