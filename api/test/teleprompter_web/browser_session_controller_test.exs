defmodule TeleprompterWeb.BrowserSessionControllerTest do
  use TeleprompterWeb.ConnCase, async: false
  import Ecto.Query
  alias Teleprompter.{Accounts, Repo}
  alias Teleprompter.Accounts.{BrowserSessions, Token, User}
  @moduletag :database

  setup do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
    user = Repo.insert!(%User{email: Ecto.UUID.generate() <> "@example.com"})
    {:ok, user: user}
  end

  defp browser(raw, extra \\ []) do
    build_conn()
    |> init_test_session([account_token: raw] ++ extra)
    |> put_private(:plug_skip_csrf_protection, false)
    |> put_req_header("user-agent", "Mozilla/5.0 (iPhone) Version/18.0 Mobile/1 Safari/605.1")
    |> get("/api/account")
  end

  defp remove(conn, path, user_id) do
    csrf = json_response(conn, 200)["csrf_token"]

    conn
    |> recycle()
    |> put_private(:plug_skip_csrf_protection, false)
    |> put_req_header("x-csrf-token", csrf)
    |> put_req_header("x-izzy-account-id", user_id)
    |> delete(path)
  end

  test "new sessions ignore age and compatibility expiry but remain revocable", %{user: user} do
    raw = Accounts.issue_session(user.id, "Mozilla/5.0 (iPhone) Safari/605.1")
    past = DateTime.add(DateTime.utc_now(), -800 * 86400, :second)

    Repo.update_all(from(t in Token, where: t.hash == ^Accounts.hash(raw)),
      set: [expires_at: past, inserted_at: past, last_seen_at: past]
    )

    assert Accounts.user_for_session(raw).id == user.id
    assert {:ok, _} = Teleprompter.Maintenance.prune()
    assert Accounts.user_for_session(raw).id == user.id
    assert json_response(browser(raw), 200)["user"]["id"] == user.id
    Accounts.revoke(raw)
    assert is_nil(Accounts.user_for_session(raw))
  end

  test "legacy credentials upgrade without rotating their token, cookie or CSRF identity", %{
    user: user
  } do
    raw = Accounts.issue_token(user.id, "session", 3600)
    conn = browser(raw)
    assert json_response(conn, 200)["user"]["id"] == user.id
    same_credential = get_session(conn, :account_token) == raw
    assert same_credential
    token = Repo.get!(Token, Accounts.hash(raw))
    assert token.persistent
    assert token.session_id
    assert token.device_label == "Safari · iPhone"
    assert token.last_seen_at
    cookie = conn.resp_cookies["_teleprompter_key"]
    assert cookie.max_age == 400 * 86400
    assert cookie.http_only
    assert cookie.same_site == "Lax"
    next = conn |> recycle() |> get("/api/account")
    assert get_session(next, :_csrf_token) == get_session(conn, :_csrf_token)
    assert json_response(next, 200)["user"]["id"] == user.id
    refute next.resp_cookies["_teleprompter_key"]
    assert Repo.get!(Token, Accounts.hash(raw)).session_id == token.session_id
    assert Repo.get!(Token, Accounts.hash(raw)).last_seen_at == token.last_seen_at
  end

  test "daily renewal preserves the credential and CSRF; malformed/future renewal stamps are safe",
       %{user: user} do
    raw = Accounts.issue_session(user.id)

    for stamp <- [System.system_time(:second) - 86401, System.system_time(:second) + 1000, "old"] do
      conn = browser(raw, account_cookie_refreshed_at: stamp)
      assert json_response(conn, 200)["user"]["id"] == user.id
      same_credential = get_session(conn, :account_token) == raw
      assert same_credential
      assert conn.resp_cookies["_teleprompter_key"].max_age == 400 * 86400
    end
  end

  test "expired legacy credentials and expired email links never revive", %{user: user} do
    for kind <- ["session", "login"] do
      raw = Accounts.issue_token(user.id, kind, -1)
      assert json_response(browser(raw), 200)["user"] == nil
      assert is_nil(Accounts.user_for_session(raw))
      rejected = Accounts.consume_login(raw) == {:error, :invalid_token}
      assert rejected
      refute Repo.get!(Token, Accounts.hash(raw)).persistent
    end
  end

  test "a consumed short-lived link creates a persistent session and cannot be replayed", %{
    user: user
  } do
    link = Accounts.issue_token(user.id, "login", 900)
    assert {:ok, {_, raw}} = Accounts.consume_login(link, "Firefox/100 (Windows)")
    token = Repo.get!(Token, Accounts.hash(raw))
    assert token.persistent && token.session_id
    assert token.device_label == "Firefox · Windows"
    rejected = Accounts.consume_login(link) == {:error, :invalid_token}
    assert rejected
  end

  test "lists only own browsers with safe IDs, and revokes other browsers without touching this one",
       %{user: user} do
    current = Accounts.issue_session(user.id, "Safari/100 (iPhone)")
    other = Accounts.issue_session(user.id, "Firefox/100 (Windows)")
    stranger = Repo.insert!(%User{email: Ecto.UUID.generate() <> "@example.com"})
    stranger_raw = Accounts.issue_session(stranger.id)
    stranger_id = Repo.get!(Token, Accounts.hash(stranger_raw)).session_id
    conn = browser(current)
    listed = conn |> recycle() |> get("/api/account/sessions") |> json_response(200)
    assert listed["user_id"] == user.id
    assert length(listed["sessions"]) == 2
    assert hd(listed["sessions"])["current"]

    for row <- listed["sessions"] do
      assert Enum.sort(Map.keys(row)) == ~w(current device id last_seen_at signed_in_at)
      assert {:ok, _} = Ecto.UUID.cast(row["id"])
    end

    assert json_response(remove(conn, "/api/account/sessions/#{stranger_id}", user.id), 404)[
             "reason"
           ] == "not_found"

    assert json_response(remove(conn, "/api/account/sessions/invalid", user.id), 404)["reason"] ==
             "not_found"

    assert json_response(remove(conn, "/api/account/sessions/others", stranger.id), 409)["reason"] ==
             "account_changed"

    assert Accounts.user_for_session(other)

    assert json_response(remove(conn, "/api/account/sessions/others", user.id), 200)["revoked"] ==
             1

    assert Accounts.user_for_session(current)
    assert is_nil(Accounts.user_for_session(other))
    assert Accounts.user_for_session(stranger_raw)
  end

  test "device revocation invalidates a channel ticket immediately and sends a disconnect", %{
    user: user
  } do
    current = Accounts.issue_session(user.id)
    other = Accounts.issue_session(user.id)
    token = Repo.get!(Token, Accounts.hash(other))
    ticket = Phoenix.Token.sign(TeleprompterWeb.Endpoint, "account_channel", other)
    Phoenix.PubSub.subscribe(Teleprompter.PubSub, "account_session:" <> Base.encode16(token.hash))
    conn = browser(current)

    assert json_response(remove(conn, "/api/account/sessions/#{token.session_id}", user.id), 200)[
             "signed_out"
           ] == false

    assert_receive :revoked

    rejected =
      TeleprompterWeb.AccountSocket.connect(%{"ticket" => ticket}, %Phoenix.Socket{}, %{}) ==
        :error

    assert rejected

    assert Accounts.user_for_session(current)

    assert json_response(remove(conn, "/api/account/sessions/#{token.session_id}", user.id), 404)[
             "reason"
           ] == "not_found"
  end

  test "current-device revocation drops its cookie; forged and unauthenticated deletes fail", %{
    user: user
  } do
    raw = Accounts.issue_session(user.id)
    token = Repo.get!(Token, Accounts.hash(raw))
    conn = browser(raw)

    assert_error_sent 403, fn ->
      conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> delete("/api/account/sessions/others")
    end

    assert Accounts.user_for_session(raw)
    revoked = remove(conn, "/api/account/sessions/#{token.session_id}", user.id)
    assert json_response(revoked, 200)["signed_out"]
    assert revoked.resp_cookies["_teleprompter_key"].max_age == 0
    assert is_nil(Accounts.user_for_session(raw))

    assert json_response(build_conn() |> get("/api/account/sessions"), 401)["reason"] ==
             "login_required"
  end

  test "explicit re-login replaces this browser credential while other browsers stay signed in",
       %{user: user} do
    previous = Accounts.issue_session(user.id)
    other = Accounts.issue_session(user.id)
    conn = browser(previous)
    link = Accounts.issue_token(user.id, "login", 900)
    csrf = json_response(conn, 200)["csrf_token"]

    next =
      conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> put_req_header("x-csrf-token", csrf)
      |> post("/api/account/login", %{token: link})

    assert json_response(next, 200)["signed_in"]
    refute Accounts.user_for_session(previous)
    assert Accounts.user_for_session(other)
    current = get_session(next, :account_token)
    assert Accounts.user_for_session(current).id == user.id
    assert length(BrowserSessions.list(user, current)) == 2
  end

  test "temporarily disabled accounts do not discard an existing browser credential", %{
    user: user
  } do
    raw = Accounts.issue_session(user.id)
    previous = Application.fetch_env!(:teleprompter, :accounts_enabled)
    on_exit(fn -> Application.put_env(:teleprompter, :accounts_enabled, previous) end)
    Application.put_env(:teleprompter, :accounts_enabled, false)
    conn = browser(raw)
    assert json_response(conn, 200)["enabled"] == false
    preserved = get_session(conn, :account_token) == raw
    assert preserved
    Application.put_env(:teleprompter, :accounts_enabled, previous)
    assert json_response(conn |> recycle() |> get("/api/account"), 200)["user"]["id"] == user.id
  end

  test "coarse labels never retain raw user-agent data" do
    assert BrowserSessions.device_label("Private unusual agent /path/to/private/<script>") ==
             "Browser"

    assert BrowserSessions.device_label("Mozilla Macintosh Mobile/ Safari/1") == "Safari · iPad"
    assert BrowserSessions.device_label("Mozilla Windows Chrome/100 Edg/100") == "Edge · Windows"
  end
end
