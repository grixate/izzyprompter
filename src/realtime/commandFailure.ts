// A refusal is not a broken socket. Never reconnect just to bypass a budget,
// and never queue a rejected gesture or edit for automatic replay.
export function commandFailureAction(reason: string): 'terminal' | 'recover' | 'ignore' {
  if (['session_unavailable', 'unauthorized', 'session_limit'].includes(reason)) return 'terminal'
  if (['stale_reading', 'stale_command', 'editing_active', 'reading_unavailable', 'pause_required', 'edit_not_owned', 'edit_conflict', 'invalid_block', 'invalid_patch', 'rate_limited', 'payload_too_large', 'invalid_command', 'invalid_or_stale_script', 'forbidden', 'unknown_event'].includes(reason)) return 'ignore'
  return 'recover'
}

export function commandRetryDelay(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(2000, Math.max(50, value)) : 250
}
