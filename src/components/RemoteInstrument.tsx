import { memo, useRef } from 'react'
import { Pause, Play } from 'lucide-react'
import { skinById, type SkinId } from '../product/catalog'
import { useWheelMotion } from './useWheelMotion'
import { InstrumentMechanism, InstrumentRotor } from './InstrumentMechanism'
import '../product/skins.css'

export const RemoteInstrument = memo(function RemoteInstrument({ skin = 'ivory', phase = 0, motion = true, playing = false }: { skin?: SkinId; phase?: number; motion?: boolean; playing?: boolean }) {
  const face = skinById(skin)
  const root = useRef<HTMLDivElement>(null)
  useWheelMotion(root, { enabled: motion, playing, speed: 1, phase, ambient: !playing, artwork: skin })
  return <div className={`remote-instrument skin-face skin--${face.id}`} ref={root} aria-hidden="true">
    <div className="instrument-top"><span className="instrument-model">R–{face.number}</span><span className="instrument-wordmark">IZZY<span>PHONE REMOTE</span></span></div>
    <div className="instrument-plate"><span>{face.name}</span><small>{face.material}</small></div>
    <div className="control-deck"><div className="wheel-column"><div className="jog-wheel" data-running={playing} data-dragging="false" data-available="true">
      <div className="wheel-rotor"><InstrumentRotor skin={skin} /><div className="wheel-disc" /></div><div className="wheel-input" />
      <InstrumentMechanism skin={skin} />
      <div className="transport-button">{playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</div>
    </div><span className="wheel-caption">JOG / SCRUB</span></div>
    <div className="instrument-speed speed-module">
      <span className="speed-step">−</span>
      <div className="speed-track"><span style={{ width: '36%' }} /></div>
      <span className="speed-step">+</span><strong>0.86×</strong>
    </div></div>
    <div className="instrument-bottom"><span>TURN TO FIND YOUR PACE</span><i /></div>
  </div>
})
