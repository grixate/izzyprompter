import { spawn } from 'node:child_process'
import { access, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chooseHost, localHosts, parseOptions } from './local-options.mjs'
import { portAvailable } from './local-network.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

async function main() {
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log('IZZY local server\n\nnpm run local -- [--host PRIVATE_IP] [--port 4174] [--open|--no-open]\n\nBuild once beforehand: npm run build:local\nNo downloads/builds happen during local startup. macOS/Linux; Node.js required unless using the portable Mac package.\nUse only on a trusted local network. Stop with Ctrl+C.')
    return
  }
  if (!['darwin', 'linux'].includes(process.platform)) throw new Error('This launcher currently supports macOS and Linux; Windows packaging is not implemented.')
  const hosts = localHosts(networkInterfaces())
  const host = chooseHost(options.host, hosts)
  const release = process.env.IZZY_RELEASE_DIR
    ? resolve(process.env.IZZY_RELEASE_DIR)
    : resolve(root, 'api/_build/prod/rel/teleprompter')
  const executable = resolve(release, 'bin/teleprompter')
  try {
    await access(executable, constants.X_OK)
    const app = (await readdir(resolve(release, 'lib'))).find((name) => name.startsWith('teleprompter-'))
    if (!app) throw new Error('Missing application')
    await access(resolve(release, 'lib', app, 'priv/static/app/index.html'))
  } catch { throw new Error('The local build is missing. Run npm run build:local before going offline. No download or build was attempted.') }
  await portAvailable(options.port, host)
  const origin = `http://${host}:${options.port}`
  const launchId = randomBytes(32).toString('hex')
  const child = spawn(executable, ['start'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PHX_SERVER: 'true', IZZY_MODE: 'lan', PUBLIC_ORIGIN: origin, PORT: String(options.port),
      SECRET_KEY_BASE: randomBytes(64).toString('base64'), IZZY_LAUNCH_ID: launchId, RELEASE_DISTRIBUTION: 'none', DNS_CLUSTER_QUERY: '' },
  })
  let diagnostics = '', exited = null, stopping = false, forceTimer
  const append = (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-6000) }
  child.stdout.on('data', append)
  child.stderr.on('data', append)
  const finished = new Promise((done) => {
    child.once('exit', (code, signal) => { exited = { code, signal }; done(exited) })
    child.once('error', (error) => { exited = { code: 1, error }; done(exited) })
  })
  const shutdown = () => {
    if (stopping || exited) return
    stopping = true
    // Only this launcher's detached child group. Never kill by port/name.
    try { process.kill(-child.pid, 'SIGTERM') } catch { return }
    forceTimer = setTimeout(() => { if (!exited) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* already stopped */ } } }, 5000)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)
  try {
    const deadline = Date.now() + 25_000
    let ready = false
    while (Date.now() < deadline && !exited && !stopping) {
      try {
        const response = await fetch(`http://127.0.0.1:${options.port}/health/ready`, { signal: AbortSignal.timeout(1000) })
        // A port race must never mistake another app for our child server.
        ready = response.ok && response.headers.get('x-izzy-instance') === launchId
        if (ready) break
      } catch { /* waiting for this release to boot */ }
      await delay(100)
    }
    if (stopping) return
    if (!ready) throw new Error(`Local server could not become ready. ${exited?.error?.message ?? diagnostics}`)
    console.log(`\nIZZY LOCAL READY\n\nOpen IZZY: ${origin}/\nKeep the computer awake. Stop with Ctrl+C.\nTrusted LAN only: HTTP is not encrypted. No cloud relay is used.`)
    if (host === '127.0.0.1') console.log('\nNo reachable private network address selected. Phone pairing is unavailable; join Wi-Fi and restart.')
    else console.log('\nPhone: join the same Wi-Fi, then scan the QR inside IZZY.')
    if (hosts.length > 1) console.log(`\nOther detected addresses: ${hosts.filter((address) => address !== host).join(', ')}\nIf pairing fails, restart with --host ADDRESS. VPN/guest Wi-Fi/firewalls may block access.`)
    if (options.open ?? process.env.IZZY_OPEN_BROWSER === '1') {
      // Best-effort OS action after *this* instance becomes ready, no shell.
      const opener = spawn(process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open', [origin + '/'], { stdio: 'ignore' })
      opener.once('error', () => console.error('Browser could not open. Use the address above; IZZY is still running.'))
      opener.once('exit', (code) => { if (code) console.error('Browser could not open. Use the address above; IZZY is still running.') })
      opener.unref()
    }
    const result = await finished
    if (!stopping) throw new Error(`Local server stopped unexpectedly (${result.code ?? result.signal}). ${diagnostics}`)
  } finally {
    shutdown()
    await finished
    clearTimeout(forceTimer)
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    process.off('SIGHUP', shutdown)
  }
}

main().catch((error) => { console.error(`IZZY: ${error.message}`); process.exitCode = 1 })
