defmodule Teleprompter.Release do
  @moduledoc "Explicit release migrations. Never migrate automatically during application startup."
  def migrate do
    Application.load(:teleprompter)

    {:ok, _, _} =
      Ecto.Migrator.with_repo(Teleprompter.Repo, &Ecto.Migrator.run(&1, :up, all: true))

    :ok
  end
end
