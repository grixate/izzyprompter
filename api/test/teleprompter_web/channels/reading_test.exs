defmodule TeleprompterWeb.ReadingTest do
  use ExUnit.Case, async: true
  import Phoenix.ChannelTest
  alias Teleprompter.Sessions
  alias TeleprompterWeb.{SessionChannel, UserSocket}
  @endpoint TeleprompterWeb.Endpoint

  setup do
    {:ok, session} = Sessions.create("Opening 🎥\n\nSecond paragraph\n\nFinal paragraph", 0.86)
    {:ok, socket} = connect(UserSocket, %{"client_id" => "reading-client-123"})
    {:ok, snapshot, display} = join_role(socket, session, "display")
    %{session: session, socket: socket, display: display, snapshot: snapshot}
  end

  test "only the elected display can publish, and stale/malformed checkpoints do not replace reading",
       context do
    %{session: session, socket: socket, display: display, snapshot: snapshot} = context
    {:ok, _, remote} = join_role(socket, session, "remote")
    ref = push(remote, "reading:checkpoint", checkpoint(snapshot, 1))
    assert_reply ref, :error, %{reason: :forbidden}
    {:ok, _, secondary} = join_role(socket, session, "display")
    ref = push(secondary, "reading:checkpoint", checkpoint(snapshot, 1))
    assert_reply ref, :error, %{reason: :stale_reading}
    ref = push(display, "reading:checkpoint", checkpoint(snapshot, 1))
    assert_reply ref, :ok, %{checkpoint: %{position: 123}}

    ref =
      push(
        display,
        "reading:checkpoint",
        Map.put(checkpoint(snapshot, 2), "transport_revision", 99)
      )

    assert_reply ref, :error, %{reason: :stale_reading}

    ref =
      push(
        display,
        "reading:checkpoint",
        Map.put(checkpoint(snapshot, 3), "anchor", %{
          "blockId" => "missing",
          "characterOffset" => 0
        })
      )

    assert_reply ref, :error, %{reason: :stale_reading}
    {:ok, current} = Sessions.snapshot(session.session_id)
    assert current.reading.checkpoint.position == 123
  end

  test "rapid next commands advance semantic blocks before the next checkpoint arrives",
       context do
    %{session: session, socket: socket, display: display, snapshot: snapshot} = context
    ref = push(display, "reading:checkpoint", checkpoint(snapshot, 1))
    assert_reply ref, :ok, %{}
    {:ok, _, remote} = join_role(socket, session, "remote")
    ref = push(remote, "transport:step_block", Map.put(envelope(1), "direction", 1))
    second = Enum.at(snapshot.script.document.blocks, 1).id

    assert_reply ref, :ok, %{
      semantic_anchor: %{anchor: %{"blockId" => ^second, "characterOffset" => 0}}
    }

    ref = push(remote, "transport:step_block", Map.put(envelope(2), "direction", 1))
    final = Enum.at(snapshot.script.document.blocks, 2).id
    assert_reply ref, :ok, %{semantic_anchor: %{anchor: %{"blockId" => ^final}}, revision: 2}
    ref = push(remote, "transport:step_block", Map.put(envelope(2), "direction", 1))
    assert_reply ref, :error, %{reason: :stale_command}
    {:ok, rejoined, _} = join_role(socket, session, "remote")
    assert rejoined.transport.semantic_anchor.anchor["blockId"] == final
  end

  test "authority handoff preserves the checkpoint and rejects a departed source", context do
    %{session: session, socket: socket, display: display, snapshot: snapshot} = context
    ref = push(display, "reading:checkpoint", checkpoint(snapshot, 1))
    assert_reply ref, :ok, %{}
    {:ok, backup_snapshot, backup} = join_role(socket, session, "display")
    {:ok, handed} = Sessions.leave(session.session_id, snapshot.display_id)
    assert handed.reading.source_id == backup_snapshot.display_id
    assert handed.reading.checkpoint.anchor == checkpoint(snapshot, 1)["anchor"]
    ref = push(display, "reading:checkpoint", checkpoint(snapshot, 2))
    assert_reply ref, :error, %{reason: :stale_reading}
    ref = push(backup, "reading:checkpoint", Map.put(checkpoint(snapshot, 2), "position", 200))
    assert_reply ref, :ok, %{checkpoint: %{position: 200}}
  end

  test "relative jog after a semantic jump can move backwards across the transport origin",
       context do
    %{session: session, socket: socket, display: display, snapshot: snapshot} = context
    {:ok, _, remote} = join_role(socket, session, "remote")

    target = %{
      "blockId" => Enum.at(snapshot.script.document.blocks, 1).id,
      "characterOffset" => 0
    }

    ref = push(remote, "transport:seek_anchor", Map.put(envelope(1), "anchor", target))
    assert_reply ref, :ok, %{revision: 1, anchor_position: initial}
    assert initial == 0

    payload =
      Map.merge(checkpoint(snapshot, 1), %{
        "anchor" => target,
        "position" => 1000,
        "transport_revision" => 1
      })

    ref = push(display, "reading:checkpoint", payload)
    assert_reply ref, :ok, %{}
    ref = push(remote, "transport:seek_delta", Map.put(envelope(2), "delta", -48))
    assert_reply ref, :ok, %{anchor_position: -48.0, revision: 2}
    # Negative canonical distance is valid; measured display position stays positive.
    payload =
      Map.merge(
        payload,
        Map.merge(envelope(2), %{
          "position" => 952,
          "transport_position" => -48,
          "transport_revision" => 2
        })
      )

    ref = push(display, "reading:checkpoint", payload)
    assert_reply ref, :ok, %{checkpoint: %{position: 952}}
    ref = push(remote, "transport:seek_delta", Map.put(envelope(3), "delta", -2000))
    assert_reply ref, :ok, %{anchor_position: start}
    assert start == -1000
    # No accumulating dead travel beyond the start: the very next forward jog moves.
    ref = push(remote, "transport:seek_delta", Map.put(envelope(4), "delta", 48))
    assert_reply ref, :ok, %{anchor_position: forward}
    assert forward == -952
    ref = push(remote, "transport:seek_delta", Map.put(envelope(5), "delta", 5000))
    assert_reply ref, :ok, %{anchor_position: finish}
    assert finish == 2000
    ref = push(remote, "transport:seek_delta", Map.put(envelope(6), "delta", -48))
    assert_reply ref, :ok, %{anchor_position: backward}
    assert backward == 1952
  end

  test "unknown anchors and unavailable reading never produce a guessed pixel jump", context do
    %{session: session, socket: socket} = context
    {:ok, _, remote} = join_role(socket, session, "remote")
    ref = push(remote, "transport:step_block", Map.put(envelope(1), "direction", 1))
    assert_reply ref, :error, %{reason: :reading_unavailable}

    ref =
      push(
        remote,
        "transport:seek_anchor",
        Map.put(envelope(2), "anchor", %{"blockId" => "missing", "characterOffset" => 0})
      )

    assert_reply ref, :error, %{reason: :invalid_anchor}
    {:ok, current} = Sessions.snapshot(session.session_id)
    assert current.transport.revision == 0
  end

  defp join_role(socket, session, role),
    do:
      subscribe_and_join(socket, SessionChannel, "session:#{session.session_id}", %{
        "protocol_version" => 2,
        "role" => role,
        "token" => session.tokens[role]
      })

  defp envelope(sequence),
    do: %{
      "protocol_version" => 2,
      "sequence" => sequence,
      "command_id" => "reading-client-123:#{sequence}"
    }

  defp checkpoint(snapshot, sequence) do
    Map.merge(envelope(sequence), %{
      "anchor" => %{"blockId" => hd(snapshot.script.document.blocks).id, "characterOffset" => 0},
      "position" => 123,
      "maximum" => 3000,
      "transport_position" => 0,
      "transport_revision" => 0,
      "script_revision" => 1
    })
  end
end
