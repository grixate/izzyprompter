import type { IzzyDocumentV1 } from '../domain/document'
import type { PromptSettingsV1 } from '../domain/storage'

export type Account = { id: string; email: string; pro: boolean }
export type AccountStatus = { enabled: boolean; google_enabled: boolean; csrf_token: string; user: Account | null }
export type ProjectFolder = { id: string; name: string; script_count: number }
export type SavedScript = { folder_id: string | null; id: string; title: string; document: IzzyDocumentV1; revision: number; deleted_at: string | null; updated_at: string; superseded_by?: SavedScript }
export type ScriptSummary = Omit<SavedScript, 'document' | 'superseded_by'> & { excerpt: string | null }
export type Preset = { id: string; name: string; settings: PromptSettingsV1; is_default: boolean }
export class AccountError extends Error {
  constructor(public reason: string, public status: number, public current?: SavedScript) { super(reason) }
}
let csrfToken = ''
let confirmedAccountId: string | undefined
let statusRequest: Promise<AccountStatus> | undefined
export async function accountApi<T>(route = '', method = 'GET', body?: unknown, expectedAccountId?: string): Promise<T> {
  if (route === '' && method === 'GET') {
    // The first anonymous status call creates the cookie/CSRF pair. Concurrent
    // initial requests must not race to install different cookie identities.
    statusRequest ??= request<AccountStatus>('', 'GET').finally(() => { statusRequest = undefined })
    return statusRequest as Promise<T>
  }
  if (method !== 'GET' && !csrfToken) await accountApi<AccountStatus>()
  const accountId = expectedAccountId ?? confirmedAccountId
  try { return await request<T>(route, method, body, accountId) }
  catch (error) {
    if (error instanceof AccountError && error.reason === 'request_403' && method !== 'GET') {
      await accountApi<AccountStatus>()
      return request<T>(route, method, body, accountId)
    }
    throw error
  }
}
async function request<T>(route: string, method: string, body?: unknown, expectedAccountId?: string): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`/api/account${route}`, { method, credentials: 'same-origin', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'x-csrf-token': csrfToken,
          ...(expectedAccountId ? { 'x-izzy-account-id': expectedAccountId } : {}) }) },
      body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await response.json().catch(() => { throw new AccountError(`request_${response.status}`, response.status) })
    if (!response.ok) throw new AccountError(data.reason ?? `request_${response.status}`, response.status, data.current)
    if (data.csrf_token) csrfToken = data.csrf_token
    if (route === '' && typeof data.enabled !== 'boolean') throw new AccountError('invalid_account_response', 502)
    if (route === '') confirmedAccountId = data.user?.id
    return data as T
  } finally { window.clearTimeout(timer) }
}
export const accountMessage = (error: unknown) => {
  const messages: Record<string, string> = {
    script_limit: 'Your free library holds three scripts. Move one to trash to make room. Your existing scripts stay editable and exportable.',
    session_active: 'This script has a live session. End it before starting another or moving the script to trash.',
    login_required: 'Please sign in again. Your unsent edits are kept on this device.',
    account_changed: 'This browser signed in to a different account. Your original draft is kept separately. Refresh before continuing.',
    invalid_token: 'This sign-in link has expired or was already used. Request a new link.',
    pro_required: 'Project folders and reading profiles are part of Lifetime Pro.',
    accounts_unavailable: 'Accounts are not configured on this server yet. Guest prompting still works.',
    payments_unavailable: 'Payments are not enabled yet.',
    payment_pending: 'An earlier checkout may still be payable. Check its status before opening another payment.',
    already_pro: 'Lifetime Pro is already active on your account.',
    not_found: 'This item was not found in your account.',
    save_in_progress: 'Another edit is being saved. Your draft is waiting.',
    editing_active: 'Quick Edit is active on the remote. Finish it before saving here.',
    mail_unavailable: 'We could not send the sign-in email. Please try again later.',
    rate_limited: 'Too many attempts. Please wait a minute before trying again.',
    invalid_folder: 'Use a project name between 1 and 200 characters.',
    invalid_email: 'Enter a valid email address.',
  }
  return error instanceof AccountError ? messages[error.reason] ?? 'The request could not be completed. Your text has not been discarded.'
    : 'Connection unavailable. Your changes will stay on this device.'
}
