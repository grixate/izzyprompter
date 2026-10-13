import { validContent } from './document.ts'
export type LocalEditorDraft = { version: 1; title: string; content: string; documentId: string | null; updatedAt: number }
const key = 'izzy.local-editor-draft'
export function loadLocalEditorDraft(): LocalEditorDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return value?.version === 1 && typeof value.title === 'string' && value.title.length <= 200 && validContent(value.content, true)
      && (value.documentId === null || (typeof value.documentId === 'string' && value.documentId.length <= 128))
      && Number.isFinite(value.updatedAt) ? value : null
  } catch { return null }
}
export function saveLocalEditorDraft(value: LocalEditorDraft): boolean {
  if (!validContent(value.content, true)) return false
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}
