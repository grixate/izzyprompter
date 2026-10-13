import {
  createIzzyDocumentFromLegacyText,
  isIzzyDocumentV1,
  type IzzyDocumentV1,
} from './document.ts'

export const IZZY_STORAGE_VERSION = 1 as const

export const STORAGE_KEYS = {
  document: 'izzy.document',
  draft: 'izzy.draft',
  settings: 'izzy.prompt-settings',
  position: 'izzy.prompt-position',
  displayPositions: 'izzy.display-positions',
  quickEdits: 'izzy.quick-edit-drafts',
} as const

export type StorageEnvelopeV1<T> = {
  storageVersion: typeof IZZY_STORAGE_VERSION
  updatedAt: number
  data: T
}

export type IzzyDraftStateV1 = {
  documentId: string
  title: string
  content: string
}

export type PromptSettingsV1 = {
  speed: number
  fontSize: number
  lineHeight: number
  textWidth: number
  mirrored: boolean
}

export type PromptPositionV1 = {
  blockId: string | null
  characterOffset: number
}

export type DisplayCheckpointV1 = {
  documentKey: string
  anchor: { blockId: string; characterOffset: number }
  serverPosition: number
  transportRevision: number
}

export type QuickEditDraftV1 = { epoch: string; blockId: string; text: string; acknowledgedText: string }
const isQuickEditMap = (value: unknown): value is Record<string, QuickEditDraftV1> => isRecord(value)
  && Object.values(value).every((entry) => isRecord(entry)
    && ['epoch', 'blockId', 'text', 'acknowledgedText'].every((key) => typeof entry[key] === 'string'))

export function loadQuickEditDraft(sessionId: string, storage: StorageLike | null = getBrowserStorage()) {
  const drafts = readStoredValue(STORAGE_KEYS.quickEdits, isQuickEditMap, storage)
  return drafts && Object.hasOwn(drafts, sessionId) ? drafts[sessionId] : null
}
export function saveQuickEditDraft(sessionId: string, draft: QuickEditDraftV1 | null, storage: StorageLike | null = getBrowserStorage()) {
  const previous = readStoredValue(STORAGE_KEYS.quickEdits, isQuickEditMap, storage) ?? {}
  const entries = Object.entries(previous).filter(([id]) => id !== sessionId).slice(-9)
  const next = Object.fromEntries(draft ? [...entries, [sessionId, draft]] : entries)
  return isQuickEditMap(next) && writeStoredValue(STORAGE_KEYS.quickEdits, next, storage, Date.now)
}

export type WorkspaceStorageState = {
  document: IzzyDocumentV1 | null
  draft: IzzyDraftStateV1 | null
  settings: PromptSettingsV1
  position: PromptPositionV1
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const DEFAULT_PROMPT_SETTINGS: PromptSettingsV1 = {
  speed: 0.86,
  fontSize: 64,
  lineHeight: 1.24,
  textWidth: 68,
  mirrored: false,
}

export const DEFAULT_PROMPT_POSITION: PromptPositionV1 = {
  blockId: null,
  characterOffset: 0,
}

const getBrowserStorage = (): StorageLike | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const migrateEnvelope = (value: unknown): StorageEnvelopeV1<unknown> | null => {
  if (!isRecord(value)) return null

  let working = value
  let version = working.storageVersion

  // Migration hook for the pre-release envelope shape. Future migrations can
  // be added as another version step without changing individual validators.
  if (version === 0) {
    working = {
      storageVersion: 1,
      updatedAt: typeof working.savedAt === 'number' ? working.savedAt : Date.now(),
      data: working.value ?? working.data,
    }
    version = 1
  }

  if (version !== IZZY_STORAGE_VERSION) return null
  if (typeof working.updatedAt !== 'number' || !Number.isFinite(working.updatedAt)) return null
  if (!Object.hasOwn(working, 'data')) return null

  return working as StorageEnvelopeV1<unknown>
}

const readStoredValue = <T>(
  key: string,
  validate: (value: unknown) => value is T,
  storage: StorageLike | null,
): T | null => {
  if (!storage) return null

  try {
    const serialized = storage.getItem(key)
    if (serialized === null) return null
    const envelope = migrateEnvelope(JSON.parse(serialized))
    return envelope && validate(envelope.data) ? envelope.data : null
  } catch {
    return null
  }
}

const writeStoredValue = <T>(
  key: string,
  data: T,
  storage: StorageLike | null,
  now: () => number,
) => {
  if (!storage) return false

  const envelope: StorageEnvelopeV1<T> = {
    storageVersion: IZZY_STORAGE_VERSION,
    updatedAt: now(),
    data,
  }

  try {
    storage.setItem(key, JSON.stringify(envelope))
    return true
  } catch {
    return false
  }
}

const isDraftState = (value: unknown): value is IzzyDraftStateV1 => {
  if (!isRecord(value)) return false
  return typeof value.documentId === 'string' && value.documentId.trim() !== ''
    && typeof value.title === 'string' && value.title.trim() !== ''
    && typeof value.content === 'string'
}

const isPromptSettings = (value: unknown): value is PromptSettingsV1 => {
  if (!isRecord(value)) return false
  return typeof value.speed === 'number' && value.speed >= 0.5 && value.speed <= 1.5
    && typeof value.fontSize === 'number' && value.fontSize >= 20 && value.fontSize <= 160
    && typeof value.lineHeight === 'number' && value.lineHeight >= 0.8 && value.lineHeight <= 3
    && typeof value.textWidth === 'number' && value.textWidth >= 25 && value.textWidth <= 100
    && typeof value.mirrored === 'boolean'
}

const isPromptPosition = (value: unknown): value is PromptPositionV1 => {
  if (!isRecord(value)) return false
  const hasValidBlock = value.blockId === null
    || (typeof value.blockId === 'string' && value.blockId.trim() !== '')
  return hasValidBlock
    && typeof value.characterOffset === 'number'
    && Number.isInteger(value.characterOffset)
    && value.characterOffset >= 0
}

export function loadWorkspaceStorage(storage: StorageLike | null = getBrowserStorage()): WorkspaceStorageState {
  return {
    document: readStoredValue(STORAGE_KEYS.document, isIzzyDocumentV1, storage),
    draft: readStoredValue(STORAGE_KEYS.draft, isDraftState, storage),
    settings: readStoredValue(STORAGE_KEYS.settings, isPromptSettings, storage)
      ?? { ...DEFAULT_PROMPT_SETTINGS },
    position: readStoredValue(STORAGE_KEYS.position, isPromptPosition, storage)
      ?? { ...DEFAULT_PROMPT_POSITION },
  }
}

export const saveStoredDocument = (
  document: IzzyDocumentV1,
  storage: StorageLike | null = getBrowserStorage(),
  now: () => number = Date.now,
) => isIzzyDocumentV1(document)
  && writeStoredValue(STORAGE_KEYS.document, document, storage, now)

export const saveDraftState = (
  draft: IzzyDraftStateV1,
  storage: StorageLike | null = getBrowserStorage(),
  now: () => number = Date.now,
) => isDraftState(draft)
  && writeStoredValue(STORAGE_KEYS.draft, draft, storage, now)

export const savePromptSettings = (
  settings: PromptSettingsV1,
  storage: StorageLike | null = getBrowserStorage(),
  now: () => number = Date.now,
) => isPromptSettings(settings)
  && writeStoredValue(STORAGE_KEYS.settings, settings, storage, now)

export const savePromptPosition = (
  position: PromptPositionV1,
  storage: StorageLike | null = getBrowserStorage(),
  now: () => number = Date.now,
) => isPromptPosition(position)
  && writeStoredValue(STORAGE_KEYS.position, position, storage, now)

const isDisplayCheckpointMap = (value: unknown): value is Record<string, DisplayCheckpointV1> => {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => isRecord(entry)
    && typeof entry.documentKey === 'string'
    && isPromptPosition(entry.anchor) && entry.anchor.blockId !== null
    && typeof entry.serverPosition === 'number' && Number.isFinite(entry.serverPosition)
    && typeof entry.transportRevision === 'number' && Number.isSafeInteger(entry.transportRevision) && entry.transportRevision >= 0)
}

export function loadDisplayCheckpoint(sessionId: string, storage: StorageLike | null = getBrowserStorage()) {
  const checkpoints = readStoredValue(STORAGE_KEYS.displayPositions, isDisplayCheckpointMap, storage)
  return checkpoints && Object.hasOwn(checkpoints, sessionId) ? checkpoints[sessionId] : null
}

export function saveDisplayCheckpoint(sessionId: string, checkpoint: DisplayCheckpointV1, storage: StorageLike | null = getBrowserStorage()) {
  const previous = readStoredValue(STORAGE_KEYS.displayPositions, isDisplayCheckpointMap, storage) ?? {}
  // Keep the ten most recently written sessions, and prevent prototype keys
  // from ever being assigned on an ordinary object.
  const entries = Object.entries(previous).filter(([id]) => id !== sessionId).slice(-9)
  const next = Object.fromEntries([...entries, [sessionId, checkpoint]])
  return isDisplayCheckpointMap(next)
    && writeStoredValue(STORAGE_KEYS.displayPositions, next, storage, Date.now)
}

export function clearWorkspaceStorage(storage: StorageLike | null = getBrowserStorage()) {
  if (!storage) return false

  let cleared = true
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      storage.removeItem(key)
    } catch {
      cleared = false
    }
  }
  return cleared
}

export function persistDraftDocument(
  draft: IzzyDraftStateV1,
  storage: StorageLike | null = getBrowserStorage(),
) {
  const document = createIzzyDocumentFromLegacyText(draft.content, {
    documentId: draft.documentId,
    title: draft.title,
  })

  const draftSaved = saveDraftState(draft, storage)
  const documentSaved = saveStoredDocument(document, storage)
  return draftSaved && documentSaved
}

export function createDebouncedStorageWriter<T>(options: {
  delay?: number
  write: (value: T) => boolean | void
  onResult?: (saved: boolean) => void
}) {
  let pending: T | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const delay = Math.max(0, options.delay ?? 250)

  const flush = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (pending === null) return true

    const value = pending
    pending = null
    let saved = false
    try { saved = options.write(value) !== false } catch { /* storage can be revoked mid-session */ }
    options.onResult?.(saved)
    return saved
  }

  return {
    schedule(value: T) {
      pending = value
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
    cancel() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending = null
    },
    dispose: flush,
  }
}
