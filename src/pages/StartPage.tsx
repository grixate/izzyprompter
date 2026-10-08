import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Copy, Monitor, Smartphone } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useSession } from '../realtime/useSession'
import { sampleScript } from '../script'

const makeSessionId = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

export function StartPage() {
  const [content, setContent] = useState(sampleScript)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [lanHost, setLanHost] = useState(window.location.hostname)
  const sentRevisionRef = useRef<string | null>(null)
  const { connection, presence, send } = useSession(sessionId, 'editor')
  const isLocalDevelopment = window.location.port === '5173'
  const baseUrl = isLocalDevelopment
    ? `${window.location.protocol}//${lanHost}:${window.location.port}`
    : window.location.origin
  const displayUrl = sessionId ? `${baseUrl}/display/${sessionId}` : ''
  const remoteUrl = sessionId ? `${baseUrl}/remote/${sessionId}` : ''

  useEffect(() => {
    if (!sessionId || connection !== 'connected' || sentRevisionRef.current === sessionId) return
    sentRevisionRef.current = sessionId
    send('script:update', { content })
  }, [connection, content, send, sessionId])

  useEffect(() => {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return
    fetch(`${window.location.protocol}//${window.location.hostname}:4000/api/network`)
      .then((response) => response.json())
      .then((payload: { hosts?: string[] }) => {
        if (payload.hosts?.[0]) setLanHost(payload.hosts[0])
      })
      .catch(() => undefined)
  }, [])

  const words = useMemo(() => content.trim() ? content.trim().split(/\s+/).length : 0, [content])

  const createSession = () => {
    sentRevisionRef.current = null
    setSessionId(makeSessionId())
  }

  const copyRemote = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(remoteUrl)
    } else {
      const field = document.createElement('textarea')
      field.value = remoteUrl
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  if (sessionId) {
    return (
      <main className="pairing-page">
        <header className="start-header">
          <div className="wordmark dark"><span className="wordmark-mark">C</span><span>CUE / LOCAL SESSION</span></div>
          <span className={`network-state ${connection}`}><i /> {connection.toUpperCase()}</span>
        </header>

        <section className="pairing-stage">
          <div className="pairing-copy">
            <span className="section-index">02 / CONNECT</span>
            <h1>Two screens.<br />One transport.</h1>
            <p>The display and remote are now separate. Keep this computer and your phone on the same local network.</p>
            <div className="session-plate"><span>SESSION</span><strong>{sessionId.slice(0, 3)}–{sessionId.slice(3)}</strong></div>
          </div>

          <div className="qr-assembly">
            <div className="qr-frame"><QRCodeSVG value={remoteUrl} size={190} bgColor="#eeefeb" fgColor="#171816" level="M" /></div>
            <div><span>SCAN WITH PHONE</span><p>{remoteUrl.replace(/^https?:\/\//, '')}</p></div>
          </div>

          <div className="surface-links">
            <a href={displayUrl} target="_blank" rel="noreferrer"><Monitor /><span><small>SCREEN 01</small>OPEN DISPLAY</span><ArrowUpRight /></a>
            <a href={remoteUrl} target="_blank" rel="noreferrer"><Smartphone /><span><small>SCREEN 02</small>OPEN REMOTE</span><ArrowUpRight /></a>
            <button onClick={copyRemote}><Copy /><span><small>REMOTE URL</small>{copied ? 'COPIED' : 'COPY LINK'}</span></button>
          </div>

          {(lanHost === 'localhost' || lanHost === '127.0.0.1') && (
            <p className="lan-note">For phone pairing, reopen this page using the Network URL printed by <code>npm run dev</code>. A phone cannot reach “localhost” on this computer.</p>
          )}
        </section>

        <footer className="pairing-footer">
          <span>DISPLAY {presence.display > 0 ? '● READY' : '○ WAITING'}</span>
          <span>REMOTE {presence.remote > 0 ? '● READY' : '○ WAITING'}</span>
          <button onClick={() => setSessionId(null)}>EDIT SCRIPT</button>
        </footer>
      </main>
    )
  }

  return (
    <main className="start-page">
      <header className="start-header">
        <div className="wordmark dark"><span className="wordmark-mark">C</span><span>CUE / LOCAL</span></div>
        <span className="prototype-label">REALTIME PROTOTYPE · 02</span>
      </header>

      <section className="editor-stage">
        <div className="editor-label"><span>01 / SCRIPT</span><span>{words} WORDS</span></div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} aria-label="Teleprompter script" spellCheck="true" />
        <button className="start-button" onClick={createSession} disabled={!content.trim()}>
          <span>START LOCAL SESSION</span><ArrowUpRight />
        </button>
      </section>
      <footer className="start-footer"><span>NO ACCOUNT</span><span>EPHEMERAL SESSION</span><span>LAN READY</span></footer>
    </main>
  )
}
