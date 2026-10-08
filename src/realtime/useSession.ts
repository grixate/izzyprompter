import { useCallback, useEffect, useRef, useState } from 'react'
import { Channel, Socket } from 'phoenix'
import {
  DEFAULT_TRANSPORT,
  EMPTY_PRESENCE,
  type ConnectionState,
  type PresenceState,
  type SessionSnapshot,
  type TransportState,
} from './protocol'

type Role = 'editor' | 'display' | 'remote'

// Intentionally unique per page load: editor, display and remote may share a browser.
// randomUUID is restricted to secure contexts in some mobile/LAN browsers.
const clientId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const socketUrl = () => {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL
  if (configuredUrl) return configuredUrl

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const isLocalDevelopment = window.location.port === '5173'
  const host = isLocalDevelopment ? `${window.location.hostname}:4000` : window.location.host
  return `${protocol}://${host}/socket`
}

export function useSession(sessionId: string | null, role: Role) {
  const channelRef = useRef<Channel | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [transport, setTransport] = useState<TransportState>(DEFAULT_TRANSPORT)
  const [script, setScript] = useState({ content: '', revision: 0 })
  const [presence, setPresence] = useState<PresenceState>(EMPTY_PRESENCE)
  const [clockOffset, setClockOffset] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      setConnection('offline')
      return
    }

    let joined = false
    const socket = new Socket(socketUrl(), {
      params: { client_id: clientId },
      reconnectAfterMs: (tries: number) => Math.min(500 * 2 ** tries, 8_000),
    })

    socket.onOpen(() => setConnection(joined ? 'reconnecting' : 'connecting'))
    socket.onError(() => setConnection('reconnecting'))
    socket.onClose(() => setConnection('offline'))
    socket.connect()

    const channel = socket.channel(`session:${sessionId}`, { role })
    channelRef.current = channel

    channel.on('transport:update', (next: TransportState) => setTransport(next))
    channel.on('script:update', (next: { content: string; revision: number }) => setScript(next))
    channel.on('presence:update', (next: PresenceState) => setPresence(next))

    channel
      .join()
      .receive('ok', (snapshot: SessionSnapshot) => {
        joined = true
        setTransport(snapshot.transport)
        setScript(snapshot.script)
        setPresence(snapshot.presence)
        setClockOffset(snapshot.server_time - Date.now())
        setConnection('connected')
      })
      .receive('error', () => setConnection('offline'))
      .receive('timeout', () => setConnection('reconnecting'))

    return () => {
      channelRef.current = null
      channel.leave()
      socket.disconnect()
    }
  }, [role, sessionId])

  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    channelRef.current?.push(event, payload, 5_000)
  }, [])

  return { connection, transport, script, presence, clockOffset, send }
}
