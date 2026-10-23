import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowRight, Check, Copy, Download, Upload } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { copyText, downloadScript } from '../domain/textBackup'
import type { DirectPeer } from './peer'
import { track } from '../product/events'

export function PairingDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.showModal()
    return () => { ref.current?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} className="local-pairing-overlay" aria-label="Pair a direct remote" onCancel={event => { event.preventDefault(); onClose() }}>{children}</dialog>
}

export function PairingPanel({ peer, host, onClose }: { peer: DirectPeer; host: boolean; onClose?: () => void }) {
  const state = useSyncExternalStore(peer.subscribe, peer.getSnapshot)
  const [incoming, setIncoming] = useState(''), [outgoing, setOutgoing] = useState('')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState(false), [showOutput, setShowOutput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null), outputRef = useRef<HTMLTextAreaElement>(null)
  const connected = state.connection === 'connected'
  const remoteUrl = `${window.location.origin}/local/remote`
  useEffect(() => { if (connected) track('offline_remote_connected', { surface: 'manual_preview' }) }, [connected])
  const run = async (operation: () => Promise<string | void>) => {
    setBusy(true); setMessage('')
    try { const output = await operation(); if (typeof output === 'string') setOutgoing(output) }
    catch {
      setOutgoing('')
      setMessage('Could not connect. Keep both devices on the same reachable Wi-Fi, create a new connection file on the reading screen and try again.')
      track('offline_pairing_error', { reason: 'pairing_failed', surface: 'manual_preview' })
      peer.close('Pairing failed. Generate fresh data.')
    } finally { setBusy(false) }
  }
  const accept = (text: string) => run(() => host ? peer.acceptAnswer(text) : peer.acceptOffer(text))
  return <section className="local-pairing" aria-label="Direct phone connection">
    <header><span className="eyebrow">PHONE CONTROLS · EXPERIMENTAL</span>{onClose && <button onClick={onClose} aria-label="Close direct pairing">{connected ? 'Done' : host ? 'Use this device instead' : 'Close'}</button>}</header>
    <h2>{host ? 'Read here. Control from your phone.' : 'Turn this phone into your remote.'}</h2>
    <p className="pairing-intro">Keep both devices on the same Wi-Fi. This direct connection uses a file exchange, without a server.</p>
    {connected ? <div className="pairing-connected"><Check size={28} /><h3>Phone connected</h3><p>Your controls are ready. Your reading screen stays paused until you press Play.</p>{onClose && <button onClick={onClose}>Go to reading screen<ArrowRight size={18} /></button>}</div> : <>
      <ol className="pairing-steps">
        {host && <li className="pairing-open-phone"><div><h3>Open the controls on your phone</h3><p>Scan to open IZZY, or enter the address below. Keep this reading screen open.</p><a href={remoteUrl} target="_blank" rel="noreferrer">{remoteUrl}</a><p>Open both devices while online first, so each is saved for offline use.</p></div><QRCodeSVG value={remoteUrl} size={112} marginSize={2} aria-label="Open phone controls" /></li>}
        {!host && <li><h3>Get the reading screen’s connection file</h3><p>On your reading screen, choose Connect phone, then create and send its connection file to this phone.</p></li>}
        {host && <li><h3>Send a connection file to your phone</h3><p>Create a fresh file for this take, then transfer it to your phone without closing this page.</p>
          <div className="local-actions">{!outgoing ? <button disabled={busy} onClick={() => void run(peer.createOffer)}>{busy ? 'Creating connection file…' : 'Create connection file'}<ArrowRight size={17} /></button> : <button disabled={busy} onClick={() => downloadScript(outgoing, 'izzy-direct-offer.json')}><Download size={17} />Download connection file</button>}</div>
        </li>}
        <li><h3>{host ? 'Bring the phone’s reply back here' : 'Open the connection file here'}</h3><p>{host ? 'Your phone creates a reply file. Transfer it back to this device and upload it below to connect.' : 'Upload the file from your reading screen. IZZY will create your reply automatically.'}</p>
          <button className="pairing-upload" disabled={busy || (host && !outgoing)} onClick={() => inputRef.current?.click()}><Upload size={18} />{busy ? 'Preparing connection…' : host ? 'Upload phone reply' : 'Upload connection file'}</button>
          <input className="offline-file-input" ref={inputRef} type="file" aria-label={host ? 'Upload phone reply file' : 'Upload connection file'} accept=".json,.txt,application/json,text/plain" disabled={busy || (host && !outgoing)} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''
            if (!file) return
            if (file.size > 96 * 1024) { setMessage('Connection file is too large. Choose the file from your other device.'); return }
            void file.text().then(text => { setIncoming(text); return accept(text) }).catch(() => setMessage('Could not read this file. Your script is unchanged.'))
          }} />
          <button className="pairing-text-link" disabled={busy || (host && !outgoing)} aria-expanded={paste} onClick={() => setPaste(value => !value)}>{paste ? 'Use a file instead' : 'Paste connection text instead'}</button>
          {paste && <div className="pairing-paste"><label>{host ? 'Phone reply text' : 'Reading screen connection text'}<textarea aria-label={host ? 'Remote answer' : 'Reading screen offer'} value={incoming} maxLength={96 * 1024} onChange={event => setIncoming(event.target.value)} spellCheck={false} /></label><button disabled={busy || !incoming.trim()} onClick={() => void accept(incoming)}>{host ? 'Connect phone' : 'Create phone reply'}</button></div>}
        </li>
        {!host && outgoing && <li><h3>Send your reply to the reading screen</h3><p>Download this reply, transfer it back, then upload it on the reading screen. Your controls open when connected.</p><button disabled={busy} onClick={() => downloadScript(outgoing, 'izzy-direct-answer.json')}><Download size={17} />Download phone reply</button></li>}
      </ol>
      {outgoing && <div className="pairing-text-transfer"><button onClick={() => void copyText(outgoing, outputRef.current).then(ok => { setMessage(ok ? 'Connection text copied. Send it only to your other device.' : 'Select and copy the connection text below.'); if (!ok) setShowOutput(true) })}><Copy size={16} />Copy {host ? 'connection' : 'reply'} text</button>
        {showOutput && <label>Connection text<textarea ref={outputRef} readOnly aria-label={host ? 'Pairing offer' : 'Pairing answer'} value={outgoing} spellCheck={false} onFocus={event => event.target.select()} /></label>}
      </div>}
      <p className="local-status pairing-progress" role="status">{message || (busy ? 'Preparing your connection…' : state.connection === 'connecting' ? 'Waiting for the other device…' : state.message === 'Not paired' ? 'Your script stays on the reading screen.' : state.message)}</p>
    </>}
    <p className="local-note">Phone connection is experimental and depends on your local network. If it cannot connect, you can always read and control on one device. Connection files control this take: share only with your own device.</p>
  </section>
}
