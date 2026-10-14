import { BrandLogo } from '../components/BrandLogo'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Expand, Pause, Play, Settings2, X } from 'lucide-react'
import { legacySessionScriptToDocument } from '../domain/document'
import { DEFAULT_PROMPT_SETTINGS, loadWorkspaceStorage, savePromptSettings } from '../domain/storage'
import { usePromptEngine } from '../prompt/usePromptEngine'
import { useSession } from '../realtime/useSession'
import { SessionNotice } from '../realtime/SessionNotice'
import { boundedSpeed } from '../realtime/keyboard'
import { PromptSurface } from '../components/PromptSurface'
import type { SessionControllerView } from '../realtime/controller'
import type { PromptSettingsV1 } from '../domain/storage'

export function DisplayPage({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId, 'display')
  return <DisplaySurface sessionId={sessionId} session={session} />
}

export function DisplaySurface({ sessionId, session, onSettingsChange }: {
  sessionId: string; session: SessionControllerView; onSettingsChange?: (settings: PromptSettingsV1) => void
}) {
  const { connection, transport, script, presence, clockOffset, sessionEpoch, reading, displayId, send, editing, reconnect, displaySettings, now } = session
  const displayRef = useRef<HTMLElement>(null)
  const scriptRef = useRef<HTMLDivElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsPanelRef = useRef<HTMLElement>(null)
  const transportRef = useRef(transport)
  const [settings, setSettings] = useState(() => displaySettings?.value ?? loadWorkspaceStorage().settings)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chromeFocused, setChromeFocused] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  const controlsReady = connection === 'connected' && !editing.active
  const izzyDocument = useMemo(
    () => legacySessionScriptToDocument(script, sessionId).document,
    [script, sessionId],
  )
  const layoutKey = `${settings.fontSize}:${settings.lineHeight}:${settings.textWidth}`
  usePromptEngine({
    sessionId, sessionEpoch, document: izzyDocument, transport, clockOffset, now,
    scriptRevision: script.revision, reading, displayId, connection, send,
    trackRef: scriptRef, displayRef, layoutKey,
  })

  useEffect(() => {
    transportRef.current = transport
    if (connection === 'connected') setSettings((value) => ({ ...value, speed: transport.speed }))
  }, [connection, transport])

  useEffect(() => { savePromptSettings(settings) }, [settings])
  const updateSettings = (patch: Partial<PromptSettingsV1>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    // Commit local changes in the input event, before a Back/Save action can
    // snapshot the controller. Persistence remains asynchronous and separate.
    onSettingsChange?.(next)
  }
  useEffect(() => {
    // Local settings originate here. Feeding the persisted copy back during a
    // layout checkpoint can race a user's slider change and restore an old value.
    if (displaySettings && !onSettingsChange) setSettings({ ...displaySettings.value, speed: transportRef.current.speed })
  }, [displaySettings, onSettingsChange])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false)
        settingsButtonRef.current?.focus()
        return
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey
        || target?.closest('input, textarea, select, button, a, dialog, [contenteditable="true"]')) return
      if (event.key.toLowerCase() === 'f') { void fullscreen(); return }
      if (!controlsReady) return
      if (event.code === 'Space') {
        event.preventDefault()
        send(transportRef.current.status === 'playing' ? 'transport:pause' : 'transport:play')
      } else if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
        event.preventDefault()
        send('transport:seek_delta', { delta: event.code === 'ArrowDown' ? 48 : -48 })
      } else if (event.key === '+' || event.key === '-') {
        send('transport:set_speed', { speed: boundedSpeed(transportRef.current.speed + (event.key === '+' ? 0.05 : -0.05)) })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send, settingsOpen, controlsReady])

  useEffect(() => {
    if (settingsOpen) settingsPanelRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [settingsOpen])

  useEffect(() => {
    if (!controlsVisible || settingsOpen || chromeFocused) return
    const timeout = window.setTimeout(() => setControlsVisible(false), 3_000)
    return () => window.clearTimeout(timeout)
  }, [controlsVisible, settingsOpen, chromeFocused, transport.status])

  useEffect(() => {
    let active = true
    let lock: { release: () => Promise<void> } | null = null
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }).wakeLock
    const acquire = async () => {
      if (!active || !wakeLock || transport.status !== 'playing' || document.visibilityState !== 'visible') return
      try {
        const acquired = await wakeLock.request('screen')
        if (active) lock = acquired
        else await acquired.release()
      } catch { /* progressive enhancement */ }
    }
    void acquire()
    const onVisibility = () => { if (document.visibilityState === 'visible') void acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
      if (lock) void lock.release()
    }
  }, [transport.status])

  const toggle = () => send(transport.status === 'playing' ? 'transport:pause' : 'transport:play')
  const chromeVisible = controlsVisible || settingsOpen || chromeFocused
  const fullscreen = async () => {
    try {
      if (!displayRef.current?.requestFullscreen) throw new Error('unavailable')
      await displayRef.current.requestFullscreen()
      setFullscreenError(false)
    } catch { setFullscreenError(true); setControlsVisible(true) }
  }
  const textStyle = {
    '--prompt-size': `${settings.fontSize}px`,
    '--prompt-leading': settings.lineHeight,
    '--prompt-width': `${settings.textWidth}%`,
  } as CSSProperties

  return (
    <main className="display-panel standalone-display" ref={displayRef} onPointerDown={() => setControlsVisible(true)}
      onFocusCapture={() => { setChromeFocused(true); setControlsVisible(true) }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setChromeFocused(false) }}
      onKeyDownCapture={(event) => { if (event.key === 'Tab') setControlsVisible(true) }}
      aria-label="Teleprompter display" style={textStyle}>
      <SessionNotice connection={connection} surface="display" onRetry={reconnect} />
      <header className={`display-header display-chrome ${chromeVisible ? '' : 'is-hidden'}`}>
        <BrandLogo context={sessionId} light />
        <div className="display-actions">
          <span className={`network-state ${connection}`}><i /> {session.path?.toUpperCase() ?? connection.toUpperCase()}</span>
          <span className="remote-presence">REMOTE {presence.remote > 0 ? 'READY' : 'WAITING'}</span>
          <button ref={settingsButtonRef} className="icon-button" onClick={() => setSettingsOpen((value) => !value)} aria-label="Prompt settings" aria-expanded={settingsOpen} aria-controls="prompt-settings"><Settings2 size={15} /></button>
          <button className="icon-button" onClick={() => void fullscreen()} aria-label="Fullscreen display"><Expand size={15} /></button>
        </div>
      </header>

      {settingsOpen && (
        <section className="prompt-settings" id="prompt-settings" ref={settingsPanelRef} aria-label="Prompt settings panel">
          <div className="prompt-settings-heading"><span>DISPLAY / SETUP</span><button className="icon-button" aria-label="Close prompt settings" onClick={() => { setSettingsOpen(false); settingsButtonRef.current?.focus() }}><X size={14} /></button></div>
          {session.path === 'local' && <>
            <label>PLAYBACK SPEED <output>{transport.speed.toFixed(2)}×</output><input aria-label="Local playback speed" type="range" min="0.5" max="1.5" step="0.05" value={transport.speed} disabled={!controlsReady} onChange={event => send('transport:set_speed', { speed: Number(event.target.value) })} /></label>
            <div className="local-reading-controls" aria-label="Local reading navigation">
              <button disabled={!controlsReady} onClick={() => send('transport:seek_delta', { delta: -48 })}>Jog backward</button>
              <button disabled={!controlsReady} onClick={() => send('transport:seek_delta', { delta: 48 })}>Jog forward</button>
              <button disabled={!controlsReady} onClick={() => send('transport:step_block', { direction: -1 })}>Previous paragraph</button>
              <button disabled={!controlsReady} onClick={() => send('transport:step_block', { direction: 1 })}>Next paragraph</button>
            </div>
          </>}
          <label>TEXT SIZE <output>{settings.fontSize}</output><input aria-label="Text size" type="range" min="20" max="160" step="2" value={settings.fontSize} onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })} /></label>
          <label>LINE SPACING <output>{settings.lineHeight.toFixed(2)}</output><input aria-label="Line spacing" type="range" min="0.8" max="3" step="0.02" value={settings.lineHeight} onChange={(event) => updateSettings({ lineHeight: Number(event.target.value) })} /></label>
          <label>TEXT WIDTH <output>{settings.textWidth}%</output><input aria-label="Text width" type="range" min="25" max="100" step="1" value={settings.textWidth} onChange={(event) => updateSettings({ textWidth: Number(event.target.value) })} /></label>
          <label className="mirror-option">MIRROR TEXT <input aria-label="Mirror text" type="checkbox" checked={settings.mirrored} onChange={(event) => updateSettings({ mirrored: event.target.checked })} /></label>
          <button className="reset-type-button" onClick={() => updateSettings({ ...DEFAULT_PROMPT_SETTINGS, speed: settings.speed })}>RESET DISPLAY</button>
        </section>
      )}

      <PromptSurface blocks={izzyDocument.blocks} trackRef={scriptRef} mirrored={settings.mirrored} />

      <p className="sr-only" id="display-key-help">Keyboard: Space to play or pause, Up and Down arrows to jog, plus and minus to change speed, F for fullscreen. Tab to settings. On Mac Safari, use Option+Tab if Tab skips controls.</p>
      {fullscreenError && <p className="display-feedback" role="status">Fullscreen unavailable. Use your browser's fullscreen control, or continue in this window.</p>}
      <button className={`display-transport display-chrome ${chromeVisible ? '' : 'is-hidden'}`} disabled={!controlsReady} onClick={toggle} aria-describedby="display-key-help" aria-label={transport.status === 'playing' ? 'Pause' : 'Play'}>
        {transport.status === 'playing' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </button>
      <footer className={`display-footer display-chrome ${chromeVisible ? '' : 'is-hidden'}`}>
        <span>{transport.status === 'playing' ? 'ROLLING' : 'STANDBY'}</span>
        <span>{transport.speed.toFixed(2)}×</span>
      </footer>
    </main>
  )
}
