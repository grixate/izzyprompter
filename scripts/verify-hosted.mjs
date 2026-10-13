import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Explicit opt-in is required to create a synthetic session on production.
const origin = process.env.IZZY_SMOKE_ORIGIN || 'https://staging.izzyprompter.com'
const staging = origin === 'https://staging.izzyprompter.com'
assert.ok(staging || (origin === 'https://izzyprompter.com' && process.env.IZZY_VERIFY_PRODUCTION === '1'),
  'Use the staging origin, or explicitly set IZZY_VERIFY_PRODUCTION=1 for production')
const credentials = staging
  ? JSON.parse(await readFile(process.env.IZZY_STAGING_CREDENTIALS || join(homedir(), '.ssh/izzy_staging_access.json'), 'utf8'))
  : undefined
const browser = await chromium.launch()
try {
  const options = credentials ? { httpCredentials: { username: credentials.username, password: credentials.password } } : {}
  const contexts = await Promise.all([
    browser.newContext(options),
    browser.newContext({ ...options, viewport: { width: 768, height: 1024 } }),
    browser.newContext({ ...options, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }),
  ])
  const [editor, display, phone] = await Promise.all(contexts.map(context => context.newPage()))
  const errors = [], sockets = []
  for (const page of [editor, display, phone]) {
    page.on('pageerror', error => errors.push(error.message))
    page.on('websocket', socket => sockets.push(new URL(socket.url()).origin))
  }
  if (staging) {
    const anonymous = await browser.newContext()
    for (const path of ['/', '/health/ready', '/local-sw.js', '/api/account/']) {
      assert.equal((await anonymous.request.get(origin + path)).status(), 401, 'Staging must require authentication')
    }
    const deniedSocket = await anonymous.request.get(origin + '/socket/websocket?vsn=2.0.0', {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' },
    })
    assert.equal(deniedSocket.status(), 401, 'Anonymous WebSocket handshake must be blocked')
    await anonymous.close()
  }
  assert.equal((await contexts[0].request.get(origin + '/health/ready')).status(), 200)
  const response = await editor.goto(origin)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['strict-transport-security'], /max-age=31536000/)
  if (staging) assert.match(response.headers()['x-robots-tag'], /noindex/)
  const account = await editor.evaluate(async () => {
    const value = await (await fetch('/api/account/')).json()
    return { enabled: value.enabled, google: value.google_enabled, user: value.user }
  })
  assert.deepEqual(account, { enabled: false, google: false, user: null })
  const paragraph = 'Hosted release verification with synthetic text. '.repeat(45).trim()
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraph + '\n\nSecond verification paragraph.')
  await editor.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED', { timeout: 20_000 })
  const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
  const phoneLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
  for (const link of [displayLink, phoneLink]) {
    assert.equal(new URL(link).origin, origin, 'Pairing must stay on the selected environment')
    assert.match(new URL(link).hash, /^#key=[A-Za-z0-9_-]{43}$/)
  }
  await Promise.all([display.goto(displayLink), phone.goto(phoneLink)])
  await expect(phone.locator('.network-state')).toHaveText('CONNECTED', { timeout: 20_000 })
  await phone.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => display.locator('.script-track').evaluate(node =>
    -new DOMMatrixReadOnly(getComputedStyle(node).transform).m42), { timeout: 15_000 }).toBeGreaterThan(10)
  await phone.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  const correction = 'Verified secure phone correction. ' + paragraph
  await phone.getByRole('textbox').fill(correction)
  await expect(display.locator('.script-track p').first()).toHaveText(correction, { timeout: 15_000 })
  await expect(editor.locator('.pairing-live-edit p')).toHaveText(correction, { timeout: 15_000 })
  await phone.getByRole('button', { name: /^DONE/ }).click()
  await phone.reload()
  await expect(phone.locator('.network-state')).toHaveText('CONNECTED', { timeout: 20_000 })
  await display.reload()
  await expect(display.locator('.script-track p').first()).toHaveText(correction, { timeout: 15_000 })
  const refused = await contexts[0].request.post(origin + '/api/sessions', {
    headers: { Origin: 'https://foreign.example' },
    data: { protocol_version: 2, content: 'Must be refused', speed: 1 },
  })
  assert.equal(refused.status(), 403)
  assert.ok(sockets.length >= 3)
  assert.deepEqual([...new Set(sockets)], [origin.replace('https:', 'wss:')])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ origin, result: 'passed', authenticatedStaging: staging,
    checks: ['health', 'guest-only mode', 'pairing', 'secure sockets', 'playback', 'live edits', 'reload', 'foreign-origin refusal'], browserErrors: 0 }, null, 2))
} catch (error) {
  let message = String(error.stack || error).replace(/#key=[A-Za-z0-9_-]+/g, '#key=[redacted]')
  if (credentials) message = message.replaceAll(credentials.password, '[redacted]')
  console.error(message)
  process.exitCode = 1
} finally {
  await browser.close()
}
