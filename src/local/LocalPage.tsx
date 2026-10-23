import { ArrowRight, Check, Download, FileText, Monitor, Plus, Smartphone, Upload } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createIzzyDocumentFromLegacyText, izzyDocumentToLegacyText } from '../domain/document'
import { createDebouncedStorageWriter, DEFAULT_PROMPT_SETTINGS, loadWorkspaceStorage } from '../domain/storage'
import { downloadScript } from '../domain/textBackup'
import { latestReading } from '../realtime/reading'
import { DisplaySurface } from '../pages/DisplayPage'
import { LocalSessionController, localId } from './controller'
import { validContent, validDocument } from './document'
import { OfflinePreparation } from './OfflinePreparation'
import { DirectPeer } from './peer'
import { PairingDialog, PairingPanel } from './PairingPanel'
import { preparedScripts, removePreparedScript, savePreparedScript, type PreparedScript } from './store'
import { useLocalSession } from './useLocalSession'
import { loadLocalEditorDraft, saveLocalEditorDraft, type LocalEditorDraft } from './editorDraft'
import './local.css'
import { PublicNav, PublicFooter } from '../components/PublicNav'
import { track } from '../product/events'

function LocalTake({ initial, connectPhone, onExit }: { initial: PreparedScript; connectPhone: boolean; onExit: (item: PreparedScript) => void }) {
  const [controller] = useState(() => new LocalSessionController(initial.document, initial.settings, initial.anchor))
  const session = useLocalSession(controller)
  const [peer, setPeer] = useState<DirectPeer | null>(null)
  const [pairing, setPairing] = useState(connectPhone), [message, setMessage] = useState('')
  const closePairing = () => {
    if (peer?.getSnapshot().connection !== 'connected') peer?.close('Connection cancelled. Read on this device.')
    setPairing(false)
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alive = useRef(true)
  const takeRef = useRef<HTMLDivElement>(null), toolsRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const measure = () => takeRef.current?.style.setProperty('--local-tools-height', `${Math.ceil(toolsRef.current?.getBoundingClientRect().height ?? 0)}px`)
    const observer = new ResizeObserver(measure)
    if (toolsRef.current) observer.observe(toolsRef.current)
    measure()
    return () => observer.disconnect()
  }, [])
  const record = useCallback((): PreparedScript => {
    const s = controller.getSnapshot()
    return { version: 1, document: s.script.document!, settings: { ...s.display_settings!, speed: s.transport.speed },
      anchor: latestReading(s.reading, s.transport, s.script.revision)?.anchor ?? initial.anchor, savedAt: Date.now() }
  }, [controller, initial.anchor])
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    try { await savePreparedScript(record()); if (alive.current) setMessage('Saved on this device') }
    catch { if (alive.current) setMessage('Local save failed. Keep this tab open, retry or export your text.') }
  }, [record])
  useEffect(() => {
    alive.current = true
    const direct = new DirectPeer(controller); setPeer(direct)
    const save = () => { if (!timer.current) timer.current = setTimeout(() => { timer.current = null; void flush() }, 700) }
    const suspend = () => { controller.suspend(); void flush() }
    const hidden = () => { if (document.visibilityState === 'hidden') suspend() }
    const unsubscribe = controller.subscribe(save)
    save()
    document.addEventListener('visibilitychange', hidden)
    document.addEventListener('freeze', suspend)
    window.addEventListener('pagehide', suspend)
    return () => {
      alive.current = false; unsubscribe(); direct.dispose()
      document.removeEventListener('visibilitychange', hidden); document.removeEventListener('freeze', suspend); window.removeEventListener('pagehide', suspend)
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      void savePreparedScript(record()).catch(() => {})
    }
  }, [controller, flush, record])
  return <div className="local-take" ref={takeRef}>
    <DisplaySurface sessionId="LOCAL" session={session} onSettingsChange={controller.settings} />
    <nav className="local-take-tools" ref={toolsRef} aria-label="Local take actions">
      <button onClick={() => { controller.suspend(); void flush().then(() => onExit(record())) }}>Back to local scripts</button>
      <button onClick={() => { controller.suspend(); setPairing(true) }}>Connect phone</button>
      <button onClick={() => downloadScript(controller.getSnapshot().script.content)}>Export text</button>
      <button onClick={() => void flush()}>Save locally</button>
      <span role="status">{message}</span>
    </nav>
    {pairing && peer && <PairingDialog onClose={closePairing}>
      <PairingPanel peer={peer} host onClose={closePairing} />
    </PairingDialog>}
  </div>
}

export function LocalPage() {
  const [items, setItems] = useState<PreparedScript[]>([]), [selected, setSelected] = useState<PreparedScript | null>(null)
  const [content, setContent] = useState(''), [title, setTitle] = useState('Local script')
  const [take, setTake] = useState<PreparedScript | null>(null), [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false)
  const [removeArmed, setRemoveArmed] = useState(false)
  const [control, setControl] = useState<'device' | 'phone'>('device')
  const uploadRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { track('offline_mode_opened', { surface: 'local_workspace' }) }, [])
  const [draftWriter] = useState(() => createDebouncedStorageWriter<LocalEditorDraft>({ delay: 250, write: saveLocalEditorDraft,
    onResult: ok => { if (!ok) setMessage('Draft recovery unavailable. Keep this tab open and save or export your text.') } }))
  const latestDraft = useRef<{ ready: boolean; value: LocalEditorDraft } | null>(null)
  latestDraft.current = { ready: loaded && !take, value: { version: 1, title, content, documentId: selected?.document.id ?? null, updatedAt: Date.now() } }
  const flushDraft = useCallback(() => {
    // Navigation can arrive before the autosave effect schedules the latest input.
    if (latestDraft.current?.ready) draftWriter.schedule(latestDraft.current.value)
    draftWriter.flush()
  }, [draftWriter])
  const refresh = () => preparedScripts().then(setItems).catch(() => setMessage('Local storage unavailable. You can prompt in this tab; export your text before closing.')).finally(() => setLoaded(true))
  useEffect(() => {
    const draft = loadLocalEditorDraft()
    void preparedScripts().then(records => {
      setItems(records)
      if (draft) {
        const saved = records.find(item => item.document.id === draft.documentId)
        setSelected(saved ?? null)
        setTitle(saved && saved.savedAt > draft.updatedAt ? saved.document.title : draft.title)
        setContent(saved && saved.savedAt > draft.updatedAt ? izzyDocumentToLegacyText(saved.document) : draft.content)
      }
    }).catch(() => {
      if (draft) { setContent(draft.content); setTitle(draft.title) }
      setMessage('Local storage unavailable. Export your text before closing.')
    }).finally(() => setLoaded(true))
  }, [])
  useEffect(() => {
    if (loaded && !take) draftWriter.schedule({ version: 1, title, content, documentId: selected?.document.id ?? null, updatedAt: Date.now() })
  }, [title, content, selected?.document.id, loaded, take, draftWriter])
  useEffect(() => {
    const flush = flushDraft
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', hidden)
    return () => { flush(); draftWriter.dispose(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', hidden) }
  }, [draftWriter, flushDraft])
  useEffect(() => {
    document.title = 'Offline — IZZY'
    const link = document.createElement('link'); link.rel = 'manifest'; link.href = '/manifest.webmanifest'; document.head.appendChild(link)
    return () => link.remove()
  }, [])
  const select = (item: PreparedScript) => {
    setSelected(item); setContent(izzyDocumentToLegacyText(item.document)); setTitle(item.document.title); setRemoveArmed(false)
  }
  const prepare = async (start: boolean) => {
    if (!validContent(content) || !title.trim() || title.trim().length > 200) { setMessage('Use a title up to 200 characters and a script up to 2 MB / 5,000 paragraphs.'); return }
    const unchanged = selected && content === izzyDocumentToLegacyText(selected.document)
    const document = unchanged ? { ...selected.document, title: title.trim() }
      : createIzzyDocumentFromLegacyText(content, { documentId: selected?.document.id ?? `local-${localId()}`, title: title.trim() })
    if (!validDocument(document)) { setMessage('Script is invalid or too large. Your text is kept here.'); return }
    const item: PreparedScript = { version: 1, document, settings: { ...(selected?.settings ?? DEFAULT_PROMPT_SETTINGS), speed: loadWorkspaceStorage().settings.speed },
      anchor: unchanged ? selected.anchor : null, savedAt: Date.now() }
    setBusy(true)
    try { await savePreparedScript(item); setMessage('Script saved on this device.'); setSelected(item); await refresh() }
    catch { setMessage('Local save failed. Text remains in this tab; export it before closing.'); setSelected(item) }
    finally { setBusy(false) }
    draftWriter.flush()
    if (start) setTake(item)
  }
  if (take) return <LocalTake initial={take} connectPhone={control === 'phone'} onExit={item => { setTake(null); select(item); void refresh() }} />
  return <main className="local-workspace offline-studio product-page">
    <PublicNav mode="offline" beforeNavigate={flushDraft} />
    <header className="offline-workspace-heading">
      <span className="eyebrow">OFFLINE WORKSPACE</span>
      <h1>Your words. <em>Anywhere.</em></h1>
      <p>Add your script, choose your controls, and read. No account needed.</p>
    </header>
    <OfflinePreparation />
    <div className="offline-flow">
      <section className="local-editor offline-step" aria-labelledby="offline-script-heading">
        <header className="offline-step-heading"><span className="offline-step-number" aria-hidden="true">01</span><div><h2 id="offline-script-heading">Add your words</h2><p>Paste your text or bring a script you already have.</p></div></header>
        <div className="offline-import-actions">
          <button disabled={!loaded || busy} onClick={() => uploadRef.current?.click()}><Upload size={17} />Upload text file<span>TXT / MD</span></button>
          <input ref={uploadRef} className="offline-file-input" type="file" aria-label="Upload script file" accept=".txt,.md,text/plain,text/markdown" onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''
            if (!file) return
            if (file.size > 2 * 1024 * 1024 || !/\.(txt|md)$/i.test(file.name)) { setMessage('Choose a TXT or MD file up to 2 MB.'); return }
            void file.text().then(text => { if (!validContent(text)) throw new Error(); setSelected(null); setContent(text); setTitle(file.name.slice(0, 200)); setRemoveArmed(false); setMessage('Text imported. Choose your controls and start reading.') }).catch(() => setMessage('Could not upload this script. Existing text is kept.'))
          }} />
          <button disabled={!loaded || busy} onClick={() => {
            const stored = loadWorkspaceStorage(); const text = stored.draft?.content ?? (stored.document ? izzyDocumentToLegacyText(stored.document) : '')
            if (!text) { setMessage('No editor draft found in this browser. Paste or upload your text.'); return }
            setSelected(null); setContent(text); setTitle(stored.draft?.title ?? 'Editor draft'); setRemoveArmed(false); setMessage('Editor draft copied here. Your online text is unchanged.')
          }}><FileText size={17} />Use online draft</button>
        </div>
        <label>Script title<input ref={titleRef} aria-label="Local script title" disabled={!loaded || busy} value={title} maxLength={200} onChange={event => setTitle(event.target.value)} /></label>
        <label className="offline-text-label"><span>Script text<span className="offline-word-count">{content.trim() ? `${content.trim().split(/\s+/).length.toLocaleString()} words` : 'Or paste here'}</span></span><textarea aria-label="Local script text" disabled={!loaded || busy} placeholder="Paste the words you want to read…" value={content} onChange={event => { setContent(event.target.value); setMessage('') }} spellCheck /></label>
        <div className="offline-script-actions">
          <button disabled={busy || !loaded || !content.trim()} onClick={() => void prepare(false)}><Check size={16} />Save script offline</button>
          <button disabled={!content} onClick={() => downloadScript(content)}><Download size={16} />Export text</button>
        </div>
        <p className="local-status" role="status">{message || (!loaded ? 'Opening your scripts…' : 'Your draft stays in this browser as you type.')}</p>
      </section>
      <section className="offline-control-step offline-step" aria-labelledby="offline-controls-heading">
        <header className="offline-step-heading"><span className="offline-step-number" aria-hidden="true">02</span><div><h2 id="offline-controls-heading">Choose your controls</h2><p>This device is always your reading screen.</p></div></header>
        <fieldset className="offline-control-choices" disabled={busy}><legend className="sr-only">Control your take</legend>
          <label className={control === 'device' ? 'is-selected' : ''}><input type="radio" name="offline-control" value="device" checked={control === 'device'} onChange={() => setControl('device')} /><Monitor size={24} aria-hidden="true" /><span><strong>Use this device</strong><span>Play, pause and adjust your reading right here.</span></span><Check className="offline-choice-check" size={18} aria-hidden="true" /></label>
          <label className={control === 'phone' ? 'is-selected' : ''}><input type="radio" name="offline-control" value="phone" checked={control === 'phone'} onChange={() => setControl('phone')} /><Smartphone size={24} aria-hidden="true" /><span><strong>Connect a phone <small>Experimental</small></strong><span>Read here. Control your take from your phone.</span></span><Check className="offline-choice-check" size={18} aria-hidden="true" /></label>
        </fieldset>
        <div className="offline-start">
          <p>{control === 'phone' ? 'Keep both devices on the same Wi-Fi. Next, exchange a connection file with your phone. Prepare IZZY on both devices before leaving internet.' : 'Your script saves on this device when you start. Use the on-screen controls or your keyboard.'}</p>
          <button className="offline-primary" disabled={!loaded || busy || !content.trim()} onClick={() => void prepare(true)}>{busy ? 'Saving script…' : control === 'phone' ? 'Connect phone & start' : 'Start reading'}<ArrowRight size={18} /></button>
          {!content.trim() && <span className="offline-start-hint">Add your text in step 1 to begin.</span>}
        </div>
        <p className="offline-phone-entry">Using this phone as the remote?<a href="/local/remote" onClick={flushDraft}>Open phone controls <ArrowRight size={14} /></a></p>
      </section>
    </div>
    <section className="offline-library" aria-labelledby="offline-library-heading">
      <header><div><h2 id="offline-library-heading">Saved on this device</h2><p>Pick a script to keep going, or start fresh.</p></div><button disabled={!loaded || busy} onClick={() => { setSelected(null); setTitle('Local script'); setContent(''); setRemoveArmed(false); setMessage('New script. Paste or upload your text.'); titleRef.current?.focus() }}><Plus size={17} />New script</button></header>
      {items.length ? <div className="offline-saved-scripts">{items.map(item => <button key={item.document.id} disabled={busy} onClick={() => select(item)} aria-pressed={selected?.document.id === item.document.id}><FileText size={20} /><span>{item.document.title}</span><ArrowRight size={17} /></button>)}</div> : <p className="offline-library-empty">{loaded ? 'Your saved scripts will appear here.' : 'Opening your saved scripts…'}</p>}
      {selected && <button className="offline-remove" disabled={busy} onClick={() => {
        if (!removeArmed) { setRemoveArmed(true); return }
        void removePreparedScript(selected.document.id).then(() => { setSelected(null); setRemoveArmed(false); setMessage('Local copy removed. Editor text is kept.'); void refresh() }).catch(() => setMessage('Could not remove this copy. Retry.'))
      }}>{removeArmed ? 'Confirm remove local copy' : 'Remove selected local copy'}</button>}
    </section>
    <p className="offline-backup-note">Stored in this browser, on this device. Export a text backup before clearing browser data.</p>
    <PublicFooter beforeNavigate={flushDraft} offlineHint />
  </main>
}
