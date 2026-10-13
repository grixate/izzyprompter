import type { SessionRole } from './protocol'

export type LifecycleEvent = 'visibility' | 'online' | 'offline' | 'pagehide' | 'pageshow' | 'freeze' | 'resume'
type Environment = { role: SessionRole; visible: boolean; online: boolean; persisted?: boolean }

/** Browser events are only lifecycle hints, not proof that a socket is healthy. */
export function lifecycleAction(event: LifecycleEvent, environment: Environment): 'suspend' | 'resume' | 'none' {
  if (event === 'offline' || event === 'pagehide' || event === 'freeze') return 'suspend'
  if (event === 'visibility' && !environment.visible) return environment.role === 'remote' ? 'suspend' : 'none'
  if (!environment.visible || !environment.online) return 'none'
  if (event === 'pageshow' && !environment.persisted) return 'none'
  return 'resume'
}
