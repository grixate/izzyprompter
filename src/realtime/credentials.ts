import { PROTOCOL_VERSION, type SessionRole } from './protocol.ts'

export type SessionCredentials = {
  protocol_version: typeof PROTOCOL_VERSION
  session_id: string
  tokens: Record<SessionRole, string>
}
export const EDITOR_SESSION_KEY = 'izzy.editor-session'
const isToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export function isSessionCredentials(value: unknown): value is SessionCredentials {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<SessionCredentials>
  return data.protocol_version === PROTOCOL_VERSION
    && typeof data.session_id === 'string' && /^[A-Z2-9]{6}$/.test(data.session_id)
    && Boolean(data.tokens) && ['editor', 'display', 'remote'].every((role) => isToken(data.tokens?.[role as SessionRole]))
}

export function capabilityFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('key')
  return isToken(token) ? token : null
}

export function sessionLink(baseUrl: string, session: SessionCredentials, role: 'display' | 'remote') {
  return `${baseUrl}/${role}/${session.session_id}#key=${session.tokens[role]}`
}

// Editor credentials are tab-scoped, not part of a script export or local draft.
// Failure to persist must never prevent a live session from starting.
export function loadEditorSession(storage: Pick<Storage, 'getItem'>): SessionCredentials | null {
  try {
    const data: unknown = JSON.parse(storage.getItem(EDITOR_SESSION_KEY) ?? 'null')
    return isSessionCredentials(data) ? data : null
  } catch { return null }
}

export function saveEditorSession(session: SessionCredentials | null, storage: Pick<Storage, 'setItem' | 'removeItem'>) {
  try {
    if (session) storage.setItem(EDITOR_SESSION_KEY, JSON.stringify(session))
    else storage.removeItem(EDITOR_SESSION_KEY)
  } catch { /* tab storage is a progressive enhancement */ }
}
