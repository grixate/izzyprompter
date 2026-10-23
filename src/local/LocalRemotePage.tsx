import { useEffect, useState, useSyncExternalStore } from 'react'
import { RemoteSurface } from '../pages/RemotePage'
import { DirectPeer } from './peer'
import { PairingDialog, PairingPanel } from './PairingPanel'
import { OfflinePreparation } from './OfflinePreparation'
import { PublicNav } from '../components/PublicNav'
import './local.css'

function RemotePreview({ peer }: { peer: DirectPeer }) {
  const state = useSyncExternalStore(peer.subscribe, peer.getSnapshot)
  const [pairing, setPairing] = useState(true)
  useEffect(() => { if (state.connection === 'connected') setPairing(false) }, [state.connection])
  return <div className="local-remote-page">
    {state.snapshot && <RemoteSurface sessionId="DIRECT" session={peer.view()} onPairing={()=>setPairing(true)} />}
    {!state.snapshot && <main className="local-workspace offline-studio product-page"><PublicNav mode="offline" /><div className="local-remote-setup"><OfflinePreparation /><PairingPanel peer={peer} host={false} /><p><a href="/local">Read on this device instead</a></p></div></main>}
    {state.snapshot && pairing && <PairingDialog onClose={() => setPairing(false)}>
      <PairingPanel peer={peer} host={false} onClose={() => setPairing(false)} />
    </PairingDialog>}
  </div>
}
export function LocalRemotePage() {
  const [peer, setPeer] = useState<DirectPeer | null>(null)
  useEffect(() => { const direct = new DirectPeer(); setPeer(direct); return () => direct.dispose() }, [])
  return peer ? <RemotePreview peer={peer} /> : <main className="local-workspace">Opening direct remote…</main>
}
