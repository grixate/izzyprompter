import { memo, useId } from 'react'
import type { SkinId } from '../product/catalog'
import './instrument-mechanisms.css'

/** A shared pitch and tooth profile keep the two Foundry gears in mesh. */
const gearPoints = (x: number, y: number, teeth: number, pitch: number, phase = 0) =>
  Array.from({ length: teeth * 4 }, (_, i) => {
    const angle = (i / (teeth * 4) * 360 + phase) * Math.PI / 180
    const radius = pitch + (i % 4 < 2 ? 3 : -4)
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`
  }).join(' ')

export function InstrumentRotor({ skin }: { skin: SkinId }) {
  if (skin !== 'foundry') return null
  return <svg className="instrument-gear-rim" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
    <polygon points={gearPoints(150, 150, 72, 146)} fill="#a68a55" stroke="#d3b477" strokeWidth=".7" />
    <circle cx="150" cy="150" r="133" fill="#3e5037" stroke="#786b44" />
  </svg>
}

/** Inert artwork shared by the working jog and every product miniature. */
export const InstrumentMechanism = memo(function InstrumentMechanism({ skin }: { skin: SkinId }) {
  const id = useId().replaceAll(':', '')
  if (skin === 'switchboard') return <svg className="instrument-mechanism mechanism--telephone" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="fixed-number-plate">
    <circle cx="150" cy="150" r="130" fill="none" stroke="#ded0a6" strokeWidth="22" />
    {['1','2','3','4','5','6','7','8','9','0'].map((digit,index)=>{const angle=(index*36-90)*Math.PI/180;return <text key={digit} x={150+Math.cos(angle)*130} y={150+Math.sin(angle)*130} textAnchor="middle" dominantBaseline="central" fill="#294b39" fontFamily="Georgia,serif" fontSize="14">{digit}</text>})}
  </svg>
  if (skin === 'clear') return <svg className="instrument-mechanism mechanism--clear-glass" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="fixed-coil">
    <circle cx="150" cy="150" r="143" fill="#1b1d20" stroke="#62666b" />
    {[103,107,111,115,119,123,127].map(r => <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="#55595e" strokeWidth="1" />)}
    <path d="M248 72A125 125 0 1 0 268 192" fill="none" stroke="#101113" strokeWidth="13" strokeLinecap="round" />
    <path className="clear-light clear-light--ring" d="M248 72A125 125 0 1 0 268 192" fill="none" strokeWidth="6" strokeLinecap="round" />
    <path d="M251 23l26 26" fill="none" stroke="#101113" strokeWidth="13" strokeLinecap="round" />
    <path className="clear-light clear-light--bar" d="M251 23l26 26" fill="none" strokeWidth="6" strokeLinecap="round" />
    <circle cx="150" cy="150" r="52" fill="#26292d" stroke="#65696e" />
    <circle cx="150" cy="150" r="42" fill="#141619" stroke="#393d42" />
  </svg>
  if (skin === 'spool') return <svg className={`instrument-mechanism mechanism--chassis mechanism--${skin}`} viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="coaxial">
    <circle cx="150" cy="150" r="143" fill="var(--chassis-base)" stroke="var(--chassis-edge)" strokeWidth="2" />
    <circle cx="150" cy="150" r="119" fill="none" stroke="var(--chassis-coil)" strokeWidth="28" />
    {[108,112,116,120,124,128,132].map(r => <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="var(--chassis-edge)" strokeOpacity=".45" strokeWidth=".7" />)}
    <path d="M49 197Q88 251 150 251H208V224H246V243Q211 278 150 278Q65 264 34 211Z" fill="var(--chassis-plate)" stroke="var(--chassis-edge)" />
    {[30,150,270].map(deg => <g key={deg} transform={`rotate(${deg} 150 150)`}><circle cx="150" cy="13" r="4" fill="#b5bdba" stroke="#515c5a" /><path d="M147.5 13h5" stroke="#4b5454" /></g>)}
  </svg>
  if (skin === 'aperture') return <svg className="instrument-mechanism mechanism--iris" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="iris">
    <defs><clipPath id={`${id}-iris-clip`}><circle cx="150" cy="150" r="137" /></clipPath><linearGradient id={`${id}-blade`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#849295" /><stop offset=".5" stopColor="#3d4a50" /><stop offset="1" stopColor="#19252b" /></linearGradient></defs>
    <g clipPath={`url(#${id}-iris-clip)`}><g className="iris-leaves">
      {[0,60,120,180,240,300].map(deg => <path key={deg} d="M150 12A138 138 0 0 1 269.511506 81L205 150 177.5 102.368603Z" transform={`rotate(${deg} 150 150)`} fill={`url(#${id}-blade)`} stroke="#a5b5b0" strokeOpacity=".4" strokeWidth=".8" />)}
    </g></g><circle cx="150" cy="150" r="138" fill="none" stroke="#b0b7a7" strokeOpacity=".5" />
  </svg>
  if (skin === 'foundry') {
    const pitch = 146 / 6, distance = 146 + pitch
    const x = 150 + Math.cos(Math.PI / 5) * distance, y = 150 + Math.sin(Math.PI / 5) * distance
    return <svg className="instrument-mechanism mechanism--foundry" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="gear">
      <circle cx={x} cy={y} r="18" fill="#263c2a" stroke="#7d8660" />
      <g className="mechanism-drive" data-wheel-ratio="-6" style={{transformOrigin:`${x}px ${y}px`}}>
        <polygon points={gearPoints(x,y,12,pitch,21)} fill="#a68a55" stroke="#d3b477" strokeWidth=".7" />
        <circle cx={x} cy={y} r="16" fill="#3e5037" stroke="#786b44" />
        {[0,120,240].map(deg=><path key={deg} d={`M${x} ${y-1}v-14`} stroke="#b89a61" strokeWidth="6" transform={`rotate(${deg} ${x} ${y})`} />)}
        <circle cx={x} cy={y} r="5" fill="#c8ab71" stroke="#424b2f" />
      </g>
    </svg>
  }
  if (skin === 'observatory') return <svg className="instrument-mechanism mechanism--observatory" viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-mechanism="orbital"><circle className="observatory-orbit" cx="150" cy="150" r="128" fill="none" stroke="#cfb985" strokeOpacity=".65" strokeWidth="1" /><path d="M150 7v37m0 212v37M7 150h27m232 0h27" stroke="#d2b67b" strokeWidth="2" /><g className="mechanism-drive" data-wheel-ratio="-2" style={{transformOrigin:'150px 150px'}}><circle className="observatory-satellite" cx="150" cy="22" r="6" fill="#e1c181" stroke="#f5e5bb" /><circle cx="150" cy="22" r="9" fill="none" stroke="#e1c181" strokeOpacity=".3" /></g></svg>
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
