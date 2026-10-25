defmodule Teleprompter.Maintenance do
  @moduledoc "Bounded retention cleanup; never touches active scripts or commerce records."
  import Ecto.Query
  alias Teleprompter.Repo

  def prune(now \\ DateTime.utc_now()) do
    cutoff = DateTime.add(now, -30 * 86400, :second)

    Repo.transaction(fn ->
      scripts =
        from(s in Teleprompter.Library.Script,
          where: not is_nil(s.deleted_at) and s.deleted_at <= ^cutoff,
          select: s.id,
          limit: 500
        )

      Repo.delete_all(from(s in Teleprompter.Library.Script, where: s.id in subquery(scripts)))

      receipts =
        from(m in Teleprompter.Library.Mutation,
          where: m.inserted_at < ^cutoff,
          select: m.id,
          limit: 500
        )

      Repo.delete_all(from(m in Teleprompter.Library.Mutation, where: m.id in subquery(receipts)))

      tokens =
        from(t in Teleprompter.Accounts.Token,
          where: not t.persistent and t.expires_at < ^now,
          select: t.hash,
          limit: 500
        )

      Repo.delete_all(from(t in Teleprompter.Accounts.Token, where: t.hash in subquery(tokens)))
    end)
  end
end
