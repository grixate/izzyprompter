defmodule Teleprompter.Repo.Migrations.CreateAccountsLibraryCommerce do
  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:email, :text, null: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:users, [:email]))

    create table(:identities, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false)
      add(:provider, :text, null: false)
      add(:subject, :text, null: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:identities, [:provider, :subject]))

    create table(:account_tokens, primary_key: false) do
      add(:hash, :binary, primary_key: true)
      add(:user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false)
      add(:kind, :text, null: false)
      add(:expires_at, :utc_datetime_usec, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(index(:account_tokens, [:expires_at]))

    create table(:scripts, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false)
      add(:title, :text, null: false)
      add(:document, :map, null: false)
      add(:revision, :bigint, null: false, default: 1)
      add(:deleted_at, :utc_datetime_usec)
      timestamps(type: :utc_datetime_usec)
    end

    create(index(:scripts, [:user_id, :deleted_at]))

    create table(:script_mutations, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:script_id, references(:scripts, type: :uuid, on_delete: :delete_all), null: false)
      add(:mutation_id, :text, null: false)
      add(:fingerprint, :binary, null: false)
      add(:result, :map, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(unique_index(:script_mutations, [:script_id, :mutation_id]))

    create table(:presets, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false)
      add(:name, :text, null: false)
      add(:settings, :map, null: false)
      add(:is_default, :boolean, null: false, default: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(
      unique_index(:presets, [:user_id], where: "is_default = true", name: :one_default_preset)
    )

    create table(:purchase_intents, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid), null: false)
      add(:product, :text, null: false, default: "lifetime_pro")
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:purchase_intents, [:user_id, :product]))

    create table(:checkout_attempts, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:intent_id, references(:purchase_intents, type: :uuid), null: false)
      add(:provider, :text, null: false)
      add(:amount_minor, :integer, null: false)
      add(:currency, :text, null: false)
      add(:external_id, :text)
      add(:checkout_url, :text)
      add(:status, :text, null: false, default: "creating")
      add(:environment, :text, null: false)
      add(:review_reason, :text)
      timestamps(type: :utc_datetime_usec)
    end

    create(
      unique_index(:checkout_attempts, [:provider, :external_id, :environment],
        where: "external_id IS NOT NULL"
      )
    )

    create(index(:checkout_attempts, [:intent_id]))

    create table(:payment_events, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:provider, :text, null: false)
      add(:external_key, :text, null: false)
      add(:environment, :text, null: false)
      add(:payload, :map, null: false)
      add(:status, :text, null: false, default: "pending")
      add(:review_reason, :text)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:payment_events, [:provider, :external_key, :environment]))

    create table(:entitlement_grants, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid), null: false)
      add(:attempt_id, references(:checkout_attempts, type: :uuid), null: false)
      add(:status, :text, null: false, default: "active")
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:entitlement_grants, [:attempt_id]))
    create(index(:entitlement_grants, [:user_id, :status]))

    create table(:commerce_audits, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:attempt_id, references(:checkout_attempts, type: :uuid))
      add(:actor, :text, null: false)
      add(:action, :text, null: false)
      add(:details, :map, null: false, default: %{})
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end
  end
end
