defmodule TeleprompterWeb.CORS do
  @moduledoc false
  import Plug.Conn

  def init(options), do: options

  def call(conn, _options) do
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-methods", "GET, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type")
    |> maybe_finish_preflight()
  end

  defp maybe_finish_preflight(%{method: "OPTIONS"} = conn),
    do: conn |> send_resp(204, "") |> halt()

  defp maybe_finish_preflight(conn), do: conn
end
