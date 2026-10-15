defmodule Teleprompter.PaymentReconcilerTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  alias Teleprompter.{Accounts, Commerce, Repo}
  alias Teleprompter.Commerce.{Attempt, Intent, Grant, Audit, Reconciler}
  @moduletag :database

  setup do
    owner = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    prior = Application.get_env(:teleprompter, :payment_providers)
    enabled = Application.get_env(:teleprompter, :payments_enabled)
    Application.put_env(:teleprompter, :payments_enabled, false)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [
        environment: "production",
        api_key: "fixture-outbound",
        webhook_secret: "fixture-inbound",
        offer_id: "fixture-offer",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    on_exit(fn ->
      Application.put_env(:teleprompter, :payment_providers, prior)
      Application.put_env(:teleprompter, :payments_enabled, enabled)
      Ecto.Adapters.SQL.Sandbox.stop_owner(owner)
    end)

    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    intent = Repo.insert!(%Intent{user_id: user.id})
    now = DateTime.utc_now()

    attempt =
      Repo.insert!(%Attempt{
        intent_id: intent.id,
        provider: "lava",
        currency: "USD",
        amount_minor: 2900,
        environment: "production",
        status: "pending",
        external_id: Ecto.UUID.generate(),
        next_check_at: DateTime.add(now, -1, :second)
      })

    {:ok, user: user, attempt: attempt, now: now}
  end

  defp paid(conn, attempt, amount \\ 29) do
    assert conn.method == "GET"
    assert conn.request_path == "/api/v1/invoices/" <> attempt.external_id

    Req.Test.json(conn, %{
      id: attempt.external_id,
      status: "COMPLETED",
      receipt: %{amount: amount, currency: "USD"}
    })
  end

  test "a missed webhook recovers with new sales disabled; repeats do not duplicate grants", c do
    Req.Test.stub(__MODULE__, &paid(&1, c.attempt))
    assert :checked = Reconciler.run_due(c.now)
    assert Commerce.pro?(c.user)
    saved = Repo.get!(Attempt, c.attempt.id)
    assert saved.status == "paid"
    assert saved.check_attempts == 1
    assert is_nil(saved.next_check_at)
    assert is_nil(saved.check_lease_until)
    assert :idle = Reconciler.run_due(DateTime.add(c.now, 600, :second))
    assert Repo.aggregate(from(g in Grant, where: g.attempt_id == ^c.attempt.id), :count) == 1
    refute Application.get_env(:teleprompter, :payments_enabled)
  end

  test "rate-limit delay and retries survive fresh worker invocations", c do
    Req.Test.stub(__MODULE__, fn conn ->
      conn
      |> Plug.Conn.put_resp_header("retry-after", "600")
      |> Plug.Conn.send_resp(429, "slow down")
    end)

    assert :checked = Reconciler.run_due(c.now)
    saved = Repo.get!(Attempt, c.attempt.id)
    assert saved.check_error == "provider_rate_limited"
    assert DateTime.diff(saved.next_check_at, c.now) == 600
    assert :idle = Reconciler.run_due(DateTime.add(c.now, 599, :second))
    Req.Test.stub(__MODULE__, &paid(&1, c.attempt))
    assert :checked = Reconciler.run_due(saved.next_check_at)
    assert Commerce.pro?(c.user)
    assert Repo.get!(Attempt, saved.id).check_attempts == 2
  end

  test "unconfirmed invoices stop after the durable budget without claiming failure", c do
    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{id: c.attempt.external_id, status: "IN_PROGRESS"})
    end)

    for _ <- 1..12 do
      assert :checked = Reconciler.run_due(Repo.get!(Attempt, c.attempt.id).next_check_at)
    end

    saved = Repo.get!(Attempt, c.attempt.id)
    assert saved.status == "pending"
    assert saved.review_reason == "payment_confirmation_delayed"
    assert saved.check_attempts == 12
    assert is_nil(saved.next_check_at)
    assert Commerce.serialize(saved).review_required
    refute Commerce.pro?(c.user)

    assert Repo.aggregate(
             from(a in Audit,
               where: a.attempt_id == ^c.attempt.id and a.action == "confirmation_review"
             ),
             :count
           ) == 1

    assert :idle = Reconciler.run_due(DateTime.add(c.now, 2_000_000, :second))
  end

  test "an active lease prevents duplicate work and an expired lease can be recovered", c do
    c.attempt
    |> Ecto.Changeset.change(check_lease_until: DateTime.add(c.now, 60, :second))
    |> Repo.update!()

    Req.Test.stub(__MODULE__, &paid(&1, c.attempt))
    assert :idle = Reconciler.run_due(c.now)
    assert :checked = Reconciler.run_due(DateTime.add(c.now, 61, :second))
    assert Commerce.pro?(c.user)
  end

  test "a mismatched receipt goes to support review and never grants Pro", c do
    Req.Test.stub(__MODULE__, &paid(&1, c.attempt, 1))
    assert :checked = Reconciler.run_due(c.now)
    saved = Repo.get!(Attempt, c.attempt.id)
    assert saved.status == "pending"
    assert saved.review_reason == "amount_or_currency_mismatch"
    assert is_nil(saved.next_check_at)
    refute Commerce.pro?(c.user)
  end

  test "a crash on the final check reaches review after lease expiry without a thirteenth lookup",
       c do
    c.attempt
    |> Ecto.Changeset.change(
      check_attempts: 12,
      check_lease_until: DateTime.add(c.now, 60, :second)
    )
    |> Repo.update!()

    Req.Test.stub(__MODULE__, fn _ -> flunk("The durable lookup budget is exhausted") end)
    assert :idle = Reconciler.run_due(c.now)
    assert :reviewed = Reconciler.run_due(DateTime.add(c.now, 61, :second))
    saved = Repo.get!(Attempt, c.attempt.id)
    assert saved.check_attempts == 12
    assert saved.review_reason == "payment_confirmation_delayed"
    assert is_nil(saved.next_check_at)
    assert is_nil(saved.check_lease_until)
    assert :idle = Reconciler.run_due(DateTime.add(c.now, 120, :second))
    refute Commerce.pro?(c.user)
  end

  test "refunds, disputes, paid attempts and absent credentials never trigger new lookups", c do
    Req.Test.stub(__MODULE__, fn _ -> flunk("No lookup allowed") end)

    for status <- ["paid", "refunded", "disputed", "failed"] do
      c.attempt |> Ecto.Changeset.change(status: status) |> Repo.update!()
      assert :idle = Reconciler.run_due(c.now)
    end

    Application.put_env(:teleprompter, :payment_providers, %{})
    assert :unconfigured = Reconciler.run_due(c.now)
  end

  test "an interrupted invoice creation is uncertain and never automatically repeated", c do
    c.attempt
    |> Ecto.Changeset.change(
      status: "creating",
      external_id: nil,
      next_check_at: nil,
      updated_at: DateTime.add(c.now, -901, :second)
    )
    |> Repo.update!()

    Req.Test.stub(__MODULE__, fn _ -> flunk("Unknown invoice must not be created or guessed") end)
    assert :idle = Reconciler.run_due(c.now)
    saved = Repo.get!(Attempt, c.attempt.id)
    assert saved.status == "ambiguous"
    assert saved.review_reason == "invoice_creation_interrupted"
  end

  test "a slow invoice lookup does not block durable webhook processing", c do
    Req.Test.set_req_test_to_shared()
    on_exit(fn -> Req.Test.set_req_test_to_private() end)
    parent = self()

    Req.Test.stub(__MODULE__, fn conn ->
      send(parent, {:lookup_blocked, self()})

      receive do
        :release -> paid(conn, c.attempt)
      after
        5000 -> raise "Fixture lookup was not released"
      end
    end)

    start_supervised!({Task.Supervisor, name: Teleprompter.CommerceTasks})
    worker = start_supervised!(Teleprompter.Commerce.Worker)
    assert_receive {:lookup_blocked, lookup}, 1000

    assert {:ok, _} =
             Commerce.receive_event(
               "lava",
               %{
                 "eventType" => "payment.success",
                 "contractId" => c.attempt.external_id,
                 "amount" => 29,
                 "currency" => "USD"
               },
               %{"x-api-key" => "fixture-inbound"}
             )

    send(worker, :process)
    assert is_reference(:sys.get_state(worker, 1000).lookup)
    assert Commerce.pro?(c.user)
    send(lookup, :release)
  end
end
