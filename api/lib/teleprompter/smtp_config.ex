defmodule Teleprompter.SmtpConfig do
  @moduledoc false

  # Never interpolate values into configuration errors: they may contain secrets.
  def from_env(get \\ &System.get_env/1) do
    case get.("SMTP_HOST") do
      nil ->
        nil

      _ ->
        relay = required!(get, "SMTP_HOST")
        username = required!(get, "SMTP_USERNAME")
        password = required!(get, "SMTP_PASSWORD")
        port = get.("SMTP_PORT") || "587"

        unless port == "587", do: raise("SMTP_PORT must be 587 (authenticated STARTTLS)")

        [
          adapter: Swoosh.Adapters.SMTP,
          relay: relay,
          username: username,
          password: password,
          port: 587,
          ssl: false,
          tls: :always,
          auth: :always,
          no_mx_lookups: true,
          tls_options: [
            versions: [:"tlsv1.2", :"tlsv1.3"],
            verify: :verify_peer,
            cacerts: :public_key.cacerts_get(),
            server_name_indication: String.to_charlist(relay),
            customize_hostname_check: [
              match_fun: :public_key.pkix_verify_hostname_match_fun(:https)
            ]
          ]
        ]
    end
  end

  defp required!(get, name) do
    value = get.(name)

    if not is_binary(value) or String.trim(value) == "" or String.contains?(value, ["\r", "\n"]),
      do: raise("#{name} is required and must be a single nonempty line")

    value
  end
end
