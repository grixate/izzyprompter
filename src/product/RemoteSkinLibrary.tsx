import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LockKeyhole, X } from 'lucide-react'
import { RemoteInstrument } from '../components/RemoteInstrument'
import { skins, skinById, type SkinId } from './catalog'
import { track } from './events'
import './remote-skin-library.css'

export function RemoteSkinLibrary({ selected, pro, onApply, onClose }: {
  selected: SkinId; pro: boolean; onApply: (id: SkinId) => Promise<boolean>; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef(document.activeElement)
  const applying = useRef(false)
  const alive = useRef(true)
  const [pending, setPending] = useState<SkinId | null>(null)
  const [notice, setNotice] = useState('')
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    alive.current = true
    dialog.current?.showModal()
    const current = dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    current?.focus({ preventScroll: true })
    current?.scrollIntoView({ block: 'nearest' })
    track('skins_opened', { source: 'remote' })
    return () => {
      alive.current = false
      dialog.current?.close()
      const previous = returnFocus.current
      requestAnimationFrame(() => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }) })
    }
  }, [])
  const choose = async (id: SkinId) => {
    if (applying.current) return
    const skin = skinById(id)
    if (skin.pro && !pro) {
      setNotice(`${skin.name} is a Pro finish.`); setLocked(true)
      return
    }
    applying.current = true
    setPending(id); setNotice(''); setLocked(false)
    try {
      const ok = await onApply(id)
      if (!alive.current) return
      if (ok) onClose()
      else setNotice('Could not change the finish. Check your connection and Pro access, then try again.')
    } catch {
      if (alive.current) setNotice('Could not change the finish. Please try again.')
    } finally {
      applying.current = false
      if (alive.current) setPending(null)
    }
  }
  return createPortal(<dialog ref={dialog} id="remote-skin-library" className="remote-skin-library" aria-labelledby="remote-skin-title" aria-describedby="remote-skin-help"
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <header className="remote-skin-heading"><div><span className="remote-skin-eyebrow">R–01 / FINISH LIBRARY</span><h2 id="remote-skin-title">Make it yours.</h2><p id="remote-skin-help">Tap a finish. Back to your take.</p></div><button className="remote-skin-close" onClick={onClose} aria-label="Close skin library"><X size={20} /></button></header>
    <div className="remote-skin-grid" role="group" aria-label="Remote finishes" aria-busy={pending !== null}>{skins.map(skin => <button key={skin.id} className="remote-skin-card" aria-label={`Use ${skin.name}${skin.pro && !pro ? ' · Pro finish' : ''}`} aria-pressed={selected === skin.id} disabled={pending !== null} onClick={() => void choose(skin.id)}>
      <span className="remote-skin-sample"><RemoteInstrument skin={skin.id} motion={false} /><span className="remote-skin-marker">{selected === skin.id ? <Check size={14} /> : skin.pro && !pro ? <LockKeyhole size={12} /> : skin.number}</span></span>
      <span className="remote-skin-name">{skin.name}</span><span className="remote-skin-material">{skin.material}</span>
    </button>)}</div>
    <footer className="remote-skin-footer"><div role="status">{pending ? `Applying ${skinById(pending).name}…` : notice || <><Check size={14} /><span>{skinById(selected).name}<small>ON THIS REMOTE</small></span></>}</div>{locked && <a href="/pro" target="_blank" rel="noopener noreferrer">Explore Pro ↗</a>}<span className="remote-skin-count">16 FINISHES</span></footer>
  </dialog>, document.body)
}
