import { MIN_SPEED, MAX_SPEED, SPEED_STEP, boundedSpeed } from '../prompt/speed'
import { proSkinCount } from '../product/catalog'
import { BrandLogo } from '../components/BrandLogo'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Copy, Download, Plus, Trash2, Upload } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAccount } from '../account/AccountProvider'
import { accountApi, accountMessage, AccountError, type Account, type SavedScript, type ScriptSummary, type Preset } from '../account/api'
import { ProjectFolders, useProjectFolders } from '../account/ProjectFolders'
import { useSavedScript } from '../account/useSavedScript'
import { listPending, type PendingEdit } from '../account/pendingEdits'
import { DEFAULT_PROMPT_SETTINGS, loadWorkspaceStorage, rememberPlaybackSpeed, type PromptSettingsV1 } from '../domain/storage'
import { izzyDocumentToLegacyText } from '../domain/document'
import { prepareScriptImport, validateScriptFile } from '../domain/fileImport'
import { downloadScript } from '../domain/textBackup'
import { FieldCount } from '../components/FieldCount'
import { LivePreview } from '../components/LivePreview'
import { sessionLink, isSessionCredentials, type SessionCredentials } from '../realtime/credentials'
import { useSession } from '../realtime/useSession'
import { apiUrl } from '../realtime/endpoints'
import { safeReturnTo, purchaseReturn } from '../product/navigation'
import { LegalLinks, PurchaseTerms } from '../legal/LegalLinks'
import { useProduct } from '../product/ProductProvider'
import { track } from '../product/events'
import { FeedbackForm } from '../account/FeedbackForm'

export function AccountPage() {
  const { status, loading, refresh } = useAccount()
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [email, setEmail] = useState('')
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'))
  const [returnTo] = useState(() => {
    const query = new URLSearchParams(window.location.search)
    return safeReturnTo(query.get('returnTo')) ?? safeReturnTo(`/account?purchase=${query.get('purchase')}`)
  })
  useEffect(() => {
    // Capture first, then scrub the credential. State initializers must stay
    // pure: React can invoke them twice before committing the login screen.
    if (token) window.history.replaceState(null, '', window.location.pathname)
  }, [token])
  const scriptId = window.location.pathname.split('/')[3]
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setWorking(true)
    try {
      if (token) {
        await accountApi('/login', 'POST', { token })
        await refresh()
        window.location.replace(returnTo ?? '/account')
      } else {
        await accountApi('/login-link', 'POST', { email, ...(returnTo ? { return_to: returnTo } : {}) })
        setNotice('Check your email. Your sign-in link is valid for 15 minutes.')
      }
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setWorking(false) }
  }
  const logout = async () => {
    try { await accountApi('/logout', 'POST', {}); await refresh(); window.location.assign('/') }
    catch (error) { setNotice(accountMessage(error)) }
  }
  return <main className="start-page workbench-page account-page">
    <header className="start-header">
      <a href="/" aria-label="IZZY home"><BrandLogo /></a>
      <nav aria-label="Account navigation">{status?.user ? <><a href="/account" aria-current={scriptId ? undefined : 'page'}>My scripts</a><button onClick={() => void logout()}>Log out</button></> : <a href="/">Back to prompter</a>}</nav>
    </header>
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {loading ? <p className="account-loading">Opening your workspace…</p> : !status?.user || token ? <section className="account-login">
      <span className="section-index">IZZY / YOUR WORKSPACE</span>
      <h1>Your words.<br />Ready when you are.</h1>
      <p>Keep three scripts free. Pick up on another screen. Your remote stays just one scan away.</p>
      {!status?.enabled ? <p className="account-notice">Accounts aren’t configured on this server yet. You can still use the prompter without signing in.</p> : <form onSubmit={event => void submit(event)}>
        {token ? <p>Continue to use your one-time sign-in link.</p> : <label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
        <button className="account-primary" disabled={working}>{working ? 'Please wait…' : token ? 'Sign in to IZZY' : 'Email me a sign-in link'}<ArrowUpRight size={17} /></button>
        {status.google_enabled && !token && <a className="account-google" href={returnTo ? `/auth/google?returnTo=${encodeURIComponent(returnTo)}` : '/auth/google'}>Continue with Google</a>}
      </form>}
      <p className="sign-in-legal">Read our <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</p>
      <a className="account-guest" href="/">Or continue without an account <ArrowUpRight size={14} /></a>
      {new URLSearchParams(window.location.search).get('error') && <p role="alert">{new URLSearchParams(window.location.search).get('error') === 'sign_in_to_link' ? 'This email already has an IZZY account. Sign in by email, then link Google from your workspace.' : 'Google sign-in could not be completed. Please try an email link.'}</p>}
    </section> : scriptId ? <SavedEditor key={`${status.user.id}:${scriptId}`} user={status.user} id={scriptId} /> : <LibraryWorkspace user={status.user} />}
    {(!status?.user || !scriptId || token) && <footer className="account-legal-footer"><LegalLinks /></footer>}
  </main>
}

function LibraryWorkspace({ user }: { user: Account }) {
  const { status } = useAccount()
  const product = useProduct()
  const [pending, setPending] = useState<PendingEdit[]>([])
  const [scripts, setScripts] = useState<ScriptSummary[]>([])
  const [search, setSearch] = useState('')
  const [trash, setTrash] = useState(false)
  const [project, setProject] = useState('')
  const folderState = useProjectFolders(user.id)
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [guestDraft] = useState(() => {
    const local = loadWorkspaceStorage()
    return local.draft?.content ?? (local.document ? izzyDocumentToLegacyText(local.document) : '')
  })
  useEffect(() => {
    void listPending(user.id).then(setPending).catch(() => {})
  }, [user.id])
  useEffect(() => {
    let active = true
    let request = 0
    const load = async () => {
      const sequence = ++request
      try {
        const result = await accountApi<{ scripts: ScriptSummary[] }>(`/scripts?q=${encodeURIComponent(search)}&trash=${trash}&page=${page}&folder_id=${encodeURIComponent(project)}`)
        if (active && sequence === request) { setScripts(result.scripts); setLoaded(true) }
      } catch (error) { if (active) setNotice(accountMessage(error)) }
    }
    const timer = window.setTimeout(() => { void load() }, 180)
    const refresh = () => { void load() }
    window.addEventListener('izzy:account-update', refresh)
    window.addEventListener('online', refresh)
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener('izzy:account-update', refresh); window.removeEventListener('online', refresh) }
  }, [search, trash, page, project])
  const create = async (title = 'Untitled script', content = '') => {
    setBusy(true)
    try { const script = await accountApi<SavedScript>('/scripts', 'POST', { title, content, folder_id: project && project !== 'unfiled' && user.pro ? project : null }); window.location.assign(`/account/scripts/${script.id}`) }
    catch (error) { setNotice(accountMessage(error)); setBusy(false) }
  }
  const action = async (script: ScriptSummary, name: 'duplicate' | 'delete' | 'restore') => {
    setBusy(true)
    try {
      await accountApi(`/scripts/${script.id}${name === 'delete' ? '' : `/${name}`}`, name === 'delete' ? 'DELETE' : 'POST', {})
      window.dispatchEvent(new Event('izzy:account-update'))
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  const move = async (script: ScriptSummary, folderId: string) => {
    setBusy(true)
    try {
      await accountApi(`/scripts/${script.id}/folder`, 'PATCH', { folder_id: folderId || null })
      window.dispatchEvent(new Event('izzy:account-update'))
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  const importFile = async (files: FileList | null) => {
    const item = files?.[0]
    if (!item) return
    const valid = validateScriptFile(item)
    if (!valid.ok) { setNotice(valid.message); return }
    try {
      const imported = prepareScriptImport(item, await item.text())
      if (imported.ok) await create(imported.title, imported.content); else setNotice(imported.message)
    } catch { setNotice('The file could not be read. Your saved scripts are unchanged.') }
  }
  return <div className="account-layout">
    <section className="account-library">
      {trash && <button className="account-back library-back" onClick={() => { setTrash(false); setPage(0) }}><ArrowLeft size={16} />Back to scripts</button>}
      <div className="account-eyebrow"><span>WORKSPACE / {user.pro ? 'PRO' : 'FREE · 3 SCRIPTS'}</span><span>{user.email}</span></div>
      <ProjectFolders pro={user.pro} {...folderState} value={project} onChange={id => { setProject(id); setPage(0) }} />
      <div className="account-title-row"><h1>{trash ? 'Trash' : folderState.folders.find(folder => folder.id === project)?.name ?? (project === 'unfiled' ? 'No project' : 'Your scripts')}</h1>{!trash && <button className="account-primary" disabled={busy} onClick={() => void create()}><Plus size={16} />New script</button>}</div>
      <div className="library-toolbar"><label className="sr-only" htmlFor="library-search">Search scripts</label><input id="library-search" type="search" placeholder="Find a title or a line…" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} />
        {!trash && <><button onClick={() => { setTrash(true); setPage(0) }}><Trash2 size={16} />Trash</button>
        <button disabled={busy} onClick={() => file.current?.click()}><Upload size={16} />Upload</button></>}
        <input ref={file} hidden type="file" accept=".txt,.md" onChange={event => { void importFile(event.target.files); event.target.value = '' }} />
      </div>
      {notice && <p className="account-notice" role="status">{notice}{!user.pro && product?.checkout_available && notice === accountMessage(new AccountError('script_limit', 422)) && <> <a href="/pro" onClick={() => track('script_limit_upgrade_clicked', { source: 'library' })}>Explore unlimited scripts with Pro</a></>}</p>}
      {pending.map(draft => <div className="guest-adoption" key={`${draft.scriptId}:${draft.draftId}`}><div><strong>Unsent device draft · {draft.title}</strong><p>Review this tab’s saved changes before synchronizing.</p></div><a href={`/account/scripts/${draft.scriptId}#draft=${draft.draftId}`}>Recover draft</a></div>)}
      {guestDraft && !trash && !search && page === 0 && <div className="guest-adoption"><div><strong>A draft on this device</strong><p>Keep a separate copy in this account. Nothing is moved automatically.</p></div><button disabled={busy} onClick={() => void create('Uploaded device draft', guestDraft)}>Save a copy</button></div>}
      <div className="script-list">{scripts.map((script, index) => <article key={script.id} className="script-card">
        <span className="script-number">{String(page * 30 + index + 1).padStart(2, '0')}</span>
        <div>{trash ? <h2>{script.title}</h2> : <a href={`/account/scripts/${script.id}`}><h2>{script.title}</h2></a>}<p>{script.excerpt || 'A clean page. Ready for your next take.'}</p><span className="script-date">{trash ? 'TRASH · RETAINED FOR 30 DAYS' : `SAVED ${new Date(script.updated_at).toLocaleDateString()}`}</span></div>
        <div className="script-card-actions">{!trash && folderState.folders.length > 0 && <label className="script-project"><span className="sr-only">Project for {script.title}</span><select aria-label={`Project for ${script.title}`} value={script.folder_id ?? ''} disabled={busy || (!user.pro && !script.folder_id)} onChange={event => void move(script, event.target.value)}><option value="">No project</option>{folderState.folders.map(folder => <option key={folder.id} value={folder.id} disabled={!user.pro}>{folder.name}</option>)}</select></label>}{trash ? <button disabled={busy} onClick={() => void action(script, 'restore')}>Restore</button> : <><button title="Duplicate script" aria-label={`Duplicate ${script.title}`} disabled={busy} onClick={() => void action(script, 'duplicate')}><Copy size={15} /></button><button title="Move to trash" aria-label={`Move ${script.title} to trash`} disabled={busy} onClick={() => void action(script, 'delete')}><Trash2 size={15} /></button></>}</div>
      </article>)}</div>
      {loaded && !scripts.length && <p className="library-empty">{trash ? 'Nothing in trash.' : search ? 'No matching scripts.' : 'Your next take starts with a few words. Create a script or upload a text file.'}</p>}
      <div className="library-pagination"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>PAGE {page + 1}</span><button disabled={scripts.length < 30} onClick={() => setPage(value => value + 1)}>Next</button></div>
      {status?.google_enabled && <a className="account-google" href="/auth/google">Link Google to this account</a>}
    </section>
    <aside className="account-sidebar"><ProPanel user={user} /><PresetPanel user={user} />{!user.pro && <WorkspaceGuide />}{status?.feedback_enabled && <FeedbackForm key={user.id} accountId={user.id} />}</aside>
  </div>
}

function WorkspaceGuide() {
  return <section className="workspace-guide" aria-labelledby="workspace-guide-title">
    <span className="section-index">WORKFLOW / THREE STEPS</span>
    <h2 id="workspace-guide-title">From words to a take.</h2>
    <ol>
      <li><strong>Save your words.</strong><p>Keep up to three scripts in your account. Edit before or during a session.</p></li>
      <li><strong>Open the reading screen.</strong><p>Start from your tablet and choose Set up prompter.</p></li>
      <li><strong>Pair your phone.</strong><p>Scan the QR code for play, pause, speed and live corrections.</p></li>
    </ol>
    <p className="workspace-connection-note">Both devices need an internet connection to IZZY. They don’t need to share Wi-Fi.</p>
  </section>
}

function SavedEditor({ user, id }: { user: Account; id: string }) {
  const editor = useSavedScript(user.id, id)
  const [pairingOrigin, setPairingOrigin] = useState(window.location.origin)
  useEffect(() => {
    if (!import.meta.env.DEV || !/^517\d$/.test(window.location.port) || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return
    let active = true
    void fetch(apiUrl('network')).then(response => response.json()).then((data: { hosts?: string[] }) => {
      if (active && data.hosts?.[0]) setPairingOrigin(`${window.location.protocol}//${data.hosts[0]}:${window.location.port}`)
    }).catch(() => {})
    return () => { active = false }
  }, [])
  const [session, setSession] = useState<SessionCredentials | null>(() => {
    try { const value: unknown = JSON.parse(sessionStorage.getItem(`izzy:saved-session:${user.id}:${id}`) || 'null'); return isSessionCredentials(value) ? value : null } catch { return null }
  })
  const { connection, presence, transport } = useSession(session?.session_id ?? null, 'editor', session?.tokens.editor)
  useEffect(() => {
    if (connection === 'connected') rememberPlaybackSpeed(transport.speed)
  }, [connection, transport.speed])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewPause, setPreviewPause] = useState(0)
  const [presets, setPresets] = useState<Preset[]>([])
  const [preset, setPreset] = useState('')
  const pairing = useRef<HTMLDialogElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    void accountApi<{ presets: Preset[] }>('/presets').then(result => { if (active) { setPresets(result.presets); setPreset(result.presets.find(p => p.is_default)?.id ?? '') } }).catch(() => {})
    return () => { active = false }
  }, [])
  const setPairing = (value: SessionCredentials | null) => {
    setSession(value)
    try { if (value) sessionStorage.setItem(`izzy:saved-session:${user.id}:${id}`, JSON.stringify(value)); else sessionStorage.removeItem(`izzy:saved-session:${user.id}:${id}`) } catch { /* Live controls remain usable. */ }
  }
  const start = async () => {
    setBusy(true)
    try {
      await editor.save()
      if (editor.hasPending()) { setNotice('Save or resolve your pending changes before starting a session.'); return }
      const created = await accountApi<SessionCredentials>(`/scripts/${id}/session`, 'POST', { preset_id: user.pro && preset ? preset : 'standard', speed: loadWorkspaceStorage().settings.speed })
      if (!isSessionCredentials(created)) throw new Error('Invalid session')
      setPairing(created)
      pairing.current?.showModal()
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  const end = async () => {
    try { await accountApi(`/scripts/${id}/session`, 'DELETE', {}); setPairing(null); pairing.current?.close() }
    catch (error) { setNotice(accountMessage(error)) }
  }
  const applyPreset = async () => {
    try { await accountApi(`/scripts/${id}/apply-preset`, 'POST', { preset_id: preset }); setNotice('Preset applied to connected displays.') }
    catch (error) { setNotice(accountMessage(error)) }
  }
  const importText = async (files: FileList | null) => {
    const item = files?.[0]
    if (!item) return
    const valid = validateScriptFile(item)
    if (!valid.ok) { setNotice(valid.message); return }
    try {
      const result = prepareScriptImport(item, await item.text())
      if (result.ok) editor.edit({ title: result.title, content: result.content }); else setNotice(result.message)
    } catch { setNotice('The file could not be read. Your draft is unchanged.') }
  }
  const displayUrl = session ? sessionLink(pairingOrigin, session, 'display') : ''
  const remoteUrl = session ? sessionLink(pairingOrigin, session, 'remote') : ''
  return <section className="saved-editor">
    <a className="account-back" href="/account"><ArrowLeft size={15} />All scripts</a>
    <div className="workbench-stage"><div className="script-workspace">
      <label className="saved-title">SCRIPT TITLE<input aria-label="Script title" aria-describedby="saved-title-count" maxLength={200} disabled={!editor.ready} value={editor.draft?.title ?? ''} onChange={event => { if (editor.draft) editor.edit({ ...editor.draft, title: event.target.value }) }} /></label>
      <FieldCount id="saved-title-count" value={editor.draft?.title ?? ''} title />
      <div className="editor-label"><label htmlFor="saved-script-input">YOUR SCRIPT</label><div className="editor-meta"><button disabled={!editor.ready} onClick={() => file.current?.click()}><Upload size={13} />Replace from text file</button><button disabled={!editor.draft} onClick={() => downloadScript(editor.draft?.content ?? '', 'izzy-script.txt')}><Download size={13} />Export</button></div></div>
      <div className="editor-input has-content"><textarea id="saved-script-input" aria-label="Saved script text" aria-describedby="saved-content-count" disabled={!editor.ready} value={editor.draft?.content ?? ''} onFocus={() => setPreviewPause(value => value + 1)} onChange={event => { if (editor.draft) editor.edit({ ...editor.draft, content: event.target.value }); setPreviewPause(value => value + 1) }} placeholder="Write your next take…" /></div>
      <FieldCount id="saved-content-count" value={editor.draft?.content ?? ''} />
      <input hidden ref={file} type="file" accept=".txt,.md" onChange={event => { void importText(event.target.files); event.target.value = '' }} />
      <p className="account-save-status" role="status">{editor.status}</p>
      {editor.conflict && <div className="account-conflict" role="alert"><p>A newer version is saved in your account. Your local words are safe here.</p><button disabled={editor.busy} onClick={() => void editor.resolve('saved')}>Use saved version</button><button disabled={editor.busy} onClick={() => void editor.resolve('mine')}>Keep my version</button><button disabled={editor.busy} onClick={() => void editor.resolve('copy')}>Save as copy</button></div>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
      {user.pro && presets.length > 0 && <div className="preset-session"><label>READING PROFILE<select value={preset} onChange={event => setPreset(event.target.value)}><option value="">Standard settings</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{session && preset && <button onClick={() => void applyPreset()}>Apply live</button>}</div>}
      <div className="workspace-actions">{session ? <><button onClick={() => pairing.current?.showModal()}>Pair devices</button><button onClick={() => void end()}>End session</button></> : <button className="start-button" disabled={busy || !editor.ready || !editor.draft?.content.trim() || editor.busy || !!editor.conflict} onClick={() => void start()}>{busy ? 'STARTING…' : 'SET UP PROMPTER'}<ArrowUpRight /></button>}</div>
      {session && <p className="setup-hint">{connection.toUpperCase()} · DISPLAY {presence.display} / REMOTE {presence.remote}{connection === 'expired' ? ' · End this session to start a new one.' : ''}</p>}
    </div><LivePreview content={editor.draft?.content ?? ''} pauseVersion={previewPause} /></div>
    <dialog className="profile-dialog saved-pairing" ref={pairing} aria-labelledby="saved-pairing-title"><span className="section-index">SESSION / {session?.session_id}</span><h2 id="saved-pairing-title">Your remote is ready.</h2>{session && <><a className="account-primary" href={displayUrl} target="_blank" rel="noreferrer">Open reading screen<ArrowUpRight size={16} /></a><QRCodeSVG value={remoteUrl} size={180} bgColor="transparent" /><p>Scan with your phone to control this session.</p><label>Remote link<input readOnly value={remoteUrl} onFocus={event => event.target.select()} /></label><p className="pairing-note">Links grant session access. Share only with your devices.</p></>}<button onClick={() => pairing.current?.close()}>Back to script</button></dialog>
  </section>
}

type Purchase = { id: string; provider: string; currency: string; amount_minor: number; status: string; checkout_url: string | null; environment: string; review_required: boolean }
type CommerceStatus = { enabled: boolean; prices: Record<string, number>; providers: { id: string; recommended: boolean; currencies: string[] }[]; purchases: Purchase[] }
const pendingPurchase = (purchase: Purchase) => ['creating', 'pending', 'ambiguous'].includes(purchase.status)
const purchaseMessage = (purchase: Purchase) => purchase.review_required && pendingPurchase(purchase)
  ? 'This payment needs support review. Please do not pay again; keep your order reference below.' : ({
  creating: 'Preparing your checkout. Please wait before trying again.',
  pending: 'Waiting for payment confirmation. You can check again or resume checkout below.',
  ambiguous: 'We could not confirm whether checkout was created. Please check your bank before paying again. Contact support if this persists.',
  paid: 'Payment confirmed. Lifetime Pro is active on your account.',
  failed: 'Payment was not completed. You can try checkout again.',
  refunded: 'This purchase has been refunded.',
  disputed: 'Access from this purchase is suspended while the payment is disputed.',
}[purchase.status] ?? 'Your purchase is being reviewed.')

function ProPanel({ user }: { user: Account }) {
  const { refresh: refreshAccount } = useAccount()
  const [commerce, setCommerce] = useState<CommerceStatus | null>(null)
  const [returnedPurchase] = useState(() => new URLSearchParams(window.location.search).get('purchase'))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [switchWarning, setSwitchWarning] = useState(false)
  const returnChecked = useRef(false)
  const update = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    let active = true
    let inFlight = false
    let timer: number | undefined
    let previousState = ''
    const load = async () => {
      if (!active || inFlight) return
      inFlight = true
      try {
        const result = await accountApi<CommerceStatus>('/commerce')
        if (!active) return
        setCommerce(result)
        const state = JSON.stringify(result.purchases.map(p => [p.id, p.status]))
        if (previousState !== state) { previousState = state; void refreshAccount() }
        const needsPolling = result.purchases.some(p => pendingPurchase(p) && !p.review_required)
        if (needsPolling && timer === undefined) timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 5_000)
        if (!needsPolling && timer !== undefined) { window.clearInterval(timer); timer = undefined }
      } catch { if (returnedPurchase && active) setNotice('Purchase status is unavailable. Check again when your connection returns; please do not pay again yet.') }
      finally { inFlight = false }
    }
    update.current = load
    void load()
    window.addEventListener('izzy:account-update', load)
    window.addEventListener('focus', load)
    window.addEventListener('online', load)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('izzy:account-update', load); window.removeEventListener('focus', load); window.removeEventListener('online', load) }
  }, [user.id, refreshAccount, returnedPurchase])
  const check = async (id: string) => {
    setBusy(true)
    try {
      const purchase = await accountApi<Purchase>(`/purchases/${encodeURIComponent(id)}/check`, 'POST', {})
      setNotice(returnedPurchase ? '' : purchaseMessage(purchase))
      await update.current()
      await refreshAccount()
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  const checkout = async (confirmSwitch = false) => {
    setBusy(true)
    try {
      const result = await accountApi<Purchase>('/checkout', 'POST', { provider: 'lava', currency: 'USD', confirm_switch: confirmSwitch })
      if (pendingPurchase(result) && result.checkout_url) window.location.assign(result.checkout_url)
      else { setNotice(purchaseMessage(result)); await update.current(); await refreshAccount() }
    } catch (error) { setNotice(accountMessage(error)); if (error instanceof AccountError && error.reason === 'payment_pending') { setSwitchWarning(commerce?.purchases.some(p => pendingPurchase(p) && (p.provider !== 'lava' || p.currency !== 'USD' || p.environment !== 'production')) ?? false); await update.current() } }
    finally { setBusy(false) }
  }
  const canPurchase = commerce?.enabled === true && Number.isSafeInteger(commerce.prices?.USD) && commerce.prices.USD > 0 && commerce.providers.some(p => p.id === 'lava' && p.currencies.includes('USD'))
  const samePending = commerce?.purchases.some(p => pendingPurchase(p) && p.provider === 'lava' && p.currency === 'USD' && p.environment === 'production') === true
  const returned = commerce?.purchases.find(p => p.id === returnedPurchase)
  const finishReturn = user.pro ? purchaseReturn(user.id) : null
  useEffect(() => {
    if (returned?.status !== 'paid' || !user.pro) return
    const key = `izzy:purchase-observed:${returned.id}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch { /* Local observer only; server remains authoritative. */ }
    track('pro_purchase_completed', { source: 'verified_account' })
  }, [returned?.id, returned?.status, user.pro])
  useEffect(() => {
    if (returned && pendingPurchase(returned) && !returned.review_required && !returnChecked.current) {
      returnChecked.current = true
      void check(returned.id)
    }
  }, [returned?.id])
  if (!user.pro && !canPurchase && !commerce?.purchases.length && !returnedPurchase) return null
  return <section className="pro-panel"><span className="section-index">IZZY / {user.pro || canPurchase ? 'LIFETIME PRO' : 'PURCHASE HISTORY'}</span>{(user.pro || canPurchase) && <><h2>{user.pro ? 'Ready for every take.' : 'Make room for more.'}</h2><p>{user.pro ? `Your Pro workspace includes unlimited scripts, project folders, reading profiles and ${proSkinCount} remote finishes.` : `Unlimited saved scripts. Reading profiles for speed and layout. Project folders. ${proSkinCount} remote finishes. One payment, no subscription.`}</p></>}
    {returned && <p className="account-notice" role="status">{purchaseMessage(returned)}<br /><small>Order reference: {returned.id}</small></p>}
    {finishReturn && <a className="account-primary" href={finishReturn}>Choose your finish <ArrowUpRight size={16} /></a>}
    {returnedPurchase && commerce && !returned && <p className="account-notice" role="status">This purchase was not found in your account. Sign in with the account you used at checkout to see its status.</p>}
    {!user.pro && canPurchase && !samePending && <><p className="price-switch">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((commerce!.prices.USD) / 100)} · paid once</p>
      <button className="account-primary" disabled={busy} onClick={() => void checkout()}>{busy ? 'Please wait…' : 'Unlock Lifetime Pro'}<ArrowUpRight size={16} /></button>
      <p className="checkout-note">Secure checkout with lava.top. One payment in USD, no recurring charges.</p>
      <PurchaseTerms />
      {switchWarning && <div className="account-conflict"><p>An older payment link may remain active. Check your bank and the purchase status below. Paying both links can create a duplicate charge.</p><button disabled={busy} onClick={() => void checkout(true)}>I checked · continue with lava.top</button></div>}
    </>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {!!commerce?.purchases.length && <div className="purchase-status"><h3>PURCHASE STATUS</h3>{commerce.purchases.slice(0, 4).map(p => <div key={p.id}><p>{p.provider === 'lava' ? 'lava.top' : 'Prodamus'} · {p.status}{p.environment !== 'production' ? ' · TEST' : ''}{p.review_required ? ' · support review' : ''}</p><small>Order reference: {p.id}</small>{pendingPurchase(p) && <><button disabled={busy} onClick={() => void check(p.id)}>Check payment status</button>{p.checkout_url && <a href={p.checkout_url} rel="noreferrer">Resume checkout</a>}</>}</div>)}</div>}
  </section>
}

function PresetPanel({ user }: { user: Account }) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [id, setId] = useState('')
  const [name, setName] = useState('My setup')
  const [settings, setSettings] = useState<PromptSettingsV1>({ ...DEFAULT_PROMPT_SETTINGS })
  const [isDefault, setIsDefault] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const load = async () => { try { const result = await accountApi<{ presets: Preset[] }>('/presets'); if (active) setPresets(result.presets) } catch { /* Keep the editor available. */ } }
    void load(); window.addEventListener('izzy:account-update', load)
    return () => { active = false; window.removeEventListener('izzy:account-update', load) }
  }, [])
  const select = (value: string) => {
    setId(value)
    const p = presets.find(p => p.id === value)
    const restored=p?.settings ?? DEFAULT_PROMPT_SETTINGS
    setName(p?.name ?? 'My setup'); setSettings({...restored,speed:boundedSpeed(restored.speed)}); setIsDefault(p?.is_default ?? false)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      const result = await accountApi<Preset>(id ? `/presets/${id}` : '/presets', id ? 'PATCH' : 'POST', { name, settings, is_default: isDefault })
      setId(result.id); setNotice('Profile saved. Apply it when prompting.'); window.dispatchEvent(new Event('izzy:account-update'))
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await accountApi(`/presets/${id}`, 'DELETE', {}); select(''); window.dispatchEvent(new Event('izzy:account-update')) }
    catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  if (!user.pro && presets.length === 0) return null
  return <section className="preset-panel"><span className="section-index">READING / PROFILES</span><h2>Your reading profiles.</h2>{user.pro && <p>Save speed and text layout for interviews, presentations or a faster read. Choose a profile as your default.</p>}{!user.pro && <p>Save reading profiles with Pro. Existing profiles stay here if your access changes.</p>}
    <label>READING PROFILE<select value={id} onChange={event => select(event.target.value)}><option value="">New reading profile</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' · default' : ''}</option>)}</select></label>
    <form onSubmit={event => void save(event)}><fieldset disabled={!user.pro || busy}><label>Name<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
      {([{ key: 'speed', title: 'Speed', min: MIN_SPEED, max: MAX_SPEED, step: SPEED_STEP }, { key: 'fontSize', title: 'Text size', min: 20, max: 160, step: 2 }, { key: 'lineHeight', title: 'Line spacing', min: .8, max: 3, step: .02 }, { key: 'textWidth', title: 'Text width', min: 25, max: 100, step: 1 }] as const).map(control => <label key={control.key}>{control.title}<output aria-hidden="true">{settings[control.key]}</output><input aria-label={control.title} type="range" min={control.min} max={control.max} step={control.step} value={settings[control.key]} onChange={event => setSettings(value => ({ ...value, [control.key]: Number(event.target.value) }))} /></label>)}
      <label className="preset-checkbox"><input type="checkbox" checked={settings.mirrored} onChange={event => setSettings(value => ({ ...value, mirrored: event.target.checked }))} />Mirror text</label><label className="preset-checkbox"><input type="checkbox" checked={isDefault} onChange={event => setIsDefault(event.target.checked)} />Use by default</label>
      <button className="account-primary">Save profile</button>{id && <button type="button" onClick={() => void remove()}>Delete profile</button>}
    </fieldset></form>{notice && <p className="account-notice" role="status">{notice}</p>}
  </section>
}
