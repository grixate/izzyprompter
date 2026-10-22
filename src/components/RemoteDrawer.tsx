import { createPortal } from 'react-dom'
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

/** Native modal focus/inert behaviour, aligned to the visible viewport when a
 * phone keyboard or browser chrome changes its height. Only the sheet scrolls. */
export function RemoteDrawer({open,onRequestClose,children,labelledBy,describedBy,dialogRef,returnTo,state,kind}: {
  kind?:'paragraph';open:boolean;onRequestClose:()=>void;children:ReactNode;labelledBy:string;describedBy?:string
  dialogRef?:RefObject<HTMLDialogElement|null>;returnTo?:RefObject<HTMLButtonElement|null>;state?:string
}) {
  const own=useRef<HTMLDialogElement>(null),invoker=useRef<HTMLElement|null>(null),ref=dialogRef??own
  useEffect(()=>{
    const dialog=ref.current
    if(!dialog)return
    if(!open){
      if(dialog.open){dialog.close();const target=returnTo?.current??invoker.current
        if(target?.isConnected&&!(target instanceof HTMLButtonElement&&target.disabled))target.focus({preventScroll:true})
        else document.querySelector<HTMLElement>('.wheel-input')?.focus({preventScroll:true})}
      return
    }
    const viewport=window.visualViewport
    const resize=()=>{dialog.style.setProperty('--drawer-height',`${viewport?.height??innerHeight}px`);dialog.style.setProperty('--drawer-top',`${viewport?.offsetTop??0}px`);dialog.style.setProperty('--drawer-width',`${viewport?.width??innerWidth}px`);dialog.style.setProperty('--drawer-left',`${viewport?.offsetLeft??0}px`)}
    resize()
    viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize)
    if(!dialog.open){invoker.current=document.activeElement as HTMLElement;dialog.showModal();(dialog.querySelector<HTMLElement>('textarea')??dialog.querySelector<HTMLElement>('button'))?.focus({preventScroll:true})}
    const frame=requestAnimationFrame(resize)
    return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize)}
  },[open,ref,returnTo])
  return createPortal(<dialog ref={ref} className={`quick-edit-dialog remote-drawer${kind==='paragraph'?' paragraph-editor':''}`} aria-labelledby={labelledBy} aria-describedby={describedBy} data-state={state}
    onCancel={event=>{event.preventDefault();onRequestClose()}} onKeyDown={event=>{
      if(event.key!=='Tab')return
      const stops=[...event.currentTarget.querySelectorAll<HTMLElement>('textarea:not(:disabled),button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el=>el.getClientRects().length>0)
      if(!stops.length)return
      event.preventDefault();const index=stops.indexOf(document.activeElement as HTMLElement)
      stops[(index+(event.shiftKey?-1:1)+stops.length)%stops.length]?.focus({preventScroll:true})
    }}>{children}</dialog>,document.body)
}
