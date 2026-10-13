defmodule TeleprompterWeb.SecurityEdgesTest do
  use TeleprompterWeb.ConnCase, async: false
  import Ecto.Query
  alias Teleprompter.{Accounts, Commerce, Library, Repo, Sessions}
  alias Teleprompter.Commerce.{Intent, Attempt, Event, Grant}
  @moduletag :database

  setup do
    owner = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(owner) end)
    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    other = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    {:ok, user: user, other: other}
  end

  defp signed(user) do
    build_conn()
    |> init_test_session(account_token: Accounts.issue_token(user.id, "session", 3600))
  end

  defp request(conn, method, path, params), do: dispatch(conn, @endpoint, method, path, params)

  test "another account cannot read, write, duplicate, restore, delete or pair a script", %{
    user: user,
    other: other
  } do
    {:ok, script} = Library.create(user, %{"title" => "Private", "content" => "Owner-only words"})

    writes = [
      {:patch, "/api/account/scripts/#{script.id}",
       %{
         "title" => "Attack",
         "content" => "Intruder",
         "expected_revision" => 1,
         "mutation_id" => Ecto.UUID.generate()
       }},
      {:delete, "/api/account/scripts/#{script.id}", %{}},
      {:post, "/api/account/scripts/#{script.id}/duplicate", %{}},
      {:post, "/api/account/scripts/#{script.id}/restore", %{}},
      {:post, "/api/account/scripts/#{script.id}/session", %{}}
    ]

    assert signed(other) |> get("/api/account/scripts/#{script.id}") |> json_response(404)

    for {method, path, params} <- writes do
      conn = request(signed(other), method, path, params)
      assert json_response(conn, 404)["reason"] == "not_found"
      refute conn.resp_body =~ "Owner-only words"
    end

    assert Library.get(user, script.id).revision == 1
  end

  test "old tab account binding cannot adopt its private draft into a new cookie account", %{
    user: user,
    other: other
  } do
    conn = signed(other) |> put_req_header("x-izzy-account-id", user.id)

    assert conn
           |> post("/api/account/scripts", %{
             "title" => "Old account",
             "content" => "Private draft"
           })
           |> json_response(409) == %{"reason" => "account_changed"}

    assert Library.list(other) == []
  end

  test "authenticated checkout is bounded independently of ordinary script autosave", %{
    user: user
  } do
    for _ <- 1..6 do
      assert signed(user)
             |> post("/api/account/checkout", %{"provider" => "lava", "currency" => "USD"})
             |> json_response(422) == %{"reason" => "payments_unavailable"}
    end

    conn =
      signed(user) |> post("/api/account/checkout", %{"provider" => "lava", "currency" => "USD"})

    assert json_response(conn, 429) == %{"reason" => "rate_limited"}
    assert [retry] = get_resp_header(conn, "retry-after")
    assert String.to_integer(retry) in 1..60
    assert {:ok, _} = Library.create(user, %{"title" => "Still works", "content" => "Text"})
  end

  test "all cookie-authenticated mutation families reject missing CSRF", %{user: user} do
    for {method, path} <- [
          {:post, "/api/account/login-link"},
          {:post, "/api/account/login"},
          {:post, "/api/account/logout"},
          {:post, "/api/account/channel-ticket"},
          {:post, "/api/account/scripts"},
          {:patch, "/api/account/scripts/#{Ecto.UUID.generate()}"},
          {:delete, "/api/account/scripts/#{Ecto.UUID.generate()}"},
          {:post, "/api/account/presets"},
          {:post, "/api/account/checkout"}
        ] do
      conn = signed(user) |> put_private(:plug_skip_csrf_protection, false)
      assert_error_sent 403, fn -> request(conn, method, path, %{}) end
    end
  end

  test "list-shaped queries and missing preset payload never crash", %{user: user} do
    assert signed(user) |> get("/api/account/scripts?q[]=x&page[]=1") |> json_response(200) == %{
             "scripts" => []
           }

    assert signed(user)
           |> post("/api/account/scripts/#{Ecto.UUID.generate()}/apply-preset", %{})
           |> json_response(422) == %{"reason" => "invalid_preset"}
  end

  test "library cards return bounded excerpts, never whole private documents", %{
    user: user,
    other: other
  } do
    content = String.duplicate("Long private text. ", 10_000)
    {:ok, script} = Library.create(user, %{"title" => "Large", "content" => content})
    conn = signed(user) |> get("/api/account/scripts")
    [summary] = json_response(conn, 200)["scripts"]
    assert summary["id"] == script.id
    assert summary["excerpt"] == String.slice(content, 0, 110)
    refute Map.has_key?(summary, "document")
    assert byte_size(conn.resp_body) < 1000

    assert signed(other) |> get("/api/account/scripts") |> json_response(200) == %{
             "scripts" => []
           }

    assert signed(user)
           |> get("/api/account/scripts/#{script.id}")
           |> json_response(200)
           |> get_in(["document", "blocks", Access.at(0), "text"]) == String.trim(content)
  end

  test "local demo grants never unlock production access", %{user: user} do
    previous = Application.get_env(:teleprompter, :preview_entitlements)

    on_exit(fn ->
      if is_nil(previous),
        do: Application.delete_env(:teleprompter, :preview_entitlements),
        else: Application.put_env(:teleprompter, :preview_entitlements, previous)
    end)

    intent = Repo.insert!(%Intent{user_id: user.id})

    attempt =
      Repo.insert!(%Attempt{
        intent_id: intent.id,
        provider: "local_preview",
        environment: "preview",
        currency: "USD",
        amount_minor: 2900,
        status: "paid"
      })

    grant = Repo.insert!(%Grant{user_id: user.id, attempt_id: attempt.id})
    Application.delete_env(:teleprompter, :preview_entitlements)
    refute Commerce.pro?(user)
    Application.put_env(:teleprompter, :preview_entitlements, true)
    assert Commerce.pro?(user)
    {:ok, saved} = Library.create(user, %{"title" => "Preserved", "content" => "My text"})
    Repo.update!(Ecto.Changeset.change(grant, status: "revoked"))
    refute Commerce.pro?(user)
    assert Library.get(user, saved.id)
  end

  test "PostgreSQL-incompatible NUL input is rejected before persistence", %{user: user} do
    assert {:error, _} = Library.create(user, %{"title" => "Bad" <> <<0>>, "content" => "Text"})
    assert {:error, _} = Library.create(user, %{"title" => "Title", "content" => "Bad" <> <<0>>})
    assert {:error, :invalid_email} = Accounts.request_login("bad" <> <<0>> <> "@example.com")
  end

  test "expired, future and account-switched Google callbacks fail before provider exchange", %{
    user: user,
    other: other
  } do
    for {at, owner} <- [
          {System.system_time(:second) - 600, user.id},
          {System.system_time(:second) + 60, user.id},
          {System.system_time(:second), other.id}
        ] do
      conn =
        signed(user)
        |> put_session(:google_oauth, %{params: %{}, at: at, user_id: owner})
        |> get("/auth/google/callback?code=invalid&state=invalid")

      assert redirected_to(conn) == "/account?error=google_login_failed"
      assert is_nil(get_session(conn, :google_oauth))
    end
  end

  test "malformed scripts and forged ownership or Pro flags cannot bypass validation", %{
    user: user,
    other: other
  } do
    for bad <- [nil, 1, [], %{}, %{"blocks" => [nil]}, %{"blocks" => [%{"text" => 1}]}] do
      assert {:error, _} = Library.create(user, %{"title" => "Title", "document" => bad})
    end

    assert {:ok, script} =
             Library.create(user, %{
               "title" => "Title",
               "content" => "Text",
               "user_id" => other.id,
               "pro" => true
             })

    assert is_nil(Library.get(other, script.id))
    refute Commerce.pro?(user)

    assert {:error, _} =
             Library.create(user, %{
               "title" => "Title",
               "content" => String.duplicate("x", 2 * 1024 * 1024 + 1)
             })

    assert {:error, _} =
             Library.create(user, %{"title" => "Title", "content" => Enum.join(1..5001, "\n\n")})
  end

  test "canonical saved documents discard arbitrary nested metadata", %{user: user} do
    document = %{
      "schemaVersion" => 1,
      "id" => "doc",
      "secret" => "not persisted",
      "blocks" => [
        %{
          "id" => "p1",
          "type" => "paragraph",
          "text" => "Literal <script>alert(1)</script>",
          "extra" => %{"html" => "not persisted"}
        }
      ]
    }

    assert {:ok, saved} = Library.create(user, %{"title" => "Title", "document" => document})
    refute Map.has_key?(saved.document, "secret")
    refute Map.has_key?(hd(saved.document["blocks"]), "extra")

    assert {:error, :invalid_document} =
             Library.create(user, %{
               "title" => "Title",
               "document" => %{document | "blocks" => document["blocks"] ++ document["blocks"]}
             })
  end

  test "Google verified identity remains exclusive and malformed claims are rejected", %{
    user: user,
    other: other
  } do
    identity = %{"sub" => "unique-subject", "email" => user.email, "email_verified" => true}
    assert {:ok, ^user} = Accounts.google_identity(identity, user)
    assert {:error, :identity_in_use} = Accounts.google_identity(identity, other)

    for claim <- [nil, 1, [], %{}, ""] do
      assert {:error, :unverified_identity} =
               Accounts.google_identity(%{identity | "sub" => claim}, nil)
    end
  end

  test "expired browser sessions cannot open the library or obtain socket tickets", %{user: user} do
    raw = Accounts.issue_token(user.id, "session", -1)

    for {method, path} <- [{:get, "/api/account/scripts"}, {:post, "/api/account/channel-ticket"}] do
      conn = build_conn() |> init_test_session(account_token: raw)

      assert request(conn, method, path, %{}) |> json_response(401) == %{
               "reason" => "login_required"
             }
    end
  end

  test "foreign account cannot stop an active saved session", %{user: user, other: other} do
    {:ok, script} = Library.create(user, %{"title" => "Live", "content" => "Read me"})
    {:ok, live} = Sessions.create_saved(user, script.id)
    on_exit(fn -> Sessions.end_saved(live.session_id, user) end)

    assert signed(other)
           |> delete("/api/account/scripts/#{script.id}/session")
           |> json_response(422) == %{"reason" => "forbidden"}

    assert {:ok, _} = Sessions.snapshot(live.session_id)
  end

  test "authenticated malformed provider notifications cannot mutate purchases", %{user: user} do
    prior = Application.get_env(:teleprompter, :payment_providers)
    on_exit(fn -> Application.put_env(:teleprompter, :payment_providers, prior) end)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [webhook_secret: "inbound", api_key: "outbound"]
    })

    for body <- [
          %{"event_type" => "refund.success", "event_id" => "bad", "data" => nil},
          %{"eventType" => %{}},
          %{"event_type" => "refund.success", "event_id" => "bad", "data" => []}
        ] do
      assert build_conn()
             |> put_req_header("x-api-key", "inbound")
             |> post("/api/payments/lava", body)
             |> response(400)
    end

    refute Repo.exists?(from(e in Event, where: e.external_key == "bad"))
    refute Commerce.pro?(user)
    assert build_conn() |> post("/api/payments/prodamus", %{}) |> response(401)
  end

  test "timeout after a confirmed payment cannot reset the attempt or reopen checkout", %{
    user: user
  } do
    prior = Application.get_env(:teleprompter, :payment_providers)
    enabled = Application.get_env(:teleprompter, :payments_enabled)

    on_exit(fn ->
      Application.put_env(:teleprompter, :payment_providers, prior)
      Application.put_env(:teleprompter, :payments_enabled, enabled)
    end)

    Application.put_env(:teleprompter, :payments_enabled, true)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        approved: true,
        currencies: ["USD"],
        environment: "production",
        api_key: "outbound",
        webhook_secret: "inbound",
        offer_id: "offer",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    Req.Test.stub(__MODULE__, fn conn ->
      intent = Repo.get_by!(Teleprompter.Commerce.Intent, user_id: user.id)
      id = Repo.get_by!(Attempt, intent_id: intent.id).id
      assert {:ok, :ok} = Commerce.operator_confirm(id, "paid", "test", "verified-before-timeout")
      Plug.Conn.send_resp(conn, 504, "timeout after notification")
    end)

    assert {:ok, %{status: "paid", id: id}} = Commerce.checkout(user, "lava", "USD")
    assert Commerce.pro?(user)
    assert Repo.get!(Attempt, id).status == "paid"
    assert {:error, :already_pro} = Commerce.checkout(user, "lava", "USD")
  end

  test "parameter logs and schema inspection omit private text, identities and unknown provider fields",
       %{user: user} do
    values = %{
      "customer_phone" => "private-phone",
      "q" => "private-search",
      "nested" => %{"unexpected" => "private-data"}
    }

    filtered = Phoenix.Logger.filter_values(values) |> inspect()
    refute filtered =~ "private-phone"
    refute filtered =~ "private-search"
    refute filtered =~ "private-data"
    refute inspect(user) =~ user.email

    refute inspect(%Library.Script{
             title: "unpublished-title",
             document: %{"text" => "unpublished-text"}
           }) =~ "unpublished"
  end
end
