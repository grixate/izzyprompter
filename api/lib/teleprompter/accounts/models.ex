defmodule Teleprompter.Accounts.User do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "users" do
    field(:email, :string, redact: true)
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Accounts.Identity do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "identities" do
    field(:user_id, :binary_id)
    field(:provider, :string)
    field(:subject, :string, redact: true)
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Accounts.Token do
  use Ecto.Schema
  @primary_key {:hash, :binary, autogenerate: false}
  @derive {Inspect, except: [:hash]}
  schema "account_tokens" do
    field(:user_id, :binary_id)
    field(:kind, :string)
    field(:expires_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end
end
