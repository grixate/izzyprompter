defmodule TeleprompterWeb.SecurityHeaders do
  @moduledoc "Browser defenses for the bundled, same-origin application."
  import Plug.Conn
  def init(options), do: options

  def call(conn, _) do
    conn
    |> put_resp_header("x-content-type-options", "nosniff")
    |> put_resp_header("x-frame-options", "DENY")
    |> put_resp_header("referrer-policy", "no-referrer")
    |> put_resp_header(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    )
    |> register_before_send(fn conn ->
      # Vite's development shell is separate. Bundled production has no inline
      # scripts; React's dynamic geometry needs style attributes, not script eval.
      if String.starts_with?(
           get_resp_header(conn, "content-type") |> List.first() || "",
           "text/html"
         ) do
        connect =
          case URI.parse(Teleprompter.Accounts.origin()) do
            %{scheme: scheme, host: host, port: port} when is_binary(host) ->
              URI.to_string(%URI{
                scheme: if(scheme == "https", do: "wss", else: "ws"),
                host: host,
                port: port
              })

            _ ->
              ""
          end

        put_resp_header(
          conn,
          "content-security-policy",
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " <>
            "img-src 'self' data:; font-src 'self'; connect-src 'self' #{connect}; " <>
            "worker-src 'self'; manifest-src 'self'; " <>
            "base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
        )
      else
        conn
      end
    end)
  end
end
