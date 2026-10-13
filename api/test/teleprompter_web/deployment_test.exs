defmodule TeleprompterWeb.DeploymentTest do
  use TeleprompterWeb.ConnCase, async: false
  alias TeleprompterWeb.{AppAssets, CORS}

  setup do
    if Teleprompter.Accounts.enabled?() do
      owner = Ecto.Adapters.SQL.Sandbox.start_owner!(Teleprompter.Repo, shared: true)
      on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(owner) end)
    end

    before_origins = Application.fetch_env!(:teleprompter, :http_allowed_origins)
    before_discovery = Application.fetch_env!(:teleprompter, :lan_discovery)

    on_exit(fn ->
      Application.put_env(:teleprompter, :http_allowed_origins, before_origins)
      Application.put_env(:teleprompter, :lan_discovery, before_discovery)
    end)

    :ok
  end

  test "production API permits the configured origin but rejects foreign and null origins" do
    Application.put_env(:teleprompter, :http_allowed_origins, ["https://izzy.example"])

    for origin <- ["https://foreign.example", "null", "http://izzy.example"] do
      conn =
        build_conn()
        |> put_req_header("origin", origin)
        |> post("/api/sessions", %{protocol_version: 2, content: "Do not create", speed: 1})

      assert conn.status == 403
      assert get_resp_header(conn, "access-control-allow-origin") == []
    end

    conn = build_conn() |> put_req_header("origin", "https://izzy.example") |> get("/health/live")
    assert json_response(conn, 200) == %{"status" => "ok"}
    assert get_resp_header(conn, "access-control-allow-origin") == ["https://izzy.example"]
    assert get_resp_header(conn, "vary") == ["Origin"]
    assert build_conn() |> get("/health/live") |> json_response(200) == %{"status" => "ok"}
  end

  test "preflight is origin-checked and trusted development keeps split-port compatibility" do
    Application.put_env(:teleprompter, :http_allowed_origins, ["https://izzy.example"])

    assert build_conn()
           |> put_req_header("origin", "https://izzy.example")
           |> options("/api/sessions")
           |> response(204) == ""

    assert build_conn()
           |> put_req_header("origin", "https://foreign.example")
           |> options("/api/sessions")
           |> response(403) == "Forbidden origin"

    Application.put_env(:teleprompter, :http_allowed_origins, :any)
    conn = build_conn() |> put_req_header("origin", "http://192.168.1.13:5173") |> CORS.call([])
    assert get_resp_header(conn, "access-control-allow-origin") == ["*"]
    assert get_resp_header(conn, "access-control-expose-headers") == ["retry-after"]
  end

  test "production network endpoint never reveals the host's LAN interfaces", %{conn: conn} do
    Application.put_env(:teleprompter, :lan_discovery, false)
    conn = get(conn, "/api/network")
    assert json_response(conn, 200) == %{"hosts" => []}
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "health endpoints are non-cacheable and readiness includes the client bundle", %{
    conn: conn
  } do
    live = get(conn, "/health/live")
    assert json_response(live, 200) == %{"status" => "ok"}
    assert get_resp_header(live, "cache-control") == ["no-store"]
    ready = get(build_conn(), "/health/ready")
    status = if AppAssets.available?(), do: 200, else: 503

    assert json_response(ready, status)["status"] ==
             if(status == 200, do: "ready", else: "unavailable")

    assert get_resp_header(ready, "cache-control") == ["no-store"]
    refute AppAssets.available?(System.tmp_dir!())

    refute AppAssets.available?(
             Path.join(System.tmp_dir!(), "missing-izzy-#{System.unique_integer([:positive])}")
           )
  end

  test "invalid session paths, unknown APIs, and missing assets never fall back to HTML" do
    assert build_conn() |> get("/remote/not-a-session") |> json_response(404) == %{
             "reason" => "not_found"
           }

    for path <- ["/api/unknown", "/assets/missing.js", "/unknown", "/remote/ABC234/extra"] do
      conn = get(build_conn(), path)
      assert conn.status == 404
      refute Enum.any?(get_resp_header(conn, "content-type"), &String.contains?(&1, "text/html"))
    end
  end
end
