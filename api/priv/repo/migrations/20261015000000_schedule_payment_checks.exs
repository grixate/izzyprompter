defmodule Teleprompter.Repo.Migrations.SchedulePaymentChecks do
  use Ecto.Migration

  def up do
    alter table(:checkout_attempts) do
      add(:offer_id, :text)
      add(:check_attempts, :integer, null: false, default: 0)
      add(:next_check_at, :utc_datetime_usec)
      add(:check_lease_until, :utc_datetime_usec)
      add(:check_error, :text)
    end

    create(index(:checkout_attempts, [:next_check_at], where: "next_check_at IS NOT NULL"))

    # Existing known pending invoices can be recovered too. Never create an
    # invoice, change a grant, or infer an unknown invoice identity on upgrade.
    execute("""
    UPDATE checkout_attempts SET next_check_at = CURRENT_TIMESTAMP + INTERVAL '1 minute'
    WHERE provider = 'lava' AND environment = 'production'
      AND status IN ('pending', 'ambiguous') AND external_id IS NOT NULL
      AND review_reason IS NULL
    """)
  end

  def down do
    drop(index(:checkout_attempts, [:next_check_at]))

    alter table(:checkout_attempts) do
      remove(:offer_id)
      remove(:check_attempts)
      remove(:next_check_at)
      remove(:check_lease_until)
      remove(:check_error)
    end
  end
end
