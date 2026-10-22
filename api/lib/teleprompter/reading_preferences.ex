defmodule Teleprompter.ReadingPreferences do
  @moduledoc "Last reading settings, separate from paid named profiles. Writes use optimistic locking."
  import Ecto.Query
  alias Teleprompter.{Repo, PromptSettings}
  alias Teleprompter.Accounts.User

  def get(nil), do: %{settings: nil, revision: 0, status: "device"}

  def get(user) do
    case Repo.get(User, user.id) do
      nil ->
        %{settings: nil, revision: 0, status: "unavailable"}

      row ->
        %{
          settings: row.reading_preferences,
          revision: row.preferences_revision,
          status: if(row.reading_preferences, do: "saved", else: "ready")
        }
    end
  rescue
    _ -> %{settings: nil, revision: 0, status: "unavailable"}
  end

  def save(user, settings, revision) when is_integer(revision) and revision >= 0 do
    with {:ok, settings} <- PromptSettings.validate(settings) do
      case Repo.update_all(
             from(u in User, where: u.id == ^user.id and u.preferences_revision == ^revision),
             set: [reading_preferences: settings],
             inc: [preferences_revision: 1]
           ) do
        {1, _} -> {:ok, revision + 1}
        _ -> {:error, :preferences_conflict}
      end
    end
  rescue
    _ -> {:error, :database_unavailable}
  end
end
