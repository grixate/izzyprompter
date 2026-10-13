import test from 'node:test'
import assert from 'node:assert/strict'
import { boundedSpeed, jogKeyDelta } from '../src/realtime/keyboard.ts'

test('jog keys provide small and coarse bidirectional movement without consuming unrelated keys', () => {
  for (const key of ['ArrowRight', 'ArrowDown']) assert.equal(jogKeyDelta(key, 480), 48)
  for (const key of ['ArrowLeft', 'ArrowUp']) assert.equal(jogKeyDelta(key, 480), -48)
  assert.equal(jogKeyDelta('PageDown', 480), 480)
  assert.equal(jogKeyDelta('PageUp', 480), -480)
  for (const key of ['Tab', ' ', 'Escape', 'a']) assert.equal(jogKeyDelta(key, 480), null)
})

test('speed steps stay within protocol bounds and avoid floating-point drift', () => {
  assert.equal(boundedSpeed(1.5 + 0.05), 1.5)
  assert.equal(boundedSpeed(0.5 - 0.05), 0.5)
  assert.equal(boundedSpeed(0.86 + 0.05), 0.91)
})
