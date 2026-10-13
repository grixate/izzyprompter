import { test, expect, type Page } from '@playwright/test'
import { phoneOptions } from './helpers/phone'

const script = 'Camera ready. '.repeat(100).trim() + '\n\n' + 'A different paragraph. '.repeat(100).trim()
const position = (page: Page) => page.locator('.script-track').evaluate((element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)

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

// Deterministic browser-event simulation, not a claim of physical phone locking.
async function visibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value })
    Object.defineProperty(document, 'hidden', { configurable: true, value: value === 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

test('backgrounded phone suspends commands and foreground rejoin receives changed playback and position', async ({ page: editor, browser, browserName }) => {
  const links = await createSession(editor)
  const displayContext = await browser.newContext()
  const remoteContext = await browser.newContext(phoneOptions(browserName))
  const display = await displayContext.newPage()
  const remote = await remoteContext.newPage()
  const sentEvents: string[] = []
  remote.on('websocket', (socket) => {
    if (new URL(socket.url()).pathname !== '/socket/websocket') return
    socket.on('framesent', ({ payload }) => {
    const frame = JSON.parse(payload.toString())
    if (frame[3]?.startsWith('transport:')) sentEvents.push(frame[3])
    })
  })
  try {
    await Promise.all([display.goto(links.display), remote.goto(links.remote)])
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('ROLLING')
    const before = await position(display)
    await visibility(remote, 'hidden')
    await expect(remote.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
    const commandsBefore = sentEvents.length
    await remote.getByRole('button', { name: 'Increase speed' }).evaluate((button: HTMLButtonElement) => button.click())
    await remote.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => position(display)).toBeGreaterThan(before + 30)
    expect(sentEvents).toHaveLength(commandsBefore)
    // The display changes the authoritative state while the phone cannot hear it.
    await display.locator('body').press('+')
    await display.locator('body').press('Space')
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    await visibility(remote, 'visible')
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.91')
    await expect(remote.locator('.state-label')).toHaveText('HOLD')
    await expect.poll(async () => Math.abs(Number(await remote.getByRole('slider', { name: 'Jog script position' }).getAttribute('aria-valuenow')) - await position(display))).toBeLessThan(2)
    expect(remote.url()).toBe(links.remote)
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('ROLLING')
  } finally {
    await displayContext.close()
    await remoteContext.close()
  }
})

test('simulated BFCache return coalesces resume hints and never replays the old transport', async ({ page: editor, browser }) => {
  const links = await createSession(editor)
  const displayContext = await browser.newContext()
  const remoteContext = await browser.newContext()
  const display = await displayContext.newPage()
  const remote = await remoteContext.newPage()
  let connections = 0
  remote.on('websocket', (socket) => {
    if (new URL(socket.url()).pathname === '/socket/websocket') connections += 1
  })
  try {
    await Promise.all([display.goto(links.display), remote.goto(links.remote)])
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.getByRole('button', { name: 'Next phrase' })).toBeEnabled()
    await remote.evaluate(() => {
      document.dispatchEvent(new Event('freeze'))
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    })
    await expect(remote.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
    await display.locator('body').press('+')
    for (let step = 0; step < 8; step += 1) await display.locator('body').press('ArrowDown')
    await expect.poll(() => position(display)).toBe(8 * 48)
    const previousConnections = connections
    await remote.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('resume'))
    })
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.91')
    await expect.poll(() => connections).toBe(previousConnections + 1)
    await remote.waitForTimeout(250)
    expect(connections).toBe(previousConnections + 1)
    await expect.poll(() => position(display)).toBe(8 * 48)
    await remote.getByRole('button', { name: 'Next phrase' }).click()
    await expect(remote.locator('.phrase-count')).toContainText('02 / 02')
    await remote.reload()
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.locator('.phrase-count')).toContainText('02 / 02')
  } finally {
    await displayContext.close()
    await remoteContext.close()
  }
})
