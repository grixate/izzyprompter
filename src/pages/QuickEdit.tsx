import { useEffect, useRef, useState } from 'react'
import { ParagraphEditor } from '../components/ParagraphEditor'
import { QuickEditTrigger } from '../components/SecondaryControls'
import type { IzzyDocumentV1 } from '../domain/document'
import { loadQuickEditDraft, saveQuickEditDraft, type QuickEditDraftV1 } from '../domain/storage'
import type { CommandResult, ConnectionState, EditingState, SessionSnapshot } from '../realtime/protocol'
import { copyText, downloadScript } from '../domain/textBackup'

type Props = {
  sessionId: string; epoch: string | null; connectionId: string | null; connection: ConnectionState
  document: IzzyDocumentV1; revision: number; editing: EditingState; canEdit: boolean; beforeOpen: () => void
  request: <T>(event: string, payload?: Record<string, unknown>) => Promise<CommandResult<T>>
}
type Draft = QuickEditDraftV1 & { revision: number }

export function QuickEdit(props: Props) {
  const latest = useRef(props)
  latest.current = props
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const alive = useRef(true)
  const restored = useRef(false)
  const draftRef = useRef<Draft | null>(null)
  const inFlight = useRef(false)
  const blocked = useRef(false)
  const composing = useRef(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [observer, setObserver] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [composition, setComposition] = useState(false)
  const [draftStored, setDraftStored] = useState(true)
  const [copyFeedback, setCopyFeedback] = useState('')

  const update = (next: Draft) => {
    draftRef.current = next
    setDraft(next)
    setDraftStored(saveQuickEditDraft(props.sessionId, next.text === next.acknowledgedText ? null : next))
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!props.epoch || restored.current) return
    restored.current = true
    const stored = loadQuickEditDraft(props.sessionId)
    if (stored?.epoch === props.epoch && stored.text !== stored.acknowledgedText) {
      update({ ...stored, revision: props.revision })
      blocked.current = true
      setMessage('Unsent draft recovered. Review the connection before resuming live edits.')
      setOpen(true)
    }
  }, [props.epoch])
  useEffect(() => {
    if (!open || observer || props.connection === 'connected') return
    blocked.current = true
    setMessage('Connection interrupted. Your unsent changes remain in this tab. Review before resuming.')
  }, [open, observer, props.connection])

  const pump = async () => {
    const current = draftRef.current
    const context = latest.current
    if (!current || inFlight.current || blocked.current || composing.current || context.connection !== 'connected'
      || context.editing.active?.owner_id !== context.connectionId || current.text === current.acknowledgedText) return
    inFlight.current = true
    setSaving(true)
    const result = await context.request<SessionSnapshot>('script:patch_block', {
      block_id: current.blockId, base_revision: current.revision, text: current.text,
    })
    inFlight.current = false
    if (!alive.current) return
    setSaving(false)
    if (!result.ok) {
      blocked.current = true
      setMessage(result.reason === 'edit_conflict' ? 'The live text changed. Your draft is kept; it has not overwritten the newer version.'
        : 'Live sync stopped. Your unsent draft is kept; review before resuming.')
      return
    }
    const newest = draftRef.current!
    update({ ...newest, revision: result.value.script.revision, acknowledgedText: current.text })
  }
  useEffect(() => {
    if (!open || observer || composition) return
    const timer = window.setTimeout(() => { void pump() }, 180)
    return () => window.clearTimeout(timer)
  }, [draft, open, observer, props.editing, props.connection, composition])

  const acquire = async () => {
    const context = latest.current
    if (context.connection !== 'connected') return null
    if (context.editing.active?.owner_id === context.connectionId) return null
    const paused = await context.request('transport:pause')
    if (!paused.ok) return null
    // Wait for the primary display's *paused* checkpoint, not a length estimate
    // or the last moving sample. The server validates that revision pair.
    for (let attempt = 0; attempt < 30 && alive.current; attempt += 1) {
      const result = await context.request<SessionSnapshot>('script:begin_edit')
      if (result.ok) return result.value
      if (result.reason !== 'reading_unavailable') return null
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    return null
  }
  const begin = async () => {
    if (busy) return
    if (draftRef.current && draftRef.current.text !== draftRef.current.acknowledgedText) {
      blocked.current = true; setOpen(true); setMessage('Your unsent draft is kept. Resume explicitly to send it.'); return
    }
    if (props.editing.active) { setObserver(props.editing.active.block_id); setOpen(true); return }
    setBusy(true); setMessage(''); props.beforeOpen()
    const snapshot = await acquire()
    if (!alive.current) return
    setBusy(false)
    const edit = snapshot?.editing.active
    const block = snapshot?.script.document?.blocks.find((item) => item.id === edit?.block_id)
    if (!snapshot || !edit || !block) { setMessage('Could not open the edit. Keep a display connected and try again.'); return }
    blocked.current = false
    setObserver(null)
    update({ epoch: snapshot.session_epoch, blockId: block.id, text: block.text, acknowledgedText: block.text, revision: snapshot.script.revision })
    setOpen(true)
  }
  const resume = async (useLiveText = false) => {
    const current = draftRef.current
    if (!current || busy) return
    const live = props.document.blocks.find((block) => block.id === current.blockId)
    if (!live || current.epoch !== props.epoch) { setMessage('This draft belongs to a different script. Copy it before closing.'); return }
    if (!useLiveText && live.text !== current.acknowledgedText && live.text !== current.text) {
      setMessage('The live text changed. Copy your draft, or choose Use live text to discard unsent changes.'); return
    }
    setBusy(true)
    const snapshot = props.editing.active?.owner_id === props.connectionId ? null : await acquire()
    const owner = snapshot?.editing.active ?? latest.current.editing.active
    if (!alive.current) return
    setBusy(false)
    if (owner?.owner_id !== latest.current.connectionId || owner.block_id !== current.blockId) {
      if (snapshot?.editing.active?.owner_id === latest.current.connectionId) await props.request('script:end_edit')
      setMessage('Another edit or reading position is active. Your draft is kept.'); return
    }
    const server = snapshot?.script.document?.blocks.find((block) => block.id === current.blockId)?.text ?? live.text
    if (!useLiveText && server !== current.acknowledgedText && server !== current.text) {
      blocked.current = true; setMessage('The live text changed. Copy your draft or choose Use live text.'); return
    }
    blocked.current = false; setMessage('')
    update({ ...current, text: useLiveText ? server : current.text, acknowledgedText: server, revision: snapshot?.script.revision ?? props.revision })
  }
  const close = async (keepDraft = false) => {
    if (busy || saving || (!keepDraft && draft && draft.text !== draft.acknowledgedText && !observer)) return
    if (!observer && props.connection === 'connected' && props.editing.active?.owner_id === props.connectionId) {
      setBusy(true)
      const result = await props.request('script:end_edit')
      if (!alive.current) return
      setBusy(false)
      if (!result.ok) { setMessage('Could not finish the edit. Your draft is kept.'); return }
    }
    setOpen(false); setObserver(null); setMessage('')
  }
  const copy = async () => {
    const copied = await copyText(draftRef.current?.text ?? '', field.current)
    setCopyFeedback(copied ? 'DRAFT COPIED' : 'Copy unavailable. The text is selected; use your device’s Copy command.')
  }
  const observedText = props.document.blocks.find((block) => block.id === observer)?.text ?? ''
  const owns = props.editing.active?.owner_id === props.connectionId
  const synced = Boolean(draft && draft.text === draft.acknowledgedText && !saving && !message && owns)
  const state = observer ? 'readonly' : message ? 'blocked' : synced ? 'live' : 'pending'
  const storageFailed = !draftStored && draft?.text !== draft?.acknowledgedText

  return <>
    <QuickEditTrigger ref={trigger} disabled={busy || props.connection !== 'connected' || (!props.canEdit && !props.editing.active)} onClick={() => void begin()} aria-label="Quick edit current paragraph">
      {busy ? 'CHECKPOINTING…' : props.editing.active ? 'VIEW LIVE EDIT' : 'QUICK EDIT'}
    </QuickEditTrigger>
    {!open && message && <p className="quick-edit-feedback" role="status">{message}</p>}
    <ParagraphEditor dialogRef={dialog} returnTo={trigger} open={open} state={state}
      status={observer?'Read only':message?'Draft kept':synced?'Updated':'Updating…'}
      description={observer?'Another device is editing. Changes appear here as they happen.':'Playback is paused. Your changes appear on every connected screen as you type.'}
      onRequestClose={() => { if (observer || synced) void close() }} onDone={() => void close()} doneDisabled={busy || (!observer && !synced)}
      recoveryFooter={message&&!observer?<button onClick={() => void close(true)} disabled={busy || saving}>Close · keep draft</button>:undefined}>
      <label className="sr-only" htmlFor="quick-edit-text">CURRENT PARAGRAPH</label>
      <textarea id="quick-edit-text" ref={field} value={observer ? observedText : draft?.text ?? ''} readOnly={Boolean(observer)} spellCheck
        onCompositionStart={() => { composing.current = true; setComposition(true) }} onCompositionEnd={() => { composing.current = false; setComposition(false) }}
        onChange={(event) => { if (draftRef.current) update({ ...draftRef.current, text: event.target.value }) }} />
      {storageFailed && !observer && <div className="edit-recovery">
        <p role="alert">LOCAL SAVE UNAVAILABLE · Unsent edits exist only in this tab. Copy or download before closing or refreshing.</p>
        <div><button onClick={() => { if (draftRef.current) update(draftRef.current) }}>RETRY LOCAL SAVE</button>
          <button onClick={() => void copy()}>COPY DRAFT</button>
          <button onClick={() => downloadScript(draftRef.current?.text ?? '', 'izzy-paragraph.txt')}>DOWNLOAD DRAFT</button></div>
      </div>}
      {copyFeedback && <p className="edit-recovery" role="status">{copyFeedback}</p>}
      {message && !observer && <div className="edit-recovery" role="alert"><p>{message}</p><div>
        {!storageFailed && <button onClick={() => void copy()}>COPY DRAFT</button>}
        <button disabled={busy || props.connection !== 'connected'} onClick={() => void resume()}>RESUME LIVE EDIT</button>
        <button disabled={busy || props.connection !== 'connected'} onClick={() => void resume(true)}>USE LIVE TEXT</button>
      </div></div>}
    </ParagraphEditor>
  </>
}
