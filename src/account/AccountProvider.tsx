import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { Socket } from 'phoenix'
import { accountApi, type AccountStatus } from './api'

const AccountContext = createContext<{ status: AccountStatus | null; loading: boolean; refresh: () => Promise<void> }>({ status: null, loading: true, refresh: async () => {} })
export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus | null>(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem('izzy:account-context') ?? 'null')
      return typeof cached?.user?.id === 'string' && typeof cached?.user?.email === 'string' ? cached : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try {
      const next = await accountApi<AccountStatus>()
      setStatus(next)
      try { if (next.user) sessionStorage.setItem('izzy:account-context', JSON.stringify({ ...next, csrf_token: '' })); else sessionStorage.removeItem('izzy:account-context') } catch { /* Offline identity hint is optional, never authority. */ }
    } catch { /* Preserve this tab's account scope for offline pending edits. */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void refresh()
    const focus = () => { void refresh() }
    window.addEventListener('online', focus)
    window.addEventListener('focus', focus)
    return () => { window.removeEventListener('online', focus); window.removeEventListener('focus', focus) }
  }, [refresh])
  const userId = status?.user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    let socket: Socket | null = null
    let retry: number | undefined
    let connecting = false
    const connect = async () => {
      if (!active || connecting || socket?.isConnected()) return
      connecting = true
      window.clearTimeout(retry)
      try {
        const ticket = await accountApi<{ ticket: string; user_id: string }>('/channel-ticket', 'POST', {})
        if (!active || ticket.user_id !== userId) return
        socket = new Socket('/account/socket', { params: { ticket: ticket.ticket }, reconnectAfterMs: () => 60_000 })
        socket.onClose(() => {
          if (active) {
            socket?.disconnect()
            retry = window.setTimeout(() => { void connect() }, 10_000)
          }
        })
        const channel = socket.channel(`account:${userId}`, {})
        channel.on('updated', () => { window.dispatchEvent(new Event('izzy:account-update')); void refresh() })
        channel.onClose(() => { if (active) void refresh() })
        socket.connect()
        channel.join().receive('error', () => { void refresh() })
      } catch { if (active) retry = window.setTimeout(() => { void connect() }, 30_000) }
      finally { connecting = false }
    }
    void connect()
    const online = () => { void connect() }
    window.addEventListener('online', online)
    window.addEventListener('focus', online)
    return () => { active = false; window.clearTimeout(retry); socket?.disconnect(); window.removeEventListener('online', online); window.removeEventListener('focus', online) }
  }, [userId, refresh])
  return <AccountContext value={{ status, loading, refresh }}>{children}</AccountContext>
}
export const useAccount = () => useContext(AccountContext)
