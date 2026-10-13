import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowUpRight, Check, Maximize2, RotateCcw } from 'lucide-react'
import { JogControls, TransportReadout } from '../components/JogControls'
import { BASE_PIXELS_PER_SECOND } from '../prompt/motion'
import './jog-lab.css'

const studies = [
  { id: 'field', number: '01', name: 'Field reel', material: 'SATIN ALUMINIUM', tag: 'THE QUIET ONE',
    description: 'One broad disc. A fine seam. Transport moves off the wheel, giving your thumb the whole surface.',
    detail: 'Separate play key · engraved face · shallow edge' },
  { id: 'graphite', number: '02', name: 'Thumbprint', material: 'ANODIZED GRAPHITE', tag: 'THE TACTILE ONE',
    description: 'A recessed finger pocket and a restrained, gripped edge. More tool, less interface.',
    detail: 'Finger recess · separate play key · soft machining' },
  { id: 'ivory', number: '03', name: 'Orbit', material: 'WARM CERAMIC', tag: 'THE DIGITAL ONE',
    description: 'A clean ring around a quiet play key. The smallest amount of hardware language that still feels physical.',
    detail: 'Central transport · single index · almost flat' },
  { id: 'original', number: '00', name: 'Original', material: 'IZZY / CURRENT DESIGN', tag: 'THE BASELINE',
    description: 'Our existing knurled wheel, unchanged. A familiar reference to compare the new directions against.',
    detail: 'Central transport · full grip ring · deep graphite' },
  { id: 'signal', number: '04', name: 'Signal', material: 'SAFETY ORANGE', tag: 'THE BOLD ONE',
    description: 'A little broadcast equipment, a little field instrument. An orange shell, a dark disc, and one unmistakable play key.',
    detail: 'Enamel shell · inset charcoal wheel · square transport' },
  { id: 'groove', number: '05', name: 'Groove', material: 'SMOKED VINYL', tag: 'THE ANALOG ONE',
    description: 'Fine record grooves catch the light as you turn. A warm studio finish and a small orange label bring a little soul to the take.',
    detail: 'Concentric grooves · label-like hub · studio cream' },
  { id: 'glacier', number: '06', name: 'Glacier', material: 'FROSTED POLYCARBONATE', tag: 'THE LIGHT ONE',
    description: 'An icy, almost translucent reel. Three soft spokes and a floating transport key make the mechanism feel unusually light.',
    detail: 'Three-spoke reel · frosted edge · separate play key' },
  { id: 'oxide', number: '07', name: 'Bakelite', material: 'OXIDE / WARM RESIN', tag: 'THE UNEXPECTED ONE',
    description: 'A little vintage laboratory. Oxblood resin, a squared-off wheel bay, and a porcelain key. Familiar mechanics, a different decade.',
    detail: 'Recessed square bay · resin disc · porcelain transport' },
  { id: 'switchboard', number: '08', name: 'Switchboard', material: 'PETROL ENAMEL / IVORY', tag: 'THE CONVERSATIONAL ONE',
    description: 'Before touchscreens, there was the rotary dial. Ten finger wells, deep petrol enamel, and an ivory centre. Turn back to the words you want.',
    detail: 'Rotary telephone face · ten finger wells · enamel shell' },
  { id: 'vector', number: '09', name: 'Vector', material: 'PHOSPHOR / DARK GLASS', tag: 'THE AFTER-HOURS ONE',
    description: 'An instrument from a quiet laboratory at midnight. A phosphor sweep moves under a fixed glass grid. No extra telemetry. Just the feeling of finding your signal.',
    detail: 'Fixed reticle · luminous sweep · dark glass transport' },
  { id: 'cartridge', number: '10', name: 'Cartridge', material: 'STUDIO ABS / ULTRAMARINE', tag: 'THE PLAYFUL ONE',
    description: 'A lost piece of eighties video equipment. Chunky moulded ribs, a blue shuttle disc, and one lavender key. Serious controls with a less serious face.',
    detail: 'Moulded grip · inset shuttle · square lavender key' },
  { id: 'aperture', number: '11', name: 'Aperture', material: 'SMOKED OPTICS / CHAMPAGNE', tag: 'THE LAST FRAME',
    description: 'A lens, not a knob. Six overlapping blade-like planes gather around a small champagne play key. A darker, more cinematic way to close the collection.',
    detail: 'Six-plane iris · fine optical rim · compact central key' },
] as const
type Study = typeof studies[number]
const duration = 2400
const sample = [
  'Find your rhythm. Keep your eyes on the lens.',
  'There is a moment before every take when everything becomes quiet.',
  'The room settles. You take a breath. And the first words arrive.',
  'A good tool gets out of the way. It gives you just enough control to feel completely at ease.',
  'Slow down a little. Let the sentence land. There is no need to rush.',
  'Move back to a thought. Try it again. Make the words your own.',
  'Stay with the story, not the screen. That is where the connection happens.',
  'One more breath. One more take. You have found your rhythm.',
]

function StudyDevice({ study, reset, sensitivity, motor, large }: {
  study: Study; reset: number; sensitivity: number; motor: boolean; large: boolean
}) {
  const [position, setPosition] = useState(310)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(.86)
  const [dragging, setDragging] = useState(false)
  const [angle, setAngle] = useState(0)
  const state = useRef({ position, playing, speed, dragging, motor })
  state.current = { position, playing, speed, dragging, motor }
  useEffect(() => {
    setPosition(310); setPlaying(false); setSpeed(.86); setAngle(0)
  }, [reset])
  useEffect(() => {
    let last = 0
    let frame = 0
    const tick = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, .1) : 0
      last = now
      const current = state.current
      if (current.playing && !current.dragging && document.visibilityState === 'visible') {
        const next = Math.min(duration, current.position + elapsed * BASE_PIXELS_PER_SECOND * current.speed)
        state.current.position = next
        setPosition(next)
        if (current.motor) setAngle(value => value + elapsed * .32 * current.speed)
        if (next === duration) setPlaying(false)
      }
      // No idle animation loop; re-enter through the playing dependency below.
      if (state.current.playing) frame = requestAnimationFrame(tick)
    }
    if (playing) frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  const seek = (delta: number) => {
    setAngle(value => value + delta / 92)
    setPosition(value => Math.max(0, Math.min(duration, value + delta * sensitivity)))
  }
  const currentLine = Math.min(sample.length - 1, Math.floor(position / duration * sample.length))
  return <div className={`lab-device lab-device--${study.id}${large ? ' lab-device--large' : ''}`}
    style={{ '--lab-angle': `${angle}rad` } as CSSProperties}>
    <div className="lab-device-top"><span className="lab-model">R–{study.number}</span><span className="lab-device-mark">IZZY<br />DESIGN STUDY</span></div>
    <TransportReadout position={position} speed={speed} playing={playing} label="LOCAL / DEMO" />
    <JogControls enabled playing={playing} speed={speed} position={position} maximum={duration}
      positionText={`${Math.round(position / duration * 100)} percent through the demo script`}
      onToggle={() => { if (position >= duration) setPosition(0); setPlaying(value => !value) }}
      onSeek={seek} onEdge={edge => setPosition(edge === 'start' ? 0 : duration)}
      onSpeedChange={setSpeed} onDraggingChange={setDragging} />
    <div className="lab-script-monitor" aria-label={`${study.name} script preview`}>
      <div className="lab-monitor-label"><span>{dragging ? 'SCRUBBING' : playing ? 'READING' : 'CUE'}</span><span>{String(currentLine + 1).padStart(2, '0')} / 08</span></div>
      <p>{sample[currentLine]}</p>
      <div className="lab-progress"><span style={{ width: `${position / duration * 100}%` }} /></div>
    </div>
    <div className="lab-device-bottom"><span>JOG / BIDIRECTIONAL</span><span>↶ &nbsp; ↷</span></div>
  </div>
}

export default function JogLabPage() {
  const [view, setView] = useState<'compare' | 'focus'>('compare')
  const [selected, setSelected] = useState<Study['id']>('ivory')
  const [favorite, setFavorite] = useState<Study['id'] | null>(null)
  const [sensitivity, setSensitivity] = useState(1)
  const [motor, setMotor] = useState(true)
  const [reset, setReset] = useState(0)
  useEffect(() => {
    const before = document.title
    document.title = 'IZZY — Wheel studies'
    return () => { document.title = before }
  }, [])
  const visible = view === 'focus' ? studies.filter(study => study.id === selected) : studies
  return <main className={`jog-lab ${view === 'focus' ? 'jog-lab--focus' : ''}`}>
    <header className="lab-header"><a href="/" className="lab-wordmark"><span>I</span> IZZY <span className="lab-wordmark-divider">/</span> DESIGN LAB</a><a href="/" className="lab-back"><ArrowLeft size={14} />Back to IZZY</a></header>
    <section className="lab-intro"><div><p className="lab-eyebrow">EXPERIMENT 001 / THE JOG WHEEL</p><h1>Less interface.<br />More instrument.</h1></div><div className="lab-intro-note"><span className="lab-orange-dot" /><p>Twelve studies. One familiar gesture.<br />Three collections. A good place to pause.</p><small>R–03 / Orbit is your default candidate. The live remote stays as it is.</small></div></section>
    <div className="lab-toolbar">
      <div className="lab-view-switch" role="group" aria-label="Study layout"><button aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Compare all <span>{String(studies.length).padStart(2, '0')}</span></button><button aria-pressed={view === 'focus'} onClick={() => setView('focus')}>Focus view <Maximize2 size={13} /></button></div>
      <div className="lab-tuning"><label className="lab-motor"><input type="checkbox" checked={motor} onChange={event => setMotor(event.target.checked)} />Spin on playback</label><label className="lab-sensitivity">FEEL<select aria-label="Scrub sensitivity" value={sensitivity} onChange={event => setSensitivity(Number(event.target.value))}><option value={.5}>Precise</option><option value={1}>Balanced</option><option value={2}>Fast</option></select></label><button className="lab-reset" onClick={() => setReset(value => value + 1)}><RotateCcw size={13} /><span>Reset</span></button></div>
    </div>
    {view === 'focus' && <nav className="lab-focus-tabs" aria-label="Choose wheel study">{studies.map(study => <button key={study.id} aria-pressed={selected === study.id} onClick={() => setSelected(study.id)}>{study.number} / {study.name}</button>)}</nav>}
    <section className="lab-grid" aria-label="Interactive wheel studies">{visible.map(study => <Fragment key={study.id}>
      {view === 'compare' && study.id === 'signal' && <div className="lab-collection-divider"><div><span className="lab-eyebrow">COLLECTION 02 / NEW EXPLORATIONS</span><h2>A different kind of character.</h2></div><p>Same controls. Four new personalities.<br />A first sketch for future Pro skins.</p></div>}
      {view === 'compare' && study.id === 'switchboard' && <div className="lab-collection-divider lab-collection-divider--final"><div><span className="lab-eyebrow">COLLECTION 03 / THE FINAL FOUR</span><h2>Somewhere out of time.</h2></div><p>From the switchboard to the cinema.<br />Four last instruments. Then, a pause.</p></div>}
      <article className={`lab-study${favorite === study.id ? ' lab-study--favorite' : ''}${study.id === 'ivory' ? ' lab-study--candidate' : ''}`}>
      <div className="lab-study-heading"><span>{study.number} / {study.material}</span><button aria-label={`Focus ${study.name}`} onClick={() => { setSelected(study.id); setView('focus') }}><ArrowUpRight size={17} /></button></div>
      <div className="lab-device-stage"><StudyDevice study={study} reset={reset} sensitivity={sensitivity} motor={motor} large={view === 'focus'} /></div>
      <div className="lab-study-notes"><div><span className={`lab-eyebrow${study.id === 'ivory' ? ' lab-candidate-label' : ''}`}>{study.id === 'ivory' ? 'YOUR DEFAULT CANDIDATE' : study.tag}</span><h2>{study.name}</h2></div><button className="lab-favorite" aria-label={`Shortlist ${study.name}`} aria-pressed={favorite === study.id} onClick={() => setFavorite(value => value === study.id ? null : study.id)}>{favorite === study.id ? <><Check size={13} />Shortlisted</> : 'Shortlist'}</button><p>{study.description}</p><small>{study.detail}</small></div>
    </article></Fragment>)}</section>
    <footer className="lab-footer"><p>Drag around the edge to scrub. Use the play key to roll.<br />Keyboard: arrows to jog · Home / End to jump. No sound, no session, no saved-script changes.</p><a href="https://teenage.engineering/products/tp-7" target="_blank" rel="noreferrer">REFERENCE / TP–7<ArrowUpRight size={12} /></a><span>{favorite ? `SHORTLIST / ${studies.find(study => study.id === favorite)?.name.toUpperCase()}` : 'IZZY / WORK IN PROGRESS'}</span></footer>
  </main>
}
