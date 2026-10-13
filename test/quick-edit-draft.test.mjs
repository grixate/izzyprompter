import test from 'node:test'
import assert from 'node:assert/strict'
import { loadQuickEditDraft, saveQuickEditDraft, clearWorkspaceStorage, STORAGE_KEYS } from '../src/domain/storage.ts'
test('unsent live edits recover separately by session and clear without touching other storage', () => {
  const values = new Map([['other-app', 'kept']])
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  const draft = { epoch: 'instance-1', blockId: 'block-1', text: 'Unsent 🎥', acknowledgedText: 'Original' }
  assert.equal(saveQuickEditDraft('ABC234', draft, storage), true)
  assert.deepEqual(loadQuickEditDraft('ABC234', storage), draft)
  assert.equal(loadQuickEditDraft('OTHER', storage), null)
  saveQuickEditDraft('OTHER', { ...draft, epoch: 'instance-2' }, storage)
  saveQuickEditDraft('ABC234', null, storage)
  assert.equal(loadQuickEditDraft('ABC234', storage), null)
  assert.equal(loadQuickEditDraft('OTHER', storage).epoch, 'instance-2')
  clearWorkspaceStorage(storage)
  assert.equal(values.get('other-app'), 'kept')
  values.set(STORAGE_KEYS.quickEdits, 'corrupt')
  assert.equal(loadQuickEditDraft('OTHER', storage), null)
})
