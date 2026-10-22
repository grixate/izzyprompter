import { Check, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { track } from '../product/events'
import { checkOfflineApp, prepareOfflineApp } from './offline'

/** Entering either offline route prepares its app shell; editing never waits for it. */
export function OfflinePreparation() {
  const [state, setState] = useState<'preparing' | 'ready' | 'error'>('preparing')
  const [message, setMessage] = useState('Keep this page open while IZZY saves in this browser.')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState('preparing')
    void (async () => {
      try {
        if (!await checkOfflineApp()) await prepareOfflineApp()
        if (!active) return
        setState('ready')
        setMessage('You can reopen IZZY in this browser without internet.')
        track('offline_pairing_ready', { surface: 'standalone' })
      } catch (error) {
        if (!active) return
        setState('error')
        setMessage(error instanceof Error ? error.message : 'Keep internet connected and retry. You can still read in this tab.')
      }
    })()
    const online = () => { if (active) setAttempt(value => value + 1) }
    window.addEventListener('online', online)
    return () => { active = false; window.removeEventListener('online', online) }
  }, [attempt])
  return <section className="local-preparation" data-state={state} aria-label="Offline app preparation">
    <span className="offline-preparation-icon" aria-hidden="true">{state === 'ready' ? <Check size={20} /> : state === 'preparing' ? <LoaderCircle size={20} /> : <WifiOff size={20} />}</span>
    <div role="status"><strong>{state === 'ready' ? 'Ready offline' : state === 'preparing' ? 'Saving IZZY for offline use…' : 'Not saved for offline yet'}</strong><p>{message}</p></div>
    {state === 'error' && <button onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} />Retry</button>}
  </section>
}
