defmodule Teleprompter.PaymentProvidersTest do
  use ExUnit.Case, async: false
  alias Teleprompter.Commerce.{Prodamus, Lava, Provider}

  setup do
    prior = Application.get_env(:teleprompter, :payment_providers)
    origin = Application.get_env(:teleprompter, :account_origin)

    on_exit(fn ->
      Application.put_env(:teleprompter, :payment_providers, prior)
      Application.put_env(:teleprompter, :account_origin, origin)
    end)

    :ok
  end

  test "Prodamus canonicalizes nested form arrays, Unicode, slash and scalar types" do
    data = %{
      "z" => true,
      "a" => "кадр/one",
      "products" => %{"0" => %{"quantity" => 1, "price" => 29.0}}
    }

    expected = ~s({"a":"кадр\\/one","products":[{"price":"29","quantity":"1"}],"z":"1"})
    assert Prodamus.canonical(data) == expected
    signature = :crypto.mac(:hmac, :sha256, "secret", expected) |> Base.encode16(case: :lower)
    assert Prodamus.sign(data, "secret") == signature
    Application.put_env(:teleprompter, :payment_providers, %{"prodamus" => [secret: "secret"]})
    assert Prodamus.authenticate(data, %{"sign" => String.upcase(signature)})
    refute Prodamus.authenticate(Map.put(data, "z", false), %{"sign" => signature})
    refute Prodamus.authenticate(data, %{"sign" => "bad"})
  end

  test "Prodamus maps the store order number, not the gateway order ID" do
    result =
      Prodamus.normalize(%{
        "order_id" => "gateway-123",
        "order_num" => "store-456",
        "payment_status" => "success",
        "sum" => "2490.00",
        "currency" => "rub"
      })

    assert result.external_id == "store-456"
    assert result.amount_minor == 249_000
    assert result.currency == "RUB"
    assert result.type == "paid"
  end

  test "Prodamus creates signed hosted links without client-supplied prices" do
    test_pid = self()

    Req.Test.stub(__MODULE__, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      data = Plug.Conn.Query.decode(body)
      send(test_pid, {:created, data})

      conn
      |> Plug.Conn.put_resp_content_type("text/plain")
      |> Plug.Conn.send_resp(200, "https://merchant.payform.ru/pay/fixture")
    end)

    Application.put_env(:teleprompter, :payment_providers, %{
      "prodamus" => [
        secret: "secret",
        sys: "izzy",
        url: "https://merchant.payform.ru",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    attempt = %{id: "store-456", amount_minor: 249_000, currency: "RUB", environment: "test"}

    assert {:ok, %{external_id: "store-456"}} =
             Prodamus.checkout(attempt, %{email: "test@example.com"})

    assert_receive {:created, data}
    assert data["products"]["0"]["price"] == "2490"
    assert data["demo_mode"] == "1"
    assert data["payments_limit"] == "1"
    signature = data["signature"]
    assert Prodamus.sign(Map.delete(data, "signature"), "secret") == signature
  end

  test "lava sends the one-time offer and uses a separate inbound secret" do
    test_pid = self()
    Application.put_env(:teleprompter, :account_origin, "https://izzy.example")

    Req.Test.stub(__MODULE__, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      send(test_pid, {:lava_request, conn.request_path, conn.req_headers, Jason.decode!(body)})
      Req.Test.json(conn, %{id: "invoice-id", paymentUrl: "https://app.lava.top/payment/fixture"})
    end)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        api_key: "outbound",
        environment: "production",
        webhook_secret: "inbound",
        offer_id: "offer-id",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    assert {:ok, %{external_id: "invoice-id"}} =
             Lava.checkout(
               %{id: "attempt", amount_minor: 2900, currency: "USD", environment: "production"},
               %{email: "test@example.com"}
             )

    assert_receive {:lava_request, "/api/v3/invoice", headers, body}
    assert {"x-api-key", "outbound"} in headers
    assert body["amount"] == 29
    assert body["offerId"] == "offer-id"
    assert body["currency"] == "USD"
    assert body["periodicity"] == "ONE_TIME"
    assert body["buyerLanguage"] == "EN"
    assert body["successful_return_url"] == "https://izzy.example/account?purchase=attempt"
    assert body["failure_return_url"] == body["successful_return_url"]
    assert body["cancel_return_url"] == body["successful_return_url"]
    refute Map.has_key?(body, "paymentProvider")
    assert Lava.authenticate(%{}, %{"x-api-key" => "inbound"})
    refute Lava.authenticate(%{}, %{"x-api-key" => "outbound"})
  end

  test "lava rejects unrelated checkout URLs and distinguishes rejection from uncertain creation" do
    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        api_key: "outbound",
        webhook_secret: "inbound",
        offer_id: "offer",
        environment: "production",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    attempt = %{id: "attempt", amount_minor: 2900, currency: "USD", environment: "production"}
    user = %{email: "fixture@example.com"}

    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{id: "invoice", paymentUrl: "https://lava.top.evil.example/pay"})
    end)

    assert {:error, :invalid_provider_response} = Lava.checkout(attempt, user)

    Req.Test.stub(__MODULE__, fn conn -> Plug.Conn.send_resp(conn, 400, "invalid offer") end)
    assert {:error, :checkout_rejected} = Lava.checkout(attempt, user)
    Req.Test.stub(__MODULE__, fn conn -> Plug.Conn.send_resp(conn, 504, "timeout") end)
    assert {:error, :ambiguous_checkout} = Lava.checkout(attempt, user)
  end

  test "lava cannot reconcile another invoice or an in-progress payment" do
    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [api_key: "key", http_options: [plug: {Req.Test, __MODULE__}]]
    })

    for {id, status} <- [{"other", "COMPLETED"}, {"invoice", "IN_PROGRESS"}] do
      Req.Test.stub(__MODULE__, fn conn ->
        Req.Test.json(conn, %{id: id, status: status, receipt: %{amount: 29, currency: "USD"}})
      end)

      assert {:error, :status_unconfirmed} = Lava.reconcile(%{external_id: "invoice"})
    end
  end

  test "lava is unavailable without a distinct webhook credential" do
    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        api_key: "key",
        webhook_secret: "key",
        offer_id: "offer",
        environment: "production"
      ]
    })

    refute Lava.configured?()
    refute Lava.authenticate(%{}, %{"x-api-key" => "key"})
  end

  test "lava reconciliation reads receipt amount and currency" do
    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{
        id: "invoice-id",
        status: "COMPLETED",
        receipt: %{amount: 29, currency: "USD"}
      })
    end)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [api_key: "key", http_options: [plug: {Req.Test, __MODULE__}]]
    })

    assert {:ok, %{type: "paid", amount_minor: 2900, currency: "USD"}} =
             Lava.reconcile(%{external_id: "invoice-id"})
  end

  test "provider requests never follow redirects with credentials or signed orders" do
    test_pid = self()

    Req.Test.stub(__MODULE__, fn conn ->
      send(test_pid, {:provider_request, conn.request_path})

      conn
      |> Plug.Conn.put_resp_header("location", "https://foreign.example/redirected")
      |> Plug.Conn.send_resp(302, "")
    end)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        api_key: "outbound",
        environment: "production",
        webhook_secret: "inbound",
        offer_id: "offer",
        http_options: [plug: {Req.Test, __MODULE__}]
      ],
      "prodamus" => [
        secret: "secret",
        sys: "izzy",
        url: "https://merchant.payform.ru",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    attempt = %{
      id: "attempt",
      external_id: "invoice",
      amount_minor: 2900,
      currency: "USD",
      environment: "production"
    }

    assert {:error, :ambiguous_checkout} =
             Lava.checkout(attempt, %{email: "fixture@izzy.example"})

    assert_receive {:provider_request, "/api/v3/invoice"}
    refute_receive {:provider_request, _}, 20
    assert {:error, :status_unconfirmed} = Lava.reconcile(attempt)
    assert_receive {:provider_request, "/api/v1/invoices/invoice"}
    refute_receive {:provider_request, _}, 20

    assert {:error, :ambiguous_checkout} =
             Prodamus.checkout(attempt, %{email: "fixture@izzy.example"})

    assert_receive {:provider_request, initial_path} when initial_path in [nil, "/"]
    refute_receive {:provider_request, _}, 20
  end

  test "lava refund envelopes never invent an invoice identity from email" do
    result =
      Lava.normalize(%{
        "event_type" => "refund.success",
        "event_id" => "refund-id",
        "data" => %{
          "customer_email" => "test@example.com",
          "refund_type" => "full",
          "amount" => 29,
          "currency" => "USD"
        }
      })

    assert result.type == "refunded"
    assert is_nil(result.external_id)
    assert result.key == "refund-id"
  end

  test "amount parsing rejects fractional cents and never uses floating-point equality" do
    assert Provider.minor("2490.00") == 249_000
    assert Provider.minor(29) == 2900
    assert is_nil(Provider.minor("29.001"))
    assert is_nil(Provider.minor("invalid"))

    for invalid <- [
          "1e999999999",
          "NaN",
          "Infinity",
          "-29",
          -1,
          "999999999999999999999999",
          %{},
          []
        ] do
      assert is_nil(Provider.minor(invalid))
    end
  end

  test "lava pins the attempt offer and refuses a mismatched checkout total" do
    parent = self()

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        api_key: "outbound",
        webhook_secret: "inbound",
        offer_id: "changed-offer",
        environment: "production",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    Req.Test.stub(__MODULE__, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      send(parent, {:offer, Jason.decode!(body)["offerId"]})

      Req.Test.json(conn, %{
        id: "invoice",
        paymentUrl: "https://app.lava.top/pay/fixture",
        amountTotal: %{amount: 49, currency: "USD"}
      })
    end)

    assert {:error, :invalid_provider_response} =
             Lava.checkout(
               %{
                 id: "attempt",
                 amount_minor: 2900,
                 currency: "USD",
                 environment: "production",
                 offer_id: "original-offer"
               },
               %{email: "fixture@example.com"}
             )

    assert_receive {:offer, "original-offer"}
  end
end
