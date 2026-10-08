export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export type TransportState = {
  status: 'playing' | 'paused'
  anchor_position: number
  speed: number
  anchor_server_time: number
  revision: number
}

export type PresenceState = {
  editor: number
  display: number
  remote: number
}

export type SessionSnapshot = {
  session_id: string
  script: { content: string; revision: number }
  transport: TransportState
  presence: PresenceState
  server_time: number
}

export const DEFAULT_TRANSPORT: TransportState = {
  status: 'paused',
  anchor_position: 0,
  speed: 0.86,
  anchor_server_time: Date.now(),
  revision: 0,
}

export const EMPTY_PRESENCE: PresenceState = { editor: 0, display: 0, remote: 0 }
