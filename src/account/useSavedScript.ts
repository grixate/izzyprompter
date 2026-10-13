import { useCallback, useEffect, useRef, useState } from 'react'
import { accountApi, AccountError, accountMessage, type SavedScript } from './api'
import { readPending, writePending, clearPending, editorDraftId, type PendingEdit } from './pendingEdits'

const mutationId = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('')

export function useSavedScript(accountId: string, scriptId: string) {
  const [draftId] = useState(editorDraftId)
  const [script, setScript] = useState<SavedScript | null>(null)
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null)
  const [status, setStatus] = useState('Loading script…')
  const [conflict, setConflict] = useState<SavedScript | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const state = useRef<{ saved: SavedScript | null; pending?: PendingEdit; conflict: SavedScript | null; saving: boolean; active: boolean; journalError: boolean; timer?: number }>({ saved: null, conflict: null, saving: false, active: true, journalError: false })
  const journal = useRef<Promise<void>>(Promise.resolve())
  const persist = useCallback((edit: PendingEdit) => {
    // IDB transaction order matches keystroke order, including during a save.
    journal.current = journal.current.catch(() => {}).then(() => writePending(edit)).then(
      () => { state.current.journalError = false },
      error => { state.current.journalError = true; throw error },
    )
    return journal.current
  }, [])
  const save = useCallback(async () => {
    const s = state.current
    if (!s.active || s.saving || !s.pending || s.conflict || !navigator.onLine) return
    s.saving = true
    setBusy(true)
    const outgoing = s.pending
    setStatus('Saving…')
    try {
      // An unavailable device journal must not prevent a healthy account save.
      await persist(outgoing).catch(() => {})
      const saved = await accountApi<SavedScript>(`/scripts/${scriptId}`, 'PATCH', outgoing, accountId)
      if (!s.active) return
      const newer = saved.superseded_by ?? (s.saved && s.saved.revision > saved.revision ? s.saved : null)
      if (newer) {
        s.saved = newer; s.conflict = newer
        setScript(newer); setConflict(newer)
        setStatus('Conflict · choose which version to keep')
        return
      }
      s.saved = saved
      setScript(saved)
      if (s.pending?.mutation_id === outgoing.mutation_id) {
        s.pending = undefined
        await clearPending(accountId, scriptId, draftId, outgoing.mutation_id).catch(() => {})
        if (s.active) setStatus('Saved to account')
      } else if (s.pending) {
        s.pending = { ...s.pending, expected_revision: saved.revision }
        await persist(s.pending).catch(() => {})
      }
    } catch (error) {
      if (!s.active) return
      if (error instanceof AccountError && error.reason === 'conflict' && error.current) {
        s.conflict = error.current
        setConflict(error.current)
        setStatus('Conflict · choose which version to keep')
      } else { setStatus(s.journalError ? 'Not saved · device storage unavailable. Keep this page open and export a copy.' : accountMessage(error)) }
    } finally {
      s.saving = false
      if (s.active) setBusy(false)
    }
  }, [accountId, scriptId, draftId, persist])
  useEffect(() => {
    const s = state.current
    s.active = true
    let cancelled = false
    const load = async () => {
      try {
        const pending = await readPending(accountId, scriptId, draftId).catch(() => undefined)
        if (cancelled) return
        if (pending) {
          s.pending = pending
          setDraft({ title: pending.title, content: pending.content })
          setStatus('Saved on this device · waiting to sync')
          setReady(true)
        }
        const saved = await accountApi<SavedScript>(`/scripts/${scriptId}`)
        if (cancelled) return
        s.saved = saved
        setScript(saved)
        if (!s.pending) {
          setDraft({ title: saved.title, content: saved.document.blocks.map(b => b.text).join('\n\n') })
          setStatus('Saved to account')
        }
        setReady(true)
        void save()
      } catch (error) { if (!cancelled) setStatus(accountMessage(error)) }
    }
    void load()
    const refresh = async () => {
      if (s.pending || s.saving) { void save(); return }
      try {
        const saved = await accountApi<SavedScript>(`/scripts/${scriptId}`)
        if (!s.active || s.pending || s.saving) return
        s.saved = saved
        setScript(saved)
        setDraft({ title: saved.title, content: saved.document.blocks.map(b => b.text).join('\n\n') })
        setReady(true)
        setStatus('Saved to account')
      } catch { /* A failed refresh must not replace the editor. */ }
    }
    const online = () => { if (s.pending) void save(); else void refresh() }
    const interval = window.setInterval(() => { if (s.pending) void save() }, 5_000)
    window.addEventListener('online', online)
    window.addEventListener('izzy:account-update', refresh)
    const beforeUnload = (event: BeforeUnloadEvent) => { if (s.pending || s.saving) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      cancelled = true; s.active = false; window.clearTimeout(s.timer); window.clearInterval(interval)
      window.removeEventListener('online', online); window.removeEventListener('izzy:account-update', refresh); window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [accountId, scriptId, draftId, save])
  const edit = (value: { title: string; content: string }) => {
    const s = state.current
    if (!ready || (!s.saved && !s.pending)) return
    setDraft(value)
    const pending: PendingEdit = { accountId, scriptId, draftId, ...value, expected_revision: s.pending?.expected_revision ?? s.saved!.revision,
      mutation_id: mutationId(), timestamp: Date.now() }
    s.pending = pending
    setStatus(s.conflict ? 'Conflict · your newer edits are kept on this device' : 'Saving on this device…')
    void persist(pending).then(() => { if (s.active && s.pending?.mutation_id === pending.mutation_id) setStatus(s.conflict ? 'Conflict · choose which version to keep' : 'Saved on this device · waiting to sync') })
      .catch(() => { if (s.active) setStatus('Device storage unavailable · keep this page open and export a copy') })
    window.clearTimeout(s.timer)
    s.timer = window.setTimeout(() => { void save() }, 500)
  }
  const resolve = async (choice: 'saved' | 'mine' | 'copy') => {
    const s = state.current
    if (!s.conflict || !s.pending || s.saving) return
    if (choice === 'copy') {
      s.saving = true; setBusy(true)
      try {
        const copy = await accountApi<SavedScript>('/scripts', 'POST', { title: s.pending.title, content: s.pending.content }, accountId)
        await clearPending(accountId, scriptId, draftId, s.pending.mutation_id).catch(() => {})
        window.location.assign(`/account/scripts/${copy.id}`)
      } catch (error) { setStatus(accountMessage(error)) }
      finally { s.saving = false; if (s.active) setBusy(false) }
      return
    }
    if (choice === 'saved') {
      await clearPending(accountId, scriptId, draftId, s.pending.mutation_id).catch(() => {})
      s.saved = s.conflict; s.pending = undefined
      setScript(s.saved)
      setDraft({ title: s.saved.title, content: s.saved.document.blocks.map(b => b.text).join('\n\n') })
      setStatus('Saved to account')
    } else {
      s.pending = { ...s.pending, expected_revision: s.conflict.revision, mutation_id: mutationId() }
      await persist(s.pending).catch(() => {})
    }
    s.conflict = null; setConflict(null)
    if (choice === 'mine') await save()
  }
  return { script, draft, edit, status, conflict, resolve, save, ready, busy, hasPending: () => Boolean(state.current.pending || state.current.saving) }
}
