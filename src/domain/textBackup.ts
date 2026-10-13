// Explicit user actions only. Backups contain plain script text, never pairing keys.
export function downloadScript(text: string, filename = 'izzy-script.txt') {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string, field?: HTMLTextAreaElement | null) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* A denied clipboard still permits the selection fallback. */ }
  const previous = document.activeElement
  const selection = field ? [field.selectionStart, field.selectionEnd] : null
  const target = field ?? document.createElement('textarea')
  if (!field) {
    target.value = text
    target.style.position = 'fixed'
    target.style.opacity = '0'
    document.body.appendChild(target)
  }
  target.focus()
  target.select()
  let copied = false
  try { copied = document.execCommand('copy') } catch { /* Offer manual copying. */ }
  if (!field) target.remove()
  if (copied && field && selection) field.setSelectionRange(selection[0], selection[1])
  if ((copied || !field) && previous instanceof HTMLElement) previous.focus()
  return copied
}
