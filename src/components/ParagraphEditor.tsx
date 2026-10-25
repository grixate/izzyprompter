import { useId, type ReactNode, type RefObject } from 'react'
import { RemoteDrawer } from './RemoteDrawer'

/** The editor is reading space, with one compact bar above the keyboard. */
export function ParagraphEditor({open,onRequestClose,onDone,doneDisabled=false,dialogRef,returnTo,status,state,description,children,recoveryFooter,title='Current paragraph',actionLabel='Done'}: {
 open:boolean;onRequestClose:()=>void;onDone:()=>void;doneDisabled?:boolean
 dialogRef?:RefObject<HTMLDialogElement|null>;returnTo?:RefObject<HTMLButtonElement|null>
 status:string;state?:string;description:string;children:ReactNode;recoveryFooter?:ReactNode
 title?:string;actionLabel?:string
}) {
 const id=useId()
 return <RemoteDrawer kind="paragraph" open={open} onRequestClose={onRequestClose} dialogRef={dialogRef} returnTo={returnTo} labelledBy={`${id}-title`} describedBy={`${id}-description`} state={state}>
  <header><div><h1 id={`${id}-title`}>{title}</h1><span className={`edit-sync ${state??''}`} role="status">{status}</span></div>
   <button className="edit-done" disabled={doneDisabled} onClick={onDone}>{actionLabel}</button></header>
  <p id={`${id}-description`} className="sr-only">{description}</p>
  <div className="quick-edit-body">{children}</div>
  {recoveryFooter&&<footer>{recoveryFooter}</footer>}
 </RemoteDrawer>
}
