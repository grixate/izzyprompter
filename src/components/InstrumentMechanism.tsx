import { memo, useId } from 'react'
import type { SkinId } from '../product/catalog'
import './instrument-mechanisms.css'

function Reel({ x, y, radius, ratio = 3 }: { x: number; y: number; radius: number; ratio?: number }) {
  return <g data-wheel-ratio={ratio} className="mechanism-drive" style={{ transformOrigin: `${x}px ${y}px` }}>
    <circle cx={x} cy={y} r={radius} fill="var(--mechanism-reel, #b9bdaa)" stroke="var(--mechanism-edge, #57604d)" strokeWidth="1.5" />
    {[0, 120, 240].map(deg => <ellipse key={deg} cx={x} cy={y - radius * .56} rx={radius * .23} ry={radius * .3} fill="var(--mechanism-dark, #313b2c)" transform={`rotate(${deg} ${x} ${y})`} />)}
    <circle cx={x} cy={y} r={radius * .18} fill="#e5e6d9" stroke="#454b41" strokeWidth="1" />
  </g>
}

function TapeWindow({ skin }: { skin: 'field' | 'cartridge' | 'spool' }) {
  if (skin !== 'cartridge') return <svg className={`instrument-mechanism mechanism--tape mechanism--${skin}`} viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="tape">
    <path d="M246 68h45v167h-42" fill="var(--mechanism-window, #26332c)" fillOpacity=".65" stroke="var(--mechanism-edge, #b4b9a0)" strokeWidth="1" />
    <path d="M244 150L275 210Q282 223 285 210V41" fill="none" stroke="#1a221c" strokeWidth="9" strokeLinejoin="round" />
    <path d="M244 150L275 210Q282 223 285 210V41" fill="none" stroke="var(--mechanism-tape, #b99865)" strokeWidth="6" strokeLinejoin="round" />
    <path data-wheel-distance="600" d="M244 150L275 210Q282 223 285 210V41" fill="none" stroke="#e1cca4" strokeWidth="1.4" strokeDasharray="2 6" />
    <Reel x={263} y={41} radius={24} ratio={4} /><Reel x={280} y={211} radius={8} ratio={12} />
    <circle cx="285" cy="94" r="6" fill="#c2c6af" stroke="#454e40" />
    <g className="tape-pinch"><rect x="270" y="139" width="19" height="23" rx="3" fill="#c2b793" stroke="#414b3d" /><path d="M274 144v13" stroke="#f0e7c9" /></g>
    <path d="M253 79h9m-9 7h9m-9 7h9m-9 7h9m-9 7h9" stroke="#b4b9a055" />
  </svg>
  return <svg className={`instrument-mechanism mechanism--tape mechanism--${skin}`} viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="tape">
    <rect className="tape-window" x="164" y="8" width="126" height="76" rx="9" fill="var(--mechanism-window, #26332c)" stroke="var(--mechanism-edge, #b4b9a0)" strokeWidth="2" />
    <path d="M190 37V67H267V37" fill="none" stroke="#1a221c" strokeWidth="6" strokeLinejoin="round" />
    <path className="tape-ribbon" d="M190 37V67H267V37" fill="none" stroke="var(--mechanism-tape, #b99865)" strokeWidth="3" strokeLinejoin="round" />
    <path data-wheel-distance="600" d="M190 37V67H267V37" fill="none" stroke="#e5c490" strokeWidth="1" strokeDasharray="1 7" />
    <Reel x={190} y={37} radius={24} ratio={4} /><Reel x={267} y={37} radius={16} ratio={6} />
    <circle cx="190" cy="67" r="4" fill="#c2c6af" stroke="#454e40" /><circle cx="267" cy="67" r="4" fill="#c2c6af" stroke="#454e40" />
    <g className="tape-pinch"><rect x="218" y="59" width="21" height="12" rx="3" fill="#9c9f8b" stroke="#414b3d" /><path d="M222 62h13" stroke="#e7dfc4" /></g>
    <path d="M174 16h8m98 60h-8" stroke="#a4a68f" strokeWidth="1" />
  </svg>
}

/** Inert artwork shared by the working jog and every product miniature. */
export const InstrumentMechanism = memo(function InstrumentMechanism({ skin }: { skin: SkinId }) {
  const id = useId().replaceAll(':', '')
  if (skin === 'field' || skin === 'cartridge' || skin === 'spool') return <TapeWindow skin={skin} />
  if (skin === 'clear' || skin === 'glacier') return <svg className={`instrument-mechanism mechanism--drive mechanism--${skin}`} viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="belt">
    <path d="M236 38C254 21 280 31 280 51V247C280 269 256 276 241 260L215 274" fill="none" stroke="#35473d" strokeWidth="8" />
    <path data-wheel-distance="880" d="M236 38C254 21 280 31 280 51V247C280 269 256 276 241 260L215 274" fill="none" stroke="#c8d2c1" strokeWidth="2" strokeDasharray="2 6" />
    <Reel x={262} y={49} radius={20} ratio={7} /><Reel x={261} y={246} radius={20} ratio={7} />
    <path d="M250 93h24v104h-24z" fill="#a4b8ad26" stroke="#92aa9d" strokeWidth="1" />
    <path d="M256 105h12m-12 9h12m-12 9h12m-12 9h12m-12 9h12m-12 9h12m-12 9h12m-12 9h12m-12 9h12" stroke="#edf2dc88" />
    <g className="tape-pinch"><rect x="233" y="211" width="23" height="13" rx="3" fill="#d96441" stroke="#7b4935" /><circle cx="239" cy="217" r="2" fill="#f6d8a5" /></g>
  </svg>
  if (skin === 'aperture') return <svg className="instrument-mechanism mechanism--iris" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="iris">
    <defs><clipPath id={`${id}-iris-clip`}><circle cx="150" cy="150" r="137" /></clipPath><linearGradient id={`${id}-blade`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#849295" /><stop offset=".5" stopColor="#3d4a50" /><stop offset="1" stopColor="#19252b" /></linearGradient></defs>
    <g clipPath={`url(#${id}-iris-clip)`}><g className="iris-leaves">
      {[0,60,120,180,240,300].map(deg => <path key={deg} d="M150 12A138 138 0 0 1 269.511506 81L205 150 177.5 102.368603Z" transform={`rotate(${deg} 150 150)`} fill={`url(#${id}-blade)`} stroke="#a5b5b0" strokeOpacity=".4" strokeWidth=".8" />)}
    </g></g><circle cx="150" cy="150" r="138" fill="none" stroke="#b0b7a7" strokeOpacity=".5" />
  </svg>
  if (skin === 'foundry') {
    const x = 291, y = 250
    const points = Array.from({length:48},(_,i) => { const a=i*Math.PI/24, r=i%4<2?25:21; return `${x+Math.cos(a)*r},${y+Math.sin(a)*r}` }).join(' ')
    return <svg className="instrument-mechanism mechanism--foundry" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="gear"><circle cx={x} cy={y} r="29" fill="#263c2a" stroke="#7d8660" /><g className="mechanism-drive" data-wheel-ratio="-6" style={{transformOrigin:`${x}px ${y}px`}}><polygon points={points} fill="#a48b55" stroke="#e1c086" /><circle cx={x} cy={y} r="17" fill="#526443" />{[0,120,240].map(deg=><path key={deg} d={`M${x} ${y-1}v-14`} stroke="#c0a168" strokeWidth="7" transform={`rotate(${deg} ${x} ${y})`} />)}<circle cx={x} cy={y} r="5" fill="#c8ab71" stroke="#424b2f" /></g></svg>
  }
  if (skin === 'switchboard') return <svg className="instrument-mechanism mechanism--switchboard" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="finger-stop"><path d="m272 202 15 23-22 17-8-11 12-9-6-10z" fill="#d9cb9e" stroke="#837951" strokeWidth="1.5" /><path d="m272 204 12 20-19 14" fill="none" stroke="#fff2c2" strokeWidth="2" /><circle cx="272" cy="222" r="3" fill="#526246" /></svg>
  if (skin === 'correspondent') return <svg className="instrument-mechanism mechanism--correspondent" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="shutter-lever"><rect x="262" y="19" width="24" height="47" rx="6" fill="#34372a" stroke="#9e8554" /><circle cx="274" cy="33" r="7" fill="#b6a070" stroke="#e4c58a" /><g className="shutter-lever"><path d="m274 33 9 24v12" fill="none" stroke="#514b30" strokeWidth="8" strokeLinecap="round" /><path d="m274 33 9 24v12" fill="none" stroke="#cfb480" strokeWidth="5" strokeLinecap="round" /><rect x="278" y="60" width="10" height="16" rx="3" fill="#514d35" stroke="#d4b47c" /></g><circle cx="274" cy="33" r="2" fill="#5e5739" /></svg>
  if (skin === 'signal') return <svg className="instrument-mechanism mechanism--flag mechanism--signal" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="transport-flag"><rect x="249" y="13" width="34" height="47" rx="5" fill="#253327" stroke="#b9b99b" /><g className="transport-flag"><path d="M254 45h24v10h-24z" fill="#e2d7ac" /><path d="M254 25h24v10h-24z" fill="#c67644" /></g><rect x="253" y="15" width="26" height="22" fill="#253327" /><path d="M256 52h20" stroke="#2f3b2c" strokeWidth="2" /></svg>
  if (skin === 'observatory') return <svg className="instrument-mechanism mechanism--observatory" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="orbital"><ellipse cx="150" cy="150" rx="140" ry="61" transform="rotate(-25 150 150)" fill="none" stroke="#cfb985" strokeOpacity=".65" strokeWidth="1" /><path d="M150 7v37m0 212v37M7 150h27m232 0h27" stroke="#d2b67b" strokeWidth="2" /><g className="mechanism-drive" data-wheel-ratio="-2" style={{transformOrigin:'150px 150px'}}><circle cx="150" cy="22" r="6" fill="#e1c181" stroke="#f5e5bb" /><circle cx="150" cy="22" r="9" fill="none" stroke="#e1c181" strokeOpacity=".3" /></g></svg>
  if (skin !== 'groove') return null
  return <svg className="instrument-mechanism mechanism--groove" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="tonearm">
    <defs>
      <linearGradient id={`${id}-alloy`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#898e85" /><stop offset=".34" stopColor="#fcf8e4" /><stop offset=".64" stopColor="#c5c8b7" /><stop offset="1" stopColor="#666f64" /></linearGradient>
      <radialGradient id={`${id}-bearing`} cx=".35" cy=".25"><stop stopColor="#e4e0cb" /><stop offset=".65" stopColor="#9b9e8d" /><stop offset="1" stopColor="#626b5e" /></radialGradient>
    </defs>
    <g className="tonearm-foundation">
      <rect x="272" y="23" width="22" height="39" rx="8" fill="#464e3e" stroke="#aaa890" />
      <circle cx="282" cy="41" r="12" fill={`url(#${id}-bearing)`} stroke="#535b49" />
      <circle cx="282" cy="41" r="5" fill="#535b49" stroke="#d4d2b9" />
      <path d="M287 172v24" stroke="#565d4c" strokeWidth="7" strokeLinecap="round" />
      <path d="M281 181h12" stroke="#a4a78f" strokeWidth="3" strokeLinecap="round" />
    </g>
    <g className="tonearm" data-tonearm>
      <g className="tonearm-shadow" fill="none" stroke="#151e1380" strokeWidth="8" strokeLinecap="round" transform="translate(2 4)"><path d="M282 23V147L268 181" /></g>
      <path d="M282 20V147L268 181" fill="none" stroke="#535c4b" strokeWidth="8" strokeLinecap="round" />
      <path d="M281.5 20V147L268 181" fill="none" stroke={`url(#${id}-alloy)`} strokeWidth="5.5" strokeLinecap="round" />
      <rect x="275" y="13" width="14" height="16" rx="3" fill={`url(#${id}-alloy)`} stroke="#656e5e" />
      <path d="M277 17h10m-10 4h10m-10 4h10" stroke="#68715f" strokeWidth=".8" />
      <circle cx="282" cy="41" r="5.5" fill={`url(#${id}-bearing)`} stroke="#4a5444" />
      <circle cx="282" cy="41" r="1.5" fill="#3e4839" />
      <g className="tonearm-head">
        <path d="m263 176 13 5-8 21-13-5z" fill="#29372b" stroke="#9b9e83" />
        <path d="m265 180 6 2-4 12-6-2z" fill="#414b39" />
        <path d="m268 183 11 1" stroke="#c1c2aa" strokeWidth="2" strokeLinecap="round" />
        <path d="m259 199 4 2-2 5-4-2z" fill="#d58147" stroke="#935731" strokeWidth=".5" />
        <path d="m260 205-1 3" stroke="#e8d9aa" strokeWidth="1" />
      </g>
    </g>
  </svg>
})
