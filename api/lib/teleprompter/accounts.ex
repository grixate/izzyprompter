defmodule Teleprompter.Accounts do
  import Ecto.Query
  alias Teleprompter.{Repo, Mailer}
  alias Teleprompter.Accounts.{User, Identity, Token}

  def enabled?, do: Application.get_env(:teleprompter, :accounts_enabled, false)
  def origin, do: Application.fetch_env!(:teleprompter, :account_origin)
  def hash(token), do: :crypto.hash(:sha256, token)
  def random_token, do: Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

  def request_login(email) when is_binary(email) do
    email = email |> String.trim() |> String.downcase()

    if byte_size(email) <= 254 and String.valid?(email) and not String.contains?(email, <<0>>) and
         Regex.match?(~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/, email) do
      result =
        Repo.transaction(fn ->
          now = DateTime.utc_now()

          Repo.insert_all(
            User,
            [%{id: Ecto.UUID.generate(), email: email, inserted_at: now, updated_at: now}],
            on_conflict: :nothing
          )

          user = Repo.one!(from(u in User, where: u.email == ^email, lock: "FOR UPDATE"))
          # A bounded per-account delivery budget; responses never expose account existence.
          recent = DateTime.add(now, -60, :second)

          if Repo.exists?(
               from(t in Token,
                 where: t.user_id == ^user.id and t.kind == "login" and t.inserted_at > ^recent
               )
             ),
             do: Repo.rollback(:rate_limited)

          token = issue_token(user.id, "login", 15 * 60)
          {user, token}
        end)

      case result do
        {:ok, {user, token}} ->
          url = origin() <> "/account/login#token=" <> token

          email =
            Swoosh.Email.new()
            |> Swoosh.Email.to(user.email)
            |> Swoosh.Email.from({"IZZY", Application.fetch_env!(:teleprompter, :mail_from)})
            |> Swoosh.Email.subject("Your IZZY sign-in link")
            |> Swoosh.Email.text_body(
              "Sign in to IZZY: #{url}\n\nThis link expires in 15 minutes and can be used once. If you did not request it, ignore this email."
            )

          case Mailer.deliver(email) do
            {:ok, _} ->
              :ok

            {:error, _} ->
              Repo.delete_all(from(t in Token, where: t.hash == ^hash(token)))
              {:error, :mail_unavailable}
          end

        {:error, :rate_limited} ->
          :ok
      end
    else
      {:error, :invalid_email}
    end
  end

  def request_login(_), do: {:error, :invalid_email}

  # GET never consumes a login link: email scanners cannot sign a customer in.
  def consume_login(raw) when is_binary(raw) and byte_size(raw) == 43 do
    Repo.transaction(fn ->
      token =
        Repo.one(
          from(t in Token,
            where:
              t.hash == ^hash(raw) and t.kind == "login" and t.expires_at > ^DateTime.utc_now(),
            lock: "FOR UPDATE"
          )
        )

      if is_nil(token), do: Repo.rollback(:invalid_token)
      Repo.delete!(token)
      user = Repo.get!(User, token.user_id)
      now = DateTime.utc_now()

      Repo.insert_all(
        Identity,
        [
          %{
            id: Ecto.UUID.generate(),
            user_id: user.id,
            provider: "email",
            subject: user.email,
            inserted_at: now,
            updated_at: now
          }
        ],
        on_conflict: :nothing
      )

      {user, issue_token(user.id, "session", 30 * 24 * 60 * 60)}
    end)
  end

  def consume_login(_), do: {:error, :invalid_token}

  def issue_token(user_id, kind, seconds) do
    raw = random_token()

    Repo.insert!(%Token{
      hash: hash(raw),
      user_id: user_id,
      kind: kind,
      expires_at: DateTime.add(DateTime.utc_now(), seconds, :second)
    })

    raw
  end

  def user_for_session(raw) when is_binary(raw) and byte_size(raw) == 43 do
    if enabled?(),
      do:
        Repo.one(
          from(u in User,
            join: t in Token,
            on: t.user_id == u.id,
            where:
              t.hash == ^hash(raw) and t.kind == "session" and t.expires_at > ^DateTime.utc_now()
          )
        ),
      else: nil
  end

  def user_for_session(_), do: nil

  def revoke(raw) when is_binary(raw) do
    Repo.delete_all(from(t in Token, where: t.hash == ^hash(raw) and t.kind == "session"))

    Phoenix.PubSub.broadcast(
      Teleprompter.PubSub,
      "account_session:" <> Base.encode16(hash(raw)),
      :revoked
    )

    :ok
  end

  def revoke(_), do: :ok

  # Do not automatically merge by email. Existing email owners must sign in
  # first, then explicitly link Google from their authenticated account.
  def google_identity(
        %{"sub" => subject, "email" => email, "email_verified" => true},
        current_user
      )
      when is_binary(subject) and byte_size(subject) in 1..255 and is_binary(email) and
             byte_size(email) in 3..254 do
    Repo.transaction(fn ->
      identity = Repo.get_by(Identity, provider: "google", subject: subject)

      cond do
        identity && current_user && identity.user_id != current_user.id ->
          Repo.rollback(:identity_in_use)

        identity ->
          Repo.get!(User, identity.user_id)

        current_user ->
          insert_google_identity!(current_user.id, subject)
          current_user

        true ->
          normalized = email |> String.trim() |> String.downcase()
          if Repo.get_by(User, email: normalized), do: Repo.rollback(:sign_in_to_link)
          id = Ecto.UUID.generate()
          now = DateTime.utc_now()

          {created, _} =
            Repo.insert_all(
              User,
              [%{id: id, email: normalized, inserted_at: now, updated_at: now}],
              on_conflict: :nothing
            )

          if created != 1, do: Repo.rollback(:sign_in_to_link)
          user = Repo.get!(User, id)
          insert_google_identity!(user.id, subject)
          user
      end
    end)
  end

  def google_identity(_, _), do: {:error, :unverified_identity}

  defp insert_google_identity!(user_id, subject) do
    now = DateTime.utc_now()

    Repo.insert_all(
      Identity,
      [
        %{
          id: Ecto.UUID.generate(),
          user_id: user_id,
          provider: "google",
          subject: subject,
          inserted_at: now,
          updated_at: now
        }
      ],
      on_conflict: :nothing
    )

    # Another browser may link the same Google subject concurrently. Only the
    # winning account owns it; a uniqueness race must not silently link both.
    identity = Repo.get_by!(Identity, provider: "google", subject: subject)
    if identity.user_id != user_id, do: Repo.rollback(:identity_in_use)
  end

  def notify(user_id, message),
    do:
      Phoenix.PubSub.broadcast(
        Teleprompter.PubSub,
        "account:" <> user_id,
        {:account_update, message}
      )
end
