defmodule Teleprompter.ClientPeer do
  @moduledoc false

  def address(conn, trusted \\ Application.get_env(:teleprompter, :trusted_proxy_ips, [])) do
    if conn.remote_ip in trusted do
      case Plug.Conn.get_req_header(conn, "x-forwarded-for") do
        [value] when byte_size(value) <= 1024 ->
          chain = value |> String.split(",") |> Enum.map(&parse/1)

          if Enum.any?(chain, &is_nil/1),
            do: conn.remote_ip,
            else: Enum.find(Enum.reverse(chain), conn.remote_ip, &(&1 not in trusted))

        _ ->
          conn.remote_ip
      end
    else
      conn.remote_ip
    end
  end

  def trusted!(nil), do: []
  def trusted!(""), do: []

  def trusted!(value) when is_binary(value) do
    values = String.split(value, ",")
    addresses = Enum.map(values, &parse/1)

    if length(addresses) <= 32 and Enum.all?(addresses, &(not is_nil(&1))),
      do: Enum.uniq(addresses),
      else:
        raise(ArgumentError, "IZZY_TRUSTED_PROXY_IPS must contain at most 32 exact IP addresses")
  end

  defp parse(value) do
    case :inet.parse_strict_address(value |> String.trim() |> String.to_charlist()) do
      {:ok, address} -> address
      _ -> nil
    end
  end
end
