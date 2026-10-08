import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Expand, Pause, Play } from 'lucide-react'
import { useSession } from '../realtime/useSession'
import type { TransportState } from '../realtime/protocol'

const BASE_PIXELS_PER_SECOND = 52
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const expectedPosition = (transport: TransportState, clockOffset: number) => {
  if (transport.status === 'paused') return transport.anchor_position
  const elapsed = Math.max(0, Date.now() + clockOffset - transport.anchor_server_time) / 1_000
  return transport.anchor_position + elapsed * BASE_PIXELS_PER_SECOND * transport.speed
}

export function DisplayPage({ sessionId }: { sessionId: string }) {
  const { connection, transport, script, presence, clockOffset, send } = useSession(sessionId, 'display')
  const displayRef = useRef<HTMLElement>(null)
  const scriptRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const maxPositionRef = useRef(1)
  const transportRef = useRef(transport)
  const clockOffsetRef = useRef(clockOffset)
  const lastFrameRef = useRef(performance.now())
  const [controlsVisible, setControlsVisible] = useState(true)

  const paragraphs = useMemo(
    () => script.content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean),
    [script.content],
  )

  const renderPosition = useCallback((position: number) => {
    const bounded = clamp(position, 0, maxPositionRef.current)
    positionRef.current = bounded
    if (scriptRef.current) scriptRef.current.style.transform = `translate3d(0, ${-bounded}px, 0)`
  }, [])

  useEffect(() => {
    const previousStatus = transportRef.current.status
    transportRef.current = transport
    clockOffsetRef.current = clockOffset
    const expected = expectedPosition(transport, clockOffset)
    if (
      Math.abs(expected - positionRef.current) > 380 ||
      (previousStatus === 'playing' && transport.status === 'paused')
    ) renderPosition(expected)
  }, [clockOffset, renderPosition, transport])

  useEffect(() => {
    const measure = () => {
      if (!displayRef.current || !scriptRef.current) return
      maxPositionRef.current = Math.max(1, scriptRef.current.scrollHeight - displayRef.current.clientHeight * 0.48)
      renderPosition(positionRef.current)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (displayRef.current) observer.observe(displayRef.current)
    if (scriptRef.current) observer.observe(scriptRef.current)
    return () => observer.disconnect()
  }, [paragraphs, renderPosition])

  useEffect(() => {
    let frameId = 0
    const frame = (now: number) => {
      const deltaSeconds = Math.min(0.05, (now - lastFrameRef.current) / 1_000)
      lastFrameRef.current = now
      const currentTransport = transportRef.current

      let next = positionRef.current
      if (currentTransport.status === 'playing') next += BASE_PIXELS_PER_SECOND * currentTransport.speed * deltaSeconds

      const authoritative = expectedPosition(currentTransport, clockOffsetRef.current)
      const difference = authoritative - next
      if (Math.abs(difference) < 380) next += difference * Math.min(1, deltaSeconds * 12)
      renderPosition(next)
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [renderPosition])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        send(transportRef.current.status === 'playing' ? 'transport:pause' : 'transport:play')
      } else if (event.code === 'ArrowDown') send('transport:seek_delta', { delta: 48 })
      else if (event.code === 'ArrowUp') send('transport:seek_delta', { delta: -48 })
      else if (event.key.toLowerCase() === 'f') displayRef.current?.requestFullscreen?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send])

  useEffect(() => {
    if (!controlsVisible) return
    const timeout = window.setTimeout(() => setControlsVisible(false), 3_000)
    return () => window.clearTimeout(timeout)
  }, [controlsVisible, transport.status])

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }).wakeLock

    const acquire = async () => {
      if (!wakeLock || transport.status !== 'playing' || document.visibilityState !== 'visible') return
      try { lock = await wakeLock.request('screen') } catch { /* progressive enhancement */ }
    }

    if (transport.status === 'playing') void acquire()
    const onVisibility = () => { if (!lock) void acquire() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (lock) void lock.release()
    }
  }, [transport.status])

  const toggle = () => send(transport.status === 'playing' ? 'transport:pause' : 'transport:play')

  return (
    <main className="display-panel standalone-display" ref={displayRef} onPointerDown={() => setControlsVisible(true)} aria-label="Teleprompter display">
      <header className={`display-header display-chrome ${controlsVisible ? '' : 'is-hidden'}`}>
        <div className="wordmark"><span className="wordmark-mark">C</span><span>CUE / {sessionId}</span></div>
        <div className="display-actions">
          <span className={`network-state ${connection}`}><i /> {connection.toUpperCase()}</span>
          <span className="remote-presence">REMOTE {presence.remote > 0 ? 'READY' : 'WAITING'}</span>
          <button className="icon-button" onClick={() => displayRef.current?.requestFullscreen?.()} aria-label="Fullscreen display"><Expand size={15} /></button>
        </div>
      </header>

      <div className="reading-window">
        <div className="script-track" ref={scriptRef}>
          {paragraphs.length > 0
            ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            : <p className="waiting-copy">Waiting for the script…</p>}
        </div>
      </div>
      <div className="focus-band" aria-hidden="true"><span /></div>
      <div className="display-vignette" aria-hidden="true" />

      <button className={`display-transport display-chrome ${controlsVisible ? '' : 'is-hidden'}`} onClick={toggle} aria-label={transport.status === 'playing' ? 'Pause' : 'Play'}>
        {transport.status === 'playing' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </button>
      <footer className={`display-footer display-chrome ${controlsVisible ? '' : 'is-hidden'}`}>
        <span>{transport.status === 'playing' ? 'ROLLING' : 'STANDBY'}</span>
        <span>{transport.speed.toFixed(2)}× · READ LINE 42</span>
      </footer>
    </main>
  )
}
