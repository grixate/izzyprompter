import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, ChevronDown, MessageSquare, X } from 'lucide-react'
import { accountApi, accountMessage } from './api'
import './feedback.css'

export function FeedbackForm({ accountId }: { accountId: string }) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const success = useRef<HTMLHeadingElement>(null)
  const backdropPress = useRef(false)
  const sending = useRef(false)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('problem')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [sent, setSent] = useState(false)
  const request = useRef<{ id: string; content: string } | null>(null)

  useEffect(() => {
    if (!open || !dialog.current) return
    const panel = dialog.current
    const viewport = window.visualViewport
    const fit = () => {
      panel.style.setProperty('--feedback-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      panel.style.setProperty('--feedback-viewport-top', `${viewport?.offsetTop ?? 0}px`)
    }
    fit()
    if (!panel.open) panel.showModal()
    heading.current?.focus({ preventScroll: true })
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
    }
  }, [open])
  useEffect(() => { if (open && sent) success.current?.focus({ preventScroll: true }) }, [open, sent])

  const close = () => {
    dialog.current?.close()
    setOpen(false)
    if (sent) { setSent(false); setCategory('problem'); setRating('') }
    trigger.current?.focus({ preventScroll: true })
  }
  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending.current || message.trim().length < 10) return
    const body = { category, message: message.trim(), rating: rating ? Number(rating) : null }
    const content = JSON.stringify(body)
    if (!request.current || request.current.content !== content) request.current = { id: crypto.randomUUID(), content }
    sending.current = true
    setBusy(true); setNotice('')
    try {
      await accountApi('/feedback', 'POST', { ...body, request_id: request.current.id }, accountId)
      setSent(true); setMessage(''); request.current = null
    } catch (error) { setNotice(accountMessage(error)) }
    finally { sending.current = false; setBusy(false) }
  }

  return <>
    <div className="feedback-entry">
      <button ref={trigger} type="button" className="feedback-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} onClick={() => setOpen(true)}>
        <MessageSquare size={18} aria-hidden="true" /><span>Leave feedback</span><ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </div>
    {createPortal(<dialog ref={dialog} id={`${id}-dialog`} className="feedback-dialog" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); close() }}
      onClose={event => { if (!event.currentTarget.open) setOpen(false) }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const stops = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary')]
          .filter(element => element.getClientRects().length > 0)
        const first = stops[0], last = stops.at(-1)
        if (!first || !last) return
        const current = document.activeElement as HTMLElement
        if (!stops.includes(current) || (!event.shiftKey && current === last) || (event.shiftKey && current === first)) {
          event.preventDefault()
          const target = event.shiftKey ? last : first
          target.focus({ preventScroll: true })
        }
      }}
      onMouseDown={event => { backdropPress.current = outside(event) }}
      onClick={event => { if (backdropPress.current && outside(event)) close(); backdropPress.current = false }}>
      <header className="feedback-header">
        <div><span className="feedback-kicker">A BETTER NEXT TAKE</span><h2 ref={heading} id={`${id}-heading`} tabIndex={-1}>Leave feedback</h2></div>
        <button type="button" className="feedback-dismiss" aria-label="Close feedback" onClick={close}><X size={20} aria-hidden="true" /></button>
      </header>
      {sent ? <div className="feedback-success">
        <span className="feedback-received-mark"><Check size={23} aria-hidden="true" /></span>
        <h3 ref={success} tabIndex={-1}>Message received.</h3>
        <p id={`${id}-description`} role="status">Thank you. Your feedback is in our review queue.</p>
        <div className="feedback-actions"><button type="button" className="feedback-secondary" onClick={() => { setSent(false); setCategory('problem'); setRating(''); heading.current?.focus({ preventScroll: true }) }}>Write another</button><button type="button" className="feedback-primary" onClick={close}>Done</button></div>
      </div> : <form className="feedback-form" aria-busy={busy} onSubmit={event => void submit(event)}>
        <div className="feedback-body">
          <p id={`${id}-description`} className="feedback-description">Report a problem or share an idea.</p>
          <fieldset disabled={busy}>
            <label>Topic<select value={category} onChange={event => setCategory(event.target.value)}><option value="problem">Something broke</option><option value="idea">I have an idea</option><option value="other">Something else</option></select></label>
            <label>Your message<textarea required minLength={10} maxLength={2000} rows={5} aria-describedby={`${id}-message-help`} value={message} onChange={event => setMessage(event.target.value)} placeholder="I was trying to…" /></label>
            <div id={`${id}-message-help`} className="feedback-message-help"><span>At least 10 characters</span><span>{message.length.toLocaleString()} / 2,000</span></div>
            <details className="feedback-rating"><summary>Add a rating <span>Optional</span><ChevronDown size={15} aria-hidden="true" /></summary>
              <label className="sr-only" htmlFor={`${id}-rating`}>How was your experience?</label><select id={`${id}-rating`} value={rating} onChange={event => setRating(event.target.value)}><option value="">No rating</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5{value === 1 ? ' · Difficult' : value === 5 ? ' · Great' : ''}</option>)}</select>
            </details>
          </fieldset>
          <p className="feedback-privacy">No script text, passwords or private links, please. Stored with your account for up to 90 days. <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></p>
          {notice && <p className="feedback-error" role="alert">{notice}</p>}
        </div>
        <footer className="feedback-actions"><button type="button" className="feedback-secondary" onClick={close}>Close</button><button type="submit" className="feedback-primary" disabled={busy || message.trim().length < 10}>{busy ? 'Sending…' : 'Send feedback'}<ArrowUpRight size={16} aria-hidden="true" /></button></footer>
      </form>}
    </dialog>, document.body)}
  </>
}
