defmodule Teleprompter.AccountsLibraryTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import Swoosh.TestAssertions
  alias Teleprompter.{Accounts, Library, Repo, Sessions, Commerce}
  alias Teleprompter.Accounts.{User, Token}
  alias Teleprompter.Commerce.{Intent, Attempt, Grant, Event}
  @moduletag :database

  setup do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    user = Repo.insert!(%User{email: "#{Ecto.UUID.generate()}@example.com"})
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
    {:ok, user: user}
  end

  defp script(user, content \\ "Opening.\n\nSecond paragraph."),
    do: Library.create(user, %{"title" => "Camera script", "content" => content})

  defp write(script, content),
    do: %{
      "title" => script.title,
      "content" => content,
      "expected_revision" => script.revision,
      "mutation_id" => Ecto.UUID.generate()
    }

  defp purchase(user, provider \\ "lava", currency \\ "USD", amount \\ 2900) do
    intent = Repo.get_by(Intent, user_id: user.id) || Repo.insert!(%Intent{user_id: user.id})

    Repo.insert!(%Attempt{
      intent_id: intent.id,
      provider: provider,
      currency: currency,
      amount_minor: amount,
      environment: "production",
      status: "pending",
      external_id: Ecto.UUID.generate()
    })
  end

  defp make_pro(user) do
    attempt = purchase(user)
    {:ok, :ok} = Commerce.operator_confirm(attempt.id, "paid", "test", "fixture-transaction")
    attempt
  end

  defp event(attempt, type, changes \\ %{}) do
    payload =
      Map.merge(
        %{
          "external_id" => attempt.external_id,
          "type" => type,
          "amount_minor" => attempt.amount_minor,
          "currency" => attempt.currency,
          "test" => false
        },
        changes
      )

    e =
      Repo.insert!(%Event{
        provider: attempt.provider,
        external_key: Ecto.UUID.generate(),
        environment: attempt.environment,
        payload: payload
      })

    Commerce.process_event(e.id)
    Repo.get!(Event, e.id)
  end

  test "email link is hashed, single-use, expires and delivers through Swoosh", %{user: user} do
    assert :ok = Accounts.request_login(user.email)

    assert_email_sent(fn email ->
      [_, raw] = Regex.run(~r/#token=([A-Za-z0-9_-]+)/, email.text_body)
      assert Repo.get!(Token, Accounts.hash(raw)).kind == "login"
      assert {:ok, {^user, session}} = Accounts.consume_login(raw)
      assert Accounts.user_for_session(session).id == user.id
      assert {:error, :invalid_token} = Accounts.consume_login(raw)
      Accounts.revoke(session)
      assert is_nil(Accounts.user_for_session(session))
    end)

    token = Accounts.issue_token(user.id, "login", -1)
    assert {:error, :invalid_token} = Accounts.consume_login(token)
    assert {:error, :invalid_token} = Accounts.consume_login("bogus")
  end

  test "Google never merges an existing email account implicitly", %{user: user} do
    identity = %{"sub" => "google-id", "email" => user.email, "email_verified" => true}
    assert {:error, :sign_in_to_link} = Accounts.google_identity(identity, nil)
    assert {:ok, ^user} = Accounts.google_identity(identity, user)
    assert {:ok, ^user} = Accounts.google_identity(identity, nil)

    assert {:error, :unverified_identity} =
             Accounts.google_identity(%{identity | "email_verified" => false}, nil)
  end

  test "save works before pairing, preserves IDs, deduplicates and rejects conflicts", %{
    user: user
  } do
    {:ok, initial} = script(user)
    params = write(initial, "Changed opening.\n\nSecond paragraph.")
    assert {:ok, saved} = Library.update(user, initial.id, params)
    assert saved.revision == 2
    assert hd(saved.document["blocks"])["id"] == hd(initial.document["blocks"])["id"]
    assert {:ok, duplicate} = Library.update(user, initial.id, params)
    assert duplicate.revision == 2

    assert {:error, :mutation_reused} =
             Library.update(user, initial.id, Map.put(params, "content", "Other"))

    assert {:error, {:conflict, current}} =
             Library.update(user, initial.id, write(initial, "Stale"))

    assert current.revision == 2
    assert Library.get(user, initial.id).revision == 2
  end

  test "free count, duplicate and restore share atomic three-script allowance", %{user: user} do
    {:ok, first} = script(user)
    {:ok, _} = script(user)
    {:ok, _} = script(user)
    assert {:error, :script_limit} = script(user)
    assert {:error, :script_limit} = Library.duplicate(user, first.id)
    assert {:ok, _} = Library.trash(user, first.id)
    assert {:ok, _} = script(user)
    assert {:error, :script_limit} = Library.restore(user, first.id)
    assert length(Library.list(user, "", true)) == 1
  end

  test "parallel creations cannot exceed the free allowance", %{user: user} do
    results =
      1..8
      |> Task.async_stream(fn _ -> script(user) end, max_concurrency: 8, timeout: 10_000)
      |> Enum.to_list()

    assert Enum.count(results, &match?({:ok, {:ok, _}}, &1)) == 3
    assert length(Library.list(user)) == 3
  end

  test "expired trash is not restorable and another account cannot access text", %{user: user} do
    {:ok, s} = script(user)
    other = Repo.insert!(%User{email: "other@example.com"})
    assert is_nil(Library.get(other, s.id))
    assert {:error, :not_found} = Library.update(other, s.id, write(s, "Intruder"))
    assert {:error, :not_found} = Library.get(user, "invalid") || {:error, :not_found}

    Repo.update_all(from(s in Library.Script, where: s.id == ^s.id),
      set: [deleted_at: DateTime.add(DateTime.utc_now(), -31 * 86400, :second)]
    )

    assert {:error, :not_found} = Library.restore(user, s.id)
    assert Library.list(user, "", true) == []
  end

  test "saved sessions use the device speed and explicit presets keep priority", %{user: user} do
    {:ok, s} = script(user)

    for speed <- [0.49, 1.51, "fast"] do
      assert {:error, :invalid_settings} = Sessions.create_saved(user, s.id, "standard", speed)
    end

    {:ok, live} = Sessions.create_saved(user, s.id, "standard", 1.23)
    {:ok, snapshot} = Sessions.snapshot(live.session_id)
    assert snapshot.transport.speed == 1.23
    assert :ok = Sessions.end_saved(live.session_id, user)

    make_pro(user)

    {:ok, preset} =
      Library.save_preset(user, nil, %{
        "name" => "Studio",
        "is_default" => true,
        "settings" => Map.put(Teleprompter.PromptSettings.defaults(), "speed", 0.73)
      })

    for preset_id <- [nil, preset.id] do
      {:ok, live} = Sessions.create_saved(user, s.id, preset_id, 1.23)
      {:ok, snapshot} = Sessions.snapshot(live.session_id)
      assert snapshot.transport.speed == 0.73
      assert :ok = Sessions.end_saved(live.session_id, user)
    end
  end

  test "project folders isolate accounts and organize scripts without changing document revisions",
       %{user: user} do
    assert {:error, :pro_required} = Library.save_folder(user, nil, %{"name" => "Interview"})
    make_pro(user)
    {:ok, folder} = Library.save_folder(user, nil, %{"name" => "Interview"})
    {:ok, other_folder} = Library.save_folder(user, nil, %{"name" => "Studio"})
    {:ok, renamed} = Library.save_folder(user, folder.id, %{"name" => "Interviews"})
    assert renamed.name == "Interviews"

    {:ok, saved} =
      Library.create(user, %{
        "title" => "Take 1",
        "content" => "Private opening.",
        "folder_id" => folder.id
      })

    {:ok, plain} = script(user)
    assert Enum.map(Library.list(user, "", false, 0, folder.id), & &1.id) == [saved.id]
    assert Enum.map(Library.list(user, "", false, 0, "unfiled"), & &1.id) == [plain.id]
    assert Library.list(user, "missing", false, 0, folder.id) == []
    assert Library.list(user, "", false, 0, "invalid") == []
    assert Enum.find(Library.folders(user), &(&1.id == folder.id)).script_count == 1
    {:ok, live} = Sessions.create_saved(user, saved.id)
    {:ok, session_pid} = Sessions.lookup(live.session_id)
    {:ok, before_move} = Sessions.snapshot(live.session_id)

    on_exit(fn ->
      if match?({:ok, _}, Sessions.lookup(live.session_id)),
        do: Sessions.end_saved(live.session_id, user)
    end)

    {:ok, moved} = Library.move_to_folder(user, saved.id, other_folder.id)
    assert moved.revision == saved.revision
    assert moved.document == saved.document
    assert {:ok, ^session_pid} = Sessions.lookup(live.session_id)
    {:ok, after_move} = Sessions.snapshot(live.session_id)
    assert after_move.transport == before_move.transport
    assert after_move.script == before_move.script
    refute Map.has_key?(after_move, :folder_id)
    {:ok, edited} = Library.update(user, saved.id, write(saved, "Still writable"))
    assert edited.folder_id == other_folder.id
    {:ok, copy} = Library.duplicate(user, saved.id)
    assert copy.folder_id == other_folder.id

    other = Repo.insert!(%User{email: Ecto.UUID.generate() <> "@example.com"})
    make_pro(other)
    assert Library.folders(other) == []
    assert Library.list(other, "", false, 0, other_folder.id) == []

    assert {:error, :not_found} =
             Library.save_folder(other, other_folder.id, %{"name" => "Intruder"})

    assert {:error, :not_found} = Library.delete_folder(other, other_folder.id)
    assert {:error, :not_found} = Library.move_to_folder(other, saved.id, other_folder.id)
    assert {:error, :not_found} = Library.move_to_folder(user, plain.id, Ecto.UUID.generate())
    {:ok, foreign} = Library.save_folder(other, nil, %{"name" => "Private project"})
    assert {:error, :not_found} = Library.move_to_folder(user, plain.id, foreign.id)

    assert {:error, :not_found} =
             Library.create(user, %{
               "title" => "Bad",
               "content" => "No",
               "folder_id" => foreign.id
             })

    assert {:error, :invalid_folder} = Library.save_folder(user, nil, %{"name" => " "})
  end

  test "folder removal and Pro revocation preserve active and trashed scripts", %{user: user} do
    attempt = make_pro(user)
    {:ok, folder} = Library.save_folder(user, nil, %{"name" => "Client"})

    {:ok, saved} =
      Library.create(user, %{"title" => "Active", "content" => "Words", "folder_id" => folder.id})

    {:ok, deleted} = Library.duplicate(user, saved.id)
    {:ok, detach} = Library.duplicate(user, saved.id)
    {:ok, _} = Library.trash(user, deleted.id)
    assert Enum.find(Library.folders(user), &(&1.id == folder.id)).script_count == 2
    {:ok, :ok} = Commerce.operator_confirm(attempt.id, "refunded", "test", "fixture-refund")
    assert length(Library.folders(user)) == 1
    assert length(Library.list(user, "", false, 0, folder.id)) == 2
    assert length(Library.list(user, "", true, 0, folder.id)) == 1
    assert {:error, :pro_required} = Library.save_folder(user, folder.id, %{"name" => "Changed"})
    assert {:error, :pro_required} = Library.move_to_folder(user, saved.id, folder.id)
    {:ok, unfiled} = Library.move_to_folder(user, detach.id, nil)
    assert is_nil(unfiled.folder_id)
    assert {:ok, _} = Library.delete_folder(user, folder.id)
    assert Library.folders(user) == []
    assert is_nil(Library.get(user, saved.id).folder_id)
    assert Library.get(user, saved.id).document == saved.document
    [trash] = Library.list(user, "", true)
    assert trash.id == deleted.id
    assert is_nil(trash.folder_id)
  end

  test "saved session is exclusive, serializes library edits and hides private identity", %{
    user: user
  } do
    {:ok, s} = script(user)
    {:ok, live} = Sessions.create_saved(user, s.id)

    on_exit(fn ->
      if match?({:ok, _}, Sessions.lookup(live.session_id)),
        do: Sessions.end_saved(live.session_id, user)
    end)

    assert {:error, :session_active} = Sessions.create_saved(user, s.id)
    assert {:error, :session_active} = Library.trash(user, s.id)
    {:ok, snap} = Sessions.snapshot(live.session_id)
    assert snap.saved_revision == 1
    refute Map.has_key?(snap, :saved)
    refute Map.has_key?(snap, :user_id)
    {:ok, saved} = Library.update(user, s.id, write(s, "Live library update"))
    {:ok, updated} = Sessions.snapshot(live.session_id)
    assert updated.script.content == "Live library update"
    assert updated.saved_revision == saved.revision
    # A lost response retried after another update cannot roll the session back.
    params = write(saved, "Newer")
    {:ok, newer} = Library.update(user, s.id, params)
    {:ok, _} = Library.update(user, s.id, write(newer, "Newest"))
    {:ok, replay} = Library.update(user, s.id, params)
    assert replay.superseded_by.revision > replay.revision
    {:ok, snap} = Sessions.snapshot(live.session_id)
    assert snap.script.content == "Newest"
    assert :ok = Sessions.end_saved(live.session_id, user)
    assert {:ok, _} = Library.trash(user, s.id)
  end

  test "capability editor changes commit before acknowledgement", %{user: user} do
    {:ok, s} = script(user)
    {:ok, live} = Sessions.create_saved(user, s.id)

    envelope = %{
      "protocol_version" => 2,
      "sequence" => 1,
      "command_id" => "editor-client:1",
      "base_revision" => 1
    }

    assert {:ok, snap} =
             Sessions.update_script(
               live.session_id,
               "editor",
               "editor-client",
               envelope,
               "Edited live"
             )

    assert snap.script.content == "Edited live"
    assert Library.document_text(Library.get(user, s.id).document) == "Edited live"
    assert :ok = Sessions.end_saved(live.session_id, user)
  end

  test "Pro count and presets survive refund without deleting scripts", %{user: user} do
    grant = make_pro(user)
    assert Commerce.pro?(user)
    Enum.each(1..5, fn _ -> assert {:ok, _} = script(user) end)

    params = %{
      "name" => "Studio",
      "settings" => Teleprompter.PromptSettings.defaults(),
      "is_default" => true
    }

    {:ok, first} = Library.save_preset(user, nil, params)
    {:ok, second} = Library.save_preset(user, nil, %{params | "name" => "Stage"})
    assert Enum.count(Library.presets(user), & &1.is_default) == 1
    assert {:ok, _} = Library.preset_settings(user, second.id)
    {:ok, :ok} = Commerce.operator_confirm(grant.id, "refunded", "test", "fixture-refund")
    refute Commerce.pro?(user)
    assert length(Library.list(user)) == 5
    assert length(Library.presets(user)) == 2
    assert {:error, :pro_required} = Library.preset_settings(user, first.id)
    assert {:error, :script_limit} = script(user)
    s = hd(Library.list(user))
    assert {:ok, _} = Library.update(user, s.id, write(s, "Still editable"))
  end

  test "preset application preserves playback and position", %{user: user} do
    make_pro(user)
    {:ok, s} = script(user)
    {:ok, live} = Sessions.create_saved(user, s.id)

    cmd = fn seq ->
      %{"protocol_version" => 2, "sequence" => seq, "command_id" => "editor-client:#{seq}"}
    end

    {:ok, _} =
      Sessions.command(live.session_id, "editor", "editor-client", cmd.(1), {:seek_to, 500})

    {:ok, _} = Sessions.command(live.session_id, "editor", "editor-client", cmd.(2), :play)
    settings = Map.put(Teleprompter.PromptSettings.defaults(), "fontSize", 90)
    assert {:ok, _} = Sessions.apply_preset(live.session_id, user, settings)
    {:ok, snap} = Sessions.snapshot(live.session_id)
    assert snap.transport.status == "playing"
    assert snap.transport.anchor_position >= 500
    assert snap.display_settings["fontSize"] == 90
    Sessions.end_saved(live.session_id, user)
  end

  test "paid events grant once and reject wrong amounts", %{user: user} do
    a = purchase(user)
    assert event(a, "paid", %{"amount_minor" => 1}).status == "review"
    refute Commerce.pro?(user)
    assert event(a, "paid").status == "processed"
    assert event(a, "paid").status == "processed"
    assert Repo.aggregate(from(g in Grant, where: g.user_id == ^user.id), :count) == 1
    assert Commerce.pro?(user)
  end

  test "inserting a paragraph preserves the identities of unchanged paragraphs", %{user: user} do
    {:ok, first} = script(user)

    {:ok, saved} =
      Library.update(user, first.id, write(first, "New intro.\n\nOpening.\n\nSecond paragraph."))

    assert Enum.map(tl(saved.document["blocks"]), & &1["id"]) ==
             Enum.map(first.document["blocks"], & &1["id"])
  end

  test "database rejection does not acknowledge or replace live text", %{user: user} do
    {:ok, s} = script(user)
    {:ok, live} = Sessions.create_saved(user, s.id)
    on_exit(fn -> Sessions.end_saved(live.session_id, user) end)

    Ecto.Adapters.SQL.query!(
      Repo,
      "ALTER TABLE scripts ADD CONSTRAINT test_reject_save CHECK (title <> 'reject-this-save') NOT VALID"
    )

    params = write(s, "Text waiting for retry") |> Map.put("title", "reject-this-save")
    assert {:error, :database_unavailable} = Library.update(user, s.id, params)
    assert Library.get(user, s.id).revision == 1
    {:ok, snap} = Sessions.snapshot(live.session_id)
    assert snap.script.content == "Opening.\n\nSecond paragraph."
    assert {:ok, saved} = Library.update(user, s.id, Map.put(params, "title", "Retry accepted"))
    assert saved.revision == 2
    assert Library.document_text(saved.document) == "Text waiting for retry"
  end

  test "playback commands do not queue behind a slow database write", %{user: user} do
    {:ok, s} = script(user)
    {:ok, live} = Sessions.create_saved(user, s.id)
    on_exit(fn -> Sessions.end_saved(live.session_id, user) end)

    Ecto.Adapters.SQL.query!(
      Repo,
      "CREATE FUNCTION test_slow_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.4); RETURN NEW; END $$"
    )

    Ecto.Adapters.SQL.query!(
      Repo,
      "CREATE TRIGGER test_slow_save BEFORE UPDATE ON scripts FOR EACH ROW EXECUTE FUNCTION test_slow_save()"
    )

    task = Task.async(fn -> Library.update(user, s.id, write(s, "Slow durable save")) end)
    {:ok, pid} = Sessions.lookup(live.session_id)

    Enum.reduce_while(1..100, nil, fn _, _ ->
      if :sys.get_state(pid).pending_save,
        do: {:halt, :ready},
        else:
          (
            Process.sleep(5)
            {:cont, nil}
          )
    end)

    started = System.monotonic_time(:millisecond)

    assert {:ok, snap} =
             Sessions.command(
               live.session_id,
               "editor",
               "client",
               %{
                 "protocol_version" => 2,
                 "sequence" => 1,
                 "command_id" => "client:1"
               },
               :play
             )

    assert snap.transport.status == "playing"
    assert System.monotonic_time(:millisecond) - started < 250
    assert {:ok, _} = Task.await(task)
    {:ok, saved} = Sessions.snapshot(live.session_id)
    assert saved.transport.status == "playing"
  end

  test "retention removes only expired trash, receipts and tokens", %{user: user} do
    {:ok, active} = script(user)
    {:ok, trashed} = script(user)
    {:ok, expired} = script(user)
    {:ok, _} = Library.trash(user, trashed.id)
    {:ok, _} = Library.trash(user, expired.id)

    Repo.update_all(from(s in Library.Script, where: s.id == ^expired.id),
      set: [deleted_at: DateTime.add(DateTime.utc_now(), -31 * 86400, :second)]
    )

    token = Accounts.issue_token(user.id, "login", -60)
    assert {:ok, _} = Teleprompter.Maintenance.prune()
    assert Repo.get(Library.Script, active.id)
    assert Repo.get(Library.Script, trashed.id)
    refute Repo.get(Library.Script, expired.id)
    refute Repo.get(Token, Accounts.hash(token))
  end

  test "unmatched refunds require an audited provider match; disputes can be restored", %{
    user: user
  } do
    a = make_pro(user)
    refund = event(a, "refunded", %{"external_id" => nil})
    assert refund.status == "review"
    assert Commerce.pro?(user)

    assert {:ok, _} =
             Commerce.operator_match_event(
               refund.id,
               a.id,
               "operator:test",
               "verified-refund-ref"
             )

    refute Commerce.pro?(user)
    assert event(a, "disputed").status == "processed"

    assert {:error, :invalid_dispute} =
             Commerce.operator_restore_dispute(a.id, "operator:test", "delayed-dispute")

    refute Commerce.pro?(user)
    b = make_pro(user)
    assert event(b, "disputed").status == "processed"
    refute Commerce.pro?(user)

    assert {:ok, :ok} =
             Commerce.operator_restore_dispute(b.id, "operator:test", "verified-dispute-won")

    assert Commerce.pro?(user)
  end

  test "checkout reuses pending links and requires explicit switching with immutable prices", %{
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
        environment: "production",
        currencies: ["RUB", "USD"],
        api_key: "test",
        webhook_secret: "inbound",
        offer_id: "offer",
        http_options: [plug: {Req.Test, __MODULE__}]
      ]
    })

    Req.Test.stub(__MODULE__, fn conn ->
      Req.Test.json(conn, %{id: Ecto.UUID.generate(), paymentUrl: "https://app.lava.top/pay/test"})
    end)

    assert {:ok, a} = Commerce.checkout(user, "lava", "USD")
    assert a.amount_minor == 2900
    assert {:ok, ^a} = Commerce.checkout(user, "lava", "USD")
    assert {:error, :payments_unavailable} = Commerce.checkout(user, "lava", "RUB")
    assert {:error, :payments_unavailable} = Commerce.checkout(user, "prodamus", "USD", true)
    legacy_user = Repo.insert!(%User{email: "legacy-checkout@example.com"})
    legacy = purchase(legacy_user, "prodamus", "RUB", 249_000)
    assert {:error, :payment_pending} = Commerce.checkout(legacy_user, "lava", "USD")
    assert {:ok, b} = Commerce.checkout(legacy_user, "lava", "USD", true)
    assert b.amount_minor == 2900
    assert legacy.id != b.id
    Req.Test.stub(__MODULE__, fn conn -> Plug.Conn.send_resp(conn, 500, "timeout") end)
    other = Repo.insert!(%User{email: "ambiguous@example.com"})
    assert {:error, :payment_pending} = Commerce.checkout(other, "lava", "USD")

    Req.Test.stub(__MODULE__, fn _ ->
      flunk("Ambiguous creation must never be retried automatically")
    end)

    assert {:error, :payment_pending} = Commerce.checkout(other, "lava", "USD")
    assert hd(Commerce.purchases(other)).status == "ambiguous"
  end

  test "duplicate payments are flagged; refunding one retains the other grant", %{user: user} do
    a = purchase(user)
    b = purchase(user, "prodamus", "RUB", 249_000)
    event(a, "paid")
    event(b, "paid")
    assert Repo.get!(Attempt, b.id).review_reason == "duplicate_payment_refund_review"
    event(b, "refunded")
    assert Commerce.pro?(user)
    event(a, "partial_refund", %{"amount_minor" => 100})
    assert Commerce.pro?(user)
    event(a, "disputed")
    refute Commerce.pro?(user)
    # Out-of-order success never revives refunded or disputed access.
    event(a, "paid")
    refute Commerce.pro?(user)
  end

  test "test-mode payments cannot unlock production Pro", %{user: user} do
    a = purchase(user)
    assert event(a, "paid", %{"test" => true}).status == "review"
    refute Commerce.pro?(user)
    a |> Ecto.Changeset.change(environment: "test") |> Repo.update!()
    event(%{a | environment: "test"}, "paid")
    refute Commerce.pro?(user)
  end

  test "lava authenticates inbox, ignores unknown events, and reviews unmatched refunds" do
    prior = Application.get_env(:teleprompter, :payment_providers)

    Application.put_env(:teleprompter, :payment_providers, %{
      "lava" => [environment: "production", webhook_secret: "dedicated-secret"]
    })

    on_exit(fn -> Application.put_env(:teleprompter, :payment_providers, prior) end)

    body = %{
      "event_id" => "refund-one",
      "event_type" => "refund.success",
      "data" => %{"refund_type" => "full", "amount" => 29, "currency" => "USD"}
    }

    assert {:error, :unauthorized} =
             Commerce.receive_event("lava", body, %{"x-api-key" => "wrong"})

    assert {:ok, :stored} =
             Commerce.receive_event("lava", body, %{"x-api-key" => "dedicated-secret"})

    assert {:ok, :stored} =
             Commerce.receive_event("lava", body, %{"x-api-key" => "dedicated-secret"})

    assert Repo.aggregate(Event, :count) == 1
    Commerce.process_events()
    assert Repo.one!(Event).review_reason == "unmatched_transaction"
  end
end
