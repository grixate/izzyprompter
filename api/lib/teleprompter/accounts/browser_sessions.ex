defmodule Teleprompter.Accounts.BrowserSessions do
  @moduledoc "Revocable account sign-ins. Browser names are coarse labels, never identity or authorization."
  import Ecto.Query
  alias Teleprompter.{Accounts, Repo}
  alias Teleprompter.Accounts.{Token, User}
  @cookie_renew_after 86400
  @touch_after 15 * 60
  @compatibility_lifetime 100 * 365 * 86400

  def cookie_renew_after, do: @cookie_renew_after

  def issue(user_id, user_agent \\ nil) do
    raw = Accounts.random_token()
    now = DateTime.utc_now()

    Repo.insert!(%Token{
      hash: Accounts.hash(raw),
      user_id: user_id,
      kind: "session",
      persistent: true,
      session_id: Ecto.UUID.generate(),
      device_label: device_label(user_agent),
      last_seen_at: now,
      expires_at: DateTime.add(now, @compatibility_lifetime, :second)
    })

    raw
  end

  def user(raw) do
    case lookup(raw) do
      {user, _token} -> user
      nil -> nil
    end
  end

  def authenticate(raw, user_agent) do
    case lookup(raw) do
      {user, token} ->
        now = DateTime.utc_now()
        cutoff = DateTime.add(now, -@touch_after, :second)

        if !token.persistent || is_nil(token.session_id) || is_nil(token.device_label) ||
             is_nil(token.last_seen_at) || DateTime.compare(token.last_seen_at, cutoff) != :gt do
          # SQL coalescing keeps the public session ID stable if legacy requests
          # arrive together. Updating a deleted/revoked row never recreates it.
          query =
            from(t in valid_tokens(now),
              where: t.hash == ^token.hash,
              update: [
                set: [
                  persistent: true,
                  session_id: fragment("COALESCE(?, gen_random_uuid())", t.session_id),
                  device_label:
                    fragment("COALESCE(?, ?)", t.device_label, ^device_label(user_agent)),
                  last_seen_at: ^now,
                  expires_at: ^DateTime.add(now, @compatibility_lifetime, :second)
                ]
              ],
              select: t
            )

          case Repo.update_all(query, []) do
            {1, [updated]} -> {user, updated}
            _ -> nil
          end
        else
          {user, token}
        end

      nil ->
        nil
    end
  end

  defp lookup(raw) when is_binary(raw) and byte_size(raw) == 43 do
    if Accounts.enabled?() do
      now = DateTime.utc_now()

      Repo.one(
        from(t in valid_tokens(now),
          join: u in User,
          on: u.id == t.user_id,
          where: t.hash == ^Accounts.hash(raw),
          select: {u, t}
        )
      )
    end
  end

  defp lookup(_), do: nil

  defp valid_tokens(now),
    do:
      from(t in Token,
        where: t.kind == "session" and (t.persistent or t.expires_at > ^now)
      )

  def list(user, raw) do
    current = Accounts.hash(raw)

    Repo.update_all(
      from(t in valid_tokens(DateTime.utc_now()),
        where: t.user_id == ^user.id and is_nil(t.session_id),
        update: [set: [session_id: fragment("gen_random_uuid()")]]
      ),
      []
    )

    Repo.all(
      from(t in valid_tokens(DateTime.utc_now()),
        where: t.user_id == ^user.id,
        order_by: [desc_nulls_last: t.last_seen_at, desc: t.inserted_at]
      )
    )
    |> Enum.map(fn token ->
      %{
        id: token.session_id,
        device: token.device_label || "Previously signed-in browser",
        signed_in_at: token.inserted_at,
        last_seen_at: token.last_seen_at,
        current: token.hash == current
      }
    end)
    |> Enum.sort_by(&(!&1.current))
  end

  def revoke_device(user, id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} ->
        deleted =
          Repo.delete_all(
            from(t in Token,
              where: t.user_id == ^user.id and t.kind == "session" and t.session_id == ^uuid,
              select: t.hash
            )
          )

        case deleted do
          {1, [hash]} ->
            notify_revoked(user.id, [hash])
            {:ok, hash}

          _ ->
            {:error, :not_found}
        end

      :error ->
        {:error, :not_found}
    end
  end

  def revoke_others(user, raw) do
    current = Accounts.hash(raw)

    {count, hashes} =
      Repo.delete_all(
        from(t in Token,
          where: t.user_id == ^user.id and t.kind == "session" and t.hash != ^current,
          select: t.hash
        )
      )

    notify_revoked(user.id, hashes)
    count
  end

  def revoke_raw(raw) when is_binary(raw) do
    case Repo.delete_all(
           from(t in Token,
             where: t.hash == ^Accounts.hash(raw) and t.kind == "session",
             select: {t.user_id, t.hash}
           )
         ) do
      {1, [{user_id, hash}]} -> notify_revoked(user_id, [hash])
      _ -> :ok
    end

    :ok
  end

  def revoke_raw(_), do: :ok

  defp notify_revoked(user_id, hashes) do
    for hash <- hashes,
        do:
          Phoenix.PubSub.broadcast(
            Teleprompter.PubSub,
            "account_session:" <> Base.encode16(hash),
            :revoked
          )

    if hashes != [], do: Accounts.notify(user_id, %{type: "sessions_changed"})
    :ok
  end

  def device_label(agent) do
    agent = if is_binary(agent), do: String.slice(agent, 0, 512), else: ""

    browser =
      cond do
        String.contains?(agent, ["Edg/", "EdgiOS/", "EdgA/"]) -> "Edge"
        String.contains?(agent, ["Firefox/", "FxiOS/"]) -> "Firefox"
        String.contains?(agent, "SamsungBrowser/") -> "Samsung Internet"
        String.contains?(agent, ["Chrome/", "CriOS/"]) -> "Chrome"
        String.contains?(agent, "Safari/") -> "Safari"
        true -> "Browser"
      end

    system =
      cond do
        String.contains?(agent, "iPad") ||
            (String.contains?(agent, "Macintosh") && String.contains?(agent, "Mobile/")) ->
          "iPad"

        String.contains?(agent, "iPhone") ->
          "iPhone"

        String.contains?(agent, "Android") ->
          "Android"

        String.contains?(agent, "Windows") ->
          "Windows"

        String.contains?(agent, "CrOS") ->
          "ChromeOS"

        String.contains?(agent, ["Macintosh", "Mac OS X"]) ->
          "Mac"

        String.contains?(agent, "Linux") ->
          "Linux"

        true ->
          nil
      end

    if system, do: browser <> " · " <> system, else: browser
  end
end
