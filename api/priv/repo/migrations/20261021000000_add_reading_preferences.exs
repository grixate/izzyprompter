defmodule Teleprompter.Repo.Migrations.AddReadingPreferences do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add(:reading_preferences, :map)
      add(:preferences_revision, :bigint, null: false, default: 0)
    end
  end
end
