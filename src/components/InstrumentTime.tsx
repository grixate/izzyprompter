import { memo, useEffect, useRef } from 'react'

const glyphs: Record<string, string[]> = {
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  ':':['0','1','1','0','1','1','0'], '.':['0','0','0','0','0','1','1'],
  '—':['00000','00000','00000','11111','00000','00000','00000'],
}

/** Local geometric numerals: no font download or image of a working display. */
export const MatrixTime = memo(function MatrixTime({ value, square = false }: {value: string; square?: boolean}) {
  let cursor = 0
  const shapes = [...value].flatMap((digit,index) => {
    const rows=glyphs[digit] ?? glyphs['—'], scale=value.indexOf('.')>=0 && index>value.indexOf('.') ? .72 : 1
    const x=cursor; cursor+=(rows[0].length+1.5)*scale
    return rows.flatMap((row,y)=>[...row].map((pixel,col)=>pixel==='1' ? square
      ? <rect key={`${index}-${y}-${col}`} x={x+col*scale} y={7*(1-scale)+y*scale} width={.86*scale} height={.86*scale} rx=".08" />
      : <circle key={`${index}-${y}-${col}`} cx={x+(col+.5)*scale} cy={7*(1-scale)+(y+.5)*scale} r={.35*scale} /> : null))
  })
  return <svg className="matrix-time" viewBox={`0 0 ${cursor-1.5} 7`} aria-hidden="true" focusable="false">{shapes}</svg>
})

/** Memoize on whole seconds: only a one-second forward tick rolls a drum. */
export const CounterTime = memo(function CounterTime({ value, playing, scrubbing }: {value: string;playing: boolean;scrubbing: boolean}) {
  const [m,s]=value.split(':')
  const seconds=Number(m)*60+Number(s)
  const previous=useRef({seconds,value})
  const roll=playing&&!scrubbing&&seconds===previous.current.seconds+1
  useEffect(()=>{previous.current={seconds,value}},[seconds,value])
  return <span className="counter-digits">{[...value].map((digit,index)=>digit===':'
    ? <em className="counter-colon" key={index}>:</em>
    : <b className="counter-drum" key={index}><i key={digit} data-roll={roll&&digit!==previous.current.value[index]}>{digit}</i></b>)}</span>
})

const segmentBits:Record<string,string>={'0':'1111110','1':'0110000','2':'1101101','3':'1111001','4':'0110011','5':'1011011','6':'1011111','7':'1110000','8':'1111111','9':'1111011','—':'0000001'}
const segments=[[2,1,8,1],[9,2,9,8],[9,10,9,16],[2,17,8,17],[1,10,1,16],[1,2,1,8],[2,9,8,9]]
export const SegmentTime=memo(function SegmentTime({value}:{value:string}){
 let x=0
 const shapes=[...value].map((digit,index)=>{
  const offset=x;x+=digit===':'||digit==='.'?5:13
  return <g key={index} transform={`translate(${offset} 0)`}>{digit===':'?<><circle cx="1" cy="6" r="1"/><circle cx="1" cy="12" r="1"/></>:digit==='.'?<circle cx="1" cy="17" r="1"/>:segments.map(([x1,y1,x2,y2],i)=><line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={(segmentBits[digit]??segmentBits['—'])[i]==='1'?1:.09}/>)}</g>
 })
 return <svg className="segment-time" viewBox={`0 0 ${x} 19`} aria-hidden="true" focusable="false">{shapes}</svg>
})

/** Seconds subdial complements the exact chronometer reading; never a wall clock. */
export function ClockFaces({value}:{value:string}){
 const seconds=Number(value.split(':')[1]),number=Number.isFinite(seconds)?seconds:0
 return <svg className="clock-faces" viewBox="0 0 54 54" aria-hidden="true" focusable="false"><circle cx="27" cy="27" r="25" fill="none" stroke="currentColor" strokeWidth="1"/>{Array.from({length:12},(_,i)=><path key={i} d="M27 4v4" fill="none" stroke="currentColor" transform={`rotate(${i*30} 27 27)`}/>)}<path className="seconds-hand" d="M27 31V10" fill="none" stroke="currentColor" strokeWidth="1.8" transform={`rotate(${number*6} 27 27)`}/><circle cx="27" cy="27" r="2"/></svg>
}
