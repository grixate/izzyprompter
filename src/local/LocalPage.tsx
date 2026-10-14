import { BrandLogo } from '../components/BrandLogo'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createIzzyDocumentFromLegacyText, izzyDocumentToLegacyText } from '../domain/document'
import { createDebouncedStorageWriter, DEFAULT_PROMPT_SETTINGS, loadWorkspaceStorage } from '../domain/storage'
import { downloadScript } from '../domain/textBackup'
import { latestReading } from '../realtime/reading'
import { DisplaySurface } from '../pages/DisplayPage'
import { LocalSessionController, localId } from './controller'
import { validContent, validDocument } from './document'
import { checkOfflineApp, prepareOfflineApp } from './offline'
import { DirectPeer } from './peer'
import { PairingDialog, PairingPanel } from './PairingPanel'
import { preparedScripts, removePreparedScript, savePreparedScript, type PreparedScript } from './store'
import { useLocalSession } from './useLocalSession'
import { loadLocalEditorDraft, saveLocalEditorDraft, type LocalEditorDraft } from './editorDraft'
import './local.css'
import { PublicNav } from '../components/PublicNav'
import { track } from '../product/events'

function OfflinePreparation() {
  const [message, setMessage] = useState('Prepare the app on this device, then save each script. Browser storage can be cleared; keep a text backup.')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    void checkOfflineApp().then(ok => { if (active && ok) { setReady(true); setMessage('App available offline in this browser. Save each script separately below.') } })
    return () => { active = false }
  }, [])
  useEffect(() => { track('offline_mode_opened', { surface: 'local_workspace' }) }, [])
  return <section className="local-preparation" aria-label="Offline app preparation">
    <div className="offline-preparation-heading"><div><span className="product-kicker">01 / PREPARE THIS BROWSER</span><h2>{ready ? 'Ready to go offline.' : 'A little preparation. Then, anywhere.'}</h2></div><span className={`offline-readiness ${ready ? 'is-ready' : ''}`} role="status">{ready ? 'App prepared' : 'Preparation required'}</span></div>
    <button disabled={busy} onClick={() => {
      setBusy(true)
      void prepareOfflineApp().then(() => { setReady(true); setMessage('App available offline in this browser. Saved scripts are listed below.'); track('offline_pairing_ready', { surface: 'standalone' }) })
        .catch(error => setMessage(error.message)).finally(() => setBusy(false))
    }}>{busy ? 'Preparing app…' : 'Prepare app offline'}</button>
    <p role="status">{message}</p>
    <p className="offline-preparation-note">Want to use a phone remote? Prepare this app on both devices first. Direct pairing is an experimental preview and needs a reachable local network.</p>
  </section>
}
export { OfflinePreparation }

function LocalTake({ initial, onExit }: { initial: PreparedScript; onExit: (item: PreparedScript) => void }) {
  const [controller] = useState(() => new LocalSessionController(initial.document, initial.settings, initial.anchor))
  const session = useLocalSession(controller)
  const [peer, setPeer] = useState<DirectPeer | null>(null)
  const [pairing, setPairing] = useState(false), [message, setMessage] = useState('')
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
      <button onClick={() => { controller.suspend(); setPairing(true) }}>Pair remote preview</button>
      <button onClick={() => downloadScript(controller.getSnapshot().script.content)}>Export text</button>
      <button onClick={() => void flush()}>Save locally</button>
      <span role="status">{message}</span>
    </nav>
    {pairing && peer && <PairingDialog onClose={() => setPairing(false)}>
      <PairingPanel peer={peer} host onClose={() => setPairing(false)} />
    </PairingDialog>}
  </div>
}

export function LocalPage() {
  const [items, setItems] = useState<PreparedScript[]>([]), [selected, setSelected] = useState<PreparedScript | null>(null)
  const [content, setContent] = useState(''), [title, setTitle] = useState('Local script')
  const [take, setTake] = useState<PreparedScript | null>(null), [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false)
  const [removeArmed, setRemoveArmed] = useState(false)
  const [draftWriter] = useState(() => createDebouncedStorageWriter<LocalEditorDraft>({ delay: 250, write: saveLocalEditorDraft,
    onResult: ok => { if (!ok) setMessage('Draft recovery unavailable. Keep this tab open and save or export your text.') } }))
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
    const flush = () => { draftWriter.flush() }
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', hidden)
    return () => { flush(); draftWriter.dispose(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', hidden) }
  }, [draftWriter])
  useEffect(() => {
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
    const item: PreparedScript = { version: 1, document, settings: selected?.settings ?? { ...DEFAULT_PROMPT_SETTINGS },
      anchor: unchanged ? selected.anchor : null, savedAt: Date.now() }
    setBusy(true)
    try { await savePreparedScript(item); setMessage('Script saved on this device.'); setSelected(item); await refresh() }
    catch { setMessage('Local save failed. Text remains in this tab; export it before closing.'); setSelected(item) }
    finally { setBusy(false) }
    draftWriter.flush()
    if (start) setTake(item)
  }
  if (take) return <LocalTake initial={take} onExit={item => { setTake(null); select(item); void refresh() }} />
  return <main className="local-workspace offline-studio">
    <PublicNav mode="offline" beforeNavigate={() => draftWriter.flush()} />
    <div className="local-intro"><span className="product-kicker">FREE WITH IZZY / ON THIS DEVICE</span><h1>Offline mode.<br /><em>Ready for the field.</em></h1>
      <p>Prepare your browser. Save your words. Prompt without a live internet connection.</p></div>
    <OfflinePreparation />
    <div className="local-workspace-grid">
      <aside aria-label="Saved local scripts"><h2>Saved on this device</h2>{!loaded ? <p>Loading…</p> : items.length === 0 ? <p>No prepared scripts yet.</p> : items.map(item => <button key={item.document.id} onClick={() => select(item)} aria-pressed={selected?.document.id === item.document.id}>{item.document.title}</button>)}
        <button onClick={() => { setSelected(null); setTitle('Local script'); setContent(''); setRemoveArmed(false) }}>New local script</button>
        <a href="/local/remote">Open direct remote preview</a>
      </aside>
      <section className="local-editor" aria-label="Local script editor">
        <span className="product-kicker">02 / SAVE YOUR SCRIPT, THEN START</span>
        <label>Script title<input aria-label="Local script title" value={title} maxLength={200} onChange={event => setTitle(event.target.value)} /></label>
        <label>Script text<textarea aria-label="Local script text" value={content} onChange={event => { setContent(event.target.value); setMessage('Unsaved text. Save locally or export before closing.') }} spellCheck /></label>
        <div className="local-actions"><button disabled={busy || !content.trim()} onClick={() => void prepare(false)}>Save script offline</button>
          <button disabled={busy || !content.trim()} onClick={() => void prepare(true)}>Start local prompting</button>
          <button disabled={!content} onClick={() => downloadScript(content)}>Export text</button></div>
        <div className="local-actions"><button onClick={() => {
          const stored = loadWorkspaceStorage(); const text = stored.draft?.content ?? (stored.document ? izzyDocumentToLegacyText(stored.document) : '')
          if (!text) { setMessage('No editor draft found in this browser.'); return }
          setSelected(null); setContent(text); setTitle(stored.draft?.title ?? 'Editor draft'); setMessage('Draft copied here. Save it locally before leaving.')
        }}>Use current editor draft</button>
        <label className="local-file">Import TXT / MD<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''
          if (!file) return
          if (file.size > 2 * 1024 * 1024 || !/\.(txt|md)$/i.test(file.name)) { setMessage('Choose a TXT or MD file up to 2 MB.'); return }
          void file.text().then(text => { if (!validContent(text)) throw new Error(); setSelected(null); setContent(text); setTitle(file.name.slice(0, 200)); setMessage('Imported text. Save locally to prepare it.') }).catch(() => setMessage('Could not import this script. Existing text is kept.'))
        }} /></label>
        {selected && <button onClick={() => {
          if (!removeArmed) { setRemoveArmed(true); return }
          void removePreparedScript(selected.document.id).then(() => { setSelected(null); setRemoveArmed(false); setMessage('Local copy removed. Editor text is kept.'); void refresh() }).catch(() => setMessage('Could not remove this copy. Retry.'))
        }}>{removeArmed ? 'Confirm remove local copy' : 'Remove local copy'}</button>}</div>
        <p className="local-status" role="status">{message}</p>
      </section>
    </div>
  </main>
}
