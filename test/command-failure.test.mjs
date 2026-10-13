import test from 'node:test'
import assert from 'node:assert/strict'
import { commandFailureAction, commandRetryDelay } from '../src/realtime/commandFailure.ts'

test('budget refusals and invalid commands never trigger a socket reconnect', () => {
  for (const reason of ['rate_limited', 'payload_too_large', 'invalid_command', 'invalid_or_stale_script', 'forbidden', 'unknown_event', 'edit_conflict', 'stale_reading']) {
    assert.equal(commandFailureAction(reason), 'ignore')
  }
  assert.equal(commandFailureAction('session_unavailable'), 'terminal')
  assert.equal(commandFailureAction('session_limit'), 'terminal')
  assert.equal(commandFailureAction('unexpected_failure'), 'recover')
})

test('server cooldown hints are finite and bounded; no gesture is stored for retry', () => {
  for (const value of [undefined, null, '100', NaN, Infinity]) assert.equal(commandRetryDelay(value), 250)
  assert.equal(commandRetryDelay(-10), 50)
  assert.equal(commandRetryDelay(123), 123)
  assert.equal(commandRetryDelay(99999), 2000)
})
