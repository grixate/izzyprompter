defmodule TeleprompterWeb.AccountControllerTest do
  use TeleprompterWeb.ConnCase, async: false
  alias Teleprompter.{Repo, Accounts}
  @moduletag :database
  setup do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    {:ok, user: user}
  end

  test "browser mutations require CSRF even when signed in", %{conn: conn, user: user} do
    conn =
      conn
      |> init_test_session(account_token: Accounts.issue_token(user.id, "session", 3600))
      |> put_private(:plug_skip_csrf_protection, false)

    assert_error_sent 403, fn ->
      post(conn, "/api/account/scripts", %{"title" => "Forged", "content" => "No"})
    end
  end

  test "account status, authenticated save and logout", %{conn: conn, user: user} do
    raw = Accounts.issue_token(user.id, "session", 3600)

    conn =
      conn
      |> init_test_session(account_token: raw)
      |> put_private(:plug_skip_csrf_protection, false)
      |> get("/api/account")

    payload = json_response(conn, 200)
    assert payload["user"]["id"] == user.id
    token = payload["csrf_token"]

    conn =
      conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> put_req_header("x-csrf-token", token)
      |> post("/api/account/scripts", %{
        "title" => "Saved before pairing",
        "content" => "My words"
      })

    assert json_response(conn, 200)["revision"] == 1

    conn =
      conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> put_req_header("x-csrf-token", token)
      |> post("/api/account/logout", %{})

    assert json_response(conn, 200)["signed_out"]
    assert is_nil(Accounts.user_for_session(raw))
  end

  test "unauthenticated reads cannot access the library", %{conn: conn} do
    assert conn |> get("/api/account/scripts") |> json_response(401) == %{
             "reason" => "login_required"
           }
  end
end
