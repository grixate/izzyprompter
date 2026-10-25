import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, Monitor, Smartphone, Tablet, X } from 'lucide-react'
import { AccountError, accountApi } from './api'
import './devices.css'

type BrowserSession = { id: string; device: string; signed_in_at: string; last_seen_at: string | null; current: boolean }
const time = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

function DeviceIcon({ label }: { label: string }) {
  const Icon = /iPhone|Android/.test(label) ? Smartphone : /iPad/.test(label) ? Tablet : Monitor
  return <Icon size={21} aria-hidden="true" />
}

function deviceMessage(error: unknown) {
  if (!(error instanceof AccountError)) return 'Connection unavailable. Check your connection and try again.'
  if (error.reason === 'account_changed') return 'This browser switched accounts. Close this panel and refresh before continuing.'
  if (error.reason === 'login_required') return 'This browser has been logged out. Sign in again to manage devices.'
  if (error.reason === 'not_found') return 'That sign-in is no longer in your account. Refresh the list to check your browsers.'
  return 'Could not update your browsers. Please try again.'
}

export function AccountDevices({ accountId }: { accountId: string }) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const generation = useRef(0)
  const changing = useRef(false)
  const backdrop = useRef(false)
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<BrowserSession[] | null>(null)
  const [notice, setNotice] = useState('')
  const [fetching, setFetching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState('')
  const load = useCallback(async () => {
    const request = ++generation.current
    setFetching(true)
    try {
      const next = await accountApi<{ user_id: string; sessions: BrowserSession[] }>('/sessions')
      if (next.user_id !== accountId) throw new AccountError('account_changed', 409)
      if (request === generation.current) { setSessions(next.sessions); setNotice('') }
    } catch (error) { if (request === generation.current) setNotice(deviceMessage(error)) }
    finally { if (request === generation.current) setFetching(false) }
  }, [accountId])
  useEffect(() => {
    if (!open || !dialog.current) return
    if (!dialog.current.open) dialog.current.showModal()
    heading.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void load()
    const update = () => { void load() }
    window.addEventListener('izzy:account-update', update)
    return () => { generation.current++; document.body.style.overflow = overflow; window.removeEventListener('izzy:account-update', update) }
  }, [open, load])
  const close = () => { dialog.current?.close(); setOpen(false); setConfirm(false); trigger.current?.focus({ preventScroll: true }) }
  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
  }
  const revoke = async (sessionId: string) => {
    if (changing.current) return
    changing.current = true
    setBusy(sessionId); setNotice(''); setResult('')
    generation.current++
    try {
      await accountApi(`/sessions/${sessionId}`, 'DELETE', undefined, accountId)
      setSessions(current => current?.filter(session => sessionId === 'others' ? session.current : session.id !== sessionId) ?? null)
      setResult(sessionId === 'others' ? 'Other browsers logged out.' : 'Browser logged out.')
      setConfirm(false)
      await load()
    } catch (error) { setNotice(deviceMessage(error)) }
    finally { changing.current = false; setBusy(null) }
  }
  const others = sessions?.filter(session => !session.current).length ?? 0
  return <>
    <button ref={trigger} className="devices-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} onClick={() => { setSessions(null); setNotice(''); setResult(''); setOpen(true) }}><Monitor size={17} aria-hidden="true" />Devices</button>
    {createPortal(<dialog ref={dialog} className="devices-dialog" id={`${id}-dialog`} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); close() }} onClose={event => { if (!event.currentTarget.open) setOpen(false) }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const stops = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button => button.getClientRects().length > 0)
        const first = stops[0], last = stops.at(-1)
        const current = document.activeElement as HTMLButtonElement
        if (first && last && (!stops.includes(current) || (!event.shiftKey && current === last) || (event.shiftKey && current === first))) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true })
        }
      }}
      onMouseDown={event => { backdrop.current = outside(event) }} onClick={event => { if (backdrop.current && outside(event)) close(); backdrop.current = false }}>
      <header className="devices-header"><div><span className="devices-kicker">YOUR ACCOUNT</span><h2 ref={heading} tabIndex={-1} id={`${id}-heading`}>Signed-in browsers</h2></div><button className="devices-close" type="button" aria-label="Close devices" onClick={close}><X size={22} aria-hidden="true" /></button></header>
      <div className="devices-body">
        <p id={`${id}-description`}>Stay signed in until you log out. Manage which browsers can access your account.</p>
        {sessions === null && !notice && <div className="devices-loading" role="status"><LoaderCircle size={21} aria-hidden="true" />Checking your browsers…</div>}
        {sessions && <ul className="devices-list">{sessions.map(session => <li key={session.id}>
          <span className={`devices-icon${session.current ? ' is-current' : ''}`}><DeviceIcon label={session.device} /></span>
          <div className="devices-details"><strong>{session.device}</strong>{session.current && <span className="devices-current"><Check size={13} aria-hidden="true" />This browser</span>}
            <span>Signed in {time(session.signed_in_at)}</span>{!session.current && <span>{session.last_seen_at ? `Last active ${time(session.last_seen_at)}` : 'Activity not recorded yet'}</span>}</div>
          {!session.current && <button type="button" className="devices-revoke" aria-label={`Log out ${session.device}`} disabled={busy !== null} onClick={() => void revoke(session.id)}>{busy === session.id ? 'Logging out…' : 'Log out'}</button>}
        </li>)}</ul>}
        {others > 0 && <div className="devices-others">{confirm ? <><p>Other browsers will need a new sign-in link. This browser stays signed in.</p><div className="devices-confirm"><button type="button" disabled={busy !== null} onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="devices-revoke" disabled={busy !== null} onClick={() => void revoke('others')}>{busy === 'others' ? 'Logging out…' : 'Log out other browsers'}</button></div></> : <button className="devices-revoke" type="button" disabled={busy !== null} onClick={() => setConfirm(true)}>Log out other browsers</button>}</div>}
        {notice && <div className="devices-error" role="alert"><p>{notice}</p><button type="button" disabled={fetching} onClick={() => void load()}>{fetching ? <><LoaderCircle className="devices-retry-spinner" size={16} aria-hidden="true" />Checking…</> : 'Try again'}</button></div>}
        <p className="devices-result" role="status">{result}</p>
        <p className="devices-note">Browser names are approximate. Separate browser profiles appear separately. End a take to disconnect its paired remotes. Clearing cookies or using private browsing can require a new sign-in link.</p>
      </div>
      <footer className="devices-footer"><button className="devices-done" type="button" onClick={close}>Done</button></footer>
    </dialog>, document.body)}
  </>
}
