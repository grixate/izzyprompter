defmodule TeleprompterWeb.NetworkController do
  use TeleprompterWeb, :controller

  def show(conn, _params) do
    hosts =
      if Application.get_env(:teleprompter, :lan_discovery, false), do: lan_hosts(), else: []

    response =
      case Application.get_env(:teleprompter, :pairing_origin) do
        origin when is_binary(origin) -> %{hosts: hosts, pairing_origin: origin}
        _ -> %{hosts: hosts}
      end

    conn |> put_resp_header("cache-control", "no-store") |> json(response)
  end

  defp lan_hosts do
    case :inet.getifaddrs() do
      {:ok, interfaces} ->
        interfaces
        |> Enum.flat_map(fn {name, options} ->
          options
          |> Keyword.get_values(:addr)
          |> Enum.filter(&(is_tuple(&1) and tuple_size(&1) == 4))
          |> Enum.reject(fn {a, b, _c, _d} -> a == 127 or (a == 169 and b == 254) end)
          |> Enum.map(&{to_string(name), &1})
        end)
        |> Enum.sort_by(fn {name, _address} -> if name == "en0", do: 0, else: 1 end)
        |> Enum.map(fn {_name, address} -> address |> :inet.ntoa() |> to_string() end)
        |> Enum.uniq()

      _ ->
        []
    end
  end
end
