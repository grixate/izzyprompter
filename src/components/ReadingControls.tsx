import { useEffect, useRef, useState } from 'react'
import { SwatchBook, Type, X } from 'lucide-react'
import type { SessionControllerView } from '../realtime/controller'
import { useReadingSettings } from '../realtime/useReadingSettings'
import './reading-controls.css'

export function ReadingControls({ session, beforeOpen, onChooseSkin, skinName, onPairing }: {
  session: SessionControllerView; beforeOpen: () => void; onChooseSkin?: () => void; skinName?: string; onPairing?: () => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const { settings, change, busy, error, stored } = useReadingSettings(session)
  const enabled = session.connection === 'connected' && !session.editing.active
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else if (dialog.current?.open) { dialog.current.close(); trigger.current?.focus() }
  }, [open])
  const status = session.preferencesStatus ?? 'device'
  return <>
    <button ref={trigger} className="remote-finish-button" disabled={!enabled && !onPairing && !onChooseSkin} aria-label="Reading settings" aria-describedby="remote-current-skin" aria-haspopup="dialog"
      onClick={() => { beforeOpen(); setOpen(true) }}><Type size={19} strokeWidth={1.6} /></button>
    <span id="remote-current-skin" className="sr-only" aria-live="polite">Current skin: {skinName}</span>
    <dialog ref={dialog} className="quick-edit-dialog remote-reading-settings" aria-labelledby="remote-reading-title"
      onCancel={event => { event.preventDefault(); setOpen(false) }}>
      <header><span>READING</span><button aria-label="Close reading settings" onClick={() => setOpen(false)}><X size={18} /></button></header>
      <h1 id="remote-reading-title">Room to read.</h1>
      <p className="edit-explanation">Change the text on your connected display.</p>
      <div className="reading-size-controls" aria-label="Text size controls">
        <button disabled={!enabled || settings.fontSize <= 20} aria-label="Decrease text size" onClick={() => change({ fontSize: Math.max(20, settings.fontSize - 2) })}>A−</button>
        <output aria-label="Current text size" aria-live="polite">{settings.fontSize}<small>TEXT SIZE</small></output>
        <button disabled={!enabled || settings.fontSize >= 160} aria-label="Increase text size" onClick={() => change({ fontSize: Math.min(160, settings.fontSize + 2) })}>A+</button>
      </div>
      <label htmlFor="remote-text-size">TEXT SIZE<input id="remote-text-size" type="range" min="20" max="160" step="2"
        value={settings.fontSize} disabled={!enabled} onChange={event => change({ fontSize: Number(event.target.value) })} /></label>
      <p className="reading-save-status" role="status" aria-label="Reading settings status">{error || (busy ? 'Applying to display…' : status === 'pending' ? 'Applied · saving to your account…' : status === 'saved' ? 'Saved to your account' : status === 'ready' ? 'Changes are remembered in your account' : status === 'conflict' ? 'Applied here. Newer preferences were saved in another session.' : status === 'unavailable' ? 'Applied here. Account saving is unavailable.' : stored ? 'Remembered on this device' : 'Applied here. Device storage is unavailable.') }</p>
      {['conflict', 'unavailable'].includes(status) && <button className="reading-save-retry" disabled={!enabled} onClick={() => session.send('settings:remember')}>Save these settings to my account</button>}
      {onChooseSkin && <button className="reading-appearance" aria-label="Change remote skin" onClick={() => {
        dialog.current?.close(); trigger.current?.focus(); setOpen(false); onChooseSkin()
      }}><SwatchBook size={18} /><span>Remote skin<small>{skinName}</small></span><span aria-hidden="true">↗</span></button>}
      {onPairing && <button className="reading-appearance" onClick={() => { dialog.current?.close(); trigger.current?.focus(); setOpen(false); onPairing() }}>Direct pairing</button>}
      <footer><span>YOUR PACE · YOUR TYPE</span><button className="edit-done" onClick={() => setOpen(false)}>DONE ↗</button></footer>
    </dialog>
  </>
}
