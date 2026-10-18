defmodule Teleprompter.Repo.Migrations.AddProjectFolders do
  use Ecto.Migration

  def change do
    create table(:project_folders, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false)
      add(:name, :text, null: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(index(:project_folders, [:user_id]))

    alter table(:scripts) do
      add(:folder_id, references(:project_folders, type: :uuid, on_delete: :nilify_all))
    end

    create(index(:scripts, [:user_id, :folder_id, :deleted_at]))
  end
end
