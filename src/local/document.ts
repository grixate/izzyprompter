import {MIN_SPEED, LEGACY_MAX_SPEED} from '../prompt/speed.ts'
import { createIzzyDocumentFromLegacyText, isIzzyDocumentV1, izzyDocumentToLegacyText, type IzzyDocumentV1 } from '../domain/document.ts'
import type { PromptSettingsV1 } from '../domain/storage.ts'
import type { ReadingAnchor } from '../prompt/position.ts'

export const MAX_SCRIPT_BYTES = 2 * 1024 * 1024
export const bytes = (text: string) => new TextEncoder().encode(text).byteLength
export function validContent(text: unknown, allowEmpty = false): text is string {
  return typeof text === 'string' && !text.includes('\0') && bytes(text) <= MAX_SCRIPT_BYTES
    && (allowEmpty || Boolean(text.trim())) && text.split(/\n\s*\n/).length <= 5000
}
export function validDocument(value: unknown): value is IzzyDocumentV1 {
  return isIzzyDocumentV1(value) && value.id.length <= 128 && value.title.length <= 200
    && value.blocks.length > 0 && value.blocks.length <= 5000 && value.blocks.every(b => b.id.length <= 128)
    && validContent(izzyDocumentToLegacyText(value), true)
}
export function validAnchor(document: IzzyDocumentV1, value: unknown): value is ReadingAnchor {
  if (!value || typeof value !== 'object') return false
  const anchor = value as ReadingAnchor
  const block = document.blocks.find(b => b.id === anchor.blockId)
  return Boolean(block && Number.isInteger(anchor.characterOffset) && anchor.characterOffset >= 0 && anchor.characterOffset <= block.text.length)
}
export function validSettings(value: unknown): value is PromptSettingsV1 {
  if (!value || typeof value !== 'object') return false
  const s = value as PromptSettingsV1
  return Number.isFinite(s.speed) && s.speed >= MIN_SPEED && s.speed <= LEGACY_MAX_SPEED
    && Number.isFinite(s.fontSize) && s.fontSize >= 20 && s.fontSize <= 160
    && Number.isFinite(s.lineHeight) && s.lineHeight >= .8 && s.lineHeight <= 3
    && Number.isFinite(s.textWidth) && s.textWidth >= 25 && s.textWidth <= 100 && typeof s.mirrored === 'boolean'
}

export function replaceDocument(document: IzzyDocumentV1, text: string, anchor: ReadingAnchor) {
  const freshId = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')
  const fresh = createIzzyDocumentFromLegacyText(text, { documentId: document.id, title: document.title }).blocks
  if (!fresh.length) fresh.push({ id: freshId(), type: 'paragraph', text: '' })
  const available = new Map<string, string[]>()
  for (const block of document.blocks) { const ids = available.get(block.text) ?? []; ids.push(block.id); available.set(block.text, ids) }
  const cursors = new Map<string, number>()
  const matches = fresh.map(block => { const index = cursors.get(block.text) ?? 0; cursors.set(block.text, index + 1); return { block, id: available.get(block.text)?.[index] } })
  const reserved = new Set(matches.flatMap(match => match.id ? [match.id] : []))
  const blocks = matches.map(({ block, id }, index) => {
    const old = document.blocks[index]
    const nextId = id ?? (old && !reserved.has(old.id) ? old.id : freshId())
    reserved.add(nextId)
    return { ...block, id: nextId }
  })
  const oldIndex = Math.max(0, document.blocks.findIndex(block => block.id === anchor.blockId))
  const old = document.blocks[oldIndex], target = blocks.find(block => block.id === anchor.blockId)
  return { document: { ...document, blocks }, anchor: target && old
    ? { blockId: target.id, characterOffset: remapOffset(old.text, target.text, anchor.characterOffset) }
    : { blockId: blocks[Math.min(oldIndex, blocks.length - 1)].id, characterOffset: 0 } }
}
/** DOM offsets are UTF-16, matching Phoenix Document.remap_offset. */
export function remapOffset(oldText: string, newText: string, offset: number) {
  let prefix = 0
  while (prefix < Math.min(oldText.length, newText.length) && oldText[prefix] === newText[prefix]) prefix++
  let suffix = 0
  while (suffix < Math.min(oldText.length, newText.length) - prefix
    && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++
  const oldEnd = oldText.length - suffix, newEnd = newText.length - suffix
  if (offset === prefix && oldEnd === prefix) return newEnd
  if (offset <= prefix) return Math.min(offset, newText.length)
  if (offset >= oldEnd) return Math.max(0, Math.min(newText.length, offset + newText.length - oldText.length))
  return Math.min(offset, newEnd)
}
