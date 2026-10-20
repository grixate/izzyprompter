defmodule Teleprompter.SessionsTest do
  use ExUnit.Case, async: false

  alias Teleprompter.Sessions

  test "reading speeds include slow takes and normalize legacy fast values" do
    {:ok, session} = Sessions.create("Slow synthetic take", 0.2)
    {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.transport.speed == 0.2
    {:ok, changed} = Sessions.command(session.session_id, "remote", "display-1", envelope(1), {:set_speed, 0.56})
    assert changed.transport.speed == 0.56
    {:ok, changed} = Sessions.command(session.session_id, "remote", "display-1", envelope(2), {:set_speed, 1.5})
    assert changed.transport.speed == 1.0
    assert {:error, :invalid_command} = Sessions.command(session.session_id, "remote", "display-1", envelope(3), {:set_speed, 0.19})
    {:ok, legacy} = Sessions.create("Legacy take", 1.35)
    {:ok, snapshot} = Sessions.snapshot(legacy.session_id)
    assert snapshot.transport.speed == 1.0
    assert {:ok, %{"speed" => 0.2}} = Teleprompter.PromptSettings.validate(%{"speed" => 0.2})
    assert {:ok, %{"speed" => 1.0, "fontSize" => 92}} = Teleprompter.PromptSettings.validate(%{"speed" => 1.35, "fontSize" => 92})
  end

  test "keeps authoritative transport anchors in an ephemeral session" do
    {:ok, session} = Sessions.create("Test script", 0.86)
    id = session.session_id
    {:ok, snapshot} = Sessions.join(id, "display", session.tokens["display"], "display-1")

    assert snapshot.transport.status == "paused"
    assert snapshot.presence["display"] == 1

    {:ok, played} = Sessions.command(id, "display", "display-1", envelope(1), :play)
    assert played.transport.status == "playing"

    {:ok, sought} = Sessions.command(id, "display", "display-1", envelope(2), {:seek_delta, 120})
    assert sought.transport.anchor_position >= 120
    assert sought.transport.revision == 2

    {:ok, paused} = Sessions.command(id, "display", "display-1", envelope(3), :pause)
    assert paused.transport.status == "paused"
    assert paused.transport.revision == 3
  end

  test "unknown and terminated sessions are never auto-created" do
    assert {:error, :session_unavailable} = Sessions.join("ABSENT", "remote", "bad", "remote-1")
    assert {:error, :session_unavailable} = Sessions.leave("ABSENT", "remote-1")
    assert {:error, :session_unavailable} = Sessions.lookup("ABSENT")
    {:ok, session} = Sessions.create("Script", 0.86)
    {:ok, pid} = Sessions.lookup(session.session_id)
    GenServer.stop(pid, :normal)
    assert {:error, :session_unavailable} = Sessions.snapshot(session.session_id)
    assert {:error, :session_unavailable} = Sessions.leave(session.session_id, "remote-1")
  end

  test "tokens are independent, role-bound, and absent from snapshots and stored plaintext" do
    {:ok, session} = Sessions.create("Secret script", 1)
    assert length(Enum.uniq(Map.values(session.tokens))) == 3

    assert {:error, :unauthorized} =
             Sessions.join(session.session_id, "editor", session.tokens["remote"], "client-1")

    assert {:ok, snapshot} =
             Sessions.join(session.session_id, "remote", session.tokens["remote"], "client-1")

    refute Map.has_key?(snapshot, :tokens)
    {:ok, pid} = Sessions.lookup(session.session_id)
    state = :sys.get_state(pid)
    Enum.each(Map.values(session.tokens), fn token -> refute inspect(state) =~ token end)
  end

  test "rejects invalid creation and malformed transport without crashing" do
    for content <- ["", "   ", nil, String.duplicate("a", 2 * 1024 * 1024 + 1)] do
      assert {:error, :invalid_session} = Sessions.create(content, 1)
    end

    {:ok, session} = Sessions.create("Valid", 1)

    assert {:error, :invalid_command} =
             Sessions.command(
               session.session_id,
               "remote",
               "display-1",
               envelope(1),
               {:seek_delta, "oops"}
             )

    assert {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.transport.revision == 0
  end

  test "new logical clients never evict old replay protection" do
    {:ok, session} = Sessions.create("Script", 1)

    assert {:ok, _} =
             Sessions.command(
               session.session_id,
               "remote",
               "display-1",
               envelope(1),
               {:seek_delta, 120}
             )

    for index <- 1..130 do
      client_id = "other-client-#{index}"
      envelope = %{"protocol_version" => 2, "sequence" => 1, "command_id" => "#{client_id}:1"}

      assert {:ok, _} =
               Sessions.command(
                 session.session_id,
                 "remote",
                 client_id,
                 envelope,
                 {:seek_delta, 0}
               )
    end

    assert {:error, :stale_command} =
             Sessions.command(
               session.session_id,
               "remote",
               "display-1",
               envelope(1),
               {:seek_delta, 120}
             )

    {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.transport.anchor_position == 120
  end

  test "connection capacity is bounded and leaving frees a slot" do
    {:ok, session} = Sessions.create("Script", 1)

    for index <- 1..64 do
      assert {:ok, _} =
               Sessions.join(session.session_id, "remote", session.tokens["remote"], index)
    end

    assert {:error, :session_limit} =
             Sessions.join(session.session_id, "remote", session.tokens["remote"], 65)

    assert {:ok, _} = Sessions.leave(session.session_id, 1)

    assert {:ok, snapshot} =
             Sessions.join(session.session_id, "remote", session.tokens["remote"], 65)

    assert snapshot.presence["remote"] == 64
  end

  defp envelope(sequence),
    do: %{
      "protocol_version" => 2,
      "sequence" => sequence,
      "command_id" => "display-1:#{sequence}"
    }
end
