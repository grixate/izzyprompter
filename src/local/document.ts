import { isIzzyDocumentV1, izzyDocumentToLegacyText, type IzzyDocumentV1 } from '../domain/document.ts'
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
  return Number.isFinite(s.speed) && s.speed >= .5 && s.speed <= 1.5
    && Number.isFinite(s.fontSize) && s.fontSize >= 20 && s.fontSize <= 160
    && Number.isFinite(s.lineHeight) && s.lineHeight >= .8 && s.lineHeight <= 3
    && Number.isFinite(s.textWidth) && s.textWidth >= 25 && s.textWidth <= 100 && typeof s.mirrored === 'boolean'
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
