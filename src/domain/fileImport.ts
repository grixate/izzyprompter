import { normalizePlainText } from './textNormalization.ts'

export const MAX_SCRIPT_FILE_BYTES = 2 * 1024 * 1024
export const SUPPORTED_SCRIPT_EXTENSIONS = ['.txt', '.md'] as const

export type ScriptFileDescriptor = {
  name: string
  size: number
  type?: string
}

export type ScriptFileValidation =
  | { ok: true; title: string }
  | { ok: false; message: string }

export type PreparedScriptImport =
  | { ok: true; title: string; content: string }
  | { ok: false; message: string }

const fileExtension = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export function validateScriptFile(file: ScriptFileDescriptor): ScriptFileValidation {
  const extension = fileExtension(file.name)
  if (!SUPPORTED_SCRIPT_EXTENSIONS.includes(extension as '.txt' | '.md')) {
    return { ok: false, message: 'UNSUPPORTED FORMAT · USE .TXT OR .MD' }
  }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_SCRIPT_FILE_BYTES) {
    return { ok: false, message: 'FILE TOO LARGE · 2 MB MAX' }
  }

  const title = file.name.slice(0, -extension.length).trim()
  return { ok: true, title: title || 'Untitled script' }
}

export function prepareScriptImport(
  file: ScriptFileDescriptor,
  rawContent: string,
): PreparedScriptImport {
  const validation = validateScriptFile(file)
  if (!validation.ok) return validation

  const content = normalizePlainText(rawContent)
  if (!content) return { ok: false, message: 'NO READABLE TEXT IN FILE' }

  return {
    ok: true,
    title: validation.title,
    content,
  }
}
