import { Fragment, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowUpRight, Check, Maximize2, RotateCcw, SwatchBook } from 'lucide-react'
import { JogControls, TransportReadout } from '../components/JogControls'
import { BASE_PIXELS_PER_SECOND } from '../prompt/motion'
import './jog-lab.css'
import { skins } from '../product/catalog'
import '../product/skins.css'
import { ParagraphEditor } from '../components/ParagraphEditor'
import { RemoteDrawer } from '../components/RemoteDrawer'
import { PhraseNavigation, QuickEditTrigger } from '../components/SecondaryControls'

const studies = [
  { id: 'field', number: '01', name: 'Field reel', material: 'SATIN ALUMINIUM', tag: 'THE QUIET ONE',
    description: 'One broad disc. A fine seam. A small engraved play mark sits in the machined centre.',
    detail: 'Engraved central transport · shallow edge' },
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
    detail: 'Enamel shell · inset charcoal wheel · round transport' },
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
  { id: 'correspondent', number: '12', name: 'Correspondent', material: 'WORN LEATHER / BRASS', tag: 'THE WELL-TRAVELLED ONE',
    description: 'A camera that has been everywhere. Pebbled black leather, a painted wheel worn through to brass, and a small shutter-like transport key. Nothing pristine. Everything considered.',
    detail: 'Leather wrap · exposed brass edges · separate transport' },
  { id: 'foundry', number: '13', name: 'Foundry', material: 'CAST BRONZE / VERDIGRIS', tag: 'THE HEAVY ONE',
    description: 'A little piece of a much larger machine. Three cast arms, darkened recesses, and bronze polished where a hand would touch it. Weight, without making the controls feel heavy.',
    detail: 'Three-arm casting · recessed patina · bronze centre key' },
  { id: 'inox', number: '14', name: 'Inox', material: 'BRUSHED STAINLESS STEEL', tag: 'THE PRECISE ONE',
    description: 'Almost nothing to hide behind. A broad steel face, one shallow thumb channel, and a quiet black key. The whole idea lives in the brushing, the seams, and the proportions.',
    detail: 'Linear brushing · thumb channel · black rectangular key' },
  { id: 'airframe', number: '15', name: 'Airframe', material: 'ANODISED AVIATION ALUMINIUM', tag: 'THE LIGHTWEIGHT ONE',
    description: 'Material removed with purpose. Six lightening slots, a pale machined reel, and a rust-orange transport key. An aircraft workshop, reduced to the parts you actually need.',
    detail: 'Six milled slots · captive fasteners · separate transport' },
  ...skins.filter(skin => Number(skin.number) >= 16).map(skin => ({ ...skin, tag: 'OPEN CONSTRUCTION / NEW PERSONALITIES', description: skin.note, detail: skin.material })),
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

function StudyDevice({ study, reset, sensitivity, motor, large, controlsReview, standalone=false, onChoose }: {
  study: Study; reset: number; sensitivity: number; motor: boolean; large: boolean; controlsReview: boolean; standalone?:boolean; onChoose?:()=>void
}) {
  const editId=useId()
  const [lines, setLines] = useState<string[]>([...sample])
  const [editing, setEditing] = useState(()=>standalone&&new URLSearchParams(location.search).get('edit')==='1')
  const [position, setPosition] = useState(310)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(.56)
  const [dragging, setDragging] = useState(false)
  const [angle, setAngle] = useState(0)
  const state = useRef({ position, playing, speed, dragging, motor })
  state.current = { position, playing, speed, dragging, motor }
  useEffect(() => {
    setPosition(310); setPlaying(false); setSpeed(.56); setAngle(0)
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
  const Surface=standalone?'main':'div'
  return <Surface className={standalone?`remote-panel standalone-remote skin-face skin--${study.id} skin-controls demo-remote`:`lab-device lab-device--${study.id}${controlsReview || Number(study.number) >= 16 ? ` skin-face skin--${study.id}` : ''}${large ? ' lab-device--large' : ''}${controlsReview?' skin-controls':''}`}
    style={{ '--lab-angle': `${angle}rad` } as CSSProperties}>
    {standalone?<header className="remote-header"><div className="remote-identity"><strong>R–{study.number}</strong><span className="remote-brand">IZZY / DEMO</span></div><div className="remote-link-state"><span className="network-state connected">LOCAL</span><small>SYNTHETIC SCRIPT</small></div></header>:<div className="lab-device-top"><span className="lab-model">R–{study.number}</span><span className="lab-device-mark">IZZY<br />DESIGN STUDY</span></div>}
    <TransportReadout skin={study.id} position={position} speed={speed} playing={playing} scrubbing={dragging} label="LOCAL / DEMO" />
    <JogControls skin={study.id} spinOnPlayback={motor} enabled playing={playing} speed={speed} position={position} maximum={duration}
      positionText={`${Math.round(position / duration * 100)} percent through the demo script`}
      onToggle={() => { if (position >= duration) setPosition(0); setPlaying(value => !value) }}
      onSeek={seek} onEdge={edge => setPosition(edge === 'start' ? 0 : duration)}
      onSpeedChange={setSpeed} onDraggingChange={setDragging} />
    {controlsReview && <>
      <PhraseNavigation enabled index={currentLine} total={lines.length}
        onPrevious={() => setPosition(Math.max(0,currentLine-1)*duration/lines.length)}
        onNext={() => setPosition(Math.min(lines.length-1,currentLine+1)*duration/lines.length)} />
      <div className={standalone?"remote-tools":undefined}><QuickEditTrigger onClick={event => {event.currentTarget.focus({preventScroll:true});setPlaying(false);setEditing(true)}} />{standalone&&<button className="remote-finish-button" aria-label="Change remote skin" onClick={event=>{event.currentTarget.focus({preventScroll:true});onChoose?.()}}><SwatchBook size={19}/></button>}</div>
    </>}
    {!standalone&&<div className="lab-script-monitor" aria-label={`${study.name} script preview`}>
      <div className="lab-monitor-label"><span>{dragging ? 'SCRUBBING' : playing ? 'READING' : 'CUE'}</span><span>{String(currentLine + 1).padStart(2, '0')} / 08</span></div>
      <p>{lines[currentLine]}</p>
      <div className="lab-progress"><span style={{ width: `${position / duration * 100}%` }} /></div>
    </div>}
    <ParagraphEditor open={editing} onRequestClose={()=>setEditing(false)} onDone={()=>setEditing(false)} status="Preview" state="live" description="Playback is paused. This changes only the synthetic demo.">
      <label className="sr-only" htmlFor={`${editId}-text`}>CURRENT PARAGRAPH</label><textarea id={`${editId}-text`} aria-label="Demo current paragraph" value={lines[currentLine]} onChange={event=>setLines(value=>value.map((line,index)=>index===currentLine?event.target.value:line))}/>
    </ParagraphEditor>
    {!standalone&&<div className="lab-device-bottom"><span>JOG / BIDIRECTIONAL</span><span>↶ &nbsp; ↷</span></div>}
  </Surface>
}

export default function JogLabPage({ review, device=false }: { device?:boolean; review?: 'objects'|'time-speed'|'collection' } = {}) {
  const collectionReview=(new URLSearchParams(location.search).get('review') ?? review)==='collection'
  const timeReview=(new URLSearchParams(location.search).get('review') ?? review)==='time-speed'
  const objectsReview = (new URLSearchParams(location.search).get('review') ?? review) === 'objects'
  const controlsReview = collectionReview || timeReview || objectsReview || new URLSearchParams(location.search).get('review') === 'controls'
  const order = collectionReview ? ['groove','clear','arcade','field','signal','vector','cartridge','switchboard','correspondent','foundry','observatory','ivory','graphite','original'] : timeReview ? ['groove','clear','arcade'] : objectsReview ? ['clear','arcade'] : ['groove','field','signal','vector','foundry','ivory','original','graphite','cartridge','switchboard','correspondent','observatory']
  const collection = controlsReview ? order.flatMap(id => studies.filter(study => study.id===id)) : studies
  const requested = new URLSearchParams(location.search).get('skin')
  const initial = collection.find(study => study.id===requested)?.id ?? (controlsReview?'groove':'ivory')
  const [view, setView] = useState<'compare' | 'focus'>(controlsReview?'focus':'compare')
  const [selected, setSelected] = useState<Study['id']>(initial)
  const [favorite, setFavorite] = useState<Study['id'] | null>(null)
  const [sensitivity, setSensitivity] = useState(1)
  const [motor, setMotor] = useState(true)
  const deviceMode=controlsReview&&(device||new URLSearchParams(location.search).get('device')==='1')
  const [choosing,setChoosing]=useState(false)
  const [reset, setReset] = useState(0)
  useEffect(() => {
    const before = document.title
    document.title = deviceMode?'IZZY — Remote preview':'IZZY — Wheel studies'
    return () => { document.title = before }
  }, [deviceMode])
  const visible = view === 'focus' ? collection.filter(study => study.id === selected) : collection
  if(deviceMode)return <>
    <StudyDevice key={selected} study={collection.find(s=>s.id===selected)!} reset={reset} sensitivity={sensitivity} motor={motor} large controlsReview standalone onChoose={()=>setChoosing(true)}/>
    <RemoteDrawer open={choosing} onRequestClose={()=>setChoosing(false)} labelledBy="demo-skins-title"><header><span>SELECTED FOURTEEN</span></header><div className="quick-edit-body"><h1 id="demo-skins-title">Choose an instrument.</h1><div className="demo-skin-picker">{collection.map(study=><button key={study.id} aria-label={'Use '+study.name} aria-pressed={selected===study.id} onClick={()=>{setSelected(study.id);setChoosing(false)}}>{study.name}</button>)}</div></div><footer><button className="edit-done" onClick={()=>setChoosing(false)}>Done</button></footer></RemoteDrawer>
  </>
  return <main className={`jog-lab ${view === 'focus' ? 'jog-lab--focus' : ''} ${controlsReview?'jog-lab--controls':''}`}>
    <header className="lab-header"><a href="/" className="lab-wordmark"><span>I</span> IZZY <span className="lab-wordmark-divider">/</span> DESIGN LAB</a><a href="/" className="lab-back"><ArrowLeft size={14} />Back to IZZY</a></header>
    <section className="lab-intro"><div><p className="lab-eyebrow">{collectionReview?'SELECTED FOURTEEN / INSTRUMENTS':timeReview?'TIME & SPEED / FIRST BATCH':objectsReview?'REFERENCE / GLASS & ARCADE':controlsReview?'CURATED / CONTROL DETAILS':'EXPERIMENT 001 / THE JOG WHEEL'}</p><h1>{collectionReview?'An instrument of your own.':timeReview?'A different kind of time.':objectsReview?'Two familiar worlds.':controlsReview?'One complete instrument.':<>Less interface.<br />More instrument.</>}</h1></div><div className="lab-intro-note"><span className="lab-orange-dot" />{collectionReview?<><p>Fourteen selected instruments. One self-contained speed control each.</p><small>Drag the control or type an exact value. Synthetic local demo.</small></>:timeReview?<><p>Groove, Clear and Arcade: three distinct clocks and three real speed controls.</p><small>First batch of the selected fourteen. Synthetic local demo.</small></>:objectsReview?<><p>Graphite glass inspired by Phone (1). A paddle instrument inspired by EGRET II.</p><small>Local demo. Play, scrub, phrase keys and Quick Edit work.</small></>:controlsReview?<><p>First pass: matching lower controls, an engraved Field key and a round Signal key.</p><small>Local demo. Try Play, scrub, phrase keys and Quick Edit.</small></>:<><p>Twenty-six studies. One familiar gesture.<br />Six collections. Different ways to feel it.</p><small>R–03 / Orbit is your default candidate. The live remote stays as it is.</small></>}</div></section>
    <div className="lab-toolbar">
      <div className="lab-view-switch" role="group" aria-label="Study layout"><button aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Compare all <span>{String(collection.length).padStart(2, '0')}</span></button><button aria-pressed={view === 'focus'} onClick={() => setView('focus')}>Focus view <Maximize2 size={13} /></button></div>
      <div className="lab-tuning"><label className="lab-motor"><input type="checkbox" checked={motor} onChange={event => setMotor(event.target.checked)} />Spin on playback</label><label className="lab-sensitivity">FEEL<select aria-label="Scrub sensitivity" value={sensitivity} onChange={event => setSensitivity(Number(event.target.value))}><option value={.5}>Precise</option><option value={1}>Balanced</option><option value={2}>Fast</option></select></label><button className="lab-reset" onClick={() => setReset(value => value + 1)}><RotateCcw size={13} /><span>Reset</span></button></div>
    </div>
    {view === 'focus' && <nav className="lab-focus-tabs" aria-label="Choose wheel study">{collection.map(study => <button key={study.id} aria-pressed={selected === study.id} onClick={() => setSelected(study.id)}>{study.number} / {study.name}</button>)}</nav>}
    <section className="lab-grid" aria-label="Interactive wheel studies">{visible.map(study => <Fragment key={study.id}>
      {!controlsReview && view === 'compare' && study.id === 'signal' && <div className="lab-collection-divider"><div><span className="lab-eyebrow">COLLECTION 02 / NEW EXPLORATIONS</span><h2>A different kind of character.</h2></div><p>Same controls. Four new personalities.<br />A first sketch for future Pro skins.</p></div>}
      {!controlsReview && view === 'compare' && study.id === 'switchboard' && <div className="lab-collection-divider lab-collection-divider--final"><div><span className="lab-eyebrow">COLLECTION 03 / THE FINAL FOUR</span><h2>Somewhere out of time.</h2></div><p>From the switchboard to the cinema.<br />Four last instruments. Then, a pause.</p></div>}
      {!controlsReview && view === 'compare' && study.id === 'clear' && <div className="lab-collection-divider"><div><span className="lab-eyebrow">COLLECTION 05 / OPEN CONSTRUCTION</span><h2>Beautiful on the inside.</h2></div><p>Clear shells. Moving mechanisms.<br />Six new ways to make it yours.</p></div>}
      {!controlsReview && view === 'compare' && study.id === 'loom' && <div className="lab-collection-divider"><div><span className="lab-eyebrow">COLLECTION 06 / PERSONAL OBJECTS</span><h2>A different world.</h2></div><p>Woven, playful, orbital and driven.<br />Four distinct instruments.</p></div>}
      {!controlsReview && view === 'compare' && study.id === 'correspondent' && <div className="lab-collection-divider lab-collection-divider--material"><div><span className="lab-eyebrow">COLLECTION 04 / MATERIAL MEMORY</span><h2>Better with a little wear.</h2></div><p>Leather. Brass. Bronze. Steel. Aluminium.<br />Four instruments with something to hold on to.</p></div>}
      <article className={`lab-study${favorite === study.id ? ' lab-study--favorite' : ''}${study.id === 'ivory' ? ' lab-study--candidate' : ''}`}>
      <div className="lab-study-heading"><span>{study.number} / {study.material}</span><button aria-label={`Focus ${study.name}`} onClick={() => { setSelected(study.id); setView('focus') }}><ArrowUpRight size={17} /></button></div>
      <div className="lab-device-stage"><StudyDevice study={study} reset={reset} sensitivity={sensitivity} motor={motor} large={view === 'focus'} controlsReview={controlsReview} /></div>
      <div className="lab-study-notes"><div><span className={`lab-eyebrow${study.id === 'ivory' ? ' lab-candidate-label' : ''}`}>{study.id === 'ivory' ? 'YOUR DEFAULT CANDIDATE' : study.tag}</span><h2>{study.name}</h2></div><button className="lab-favorite" aria-label={`Shortlist ${study.name}`} aria-pressed={favorite === study.id} onClick={() => setFavorite(value => value === study.id ? null : study.id)}>{favorite === study.id ? <><Check size={13} />Shortlisted</> : 'Shortlist'}</button><p>{study.description}</p><small>{study.detail}</small></div>
    </article></Fragment>)}</section>
    <footer className="lab-footer"><p>Drag around the edge to scrub. Use the play key to roll.<br />Keyboard: arrows to jog · Home / End to jump. No sound, no session, no saved-script changes.</p><a href="https://teenage.engineering/products/tp-7" target="_blank" rel="noreferrer">REFERENCE / TP–7<ArrowUpRight size={12} /></a><span>{favorite ? `SHORTLIST / ${studies.find(study => study.id === favorite)?.name.toUpperCase()}` : 'IZZY / WORK IN PROGRESS'}</span></footer>
  </main>
}
