import { skinById } from './catalog'
export function safeReturnTo(value: string | null): string | null {
  if (value === '/pro') return value
  if (value === '/skins') return value
  if (value?.startsWith('/skins?skin=')) {
    const id = value.slice('/skins?skin='.length)
    if (skinById(id).id === id) return value
  }
  return null
}

const intentKey = 'izzy:purchase-return:v1'
export function rememberPurchaseReturn(target: string, accountId: string) {
  const safe = safeReturnTo(target)
  if (!safe) return
  try { sessionStorage.setItem(intentKey, JSON.stringify({ target: safe, accountId, expires: Date.now() + 86_400_000 })) } catch { /* Optional handoff. */ }
}
export function purchaseReturn(accountId: string): string | null {
  try {
    const intent = JSON.parse(sessionStorage.getItem(intentKey) ?? 'null')
    return intent?.accountId === accountId && intent.expires > Date.now() ? safeReturnTo(intent.target) : null
  } catch { return null }
}
