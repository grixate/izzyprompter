import { useEffect, useRef, useState } from 'react'
import { ParagraphEditor } from '../components/ParagraphEditor'
import { QuickEditTrigger } from '../components/SecondaryControls'
import { izzyDocumentToLegacyText, type IzzyDocumentV1 } from '../domain/document'
import { loadQuickEditDraft, saveQuickEditDraft, type QuickEditDraftV1 } from '../domain/storage'
import type { CommandResult, ConnectionState, EditingState, ReadingState, SessionSnapshot, TransportState } from '../realtime/protocol'
import { copyText, downloadScript } from '../domain/textBackup'
import { EditOpening } from '../components/EditOpening'

type Props = {
  sessionId: string; epoch: string | null; connectionId: string | null; connection: ConnectionState
  document: IzzyDocumentV1; revision: number; reading: ReadingState; transport: TransportState; editing: EditingState; canEdit: boolean; beforeOpen: () => void
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
  const beginning = useRef(false)
  const openingRequest = useRef<AbortController | null>(null)
  const readingChanged = useRef<(() => void) | null>(null)
  const draftRef = useRef<Draft | null>(null)
  const inFlight = useRef(false)
  const blocked = useRef(false)
  const composing = useRef(false)
  const [open, setOpen] = useState(false)
  const [startup, setStartup] = useState<'idle' | 'opening' | 'failed'>('idle')
  const [busy, setBusy] = useState(false)
  const [observer, setObserver] = useState<string | null>(null)
  const observerDocument = useRef(false)
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
  useEffect(() => { alive.current = true; return () => { alive.current = false; openingRequest.current?.abort(); readingChanged.current?.() } }, [])
  useEffect(() => { readingChanged.current?.() }, [props.reading, props.revision, props.connection, props.epoch])
  useEffect(() => { if (open && startup === 'idle' && !observer) field.current?.focus({ preventScroll: true }) }, [open, startup, observer])
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
    const result = await context.request<SessionSnapshot>(current.scope === 'document' ? 'script:patch_document' : 'script:patch_block', {
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
    const acknowledged = current.scope === 'document' ? result.value.script.content : result.value.script.document?.blocks.find(block => block.id === current.blockId)?.text ?? current.text
    update({ ...newest, text: newest.text === current.text ? acknowledged : newest.text, revision: result.value.script.revision, acknowledgedText: acknowledged })
  }
  useEffect(() => {
    if (!open || startup !== 'idle' || observer || composition) return
    const timer = window.setTimeout(() => { void pump() }, 180)
    return () => window.clearTimeout(timer)
  }, [draft, open, startup, observer, props.editing, props.connection, composition])

  const acquire = async (blockId?: string, scope?: string, signal?: AbortSignal) => {
    const context = latest.current
    const current = () => alive.current && !signal?.aborted && latest.current.connection === 'connected'
      && latest.current.connectionId === context.connectionId && latest.current.epoch === context.epoch
    if (!current() || context.editing.active?.owner_id === context.connectionId) return null
    const payload = scope === 'document' ? { scope } : blockId ? { block_id: blockId } : {}
    const ready = (view: Props, revision: number) => {
      const cp = view.reading.checkpoint
      return cp && cp.source_id === view.reading.source_id && cp.script_revision === view.revision && cp.transport_revision === revision
    }
    // An already-paused, confirmed line needs only the server's edit grant.
    // The server still validates the checkpoint against any concurrent seek.
    if (context.transport.status === 'paused' && ready(context, context.transport.revision)) {
      const result = await context.request<SessionSnapshot>('script:begin_edit', payload)
      if (result.ok) return result.value
      if (!current() || !['reading_unavailable', 'pause_required'].includes(result.reason)) return null
    }
    const paused = await context.request<TransportState | SessionSnapshot>('transport:pause')
    if (!paused.ok || !current()) return null
    const pausedTransport = 'transport' in paused.value ? paused.value.transport : paused.value
    const deadline = performance.now() + 3_000
    while (current() && performance.now() < deadline) {
      const observed = latest.current
      if (ready(observed, pausedTransport.revision)) {
        const result = await context.request<SessionSnapshot>('script:begin_edit', payload)
        if (result.ok) return result.value
        if (result.reason !== 'reading_unavailable') return null
      }
      // Wake on the display's pushed checkpoint, including one received while
      // a request was in flight. No fixed sleep or repeated begin-edit polling.
      await new Promise<void>(resolve => {
        const done = () => {
          window.clearTimeout(timer)
          signal?.removeEventListener('abort', done)
          if (readingChanged.current === done) readingChanged.current = null
          resolve()
        }
        const timer = window.setTimeout(done, Math.max(0, deadline - performance.now()))
        readingChanged.current = done
        signal?.addEventListener('abort', done, { once: true })
        if (!current() || latest.current.reading !== observed.reading || latest.current.revision !== observed.revision) done()
      })
    }
    return null
  }
  const dismissStartup = () => {
    openingRequest.current?.abort()
    setStartup('idle'); setOpen(false); setMessage('')
  }
  const begin = async () => {
    if (busy || beginning.current) return
    setStartup('idle')
    if (draftRef.current && draftRef.current.text !== draftRef.current.acknowledgedText) {
      blocked.current = true; setOpen(true); setMessage('Your unsent draft is kept. Resume explicitly to send it.'); return
    }
    if (props.editing.active) {
      const edit = props.editing.active, block = props.document.blocks.find(item => item.id === edit.block_id)
      if (edit.owner_id === props.connectionId && block && props.epoch) {
        const text = edit.scope === 'document' ? izzyDocumentToLegacyText(props.document) : block.text
        blocked.current = false; setObserver(null); setMessage('')
        update({ epoch: props.epoch, blockId: block.id, text, acknowledgedText: text, revision: props.revision, scope: edit.scope ?? 'paragraph' })
      } else { observerDocument.current = edit.scope === 'document'; setObserver(edit.block_id) }
      setOpen(true); return
    }
    const controller = new AbortController(), context = latest.current
    openingRequest.current = controller
    beginning.current = true
    setBusy(true); setMessage(''); setStartup('opening'); setOpen(true); props.beforeOpen()
    try {
      const snapshot = await acquire(undefined, undefined, controller.signal)
      if (!alive.current || controller.signal.aborted) {
        // A grant may have reached the server just before cancellation. Release
        // it on the same connection before accepting another opening request.
        if (snapshot?.editing.active?.owner_id === context.connectionId && latest.current.connectionId === context.connectionId && latest.current.epoch === context.epoch) {
          const released = await context.request('script:end_edit')
          if (!released.ok && alive.current) setMessage('Could not finish closing the edit. Open Quick Edit to finish it.')
        }
        return
      }
      const edit = snapshot?.editing.active
      const block = snapshot?.script.document?.blocks.find(item => item.id === edit?.block_id)
      if (!snapshot || !edit || !block) { setStartup('failed'); setMessage('Could not prepare your paragraph. Keep the display connected and try again.'); return }
      blocked.current = false
      setObserver(null)
      update({ epoch: snapshot.session_epoch, blockId: block.id, text: block.text, acknowledgedText: block.text, revision: snapshot.script.revision, scope: 'paragraph' })
      setStartup('idle')
    } finally {
      openingRequest.current = null
      beginning.current = false
      if (alive.current) setBusy(false)
    }
  }
  const resume = async (useLiveText = false) => {
    const current = draftRef.current
    if (!current || busy) return
    const live = current.scope === 'document' ? { text: izzyDocumentToLegacyText(props.document) } : props.document.blocks.find((block) => block.id === current.blockId)
    if (!live || current.epoch !== props.epoch) { setMessage('This draft belongs to a different script. Copy it before closing.'); return }
    if (!useLiveText && live.text !== current.acknowledgedText && live.text !== current.text) {
      setMessage('The live text changed. Copy your draft, or choose Use live text to discard unsent changes.'); return
    }
    setBusy(true)
    const snapshot = props.editing.active?.owner_id === props.connectionId ? null : await acquire(current.blockId, current.scope)
    const owner = snapshot?.editing.active ?? latest.current.editing.active
    if (!alive.current) return
    setBusy(false)
    if (owner?.owner_id !== latest.current.connectionId || (current.scope === 'document' ? owner.scope !== 'document' : owner.block_id !== current.blockId || owner.scope === 'document')) {
      if (snapshot?.editing.active?.owner_id === latest.current.connectionId) await props.request('script:end_edit')
      setMessage('Another edit or reading position is active. Your draft is kept.'); return
    }
    const server = current.scope === 'document' ? snapshot?.script.content ?? live.text : snapshot?.script.document?.blocks.find((block) => block.id === current.blockId)?.text ?? live.text
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
  if (observer && props.editing.active) observerDocument.current = props.editing.active.scope === 'document'
  const observedText = observerDocument.current ? izzyDocumentToLegacyText(props.document) : props.document.blocks.find((block) => block.id === (props.editing.active?.block_id ?? observer))?.text ?? ''
  const owns = props.editing.active?.owner_id === props.connectionId
  const synced = Boolean(draft && draft.text === draft.acknowledgedText && !saving && !message && owns)
  const state = startup === 'opening' ? 'opening' : startup === 'failed' ? 'blocked' : observer ? 'readonly' : message ? 'blocked' : synced ? 'live' : 'pending'
  const storageFailed = !draftStored && draft?.text !== draft?.acknowledgedText
  const selectParagraph = async (selection: string) => {
    if (!synced || busy || composing.current || props.connection !== 'connected') return
    setBusy(true)
    const full = selection === 'document'
    const blockId = selection.slice('paragraph:'.length)
    const result = await props.request<SessionSnapshot>(full ? 'script:select_document' : 'script:select_block', full ? {} : { block_id: blockId })
    if (!alive.current) return
    setBusy(false)
    if (!result.ok) { setMessage('Could not select the paragraph. Your current draft is kept.'); return }
    const block = full ? { id: result.value.editing.active!.block_id, text: result.value.script.content } : result.value.script.document?.blocks.find(item => item.id === blockId)
    if (block) update({ epoch: result.value.session_epoch, blockId: block.id, text: block.text, acknowledgedText: block.text, revision: result.value.script.revision, scope: full ? 'document' : 'paragraph' })
  }

  return <>
    <QuickEditTrigger ref={trigger} disabled={busy || props.connection !== 'connected' || (!props.canEdit && !props.editing.active)} onClick={() => void begin()} aria-busy={busy} aria-label="Quick edit current paragraph">
      {busy ? 'CHECKPOINTING…' : props.editing.active ? 'VIEW LIVE EDIT' : 'QUICK EDIT'}
    </QuickEditTrigger>
    {!open && message && <p className="quick-edit-feedback" role="status">{message}</p>}
    <ParagraphEditor dialogRef={dialog} returnTo={trigger} open={open} state={state} title={startup !== 'idle' ? 'Quick edit' : (observer ? observerDocument.current : draft?.scope === 'document') ? 'Entire script' : 'Current paragraph'}
      status={startup === 'opening' ? 'Preparing…' : startup === 'failed' ? 'Not opened' : observer?'Read only':message?'Draft kept':synced?'Updated':'Updating…'}
      description={startup === 'opening' ? 'Preparing your paragraph. Playback will pause before editing begins.' : startup === 'failed' ? 'The editor did not open. You can retry or close this window.' : observer?'Another device is editing. Changes appear here as they happen.':'Playback is paused. Your changes appear on every connected screen as you type.'}
      onRequestClose={() => { if (startup !== 'idle') dismissStartup(); else if (observer || synced) void close() }} onDone={() => { if (startup !== 'idle') dismissStartup(); else void close() }}
      actionLabel={startup === 'opening' ? 'Cancel' : startup === 'failed' ? 'Close' : 'Done'} doneDisabled={startup === 'idle' && (busy || (!observer && !synced))}
      recoveryFooter={startup === 'idle' && message&&!observer?<button onClick={() => void close(true)} disabled={busy || saving}>Close · keep draft</button>:undefined}>
      {startup !== 'idle' ? <EditOpening failed={startup === 'failed'} message={message} onRetry={() => void begin()} /> : <>
      {!observer && <label className="edit-paragraph-select">EDIT
        <select aria-label="Text to edit" value={draft?.scope === 'document' ? 'document' : `paragraph:${draft?.blockId ?? ''}`} disabled={!synced || busy || composition} onChange={event => void selectParagraph(event.target.value)}>
          <option value="document">Entire script</option>
          {props.document.blocks.map((block, index) => <option key={block.id} value={`paragraph:${block.id}`}>{index + 1}. {block.text.slice(0, 64) || 'Empty paragraph'}</option>)}
        </select>
      </label>}
      <label className="sr-only" htmlFor="quick-edit-text">{(observer ? observerDocument.current : draft?.scope === 'document') ? 'SCRIPT TEXT' : 'CURRENT PARAGRAPH'}</label>
      <textarea id="quick-edit-text" ref={field} value={observer ? observedText : draft?.text ?? ''} readOnly={Boolean(observer) || busy} spellCheck
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
      </>}
    </ParagraphEditor>
  </>
}
