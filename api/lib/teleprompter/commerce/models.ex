defmodule Teleprompter.Commerce.Intent do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "purchase_intents" do
    field(:user_id, :binary_id)
    field(:product, :string, default: "lifetime_pro")
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Commerce.Attempt do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "checkout_attempts" do
    field(:intent_id, :binary_id)
    field(:provider, :string)
    field(:amount_minor, :integer)
    field(:currency, :string)
    field(:external_id, :string)
    field(:checkout_url, :string, redact: true)
    field(:status, :string, default: "creating")
    field(:environment, :string)
    field(:review_reason, :string)
    field(:offer_id, :string)
    field(:check_attempts, :integer, default: 0)
    field(:next_check_at, :utc_datetime_usec)
    field(:check_lease_until, :utc_datetime_usec)
    field(:check_error, :string)
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Commerce.Event do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "payment_events" do
    field(:provider, :string)
    field(:external_key, :string)
    field(:environment, :string)
    field(:payload, :map, redact: true)
    field(:status, :string, default: "pending")
    field(:review_reason, :string)
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Commerce.Grant do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "entitlement_grants" do
    field(:user_id, :binary_id)
    field(:attempt_id, :binary_id)
    field(:status, :string, default: "active")
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Commerce.Audit do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "commerce_audits" do
    field(:attempt_id, :binary_id)
    field(:actor, :string)
    field(:action, :string)
    field(:details, :map, default: %{}, redact: true)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end
end
