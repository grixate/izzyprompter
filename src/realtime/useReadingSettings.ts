import { useEffect, useRef, useState } from 'react'
import { loadWorkspaceStorage, savePromptSettings, type PromptSettingsV1 } from '../domain/storage'
import type { SessionControllerView } from './controller'
import type { SessionSnapshot } from './protocol'

type Patch = Partial<Omit<PromptSettingsV1, 'speed'>>

/** Serialize changes and coalesce slider input; never queue commands across a disconnect. */
export function useReadingSettings(session: SessionControllerView, localChange?: (value: PromptSettingsV1) => void) {
  const [settings, setSettings] = useState(() => session.displaySettings?.value ?? loadWorkspaceStorage().settings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stored, setStored] = useState(true)
  const latest = useRef({ session, localChange })
  latest.current = { session, localChange }
  const canonical = useRef(session.displaySettings)
  const epoch = useRef(session.sessionEpoch)
  const pending = useRef<Patch>({})
  const inFlight = useRef<Patch | null>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++ } }, [])
  useEffect(() => {
    if (session.connection !== 'connected') {
      generation.current++
      pending.current = {}
      inFlight.current = null
      setBusy(false)
    }
  }, [session.connection])
  useEffect(() => {
    const incoming = session.displaySettings
    if (epoch.current !== session.sessionEpoch) {
      canonical.current = null
      epoch.current = session.sessionEpoch
      generation.current++
      pending.current = {}
      inFlight.current = null
      setBusy(false)
      setError('')
    }
    if (incoming && (!canonical.current || incoming.revision >= canonical.current.revision)) {
      canonical.current = incoming
      setSettings({ ...incoming.value, ...inFlight.current, ...pending.current, speed: session.transport.speed })
    }
  }, [session.displaySettings?.revision, session.sessionEpoch, session.transport.speed])
  useEffect(() => { setStored(savePromptSettings(settings)) }, [settings])

  const pump = async () => {
    const context = latest.current
    if (inFlight.current || !Object.keys(pending.current).length || context.session.connection !== 'connected') return
    const patch = pending.current
    pending.current = {}
    inFlight.current = patch
    const version = generation.current
    setBusy(true)
    const result = await context.session.request<SessionSnapshot>('settings:update', {
      patch, settings_revision: canonical.current?.revision ?? 0,
    })
    if (!mounted.current || version !== generation.current) return
    inFlight.current = null
    if (!result.ok) {
      pending.current = {}
      setError(result.reason === 'settings_conflict' ? 'Settings changed on another device. Try again.' : 'Not applied. Reconnect and try again.')
    } else {
      const snapshot = result.value
      if (snapshot.display_settings && (!canonical.current || (snapshot.settings_revision ?? 0) >= canonical.current.revision)) {
        canonical.current = { value: snapshot.display_settings, revision: snapshot.settings_revision ?? 0 }
      }
    }
    if (canonical.current) setSettings({ ...canonical.current.value, ...pending.current, speed: latest.current.session.transport.speed })
    if (Object.keys(pending.current).length) void pump()
    else setBusy(false)
  }
  const change = (patch: Patch) => {
    if (session.connection !== 'connected' || session.editing.active) return
    setError('')
    if (localChange) {
      const next = { ...settings, ...patch }
      setSettings(next)
      localChange(next)
    } else {
      pending.current = { ...pending.current, ...patch }
      setSettings(value => ({ ...value, ...patch }))
      void pump()
    }
  }
  return { settings, change, busy, error, stored }
}
