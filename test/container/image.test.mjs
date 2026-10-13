import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { chromium } from '@playwright/test'

const exec = promisify(execFile)
const image = process.env.IZZY_CONTAINER_IMAGE || 'izzy:local'
const docker = async (args, options = {}) => (await exec('docker', args, { timeout: 30_000, maxBuffer: 1024 * 1024, ...options })).stdout.trim()
async function eventually(check, timeout = 45_000) {
  const deadline = Date.now() + timeout
  let last
  while (Date.now() < deadline) {
    try { return await check() } catch (error) { last = error }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw last
}
async function freePort() {
  const listener = createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const { port } = listener.address()
  await new Promise((done) => listener.close(done))
  return port
}

test('Linux container runs unprivileged, pairs and live-edits, loses sessions explicitly on restart, and stops cleanly', { timeout: 150_000 }, async () => {
  try { await docker(['info', '--format', '{{.ServerVersion}}']) } catch {
    throw new Error('Docker runtime unavailable. Start an installed Docker runtime, build izzy:local, then rerun npm run test:container. This check has not passed.')
  }
  // A fixed port lets this smoke test reach a remote Docker host through
  // an SSH local forward. By default, keep using a free local port.
  const port = process.env.IZZY_CONTAINER_PORT ? Number(process.env.IZZY_CONTAINER_PORT) : await freePort()
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'IZZY_CONTAINER_PORT must be a port from 1024 through 65535')
  const origin = `http://127.0.0.1:${port}`
  const secret = randomBytes(64).toString('base64')
  const name = `izzy-smoke-${randomBytes(8).toString('hex')}`
  let container, browser
  const external = [], sockets = []
  try {
    // docker create allocates an ID before startup. Only that exact owned ID
    // is stopped/removed, including if its chosen port loses a bind race.
    const created = await docker([
      'create', '--name', name, '--publish', `127.0.0.1:${port}:4000`,
      '--memory', '512m', '--cpus', '1', '--pids-limit', '256',
      '--health-interval', '2s', '--health-start-period', '5s',
      '--env', 'SECRET_KEY_BASE', '--env', `PUBLIC_ORIGIN=${origin}`, image,
    ], { env: { ...process.env, SECRET_KEY_BASE: secret } })
    assert.match(created, /^[a-f0-9]{64}$/)
    container = created
    await docker(['start', container])
    const ready = async () => {
      const response = await fetch(origin + '/health/ready', { signal: AbortSignal.timeout(1500) })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { status: 'ready' })
    }
    await eventually(ready)
    await eventually(async () => assert.equal(await docker(['inspect', '--format', '{{.State.Health.Status}}', container]), 'healthy'))
    assert.equal(await docker(['exec', container, 'id', '-u']), '10001')
    await docker(['exec', container, 'sh', '-c', '! command -v node && ! command -v npm && ! command -v mix && test -x bin/teleprompter && test ! -d /app/src && test ! -d /app/.git'])
    assert.deepEqual(await (await fetch(origin + '/api/network')).json(), { hosts: [] })
    const html = await (await fetch(origin)).text()
    assert.match(html, /IZZY — Browser Teleprompter/)
    const asset = html.match(/src="([^"]+\.js)"/)?.[1]
    assert.ok(asset)
    const response = await fetch(origin + asset)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /immutable/)
    assert.equal((await fetch(origin + '/assets/not-real.js')).status, 404)
    assert.equal((await fetch(origin + '/api/sessions', {
      method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol_version: 2, content: 'Must not be created', speed: 1 }),
    })).status, 403)

    browser = await chromium.launch()
    const editorContext = await browser.newContext()
    const displayContext = await browser.newContext({ viewport: { width: 768, height: 1024 } })
    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    for (const context of [editorContext, displayContext, phoneContext]) {
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).origin === origin) return route.continue()
        external.push(new URL(route.request().url()).origin)
        return route.abort('blockedbyclient')
      })
    }
    const [editor, display, phone] = await Promise.all([editorContext, displayContext, phoneContext].map((context) => context.newPage()))
    for (const page of [editor, display, phone]) page.on('websocket', (socket) => sockets.push(new URL(socket.url()).origin))
    await editor.goto(origin)
    const paragraph = 'A hosted tablet and phone session. '.repeat(45).trim()
    await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraph + '\n\nSecond paragraph.')
    await editor.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
    await eventually(async () => assert.equal((await editor.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
    const phoneLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
    for (const link of [displayLink, phoneLink]) {
      assert.equal(new URL(link).origin, origin)
      assert.match(new URL(link).hash, /^#key=[A-Za-z0-9_-]{43}$/)
    }
    await Promise.all([display.goto(displayLink), phone.goto(phoneLink)])
    await eventually(async () => assert.equal((await phone.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    await phone.getByRole('button', { name: 'Play', exact: true }).click()
    await eventually(async () => assert.ok(await display.locator('.script-track').evaluate((node) => -new DOMMatrixReadOnly(getComputedStyle(node).transform).m42) > 10))
    await phone.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    const correction = 'Live correction from the phone. ' + paragraph
    await phone.getByRole('textbox').fill(correction)
    await eventually(async () => assert.equal(await display.locator('.script-track p').first().textContent(), correction))
    await eventually(async () => assert.equal(await editor.locator('.pairing-live-edit p').textContent(), correction))
    await phone.getByRole('button', { name: /^DONE/ }).click()
    await phone.reload()
    await eventually(async () => assert.equal((await phone.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    assert.ok(sockets.length >= 3)
    assert.deepEqual([...new Set(sockets)], [origin.replace('http:', 'ws:')])
    assert.deepEqual(external, [])

    await docker(['restart', '--time', '10', container])
    await eventually(ready)
    await editor.getByRole('heading', { name: 'Session ended', exact: true }).waitFor({ timeout: 20_000 })
    await editor.getByRole('link', { name: /BACK TO SCRIPT/ }).click()
    assert.equal(await editor.getByRole('textbox', { name: 'Teleprompter script' }).inputValue(), correction + '\n\nSecond paragraph.')
    await phone.getByRole('heading', { name: 'Session ended', exact: true }).waitFor({ timeout: 20_000 })
    await docker(['stop', '--time', '10', container])
    assert.equal(await docker(['inspect', '--format', '{{.State.ExitCode}}', container]), '0')
    await assert.rejects(fetch(origin + '/health/ready', { signal: AbortSignal.timeout(1500) }))
  } finally {
    if (browser) await browser.close()
    if (container) await docker(['rm', '--force', container])
  }
})
