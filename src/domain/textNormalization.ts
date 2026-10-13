export type ClipboardTextPayload = {
  plainText: string
  html?: string
}

export type TextSelectionReplacement = {
  value: string
  caret: number
}

const ZERO_WIDTH_FORMATTING = /[\u200B-\u200D\u2060\uFEFF]/g
const UNICODE_HORIZONTAL_WHITESPACE = /[\t\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]+/g
const TRAILING_LINE_WHITESPACE = / +$/gm
const LEADING_LINE_WHITESPACE = /^ +/gm

/**
 * Produces the canonical plain-text representation used by IZZY documents.
 * It intentionally preserves punctuation, Unicode letters, list markers, and
 * single line breaks inside a paragraph.
 */
export function normalizePlainText(input: string) {
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n\n')
    .replace(ZERO_WIDTH_FORMATTING, '')
    .replace(/\uFFFC/g, '')
    .replace(UNICODE_HORIZONTAL_WHITESPACE, ' ')
    .replace(TRAILING_LINE_WHITESPACE, '')
    .replace(LEADING_LINE_WHITESPACE, '')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .trim()
}

/**
 * Clipboard HTML is deliberately ignored. Browsers expose a text/plain form
 * for Word, Docs, Notion, ChatGPT, email clients, and normal websites; using
 * only that representation prevents foreign markup and styles from entering
 * the script model.
 */
export function normalizeClipboardPayload(payload: ClipboardTextPayload) {
  return normalizePlainText(payload.plainText)
}

export function replaceTextSelection(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
): TextSelectionReplacement {
  const start = Math.max(0, Math.min(selectionStart, currentValue.length))
  const end = Math.max(start, Math.min(selectionEnd, currentValue.length))
  const value = `${currentValue.slice(0, start)}${replacement}${currentValue.slice(end)}`

  return {
    value,
    caret: start + replacement.length,
  }
}
