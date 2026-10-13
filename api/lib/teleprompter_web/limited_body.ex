defmodule TeleprompterWeb.LimitedBody do
  @moduledoc false
  def read_body(conn, options) do
    limit =
      case conn.path_info do
        ["api", "payments" | _] ->
          64 * 1024

        ["api", "account", action]
        when action in ["login-link", "login", "checkout", "channel-ticket"] ->
          16 * 1024

        _ ->
          Keyword.fetch!(options, :length)
      end

    options = Keyword.put(options, :length, min(limit, Keyword.fetch!(options, :length)))

    case Plug.Conn.read_body(conn, options) do
      {:ok, body, conn} ->
        # Cowboy's read length is approximate. Enforce the exact JSON budget
        # even when the last read returns a complete, slightly oversized body.
        if byte_size(body) > Keyword.fetch!(options, :length),
          do: {:more, body, conn},
          else: {:ok, body, conn}

      result ->
        result
    end
  end
end
