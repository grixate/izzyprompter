import { useMemo, useSyncExternalStore } from 'react'
import type { SessionControllerView } from '../realtime/controller'
import type { CommandResult } from '../realtime/protocol'
import type { LocalSessionController } from './controller'

export function useLocalSession(controller: LocalSessionController): SessionControllerView {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const displaySettings = useMemo(() => state.display_settings
    ? { value: state.display_settings, revision: state.settings_revision ?? 0 } : null,
  [state.display_settings, state.settings_revision])
  return {
    ...state, connection: 'connected', clockOffset: 0, now: controller.now, path: 'local',
    sessionEpoch: state.session_epoch, displayId: state.display_id, connectionId: state.connection_id,
    displaySettings,
    send: controllerSend(controller), request: controllerRequest(controller), reconnect: () => {},
  }
}

// Stable callbacks matter to the display's layout/checkpoint effects.
const callbacks = new WeakMap<LocalSessionController, {
  send: SessionControllerView['send']; request: SessionControllerView['request']
}>()
function functions(controller: LocalSessionController) {
  let value = callbacks.get(controller)
  if (!value) {
    value = {
      send: (event, payload) => controller.execute(event, payload).ok,
      request: async <T,>(event: string, payload?: Record<string, unknown>) => controller.execute(event, payload) as CommandResult<T>,
    }
    callbacks.set(controller, value)
  }
  return value
}
const controllerSend = (controller: LocalSessionController) => functions(controller).send
const controllerRequest = (controller: LocalSessionController) => functions(controller).request
