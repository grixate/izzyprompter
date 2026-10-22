import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { RemoteInstrument } from '../components/RemoteInstrument'
import { skins, saveSkin, skinById, type SkinId } from './catalog'
import { ProAction } from './ProAction'
import { track } from './events'
import { Offer } from './ProductProvider'

export function SkinDialog({ initial, selected, pro, onClose, onApply }: {
  initial: SkinId; selected: SkinId; pro: boolean; onClose: () => void; onApply?: (id: SkinId) => Promise<boolean>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef(document.activeElement)
  const [id, setId] = useState(initial), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const skin = skinById(id)
  useEffect(() => {
    dialog.current?.showModal()
    return () => {
      dialog.current?.close()
      const previous = returnFocus.current
      requestAnimationFrame(() => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() })
    }
  }, [])
  useEffect(() => { track('skin_previewed', { skin: id, source: 'library' }); setNotice(''); setPreviewPlaying(false) }, [id])
  const step = (delta: number) => setId(skins[(skins.findIndex(skin => skin.id === id) + delta + skins.length) % skins.length].id)
  const apply = async () => {
    setBusy(true)
    try { const ok = onApply ? await onApply(id) : saveSkin(id); setNotice(ok ? `${skin.name} selected for this browser's remote.` : 'Could not save this finish. Try again.'); }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="skin-dialog" aria-labelledby="skin-dialog-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <button className="skin-dialog-close" onClick={onClose} aria-label="Close skin preview"><X size={22} /></button>
    <div className="skin-dialog-object"><RemoteInstrument skin={id} motion={previewPlaying} playing={previewPlaying} /><button className="mechanism-demo" aria-pressed={previewPlaying} onClick={() => setPreviewPlaying(value => !value)}>{previewPlaying ? 'Pause preview' : 'Play preview'}</button><div className="skin-preview-arrows"><button onClick={() => step(-1)} aria-label="Previous skin"><ArrowLeft /></button><span>{String(skins.findIndex(skin => skin.id === id) + 1).padStart(2, '0')} / {skins.length}</span><button onClick={() => step(1)} aria-label="Next skin"><ArrowRight /></button></div></div>
    <div className="skin-dialog-copy"><h2 id="skin-dialog-title">{skin.name}</h2><p className="skin-material">{skin.material}</p><p>{skin.note}</p>
      {!skin.pro || pro ? <button className="action-primary" disabled={busy} onClick={() => void apply()}>{busy ? 'Applying…' : selected === id ? 'Apply this finish' : 'Apply to my remote'}<Check size={17} /></button> : <div onClick={() => track('locked_skin_upgrade_clicked', { skin: id, source: 'skin_preview' })}><Offer compact /><ProAction source="skin_library" label="Unlock with Pro" returnTo={`/skins?skin=${id}`} /></div>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </dialog>
}
