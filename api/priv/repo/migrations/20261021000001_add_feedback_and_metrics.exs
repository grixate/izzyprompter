defmodule Teleprompter.Repo.Migrations.AddFeedbackAndMetrics do
  use Ecto.Migration

  def change do
    create table(:feedback, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false)
      add(:request_id, :uuid, null: false)
      add(:category, :text, null: false)
      add(:message, :text, null: false)
      add(:rating, :integer)
      add(:status, :text, null: false, default: "open")
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:feedback, [:user_id, :request_id]))
    create(index(:feedback, [:inserted_at]))

    create table(:product_metrics, primary_key: false) do
      add(:day, :date, primary_key: true)
      add(:event, :text, primary_key: true)
      add(:count, :bigint, null: false)
    end
  end
end
