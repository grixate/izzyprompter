defmodule TeleprompterWeb.QuickEditTest do
  use ExUnit.Case, async: true
  import Phoenix.ChannelTest
  alias Teleprompter.Sessions
  alias TeleprompterWeb.{SessionChannel, UserSocket}
  @endpoint TeleprompterWeb.Endpoint

  setup do
    {:ok, session} = Sessions.create("Opening 🎥 words\n\nSecond paragraph", 0.86)
    {:ok, socket} = connect(UserSocket, %{"client_id" => "quick-edit-client"})
    {:ok, snapshot, display} = join_role(socket, session, "display")
    {:ok, _, remote} = join_role(socket, session, "remote")
    target = %{"blockId" => hd(snapshot.script.document.blocks).id, "characterOffset" => 11}

    ref =
      push(
        display,
        "reading:checkpoint",
        Map.merge(envelope(1), %{
          "anchor" => target,
          "position" => 100,
          "maximum" => 2000,
          "transport_position" => 0,
          "transport_revision" => 0,
          "script_revision" => 1
        })
      )

    assert_reply ref, :ok, %{}

    %{
      session: session,
      socket: socket,
      display: display,
      remote: remote,
      snapshot: snapshot,
      target: target
    }
  end

  test "live patches keep paragraph IDs, remap UTF-16 reading anchors, and stay paused", c do
    ref = push(c.remote, "script:begin_edit", envelope(1))
    assert_reply ref, :ok, %{editing: %{active: %{block_id: id}}}

    ref =
      push(
        c.remote,
        "script:patch_block",
        Map.merge(envelope(2), %{
          "block_id" => id,
          "base_revision" => 1,
          "text" => "New Opening 🎥 words"
        })
      )

    assert_reply ref, :ok, %{
      script: %{revision: 2, document: doc},
      transport: %{status: "paused", semantic_anchor: %{anchor: anchor}}
    }

    assert Enum.map(doc.blocks, & &1.id) == Enum.map(c.snapshot.script.document.blocks, & &1.id)
    assert anchor["characterOffset"] == 15
    assert_broadcast "session:update", %{script: %{revision: 2}}
    # Trailing spaces and temporarily empty paragraphs are valid while typing.
    ref =
      push(
        c.remote,
        "script:patch_block",
        Map.merge(envelope(3), %{"block_id" => id, "base_revision" => 2, "text" => ""})
      )

    assert_reply ref, :ok, %{script: %{revision: 3, document: empty}}
    assert hd(empty.blocks).id == id
    assert hd(empty.blocks).text == ""
    ref = push(c.remote, "script:end_edit", envelope(4))
    assert_reply ref, :ok, %{editing: %{active: nil}, transport: %{status: "paused"}}
  end

  test "whole-script editing enforces ownership and revisions while preserving the reading paragraph",
       c do
    ref = push(c.remote, "script:begin_edit", Map.put(envelope(1), "scope", "document"))
    assert_reply ref, :ok, %{editing: %{active: %{scope: "document"}}}
    {:ok, _, other} = join_role(c.socket, c.session, "remote")

    payload =
      Map.merge(envelope(2), %{
        "base_revision" => 1,
        "text" => "New intro\n\nOpening 🎥 words\n\nSecond paragraph\n\nNew ending"
      })

    ref = push(other, "script:patch_document", payload)
    assert_reply ref, :error, %{reason: :edit_not_owned}
    ref = push(c.remote, "script:patch_document", payload)

    assert_reply ref, :ok, %{
      script: %{revision: 2, document: document},
      transport: %{status: "paused", semantic_anchor: %{anchor: anchor}}
    }

    assert Enum.at(document.blocks, 1).id == c.target["blockId"]
    assert anchor == c.target

    ref =
      push(
        c.remote,
        "script:patch_document",
        Map.put(payload, "sequence", 3) |> Map.put("command_id", "quick-edit-client:3")
      )

    assert_reply ref, :error, %{reason: :edit_conflict}

    ref =
      push(
        c.remote,
        "script:patch_document",
        Map.merge(envelope(4), %{"base_revision" => 2, "text" => ""})
      )

    assert_reply ref, :ok, %{script: %{revision: 3, content: ""}}
  end

  test "only the owning editor/remote connection can change its current block", c do
    ref = push(c.display, "script:begin_edit", envelope(2))
    assert_reply ref, :error, %{reason: :forbidden}
    ref = push(c.remote, "script:begin_edit", envelope(1))
    assert_reply ref, :ok, %{}
    {:ok, _, other} = join_role(c.socket, c.session, "remote")

    ref =
      push(
        other,
        "script:patch_block",
        Map.merge(envelope(2), %{
          "block_id" => c.target["blockId"],
          "base_revision" => 1,
          "text" => "Hijacked"
        })
      )

    assert_reply ref, :error, %{reason: :edit_not_owned}
    ref = push(other, "script:begin_edit", envelope(3))
    assert_reply ref, :error, %{reason: :editing_active}

    ref =
      push(
        c.remote,
        "script:patch_block",
        Map.merge(envelope(2), %{
          "block_id" => Enum.at(c.snapshot.script.document.blocks, 1).id,
          "base_revision" => 1,
          "text" => "Wrong block"
        })
      )

    assert_reply ref, :error, %{reason: :invalid_block}
    ref = push(c.remote, "transport:play", envelope(3))
    assert_reply ref, :error, %{reason: :editing_active}
    {:ok, snapshot} = Sessions.snapshot(c.session.session_id)
    assert snapshot.script.content == c.snapshot.script.content
  end

  test "stale/duplicate/oversized patches cannot overwrite accepted text", c do
    ref = push(c.remote, "script:begin_edit", envelope(1))
    assert_reply ref, :ok, %{}

    payload =
      Map.merge(envelope(2), %{
        "block_id" => c.target["blockId"],
        "base_revision" => 1,
        "text" => "Accepted "
      })

    ref = push(c.remote, "script:patch_block", payload)
    assert_reply ref, :ok, %{script: %{revision: 2}}
    ref = push(c.remote, "script:patch_block", payload)
    assert_reply ref, :error, %{reason: :stale_command}

    ref =
      push(
        c.remote,
        "script:patch_block",
        Map.merge(payload, Map.merge(envelope(3), %{"text" => "Stale"}))
      )

    assert_reply ref, :error, %{reason: :edit_conflict}

    ref =
      push(
        c.remote,
        "script:patch_block",
        Map.merge(
          payload,
          Map.merge(envelope(4), %{
            "base_revision" => 2,
            "text" => String.duplicate("a", 2 * 1024 * 1024 + 1)
          })
        )
      )

    assert_reply ref, :error, %{reason: :invalid_patch}
    {:ok, snapshot} = Sessions.snapshot(c.session.session_id)
    assert hd(snapshot.script.document.blocks).text == "Accepted "
  end

  test "owner departure releases the edit and a reconnect cannot use old ownership", c do
    ref = push(c.remote, "script:begin_edit", envelope(1))
    assert_reply ref, :ok, %{editing: %{active: %{owner_id: owner}}}
    {:ok, snapshot} = Sessions.leave(c.session.session_id, owner)
    assert snapshot.editing.active == nil

    ref =
      push(
        c.remote,
        "script:patch_block",
        Map.merge(envelope(2), %{
          "block_id" => c.target["blockId"],
          "base_revision" => 1,
          "text" => "Late"
        })
      )

    assert_reply ref, :error, %{reason: :forbidden}
    {:ok, _, rejoined} = join_role(c.socket, c.session, "remote")
    ref = push(rejoined, "script:begin_edit", envelope(2))
    assert_reply ref, :ok, %{editing: %{active: %{owner_id: new_owner}}}
    refute new_owner == owner
  end

  test "begin requires a fresh checkpoint from the paused primary display", c do
    ref = push(c.remote, "transport:play", envelope(1))
    assert_reply ref, :ok, %{}
    ref = push(c.remote, "script:begin_edit", envelope(2))
    assert_reply ref, :error, %{reason: :pause_required}
    ref = push(c.remote, "transport:pause", envelope(3))
    assert_reply ref, :ok, %{}
    ref = push(c.remote, "script:begin_edit", envelope(4))
    assert_reply ref, :error, %{reason: :reading_unavailable}
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
      "command_id" => "quick-edit-client:#{sequence}"
    }
end
