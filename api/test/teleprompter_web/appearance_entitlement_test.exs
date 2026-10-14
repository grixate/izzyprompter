defmodule TeleprompterWeb.AppearanceEntitlementTest do
  use TeleprompterWeb.ConnCase, async: false
  alias Teleprompter.{Accounts, Commerce, Repo, Sessions}
  alias Teleprompter.Commerce.{Intent, Attempt, Grant}
  @moduletag :database

  setup do
    owner = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(owner) end)
    :ok
  end

  test "a host grant reaches its guest remote and revocation takes effect without changing playback" do
    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    intent = Repo.insert!(%Intent{user_id: user.id})

    attempt =
      Repo.insert!(%Attempt{
        intent_id: intent.id,
        provider: "lava",
        currency: "USD",
        amount_minor: 2900,
        environment: "production",
        status: "paid"
      })

    grant = Repo.insert!(%Grant{user_id: user.id, attempt_id: attempt.id})
    {:ok, session} = Sessions.create_owned("Synthetic script. No customer content.", 1, user)
    path = "/api/sessions/#{session.session_id}/appearance"

    request = fn ->
      build_conn()
      |> put_req_header("authorization", "Bearer " <> session.tokens["remote"])
      |> get(path)
      |> json_response(200)
    end

    assert request.() == %{"pro" => true}
    assert {:ok, before} = Sessions.snapshot(session.session_id)
    grant |> Ecto.Changeset.change(status: "revoked") |> Repo.update!()
    refute Commerce.pro?(user)
    assert request.() == %{"pro" => false}
    assert {:ok, after_snapshot} = Sessions.snapshot(session.session_id)
    assert after_snapshot.transport == before.transport
    assert after_snapshot.script == before.script
  end

  test "session creation attaches only the signed-in owner; client identity is ignored" do
    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    token = Accounts.issue_token(user.id, "session", 3600)

    data =
      build_conn()
      |> init_test_session(account_token: token)
      |> post("/api/sessions", %{
        protocol_version: 2,
        content: "Synthetic owner take",
        speed: 1,
        user_id: "forged"
      })
      |> json_response(201)

    assert {:ok, owner} = Sessions.appearance_owner(data["session_id"], data["tokens"]["remote"])
    assert owner.id == user.id
  end

  test "Google sign-in stores only a safe product return destination" do
    old = Application.get_env(:teleprompter, :google, [])

    Application.put_env(:teleprompter, :google,
      client_id: "synthetic-client",
      client_secret: "synthetic-secret"
    )

    on_exit(fn -> Application.put_env(:teleprompter, :google, old) end)

    for {input, expected} <- [
          {"/skins?skin=ivory", "/skins?skin=ivory"},
          {"https://foreign.example", nil}
        ] do
      conn = build_conn() |> get("/auth/google?" <> URI.encode_query(%{"returnTo" => input}))
      assert conn.status == 302
      assert get_session(conn, :google_oauth).return_to == expected
    end
  end
end
