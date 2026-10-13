defmodule Teleprompter.ClientPeerTest do
  use ExUnit.Case, async: true
  alias Teleprompter.ClientPeer
  import Plug.Conn

  test "forwarding headers from an untrusted socket peer are ignored" do
    conn =
      Plug.Test.conn(:post, "/api/sessions") |> put_req_header("x-forwarded-for", "198.51.100.1")

    assert ClientPeer.address(conn, []) == conn.remote_ip
    assert ClientPeer.address(conn, [{10, 0, 0, 1}]) == conn.remote_ip
  end

  test "trusted chain walks right-to-left and stops at the first untrusted hop" do
    conn = %{Plug.Test.conn(:post, "/api/sessions") | remote_ip: {10, 0, 0, 1}}
    conn = put_req_header(conn, "x-forwarded-for", "192.0.2.9, 198.51.100.8, 10.0.0.2")
    assert ClientPeer.address(conn, [{10, 0, 0, 1}, {10, 0, 0, 2}]) == {198, 51, 100, 8}
    assert ClientPeer.address(conn, [{10, 0, 0, 1}]) == {10, 0, 0, 2}
  end

  test "malformed or oversized chains fall back to the socket peer" do
    conn = Plug.Test.conn(:post, "/api/sessions")

    for value <- ["unknown", "", "198.51.100.1, bad", String.duplicate("1", 1025)] do
      request = put_req_header(conn, "x-forwarded-for", value)
      assert ClientPeer.address(request, [conn.remote_ip]) == conn.remote_ip
    end

    assert ClientPeer.address(conn, [conn.remote_ip]) == conn.remote_ip
  end

  test "trust configuration accepts exact IPs only, never wildcard, CIDR, or hostname" do
    assert ClientPeer.trusted!(nil) == []
    assert ClientPeer.trusted!("127.0.0.1, ::1") == [{127, 0, 0, 1}, {0, 0, 0, 0, 0, 0, 0, 1}]

    for invalid <- ["*", "10.0.0.0/8", "proxy.local", "127.0.0.1,", "999.0.0.1"] do
      assert_raise ArgumentError, fn -> ClientPeer.trusted!(invalid) end
    end
  end
end
