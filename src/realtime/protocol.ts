export const PROTOCOL_VERSION = 2 as const
export type SessionRole = 'editor' | 'display' | 'remote'
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'expired' | 'unauthorized' | 'incompatible' | 'limited'

export type TransportState = {
  status: 'playing' | 'paused'
  anchor_position: number
  speed: number
  anchor_server_time: number
  revision: number
  semantic_anchor?: { anchor: ReadingAnchor; script_revision: number; revision: number; transport_position: number }
}

export type ReadingCheckpoint = {
  anchor: ReadingAnchor
  position: number
  maximum: number
  transport_position: number
  transport_revision: number
  script_revision: number
  source_id: string
  server_time: number
}
export type ReadingState = { revision: number; source_id: string | null; checkpoint: ReadingCheckpoint | null }
export const EMPTY_READING: ReadingState = { revision: 0, source_id: null, checkpoint: null }
export type EditingState = { revision: number; active: { owner_id: string; block_id: string; anchor: ReadingAnchor; scope?: 'paragraph' | 'document' } | null }
export const EMPTY_EDITING: EditingState = { revision: 0, active: null }
export type CommandResult<T> = { ok: true; value: T } | { ok: false; reason: string }

export type PresenceState = {
  editor: number
  display: number
  remote: number
}

export type SessionSnapshot = {
  preferences_status?: string
  preferences_status_revision?: number
  display_settings?: import('../domain/storage').PromptSettingsV1 | null
  settings_revision?: number
  saved_revision?: number | null
  protocol_version: typeof PROTOCOL_VERSION
  session_id: string
  session_epoch: string
  script: { content: string; revision: number; document?: IzzyDocumentV1 }
  reading: ReadingState
  display_id: string | null
  connection_id: string
  editing: EditingState
  transport: TransportState
  presence: PresenceState
  server_time: number
}

export const DEFAULT_TRANSPORT: TransportState = {
  status: 'paused',
  anchor_position: 0,
  speed: 0.56,
  anchor_server_time: Date.now(),
  revision: 0,
}

export const EMPTY_PRESENCE: PresenceState = { editor: 0, display: 0, remote: 0 }
import type { IzzyDocumentV1 } from '../domain/document'
import type { ReadingAnchor } from '../prompt/position'
