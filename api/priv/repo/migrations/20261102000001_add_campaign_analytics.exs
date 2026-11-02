defmodule Teleprompter.Repo.Migrations.AddCampaignAnalytics do
  use Ecto.Migration

  def change do
    create table(:campaign_metrics, primary_key: false) do
      add(:day, :date, primary_key: true)
      add(:source, :text, primary_key: true)
      add(:medium, :text, primary_key: true)
      add(:campaign, :text, primary_key: true)
      add(:content, :text, primary_key: true)
      add(:entry, :text, primary_key: true)
      add(:event, :text, primary_key: true)
      add(:count, :bigint, null: false)
    end

    alter table(:checkout_attempts) do
      # Campaign labels only. No visitor identifier, address or URL.
      add(:acquisition, :map)
    end
  end
end
