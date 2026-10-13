import assert from 'node:assert/strict'
import test from 'node:test'
import { anchorAtPosition, positionAtAnchor } from '../src/prompt/position.ts'
import { PromptMotion, serverPosition } from '../src/prompt/motion.ts'
import { loadDisplayCheckpoint, saveDisplayCheckpoint, savePromptPosition } from '../src/domain/storage.ts'

const layout = (lineSize, charactersPerLine) => [{
  id: 'paragraph-1', top: 100, bottom: 100 + 120 / charactersPerLine * lineSize, textLength: 120,
  lines: () => Array.from({ length: 120 / charactersPerLine }, (_, index) => ({
    start: index * charactersPerLine, end: (index + 1) * charactersPerLine,
    top: 100 + index * lineSize, bottom: 100 + (index + 1) * lineSize,
  })),
}]

test('restores the same character after line width and line height change', () => {
  const anchor = anchorAtPosition(layout(20, 20), 75, 75)
  assert.deepEqual(anchor, { blockId: 'paragraph-1', characterOffset: 40 })
  assert.equal(positionAtAnchor(layout(30, 10), anchor, 75), 160)
})

test('missing paragraphs and empty layouts fail safely; offsets clamp to text bounds', () => {
  assert.equal(anchorAtPosition([], 100, 75), null)
  assert.equal(positionAtAnchor(layout(20, 20), { blockId: 'deleted', characterOffset: 0 }, 75), null)
  assert.equal(positionAtAnchor(layout(20, 20), { blockId: 'paragraph-1', characterOffset: 900 }, 75), 135)
})

test('projection preserves reflowed position while applying later remote commands', () => {
  const motion = new PromptMotion()
  motion.maximum = 5_000
  motion.reproject(1_200, 500)
  motion.reconcile(548, true)
  assert.equal(motion.position, 1_248)
  for (let index = 0; index < 60; index += 1) {
    motion.frame({ status: 'paused', speed: 1 }, 548, 1 / 60)
  }
  assert.equal(motion.position, 1_248)
})

test('low frame rates and background gaps do not slow playback or overshoot the script', () => {
  const motion = new PromptMotion()
  motion.maximum = 1_000
  motion.reproject(0, 0)
  const transport = { status: 'playing', speed: 1, anchor_position: 0, anchor_server_time: 1_000 }
  assert.equal(serverPosition(transport, 0, 3_000), 104)
  assert.equal(motion.frame(transport, 104, 2), 104)
  assert.equal(motion.frame(transport, 5_200, 100), 1_000)
  motion.reconcile(5_152, true)
  assert.equal(motion.position, 952, 'reverse must move immediately after long playback at the end')
  motion.reconcile(0, true)
  assert.equal(motion.position, 0)
  motion.reconcile(48, true)
  assert.equal(motion.position, 48, 'forward must move immediately after overshooting the start')
})

test('display checkpoints stay separate from remote state and from other sessions', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const checkpoint = {
    documentKey: 'document-1', anchor: { blockId: 'p1', characterOffset: 30 },
    serverPosition: 300, transportRevision: 4,
  }
  saveDisplayCheckpoint('ONE', checkpoint, storage)
  saveDisplayCheckpoint('TWO', { ...checkpoint, serverPosition: 500 }, storage)
  savePromptPosition({ blockId: 'approximate', characterOffset: 0 }, storage)
  assert.deepEqual(loadDisplayCheckpoint('ONE', storage), checkpoint)
  assert.equal(loadDisplayCheckpoint('TWO', storage).serverPosition, 500)
  assert.equal(loadDisplayCheckpoint('UNKNOWN', storage), null)
  assert.equal(loadDisplayCheckpoint('toString', storage), null)
  for (let index = 0; index < 12; index += 1) saveDisplayCheckpoint(`SESSION-${index}`, checkpoint, storage)
  assert.equal(loadDisplayCheckpoint('ONE', storage), null)
  assert.deepEqual(loadDisplayCheckpoint('SESSION-11', storage), checkpoint)
  // A semantic jump can rebase the display ahead of the signed distance cursor.
  saveDisplayCheckpoint('SIGNED', { ...checkpoint, serverPosition: -48 }, storage)
  assert.equal(loadDisplayCheckpoint('SIGNED', storage).serverPosition, -48)
})
