import { memo, useRef } from 'react'
import { Pause, Play } from 'lucide-react'
import { skinById, type SkinId } from '../product/catalog'
import { useWheelMotion } from './useWheelMotion'
import { InstrumentMechanism, InstrumentRotor } from './InstrumentMechanism'
import '../product/skins.css'
import { JogControls, TransportReadout } from './JogControls'
import { useInstrumentPreview } from './useInstrumentPreview'
import { hasCraftSpeed, InstrumentSpeed } from './InstrumentSpeed'

function StaticControls({skin, phase, motion, playing}: {skin: SkinId; phase: number; motion: boolean; playing: boolean}) {
  const wheel = useRef<HTMLDivElement>(null)
  useWheelMotion(wheel, {enabled: motion, playing, speed: 1, phase, ambient: !playing, artwork: skin})
  return <div className="control-deck"><div className="wheel-column"><div ref={wheel} className="jog-wheel" data-running={playing} data-dragging="false" data-available="true">
    <div className="wheel-rotor"><InstrumentRotor skin={skin} /><div className="wheel-disc" /></div><div className="wheel-input" />
    <InstrumentMechanism skin={skin} />
    <div className="transport-button">{playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</div>
  </div><span className="wheel-caption">JOG / SCRUB</span></div>
  {hasCraftSpeed(skin) ? <InstrumentSpeed skin={skin} speed={.56} /> : <div className="instrument-speed speed-module"><span className="speed-step">−</span><div className="speed-track"><span style={{width:'36%'}} /></div><span className="speed-step">+</span><strong>0.56×</strong></div>}
  </div>
}

export const RemoteInstrument = memo(function RemoteInstrument({ skin = 'ivory', phase = 0, motion = true, playing, onPlayingChange, interactive = true }: { skin?: SkinId; phase?: number; motion?: boolean; playing?: boolean; onPlayingChange?: (value: boolean) => void; interactive?: boolean }) {
  const face = skinById(skin)
  const root = useRef<HTMLDivElement>(null)
  const demo = useInstrumentPreview(root, interactive, playing, onPlayingChange)
  const running = interactive ? demo.running : (playing ?? false)
  return <div className={`remote-instrument skin-face skin--${face.id}`} ref={root} aria-hidden={interactive ? undefined : true} role={interactive ? 'group' : undefined} aria-label={interactive ? `${face.name} remote preview` : undefined} data-interactive={interactive}>
    <div className="instrument-top"><span className="instrument-model">R–{face.number}</span><span className="instrument-wordmark">IZZY<span>PHONE REMOTE</span></span></div>
    {hasCraftSpeed(skin)?<TransportReadout skin={skin} position={interactive ? demo.position : 310} speed={interactive ? demo.speed : .56} playing={running} label="SCRIPT POSITION" />:<div className="instrument-plate"><span>{face.name}</span><small>{face.material}</small></div>}
    {interactive ? <JogControls skin={skin} enabled playing={demo.playing} spinOnPlayback={motion} speed={demo.speed} position={demo.position} maximum={demo.maximum}
      positionText={`Preview position ${Math.round(demo.position)} of ${demo.maximum} pixels`}
      onToggle={demo.toggle} onSeek={demo.jog} onEdge={demo.edge} onSpeedChange={demo.setSpeed} /> : <StaticControls skin={skin} phase={phase} motion={motion} playing={running} />}
    <div className="instrument-bottom"><span>TURN TO FIND YOUR PACE</span><i /></div>
  </div>
})
