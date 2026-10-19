import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
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
  useEffect(() => { if (state.connection === 'connected') track('offline_remote_connected', { surface: 'manual_preview' }) }, [state.connection])
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const run = async (operation: () => Promise<string | void>) => {
    setBusy(true); setMessage('')
    try { const output = await operation(); if (typeof output === 'string') setOutgoing(output) }
    catch { setMessage('The local connection could not start. Check that both devices are prepared and on a reachable network, then try fresh pairing data.'); track('offline_pairing_error', { reason: 'pairing_failed', surface: 'manual_preview' }); peer.close('Pairing failed. Generate fresh data.') }
    finally { setBusy(false) }
  }
  return <section className="local-pairing" aria-label="Direct pairing preview">
    <header><span className="eyebrow">DIRECT / EXPERIMENTAL PREVIEW</span>{onClose && <button onClick={onClose} aria-label="Close direct pairing">Close</button>}</header>
    <h2>{host ? 'Connect your remote.' : 'Connect to your reading screen.'}</h2>
    <p>Keep both devices on the same reachable network. Open <strong>/local/remote</strong> on the phone. Prepare both apps before going offline.</p>
    <p>{host ? '1. Create an offer and send its file or text to the phone. 2. Upload or paste the phone’s answer here.'
      : '1. Upload or paste the reading screen’s offer. 2. Send your answer back to that screen.'}</p>
    <p className={`local-status pairing-progress ${state.connection === 'connected' ? 'is-connected' : ''}`} role="status">{message || (state.connection === 'connected' ? 'Remote connected. Your controls are ready.' : state.connection === 'connecting' ? 'Waiting for the other device…' : 'Ready for a fresh pairing exchange.')}</p>
    {host && <button disabled={busy} onClick={() => void run(peer.createOffer)}>Create pairing offer</button>}
    <details className="manual-connection-options" open={Boolean(outgoing) || !host}><summary>Connection options · manual exchange</summary>
    <label>{host ? 'Remote answer' : 'Reading screen offer'}<textarea aria-label={host ? 'Remote answer' : 'Reading screen offer'} value={incoming}
      maxLength={96 * 1024} onChange={event => setIncoming(event.target.value)} spellCheck={false} /></label>
    <label className="local-file">Upload pairing file<input type="file" accept=".json,.txt,application/json,text/plain" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (!file) return
      if (file.size > 96 * 1024) { setMessage('Pairing file is too large.'); return }
      void file.text().then(setIncoming).catch(() => setMessage('Could not read pairing file.'))
    }} /></label>
    <button disabled={busy || !incoming.trim()} onClick={() => void run(() => host ? peer.acceptAnswer(incoming) : peer.acceptOffer(incoming))}>
      {busy ? 'Preparing connection…' : host ? 'Accept remote answer' : 'Create pairing answer'}
    </button>
    {outgoing && <>
      <label>{host ? 'Pairing offer' : 'Pairing answer'}<textarea ref={outputRef} readOnly aria-label={host ? 'Pairing offer' : 'Pairing answer'} value={outgoing} spellCheck={false} onFocus={event => event.target.select()} /></label>
      <div className="local-actions"><button onClick={() => downloadScript(outgoing, `izzy-direct-${host ? 'offer' : 'answer'}.json`)}>Download {host ? 'offer' : 'answer'}</button>
        <button onClick={() => void copyText(outgoing, outputRef.current).then(ok => setMessage(ok ? 'Pairing data copied.' : 'Copy unavailable. Select and copy the pairing data.'))}>Copy pairing data</button></div>
      <small>Pairing data grants control of this take. Share only with your device. Creating a new offer cancels the previous connection.</small>
    </>}
    </details>
    <p className="local-note">Experimental: manual pairing, one display and one remote. QR scanning, automatic online pairing and server fallback are still pending.</p>
  </section>
}
