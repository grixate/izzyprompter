defmodule Teleprompter.Library do
  import Ecto.Query
  alias Teleprompter.{Repo, Accounts, Document, Commerce, PromptSettings}
  alias Teleprompter.Accounts.User
  alias Teleprompter.Library.{Script, Mutation, Preset}

  def list(user, search \\ "", trash \\ false, page \\ 0) do
    list_query(user, search, trash, page) |> Repo.all() |> Enum.map(&serialize/1)
  end

  # A library page must not load thirty full, potentially 2 MB documents into
  # either the API process or the phone just to display short card excerpts.
  def list_summaries(user, search \\ "", trash \\ false, page \\ 0) do
    from(s in list_query(user, search, trash, page),
      select: %{
        id: s.id,
        title: s.title,
        revision: s.revision,
        deleted_at: s.deleted_at,
        updated_at: s.updated_at,
        excerpt: fragment("left(?->'blocks'->0->>'text', 110)", s.document)
      }
    )
    |> Repo.all()
  end

  defp list_query(user, search, trash, page) do
    cutoff = DateTime.add(DateTime.utc_now(), -30 * 24 * 60 * 60, :second)
    query = from(s in Script, where: s.user_id == ^user.id)

    query =
      if trash,
        do: from(s in query, where: not is_nil(s.deleted_at) and s.deleted_at > ^cutoff),
        else: from(s in query, where: is_nil(s.deleted_at))

    query =
      if search == "",
        do: query,
        else:
          from(s in query,
            where:
              ilike(s.title, ^"%#{search}%") or
                ilike(fragment("?::text", s.document), ^"%#{search}%")
          )

    from(s in query, order_by: [desc: s.updated_at, asc: s.id], limit: 30, offset: ^(page * 30))
  end

  def get(user, id) do
    if valid_id?(id),
      do:
        Repo.one(
          from(s in Script, where: s.id == ^id and s.user_id == ^user.id and is_nil(s.deleted_at))
        ),
      else: nil
  end

  def create(user, params) do
    with {:ok, title, document} <- prepare(params) do
      transact(user, fn ->
        check_limit!(user)
        Repo.insert!(%Script{user_id: user.id, title: title, document: document}) |> serialize()
      end)
    end
  end

  def duplicate(user, id) do
    case get(user, id) do
      nil ->
        {:error, :not_found}

      script ->
        create(user, %{
          "title" => String.slice(script.title <> " — copy", 0, 200),
          "content" => document_text(script.document)
        })
    end
  end

  def update(user, id, params) do
    if valid_id?(id) do
      Teleprompter.SavedSessions.lock(id, fn ->
        case Teleprompter.SavedSessions.lookup(id) do
          {:ok, session_id} -> Teleprompter.SavedSessions.update(session_id, user, params)
          :none -> commit(user, id, params)
        end
      end)
    else
      {:error, :not_found}
    end
  end

  # The live coordinator calls this too; all writes use one row lock and CAS.
  def commit(user, id, params) do
    with {:ok, title, document} <- prepare(params),
         revision when is_integer(revision) and revision > 0 <- params["expected_revision"],
         mutation when is_binary(mutation) and byte_size(mutation) in 8..128 <-
           params["mutation_id"] do
      fingerprint =
        :crypto.hash(
          :sha256,
          :erlang.term_to_binary({revision, title, params["document"] || params["content"]})
        )

      transact(user, fn ->
        script =
          Repo.one(
            from(s in Script,
              where: s.id == ^id and s.user_id == ^user.id and is_nil(s.deleted_at),
              lock: "FOR UPDATE"
            )
          )

        if is_nil(script), do: Repo.rollback(:not_found)
        receipt = Repo.get_by(Mutation, script_id: id, mutation_id: mutation)

        cond do
          receipt && receipt.fingerprint == fingerprint ->
            result = atom_result(receipt.result)

            if script.revision > result.revision,
              do: Map.put(result, :superseded_by, serialize(script)),
              else: result

          receipt ->
            Repo.rollback(:mutation_reused)

          script.revision != revision ->
            Repo.rollback({:conflict, serialize(script)})

          true ->
            # Reuse paragraph identity for unchanged/edited paragraphs at the
            # same index. Quick Edit supplies its exact canonical document.
            canonical =
              if params["document"], do: document, else: preserve_ids(script.document, document)

            saved =
              script
              |> Ecto.Changeset.change(title: title, document: canonical, revision: revision + 1)
              |> Repo.update!()
              |> serialize()

            Repo.insert!(%Mutation{
              script_id: id,
              mutation_id: mutation,
              fingerprint: fingerprint,
              result: saved
            })

            saved
        end
      end)
    else
      {:error, _} = error -> error
      _ -> {:error, :invalid_revision_or_mutation}
    end
  end

  def trash(user, id), do: change_trash(user, id, true)
  def restore(user, id), do: change_trash(user, id, false)

  defp change_trash(user, id, deleted?) do
    if valid_id?(id) do
      Teleprompter.SavedSessions.lock(id, fn ->
        transact(user, fn ->
          if Teleprompter.SavedSessions.lookup(id) != :none, do: Repo.rollback(:session_active)

          script =
            Repo.one(
              from(s in Script, where: s.id == ^id and s.user_id == ^user.id, lock: "FOR UPDATE")
            )

          if is_nil(script), do: Repo.rollback(:not_found)
          cutoff = DateTime.add(DateTime.utc_now(), -30 * 24 * 60 * 60, :second)

          if script.deleted_at && DateTime.compare(script.deleted_at, cutoff) != :gt,
            do: Repo.rollback(:not_found)

          if not deleted? and script.deleted_at, do: check_limit!(user)

          script
          |> Ecto.Changeset.change(deleted_at: if(deleted?, do: DateTime.utc_now(), else: nil))
          |> Repo.update!()
          |> serialize()
        end)
      end)
    else
      {:error, :not_found}
    end
  end

  def presets(user),
    do:
      Repo.all(
        from(p in Preset,
          where: p.user_id == ^user.id,
          order_by: [desc: p.is_default, asc: p.name]
        )
      )
      |> Enum.map(&serialize_preset/1)

  def save_preset(user, id, params) do
    with {:ok, settings} <- PromptSettings.validate(params["settings"]),
         true <- valid_title?(params["name"]),
         true <- is_boolean(params["is_default"]) do
      transact(user, fn ->
        if not Commerce.pro?(user), do: Repo.rollback(:pro_required)

        preset =
          if is_nil(id),
            do: %Preset{user_id: user.id},
            else: if(valid_id?(id), do: Repo.get_by(Preset, id: id, user_id: user.id))

        if is_nil(preset), do: Repo.rollback(:not_found)

        if params["is_default"],
          do:
            Repo.update_all(from(p in Preset, where: p.user_id == ^user.id),
              set: [is_default: false]
            )

        preset
        |> Ecto.Changeset.change(
          name: String.trim(params["name"]),
          settings: settings,
          is_default: params["is_default"]
        )
        |> Repo.insert_or_update!()
        |> serialize_preset()
      end)
    else
      _ -> {:error, :invalid_preset}
    end
  end

  def delete_preset(user, id) do
    transact(user, fn ->
      if not valid_id?(id), do: Repo.rollback(:not_found)

      case Repo.get_by(Preset, id: id, user_id: user.id) do
        nil ->
          Repo.rollback(:not_found)

        p ->
          Repo.delete!(p)
          %{id: id}
      end
    end)
  end

  def preset_settings(user, id) do
    cond do
      not Commerce.pro?(user) ->
        {:error, :pro_required}

      not valid_id?(id) ->
        {:error, :not_found}

      true ->
        case Repo.get_by(Preset, id: id, user_id: user.id) do
          nil -> {:error, :not_found}
          p -> {:ok, p.settings}
        end
    end
  end

  def serialize(s),
    do: %{
      id: s.id,
      title: s.title,
      document: s.document,
      revision: s.revision,
      deleted_at: s.deleted_at,
      updated_at: s.updated_at
    }

  defp atom_result(s),
    do: %{
      id: s["id"],
      title: s["title"],
      document: s["document"],
      revision: s["revision"],
      deleted_at: s["deleted_at"],
      updated_at: s["updated_at"]
    }

  defp serialize_preset(p),
    do: %{id: p.id, name: p.name, settings: p.settings, is_default: p.is_default}

  def valid_id?(id), do: match?({:ok, _}, Ecto.UUID.cast(id))
  def document_text(doc), do: Enum.map_join(doc["blocks"], "\n\n", & &1["text"])

  defp transact(user, fun) do
    result =
      Repo.transaction(fn ->
        Repo.one!(from(u in User, where: u.id == ^user.id, lock: "FOR UPDATE"))
        fun.()
      end)

    if match?({:ok, _}, result), do: Accounts.notify(user.id, %{type: "library_changed"})
    result
  rescue
    DBConnection.ConnectionError -> {:error, :database_unavailable}
    Postgrex.Error -> {:error, :database_unavailable}
    Ecto.ConstraintError -> {:error, :database_unavailable}
  end

  defp check_limit!(user) do
    if not Commerce.pro?(user) and
         Repo.aggregate(
           from(s in Script, where: s.user_id == ^user.id and is_nil(s.deleted_at)),
           :count
         ) >= 3,
       do: Repo.rollback(:script_limit)
  end

  defp valid_title?(s),
    do:
      is_binary(s) and String.valid?(s) and not String.contains?(s, <<0>>) and
        String.trim(s) != "" and String.length(s) <= 200

  defp prepare(%{"title" => title} = params) do
    content =
      if is_map(params["document"]),
        do: safe_document_text(params["document"]),
        else: params["content"]

    if valid_title?(title) and Document.valid_content?(content, true) do
      doc =
        if params["document"],
          do: params["document"],
          else: Document.build(content, "library") |> Jason.encode!() |> Jason.decode!()

      if valid_document?(doc),
        do: {:ok, String.trim(title), canonical_document(doc, title)},
        else: {:error, :invalid_document}
    else
      {:error, :invalid_script}
    end
  end

  defp prepare(_), do: {:error, :invalid_script}

  defp safe_document_text(%{"blocks" => blocks})
       when is_list(blocks) and length(blocks) <= 5000 do
    if Enum.all?(blocks, &(is_map(&1) and is_binary(&1["text"]))),
      do: Enum.map_join(blocks, "\n\n", & &1["text"])
  end

  defp safe_document_text(_), do: nil

  defp valid_document?(%{"schemaVersion" => 1, "id" => id, "blocks" => blocks})
       when is_binary(id) and byte_size(id) in 1..128 and is_list(blocks) do
    ids = Enum.map(blocks, & &1["id"])

    Enum.all?(
      blocks,
      &(is_binary(&1["id"]) and byte_size(&1["id"]) in 1..128 and &1["type"] == "paragraph" and
          is_binary(&1["text"]))
    ) and length(Enum.uniq(ids)) == length(ids)
  end

  defp valid_document?(_), do: false

  defp canonical_document(doc, title) do
    %{
      "schemaVersion" => 1,
      "id" => doc["id"],
      "title" => String.trim(title),
      "blocks" => Enum.map(doc["blocks"], &Map.take(&1, ["id", "type", "text"]))
    }
  end

  defp preserve_ids(old, new) do
    # Reserve exact matches first, so inserting a paragraph does not move the
    # identities (and reading position) of every paragraph after it.
    available = Enum.group_by(old["blocks"], & &1["text"])

    {matched, _} =
      Enum.map_reduce(new["blocks"], available, fn block, pool ->
        case Map.get(pool, block["text"], []) do
          [prior | rest] ->
            {Map.put(block, "id", prior["id"]), Map.put(pool, block["text"], rest)}

          [] ->
            {nil, pool}
        end
      end)

    used = matched |> Enum.reject(&is_nil/1) |> MapSet.new(& &1["id"])

    {blocks, _} =
      new["blocks"]
      |> Enum.with_index()
      |> Enum.map_reduce(used, fn {block, index}, reserved ->
        case Enum.at(matched, index) do
          nil ->
            prior = Enum.at(old["blocks"], index)

            if prior && not MapSet.member?(reserved, prior["id"]),
              do: {Map.put(block, "id", prior["id"]), MapSet.put(reserved, prior["id"])},
              else: {block, reserved}

          existing ->
            {existing, reserved}
        end
      end)

    %{new | "id" => old["id"], "blocks" => blocks}
  end
end
