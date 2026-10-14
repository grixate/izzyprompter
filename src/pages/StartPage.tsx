import { BrandLogo } from '../components/BrandLogo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Copy, Monitor, Smartphone, Upload } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  normalizeClipboardPayload,
  normalizePlainText,
  replaceTextSelection,
} from '../domain/textNormalization'
import {
  DEFAULT_PROMPT_SETTINGS,
  clearWorkspaceStorage,
  createDebouncedStorageWriter,
  loadWorkspaceStorage,
  persistDraftDocument,
  type IzzyDraftStateV1,
} from '../domain/storage'
import { izzyDocumentToLegacyText } from '../domain/document'
import { prepareScriptImport, validateScriptFile } from '../domain/fileImport'
import { useSession } from '../realtime/useSession'
import { apiUrl } from '../realtime/endpoints'
import { creationFailure } from '../realtime/creation'
import { isSessionCredentials, loadEditorSession, saveEditorSession, sessionLink, type SessionCredentials } from '../realtime/credentials'
import { SessionNotice } from '../realtime/SessionNotice'
import { sampleScript } from '../script'
import { copyText, downloadScript } from '../domain/textBackup'
import { StorageNotice } from '../realtime/StorageNotice'
import { pairingEnvironment } from '../realtime/pairing'
import { LivePreview } from '../components/LivePreview'
import { useAccount } from '../account/AccountProvider'

export function StartPage() {
  const { status: accountStatus } = useAccount()
  const [restoredStorage] = useState(() => loadWorkspaceStorage())
  const [content, setContent] = useState(() => {
    const restoredContent = restoredStorage.draft?.content
      ?? (restoredStorage.document ? izzyDocumentToLegacyText(restoredStorage.document) : '')
    // Remove the prototype's old seeded sample once; genuine drafts survive.
    return restoredContent === sampleScript ? '' : restoredContent
  })
  const [session, setSession] = useState<SessionCredentials | null>(() => {
    try { return loadEditorSession(window.sessionStorage) } catch { return null }
  })
  const sessionId = session?.session_id ?? null
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [draftSaved, setDraftSaved] = useState<boolean | null>(null)
  const [resetArmed, setResetArmed] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [previewPauseVersion, setPreviewPauseVersion] = useState(0)
  const [inputFeedback, setInputFeedback] = useState<{
    kind: 'error' | 'success'
    message: string
  } | null>(null)
  const [lanHost, setLanHost] = useState(window.location.hostname)
  const [retrySeconds, setRetrySeconds] = useState(0)
  const [pairingOrigin, setPairingOrigin] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef(content)
  const dragDepthRef = useRef(0)
  const importRequestRef = useRef(0)
  const documentIdRef = useRef(
    restoredStorage.draft?.documentId
      ?? restoredStorage.document?.id
      ?? `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
  )
  const titleRef = useRef(
    restoredStorage.draft?.title ?? restoredStorage.document?.title ?? 'Untitled script',
  )
  const settingsRef = useRef(restoredStorage.settings)
  const [draftWriter] = useState(() => createDebouncedStorageWriter<string>({
    delay: 250,
    write: (nextContent) => persistDraftDocument({
      documentId: documentIdRef.current,
      title: titleRef.current,
      content: nextContent,
    }),
    onResult: setDraftSaved,
  }))
  const { connection, presence, script, editing, reconnect } = useSession(sessionId, 'editor', session?.tokens.editor)
  useEffect(() => {
    if (!sessionId || !script.revision) return
    contentRef.current = script.content
    setContent(script.content)
    draftWriter.schedule(script.content)
    draftWriter.flush()
    // A session ID can change before its first snapshot arrives. Only a new
    // script snapshot may replace the draft, never the previous session's text.
  }, [script])
  const isLocalDevelopment = import.meta.env.DEV && window.location.port === '5173'
  const baseUrl = pairingOrigin ?? (isLocalDevelopment
    ? `${window.location.protocol}//${lanHost}:${window.location.port}`
    : window.location.origin)
  const displayUrl = session ? sessionLink(baseUrl, session, 'display') : ''
  const remoteUrl = session ? sessionLink(baseUrl, session, 'remote') : ''
  const pairingMode = pairingEnvironment(baseUrl)

  useEffect(() => {
    try { saveEditorSession(session, window.sessionStorage) } catch { /* storage unavailable */ }
  }, [session])

  useEffect(() => {
    draftWriter.schedule(content)
    contentRef.current = content
  }, [content, draftWriter])

  useEffect(() => {
    if (sessionId || isCreating) return

    const pasteAnywhere = (event: ClipboardEvent) => {
      const plainText = event.clipboardData?.getData('text/plain') ?? ''
      if (!plainText) return

      const replacement = normalizeClipboardPayload({
        plainText,
        html: event.clipboardData?.getData('text/html') ?? '',
      })
      if (!replacement) return

      event.preventDefault()
      const field = textareaRef.current
      const isEditing = field && document.activeElement === field
      const currentValue = contentRef.current
      const pasteValue = isEditing || !currentValue.trim() ? replacement : `\n\n${replacement}`
      const next = replaceTextSelection(
        currentValue,
        isEditing ? field.selectionStart : currentValue.length,
        isEditing ? field.selectionEnd : currentValue.length,
        pasteValue,
      )

      contentRef.current = next.value
      setContent(next.value)
      setPreviewPauseVersion((version) => version + 1)
      setInputFeedback({ kind: 'success', message: 'PASTE CLEAN · READY' })
      window.requestAnimationFrame(() => {
        field?.focus()
        field?.setSelectionRange(next.caret, next.caret)
      })
    }

    window.addEventListener('paste', pasteAnywhere)
    return () => window.removeEventListener('paste', pasteAnywhere)
  }, [sessionId, isCreating])

  useEffect(() => {
    const flush = () => { draftWriter.flush() }
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushWhenHidden)
      draftWriter.dispose()
    }
  }, [draftWriter])

  useEffect(() => {
    if (!resetArmed) return
    const timeout = window.setTimeout(() => setResetArmed(false), 4_000)
    return () => window.clearTimeout(timeout)
  }, [resetArmed])

  useEffect(() => {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return
    let active = true
    fetch(apiUrl('network'))
      .then((response) => response.json())
      .then((payload: { hosts?: string[]; pairing_origin?: string }) => {
        if (!active) return
        if (payload.pairing_origin) {
          const origin = new URL(payload.pairing_origin)
          if (origin.protocol === 'http:' && origin.port === window.location.port && origin.origin === payload.pairing_origin) {
            setPairingOrigin(origin.origin)
            setLanHost(origin.hostname)
          }
        } else if (isLocalDevelopment && payload.hosts?.[0]) setLanHost(payload.hosts[0])
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const words = useMemo(() => content.trim() ? content.trim().split(/\s+/).length : 0, [content])

  useEffect(() => {
    if (retrySeconds <= 0) return
    const timer = window.setTimeout(() => setRetrySeconds((remaining) => Math.max(0, remaining - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [retrySeconds])

  const createSession = async () => {
    const normalizedContent = normalizePlainText(content)
    if (!normalizedContent || isCreating || retrySeconds > 0) return

    setContent(normalizedContent)
    draftWriter.schedule(normalizedContent)
    draftWriter.flush()
    setIsCreating(true)
    importRequestRef.current += 1
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(apiUrl('sessions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ protocol_version: 2, content: normalizedContent, speed: settingsRef.current.speed }),
      })
      // Reverse proxies can return HTML for 413/429. Status-based recovery
      // must still preserve the draft and honor the retry hint.
      const created: unknown = await response.json().catch(() => null)
      const reason = typeof created === 'object' && created !== null && 'reason' in created ? created.reason : null
      const failure = creationFailure(response.status, reason, response.headers.get('retry-after'))
      if (failure) {
        setInputFeedback({ kind: 'error', message: failure.message })
        setRetrySeconds(failure.retrySeconds)
        return
      }
      if (!response.ok || !isSessionCredentials(created)) throw new Error('session_create_failed')
      setSession(created)
    } catch {
      setInputFeedback({ kind: 'error', message: 'SESSION COULD NOT START · CHECK CONNECTION AND RETRY' })
    } finally {
      window.clearTimeout(timeout)
      setIsCreating(false)
    }
  }

  const startOver = () => {
    if (isCreating) return
    if (!resetArmed) {
      setResetArmed(true)
      return
    }

    draftWriter.cancel()
    clearWorkspaceStorage()
    documentIdRef.current = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
    titleRef.current = 'Untitled script'
    settingsRef.current = { ...DEFAULT_PROMPT_SETTINGS }
    const emptyDraft: IzzyDraftStateV1 = {
      documentId: documentIdRef.current,
      title: titleRef.current,
      content: '',
    }
    persistDraftDocument(emptyDraft)
    contentRef.current = ''
    setContent('')
    setInputFeedback(null)
    setResetArmed(false)
  }

  const importScriptFile = async (files: FileList | File[]) => {
    if (isCreating) return
    if (files.length !== 1) {
      setInputFeedback({ kind: 'error', message: 'DROP ONE FILE AT A TIME' })
      return
    }

    const file = files[0]
    const validation = validateScriptFile(file)
    if (!validation.ok) {
      setInputFeedback({ kind: 'error', message: validation.message })
      return
    }

    const requestId = ++importRequestRef.current
    try {
      const rawContent = await file.text()
      if (requestId !== importRequestRef.current) return
      const imported = prepareScriptImport(file, rawContent)
      if (!imported.ok) {
        setInputFeedback({ kind: 'error', message: imported.message })
        return
      }

      documentIdRef.current = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
      titleRef.current = imported.title
      contentRef.current = imported.content
      setContent(imported.content)
      setPreviewPauseVersion((version) => version + 1)
      setInputFeedback({ kind: 'success', message: `LOADED · ${file.name.toUpperCase()}` })
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    } catch {
      if (requestId === importRequestRef.current) {
        setInputFeedback({ kind: 'error', message: 'FILE COULD NOT BE READ' })
      }
    }
  }

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFile(true)
  }

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDraggingFile(false)
  }

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFile(false)
    void importScriptFile(event.dataTransfer.files)
  }

  const copyRemote = async () => {
    const success = await copyText(remoteUrl)
    setCopyFailed(!success)
    setCopied(success)
    if (success) window.setTimeout(() => setCopied(false), 1_500)
  }

  const retryLocalSave = () => {
    draftWriter.schedule(contentRef.current)
    draftWriter.flush()
  }
  const storageWarning = draftSaved === false
    ? <StorageNotice onRetry={retryLocalSave} onDownload={() => downloadScript(contentRef.current)} /> : null

  if (sessionId) {
    return (
      <main className="pairing-page">
        <SessionNotice connection={connection} surface="editor" onBackToScript={() => setSession(null)} onRetry={reconnect} />
        <header className="start-header">
          <BrandLogo context="SESSION" />
          <span className={`network-state ${connection}`}><i /> {connection.toUpperCase()}</span>
        </header>

        <section className="pairing-stage">
          <div className="pairing-copy">
            <span className="section-index">02 / CONNECT</span>
            <h1>Two screens.<br />One transport.</h1>
            <p>Open the display on your reading screen. Scan the QR with your phone to control it. A tablet works as the reading screen, too.</p>
            <div className="session-plate"><span>SESSION</span><strong>{sessionId.slice(0, 3)}–{sessionId.slice(3)}</strong></div>
            {editing.active && <div className="pairing-live-edit"><span>LIVE EDIT · PLAYBACK PAUSED</span><p>{script.document?.blocks.find((block) => block.id === editing.active?.block_id)?.text}</p></div>}
          </div>

          <div className="qr-assembly">
            <div className="qr-frame"><QRCodeSVG value={remoteUrl} size={190} bgColor="#eeefeb" fgColor="#171816" level="M" title="Scan to open this session's phone remote" /></div>
            <div><span>SCAN WITH PHONE</span><p>{remoteUrl.split('#')[0].replace(/^https?:\/\//, '')}</p></div>
          </div>

          <div className="surface-links">
            <a href={displayUrl} target="_blank" rel="noreferrer"><Monitor /><span><small>READ ON THIS DEVICE</small>OPEN DISPLAY</span><ArrowUpRight /></a>
            <a href={remoteUrl} target="_blank" rel="noreferrer"><Smartphone /><span><small>CONTROL ON THIS DEVICE</small>OPEN REMOTE</span><ArrowUpRight /></a>
            <button onClick={copyRemote}><Copy /><span><small>SEND TO YOUR PHONE</small>{copied ? 'COPIED' : 'COPY LINK'}</span></button>
            {copyFailed && <label className="copy-link-fallback"><span role="status">COPY UNAVAILABLE · SELECT AND COPY THIS LINK</span><input aria-label="Remote pairing link" readOnly value={remoteUrl} onFocus={(event) => event.target.select()} /></label>}
          </div>

          {pairingMode !== 'website' && (
            <p className="lan-note">{pairingMode === 'loopback'
              ? 'THIS DEVICE ONLY · This address cannot be opened on your phone. Open IZZY using the server’s Network URL to pair another device.'
              : 'LOCAL NETWORK · Keep both devices on the same reachable Wi-Fi. Keep the local IZZY server running.'}</p>
          )}
          <p className="pairing-note">Pairing links grant access to this session. Share only with your devices.</p>
        </section>

        {storageWarning}

        <footer className="pairing-footer">
          <span>DISPLAY {presence.display > 0 ? '● READY' : '○ WAITING'}</span>
          <span>REMOTE {presence.remote > 0 ? '● READY' : '○ WAITING'}</span>
          <button onClick={() => setSession(null)}>EDIT SCRIPT</button>
        </footer>
      </main>
    )
  }

  return (
    <main className="start-page workbench-page">
      <header className="start-header">
        <BrandLogo context="TELEPROMPTER" />
        <a className="login-button" href="/account">{accountStatus?.user ? 'My scripts' : 'Log in'}</a>
      </header>

      <section className="workbench-stage" aria-label="Prepare your teleprompter">
      <div className="script-workspace">
        <div className="entry-intro">
          <h1>Your screen is the prompter.<br />Your phone is the remote.</h1>
          <p>Control the pace without touching the reading screen.</p>
        </div>
        <div className="editor-label">
          <label htmlFor="script-input">YOUR SCRIPT</label>
          <div className="editor-meta">
            <button type="button" disabled={isCreating} onClick={() => fileInputRef.current?.click()}><Upload size={13} />Import text</button>
          </div>
        </div>
        <div
          className={`editor-input ${isDraggingFile ? 'is-dragging' : ''} ${content ? 'has-content' : 'is-empty'}`}
          onDragEnter={onDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={(event) => {
            if (!(event.target as HTMLElement).closest('button')) textareaRef.current?.focus()
          }}
        >
          <textarea
            id="script-input"
            disabled={isCreating}
            ref={textareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              setInputFeedback(null)
              setPreviewPauseVersion((version) => version + 1)
            }}
            onFocus={() => setPreviewPauseVersion((version) => version + 1)}
            placeholder={isDraggingFile ? 'Release to load your script.' : 'Paste your script here.'}
            aria-label="Teleprompter script"
            aria-describedby="editor-input-help editor-feedback"
            spellCheck="true"
          />
          {!content && (
            <p className="script-empty-note">Or drop a .txt or .md file. Just the words, no formatting.</p>
          )}
          <input
            ref={fileInputRef}
            disabled={isCreating}
            hidden
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={(event) => {
              if (event.target.files) void importScriptFile(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
        <p id="editor-input-help" className="sr-only">Enter plain text, paste, or import a TXT or Markdown file. Maximum 2 MB and 5,000 paragraphs.</p>
        <div className="script-feedback">
          <span id="editor-feedback" className={inputFeedback?.kind === 'error' ? 'is-error' : inputFeedback ? 'is-success' : ''} role="status" aria-live={inputFeedback ? 'polite' : 'off'}>
            {inputFeedback?.message ?? (words ? `${words} WORDS · ${draftSaved === true ? 'DRAFT SAVED ON THIS DEVICE' : 'YOUR SCRIPT'}` : 'TXT / MD · UP TO 2 MB')}
          </span>
        </div>
        <div className="workspace-actions">
        {content && <button className="reset-draft" type="button" disabled={isCreating} onClick={startOver}>{resetArmed ? 'CONFIRM START OVER' : 'START OVER'}</button>}
        <button className="start-button" onClick={() => void createSession()} disabled={!content.trim() || isCreating || retrySeconds > 0}>
          <span>{isCreating ? 'STARTING SESSION…' : retrySeconds > 0 ? `TRY AGAIN IN ${retrySeconds}S` : 'SET UP PROMPTER'}</span><ArrowUpRight />
        </button>
        </div>
        <p className="setup-hint">{words ? 'Next: open your reading screen and pair your phone.' : 'Add your script to set up your reading screen and phone.'}</p>
        <p className="setup-hint"><a href="/local" onClick={() => draftWriter.flush()}>Open local / offline preview</a></p>
      </div>
      <LivePreview content={content} pauseVersion={previewPauseVersion} />
      </section>
      {storageWarning}
    </main>
  )
}
