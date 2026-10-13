defmodule TeleprompterWeb.AccountWriteBudget do
  import Plug.Conn
  def init(options), do: options

  def call(%{method: method} = conn, _) when method in ["POST", "PATCH", "DELETE"] do
    case Teleprompter.AccountWrites.admit(conn.assigns.current_user.id, conn.body_params) do
      :ok ->
        conn

      {:error, reason, retry} ->
        conn
        |> put_resp_header("retry-after", to_string(max(1, ceil(retry / 1000))))
        |> put_resp_content_type("application/json")
        |> send_resp(
          if(reason == :payload_too_large, do: 413, else: 429),
          Jason.encode!(%{reason: reason})
        )
        |> halt()
    end
  end

  def call(conn, _), do: conn
end
