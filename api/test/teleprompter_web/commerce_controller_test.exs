defmodule TeleprompterWeb.CommerceControllerTest do
  use TeleprompterWeb.ConnCase, async: false
  import Ecto.Query
  alias Teleprompter.{Accounts, Commerce, Repo}
  alias Teleprompter.Commerce.{Intent, Attempt, Event, Grant}
  @moduletag :database

  setup do
    owner = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    prior = Application.get_env(:teleprompter, :payment_providers)
    enabled = Application.get_env(:teleprompter, :payments_enabled)

    on_exit(fn ->
      Application.put_env(:teleprompter, :payment_providers, prior)
      Application.put_env(:teleprompter, :payments_enabled, enabled)
      Ecto.Adapters.SQL.Sandbox.stop_owner(owner)
    end)

    Application.put_env(:teleprompter, :payments_enabled, false)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        environment: "production",
        approved: true,
        currencies: ["USD", "RUB"],
        api_key: "outbound",
        webhook_secret: "inbound",
        offer_id: "offer",
        http_options: [plug: {Req.Test, __MODULE__}]
      ],
      "prodamus" => [approved: true, currencies: ["USD", "RUB"]]
    })

    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    intent = Repo.insert!(%Intent{user_id: user.id})

    attempt =
      Repo.insert!(%Attempt{
        intent_id: intent.id,
        provider: "lava",
        currency: "USD",
        amount_minor: 2900,
        environment: "production",
        status: "pending",
        external_id: Ecto.UUID.generate(),
        checkout_url: "https://app.lava.top/pay/fixture"
      })

    {:ok, user: user, attempt: attempt}
  end

  defp signed(user),
    do:
      build_conn()
      |> init_test_session(account_token: Accounts.issue_token(user.id, "session", 3600))

  test "checkout ignores client prices and a rejected creation can be retried", %{
    user: user,
    attempt: attempt
  } do
    Application.put_env(:teleprompter, :payments_enabled, true)
    attempt |> Ecto.Changeset.change(status: "failed") |> Repo.update!()
    Req.Test.stub(__MODULE__, fn conn -> Plug.Conn.send_resp(conn, 400, "bad offer") end)

    rejected =
      signed(user)
      |> post("/api/account/checkout", %{"provider" => "lava", "currency" => "USD", "amount" => 1})
      |> json_response(200)

    assert rejected["status"] == "failed"
    assert rejected["amount_minor"] == 2900

    Req.Test.stub(__MODULE__, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert Jason.decode!(body)["amount"] == 29

      Req.Test.json(conn, %{
        id: Ecto.UUID.generate(),
        paymentUrl: "https://app.lava.top/pay/fixture"
      })
    end)

    retried =
      signed(user)
      |> post("/api/account/checkout", %{
        "provider" => "lava",
        "currency" => "USD",
        "amount_minor" => 1
      })
      |> json_response(200)

    assert retried["status"] == "pending"
    assert retried["id"] != rejected["id"]
    assert retried["amount_minor"] == 2900
  end

  test "only the configured USD Lava offer is advertised", %{user: user} do
    Application.put_env(:teleprompter, :payments_enabled, true)
    data = signed(user) |> get("/api/account/commerce") |> json_response(200)
    assert data["prices"] == %{"USD" => 2900}

    assert data["providers"] == [
             %{"id" => "lava", "recommended" => true, "currencies" => ["USD"]}
           ]

    assert {:error, :payments_unavailable} = Commerce.checkout(user, "lava", "RUB")
    assert {:error, :payments_unavailable} = Commerce.checkout(user, "prodamus", "USD")
  end

  test "support can close a verified ambiguous failure but cannot downgrade paid access", %{
    user: user,
    attempt: attempt
  } do
    attempt |> Ecto.Changeset.change(status: "ambiguous", external_id: nil) |> Repo.update!()

    assert {:ok, :ok} =
             Commerce.operator_confirm(
               attempt.id,
               "failed",
               "operator:test",
               "verified-no-payable-invoice"
             )

    assert Repo.get!(Attempt, attempt.id).status == "failed"

    assert {:ok, :ok} =
             Commerce.operator_confirm(
               attempt.id,
               "paid",
               "operator:test",
               "verified-paid-invoice"
             )

    assert {:ok, :ok} =
             Commerce.operator_confirm(attempt.id, "failed", "operator:test", "stale-failure")

    assert Repo.get!(Attempt, attempt.id).status == "paid"
    assert Commerce.pro?(user)
  end

  test "owned invoice check recovers a missing webhook even with new sales off", %{
    user: user,
    attempt: attempt
  } do
    Req.Test.stub(__MODULE__, fn conn ->
      assert conn.request_path == "/api/v1/invoices/" <> attempt.external_id
      assert get_req_header(conn, "x-api-key") == ["outbound"]

      Req.Test.json(conn, %{
        id: attempt.external_id,
        status: "COMPLETED",
        receipt: %{amount: 29, currency: "USD"}
      })
    end)

    data =
      signed(user)
      |> post("/api/account/purchases/#{attempt.id}/check", %{})
      |> json_response(200)

    assert data["status"] == "paid"
    assert Commerce.pro?(user)
    assert Repo.aggregate(from(g in Grant, where: g.attempt_id == ^attempt.id), :count) == 1
    assert {:ok, %{status: "paid"}} = Commerce.check_purchase(user, attempt.id)
    assert Repo.aggregate(from(g in Grant, where: g.attempt_id == ^attempt.id), :count) == 1
  end

  test "invoice checks require authentication, ownership, and CSRF", %{
    user: user,
    attempt: attempt
  } do
    Req.Test.stub(__MODULE__, fn _ -> flunk("Foreign or forged requests must not call Lava") end)
    other = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})

    assert build_conn()
           |> post("/api/account/purchases/#{attempt.id}/check", %{})
           |> json_response(401)

    assert signed(other)
           |> post("/api/account/purchases/#{attempt.id}/check", %{})
           |> json_response(404)

    assert signed(user) |> post("/api/account/purchases/invalid/check", %{}) |> json_response(404)

    assert_error_sent 403, fn ->
      signed(user)
      |> put_private(:plug_skip_csrf_protection, false)
      |> post("/api/account/purchases/#{attempt.id}/check", %{})
    end

    refute Commerce.pro?(user)
  end

  test "amount mismatches are reviewed and failed invoices never grant Pro", %{
    user: user,
    attempt: attempt
  } do
    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{
        id: attempt.external_id,
        status: "COMPLETED",
        receipt: %{amount: 1, currency: "USD"}
      })
    end)

    assert {:ok, %{status: "pending"}} = Commerce.check_purchase(user, attempt.id)
    assert Repo.one!(Event).review_reason == "amount_or_currency_mismatch"
    refute Commerce.pro?(user)

    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{
        id: attempt.external_id,
        status: "FAILED",
        receipt: %{amount: 29, currency: "USD"}
      })
    end)

    assert {:ok, %{status: "failed"}} = Commerce.check_purchase(user, attempt.id)
    refute Commerce.pro?(user)
  end

  test "authenticated webhooks are durable and idempotent; unknown event types are acknowledged",
       %{user: user, attempt: attempt} do
    body = %{
      "eventType" => "payment.success",
      "contractId" => attempt.external_id,
      "amount" => 29,
      "currency" => "USD",
      "buyer" => %{"email" => "private@example.com"}
    }

    assert build_conn() |> post("/api/payments/lava", body) |> response(401)

    for _ <- 1..2 do
      assert build_conn()
             |> put_req_header("x-api-key", "inbound")
             |> post("/api/payments/lava", body)
             |> response(200)
    end

    assert Repo.aggregate(Event, :count) == 1
    refute Map.has_key?(Repo.one!(Event).payload, "buyer")
    Commerce.process_events()
    assert Commerce.pro?(user)

    for unknown <- [%{"eventType" => "future.event"}, %{"event_type" => "future.event"}] do
      assert build_conn()
             |> put_req_header("x-api-key", "inbound")
             |> post("/api/payments/lava", unknown)
             |> response(200)
    end

    assert Repo.aggregate(Event, :count) == 1
  end
end
