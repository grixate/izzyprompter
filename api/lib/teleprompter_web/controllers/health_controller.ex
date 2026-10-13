defmodule TeleprompterWeb.HealthController do
  use TeleprompterWeb, :controller
  alias TeleprompterWeb.AppAssets

  def live(conn, _params), do: respond(conn, 200, "ok")

  def ready(conn, _params) do
    services = [
      Teleprompter.PubSub,
      Teleprompter.Sessions.Registry,
      Teleprompter.Sessions.Supervisor,
      Teleprompter.CreationGate
    ]

    conn =
      case Application.get_env(:teleprompter, :lan_launch_id) do
        id when is_binary(id) -> put_resp_header(conn, "x-izzy-instance", id)
        _ -> conn
      end

    ready = AppAssets.available?() && Enum.all?(services, &alive?/1) && database_ready?()
    respond(conn, if(ready, do: 200, else: 503), if(ready, do: "ready", else: "unavailable"))
  end

  defp database_ready? do
    if Teleprompter.Accounts.enabled?() do
      # A reachable but unmigrated database is not a ready account service.
      match?(
        {:ok, _},
        Ecto.Adapters.SQL.query(Teleprompter.Repo, "SELECT 1 FROM users LIMIT 0", [],
          timeout: 1_000,
          pool_timeout: 1_000
        )
      )
    else
      true
    end
  rescue
    _ -> false
  catch
    :exit, _ -> false
  end

  defp alive?(name) do
    case Process.whereis(name) do
      pid when is_pid(pid) -> Process.alive?(pid)
      _ -> false
    end
  end

  defp respond(conn, status, state),
    do:
      conn
      |> put_resp_header("cache-control", "no-store")
      |> put_status(status)
      |> json(%{status: state})
end
