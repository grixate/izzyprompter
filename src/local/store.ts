import type { IzzyDocumentV1 } from '../domain/document'
import type { PromptSettingsV1 } from '../domain/storage'
import type { ReadingAnchor } from '../prompt/position'
import { validAnchor, validDocument, validSettings } from './document'

export type PreparedScript = {
  version: 1; document: IzzyDocumentV1; settings: PromptSettingsV1; anchor: ReadingAnchor | null; savedAt: number
}
export function isPreparedScript(value: unknown): value is PreparedScript {
  if (!value || typeof value !== 'object') return false
  const item = value as PreparedScript
  return item.version === 1 && validDocument(item.document) && validSettings(item.settings)
    && (item.anchor === null || validAnchor(item.document, item.anchor)) && Number.isFinite(item.savedAt)
}
let database: Promise<IDBDatabase> | undefined
function open() {
  if (database) return database
  let settled = false
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('izzy-prepared-scripts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('scripts', { keyPath: 'document.id' })
    request.onerror = () => { settled = true; reject(request.error) }
    request.onblocked = () => { settled = true; reject(new Error('Close other local tabs and retry.')) }
    request.onsuccess = () => {
      const db = request.result
      // A blocked request can succeed after its caller has already retried.
      if (settled) { db.close(); return }
      settled = true
      db.onversionchange = () => { db.close(); database = undefined }
      resolve(db)
    }
  })
  database = opening
  void opening.catch(() => { if (database === opening) database = undefined })
  return database
}
export async function preparedScripts(): Promise<PreparedScript[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scripts')
    const request = tx.objectStore('scripts').getAll(undefined, 20)
    tx.oncomplete = () => resolve(request.result.filter(isPreparedScript).sort((a, b) => b.savedAt - a.savedAt))
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
export async function savePreparedScript(item: PreparedScript) {
  if (!isPreparedScript(item)) throw new Error('Invalid local script')
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('scripts', 'readwrite'), store = tx.objectStore('scripts')
    const count = store.count(), existing = store.get(item.document.id)
    existing.onsuccess = () => {
      if (!existing.result && count.result >= 20) { tx.abort(); return }
      store.put(item)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Local storage unavailable or full (20 prepared scripts maximum). Export your text.'))
  })
}
export async function removePreparedScript(id: string) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('scripts', 'readwrite')
    tx.objectStore('scripts').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
