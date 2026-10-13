import test from 'node:test'
import assert from 'node:assert/strict'
import { creationFailure } from '../src/realtime/creation.ts'

test('429 guidance uses bounded retry seconds and does not classify ordinary failures as rate limits', () => {
  assert.equal(creationFailure(429, 'rate_limited', '3').retrySeconds, 3)
  for (const header of [null, '', 'bad', '-1']) assert.equal(creationFailure(429, null, header).retrySeconds, 60)
  assert.equal(creationFailure(429, null, '999999').retrySeconds, 300)
  assert.equal(creationFailure(503, 'session_unavailable', null), null)
  assert.equal(creationFailure(201, null, null), null)
})

test('capacity and request-size failures explicitly preserve the draft with no automatic retry', () => {
  for (const [status, reason] of [[503, 'session_capacity'], [413, null]]) {
    const failure = creationFailure(status, reason, null)
    assert.match(failure.message, /SCRIPT KEPT IN THIS TAB/)
    assert.equal(failure.retrySeconds, 0)
  }
  assert.match(creationFailure(422, null, null).message, /2 MB \/ 5,000 PARAGRAPHS MAX/)
})
