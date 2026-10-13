defmodule Teleprompter.PublicOriginTest do
  use ExUnit.Case, async: true
  alias Teleprompter.PublicOrigin

  test "canonicalizes one public HTTPS origin, including a non-default port" do
    assert PublicOrigin.parse!("https://izzy.example/") == %{
             origin: "https://izzy.example",
             host: "izzy.example",
             scheme: "https",
             port: 443
           }

    assert PublicOrigin.parse!("https://izzy.example:8443").port == 8443
  end

  test "plain HTTP is only permitted for local release verification" do
    assert PublicOrigin.parse!("http://127.0.0.1:4100").port == 4100
    assert PublicOrigin.parse!("http://localhost:4100").scheme == "http"
    assert_raise ArgumentError, fn -> PublicOrigin.parse!("http://izzy.example") end
    assert_raise ArgumentError, fn -> PublicOrigin.parse!("http://192.168.1.13:4000") end
  end

  test "missing or ambiguous origins fail closed" do
    for value <- [
          "https://bad host.example",
          nil,
          "",
          "izzy.example",
          "https://",
          "https://izzy.example/app",
          "https://user:pass@izzy.example",
          "https://izzy.example?key=x",
          "https://izzy.example#key=x",
          "https://izzy.example:99999"
        ] do
      assert_raise ArgumentError, fn -> PublicOrigin.parse!(value) end
    end
  end
end
