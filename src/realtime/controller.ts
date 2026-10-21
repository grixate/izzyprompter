import type { LegacySessionScriptSnapshot } from '../domain/document'
import type { PromptSettingsV1 } from '../domain/storage'
import type { CommandResult, ConnectionState, EditingState, PresenceState, ReadingState, TransportState } from './protocol'

/** The existing display/remote consume state and intents, not a socket. */
export type SessionControllerView = {
  connection: ConnectionState
  transport: TransportState
  script: LegacySessionScriptSnapshot
  presence: PresenceState
  clockOffset: number
  sessionEpoch: string | null
  reading: ReadingState
  displayId: string | null
  connectionId: string | null
  editing: EditingState
  displaySettings: { value: PromptSettingsV1; revision: number } | null
  preferencesStatus?: string
  send: (event: string, payload?: Record<string, unknown>) => boolean
  request: <T>(event: string, payload?: Record<string, unknown>) => Promise<CommandResult<T>>
  reconnect: () => void
  now?: () => number
  path?: 'local' | 'direct'
}
