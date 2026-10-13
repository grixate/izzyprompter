defmodule TeleprompterWeb.SessionChannelTest do
  use ExUnit.Case, async: true
  import Phoenix.ChannelTest
  alias Teleprompter.Sessions
  alias TeleprompterWeb.{SessionChannel, UserSocket}
  @endpoint TeleprompterWeb.Endpoint

  setup do
    {:ok, session} = Sessions.create("Original script", 0.86)
    {:ok, socket} = connect(UserSocket, %{"client_id" => "test-client-123"})
    %{session: session, socket: socket}
  end

  test "requires the correct role capability and protocol", %{session: session, socket: socket} do
    assert {:error, %{reason: :unsupported_protocol}} =
             subscribe_and_join(socket, SessionChannel, "session:#{session.session_id}", %{
               "role" => "remote"
             })

    assert {:error, %{reason: :unauthorized}} =
             join_role(socket, session, "editor", session.tokens["remote"])

    assert {:ok, snapshot, _} = join_role(socket, session, "remote")
    assert snapshot.protocol_version == 2
    assert snapshot.presence["remote"] == 1
    assert snapshot.presence["editor"] == 0
  end

  test "remote and display cannot replace the script by spoofing payload roles", %{
    session: session,
    socket: socket
  } do
    for role <- ["remote", "display"] do
      {:ok, _, joined} = join_role(socket, session, role)

      ref =
        push(
          joined,
          "script:update",
          Map.merge(envelope(1), %{
            "content" => "Hijacked",
            "base_revision" => 1,
            "role" => "editor"
          })
        )

      assert_reply ref, :error, %{reason: :forbidden}
    end

    {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.script.content == "Original script"
    assert snapshot.script.revision == 1
  end

  test "duplicates and reordered commands cannot apply seek twice", %{
    session: session,
    socket: socket
  } do
    {:ok, _, joined} = join_role(socket, session, "remote")
    ref = push(joined, "transport:seek_delta", Map.put(envelope(1), "delta", 120))
    assert_reply ref, :ok, %{anchor_position: 120.0, revision: 1}
    ref = push(joined, "transport:seek_delta", Map.put(envelope(1), "delta", 120))
    assert_reply ref, :error, %{reason: :stale_command}
    ref = push(joined, "transport:seek_delta", Map.put(envelope(3), "delta", 120))
    assert_reply ref, :ok, %{anchor_position: 240.0, revision: 2}
    ref = push(joined, "transport:seek_delta", Map.put(envelope(2), "delta", 120))
    assert_reply ref, :error, %{reason: :stale_command}
  end

  test "editor patches require the current script revision", %{session: session, socket: socket} do
    {:ok, _, joined} = join_role(socket, session, "editor")

    ref =
      push(
        joined,
        "script:update",
        Map.merge(envelope(1), %{"content" => "First correction", "base_revision" => 1})
      )

    assert_reply ref, :ok, %{content: "First correction", revision: 2}

    ref =
      push(
        joined,
        "script:update",
        Map.merge(envelope(2), %{"content" => "Stale correction", "base_revision" => 1})
      )

    assert_reply ref, :error, %{reason: :invalid_or_stale_script}
    {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.script.content == "First correction"
  end

  test "a paused live channel proactively reports session loss without waiting for a command", %{
    session: session,
    socket: socket
  } do
    {:ok, _, joined} = join_role(socket, session, "remote")
    monitor = Process.monitor(joined.channel_pid)
    {:ok, pid} = Sessions.lookup(session.session_id)
    GenServer.stop(pid, :normal)
    assert_push "session:ended", %{reason: :session_unavailable}
    assert_receive {:DOWN, ^monitor, :process, _, :normal}
    assert {:error, :session_unavailable} = Sessions.lookup(session.session_id)
  end

  test "idle expiry notifies editor, display, and remote and never recreates the session", %{
    session: session,
    socket: socket
  } do
    monitors =
      for role <- ["editor", "display", "remote"] do
        {:ok, _, joined} = join_role(socket, session, role)
        Process.monitor(joined.channel_pid)
      end

    {:ok, pid} = Sessions.lookup(session.session_id)
    send(pid, :timeout)

    for monitor <- monitors do
      assert_push "session:ended", %{reason: :session_unavailable}
      assert_receive {:DOWN, ^monitor, :process, _, :normal}
    end

    assert {:error, :session_unavailable} = Sessions.snapshot(session.session_id)
  end

  defp join_role(socket, session, role, token \\ nil) do
    subscribe_and_join(socket, SessionChannel, "session:#{session.session_id}", %{
      "protocol_version" => 2,
      "role" => role,
      "token" => token || session.tokens[role]
    })
  end

  test "oversized control payload and malformed envelope do not mutate or end the session", %{
    session: session,
    socket: socket
  } do
    {:ok, _, joined} = join_role(socket, session, "remote")

    ref =
      push(joined, "transport:play", Map.put(envelope(1), "extra", String.duplicate("a", 4096)))

    assert_reply ref, :error, %{reason: :payload_too_large}
    ref = push(joined, "transport:play", %{})
    assert_reply ref, :error, %{reason: :invalid_command}
    assert {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.transport.revision == 0
    ref = push(joined, "transport:play", envelope(1))
    assert_reply ref, :ok, %{revision: 1}
  end

  test "channel burst refusal neither remembers commands nor requires reconnect", %{
    session: session,
    socket: socket
  } do
    {:ok, _, joined} = join_role(socket, session, "remote")

    :sys.replace_state(joined.channel_pid, fn state ->
      put_in(state.assigns.traffic, exhausted_messages(state.assigns.traffic))
    end)

    ref = push(joined, "transport:play", envelope(1))
    assert_reply ref, :error, %{reason: :rate_limited, retry_after_ms: retry}
    assert retry > 0
    assert {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.transport.revision == 0

    :sys.replace_state(joined.channel_pid, fn state ->
      put_in(state.assigns.traffic, Teleprompter.TrafficBudget.new(:channel))
    end)

    ref = push(joined, "transport:play", envelope(1))
    assert_reply ref, :ok, %{revision: 1}
  end

  test "session aggregate quota applies across separately budgeted channels", %{
    session: session,
    socket: socket
  } do
    {:ok, _, first} = join_role(socket, session, "remote")
    {:ok, second_socket} = connect(UserSocket, %{"client_id" => "second-client"})
    {:ok, _, second} = join_role(second_socket, session, "remote")
    {:ok, pid} = Sessions.lookup(session.session_id)
    :sys.replace_state(pid, fn state -> %{state | traffic: exhausted_messages(state.traffic)} end)

    for joined <- [first, second] do
      ref = push(joined, "transport:play", envelope(1))
      assert_reply ref, :error, %{reason: :rate_limited}
    end

    assert {:ok, snapshot} = Sessions.snapshot(session.session_id)
    assert snapshot.transport.revision == 0

    :sys.replace_state(pid, fn state ->
      %{state | traffic: Teleprompter.TrafficBudget.new(:session)}
    end)

    ref = push(first, "transport:play", envelope(1))
    assert_reply ref, :ok, %{revision: 1}
  end

  test "OTP status reports redact scripts and recent messages", %{session: session} do
    {:ok, pid} = Sessions.lookup(session.session_id)
    refute inspect(:sys.get_status(pid)) =~ "Original script"

    status =
      Teleprompter.Sessions.Session.format_status(%{
        state: "sensitive",
        message: "patch",
        reason: {"key", "secret"},
        log: ["history"]
      })

    assert Enum.all?(Map.values(status), &(&1 == :redacted))
  end

  defp envelope(sequence),
    do: %{
      "protocol_version" => 2,
      "sequence" => sequence,
      "command_id" => "test-client-123:#{sequence}"
    }

  defp exhausted_messages(budget) do
    budget |> put_in([:tokens, :messages], 0) |> put_in([:limits, :messages], {240, 0.001})
  end
end
