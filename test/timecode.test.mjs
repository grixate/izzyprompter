import test from 'node:test'
import assert from 'node:assert/strict'
import { positionTimecode } from '../src/prompt/timecode.ts'

test('readout seconds and tenths describe one nominal reading time', () => {
  assert.equal(positionTimecode(49.92, 1), '00:00.9')
  assert.equal(positionTimecode(52, 1), '00:01.0')
  assert.equal(positionTimecode(54.6, 1), '00:01.0')
})

test('readout rolls from seconds into minutes without rounding ahead', () => {
  assert.equal(positionTimecode(3119, 1), '00:59.9')
  assert.equal(positionTimecode(3120, 1), '01:00.0')
})

test('the same position has a speed-dependent reading duration', () => {
  assert.equal(positionTimecode(78, .5), '00:03.0')
  assert.equal(positionTimecode(78, 1.5), '00:01.0')
  assert.equal(positionTimecode(0, .86), '00:00.0')
  assert.equal(positionTimecode(-10, 1), '00:00.0')
})
