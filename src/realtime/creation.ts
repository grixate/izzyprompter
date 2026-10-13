export function creationFailure(status: number, reason: unknown, retryAfter: string | null) {
  if (status === 429) {
    const parsed = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 60
    const retrySeconds = Math.min(300, Math.max(1, parsed || 60))
    return { retrySeconds, message: `TOO MANY START ATTEMPTS · RETRY IN ${retrySeconds}S · SCRIPT KEPT IN THIS TAB` }
  }
  if (status === 503 && reason === 'session_capacity') return { retrySeconds: 0, message: 'SERVER IS FULL · TRY AGAIN LATER · SCRIPT KEPT IN THIS TAB' }
  if (status === 413) return { retrySeconds: 0, message: 'REQUEST TOO LARGE · REDUCE SCRIPT SIZE · SCRIPT KEPT IN THIS TAB' }
  if (status === 422) return { retrySeconds: 0, message: 'SCRIPT TOO LARGE OR INVALID · 2 MB / 5,000 PARAGRAPHS MAX' }
  return null
}
