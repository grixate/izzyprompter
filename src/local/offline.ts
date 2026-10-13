export async function prepareOfflineApp(): Promise<void> {
  if (import.meta.env.DEV) throw new Error('Offline preparation requires the production build. Local prompting works in this open tab.')
  if (!window.isSecureContext || !('serviceWorker' in navigator)) throw new Error('Open IZZY over HTTPS to prepare it offline. Loopback is supported for development testing.')
  const registration = await navigator.serviceWorker.register('/local-sw.js', { scope: '/', updateViaCache: 'none' })
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('Preparation timed out. Keep this page open and retry.')), 15_000)),
  ])
  const expected = document.querySelector<HTMLMetaElement>('meta[name="izzy-offline-build"]')?.content
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline readiness check timed out. Retry preparation.')) }, 5000)
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close()
      if (event.data?.ready && event.data.build === expected) resolve()
      else reject(new Error('An app update is waiting or assets are missing. End your take, close all IZZY tabs, reopen and prepare again.'))
    }
    ready.active?.postMessage('izzy-offline-check', [channel.port2])
  })
  // A waiting update is left untouched until all clients have closed.
  void registration.update().catch(() => {})
  // Firefox may wait for a permission decision. Readiness must not wait with it.
  try { void navigator.storage?.persist?.().catch(() => {}) } catch { /* optional */ }
}
