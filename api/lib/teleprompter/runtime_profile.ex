defmodule Teleprompter.RuntimeProfile do
  @moduledoc false

  def build!(mode, origin, port, launch_id \\ nil) do
    profile =
      case mode do
        "public" -> :public
        "lan" -> :lan
        _ -> raise ArgumentError, "IZZY_MODE must be public or lan"
      end

    public = Teleprompter.PublicOrigin.parse!(origin, profile)

    if not is_integer(port) or port not in 1..65_535,
      do: raise(ArgumentError, "PORT must be an integer in 1..65535")

    if profile == :lan and public.port != port,
      do: raise(ArgumentError, "LAN PUBLIC_ORIGIN port must match the local listener PORT")

    origins =
      if profile == :lan,
        do: Enum.uniq([public.origin, "http://127.0.0.1:#{port}", "http://localhost:#{port}"]),
        else: [public.origin]

    if launch_id && not (is_binary(launch_id) and Regex.match?(~r/^[a-f0-9]{64}$/, launch_id)),
      do: raise(ArgumentError, "Invalid LAN launcher identity")

    %{
      public: public,
      origins: origins,
      lan: profile == :lan,
      pairing_origin: if(profile == :lan, do: public.origin, else: nil),
      launch_id: if(profile == :lan, do: launch_id, else: nil)
    }
  end
end
