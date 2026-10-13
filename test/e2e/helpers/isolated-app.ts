import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

async function freePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No isolated test port')
  const port = address.port
  await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()))
  return port
}

function launch(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const process = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let error: Error | null = null
  process.stdout?.on('data', (chunk) => { output = (output + chunk.toString()).slice(-6000) })
  process.stderr?.on('data', (chunk) => { output = (output + chunk.toString()).slice(-6000) })
  process.on('error', (failure) => { error = failure })
  return { process, diagnostics: () => error?.message ?? output }
}

async function ready(url: string, child: ReturnType<typeof launch>) {
  const deadline = Date.now() + 25_000
  while (Date.now() < deadline) {
    if (child.process.exitCode !== null || child.process.signalCode !== null) throw new Error(`Isolated app exited: ${child.diagnostics()}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* starting */ }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Isolated app did not start: ${child.diagnostics()}`)
}

async function stop(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise<void>((done) => child.once('exit', () => done()))
  // This is exactly the detached process group created above, never a shared
  // development server or an arbitrary process found by port/name.
  try { process.kill(-child.pid, 'SIGTERM') } catch { return }
  let timeout: ReturnType<typeof setTimeout>
  await Promise.race([exited, new Promise<void>((done) => { timeout = setTimeout(done, 5000) })])
  clearTimeout(timeout!)
  if (child.exitCode === null && child.signalCode === null) {
    process.kill(-child.pid, 'SIGKILL')
    await exited
  }
}

/** Real process restart coverage, isolated from the shared E2E and dev apps. */
export async function isolatedApp() {
  const apiPort = await freePort()
  let webPort = await freePort()
  while (webPort === apiPort) webPort = await freePort()
  const root = process.cwd()
  const baseURL = `http://127.0.0.1:${webPort}`
  const apiEnv = { ...process.env, MIX_ENV: 'test', PHX_SERVER: 'true', TELEPROMPTER_TEST_PORT: String(apiPort), TELEPROMPTER_TEST_WEB_PORT: String(webPort) }
  const startApi = () => launch('mix', ['phx.server'], resolve(root, 'api'), apiEnv)
  let api = startApi()
  const web = launch(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], root,
    { ...process.env, VITE_SOCKET_URL: `ws://127.0.0.1:${apiPort}/socket`, IZZY_API_PROXY: `http://127.0.0.1:${apiPort}` })
  const close = async () => { await Promise.all([stop(api.process), stop(web.process)]) }
  try {
    await Promise.all([ready(`http://127.0.0.1:${apiPort}/api/network`, api), ready(baseURL, web)])
  } catch (error) {
    await close()
    throw error
  }
  return {
    baseURL, close,
    stopApi: () => stop(api.process),
    startApi: async () => {
      api = startApi()
      await ready(`http://127.0.0.1:${apiPort}/api/network`, api)
    },
  }
}
