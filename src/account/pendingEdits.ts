export type PendingEdit = { accountId: string; scriptId: string; draftId: string; title: string; content: string; expected_revision: number; mutation_id: string; timestamp: number }
export function editorDraftId() {
  const recovery = new URLSearchParams(location.hash.slice(1)).get('draft')
  if (recovery && /^[a-zA-Z0-9_-]{1,100}$/.test(recovery)) return recovery
  try {
    const previous = sessionStorage.getItem('izzy:editor-draft-id')
    if (previous) return previous
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem('izzy:editor-draft-id', id)
    return id
  } catch { return `temporary-${Date.now()}` }
}
let database: Promise<IDBDatabase> | undefined
function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('izzy-account-edits-v1', 2)
    request.onupgradeneeded = () => {
      const next = request.result.createObjectStore('drafts', { keyPath: ['accountId', 'scriptId', 'draftId'] })
      next.createIndex('accountId', 'accountId')
      // Preserve pre-release pending edits for explicit recovery, not silent adoption.
      if (request.result.objectStoreNames.contains('pending')) {
        const cursor = request.transaction!.objectStore('pending').openCursor()
        cursor.onsuccess = () => {
          if (cursor.result) { next.put({ ...cursor.result.value, draftId: 'recovered' }); cursor.result.continue() }
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = undefined; reject(request.error) }
  })
  return database
}
export async function readPending(accountId: string, scriptId: string, draftId: string): Promise<PendingEdit | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').get([accountId, scriptId, draftId])
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function listPending(accountId: string): Promise<PendingEdit[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').index('accountId').getAll(accountId)
    request.onsuccess = () => resolve(request.result.sort((a: PendingEdit, b: PendingEdit) => b.timestamp - a.timestamp))
    request.onerror = () => reject(request.error)
  })
}
export async function writePending(edit: PendingEdit) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite')
    tx.objectStore('drafts').put(edit)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
export async function clearPending(accountId: string, scriptId: string, draftId: string, mutationId: string) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite')
    const store = tx.objectStore('drafts')
    const request = store.get([accountId, scriptId, draftId])
    request.onsuccess = () => { if (request.result?.mutation_id === mutationId) store.delete([accountId, scriptId, draftId]) }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
