defmodule Teleprompter.PublicOrigin do
  @moduledoc false

  def parse!(value, profile \\ :public)

  def parse!(value, profile) when is_binary(value) and profile in [:public, :lan] do
    uri =
      case URI.new(value) do
        {:ok, uri} -> uri
        _ -> raise ArgumentError, "PUBLIC_ORIGIN must be a valid origin"
      end

    secure = uri.scheme == "https"
    local = uri.scheme == "http" and uri.host in ["127.0.0.1", "localhost", "::1"]

    allowed =
      if profile == :lan, do: uri.scheme == "http" and lan_host?(uri.host), else: secure or local

    if allowed and is_binary(uri.host) and uri.host != "" and
         is_integer(uri.port) and uri.port in 1..65_535 and uri.path in [nil, "", "/"] and
         is_nil(uri.userinfo) and is_nil(uri.query) and is_nil(uri.fragment) do
      %{
        origin: URI.to_string(%{uri | path: nil}),
        host: uri.host,
        scheme: uri.scheme,
        port: uri.port
      }
    else
      raise ArgumentError,
            "PUBLIC_ORIGIN must be a single valid origin without a path, credentials, query, or fragment; public mode requires HTTPS (except loopback), LAN mode requires HTTP on a private IPv4 or loopback address"
    end
  end

  def parse!(_, _),
    do: raise(ArgumentError, "A valid PUBLIC_ORIGIN and runtime profile are required")

  defp lan_host?("localhost"), do: true

  defp lan_host?(host) when is_binary(host) do
    case :inet.parse_ipv4_address(String.to_charlist(host)) do
      {:ok, {10, _, _, _}} -> true
      {:ok, {172, b, _, _}} when b in 16..31 -> true
      {:ok, {192, 168, _, _}} -> true
      {:ok, {127, 0, 0, 1}} -> true
      _ -> false
    end
  end

  defp lan_host?(_), do: false
end
