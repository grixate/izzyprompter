defmodule TeleprompterWeb.AccountChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  alias Teleprompter.{Accounts, Repo}
  alias TeleprompterWeb.{AccountSocket, AccountChannel}
  @endpoint TeleprompterWeb.Endpoint
  @moduletag :database

  setup do
    owner = Ecto.Adapters.SQL.Sandbox.start_owner!(Repo, shared: true)
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(owner) end)
    user = Repo.insert!(%Accounts.User{email: Ecto.UUID.generate() <> "@example.com"})
    raw = Accounts.issue_token(user.id, "session", 3600)
    ticket = Phoenix.Token.sign(@endpoint, "account_channel", raw)
    %{user: user, raw: raw, ticket: ticket}
  end

  test "tickets bind to a live browser session and one exact account topic", %{
    user: user,
    ticket: ticket
  } do
    assert :error = connect(AccountSocket, %{"ticket" => "forged"})
    assert {:ok, socket} = connect(AccountSocket, %{"ticket" => ticket})

    assert {:error, %{reason: :unauthorized}} =
             subscribe_and_join(socket, AccountChannel, "account:#{Ecto.UUID.generate()}", %{})

    assert {:ok, _, _joined} =
             subscribe_and_join(socket, AccountChannel, "account:#{user.id}", %{})

    Accounts.notify(user.id, %{type: "library_changed"})
    assert_push "updated", %{type: "library_changed"}
    Accounts.notify(Ecto.UUID.generate(), %{type: "private-other-account"})
    refute_push "updated", %{type: "private-other-account"}, 50
  end

  test "revocation closes an existing channel and prevents replaying its ticket", %{
    user: user,
    raw: raw,
    ticket: ticket
  } do
    {:ok, socket} = connect(AccountSocket, %{"ticket" => ticket})
    {:ok, _, joined} = subscribe_and_join(socket, AccountChannel, "account:#{user.id}", %{})
    monitor = Process.monitor(joined.channel_pid)
    Accounts.revoke(raw)
    assert_receive {:DOWN, ^monitor, :process, _, :normal}
    assert :error = connect(AccountSocket, %{"ticket" => ticket})
  end

  test "session expiry is checked before broadcasting account changes", %{
    user: user,
    raw: raw,
    ticket: ticket
  } do
    {:ok, socket} = connect(AccountSocket, %{"ticket" => ticket})
    {:ok, _, joined} = subscribe_and_join(socket, AccountChannel, "account:#{user.id}", %{})
    monitor = Process.monitor(joined.channel_pid)
    token = Repo.get!(Accounts.Token, Accounts.hash(raw))

    Repo.update!(
      Ecto.Changeset.change(token, expires_at: DateTime.add(DateTime.utc_now(), -1, :second))
    )

    Accounts.notify(user.id, %{type: "private-after-expiry"})
    assert_receive {:DOWN, ^monitor, :process, _, :normal}
    refute_push "updated", %{type: "private-after-expiry"}, 50
  end

  test "expired channel ticket cannot connect even with a valid session", %{raw: raw} do
    ticket =
      Phoenix.Token.sign(@endpoint, "account_channel", raw,
        signed_at: System.system_time(:second) - 120
      )

    assert :error = connect(AccountSocket, %{"ticket" => ticket})
  end
end
