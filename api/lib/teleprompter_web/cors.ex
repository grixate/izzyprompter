defmodule TeleprompterWeb.CORS do
  @moduledoc false
  import Plug.Conn

  def init(options), do: options

  def call(conn, _options) do
    origin = get_req_header(conn, "origin")
    allowed = Application.get_env(:teleprompter, :http_allowed_origins, [])

    cond do
      allowed == :any ->
        allow(conn, "*")

      origin == [] ->
        conn

      length(origin) == 1 and hd(origin) in allowed ->
        allow(conn, hd(origin))

      true ->
        conn
        |> put_resp_header("cache-control", "no-store")
        |> send_resp(403, "Forbidden origin")
        |> halt()
    end
  end

  defp allow(conn, origin) do
    conn
    |> put_resp_header("access-control-allow-origin", origin)
    |> put_resp_header("access-control-allow-methods", "GET, POST, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type")
    |> put_resp_header("access-control-expose-headers", "retry-after")
    |> put_resp_header("vary", "Origin")
    |> maybe_finish_preflight()
  end

  defp maybe_finish_preflight(%{method: "OPTIONS"} = conn),
    do: conn |> send_resp(204, "") |> halt()

  defp maybe_finish_preflight(conn), do: conn
end
