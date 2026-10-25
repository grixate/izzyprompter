defmodule Teleprompter.Repo.Migrations.AddPersistentBrowserSessions do
  use Ecto.Migration

  def up do
    alter table(:account_tokens) do
      add(:persistent, :boolean, null: false, default: false)
      add(:session_id, :uuid)
      add(:device_label, :string, size: 80)
      add(:last_seen_at, :utc_datetime_usec)
    end

    create(unique_index(:account_tokens, [:session_id], where: "session_id IS NOT NULL"))
    create(index(:account_tokens, [:user_id, :kind]))
    flush()

    # Keep currently valid credentials, never revive an expired login/session.
    # A distant compatibility date lets the previous image accept these tokens
    # during rollback; persistent=true is the new authority for no automatic expiry.
    # Ecto's utc_datetime_usec columns are UTC timestamps without a timezone.
    execute("""
    UPDATE account_tokens
    SET persistent = true, session_id = gen_random_uuid(),
        expires_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '100 years'
    WHERE kind = 'session' AND expires_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    """)
  end

  def down do
    drop(index(:account_tokens, [:user_id, :kind]))
    drop(index(:account_tokens, [:session_id], where: "session_id IS NOT NULL"))

    alter table(:account_tokens) do
      remove(:persistent)
      remove(:session_id)
      remove(:device_label)
      remove(:last_seen_at)
    end
  end
end
