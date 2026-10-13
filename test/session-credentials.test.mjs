import assert from 'node:assert/strict'
import test from 'node:test'
import { capabilityFromHash, isSessionCredentials, loadEditorSession, saveEditorSession, sessionLink } from '../src/realtime/credentials.ts'

const credentials = {
  protocol_version: 2, session_id: 'ABC234',
  tokens: { editor: 'a'.repeat(43), display: 'b'.repeat(43), remote: 'c'.repeat(43) },
}

test('validates role credentials and rejects old protocols, bad tokens, and corrupt tab storage', () => {
  assert.equal(isSessionCredentials(credentials), true)
  assert.equal(isSessionCredentials({ ...credentials, protocol_version: 1 }), false)
  assert.equal(isSessionCredentials({ ...credentials, tokens: { remote: 'guess' } }), false)
  assert.equal(isSessionCredentials(null), false)
  assert.equal(loadEditorSession({ getItem: () => '{broken' }), null)
  assert.equal(loadEditorSession({ getItem: () => { throw new Error('denied') } }), null)
})

test('pairing uses role-specific URL fragments, never query parameters or editor credentials', () => {
  const url = new URL(sessionLink('http://192.168.1.13:5173', credentials, 'remote'))
  assert.equal(url.pathname, '/remote/ABC234')
  assert.equal(url.search, '')
  assert.equal(capabilityFromHash(url.hash), credentials.tokens.remote)
  assert.equal(url.toString().includes(credentials.tokens.editor), false)
  assert.equal(capabilityFromHash('#key=short'), null)
  assert.equal(capabilityFromHash(''), null)
})

test('editor pairing survives tab refresh, clears explicitly, and tolerates denied storage', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  saveEditorSession(credentials, storage)
  assert.deepEqual(loadEditorSession(storage), credentials)
  saveEditorSession(null, storage)
  assert.equal(loadEditorSession(storage), null)
  assert.doesNotThrow(() => saveEditorSession(credentials, { setItem: () => { throw new Error('full') } }))
})
