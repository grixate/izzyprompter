import { useRef } from 'react'
import { Play } from 'lucide-react'
import { skinById, type SkinId } from '../product/catalog'
import { useWheelMotion } from './useWheelMotion'
import '../product/skins.css'

export function RemoteInstrument({ skin = 'ivory', phase = 0, motion = true }: { skin?: SkinId; phase?: number; motion?: boolean }) {
  const face = skinById(skin)
  const root = useRef<HTMLDivElement>(null)
  useWheelMotion(root, { enabled: motion, playing: false, speed: 1, phase })
  return <div className={`remote-instrument skin-face skin--${face.id}`} ref={root} aria-hidden="true">
    <div className="instrument-top"><span className="instrument-model">R–{face.number}</span><span className="instrument-wordmark">IZZY<span>PHONE REMOTE</span></span></div>
    <div className="instrument-plate"><span>{face.name}</span><small>{face.material}</small></div>
    <div className="control-deck"><div className="wheel-column"><div className="jog-wheel">
      <div className="wheel-rotor"><div className="wheel-disc" /></div><div className="wheel-input" />
      <div className="transport-button"><Play size={28} fill="currentColor" /></div>
    </div><span className="wheel-caption">JOG / SCRUB</span></div>
    <div className="instrument-speed"><span>−</span><i /><span>+</span><small>SPEED</small></div></div>
    <div className="instrument-bottom"><span>TURN TO FIND YOUR PACE</span><i /></div>
  </div>
}
