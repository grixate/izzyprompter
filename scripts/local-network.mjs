import { createServer } from 'node:net'

export async function portAvailable(port, host) {
  // macOS can allow an exact-address listener beside a wildcard listener.
  // Probe separately (not simultaneously) so our own probe cannot conflict.
  for (const address of new Set(['0.0.0.0', '127.0.0.1', host])) {
    const probe = createServer()
    await new Promise((done, reject) => {
      probe.once('error', () => reject(new Error(`Port ${port} is unavailable. Choose another with --port; no existing app was stopped.`)))
      probe.listen(port, address, done)
    })
    await new Promise((done) => probe.close(done))
  }
}
