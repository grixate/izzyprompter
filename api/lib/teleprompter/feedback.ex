defmodule Teleprompter.Feedback.Entry do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "feedback" do
    field(:user_id, :binary_id)
    field(:request_id, :binary_id)
    field(:category, :string)
    field(:message, :string, redact: true)
    field(:rating, :integer)
    field(:status, :string, default: "open")
    timestamps(type: :utc_datetime_usec)
  end
end

defmodule Teleprompter.Feedback do
  import Ecto.Query
  alias Teleprompter.{Repo, Metrics}
  alias Teleprompter.Accounts.User
  alias Teleprompter.Feedback.Entry

  def submit(user, params) do
    with {:ok, request_id} <- Ecto.UUID.cast(params["request_id"]),
         category when category in ["problem", "idea", "other"] <- params["category"],
         message when is_binary(message) <- params["message"],
         true <-
           String.valid?(message) and not String.contains?(message, <<0>>) and
             byte_size(message) <= 8000,
         message = String.trim(message),
         true <- String.length(message) in 10..2000,
         rating when is_nil(rating) or rating in 1..5 <- params["rating"] do
      result =
        Repo.transaction(fn ->
          Repo.one!(from(u in User, where: u.id == ^user.id, lock: "FOR UPDATE"))
          existing = Repo.get_by(Entry, user_id: user.id, request_id: request_id)

          cond do
            existing &&
                {existing.category, existing.message, existing.rating} ==
                  {category, message, rating} ->
              :duplicate

            existing ->
              Repo.rollback(:feedback_request_reused)

            true ->
              cutoff = DateTime.add(DateTime.utc_now(), -86400, :second)

              count =
                Repo.aggregate(
                  from(f in Entry, where: f.user_id == ^user.id and f.inserted_at > ^cutoff),
                  :count
                )

              if count >= 5, do: Repo.rollback(:feedback_limit)

              Repo.insert!(%Entry{
                user_id: user.id,
                request_id: request_id,
                category: category,
                message: message,
                rating: rating
              })

              :created
          end
        end)

      case result do
        {:ok, kind} ->
          if kind == :created, do: Metrics.record("feedback_received")
          {:ok, %{received: true}}

        error ->
          error
      end
    else
      _ -> {:error, :invalid_feedback}
    end
  rescue
    _ -> {:error, :database_unavailable}
  end

  # Operator-only console functions. No public inbox or endpoint exposes replies.
  def inbox(status \\ "open") when status in ["open", "resolved"] do
    Repo.all(
      from(f in Entry, where: f.status == ^status, order_by: [asc: f.inserted_at], limit: 100)
    )
  end

  def resolve(id) do
    with {:ok, id} <- Ecto.UUID.cast(id) do
      Repo.update_all(from(f in Entry, where: f.id == ^id),
        set: [status: "resolved", updated_at: DateTime.utc_now()]
      )
    end
  end

  def purge_expired do
    cutoff = DateTime.add(DateTime.utc_now(), -90 * 86400, :second)
    Repo.delete_all(from(f in Entry, where: f.inserted_at < ^cutoff))
  end
end
