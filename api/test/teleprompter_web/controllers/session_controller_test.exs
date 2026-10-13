defmodule TeleprompterWeb.SessionControllerTest do
  use TeleprompterWeb.ConnCase, async: true

  test "creates an initialized session with non-cacheable role capabilities", %{conn: conn} do
    conn =
      post(conn, "/api/sessions", %{protocol_version: 2, content: "Camera ready", speed: 0.91})

    response = json_response(conn, 201)
    assert response["protocol_version"] == 2
    assert response["session_id"] =~ ~r/^[A-Z2-9]{6}$/
    assert Enum.all?(Map.values(response["tokens"]), &(byte_size(&1) == 43))
    assert get_resp_header(conn, "cache-control") == ["no-store"]
    {:ok, snapshot} = Teleprompter.Sessions.snapshot(response["session_id"])
    assert snapshot.script.content == "Camera ready"
    assert snapshot.transport.speed == 0.91
  end

  test "rejects missing versions and invalid scripts", %{conn: conn} do
    assert conn |> post("/api/sessions", %{content: "Script"}) |> json_response(400) == %{
             "reason" => "unsupported_protocol"
           }

    assert conn
           |> post("/api/sessions", %{protocol_version: 2, content: "", speed: 1})
           |> json_response(422) == %{"reason" => "invalid_session"}
  end

  test "filters scripts and capability values from Phoenix parameter logs" do
    filtered =
      Phoenix.Logger.filter_values(%{
        "content" => "Private script",
        "token" => "Private key",
        "role" => "remote"
      })

    assert filtered == %{
             "content" => "[FILTERED]",
             "token" => "[FILTERED]",
             "role" => "[FILTERED]"
           }
  end
end
