import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, LockKeyhole, X } from 'lucide-react'
import { RemoteInstrument } from '../components/RemoteInstrument'
import { skins, skinById, type SkinId } from './catalog'
import { track } from './events'
import './remote-skin-library.css'

function SkinSample({ skin, children }: { skin: SkinId; children: ReactNode }) {
  const host = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const stage = host.current, instrument = stage?.querySelector<HTMLElement>('.remote-instrument')
    if (!stage || !instrument) return
    const fit = () => {
      if (!stage.clientHeight || !instrument.offsetHeight) return
      const scale = Math.min((stage.clientWidth - 16) / instrument.offsetWidth, (stage.clientHeight - 28) / instrument.offsetHeight)
      stage.style.setProperty('--sample-scale', String(Math.max(.05, scale)))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage); observer.observe(instrument)
    return () => observer.disconnect()
  }, [skin])
  return <span ref={host} className="remote-skin-sample"><RemoteInstrument interactive={false} skin={skin} motion={false} />{children}</span>
}

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
      setNotice(`${skin.name} requires Pro.`); setLocked(true)
      return
    }
    applying.current = true
    setPending(id); setNotice(''); setLocked(false)
    try {
      const ok = await onApply(id)
      if (!alive.current) return
      if (ok) onClose()
      else setNotice('Could not change the skin. Check your connection and Pro access, then try again.')
    } catch {
      if (alive.current) setNotice('Could not change the skin. Please try again.')
    } finally {
      applying.current = false
      if (alive.current) setPending(null)
    }
  }
  return createPortal(<dialog ref={dialog} id="remote-skin-library" className="remote-skin-library" aria-labelledby="remote-skin-title"
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <header className="remote-skin-heading"><h2 id="remote-skin-title">Skins</h2><button className="remote-skin-close" onClick={onClose} aria-label="Close skin library"><X size={20} /></button></header>
    <div className="remote-skin-grid" role="group" aria-label="Remote skins" aria-busy={pending !== null}>{skins.map(skin => <button key={skin.id} className="remote-skin-card" aria-label={`Use ${skin.name}${skin.pro && !pro ? ' · Pro skin' : ''}`} aria-pressed={selected === skin.id} disabled={pending !== null} onClick={() => void choose(skin.id)}>
      <SkinSample skin={skin.id}><span className="remote-skin-marker">{selected === skin.id ? <Check size={14} /> : skin.pro && !pro ? <LockKeyhole size={12} /> : skin.number}</span></SkinSample>
      <span className="remote-skin-name">{skin.name}</span><span className="remote-skin-material">{skin.material}</span>
    </button>)}</div>
    {(pending || notice) && <footer className="remote-skin-footer"><div role="status">{pending ? `Applying ${skinById(pending).name}…` : notice}</div>{locked && <a href="/pro" target="_blank" rel="noopener noreferrer">Pro details ↗</a>}</footer>}
  </dialog>, document.body)
}
