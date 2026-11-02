defmodule TeleprompterWeb.CampaignAnalyticsTest do
  use TeleprompterWeb.ConnCase, async: false
  import Ecto.Query
  alias Teleprompter.{Accounts, CampaignAnalytics, Repo, Sessions}
  alias Teleprompter.Commerce.{Intent, Attempt}
  @moduletag :database
  @labels %{
    "source" => "telegram",
    "medium" => "social",
    "campaign" => "launch",
    "content" => "demo_01",
    "entry" => "home"
  }

  setup do
    sandbox = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    previous = Application.get_env(:teleprompter, :campaign_analytics_enabled)
    admins = Application.get_env(:teleprompter, :analytics_admin_emails, [])
    Application.put_env(:teleprompter, :campaign_analytics_enabled, true)
    clock = start_supervised!({Agent, fn -> DateTime.utc_now() end})
    start_supervised!({CampaignAnalytics, clock: fn -> Agent.get(clock, & &1) end})

    on_exit(fn ->
      Application.put_env(:teleprompter, :campaign_analytics_enabled, previous)
      Application.put_env(:teleprompter, :analytics_admin_emails, admins)
      Ecto.Adapters.SQL.Sandbox.stop_owner(sandbox)
    end)

    %{clock: clock}
  end

  defp visit(labels \\ @labels) do
    assert {:ok, token} = CampaignAnalytics.visit(labels, {192, 0, 2, 1}, "Synthetic browser")
    token
  end

  defp report do
    assert :ok = CampaignAnalytics.flush()
    CampaignAnalytics.report()
  end

  defp collector(path, params, headers \\ []) do
    conn =
      build_conn()
      |> put_req_header("origin", Accounts.origin())
      |> put_req_header("user-agent", "Synthetic browser")

    conn = Enum.reduce(headers, conn, fn {k, v}, conn -> put_req_header(conn, k, v) end)
    post(conn, path, params)
  end

  test "reloads count page views, not new visits; each action counts once per visit" do
    token = visit()

    assert {:ok, ^token} =
             CampaignAnalytics.visit(
               Map.put(@labels, "token", token),
               {192, 0, 2, 1},
               "Synthetic browser"
             )

    for _ <- 1..3, do: CampaignAnalytics.record_token(token, "start_clicked")
    totals = report().totals
    assert totals["page_views"] == 2
    assert totals["visits"] == 1
    assert totals["visitors"] == 1
    assert totals["site_visitors"] == 1
    assert totals["start_clicked"] == 1
    assert :ok = CampaignAnalytics.flush()
    assert CampaignAnalytics.report().totals == totals

    assert {:ok, ^token} =
             CampaignAnalytics.visit(
               Map.put(@labels, "token", token),
               {192, 0, 2, 1},
               "Synthetic browser"
             )

    assert report().totals["page_views"] == 3
    assert CampaignAnalytics.report().totals["visits"] == 1
  end

  test "daily site estimates deduplicate a visitor across separate campaigns" do
    visit()
    visit(%{@labels | "content" => "followup"})
    r = report()
    assert r.totals["visits"] == 2
    assert r.totals["site_visitors"] == 1
    assert length(r.campaigns) == 2
    assert Enum.all?(r.campaigns, &(&1.counts["visitors"] == 1))
  end

  test "only bounded labels and daily counts are persisted" do
    token =
      visit(%{
        @labels
        | "source" => "https://private.example/?secret=x",
          "campaign" => String.duplicate("x", 100)
      })

    CampaignAnalytics.record_token(token, "private-script")
    r = report()
    assert hd(r.campaigns).source == "direct"
    assert hd(r.campaigns).campaign == ""

    stored =
      Repo.all(
        from(m in "campaign_metrics", select: map(m, [:day, :source, :campaign, :event, :count]))
      )

    refute inspect(stored) =~ "private.example"
    refute inspect(stored) =~ "private-script"
    refute Jason.encode!(r) =~ token
  end

  test "expired and forged tokens cannot attribute actions", %{clock: clock} do
    token = visit()
    assert CampaignAnalytics.context(token)["source"] == "telegram"
    refute CampaignAnalytics.context(token <> "tampered")
    Agent.update(clock, &DateTime.add(&1, 1801, :second))
    refute CampaignAnalytics.context(token)
    CampaignAnalytics.record_token(token, "start_clicked")
    assert report().totals["start_clicked"] == nil
  end

  test "UTC rotation discards visitor keys and preserves the previous aggregate batch", %{
    clock: clock
  } do
    visit()
    Agent.update(clock, &DateTime.add(&1, 86400, :second))
    visit()
    assert :ok = CampaignAnalytics.flush()

    rows =
      Repo.all(from(m in "campaign_metrics", where: m.event == "site_visitors", select: m.count))

    assert Enum.sort(rows) == [1, 1]
  end

  test "visit and campaign cardinality are bounded" do
    stop_supervised!(CampaignAnalytics)
    start_supervised!({CampaignAnalytics, max_visits: 3, max_groups: 1})
    visit()
    visit(%{@labels | "content" => "second"})
    visit(%{@labels | "content" => "third"})

    assert {:error, :capacity} =
             CampaignAnalytics.visit(@labels, {192, 0, 2, 1}, "Synthetic browser")

    r = report()
    assert length(r.campaigns) == 2
    assert Enum.find(r.campaigns, &(&1.source == "other")).counts["visits"] == 2
  end

  test "collector respects privacy signals, bots, disabled collection and origin" do
    for headers <- [
          [{"dnt", "1"}],
          [{"sec-gpc", "1"}],
          [{"user-agent", "SomeBot"}],
          [{"origin", "https://foreign.example"}]
        ] do
      assert collector("/api/analytics/visit", @labels, headers).status == 204
    end

    assert report().totals == %{}
    Application.put_env(:teleprompter, :campaign_analytics_enabled, false)
    assert collector("/api/analytics/visit", @labels).status == 204
    assert CampaignAnalytics.context("anything") == nil
  end

  test "the public endpoint cannot forge playback or purchases" do
    conn = collector("/api/analytics/visit", @labels)
    token = json_response(conn, 200)["token"]

    for event <- [
          "playback_started",
          "session_created",
          "purchase_paid",
          "checkout_started",
          "signed_in"
        ] do
      assert collector("/api/analytics/event", %{token: token, event: event}).status == 204
    end

    collector("/api/analytics/event", %{token: token, event: "start_clicked"})
    totals = report().totals
    assert totals["start_clicked"] == 1
    refute totals["playback_started"]
    refute totals["purchase_paid"]
  end

  test "the collector enforces its body budget before accepting an oversized payload" do
    assert_error_sent 413, fn ->
      build_conn()
      |> put_req_header("content-type", "application/json")
      |> put_req_header("origin", Accounts.origin())
      |> post("/api/analytics/visit", Jason.encode!(%{source: String.duplicate("x", 3000)}))
    end
  end

  test "real take creation, authenticated remote joins and playback retain the original campaign" do
    token = visit()

    data =
      build_conn()
      |> put_req_header("x-izzy-visit", token)
      |> post("/api/sessions", %{
        protocol_version: 2,
        content: "Synthetic analytics take.",
        speed: 0.56
      })
      |> json_response(201)

    id = data["session_id"]

    on_exit(fn ->
      case Sessions.lookup(id) do
        {:ok, pid} -> GenServer.stop(pid)
        _ -> :ok
      end
    end)

    assert {:error, :unauthorized} = Sessions.join(id, "remote", "forged", "denied")
    assert {:ok, _} = Sessions.join(id, "remote", data["tokens"]["remote"], "synthetic")
    assert {:ok, _} = Sessions.join(id, "remote", data["tokens"]["remote"], "reconnected")

    for {command, seq} <- [{:play, 1}, {:pause, 2}, {:play, 3}] do
      assert {:ok, _} =
               Sessions.command(
                 id,
                 "remote",
                 "synthetic",
                 %{
                   "protocol_version" => 2,
                   "sequence" => seq,
                   "command_id" => "synthetic:#{seq}"
                 },
                 command
               )
    end

    totals = report().totals
    assert totals["session_created"] == 1
    assert totals["remote_connected"] == 1
    assert totals["playback_started"] == 1
    assert hd(CampaignAnalytics.report().campaigns).content == "demo_01"
  end

  test "report API refuses anonymous and ordinary users and admits only configured owners" do
    assert build_conn() |> get("/api/account/analytics") |> json_response(401) == %{
             "reason" => "login_required"
           }

    user = Repo.insert!(%Accounts.User{email: "analytics-owner@example.com"})
    raw = Accounts.issue_token(user.id, "session", 3600)
    conn = build_conn() |> init_test_session(account_token: raw)
    assert get(conn, "/api/account/analytics").status == 403
    Application.put_env(:teleprompter, :analytics_admin_emails, [user.email])
    response = get(conn, "/api/account/analytics?days=7")
    assert json_response(response, 200)["days"] == 7
    assert get_resp_header(response, "cache-control") == ["no-store"]
    refute response.resp_body =~ user.email
  end

  test "payment report uses durable current production states, excludes pending and test transactions" do
    token = visit()
    acquisition = token |> CampaignAnalytics.context() |> Map.delete("id")
    user = Repo.insert!(%Accounts.User{email: "payment-analytics@example.com"})
    intent = Repo.insert!(%Intent{user_id: user.id})

    for {status, env} <- [
          {"paid", "production"},
          {"refunded", "production"},
          {"pending", "production"},
          {"paid", "test"}
        ] do
      Repo.insert!(%Attempt{
        intent_id: intent.id,
        provider: "lava",
        currency: "USD",
        amount_minor: 2900,
        status: status,
        environment: env,
        acquisition: acquisition
      })
    end

    payments = report().payments
    assert Enum.sort(Enum.map(payments, & &1.status)) == ["paid", "refunded"]

    assert Enum.all?(
             payments,
             &(&1.count == 1 and &1.amount_minor == 2900 and &1.campaign["content"] == "demo_01")
           )

    Repo.update_all(
      from(a in Attempt, where: a.status == "paid" and a.environment == "production"),
      set: [status: "refunded"]
    )

    assert [%{status: "refunded", count: 2}] = CampaignAnalytics.report().payments
  end

  test "a checkout keeps its original attribution when another post resumes it" do
    old_providers = Application.get_env(:teleprompter, :payment_providers)
    old_enabled = Application.get_env(:teleprompter, :payments_enabled)

    on_exit(fn ->
      Application.put_env(:teleprompter, :payment_providers, old_providers)
      Application.put_env(:teleprompter, :payments_enabled, old_enabled)
    end)

    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{
        id: "synthetic-campaign-invoice",
        paymentUrl: "https://app.lava.top/payment/fixture"
      })
    end)

    Application.put_env(:teleprompter, :payments_enabled, true)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        approved: true,
        currencies: ["USD"],
        environment: "production",
        api_key: "synthetic-outbound",
        webhook_secret: "synthetic-inbound",
        offer_id: "synthetic-offer",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    token = visit()
    other = visit(%{@labels | "content" => "another_post"})
    user = Repo.insert!(%Accounts.User{email: "checkout-campaign@example.com"})
    assert {:ok, first} = Teleprompter.Commerce.checkout(user, "lava", "USD", false, token)
    assert {:ok, reused} = Teleprompter.Commerce.checkout(user, "lava", "USD", false, other)
    assert first.id == reused.id
    attempt = Repo.get!(Attempt, first.id)
    assert attempt.acquisition["content"] == "demo_01"
    refute Map.has_key?(attempt.acquisition, "id")
    refute Map.has_key?(first, :acquisition)
  end
end
