import assert from 'node:assert/strict'
import test from 'node:test'

import {
  IZZY_DOCUMENT_SCHEMA_VERSION,
  createIzzyDocumentFromLegacyText,
  deserializeIzzyDocument,
  isIzzyDocumentV1,
  izzyDocumentToLegacySessionScript,
  legacySessionScriptToDocument,
  serializeIzzyDocument,
  splitLegacyParagraphs,
} from '../src/domain/document.ts'

test('creates an empty versioned document without placeholder blocks', () => {
  const document = createIzzyDocumentFromLegacyText('   \n\n  ', {
    documentId: 'document-empty',
  })

  assert.equal(document.schemaVersion, IZZY_DOCUMENT_SCHEMA_VERSION)
  assert.equal(document.id, 'document-empty')
  assert.equal(document.title, 'Untitled script')
  assert.deepEqual(document.blocks, [])
  assert.equal(isIzzyDocumentV1(document), true)
})

test('preserves Unicode paragraph text and the current blank-line behaviour', () => {
  const content = '  Первый абзац — café 🎥  \r\n\r\nSecond paragraph\ncontinues here.  '
  const document = createIzzyDocumentFromLegacyText(content, {
    documentId: 'unicode-script',
    title: '  Camera script  ',
  })

  assert.deepEqual(
    document.blocks.map((block) => block.text),
    ['Первый абзац — café 🎥', 'Second paragraph\ncontinues here.'],
  )
  assert.equal(document.title, 'Camera script')
})

test('derives deterministic and unique block IDs from legacy text', () => {
  const content = 'Repeated\n\nRepeated\n\nFinal'
  const first = createIzzyDocumentFromLegacyText(content, { documentId: 'stable-script' })
  const second = createIzzyDocumentFromLegacyText(content, { documentId: 'stable-script' })

  assert.deepEqual(first, second)
  assert.equal(new Set(first.blocks.map((block) => block.id)).size, 3)
})

test('serializes deterministically and preserves IDs after reload', () => {
  const document = createIzzyDocumentFromLegacyText('One\n\nTwo', {
    documentId: 'round-trip',
    title: 'Round trip',
  })
  const firstSerialization = serializeIzzyDocument(document)
  const restored = deserializeIzzyDocument(firstSerialization)

  assert.ok(restored)
  assert.deepEqual(restored, document)
  assert.equal(serializeIzzyDocument(restored), firstSerialization)
  assert.deepEqual(
    restored.blocks.map((block) => block.id),
    document.blocks.map((block) => block.id),
  )
})

test('rejects corrupt, unsupported, and ambiguous documents safely', () => {
  const duplicateBlock = {
    schemaVersion: 1,
    id: 'bad-document',
    title: 'Bad',
    blocks: [
      { id: 'same', type: 'paragraph', text: 'One' },
      { id: 'same', type: 'paragraph', text: 'Two' },
    ],
  }

  assert.equal(deserializeIzzyDocument('{broken json'), null)
  assert.equal(deserializeIzzyDocument(JSON.stringify({ ...duplicateBlock, schemaVersion: 2 })), null)
  assert.equal(deserializeIzzyDocument(JSON.stringify(duplicateBlock)), null)
  assert.equal(isIzzyDocumentV1({}), false)
})

test('adapts the current Phoenix script snapshot without changing rendered paragraphs', () => {
  const legacy = {
    content: '  First paragraph  \n\n\nSecond paragraph\nwith another line. ',
    revision: 7,
  }
  const versioned = legacySessionScriptToDocument(legacy, 'ABC123')
  const roundTrip = izzyDocumentToLegacySessionScript(versioned)

  assert.equal(versioned.document.id, 'session_ABC123')
  assert.equal(versioned.revision, 7)
  assert.deepEqual(
    versioned.document.blocks.map((block) => block.text),
    splitLegacyParagraphs(legacy.content),
  )
  assert.equal(roundTrip.content, 'First paragraph\n\nSecond paragraph\nwith another line.')
  assert.equal(roundTrip.revision, 7)
})

test('handles realistically large scripts with stable unique block identity', () => {
  const content = Array.from({ length: 2_000 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n')
  const document = createIzzyDocumentFromLegacyText(content, { documentId: 'large-script' })

  assert.equal(document.blocks.length, 2_000)
  assert.equal(new Set(document.blocks.map((block) => block.id)).size, 2_000)
  assert.equal(deserializeIzzyDocument(serializeIzzyDocument(document))?.blocks.length, 2_000)
})

