import { useRef, useState, type FormEvent } from 'react'
import { accountApi, accountMessage } from './api'
import './feedback.css'

export function FeedbackForm({ accountId }: { accountId: string }) {
  const [category, setCategory] = useState('problem')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [sent, setSent] = useState(false)
  const request = useRef<{ id: string; content: string } | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const body = { category, message: message.trim(), rating: rating ? Number(rating) : null }
    const content = JSON.stringify(body)
    if (!request.current || request.current.content !== content) request.current = { id: crypto.randomUUID(), content }
    setBusy(true); setNotice('')
    try {
      await accountApi('/feedback', 'POST', { ...body, request_id: request.current.id }, accountId)
      setSent(true); setMessage(''); request.current = null
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  return <section className="feedback-card" aria-labelledby="feedback-heading">
    <span className="section-index">A BETTER NEXT TAKE</span>
    <h2 id="feedback-heading">Leave your feedback.</h2>
    {sent ? <div role="status"><p>Thank you. Your feedback is in our review queue.</p><button onClick={() => setSent(false)}>Write another message</button></div> : <form onSubmit={event => void submit(event)}>
      <p>Something in the way? Tell us what happened or what would help.</p>
      <fieldset disabled={busy}>
        <label>Topic<select value={category} onChange={event => setCategory(event.target.value)}><option value="problem">Something broke</option><option value="idea">I have an idea</option><option value="other">Something else</option></select></label>
        <label>How was your experience? <small>Optional</small><select value={rating} onChange={event => setRating(event.target.value)}><option value="">Choose a rating</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5{value === 1 ? ' · Difficult' : value === 5 ? ' · Great' : ''}</option>)}</select></label>
        <label>Your message<textarea required minLength={10} maxLength={2000} rows={4} value={message} onChange={event => setMessage(event.target.value)} placeholder="I was trying to…" /></label>
        <p className="feedback-privacy">Please leave out script text, passwords and private links. Feedback is linked to your account and kept for up to 90 days. <a href="/privacy">Privacy</a></p>
        <button className="account-primary" disabled={message.trim().length < 10}>{busy ? 'Sending…' : 'Send feedback'}</button>
      </fieldset>
      {notice && <p role="alert">{notice}</p>}
    </form>}
  </section>
}
