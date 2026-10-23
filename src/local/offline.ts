async function verifyWorker(worker: ServiceWorker): Promise<void> {
  const expected = document.querySelector<HTMLMetaElement>('meta[name="izzy-offline-build"]')?.content
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline readiness check timed out. Retry preparation.')) }, 5000)
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close()
      if (event.data?.ready && expected && event.data.build === expected) resolve()
      else reject(new Error('An app update is waiting or assets are missing. End your take, close all IZZY tabs, reopen and prepare again.'))
    }
    worker.postMessage('izzy-offline-check', [channel.port2])
  })
}

export async function checkOfflineApp(): Promise<boolean> {
  if (import.meta.env.DEV || !window.isSecureContext || !('serviceWorker' in navigator)) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration?.active) return false
    await verifyWorker(registration.active)
    return true
  } catch { return false }
}

let preparation: Promise<void> | null = null
export function prepareOfflineApp(): Promise<void> {
  // React StrictMode and multiple preparation surfaces share one installation.
  if (!preparation) preparation = installOfflineApp().finally(() => { preparation = null })
  return preparation
}

async function installOfflineApp(): Promise<void> {
  if (import.meta.env.DEV) throw new Error('Offline preparation requires the production build. Local prompting works in this open tab.')
  if (!window.isSecureContext || !('serviceWorker' in navigator)) throw new Error('Open IZZY over HTTPS to prepare it offline. Loopback is supported for development testing.')
  const registration = await navigator.serviceWorker.register('/local-sw.js', { scope: '/', updateViaCache: 'none' })
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('Preparation timed out. Keep this page open and retry.')), 15_000)),
  ])
  if (!ready.active) throw new Error('The offline app is not ready. Please try preparation again.')
  await verifyWorker(ready.active)
  // A waiting update is left untouched until all clients have closed.
  void registration.update().catch(() => {})
  // Do not prompt for optional persistent-storage permission on route entry.
  // Browser data can still be cleared; the workspace offers a text backup.
}
