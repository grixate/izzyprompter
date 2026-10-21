import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { join, resolve } from 'node:path'
import { readdir, rename, mkdtemp, rm } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { networkInterfaces, tmpdir } from 'node:os'
import { chooseHost, localHosts } from '../../scripts/local-options.mjs'

const run = promisify(execFile)
async function buildRelease(env) {
  const directory = await mkdtemp(join(tmpdir(), 'izzy-release-test-'))
  const cleanup = () => rm(directory, { recursive: true, force: true })
  try {
    await run('mix', ['release', '--overwrite', '--path', directory], { cwd: resolve('api'), env, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
    return { directory, cleanup, executable: resolve(directory, 'bin/teleprompter') }
  } catch (error) { await cleanup(); throw error }
}
async function freePort() {
  const server = createServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((done) => server.close(done))
  return port
}
async function eventually(check) {
  const deadline = Date.now() + 25_000
  let last
  while (Date.now() < deadline) {
    try { await check(); return } catch (error) { last = error }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw last
}
async function stop(child, timeoutMs = 5000) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return
  const exit = once(child, 'exit')
  process.kill(-child.pid, 'SIGTERM')
  let timer
  await Promise.race([exit, new Promise((done) => { timer = setTimeout(done, timeoutMs) })])
  clearTimeout(timer)
  if (child.exitCode === null && child.signalCode === null) { process.kill(-child.pid, 'SIGKILL'); await exit }
}
async function rejectedSocket(origin, baseURL) {
  return new Promise((done, reject) => {
    const req = request(new URL('/socket/websocket?vsn=2.0.0&client_id=release-origin-check', baseURL), {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64'), Origin: origin },
    }, (response) => { response.resume(); done(response.statusCode) })
    req.on('upgrade', (_response, socket) => { socket.destroy(); reject(new Error('Foreign-origin socket was accepted')) })
    req.on('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error('Socket check timed out')))
    req.end()
  })
}

test('real production release serves SPA, API, and live editing on one origin without Vite', { timeout: 180_000 }, async () => {
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  const env = { ...process.env, MIX_ENV: 'prod', PHX_SERVER: 'true', IZZY_MODE: 'public', RELEASE_DISTRIBUTION: 'none', PUBLIC_ORIGIN: baseURL, PORT: String(port), SECRET_KEY_BASE: randomBytes(64).toString('base64') }
  delete env.IZZY_LAUNCH_ID
  Object.assign(env, { IZZY_MAX_SESSIONS: '2', IZZY_CREATE_PER_IP: '4', IZZY_CREATE_TOTAL: '10' })
  const release = await buildRelease(env)
  const child = spawn(release.executable, ['start'], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-6000) })
  child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-6000) })
  let browser
  try {
    await eventually(async () => {
      assert.equal(child.exitCode, null, output)
      const ready = await fetch(`${baseURL}/health/ready`, { signal: AbortSignal.timeout(1000) })
      assert.equal(ready.status, 200)
      assert.deepEqual(await ready.json(), { status: 'ready' })
    })
    for (const path of ['/', '/pro', '/skins', '/terms', '/privacy', '/privacy/', '/refunds', '/contact', '/display/ABC234', '/remote/ABC234', '/local', '/local/remote']) {
      const response = await fetch(baseURL + path)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
      assert.equal(response.headers.get('x-frame-options'), 'DENY')
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert.match(response.headers.get('permissions-policy'), /camera=\(\)/)
      const csp = response.headers.get('content-security-policy')
      assert.match(csp, /script-src 'self'(;|$)/)
      assert.match(csp, /frame-ancestors 'none'/)
      assert.match(csp, /object-src 'none'/)
      assert.match(csp, /worker-src 'self'/)
      assert.match(csp, /manifest-src 'self'/)
      assert.match(await response.text(), /id="root"/)
    }
    for (const path of ['/local-sw.js', '/manifest.webmanifest', '/offline-icon.svg',
      '/favicon.svg', '/favicon-16.png', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']) {
      const response = await fetch(baseURL + path)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-cache')
      assert.ok(!response.headers.get('content-type')?.includes('text/html'))
      if (path.endsWith('.png')) assert.match(response.headers.get('content-type'), /image\/png/)
      if (path.endsWith('.svg')) assert.match(response.headers.get('content-type'), /image\/svg\+xml/)
    }
    const html = await (await fetch(baseURL)).text()
    const jsPath = html.match(/src="([^"]+\.js)"/)[1]
    const asset = await fetch(baseURL + jsPath)
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('cache-control'), /immutable/)
    const bundle = await asset.text()
    assert.ok(!bundle.includes('127.0.0.1:4002/socket'))
    for (const path of ['/assets/missing.js', '/api/missing', '/unmatched']) {
      const response = await fetch(baseURL + path)
      assert.equal(response.status, 404)
      assert.ok(!response.headers.get('content-type')?.includes('text/html'))
    }
    assert.deepEqual(await (await fetch(`${baseURL}/api/network`)).json(), { hosts: [] })
    assert.equal((await fetch(`${baseURL}/api/sessions`, { method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol_version: 2, content: 'Rejected', speed: 1 }) })).status, 403)
    assert.equal(await rejectedSocket('https://foreign.example', baseURL), 403)

    browser = await chromium.launch()
    // Verify the cached local shell under real Phoenix CSP/static headers, with
    // account/session APIs and the entire origin unavailable at cold startup.
    const localContext = await browser.newContext()
    let local = await localContext.newPage()
    await local.goto(`${baseURL}/local`)
    await local.getByRole('heading', { name: 'Your words. Anywhere.' }).waitFor()
    if (await local.getByRole('button', { name: 'Set up Offline', exact: true }).isVisible()) await local.getByRole('button', { name: 'Set up Offline', exact: true }).click()
    await local.getByRole('textbox', { name: 'Local script title' }).fill('Production offline check')
    await local.getByRole('textbox', { name: 'Local script text' }).fill('A prepared script from the real bundled release.')
    await local.getByRole('button', { name: 'Save script offline' }).click()
    await local.getByRole('button', { name: 'Prepare app offline' }).click()
    await local.getByText('App available offline in this browser.', { exact: false }).waitFor()
    await localContext.setOffline(true)
    await local.close()
    local = await localContext.newPage()
    await local.goto(`${baseURL}/local`)
    await local.getByRole('heading', { name: 'Your words. Anywhere.' }).waitFor()
    if (await local.getByRole('button', { name: 'Set up Offline', exact: true }).isVisible()) await local.getByRole('button', { name: 'Set up Offline', exact: true }).click()
    await local.getByRole('button', { name: 'Production offline check', exact: true }).click()
    await local.getByRole('button', { name: 'Start local prompting' }).click()
    assert.equal(await local.locator('.script-track p').first().textContent(), 'A prepared script from the real bundled release.')
    await localContext.close()
    const editorContext = await browser.newContext(), displayContext = await browser.newContext(), phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const editor = await editorContext.newPage(), display = await displayContext.newPage(), remote = await phoneContext.newPage()
    const sockets = []
    for (const page of [editor, display, remote]) page.on('websocket', (socket) => sockets.push(new URL(socket.url())))
    const script = 'First production paragraph. '.repeat(40) + '\n\nSecond paragraph.'
    await editor.goto(baseURL)
    await editor.evaluate(() => {
      const injected = document.createElement('script')
      injected.textContent = 'window.__izzyInlineExecuted = true'
      document.body.append(injected)
    })
    assert.equal(await editor.evaluate(() => window.__izzyInlineExecuted), undefined)
    await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
    await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
    await eventually(async () => assert.equal((await editor.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
    const remoteLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
    assert.equal(new URL(displayLink).origin, baseURL)
    assert.equal(new URL(remoteLink).origin, baseURL)
    await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    await remote.reload()
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    await eventually(async () => assert.equal(await remote.getByRole('button', { name: 'Quick edit current paragraph' }).isEnabled(), true))
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill('Live from a bundled release. ' + script.split('\n\n')[0].trim())
    await eventually(async () => assert.ok((await display.locator('.script-track p').first().textContent()).startsWith('Live from a bundled release.')))
    await eventually(async () => assert.equal(await remote.getByRole('button', { name: /Done/i }).isEnabled(), true))
    await remote.getByRole('button', { name: /Done/i }).click()
    await display.reload()
    await eventually(async () => assert.ok((await display.locator('.script-track p').first().textContent()).startsWith('Live from a bundled release.')))
    assert.ok(sockets.length >= 3)
    assert.ok(sockets.every((url) => url.host === new URL(baseURL).host && url.pathname === '/socket/websocket'))

    // Exercise Cowboy's actual wire-size limit, not just a channel unit test.
    const closeCode = await editor.evaluate(() => new Promise((resolve, reject) => {
      const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/socket/websocket?vsn=2.0.0&client_id=oversize-wire-test`)
      const timer = setTimeout(() => { socket.close(); reject(new Error('Oversized socket did not close')) }, 5000)
      socket.onopen = () => socket.send('x'.repeat(3 * 1024 * 1024 + 1))
      socket.onclose = (event) => { clearTimeout(timer); resolve(event.code) }
      socket.onerror = () => { /* The close event carries the protocol result. */ }
    }))
    assert.equal(closeCode, 1009)

    // Creation limits do not interrupt an existing session. Oversized bodies
    // count as attempts too, before JSON parsing or new process allocation.
    const oversized = await fetch(`${baseURL}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol_version: 2, content: 'a'.repeat(3 * 1024 * 1024), speed: 1 }) })
    assert.equal(oversized.status, 413)
    const create = () => fetch(`${baseURL}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol_version: 2, content: 'Another session', speed: 1 }) })
    assert.equal((await create()).status, 201)
    const full = await create()
    assert.equal(full.status, 503)
    assert.equal(full.headers.get('cache-control'), 'no-store')
    assert.equal(full.headers.get('retry-after'), '30')
    assert.deepEqual(await full.json(), { reason: 'session_capacity' })
    const limited = await create()
    assert.equal(limited.status, 429)
    assert.ok(Number(limited.headers.get('retry-after')) > 0)
    assert.deepEqual(await limited.json(), { reason: 'rate_limited' })
    await remote.reload()
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await eventually(async () => assert.ok((await display.locator('.display-footer').textContent()).includes('ROLLING')))
    await remote.getByRole('button', { name: 'Pause', exact: true }).click()

    // Only mutate the generated release owned by this test, never development
    // assets. An incomplete deployment must fail readiness, not return blank UI.
    const lib = resolve(release.directory, 'lib')
    const app = (await readdir(lib)).find((name) => name.startsWith('teleprompter-'))
    const index = resolve(lib, app, 'priv/static/app/index.html')
    await rename(index, index + '.smoke-test')
    try {
      assert.equal((await fetch(`${baseURL}/health/ready`)).status, 503)
      assert.equal((await fetch(`${baseURL}/health/live`)).status, 200)
      const unavailable = await fetch(baseURL)
      assert.equal(unavailable.status, 503)
      assert.deepEqual(await unavailable.json(), { reason: 'app_unavailable' })
    } finally { await rename(index + '.smoke-test', index) }
    assert.equal((await fetch(`${baseURL}/health/ready`)).status, 200)
  } finally {
    await browser?.close()
    await stop(child)
    await release.cleanup()
  }
})

test('LAN launcher pairs from localhost to its network address, edits with external HTTP blocked, and stops only its own server', { timeout: 180_000 }, async () => {
  const host = chooseHost(null, localHosts(networkInterfaces()))
  const port = await freePort()
  const origin = `http://${host}:${port}`
  const loopback = `http://127.0.0.1:${port}`
  const env = { ...process.env, MIX_ENV: 'prod', IZZY_MODE: 'public', PUBLIC_ORIGIN: 'https://ignored.example', SECRET_KEY_BASE: randomBytes(64).toString('base64') }
  delete env.IZZY_LAUNCH_ID
  const release = await buildRelease(env)
  env.IZZY_RELEASE_DIR = release.directory
  const sentinel = (await import('node:http')).createServer((_req, response) => response.end('Unrelated server'))
  sentinel.listen(0, '0.0.0.0')
  await once(sentinel, 'listening')
  const sentinelPort = sentinel.address().port
  let child, browser
  try {
    const failure = await run(process.execPath, ['scripts/local.mjs', '--host', host, '--port', String(sentinelPort)], { cwd: process.cwd(), env, timeout: 10_000 }).then(() => null, (error) => error)
    assert.match(failure?.stderr ?? '', /Port .* is unavailable/)
    assert.equal(await (await fetch(`http://127.0.0.1:${sentinelPort}`)).text(), 'Unrelated server')
    child = spawn(process.execPath, ['scripts/local.mjs', '--host', host, '--port', String(port)], {
      cwd: process.cwd(), env: { ...env, PORT: '9999', SECRET_KEY_BASE: 'ignored', DNS_CLUSTER_QUERY: 'ignored.example' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-6000) })
    child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-6000) })
    await eventually(async () => { assert.equal(child.exitCode, null, output); assert.match(output, /IZZY LOCAL READY/) })
    assert.ok(output.includes(origin))
    const network = await (await fetch(`${loopback}/api/network`)).json()
    assert.equal(network.pairing_origin, origin)
    assert.equal((await fetch(`${loopback}/health/ready`)).status, 200)
    assert.equal(await rejectedSocket('https://foreign.example', loopback), 403)
    assert.equal((await fetch(`${loopback}/api/sessions`, { method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403)

    browser = await chromium.launch()
    const external = [], sockets = []
    const contexts = await Promise.all([1, 2, 3].map(() => browser.newContext({ serviceWorkers: 'block' })))
    for (const context of contexts) {
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url())
        if ([origin, loopback].includes(url.origin)) return route.continue()
        external.push(url.origin)
        return route.abort('internetdisconnected')
      })
    }
    const [editor, display, remote] = await Promise.all(contexts.map((context) => context.newPage()))
    for (const page of [editor, display, remote]) page.on('websocket', (socket) => sockets.push(new URL(socket.url())))
    const discovery = editor.waitForResponse((response) => new URL(response.url()).pathname === '/api/network')
    await editor.goto(loopback)
    await discovery
    const paragraph = 'Local network, no cloud relay. '.repeat(40).trim()
    await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraph + '\n\nSecond paragraph.')
    await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
    await eventually(async () => assert.equal((await editor.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
    const remoteLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
    assert.equal(new URL(displayLink).origin, origin)
    assert.equal(new URL(remoteLink).origin, origin)
    await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await eventually(async () => assert.ok((await display.locator('.display-footer').textContent()).includes('ROLLING')))
    await eventually(async () => assert.ok(await display.locator('.script-track').evaluate((element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42) > 20))
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill('Live LAN correction. ' + paragraph)
    await eventually(async () => assert.equal(await display.locator('.script-track p').first().textContent(), 'Live LAN correction. ' + paragraph))
    await eventually(async () => assert.equal(await editor.locator('.pairing-live-edit p').textContent(), 'Live LAN correction. ' + paragraph))
    await eventually(async () => assert.equal(await remote.getByRole('button', { name: /Done/i }).isEnabled(), true))
    await remote.getByRole('button', { name: /Done/i }).click()
    await remote.reload()
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    assert.deepEqual(external, [])
    assert.ok(sockets.length >= 3)
    assert.ok(sockets.every((url) => url.protocol === 'ws:' && url.port === String(port) && [host, '127.0.0.1'].includes(url.hostname)))
    await browser.close(); browser = null
    await stop(child, 8000)
    assert.equal(child.exitCode, 0)
    await eventually(async () => assert.rejects(fetch(`${loopback}/health/live`, { signal: AbortSignal.timeout(1000) })))
    assert.equal(await (await fetch(`http://127.0.0.1:${sentinelPort}`)).text(), 'Unrelated server')
  } finally {
    await browser?.close()
    if (child) await stop(child, 8000)
    await new Promise((done) => sentinel.close(done))
    await release.cleanup()
  }
})
