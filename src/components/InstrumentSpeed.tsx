import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type FocusEvent } from 'react'
import { boundedSpeed, MIN_SPEED, MAX_SPEED, SPEED_STEP, speedFraction } from '../prompt/speed'
import { controlCraftSkins, type SkinId } from '../product/catalog'

export const hasCraftSpeed = (skin?: SkinId) => skin!==undefined&&controlCraftSkins.has(skin)
export const speedMode = (skin: SkinId) => ['vector','ivory','correspondent','signal'].includes(skin)?'dial':['field','switchboard'].includes(skin)?'roller':skin==='arcade'||skin==='graphite'||skin==='cartridge'?'vertical':'linear'
type SpeedDrag = {id:number;x:number;y:number;value:number;cx:number;cy:number;angle:number|null;angular:boolean;travel:number}
const angleDelta=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle))

/** One native range and an editable value make each instrument self-contained.
 * Rotary/roller faces use captured relative drag so first contact never jumps. */
export function InstrumentSpeed({skin,speed,enabled=true,onChange}: {skin:SkinId;speed:number;enabled?:boolean;onChange?:(speed:number)=>void}) {
 const fraction=speedFraction(speed),mode=speedMode(skin),relative=mode==='dial'||mode==='roller',inert=!onChange
 const input=useRef<HTMLInputElement>(null),drag=useRef<SpeedDrag|null>(null),cancel=useRef(false),editing=useRef(false),pointerFocus=useRef(false)
 const [draft,setDraft]=useState(speed.toFixed(2)),[invalid,setInvalid]=useState(false)
 const [keyboardFocus,setKeyboardFocus]=useState(false)
 const hint=useId()
 useEffect(()=>{if(!enabled){const active=drag.current;drag.current=null;if(active&&input.current?.hasPointerCapture(active.id))input.current.releasePointerCapture(active.id);editing.current=false}},[enabled])
 const finish=(event:PointerEvent<HTMLInputElement>)=>{if(drag.current?.id!==event.pointerId)return;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
 const commit=(event:FocusEvent<HTMLInputElement>)=>{
  editing.current=false
  if(cancel.current){cancel.current=false;setDraft(speed.toFixed(2));return}
  const entered=event.currentTarget.value.trim(),value=Number(entered.replace(',','.')),valid=entered!==''&&Number.isFinite(value)&&value>=MIN_SPEED&&value<=MAX_SPEED
  setInvalid(!valid);setDraft((valid?boundedSpeed(value):speed).toFixed(2));if(valid&&enabled)onChange?.(boundedSpeed(value))
 }
 return <div className={`speed-module speed-craft speed--${skin} speed-kind--${mode}${inert?' speed--inert':''}`} style={{'--speed-percent':`${fraction*100}%`,'--speed-offset':`${(1-fraction)*100}%`,'--speed-angle':`${fraction*270-135}deg`,'--lever-angle':`${fraction*100-50}deg`,'--roller-offset':`${fraction*80}px`} as CSSProperties} data-available={enabled} data-speed-mode={mode}>
  <div className="speed-summary"><span className="speed-title">{skin==='groove'?'PITCH / SPEED':skin==='arcade'?'TEMPO / SPEED':'SPEED'}</span>
  {inert?<strong className="speed-value">{speed.toFixed(2)}×</strong>:<label className="speed-value"><input className="speed-exact" type="text" inputMode="decimal" maxLength={8} aria-label="Exact playback speed" aria-describedby={hint} aria-invalid={invalid} disabled={!enabled} value={editing.current?draft:speed.toFixed(2)} onFocus={e=>{editing.current=true;setDraft(e.currentTarget.value);setInvalid(false)}} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}else if(e.key==='Escape'){e.preventDefault();cancel.current=true;e.currentTarget.blur()}}} /><span aria-hidden="true">×</span></label>}
  </div>
  <div className="speed-track" data-keyboard-focus={keyboardFocus}>
   {!inert&&<input ref={input} disabled={!enabled} type="range" min={MIN_SPEED} max={MAX_SPEED} step={SPEED_STEP} value={speed} aria-label="Playback speed" aria-orientation={mode==='vertical'?'vertical':'horizontal'} aria-describedby={hint} aria-valuetext={`${speed.toFixed(2)} times normal speed`} onChange={e=>onChange?.(boundedSpeed(Number(e.target.value)))}
    onFocus={e=>setKeyboardFocus(!pointerFocus.current&&e.currentTarget.matches(':focus-visible'))}
    onBlur={()=>{pointerFocus.current=false;setKeyboardFocus(false)}}
    onKeyDown={()=>{pointerFocus.current=false;setKeyboardFocus(true)}}
    onPointerDown={e=>{
     if(!enabled||e.button!==0)return
     pointerFocus.current=true;setKeyboardFocus(false)
     if(!relative||drag.current)return
     e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId)
     const rail=e.currentTarget.parentElement!.querySelector('.speed-rail')!.getBoundingClientRect(),cx=rail.x+rail.width/2,cy=rail.y+rail.height*(skin==='signal'?.7:.5)
     drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,value:speed,cx,cy,angle:Math.atan2(e.clientY-cy,e.clientX-cx),angular:mode==='dial'&&Math.hypot(e.clientX-cx,e.clientY-cy)>=18,travel:Math.max(44,rail.width)}
    }}
    onPointerMove={e=>{
     const current=drag.current;if(!enabled||!current||current.id!==e.pointerId)return
     let fraction:number
     if(current.angular){
      const distance=Math.hypot(e.clientX-current.cx,e.clientY-current.cy),angle=Math.atan2(e.clientY-current.cy,e.clientX-current.cx)
      // Crossing the pivot cannot turn a dial by half a revolution.
      fraction=distance<8||current.angle===null?0:angleDelta(angle-current.angle)/((skin==='signal'?100:270)*Math.PI/180)
      current.angle=distance<8?null:angle
     }else fraction=mode==='roller'?(e.clientX-current.x)/current.travel:(current.y-e.clientY)/200
     current.x=e.clientX;current.y=e.clientY
     current.value=Math.max(MIN_SPEED,Math.min(MAX_SPEED,current.value+fraction*(MAX_SPEED-MIN_SPEED)/(e.shiftKey?4:1)))
     onChange?.(boundedSpeed(current.value))
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId)drag.current=null}} />}
   <div className="speed-rail" aria-hidden="true"><i className="speed-fill"/><i className="speed-handle"/><span className="speed-marks"><b>0.20</b><b>0.60</b><b>1.00</b></span></div>
  </div>
  {!inert&&<span id={hint} className="speed-help">{invalid?'Use a value from 0.20 to 1.00.':relative?(mode==='roller'?'DRAG LEFT / RIGHT · TYPE VALUE':'TURN CLOCKWISE / COUNTERCLOCKWISE · TYPE VALUE'):'DRAG · TYPE VALUE'}<span className="sr-only">{mode==='dial'?' Clockwise increases speed. Counterclockwise decreases it. Drag up or down when starting at the centre.':''} Arrow keys adjust by 0.01. Home and End select the limits. Enter commits an exact value; Escape cancels. Shift-drag makes fine adjustments.</span></span>}
 </div>
}
