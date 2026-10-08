defmodule Teleprompter.SessionsTest do
  use ExUnit.Case, async: false

  alias Teleprompter.Sessions

  test "keeps authoritative transport anchors in an ephemeral session" do
    id = "TEST#{System.unique_integer([:positive])}"
    snapshot = Sessions.join(id, "display", "display-1")

    assert snapshot.transport.status == "paused"
    assert snapshot.presence["display"] == 1

    played = Sessions.command(id, :play)
    assert played.transport.status == "playing"

    sought = Sessions.command(id, {:seek_delta, 120})
    assert sought.transport.anchor_position >= 120
    assert sought.transport.revision == 2

    paused = Sessions.command(id, :pause)
    assert paused.transport.status == "paused"
    assert paused.transport.revision == 3
  end
end
