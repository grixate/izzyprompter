import assert from 'node:assert/strict'
import test from 'node:test'
import { legacySessionScriptToDocument } from '../src/domain/document.ts'
import { latestReading, measuredPosition } from '../src/realtime/reading.ts'

const checkpoint = {
  anchor: { blockId: 'server-block', characterOffset: 12 }, position: 1200, maximum: 3000,
  transport_position: 500, transport_revision: 4, script_revision: 1, source_id: 'screen-1', server_time: 1000,
}
const reading = { revision: 8, source_id: 'screen-1', checkpoint }
const transport = { status: 'paused', anchor_position: 548, anchor_server_time: 1000, revision: 5, speed: 1 }

test('session documents preserve server-owned paragraph identity instead of client hashes', () => {
  const document = { schemaVersion: 1, id: 'session_ABC234', title: 'Untitled script', blocks: [{ id: 'server-block', type: 'paragraph', text: 'A🎥B' }] }
  const snapshot = { content: 'A🎥B', revision: 1, document }
  assert.deepEqual(legacySessionScriptToDocument(snapshot, 'ABC234').document, document)
})

test('remote position uses measured display projection, not text length or canonical server pixels', () => {
  assert.equal(measuredPosition(reading, transport, 1, 0, 1000), 1248)
  assert.equal(measuredPosition(reading, { ...transport, status: 'playing' }, 1, 0, 2000), 1300)
  assert.equal(measuredPosition(reading, { ...transport, anchor_position: 9000 }, 1, 0, 1000), 3000)
})

test('new semantic commands win over an old checkpoint until confirmed by the screen', () => {
  const moved = { ...transport, semantic_anchor: { anchor: { blockId: 'next-block', characterOffset: 0 }, revision: 5, script_revision: 1, transport_position: 548 } }
  assert.equal(latestReading(reading, moved, 1).anchor.blockId, 'next-block')
  assert.equal(measuredPosition(reading, moved, 1, 0, 1000), null)
  const confirmed = { ...reading, checkpoint: { ...checkpoint, anchor: moved.semantic_anchor.anchor, transport_revision: 5, transport_position: 548, position: 2200 } }
  assert.equal(measuredPosition(confirmed, moved, 1, 0, 1000), 2200)
})

test('missing or old-document checkpoints do not invent a current paragraph', () => {
  assert.equal(latestReading({ ...reading, checkpoint: null }, transport, 1), null)
  assert.equal(latestReading(reading, transport, 2), null)
  assert.equal(measuredPosition(reading, transport, 2, 0, 1000), null)
})
