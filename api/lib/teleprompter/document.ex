defmodule Teleprompter.Document do
  @moduledoc "Canonical plain-text paragraphs with server-owned session identity."

  def valid_content?(content, allow_empty \\ false)

  def valid_content?(content, allow_empty)
      when is_binary(content) and byte_size(content) <= 2 * 1024 * 1024 do
    if String.valid?(content) and not String.contains?(content, <<0>>) do
      # Bound splitting too: do not allocate hundreds of thousands of blocks
      # merely to discover that a short-paragraph script exceeds the budget.
      paragraphs = content |> normalize() |> String.split("\n\n", trim: true, parts: 5001)
      length(paragraphs) <= 5000 and (allow_empty or paragraphs != [])
    else
      false
    end
  end

  def valid_content?(_, _), do: false

  def build(content, session_id) do
    paragraphs = content |> normalize() |> String.split("\n\n", trim: true)

    blocks =
      Enum.map(paragraphs, fn text ->
        %{
          id: "p_" <> Base.url_encode64(:crypto.strong_rand_bytes(12), padding: false),
          type: "paragraph",
          text: text
        }
      end)

    %{schemaVersion: 1, id: "session_#{session_id}", title: "Untitled script", blocks: blocks}
  end

  def text(document), do: Enum.map_join(document.blocks, "\n\n", & &1.text)

  def replace(document, content, anchor) do
    old_blocks = List.to_tuple(document.blocks)
    fresh = build(content, document.id).blocks

    fresh =
      if fresh == [], do: [%{hd(build("empty", document.id).blocks) | text: ""}], else: fresh

    exact = Enum.group_by(document.blocks, & &1.text)

    {matched, _, reserved} =
      Enum.reduce(fresh, {[], exact, MapSet.new()}, fn block, {result, available, used} ->
        case Map.get(available, block.text, []) do
          [old | rest] ->
            {[{block, old.id} | result], Map.put(available, block.text, rest),
             MapSet.put(used, old.id)}

          [] ->
            {[{block, nil} | result], available, used}
        end
      end)

    {blocks, _} =
      matched
      |> Enum.reverse()
      |> Enum.with_index()
      |> Enum.map_reduce(reserved, fn {{block, exact_id}, index}, used ->
        old = if index < tuple_size(old_blocks), do: elem(old_blocks, index)
        id = exact_id || if(old && not MapSet.member?(used, old.id), do: old.id, else: block.id)
        {%{block | id: id}, MapSet.put(used, id)}
      end)

    old_index = Enum.find_index(document.blocks, &(&1.id == anchor["blockId"])) || 0
    old = Enum.at(document.blocks, old_index)
    target = Enum.find(blocks, &(&1.id == anchor["blockId"]))

    target_anchor =
      if target && old do
        %{
          "blockId" => target.id,
          "characterOffset" => remap_offset(old.text, target.text, anchor["characterOffset"])
        }
      else
        %{
          "blockId" => Enum.at(blocks, min(old_index, length(blocks) - 1)).id,
          "characterOffset" => 0
        }
      end

    {%{document | blocks: blocks}, target_anchor}
  end

  def patch(document, block_id, text, anchor) do
    old = Enum.find(document.blocks, &(&1.id == block_id))
    blocks = Enum.map(document.blocks, &if(&1.id == block_id, do: %{&1 | text: text}, else: &1))

    offset =
      if anchor["blockId"] == block_id,
        do: remap_offset(old.text, text, anchor["characterOffset"]),
        else: anchor["characterOffset"]

    {%{document | blocks: blocks}, %{anchor | "characterOffset" => offset}}
  end

  # Preserve the same suffix/word after edits before the reading line. Offsets
  # are DOM UTF-16 units, not UTF-8 bytes or Elixir grapheme indices.
  def remap_offset(old, new, offset) do
    a = utf16_units(old)
    b = utf16_units(new)
    prefix = common_length(a, b)
    suffix = common_length(Enum.reverse(Enum.drop(a, prefix)), Enum.reverse(Enum.drop(b, prefix)))
    old_end = length(a) - suffix
    new_end = length(b) - suffix

    cond do
      offset == prefix and old_end == prefix -> new_end
      offset <= prefix -> min(offset, length(b))
      offset >= old_end -> max(0, min(length(b), offset + length(b) - length(a)))
      true -> min(offset, new_end)
    end
  end

  defp utf16_units(text),
    do:
      for(<<unit::little-16 <- :unicode.characters_to_binary(text, :utf8, {:utf16, :little})>>,
        do: unit
      )

  defp common_length(a, b), do: common_length(a, b, 0)

  defp common_length([a | rest_a], [a | rest_b], count),
    do: common_length(rest_a, rest_b, count + 1)

  defp common_length(_, _, count), do: count

  def lengths(document),
    do:
      Map.new(
        document.blocks,
        &{&1.id,
         div(byte_size(:unicode.characters_to_binary(&1.text, :utf8, {:utf16, :little})), 2)}
      )

  def valid_anchor?(%{"blockId" => id, "characterOffset" => offset}, lengths)
      when is_binary(id) and is_integer(offset) and offset >= 0 do
    case Map.fetch(lengths, id) do
      {:ok, length} -> offset <= length
      :error -> false
    end
  end

  def valid_anchor?(_, _), do: false

  # Mirrors the client's plain-text normalization; no HTML is interpreted.
  def normalize(content) do
    content
    |> String.normalize(:nfc)
    |> String.replace(~r/\r\n?/, "\n")
    |> String.replace("\u2028", "\n")
    |> String.replace("\u2029", "\n\n")
    |> String.replace(~r/[\x{200B}-\x{200D}\x{2060}\x{FEFF}\x{FFFC}]/u, "")
    |> String.replace(
      ~r/[\t\x{00A0}\x{1680}\x{180E}\x{2000}-\x{200A}\x{202F}\x{205F}\x{3000}]+/u,
      " "
    )
    |> String.replace(~r/^ +| +$/m, "")
    |> String.replace(~r/\n[ \t]*\n(?:[ \t]*\n)+/, "\n\n")
    |> String.trim()
  end
end
