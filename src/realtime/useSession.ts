import { useCallback, useEffect, useRef, useState } from 'react'
import { Channel, Socket } from 'phoenix'
import {
  DEFAULT_TRANSPORT,
  EMPTY_PRESENCE,
  EMPTY_READING,
  EMPTY_EDITING,
  PROTOCOL_VERSION,
  type ConnectionState,
  type PresenceState,
  type SessionSnapshot,
  type SessionRole,
  type ReadingState,
  type TransportState,
  type EditingState,
  type CommandResult,
} from './protocol'
import { capabilityFromHash } from './credentials'
import { socketUrl } from './endpoints'
import type { LegacySessionScriptSnapshot } from '../domain/document'
import { lifecycleAction, type LifecycleEvent } from './lifecycle'
import { commandFailureAction, commandRetryDelay } from './commandFailure'
import type { PromptSettingsV1 } from '../domain/storage'
import type { SessionControllerView } from './controller'

// Intentionally unique per page load: editor, display and remote may share a browser.
// randomUUID is restricted to secure contexts in some mobile/LAN browsers.
const clientId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function useSession(sessionId: string | null, role: SessionRole, editorToken?: string): SessionControllerView {
  const [urlToken, setUrlToken] = useState(() => capabilityFromHash(window.location.hash))
  const token = editorToken ?? urlToken
  const channelRef = useRef<Channel | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const failureRef = useRef<(reason?: string) => void>(() => {})
  const recoverRef = useRef<() => void>(() => {})
  const connectedRef = useRef(false)
  const generationRef = useRef(0)
  const sequenceRef = useRef(0)
  const scriptRevisionRef = useRef(0)
  const retryUntilRef = useRef(0)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [transport, setTransport] = useState<TransportState>(DEFAULT_TRANSPORT)
  const [script, setScript] = useState<LegacySessionScriptSnapshot>({ content: '', revision: 0 })
  const [reading, setReading] = useState<ReadingState>(EMPTY_READING)
  const [displayId, setDisplayId] = useState<string | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingState>(EMPTY_EDITING)
  const [presence, setPresence] = useState<PresenceState>(EMPTY_PRESENCE)
  const [clockOffset, setClockOffset] = useState(0)
  const [sessionEpoch, setSessionEpoch] = useState<string | null>(null)
  const [displaySettings, setDisplaySettings] = useState<{ value: PromptSettingsV1; revision: number } | null>(null)
  const [preferencesStatus, setPreferencesStatus] = useState('device')

  useEffect(() => {
    const updateToken = () => setUrlToken(capabilityFromHash(window.location.hash))
    window.addEventListener('hashchange', updateToken)
    return () => window.removeEventListener('hashchange', updateToken)
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setConnection('offline')
      return
    }
    if (!token) {
      setConnection('unauthorized')
      return
    }

    let joined = false
    let active = true
    let terminal = false
    let suspended = role === 'remote' && document.visibilityState === 'hidden'
    let resumeTimer: number | null = null
    connectedRef.current = false
    setConnection('connecting')
    const socket = new Socket(socketUrl(), {
      params: { client_id: clientId },
      reconnectAfterMs: (tries: number) => Math.min(500 * 2 ** tries, 8_000),
    })
    // Phoenix also handles browser lifecycle events internally. Keep its public
    // connect entry point gated so a disposed/terminal socket cannot wake up,
    // and page restoration cannot bypass our fresh-snapshot recovery policy.
    const connect = socket.connect.bind(socket)
    socket.connect = () => { if (active && !terminal && !suspended && navigator.onLine) connect() }
    socketRef.current = socket

    const disconnected = (state: ConnectionState) => {
      if (!active || terminal) return
      connectedRef.current = false
      generationRef.current += 1
      setConnection(state)
    }
    socket.onOpen(() => { if (active && !terminal) setConnection(joined ? 'reconnecting' : 'connecting') })
    socket.onError(() => disconnected('reconnecting'))
    socket.onClose(() => disconnected('offline'))
    socket.connect()

    const channel = socket.channel(`session:${sessionId}`, { role, token, protocol_version: PROTOCOL_VERSION })
    channelRef.current = channel
    const fail = (reason?: string) => {
      if (!active || terminal) return
      terminal = true
      connectedRef.current = false
      generationRef.current += 1
      setConnection(reason === 'session_unavailable' ? 'expired'
        : reason === 'session_limit' ? 'limited'
        : reason === 'unsupported_protocol' ? 'incompatible' : 'unauthorized')
      socket.disconnect()
    }
    failureRef.current = fail

    channel.onError(() => disconnected('reconnecting'))
    channel.onClose(() => disconnected('offline'))
    channel.on('session:ended', (error: { reason?: string }) => fail(error.reason))
    channel.on('transport:update', (next: TransportState) => {
      if (!active || terminal || suspended) return
      setTransport((previous) => next.revision > previous.revision ? next : previous)
    })
    channel.on('script:update', (next: LegacySessionScriptSnapshot) => {
      if (!active || terminal || suspended || next.revision <= scriptRevisionRef.current) return
      scriptRevisionRef.current = next.revision
      setScript(next)
    })
    channel.on('presence:update', (next: PresenceState) => { if (active && !terminal && !suspended) setPresence(next) })
    channel.on('reading:update', (next: ReadingState) => {
      if (!active || terminal || suspended) return
      setReading((previous) => next.revision > previous.revision ? next : previous)
    })
    channel.on('editing:update', (next: EditingState) => {
      if (active && !terminal && !suspended) setEditing((previous) => next.revision > previous.revision ? next : previous)
    })
    channel.on('session:update', (snapshot: SessionSnapshot) => {
      if (!active || terminal || suspended) return
      setPreferencesStatus(snapshot.preferences_status ?? 'device')
      if (snapshot.display_settings) setDisplaySettings(previous => !previous || (snapshot.settings_revision ?? 0) > previous.revision ? { value: snapshot.display_settings!, revision: snapshot.settings_revision ?? 0 } : previous)
      if (snapshot.script.revision > scriptRevisionRef.current) {
        scriptRevisionRef.current = snapshot.script.revision
        setScript(snapshot.script)
      }
      setTransport((previous) => snapshot.transport.revision > previous.revision ? snapshot.transport : previous)
      setReading((previous) => snapshot.reading.revision > previous.revision ? snapshot.reading : previous)
      setEditing((previous) => snapshot.editing.revision > previous.revision ? snapshot.editing : previous)
    })

    channel
      .join()
      .receive('ok', (snapshot: SessionSnapshot) => {
        if (!active || terminal || suspended || !navigator.onLine || (role === 'remote' && document.visibilityState === 'hidden')) return
        if (snapshot.protocol_version !== PROTOCOL_VERSION || typeof snapshot.session_epoch !== 'string') {
          terminal = true
          setConnection('incompatible')
          socket.disconnect()
          return
        }
        joined = true
        generationRef.current += 1
        connectedRef.current = true
        retryUntilRef.current = 0
        setTransport(snapshot.transport)
        setPreferencesStatus(snapshot.preferences_status ?? 'device')
        setDisplaySettings(snapshot.display_settings ? { value: snapshot.display_settings, revision: snapshot.settings_revision ?? 0 } : null)
        setScript(snapshot.script)
        scriptRevisionRef.current = snapshot.script.revision
        setPresence(snapshot.presence)
        setClockOffset(snapshot.server_time - Date.now())
        setSessionEpoch(snapshot.session_epoch)
        setReading(snapshot.reading ?? EMPTY_READING)
        setDisplayId(snapshot.display_id ?? null)
        setConnectionId(snapshot.connection_id ?? null)
        setEditing(snapshot.editing ?? EMPTY_EDITING)
        setConnection('connected')
      })
      .receive('error', (error: { reason?: string }) => {
        if (!active) return
        fail(error.reason)
      })
      .receive('timeout', () => disconnected('reconnecting'))

    // A sleeping phone should ask for a fresh snapshot when it returns,
    // rather than trusting a socket which has not noticed its own timeout yet.
    const resume = () => {
      if (!active || terminal || document.visibilityState === 'hidden' || !navigator.onLine) return
      disconnected('reconnecting')
      // Online, visibility and BFCache restoration can arrive in the same tick.
      // Coalesce them into one fresh join; never enable controls at socket-open.
      if (resumeTimer !== null) return
      resumeTimer = window.setTimeout(() => {
        resumeTimer = null
        socket.disconnect(() => {
          if (!active || terminal || !navigator.onLine || document.visibilityState === 'hidden') return
          suspended = false
          socket.connect()
        })
      }, 0)
    }
    recoverRef.current = resume
    const suspend = () => {
      if (!active || terminal) return
      suspended = true
      if (resumeTimer !== null) window.clearTimeout(resumeTimer)
      resumeTimer = null
      disconnected('offline')
      socket.disconnect()
    }
    const lifecycle = (event: LifecycleEvent, persisted = false) => {
      const action = lifecycleAction(event, { role, visible: document.visibilityState !== 'hidden', online: navigator.onLine, persisted })
      if (action === 'resume') resume()
      else if (action === 'suspend') suspend()
    }
    const online = () => lifecycle('online')
    const offline = () => lifecycle('offline')
    const visibility = () => lifecycle('visibility')
    const pagehide = () => lifecycle('pagehide')
    const pageshow = (event: PageTransitionEvent) => lifecycle('pageshow', event.persisted)
    const freeze = () => lifecycle('freeze')
    const thaw = () => lifecycle('resume')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pagehide)
    window.addEventListener('pageshow', pageshow)
    document.addEventListener('freeze', freeze)
    document.addEventListener('resume', thaw)

    return () => {
      active = false
      connectedRef.current = false
      generationRef.current += 1
      if (resumeTimer !== null) window.clearTimeout(resumeTimer)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pagehide)
      window.removeEventListener('pageshow', pageshow)
      document.removeEventListener('freeze', freeze)
      document.removeEventListener('resume', thaw)
      channelRef.current = null
      socketRef.current = null
      failureRef.current = () => {}
      recoverRef.current = () => {}
      channel.leave()
      socket.disconnect()
    }
  }, [role, sessionId, token])

  const dispatch = useCallback((event: string, payload: Record<string, unknown> = {}, complete?: (result: CommandResult<unknown>) => void) => {
    // Never buffer offline gestures for a later reconnect.
    if (!connectedRef.current || !socketRef.current?.isConnected() || channelRef.current?.state !== 'joined'
      || (role === 'remote' && document.visibilityState === 'hidden')) return false
    if (Date.now() < retryUntilRef.current) {
      complete?.({ ok: false, reason: 'rate_limited' })
      return true
    }
    const generation = generationRef.current
    const sequence = ++sequenceRef.current
    channelRef.current.push(event, {
      ...payload, protocol_version: PROTOCOL_VERSION, sequence,
      command_id: `${clientId}:${sequence}`,
      base_revision: event === 'script:update' ? scriptRevisionRef.current : payload.base_revision,
    }, 5_000)
      .receive('ok', (value: unknown) => complete?.(generation === generationRef.current && connectedRef.current
        ? { ok: true, value } : { ok: false, reason: 'connection_changed' }))
      .receive('error', (error: { reason?: string; retry_after_ms?: number }) => {
        if (generation !== generationRef.current || !connectedRef.current) { complete?.({ ok: false, reason: 'connection_changed' }); return }
        complete?.({ ok: false, reason: error.reason ?? 'invalid_command' })
        if (error.reason === 'rate_limited') retryUntilRef.current = Date.now() + commandRetryDelay(error.retry_after_ms)
        const action = commandFailureAction(error.reason ?? 'invalid_command')
        if (action === 'terminal') failureRef.current(error.reason)
        else if (action === 'recover') recoverRef.current()
      })
      .receive('timeout', () => {
        complete?.({ ok: false, reason: 'timeout' })
        if (generation === generationRef.current && connectedRef.current) recoverRef.current()
      })
    return true
  }, [role])

  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => dispatch(event, payload), [dispatch])
  const request = useCallback(<T,>(event: string, payload: Record<string, unknown> = {}): Promise<CommandResult<T>> => new Promise((resolve) => {
    if (!dispatch(event, payload, (result) => resolve(result as CommandResult<T>))) resolve({ ok: false, reason: 'offline' })
  }), [dispatch])

  const reconnect = useCallback(() => recoverRef.current(), [])

  return { connection, transport, script, presence, clockOffset, sessionEpoch, reading, displayId, connectionId, editing, send, request, reconnect, displaySettings, preferencesStatus }
}
