import test from 'node:test'
import assert from 'node:assert/strict'
import { previewFrame } from '../src/prompt/preview.ts'
import { BASE_PIXELS_PER_SECOND } from '../src/prompt/motion.ts'

test('preview playback follows the same base rate as the real prompter', () => {
  assert.equal(previewFrame(100, 1000, 1, 2), 100 + BASE_PIXELS_PER_SECOND * 2)
  assert.equal(previewFrame(100, 1000, 0.5, 2), 100 + BASE_PIXELS_PER_SECOND)
})

test('preview playback clamps to the measured script and handles an empty viewport', () => {
  assert.equal(previewFrame(990, 1000, 1.5, 1), 1000)
  assert.equal(previewFrame(0, 0, 1, 1), 0)
  assert.equal(previewFrame(-100, 1000, 1, 0), 0)
})

test('a paused or backwards timestamp cannot advance the preview', () => {
  assert.equal(previewFrame(200, 1000, 1, 0), 200)
  assert.equal(previewFrame(200, 1000, 1, -2), 200)
})

test('the homepage preview wraps repeatedly and retains overshoot at its normal pace', () => {
  const distance = BASE_PIXELS_PER_SECOND * 0.56
  assert.equal(previewFrame(990, 1000, 0.56, 1, true), (990 + distance) % 1000)
  assert.equal(previewFrame(990, 1000, 0.56, 200, true), (990 + distance * 200) % 1000)
  assert.equal(previewFrame(0, 0, 0.56, 1, true), 0)
})
