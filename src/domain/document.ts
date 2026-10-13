import { normalizePlainText } from './textNormalization.ts'

export const IZZY_DOCUMENT_SCHEMA_VERSION = 1 as const

export type IzzyParagraphBlockV1 = {
  id: string
  type: 'paragraph'
  text: string
}

export type IzzyDocumentV1 = {
  schemaVersion: typeof IZZY_DOCUMENT_SCHEMA_VERSION
  id: string
  title: string
  blocks: IzzyParagraphBlockV1[]
}

export type LegacySessionScriptSnapshot = {
  content: string
  revision: number
  document?: IzzyDocumentV1
}

export type VersionedSessionDocumentSnapshot = {
  document: IzzyDocumentV1
  revision: number
}

type LegacyDocumentOptions = {
  documentId?: string
  title?: string
}

const DEFAULT_TITLE = 'Untitled script'

const hashString = (value: string) => {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36).padStart(7, '0')
}

const nonEmpty = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export const splitLegacyParagraphs = (content: string) =>
  normalizePlainText(content)
    .split(/\n{2}/)
    .map((part) => part.trim())
    .filter(Boolean)

export function createIzzyDocumentFromLegacyText(
  content: string,
  options: LegacyDocumentOptions = {},
): IzzyDocumentV1 {
  const normalizedContent = normalizePlainText(content)
  const documentId = nonEmpty(options.documentId, `doc_${hashString(normalizedContent)}`)
  const title = nonEmpty(options.title, DEFAULT_TITLE)

  return {
    schemaVersion: IZZY_DOCUMENT_SCHEMA_VERSION,
    id: documentId,
    title,
    blocks: splitLegacyParagraphs(normalizedContent).map((text, index) => ({
      id: `p_${index + 1}_${hashString(`${documentId}\u0000${index}\u0000${text}`)}`,
      type: 'paragraph',
      text,
    })),
  }
}

export function isIzzyDocumentV1(value: unknown): value is IzzyDocumentV1 {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== IZZY_DOCUMENT_SCHEMA_VERSION) return false
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') return false
  if (typeof candidate.title !== 'string' || candidate.title.trim() === '') return false
  if (!Array.isArray(candidate.blocks)) return false

  const blockIds = new Set<string>()

  for (const block of candidate.blocks) {
    if (!block || typeof block !== 'object') return false
    const paragraph = block as Record<string, unknown>
    if (paragraph.type !== 'paragraph') return false
    if (typeof paragraph.id !== 'string' || paragraph.id.trim() === '') return false
    if (typeof paragraph.text !== 'string') return false
    if (blockIds.has(paragraph.id)) return false
    blockIds.add(paragraph.id)
  }

  return true
}

export function serializeIzzyDocument(document: IzzyDocumentV1) {
  if (!isIzzyDocumentV1(document)) throw new TypeError('Invalid IZZY document')

  return JSON.stringify({
    schemaVersion: IZZY_DOCUMENT_SCHEMA_VERSION,
    id: document.id,
    title: document.title,
    blocks: document.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      text: block.text,
    })),
  })
}

export function deserializeIzzyDocument(serialized: string): IzzyDocumentV1 | null {
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!isIzzyDocumentV1(parsed)) return null

    return {
      schemaVersion: IZZY_DOCUMENT_SCHEMA_VERSION,
      id: parsed.id,
      title: parsed.title,
      blocks: parsed.blocks.map((block) => ({ ...block })),
    }
  } catch {
    return null
  }
}

export const izzyDocumentToLegacyText = (document: IzzyDocumentV1) => {
  if (!isIzzyDocumentV1(document)) throw new TypeError('Invalid IZZY document')
  return document.blocks.map((block) => block.text).join('\n\n')
}

export function legacySessionScriptToDocument(
  snapshot: LegacySessionScriptSnapshot,
  sessionId: string,
): VersionedSessionDocumentSnapshot {
  return {
    document: isIzzyDocumentV1(snapshot.document) ? snapshot.document : createIzzyDocumentFromLegacyText(snapshot.content, {
      documentId: `session_${sessionId}`,
    }),
    revision: snapshot.revision,
  }
}

export function izzyDocumentToLegacySessionScript(
  snapshot: VersionedSessionDocumentSnapshot,
): LegacySessionScriptSnapshot {
  return {
    content: izzyDocumentToLegacyText(snapshot.document),
    revision: snapshot.revision,
  }
}

