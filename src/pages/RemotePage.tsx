import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useSession } from '../realtime/useSession'

const SEEK_PIXELS_PER_RADIAN = 92
const BASE_PIXELS_PER_SECOND = 52
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const normalizeAngle = (angle: number) => angle > Math.PI ? angle - Math.PI * 2 : angle < -Math.PI ? angle + Math.PI * 2 : angle

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function RemotePage({ sessionId }: { sessionId: string }) {
  const { connection, transport, script, presence, clockOffset, send } = useSession(sessionId, 'remote')
  const wheelRef = useRef<HTMLDivElement>(null)
  const wheelAngleRef = useRef(0)
  const dragAngleRef = useRef(0)
  const pendingSeekRef = useRef(0)
  const seekTimerRef = useRef<number | null>(null)
  const positionRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [localSpeed, setLocalSpeed] = useState(0.86)
  const [position, setPositionState] = useState(0)

  const setPosition = (value: number | ((previous: number) => number)) => {
    const next = typeof value === 'function' ? value(positionRef.current) : value
    positionRef.current = next
    setPositionState(next)
  }

  const paragraphs = useMemo(
    () => script.content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean),
    [script.content],
  )
  const phraseAnchors = useMemo(() => {
    let offset = 0
    return paragraphs.map((paragraph) => {
      const anchor = offset
      offset += Math.max(120, paragraph.length * 3.15)
      return anchor
    })
  }, [paragraphs])

  useEffect(() => {
    setLocalPlaying(transport.status === 'playing')
    setLocalSpeed(transport.speed)
    const elapsed = transport.status === 'playing'
      ? Math.max(0, Date.now() + clockOffset - transport.anchor_server_time) / 1_000
      : 0
    setPosition(transport.anchor_position + elapsed * BASE_PIXELS_PER_SECOND * transport.speed)
  }, [clockOffset, transport])

  useEffect(() => {
    if (!localPlaying) return
    const timer = window.setInterval(() => {
      setPosition((value) => value + BASE_PIXELS_PER_SECOND * localSpeed * 0.2)
    }, 200)
    return () => window.clearInterval(timer)
  }, [localPlaying, localSpeed])

  const currentPhraseIndex = phraseAnchors.reduce((active, anchor, index) => anchor <= position + 20 ? index : active, 0)

  const flushSeek = () => {
    if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
    seekTimerRef.current = null
    const delta = pendingSeekRef.current
    pendingSeekRef.current = 0
    if (delta !== 0) send('transport:seek_delta', { delta })
  }

  const queueSeek = (delta: number) => {
    setPosition((value) => Math.max(0, value + delta))
    pendingSeekRef.current += delta
    if (seekTimerRef.current === null) seekTimerRef.current = window.setTimeout(flushSeek, 33)
  }

  useEffect(() => () => {
    if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
  }, [])

  const pointerAngle = (event: React.PointerEvent) => {
    const rect = wheelRef.current!.getBoundingClientRect()
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.transport-button')) return
    event.preventDefault()
    wheelRef.current?.setPointerCapture(event.pointerId)
    dragAngleRef.current = pointerAngle(event)
    setIsDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current?.hasPointerCapture(event.pointerId)) return
    const angle = pointerAngle(event)
    const delta = normalizeAngle(angle - dragAngleRef.current)
    dragAngleRef.current = angle
    wheelAngleRef.current += delta
    wheelRef.current.style.setProperty('--wheel-angle', `${wheelAngleRef.current}rad`)
    queueSeek(delta * SEEK_PIXELS_PER_RADIAN)
  }

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (wheelRef.current?.hasPointerCapture(event.pointerId)) wheelRef.current.releasePointerCapture(event.pointerId)
    setIsDragging(false)
    flushSeek()
  }

  const toggle = () => {
    const next = !localPlaying
    setLocalPlaying(next)
    send(next ? 'transport:play' : 'transport:pause')
    navigator.vibrate?.(next ? 18 : [12, 25, 12])
  }

  const changeSpeed = (next: number) => {
    const speed = clamp(next, 0.5, 1.5)
    setLocalSpeed(speed)
    send('transport:set_speed', { speed })
  }

  const jumpPhrase = (direction: -1 | 1) => {
    const target = clamp(currentPhraseIndex + direction, 0, phraseAnchors.length - 1)
    const targetPosition = phraseAnchors[target] ?? 0
    setPosition(targetPosition)
    send('transport:seek_to', { position: targetPosition })
    navigator.vibrate?.(10)
  }

  return (
    <main className="remote-panel standalone-remote" aria-label="Remote controller">
      <header className="remote-header">
        <div className="remote-identity">
          <strong>R–01</strong>
          <span className="eyebrow">CUE REMOTE · {sessionId}</span>
        </div>
        <div className="remote-link-state">
          <span className={`network-state ${connection}`}><i /> {connection.toUpperCase()}</span>
          <small>DSP {presence.display > 0 ? '01 READY' : '00 WAIT'}</small>
        </div>
      </header>

      <div className="transport-readout">
        <div className="display-kicker"><span>TRANSPORT</span><span>POS {String(Math.round(position)).padStart(5, '0')}</span></div>
        <div className="timecode">{formatTime(position / (BASE_PIXELS_PER_SECOND * localSpeed))}<span>.{Math.floor(position % 10)}</span></div>
        <div className={`state-label ${localPlaying ? 'is-playing' : ''}`}><i />{localPlaying ? 'RUN' : 'HOLD'}</div>
      </div>

      <div className="control-deck">
        <div className="wheel-column">
          <div
            className={`jog-wheel ${isDragging ? 'is-dragging' : ''}`}
            ref={wheelRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            role="slider"
            tabIndex={0}
            aria-label="Jog script position"
            aria-valuemin={0}
            aria-valuemax={99999}
            aria-valuenow={Math.round(position)}
          >
            <div className="wheel-rotor" aria-hidden="true"><div className="wheel-disc" /></div>
            <button className="transport-button" onClick={toggle} aria-label={localPlaying ? 'Pause' : 'Play'}>
              {localPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
            </button>
          </div>
          <span className="wheel-caption">JOG / SCRUB</span>
        </div>

        <div className="speed-module">
          <span className="speed-title">SPEED</span>
          <button aria-label="Decrease speed" onClick={() => changeSpeed(localSpeed - 0.05)}>−</button>
          <div className="speed-track">
            <input type="range" min="0.5" max="1.5" step="0.01" value={localSpeed} onChange={(event) => changeSpeed(Number(event.target.value))} aria-label="Playback speed" />
            <span style={{ width: `${(localSpeed - 0.5) * 100}%` }} />
          </div>
          <button aria-label="Increase speed" onClick={() => changeSpeed(localSpeed + 0.05)}>+</button>
          <strong>{localSpeed.toFixed(2)}×</strong>
        </div>
      </div>

      <div className="phrase-nav">
        <button onClick={() => jumpPhrase(-1)} aria-label="Previous phrase"><span>←</span><small>PREV</small></button>
        <span className="phrase-count"><small>PHRASE</small>{String(currentPhraseIndex + 1).padStart(2, '0')} / {String(Math.max(1, paragraphs.length)).padStart(2, '0')}</span>
        <button onClick={() => jumpPhrase(1)} aria-label="Next phrase"><small>NEXT</small><span>→</span></button>
      </div>
      <footer className="remote-footer"><span>TURN TO SEEK</span><span>PRESS CENTER TO {localPlaying ? 'PAUSE' : 'PLAY'}</span></footer>
    </main>
  )
}
