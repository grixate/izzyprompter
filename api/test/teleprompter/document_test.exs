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
end
