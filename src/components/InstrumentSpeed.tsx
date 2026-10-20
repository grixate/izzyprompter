import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type FocusEvent } from 'react'
import { boundedSpeed } from '../realtime/keyboard'
import { controlCraftSkins, type SkinId } from '../product/catalog'

export const hasCraftSpeed = (skin?: SkinId) => skin!==undefined&&controlCraftSkins.has(skin)
export const speedMode = (skin: SkinId) => ['vector','ivory','correspondent','signal'].includes(skin)?'dial':['field','switchboard'].includes(skin)?'roller':skin==='arcade'||skin==='graphite'||skin==='cartridge'?'vertical':'linear'

/** One native range and an editable value make each instrument self-contained.
 * Rotary/roller faces use captured relative drag so first contact never jumps. */
export function InstrumentSpeed({skin,speed,enabled=true,onChange}: {skin:SkinId;speed:number;enabled?:boolean;onChange?:(speed:number)=>void}) {
 const fraction=Math.max(0,Math.min(1,speed-.5)),mode=speedMode(skin),relative=mode==='dial'||mode==='roller',inert=!onChange
 const input=useRef<HTMLInputElement>(null),drag=useRef<{id:number;x:number;y:number;speed:number}|null>(null),cancel=useRef(false),editing=useRef(false)
 const [draft,setDraft]=useState(speed.toFixed(2)),[invalid,setInvalid]=useState(false)
 const hint=useId()
 useEffect(()=>{if(!enabled){const active=drag.current;drag.current=null;if(active&&input.current?.hasPointerCapture(active.id))input.current.releasePointerCapture(active.id);editing.current=false}},[enabled])
 const finish=(event:PointerEvent<HTMLInputElement>)=>{if(drag.current?.id!==event.pointerId)return;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
 const commit=(event:FocusEvent<HTMLInputElement>)=>{
  editing.current=false
  if(cancel.current){cancel.current=false;setDraft(speed.toFixed(2));return}
  const entered=event.currentTarget.value.trim(),value=Number(entered.replace(',','.')),valid=entered!==''&&Number.isFinite(value)&&value>=.5&&value<=1.5
  setInvalid(!valid);setDraft((valid?boundedSpeed(value):speed).toFixed(2));if(valid&&enabled)onChange?.(boundedSpeed(value))
 }
 return <div className={`speed-module speed-craft speed--${skin} speed-kind--${mode}${inert?' speed--inert':''}`} style={{'--speed-percent':`${fraction*100}%`,'--speed-offset':`${(1-fraction)*100}%`,'--speed-angle':`${fraction*270-135}deg`,'--lever-angle':`${fraction*100-50}deg`,'--roller-offset':`${fraction*80}px`} as CSSProperties} data-available={enabled} data-speed-mode={mode}>
  <span className="speed-title">{skin==='groove'?'PITCH / SPEED':skin==='arcade'?'TEMPO / SPEED':'SPEED'}</span>
  {inert?<strong className="speed-value">{speed.toFixed(2)}×</strong>:<label className="speed-value"><input className="speed-exact" type="text" inputMode="decimal" maxLength={8} aria-label="Exact playback speed" aria-describedby={hint} aria-invalid={invalid} disabled={!enabled} value={editing.current?draft:speed.toFixed(2)} onFocus={e=>{editing.current=true;setDraft(e.currentTarget.value);setInvalid(false)}} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}else if(e.key==='Escape'){e.preventDefault();cancel.current=true;e.currentTarget.blur()}}} /><span aria-hidden="true">×</span></label>}
  <div className="speed-track">
   {!inert&&<input ref={input} disabled={!enabled} type="range" min="0.5" max="1.5" step="0.01" value={speed} aria-label="Playback speed" aria-orientation={mode==='vertical'?'vertical':'horizontal'} aria-describedby={hint} aria-valuetext={`${speed.toFixed(2)} times normal speed`} onChange={e=>onChange?.(boundedSpeed(Number(e.target.value)))}
    onPointerDown={e=>{if(!relative||!enabled||e.button!==0||drag.current)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,speed}}}
    onPointerMove={e=>{const start=drag.current;if(!enabled||!start||start.id!==e.pointerId)return;const delta=mode==='roller'?e.clientX-start.x:start.y-e.clientY;onChange?.(boundedSpeed(start.speed+delta/(e.shiftKey?800:200)))}}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId)drag.current=null}} />}
   <div className="speed-rail" aria-hidden="true"><i className="speed-fill"/><i className="speed-handle"/><span className="speed-marks"><b>0.50</b><b>1.00</b><b>1.50</b></span></div>
  </div>
  {!inert&&<span id={hint} className="speed-help">{invalid?'Use a value from 0.50 to 1.50.':relative?(mode==='roller'?'DRAG LEFT / RIGHT · TYPE VALUE':'DRAG UP / DOWN · TYPE VALUE'):'DRAG · TYPE VALUE'}<span className="sr-only"> Arrow keys adjust by 0.01. Home and End select the limits. Enter commits an exact value; Escape cancels. Shift-drag makes fine adjustments on rotary controls.</span></span>}
 </div>
}
