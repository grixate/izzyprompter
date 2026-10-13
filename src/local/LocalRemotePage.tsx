import { useEffect, useState, useSyncExternalStore } from 'react'
import { RemoteSurface } from '../pages/RemotePage'
import { DirectPeer } from './peer'
import { PairingDialog, PairingPanel } from './PairingPanel'
import { OfflinePreparation } from './LocalPage'
import './local.css'

function RemotePreview({ peer }: { peer: DirectPeer }) {
  const state = useSyncExternalStore(peer.subscribe, peer.getSnapshot)
  const [pairing, setPairing] = useState(true)
  useEffect(() => { if (state.connection === 'connected') setPairing(false) }, [state.connection])
  return <div className="local-remote-page">
    {state.snapshot && <RemoteSurface sessionId="DIRECT" session={peer.view()} />}
    {!state.snapshot && <main className="local-workspace"><a href="/local">Local scripts</a><OfflinePreparation /></main>}
    <nav className="local-remote-tools"><button onClick={() => setPairing(true)}>Direct pairing</button><span role="status">{state.message}</span></nav>
    {pairing && <PairingDialog onClose={() => setPairing(false)}>
      <PairingPanel peer={peer} host={false} onClose={() => setPairing(false)} />
    </PairingDialog>}
  </div>
}
export function LocalRemotePage() {
  const [peer, setPeer] = useState<DirectPeer | null>(null)
  useEffect(() => { const direct = new DirectPeer(); setPeer(direct); return () => direct.dispose() }, [])
  return peer ? <RemotePreview peer={peer} /> : <main className="local-workspace">Opening direct remote…</main>
}
