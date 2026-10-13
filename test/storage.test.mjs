import assert from 'node:assert/strict'
import test from 'node:test'

import { createIzzyDocumentFromLegacyText } from '../src/domain/document.ts'
import {
  DEFAULT_PROMPT_POSITION,
  DEFAULT_PROMPT_SETTINGS,
  IZZY_STORAGE_VERSION,
  STORAGE_KEYS,
  clearWorkspaceStorage,
  createDebouncedStorageWriter,
  loadWorkspaceStorage,
  persistDraftDocument,
  savePromptPosition,
  savePromptSettings,
  saveStoredDocument,
} from '../src/domain/storage.ts'

class MemoryStorage {
  values = new Map()

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, value)
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

test('stores document, draft, settings, and semantic position independently', () => {
  const storage = new MemoryStorage()
  const document = createIzzyDocumentFromLegacyText('One\n\nTwo', {
    documentId: 'persistent-document',
    title: 'Persistent document',
  })
  const settings = { ...DEFAULT_PROMPT_SETTINGS, speed: 1.15, mirrored: true }
  const position = { blockId: document.blocks[1].id, characterOffset: 2 }

  assert.equal(persistDraftDocument({
    documentId: document.id,
    title: document.title,
    content: 'One\n\nTwo',
  }, storage), true)
  assert.equal(savePromptSettings(settings, storage, () => 101), true)
  assert.equal(savePromptPosition(position, storage, () => 102), true)

  const restored = loadWorkspaceStorage(storage)
  assert.deepEqual(restored.document, document)
  assert.equal(restored.draft.content, 'One\n\nTwo')
  assert.deepEqual(restored.settings, settings)
  assert.deepEqual(restored.position, position)
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.settings)).updatedAt, 101)
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.position)).storageVersion, IZZY_STORAGE_VERSION)
})

test('a corrupt storage entry does not prevent other entries from recovering', () => {
  const storage = new MemoryStorage()
  const document = createIzzyDocumentFromLegacyText('Recovered', { documentId: 'recovered' })
  saveStoredDocument(document, storage)
  savePromptSettings({ ...DEFAULT_PROMPT_SETTINGS, speed: 1.05 }, storage)
  storage.setItem(STORAGE_KEYS.draft, '{broken json')
  storage.setItem(STORAGE_KEYS.position, JSON.stringify({ storageVersion: 99, updatedAt: 1, data: {} }))

  const restored = loadWorkspaceStorage(storage)
  assert.deepEqual(restored.document, document)
  assert.equal(restored.draft, null)
  assert.deepEqual(restored.settings, { ...DEFAULT_PROMPT_SETTINGS, speed: 1.05 })
  assert.deepEqual(restored.position, DEFAULT_PROMPT_POSITION)
})

test('migrates the pre-release version-zero envelope through the migration hook', () => {
  const storage = new MemoryStorage()
  const settings = { ...DEFAULT_PROMPT_SETTINGS, fontSize: 72 }
  storage.setItem(STORAGE_KEYS.settings, JSON.stringify({
    storageVersion: 0,
    savedAt: 123,
    value: settings,
  }))

  assert.deepEqual(loadWorkspaceStorage(storage).settings, settings)
})

test('storage denial and quota failures never block the product', () => {
  const unavailableStorage = {
    getItem() { throw new Error('denied') },
    setItem() { throw new Error('quota') },
    removeItem() { throw new Error('denied') },
  }

  assert.deepEqual(loadWorkspaceStorage(unavailableStorage), {
    document: null,
    draft: null,
    settings: DEFAULT_PROMPT_SETTINGS,
    position: DEFAULT_PROMPT_POSITION,
  })
  assert.equal(savePromptSettings(DEFAULT_PROMPT_SETTINGS, unavailableStorage), false)
  assert.equal(clearWorkspaceStorage(unavailableStorage), false)
})

test('clear removes every IZZY key without touching unrelated data', () => {
  const storage = new MemoryStorage()
  Object.values(STORAGE_KEYS).forEach((key) => storage.setItem(key, 'stored'))
  storage.setItem('unrelated', 'keep')

  assert.equal(clearWorkspaceStorage(storage), true)
  Object.values(STORAGE_KEYS).forEach((key) => assert.equal(storage.getItem(key), null))
  assert.equal(storage.getItem('unrelated'), 'keep')
})

test('debounced writes keep only the latest value and can flush synchronously', () => {
  const writes = []
  const writer = createDebouncedStorageWriter({
    delay: 60_000,
    write: (value) => { writes.push(value) },
  })

  writer.schedule('first')
  writer.schedule('latest')
  assert.deepEqual(writes, [])
  assert.equal(writer.flush(), true)
  assert.deepEqual(writes, ['latest'])
  assert.equal(writer.flush(), true)
  assert.deepEqual(writes, ['latest'])
})

test('cancelled debounced writes cannot resurrect a cleared draft', () => {
  const writes = []
  const writer = createDebouncedStorageWriter({
    delay: 0,
    write: (value) => { writes.push(value) },
  })

  writer.schedule('stale')
  writer.cancel()
  assert.equal(writer.flush(), true)
  assert.deepEqual(writes, [])
})

test('write results report failure and explicit successful recovery without a false saved state', () => {
  const results = []
  let permitted = false
  const writer = createDebouncedStorageWriter({ delay: 60_000, write: () => permitted, onResult: (saved) => results.push(saved) })
  writer.schedule('script')
  assert.equal(writer.flush(), false)
  assert.deepEqual(results, [false])
  writer.flush()
  assert.deepEqual(results, [false])
  permitted = true
  writer.schedule('script')
  assert.equal(writer.flush(), true)
  assert.deepEqual(results, [false, true])
})

test('a revoked storage write reports failure instead of throwing out of a flush', () => {
  const results = []
  const writer = createDebouncedStorageWriter({ delay: 60_000, write: () => { throw new Error('denied') }, onResult: (saved) => results.push(saved) })
  writer.schedule('script')
  assert.equal(writer.flush(), false)
  assert.deepEqual(results, [false])
})
