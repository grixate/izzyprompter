defmodule Teleprompter.DocumentTest do
  use ExUnit.Case, async: true
  alias Teleprompter.Document

  test "script admission bounds paragraph amplification before generating identities" do
    assert Document.valid_content?(Enum.join(List.duplicate("a", 5000), "\n\n"))
    refute Document.valid_content?(Enum.join(List.duplicate("a", 5001), "\n\n"))
    refute Document.valid_content?("\u200B\uFEFF")
    refute Document.valid_content?(String.duplicate("a", 2 * 1024 * 1024 + 1))
    refute Document.valid_content?(<<255>>)
    assert Document.valid_content?("", true)
  end

  test "normalizes Unicode input without interpreting HTML and preserves paragraph boundaries" do
    document =
      Document.build(
        "\uFEFF  Первый\u00A0абзац 🎥 \r\n\r\n\r\nSecond\u2028line\u2029 <b>literal</b> \u200B",
        "ABC234"
      )

    assert Document.text(document) == "Первый абзац 🎥\n\nSecond\nline\n\n<b>literal</b>"
    assert length(document.blocks) == 3
    assert document.schemaVersion == 1
    assert length(Enum.uniq(Enum.map(document.blocks, & &1.id))) == 3
  end

  test "anchor offsets use browser UTF-16 units and unknown IDs fail safely" do
    document = Document.build("A🎥B", "ABC234")
    block = hd(document.blocks)
    lengths = Document.lengths(document)
    assert lengths[block.id] == 4
    assert Document.valid_anchor?(%{"blockId" => block.id, "characterOffset" => 4}, lengths)
    refute Document.valid_anchor?(%{"blockId" => block.id, "characterOffset" => 5}, lengths)
    refute Document.valid_anchor?(%{"blockId" => "missing", "characterOffset" => 0}, lengths)
  end

  test "live edits preserve the reading word across Unicode insertion and deletion" do
    assert Document.remap_offset("Read here", "🎥 Read here", 5) == 8
    assert Document.remap_offset("🎥 Read here", "Read here", 8) == 5
    assert Document.remap_offset("Read here", "Read 🎥 here", 5) == 8
    assert Document.remap_offset("Read here", "🎥 Read here", 0) == 3
    assert Document.remap_offset("Read here", "Read here 🎥", 5) == 5
    assert Document.remap_offset("Read here", "", 5) == 0
    assert Document.remap_offset("Read here", "Read here", 5) == 5
  end

  test "a live patch preserves IDs, surrounding paragraphs, and temporary whitespace" do
    document = Document.build("First\n\nSecond", "ABC234")
    [first, second] = document.blocks
    anchor = %{"blockId" => first.id, "characterOffset" => 3}
    {patched, target} = Document.patch(document, first.id, "  New First \n", anchor)
    assert hd(patched.blocks).text == "  New First \n"
    assert hd(patched.blocks).id == first.id
    assert Enum.at(patched.blocks, 1) == second
    assert target["blockId"] == first.id
    assert Document.valid_anchor?(target, Document.lengths(patched))
  end

  test "full replacements preserve moved reading words, assign unique IDs and recover from empty text" do
    document = Document.build("Opening\n\nRead 🎥 here\n\nClosing", "replacement")
    current = Enum.at(document.blocks, 1)
    anchor = %{"blockId" => current.id, "characterOffset" => 8}

    {next, target} =
      Document.replace(document, "New opening\n\nOpening\n\nRead 🎥 here\n\nClosing", anchor)

    assert target == anchor
    assert Enum.at(next.blocks, 2).id == current.id
    assert length(Enum.uniq(Enum.map(next.blocks, & &1.id))) == 4

    {changed, moved} =
      Document.replace(next, "New opening\n\nOpening\n\nPrefix Read 🎥 here\n\nClosing", target)

    assert moved["characterOffset"] == 15
    assert Document.valid_anchor?(moved, Document.lengths(changed))
    {empty, fallback} = Document.replace(changed, "", moved)
    assert Document.text(empty) == ""
    assert length(empty.blocks) == 1
    assert Document.valid_anchor?(fallback, Document.lengths(empty))
  end
end
