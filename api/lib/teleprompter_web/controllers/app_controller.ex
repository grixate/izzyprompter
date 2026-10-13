defmodule TeleprompterWeb.AppController do
  use TeleprompterWeb, :controller
  alias TeleprompterWeb.AppAssets

  def show(conn, params) do
    cond do
      params["session_id"] && not Regex.match?(~r/^[A-Za-z2-9]{6}$/, params["session_id"]) ->
        conn |> put_status(404) |> json(%{reason: "not_found"})

      AppAssets.available?() ->
        conn
        |> put_resp_header("cache-control", "no-store")
        |> put_resp_content_type("text/html")
        |> send_file(200, AppAssets.index_path())

      true ->
        conn
        |> put_resp_header("cache-control", "no-store")
        |> put_status(503)
        |> json(%{reason: "app_unavailable"})
    end
  end
end
