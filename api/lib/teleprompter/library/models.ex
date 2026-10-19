defmodule Teleprompter.Library.Script do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "scripts" do
    field(:user_id, :binary_id)
    field(:folder_id, :binary_id)
    field(:title, :string, redact: true)
    field(:document, :map, redact: true)
    field(:revision, :integer, default: 1)
    field(:deleted_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Library.Mutation do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "script_mutations" do
    field(:script_id, :binary_id)
    field(:mutation_id, :string)
    field(:fingerprint, :binary)
    field(:result, :map, redact: true)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end
end

defmodule Teleprompter.Library.Preset do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "presets" do
    field(:user_id, :binary_id)
    field(:name, :string, redact: true)
    field(:settings, :map)
    field(:is_default, :boolean, default: false)
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Library.ProjectFolder do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "project_folders" do
    field(:user_id, :binary_id)
    field(:name, :string, redact: true)
    timestamps(type: :utc_datetime_usec)
  end
end
