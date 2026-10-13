import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeClipboardPayload,
  normalizePlainText,
  replaceTextSelection,
} from '../src/domain/textNormalization.ts'
import { createIzzyDocumentFromLegacyText } from '../src/domain/document.ts'
import { pasteSourceFixtures } from './fixtures/paste-sources.mjs'

for (const fixture of pasteSourceFixtures) {
  test(`normalizes ${fixture.source} clipboard text without accepting its HTML`, () => {
    const normalized = normalizeClipboardPayload({
      plainText: fixture.plainText,
      html: fixture.html,
    })

    assert.equal(normalized, fixture.expected)
    assert.equal(normalized.includes('<'), false)
    assert.equal(normalized.includes('style='), false)
  })
}

test('normalizes equivalent line endings and Unicode whitespace deterministically', () => {
  const variants = [
    'First\r\n\r\nSecond\u00a0line',
    'First\r\rSecond\u202fline',
    '\ufeffFirst\n\n\nSecond\tline\u200b',
  ]

  const normalized = variants.map(normalizePlainText)
  assert.deepEqual(normalized, [
    'First\n\nSecond line',
    'First\n\nSecond line',
    'First\n\nSecond line',
  ])

  const documents = variants.map((content) => createIzzyDocumentFromLegacyText(content))
  assert.deepEqual(documents[0], documents[1])
  assert.deepEqual(documents[1], documents[2])
})

test('preserves punctuation, Unicode text, lists, and meaningful single line breaks', () => {
  const input = 'Élise — «Привет» 🎥\n• one\n• two\n\nمرحبا بالعالم'
  assert.equal(normalizePlainText(input), input)
})

test('replaces only the selected textarea range and reports the next caret position', () => {
  const result = replaceTextSelection('Before OLD after', 7, 10, 'new\n\ntext')

  assert.deepEqual(result, {
    value: 'Before new\n\ntext after',
    caret: 16,
  })
})

test('clamps stale textarea selection bounds safely', () => {
  assert.deepEqual(replaceTextSelection('abc', -10, 99, 'x'), {
    value: 'x',
    caret: 1,
  })
})
