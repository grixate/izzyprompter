defmodule TeleprompterWeb.CreationGuardTest do
  use ExUnit.Case, async: true
  alias TeleprompterWeb.CreationGuard

  test "429 is non-cacheable with retry guidance, before reading or changing a body" do
    gate = start_supervised!({Teleprompter.CreationGate, limits: [per_peer: 1, total: 2]})
    conn = Plug.Test.conn(:post, "/api/sessions", "Unparsed private draft")
    refute CreationGuard.call(conn, gate: gate).halted
    blocked = CreationGuard.call(conn, gate: gate)
    assert blocked.halted and blocked.status == 429
    assert Jason.decode!(blocked.resp_body) == %{"reason" => "rate_limited"}
    assert Plug.Conn.get_resp_header(blocked, "cache-control") == ["no-store"]
    assert Plug.Conn.get_resp_header(blocked, "retry-after") == ["60"]
    assert blocked.body_params == conn.body_params
  end

  test "health, preflight, reads, and other routes never consume creation quota" do
    for {method, path} <- [
          {:get, "/health/ready"},
          {:options, "/api/sessions"},
          {:get, "/api/network"},
          {:post, "/api/other"}
        ] do
      conn = Plug.Test.conn(method, path)
      assert CreationGuard.call(conn, gate: :missing_gate) == conn
    end
  end

  test "missing admission service produces recoverable 503, never unguarded creation" do
    conn = Plug.Test.conn(:post, "/api/sessions") |> CreationGuard.call(gate: :missing_gate)
    assert conn.status == 503 and conn.halted
    assert Jason.decode!(conn.resp_body) == %{"reason" => "session_unavailable"}
  end
end
