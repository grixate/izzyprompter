import { useEffect, useId, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { jogKeyDelta } from '../realtime/keyboard'
import { boundedSpeed, MIN_SPEED, MAX_SPEED, SPEED_STEP, speedFraction } from '../prompt/speed'
import { positionTimecode } from '../prompt/timecode'
import { useWheelMotion } from './useWheelMotion'
import { InstrumentMechanism, InstrumentRotor } from './InstrumentMechanism'
import type { SkinId } from '../product/catalog'
import { ClockFaces, CounterTime, MatrixTime, SegmentTime } from './InstrumentTime'
import { hasCraftSpeed, InstrumentSpeed } from './InstrumentSpeed'

const normalizeAngle = (angle: number) => angle > Math.PI ? angle - Math.PI * 2 : angle < -Math.PI ? angle + Math.PI * 2 : angle

type Props = {
  enabled: boolean; playing: boolean; speed: number; position: number; maximum: number
  positionText: string; onToggle: () => void; onSeek: (delta: number) => void
  onEdge: (edge: 'start' | 'end') => void; onSpeedChange: (speed: number) => void
  onDraggingChange?: (dragging: boolean) => void; onSeekEnd?: () => void
  pageSize?: number; skin?: SkinId; spinOnPlayback?: boolean
}

/** One control surface for both the paired remote and the local entry preview. */
export function JogControls(props: Props) {
  const helpId = useId()
  const wheel = useRef<HTMLDivElement>(null)
  const dragAngle = useRef(0)
  const activePointer = useRef<number | null>(null)
  const latest = useRef(props)
  latest.current = props
  const [dragging, setDragging] = useState(false)
  const motor = useWheelMotion(wheel, { enabled: props.enabled, playing: props.playing && (props.spinOnPlayback ?? true), speed: props.speed, dragging, artwork: props.skin })
  const setDrag = (value: boolean) => { setDragging(value); latest.current.onDraggingChange?.(value) }

  useEffect(() => {
    if (!props.enabled) {
      const pointer = activePointer.current
      activePointer.current = null
      if (pointer !== null && wheel.current?.hasPointerCapture(pointer)) wheel.current.releasePointerCapture(pointer)
      setDragging(false)
      props.onDraggingChange?.(false)
    }
  }, [props.enabled, props.onDraggingChange])

  const pointerAngle = (event: React.PointerEvent) => {
    const rect = wheel.current!.getBoundingClientRect()
    return Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2)
  }
  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return
    activePointer.current = null
    if (wheel.current?.hasPointerCapture(event.pointerId)) wheel.current.releasePointerCapture(event.pointerId)
    setDrag(false)
    props.onSeekEnd?.()
  }

  return <div className="control-deck">
    <div className="wheel-column">
      <div ref={wheel} className={`jog-wheel ${dragging ? 'is-dragging' : ''}`} data-running={props.enabled && props.playing} data-dragging={dragging} data-available={props.enabled}
        onPointerDown={(event) => {
          if (!props.enabled || activePointer.current !== null || event.button !== 0 || (event.target as HTMLElement).closest('.transport-button')) return
          event.preventDefault()
          motor.freeze()
          wheel.current?.setPointerCapture(event.pointerId)
          activePointer.current = event.pointerId
          wheel.current?.querySelector<HTMLElement>('.wheel-input')?.focus({ preventScroll: true })
          dragAngle.current = pointerAngle(event)
          setDrag(true)
        }}
        onPointerMove={(event) => {
          if (!props.enabled || activePointer.current !== event.pointerId || !wheel.current?.hasPointerCapture(event.pointerId)) return
          const next = pointerAngle(event)
          const delta = normalizeAngle(next - dragAngle.current)
          dragAngle.current = next
          motor.rotate(delta)
          props.onSeek(delta * 92)
        }}
        onPointerUp={release} onPointerCancel={release}
        onLostPointerCapture={release}>
        <div className="wheel-rotor-mask" aria-hidden="true"><div className="wheel-rotor"><InstrumentRotor skin={props.skin ?? 'original'} /><div className="wheel-disc" /></div></div>
        <InstrumentMechanism skin={props.skin ?? 'original'} />
        <div className="wheel-input" role="slider" tabIndex={0}
          aria-label="Jog script position" aria-describedby={helpId} aria-orientation="horizontal"
          aria-disabled={!props.enabled} aria-valuemin={0} aria-valuemax={props.maximum}
          aria-valuenow={Math.max(0, Math.min(props.maximum, Math.round(props.position)))} aria-valuetext={props.positionText}
          onKeyDown={(event) => {
            if (!props.enabled || event.altKey || event.ctrlKey || event.metaKey) return
            const delta = jogKeyDelta(event.key, props.pageSize ?? 480)
            if (delta !== null) { event.preventDefault(); motor.nudge(delta / 92); props.onSeek(delta) }
            else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); props.onEdge(event.key === 'Home' ? 'start' : 'end') }
          }} />
        <button className="transport-button" disabled={!props.enabled} onClick={props.onToggle} aria-label={props.playing ? 'Pause' : 'Play'}>
          {props.playing ? <Pause size={34} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
        </button>
      </div>
      <span className="wheel-caption">JOG / SCRUB</span>
      <span id={helpId} className="sr-only">Use arrow keys to jog the script. Page Up and Page Down move farther; Home and End go to the beginning and end. Tab to the separate Play or Pause button. On Mac Safari, use Option+Tab if Tab skips controls.</span>
    </div>
    {hasCraftSpeed(props.skin) ? <InstrumentSpeed skin={props.skin!} speed={props.speed} enabled={props.enabled} onChange={props.onSpeedChange} /> : <div className="speed-module">
      <span className="speed-title">SPEED</span>
      <button aria-label="Decrease speed" disabled={!props.enabled} onClick={() => props.onSpeedChange(boundedSpeed(props.speed - 0.05))}>−</button>
      <div className="speed-track">
        <input disabled={!props.enabled} type="range" min={MIN_SPEED} max={MAX_SPEED} step={SPEED_STEP} value={props.speed}
          onChange={(event) => props.onSpeedChange(boundedSpeed(Number(event.target.value)))} aria-label="Playback speed" aria-valuetext={`${props.speed.toFixed(2)} times normal speed`} />
        <span style={{ width: `${speedFraction(props.speed) * 100}%` }} />
      </div>
      <button aria-label="Increase speed" disabled={!props.enabled} onClick={() => props.onSpeedChange(boundedSpeed(props.speed + 0.05))}>+</button>
      <strong>{props.speed.toFixed(2)}×</strong>
    </div>}
  </div>
}

export function TransportReadout({ position, speed, playing, available = true, label = 'TRANSPORT', skin, scrubbing=false }: {
  position: number; speed: number; playing: boolean; available?: boolean; label?: string; skin?:SkinId;scrubbing?:boolean
}) {
  const [time, fraction] = positionTimecode(position, speed).split('.')
  const craft=hasCraftSpeed(skin),value=available?`${time}.${fraction}`:'—'
  return <div className={`transport-readout${craft?` readout-craft readout--${skin}`:''}`}>
    <div className="display-kicker"><span>{label}</span><span>POS {available ? String(Math.round(position)).padStart(5, '0') : '—'}</span></div>
    <div className="timecode" aria-label={craft?`Script position ${value}`:undefined}>{craft ? ['groove','foundry','switchboard','correspondent'].includes(skin!)
      ? <><CounterTime value={available?time:'—'} playing={playing} scrubbing={scrubbing} /><small className="counter-fraction">{available?`.${fraction}`:''}</small></>
      : <><span className="sr-only">{value}</span>{skin==='field'||skin==='signal'?<SegmentTime value={value}/>:skin==='observatory'?<><ClockFaces value={available?value:'00:00.0'}/><b className="clock-number" aria-hidden="true" data-value={value}/></>:skin==='ivory'||skin==='original'||skin==='vector'||skin==='graphite'?<b className="printed-time" aria-hidden="true" data-value={value} data-whole={available?time:'—'} data-fraction={available?fraction:''} data-minutes={time.split(':')[0]} data-seconds={`${time.split(':')[1]}.${fraction}`}/>:<MatrixTime value={value} square={skin==='arcade'||skin==='cartridge'} />}</>
      : <>{available ? time : '—'}<span>{available ? `.${fraction}` : ''}</span></>}</div>
    {craft&&<div className="readout-units" aria-hidden="true">MIN <span>/</span> SEC</div>}
    <div className={`state-label ${playing ? 'is-playing' : ''}`}><i />{playing ? 'RUN' : 'HOLD'}</div>
  </div>
}
