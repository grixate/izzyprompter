defmodule Teleprompter.RuntimeProfileTest do
  use ExUnit.Case, async: true
  alias Teleprompter.RuntimeProfile

  test "explicit LAN mode accepts private IPv4 HTTP without weakening public mode" do
    for host <- ["10.0.0.2", "172.16.0.2", "172.31.0.2", "192.168.1.13"] do
      origin = "http://#{host}:4174"
      lan = RuntimeProfile.build!("lan", origin, 4174)
      assert lan.lan
      assert lan.pairing_origin == origin
      assert lan.origins == [origin, "http://127.0.0.1:4174", "http://localhost:4174"]
      assert_raise ArgumentError, fn -> RuntimeProfile.build!("public", origin, 4174) end
    end
  end

  test "LAN mode rejects public, ambiguous, link-local and DNS hosts" do
    for host <- [
          "8.8.8.8",
          "198.18.0.1",
          "169.254.1.2",
          "172.15.0.1",
          "172.32.0.1",
          "izzy.example",
          "computer.local",
          "0.0.0.0"
        ] do
      assert_raise ArgumentError, fn ->
        RuntimeProfile.build!("lan", "http://#{host}:4174", 4174)
      end
    end

    assert_raise ArgumentError, fn ->
      RuntimeProfile.build!("lan", "https://192.168.1.13:4174", 4174)
    end
  end

  test "profile typos and mismatched LAN ports fail closed" do
    assert_raise ArgumentError, fn ->
      RuntimeProfile.build!("local", "https://izzy.example", 4000)
    end

    assert_raise ArgumentError, fn ->
      RuntimeProfile.build!("lan", "http://192.168.1.13:4174", 4000)
    end

    for port <- [0, 65_536, "4000", nil] do
      assert_raise ArgumentError, fn ->
        RuntimeProfile.build!("public", "https://izzy.example", port)
      end
    end
  end

  test "public mode does not disclose pairing origins or LAN startup identities" do
    profile =
      RuntimeProfile.build!("public", "https://izzy.example", 4000, String.duplicate("a", 64))

    refute profile.lan
    assert profile.origins == ["https://izzy.example"]
    assert profile.pairing_origin == nil
    assert profile.launch_id == nil
  end

  test "loopback verification and the launcher's non-secret instance identity are explicit" do
    id = String.duplicate("a", 64)
    lan = RuntimeProfile.build!("lan", "http://127.0.0.1:4174", 4174, id)
    assert lan.launch_id == id
    assert lan.origins == ["http://127.0.0.1:4174", "http://localhost:4174"]

    assert_raise ArgumentError, fn ->
      RuntimeProfile.build!("lan", "http://127.0.0.1:4174", 4174, "bad")
    end
  end
end
