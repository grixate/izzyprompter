import { useEffect, useState } from 'react'
import { preferredSkin, saveSkin, skinById, type SkinId } from './catalog'
import { capabilityFromHash } from '../realtime/credentials'
import { accountApi, type AccountStatus } from '../account/api'

async function verifiedGrant(sessionId: string, signal: AbortSignal) {
  const key = capabilityFromHash(location.hash)
  if (key) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/appearance`, { headers: { Authorization: `Bearer ${key}` }, signal })
      if (response.ok && (await response.json()).pro === true) return true
    } catch { /* The remote may also have its own signed-in account. */ }
  }
  try { return (await accountApi<AccountStatus>()).user?.pro === true } catch { return false }
}

export function useRemoteAppearance(sessionId: string, connected: boolean) {
  const [desired, setDesired] = useState(preferredSkin)
  const [pro, setPro] = useState(false)
  const local = sessionId === 'LOCAL' || sessionId === 'DIRECT'
  useEffect(() => {
    const update = () => setDesired(preferredSkin())
    window.addEventListener('storage', update); window.addEventListener('izzy:skin-change', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('izzy:skin-change', update) }
  }, [])
  useEffect(() => {
    if (local || !connected) { setPro(false); return }
    let active = true, inFlight = false
    let controller: AbortController | undefined
    const load = async () => {
      if (inFlight || document.visibilityState === 'hidden') return
      inFlight = true
      controller = new AbortController()
      const timer = window.setTimeout(() => controller?.abort(), 8000)
      let allowed = false
      try {
        allowed = await verifiedGrant(sessionId, controller.signal)
      } catch { /* No verified grant means the polished free finish. */ }
      finally { clearTimeout(timer); if (active) setPro(allowed); inFlight = false }
    }
    void load()
    const timer = window.setInterval(load, 60_000)
    window.addEventListener('focus', load); document.addEventListener('visibilitychange', load)
    return () => { active = false; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load) }
  }, [sessionId, connected, local])
  const skin: SkinId = !skinById(desired).pro || pro ? desired : 'original'
  const apply = async (id: SkinId) => {
    if (skinById(id).pro) {
      if (local || !connected) return false
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 8000)
      const allowed = await verifiedGrant(sessionId, controller.signal).finally(() => clearTimeout(timer))
      setPro(allowed)
      if (!allowed) return false
    }
    const ok = saveSkin(id); if (ok) setDesired(id); return ok
  }
  return { skin, pro, apply, local }
}
