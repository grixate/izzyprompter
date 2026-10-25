import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Settings, X } from 'lucide-react'
import type { SessionControllerView } from '../realtime/controller'
import { useReadingSettings } from '../realtime/useReadingSettings'
import { skinById, type SkinId } from '../product/catalog'
import { RemoteSkinSample } from '../product/RemoteSkinSample'
import './reading-controls.css'

export function ReadingControls({ session, beforeOpen, onChooseSkin, skin, onPairing }: {
  session: SessionControllerView; beforeOpen: () => void; onChooseSkin?: () => void; skin: SkinId; onPairing?: () => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const { settings, change, busy, error, stored } = useReadingSettings(session)
  const enabled = session.connection === 'connected' && !session.editing.active
  useEffect(() => {
    const panel = dialog.current
    if (!open || !panel) return
    const viewport = window.visualViewport
    const fit = () => {
      panel.style.setProperty('--settings-height', `${viewport?.height ?? innerHeight}px`)
      panel.style.setProperty('--settings-top', `${viewport?.offsetTop ?? 0}px`)
    }
    fit()
    if (!panel.open) panel.showModal()
    heading.current?.focus({ preventScroll: true })
    viewport?.addEventListener('resize', fit); viewport?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      viewport?.removeEventListener('resize', fit); viewport?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
    }
  }, [open])
  const close = () => {
    dialog.current?.close()
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }
  const status = session.preferencesStatus ?? 'device'
  const skinName = skinById(skin).name
  return <>
    <button ref={trigger} type="button" className="remote-finish-button" disabled={!enabled && !onPairing && !onChooseSkin} aria-label="Remote settings" aria-describedby="remote-current-skin" aria-haspopup="dialog" aria-expanded={open} aria-controls="remote-settings"
      onClick={() => { beforeOpen(); setOpen(true) }}><Settings size={22} strokeWidth={1.7} aria-hidden="true" /></button>
    <span id="remote-current-skin" className="sr-only" aria-live="polite">Current skin: {skinName}</span>
    {open && createPortal(<dialog ref={dialog} id="remote-settings" className="remote-reading-settings" aria-labelledby="remote-reading-title"
      onCancel={event => { event.preventDefault(); close() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const stops = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')].filter(element => element.getClientRects().length > 0)
        const first = stops[0], last = stops.at(-1)
        if (!first || !last) return
        if (!stops.includes(document.activeElement as HTMLElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault()
          const target = event.shiftKey ? last : first
          target.focus({ preventScroll: true })
        }
      }}>
      <header className="reading-settings-header"><h1 ref={heading} id="remote-reading-title" tabIndex={-1}>Settings</h1><button type="button" className="reading-settings-close" aria-label="Close settings" onClick={close}><X size={22} aria-hidden="true" /></button></header>
      <div className={`reading-settings-body${onChooseSkin ? ' has-skins' : ''}`}>
        {onChooseSkin && <button type="button" className="reading-skin-entry" aria-label="Change remote skin" onClick={() => { close(); onChooseSkin() }}>
          <span className="reading-skin-preview" aria-hidden="true"><RemoteSkinSample skin={skin} /></span>
          <span className="reading-skin-copy"><span>Remote skin</span><strong>{skinName}</strong><span className="reading-skin-browse">Browse skins <ArrowRight size={19} aria-hidden="true" /></span></span>
        </button>}
        <section className="reading-text-section" aria-labelledby="reading-text-title">
          <h2 id="reading-text-title">Display text</h2>
          <p className="reading-text-description">{session.editing.active ? 'Finish editing to change the text size.' : session.connection !== 'connected' ? 'Connect your display to change the text size.' : 'Text size on your connected display.'}</p>
          <div className="reading-size-controls" aria-label="Text size controls">
            <button type="button" disabled={!enabled || settings.fontSize <= 20} aria-label="Decrease text size" onClick={() => change({ fontSize: Math.max(20, settings.fontSize - 2) })}>A−</button>
            <output aria-label="Current text size" aria-live="polite">{settings.fontSize}<span>px</span></output>
            <button type="button" disabled={!enabled || settings.fontSize >= 160} aria-label="Increase text size" onClick={() => change({ fontSize: Math.min(160, settings.fontSize + 2) })}>A+</button>
          </div>
          <label className="sr-only" htmlFor="remote-text-size">TEXT SIZE</label><input id="remote-text-size" type="range" min="20" max="160" step="2" value={settings.fontSize} disabled={!enabled} onChange={event => change({ fontSize: Number(event.target.value) })} />
          <p className="reading-save-status" role="status" aria-label="Reading settings status">{error || (busy ? 'Applying to display…' : status === 'pending' ? 'Applied · saving to your account…' : status === 'saved' ? 'Saved to your account' : status === 'ready' ? 'Changes are remembered in your account' : status === 'conflict' ? 'Applied here. Newer preferences were saved in another session.' : status === 'unavailable' ? 'Applied here. Account saving is unavailable.' : stored ? 'Remembered on this device' : 'Applied here. Device storage is unavailable.') }</p>
          {['conflict', 'unavailable'].includes(status) && <button type="button" className="reading-save-retry" disabled={!enabled} onClick={() => session.send('settings:remember')}>Save these settings to my account</button>}
        </section>
        {onPairing && <button type="button" className="reading-pairing" onClick={() => { close(); onPairing() }}>Direct pairing <ArrowRight size={18} aria-hidden="true" /></button>}
      </div>
      <footer className="reading-settings-footer"><button type="button" onClick={close}>Done</button></footer>
    </dialog>, document.body)}
  </>
}
