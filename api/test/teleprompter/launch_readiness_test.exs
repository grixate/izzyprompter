defmodule Teleprompter.LaunchReadinessTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  alias Teleprompter.{Repo, Sessions, ReadingPreferences, Feedback, Metrics, PromptSettings}
  alias Teleprompter.Accounts.User
  alias Teleprompter.Feedback.Entry
  @moduletag :database

  setup do
    sandbox = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    user = Repo.insert!(%User{email: Ecto.UUID.generate() <> "@example.com"})
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(sandbox) end)
    %{user: user}
  end

  defp envelope(sequence, revision \\ 0),
    do: %{
      "protocol_version" => 2,
      "sequence" => sequence,
      "command_id" => "fixture:#{sequence}",
      "settings_revision" => revision
    }

  defp start(user) do
    {:ok, live} = Sessions.create_owned("Synthetic opening.\n\nSecond paragraph.", 0.56, user)

    on_exit(fn ->
      case Sessions.lookup(live.session_id) do
        {:ok, pid} -> GenServer.stop(pid)
        _ -> :ok
      end
    end)

    live.session_id
  end

  defp await_status(id, status, remaining \\ 150)
  defp await_status(_, _, 0), do: flunk("preferences did not reach expected status")

  defp await_status(id, status, remaining) do
    {:ok, snapshot} = Sessions.snapshot(id)

    if snapshot.preferences_status == status do
      snapshot
    else
      Process.sleep(10)
      await_status(id, status, remaining - 1)
    end
  end

  test "preferences synchronize live, reject stale settings, and restore on another session", %{
    user: user
  } do
    id = start(user)

    assert {:ok, changed} =
             Sessions.command(
               id,
               "remote",
               "fixture",
               envelope(1),
               {:settings, %{"fontSize" => 84}}
             )

    assert changed.display_settings["fontSize"] == 84

    assert {:error, :settings_conflict} =
             Sessions.command(
               id,
               "remote",
               "fixture",
               envelope(2),
               {:settings, %{"fontSize" => 22}}
             )

    assert {:error, :invalid_settings} =
             Sessions.command(
               id,
               "remote",
               "fixture",
               envelope(3, 1),
               {:settings, %{"fontSize" => 999}}
             )

    await_status(id, "saved")
    assert ReadingPreferences.get(user).settings["fontSize"] == 84
    assert {:ok, _} = Sessions.command(id, "remote", "fixture", envelope(4), {:set_speed, 0.62})
    await_status(id, "saved")
    second = start(user)
    {:ok, restored} = Sessions.snapshot(second)
    assert restored.display_settings["fontSize"] == 84
    assert restored.transport.speed == 0.62
  end

  test "concurrent takes cannot silently overwrite newer account preferences", %{user: user} do
    first = start(user)
    second = start(user)

    assert {:ok, _} =
             Sessions.command(
               first,
               "remote",
               "fixture",
               envelope(1),
               {:settings, %{"fontSize" => 80}}
             )

    await_status(first, "saved")

    assert {:ok, _} =
             Sessions.command(
               second,
               "remote",
               "fixture",
               envelope(1),
               {:settings, %{"fontSize" => 90}}
             )

    await_status(second, "conflict")
    assert ReadingPreferences.get(user).settings["fontSize"] == 80

    assert {:ok, _} =
             Sessions.command(second, "remote", "fixture", envelope(2), :remember_settings)

    await_status(second, "saved")
    assert ReadingPreferences.get(user).settings["fontSize"] == 90
    other = Repo.insert!(%User{email: Ecto.UUID.generate() <> "@example.com"})
    assert ReadingPreferences.get(other).settings == nil

    assert {:error, :preferences_conflict} =
             ReadingPreferences.save(user, PromptSettings.defaults(), 0)
  end

  test "feedback is owner-bound, idempotent, bounded, and deleted after retention", %{user: user} do
    params = %{
      "request_id" => Ecto.UUID.generate(),
      "category" => "problem",
      "message" => "Synthetic feedback for testing.",
      "rating" => 3
    }

    assert {:ok, %{received: true}} = Feedback.submit(user, params)
    assert {:ok, _} = Feedback.submit(user, params)
    assert Repo.aggregate(Entry, :count) == 1

    assert {:error, :feedback_request_reused} =
             Feedback.submit(user, %{params | "message" => "Different synthetic feedback."})

    for malformed <- [
          %{params | "message" => "short"},
          %{params | "rating" => 7},
          %{params | "category" => "anything"},
          %{params | "request_id" => "nope"}
        ] do
      assert {:error, :invalid_feedback} = Feedback.submit(user, malformed)
    end

    for _ <- 1..4,
        do:
          assert(
            {:ok, _} = Feedback.submit(user, %{params | "request_id" => Ecto.UUID.generate()})
          )

    assert {:error, :feedback_limit} =
             Feedback.submit(user, %{params | "request_id" => Ecto.UUID.generate()})

    other = Repo.insert!(%User{email: Ecto.UUID.generate() <> "@example.com"})
    assert {:ok, _} = Feedback.submit(other, params)
    entry = hd(Feedback.inbox())
    assert {1, _} = Feedback.resolve(entry.id)
    old = DateTime.add(DateTime.utc_now(), -91 * 86400, :second)
    Repo.update_all(from(f in Entry, where: f.user_id == ^user.id), set: [inserted_at: old])
    assert {5, _} = Feedback.purge_expired()
    assert Repo.aggregate(Entry, :count) == 1
    Repo.delete!(other)
    assert Repo.aggregate(Entry, :count) == 0
  end

  test "metrics persist only allowlisted aggregate totals and do not duplicate on flush", %{
    user: user
  } do
    start_supervised!(Metrics)
    id = start(user)
    assert {:ok, _} = Sessions.command(id, "remote", "fixture", envelope(1), :play)
    assert {:ok, _} = Sessions.command(id, "remote", "fixture", envelope(2), :pause)
    assert {:ok, _} = Sessions.command(id, "remote", "fixture", envelope(3), :play)
    Metrics.record("private text or URL")
    assert :ok = Metrics.flush()
    assert :ok = Metrics.flush()
    report = Metrics.report()
    assert Enum.find(report.daily_events, &(&1.event == "session_created")).count == 1
    assert Enum.find(report.daily_events, &(&1.event == "playback_started")).count == 1
    assert length(report.daily_events) == 2
    assert report.payment_states_all_time == []
  end
end
