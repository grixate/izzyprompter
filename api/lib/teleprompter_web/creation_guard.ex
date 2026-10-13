defmodule TeleprompterWeb.CreationGuard do
  @moduledoc false
  import Plug.Conn

  def init(options), do: options

  def call(%{method: "POST", path_info: ["api", "sessions"]} = conn, options) do
    peer = Teleprompter.ClientPeer.address(conn)

    case Teleprompter.CreationGate.admit(
           peer,
           Keyword.get(options, :gate, Teleprompter.CreationGate)
         ) do
      :ok -> conn
      {:error, :rate_limited, seconds} -> refuse(conn, 429, "rate_limited", seconds)
      _ -> refuse(conn, 503, "session_unavailable", 1)
    end
  end

  def call(%{method: "POST", path_info: ["api", "account", action]} = conn, _)
      when action in ["login-link", "login", "checkout", "channel-ticket"] do
    case Teleprompter.CreationGate.admit(
           Teleprompter.ClientPeer.address(conn),
           if(action == "channel-ticket",
             do: Teleprompter.AccountTicketGate,
             else: Teleprompter.AccountGate
           )
         ) do
      :ok -> conn
      {:error, :rate_limited, seconds} -> refuse(conn, 429, "rate_limited", seconds)
      _ -> refuse(conn, 503, "accounts_unavailable", 1)
    end
  end

  def call(conn, _), do: conn

  defp refuse(conn, status, reason, retry) do
    Teleprompter.Diagnostics.record(
      :creation,
      if(status == 429, do: :rate_limited, else: :unavailable)
    )

    conn
    |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("retry-after", Integer.to_string(retry))
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(%{reason: reason}))
    |> halt()
  end
end
