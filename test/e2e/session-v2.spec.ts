import { test, expect, type Page } from '@playwright/test'
import { phoneOptions } from './helpers/phone'

const script = 'Camera ready. '.repeat(80).trim() + '\n\n' + 'Keep speaking naturally. '.repeat(80).trim()
async function createSession(editor: Page) {
  await editor.goto('/')
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
  return {
    display: (await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href'))!,
    remote: (await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!,
  }
}

test('pairing is role-bound and editor refresh preserves the same live session', async ({ page: editor, browser }) => {
  const links = await createSession(editor)
  expect(new URL(links.remote).search).toBe('')
  expect(new URL(links.remote).hash).not.toBe(new URL(links.display).hash)
  await editor.reload()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
  await expect(editor.getByRole('link', { name: /OPEN REMOTE/ })).toHaveAttribute('href', links.remote)
  const context = await browser.newContext()
  const guest = await context.newPage()
  try {
    await guest.goto(links.remote.split('#')[0])
    await expect(guest.getByRole('heading', { name: 'Pairing link required' })).toBeVisible()
    await expect(guest.locator('.transport-button')).toBeDisabled()
    await expect.poll(() => guest.getByRole('alertdialog').evaluate((node) => node.matches(':modal'))).toBe(true)
    // Supplying a valid key on the same path must work even when navigation
    // only changes the fragment and does not reload the React application.
    await guest.goto(links.remote)
    await expect(guest.locator('.network-state')).toHaveText('CONNECTED')
    // A remote capability cannot claim the editor or display role.
    await guest.goto(links.display.split('#')[0] + new URL(links.remote).hash)
    await expect(guest.locator('.network-state')).toHaveText('UNAUTHORIZED')
    await guest.goto(links.remote)
    await expect(guest.locator('.network-state')).toHaveText('CONNECTED')
  } finally { await context.close() }
})

test('phone network loss disables commands while display continues and rejoin restores state', async ({ page: editor, browser, browserName }) => {
  const links = await createSession(editor)
  const displayContext = await browser.newContext()
  const remoteContext = await browser.newContext(phoneOptions(browserName))
  const display = await displayContext.newPage()
  const remote = await remoteContext.newPage()
  const position = () => display.locator('.script-track').evaluate((element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)
  try {
    await Promise.all([display.goto(links.display), remote.goto(links.remote)])
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(display.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('ROLLING')
    const before = await position()
    await remoteContext.setOffline(true)
    await expect(remote.locator('.network-state')).toHaveText(/OFFLINE|RECONNECTING/)
    await expect(remote.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
    await expect(remote.getByRole('button', { name: 'Increase speed' })).toBeDisabled()
    await expect.poll(position).toBeGreaterThan(before + 20)
    await display.locator('body').press('+')
    await expect(display.locator('.display-footer')).toContainText('0.91×')
    await remoteContext.setOffline(false)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.91')
    await expect(remote.locator('.state-label')).toHaveText('RUN')
    await remote.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    await remote.reload()
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.locator('.state-label')).toHaveText('HOLD')
  } finally {
    await displayContext.close()
    await remoteContext.close()
  }
})

test('missing sessions explain recovery without recreating empty state or losing the draft', async ({ page }, testInfo) => {
  await createSession(page)
  await page.goto('/remote/ZZZZZZ#key=' + 'a'.repeat(43))
  await expect(page.getByRole('heading', { name: 'Session ended' })).toBeVisible()
  await expect(page.locator('.network-state')).toHaveText('EXPIRED')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('session-ended-phone.png') })
  await page.getByRole('link', { name: /BACK TO SCRIPT/ }).click()
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script.trim())
})

test('creation failure preserves the script and offers an explicit retry', async ({ page }) => {
  await page.route('**/api/sessions', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"reason":"session_unavailable"}' }))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.getByRole('status')).toContainText('SESSION COULD NOT START')
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script.trim())
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeEnabled()
  await page.unroute('**/api/sessions')
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.locator('.network-state')).toHaveText('CONNECTED')
})

test('rate-limited creation keeps the draft and enables an explicit retry after cooldown', async ({ page }) => {
  await page.route('**/api/sessions', (route) => route.fulfill({ status: 429, contentType: 'text/html', headers: { 'retry-after': '1', 'access-control-expose-headers': 'retry-after' }, body: '<h1>Too many requests</h1>' }))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.getByRole('status')).toContainText('TOO MANY START ATTEMPTS')
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script.trim())
  await expect(page.getByRole('button', { name: /TRY AGAIN IN/ })).toBeDisabled()
  await page.unroute('**/api/sessions')
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeEnabled()
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.locator('.network-state')).toHaveText('CONNECTED')
})

test('full-server feedback preserves the draft through reload without automatic retries', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/sessions', (route) => { attempts += 1; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"reason":"session_capacity"}' }) })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.getByRole('status')).toContainText('SERVER IS FULL')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script.trim())
  expect(attempts).toBe(1)
})

test('a proxy HTML body-size rejection explains recovery and preserves the script', async ({ page }) => {
  await page.route('**/api/sessions', (route) => route.fulfill({ status: 413, contentType: 'text/html', body: '<h1>Request too large</h1>' }))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.getByRole('status')).toContainText('REQUEST TOO LARGE')
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script.trim())
  await page.unroute('**/api/sessions')
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.locator('.network-state')).toHaveText('CONNECTED')
})

test('a realtime rate refusal never reconnects or automatically replays the rejected gesture', async ({ page: editor, browser }) => {
  const links = await createSession(editor)
  const context = await browser.newContext()
  const remote = await context.newPage()
  let joins = 0
  let speedCommands = 0
  await remote.routeWebSocket('**/socket/websocket**', (socket) => {
    const server = socket.connectToServer()
    socket.onMessage((message) => {
      const frame = JSON.parse(String(message))
      if (frame[3] === 'phx_join') joins += 1
      if (frame[3] === 'transport:set_speed') {
        speedCommands += 1
        if (speedCommands === 1) {
          socket.send(JSON.stringify([frame[0], frame[1], frame[2], 'phx_reply', {
            status: 'error', response: { reason: 'rate_limited', retry_after_ms: 100 },
          }]))
          return
        }
      }
      server.send(message)
    })
  })
  try {
    await remote.goto(links.remote)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    const initialJoins = joins
    await remote.getByRole('button', { name: 'Increase speed' }).click()
    await expect.poll(() => speedCommands).toBe(1)
    // A bounded observation window is intentional: absence of retry is the assertion.
    await remote.waitForTimeout(500)
    expect(speedCommands).toBe(1)
    expect(joins).toBe(initialJoins)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'Increase speed' }).click()
    await expect.poll(() => speedCommands).toBe(2)
    await expect(remote.getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.96')
    expect(joins).toBe(initialJoins)
  } finally { await context.close() }
})
