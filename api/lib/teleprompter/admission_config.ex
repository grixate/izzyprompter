defmodule Teleprompter.AdmissionConfig do
  @moduledoc false

  def from_env(lan, env \\ &System.get_env/1) do
    %{
      max_sessions: integer!(env.("IZZY_MAX_SESSIONS"), if(lan, do: 16, else: 32), 1024),
      limits: [
        per_peer: integer!(env.("IZZY_CREATE_PER_IP"), if(lan, do: 30, else: 10), 1000),
        total: integer!(env.("IZZY_CREATE_TOTAL"), if(lan, do: 120, else: 60), 10_000),
        window_ms: 60_000,
        max_peers: 2048
      ]
    }
  end

  defp integer!(nil, fallback, _max), do: fallback

  defp integer!(value, _fallback, max) do
    case Integer.parse(value) do
      {integer, ""} when integer > 0 and integer <= max ->
        integer

      _ ->
        raise ArgumentError,
              "Invalid IZZY admission limit: use a positive integer within its documented bound"
    end
  end
end
