import { test, expect } from '@playwright/test'
import { isolatedApp } from './helpers/isolated-app'
import { phoneOptions } from './helpers/phone'

test('real server restart ends the old session, preserves the draft, and requires explicit new pairing', async ({ page: editor, browser, browserName }) => {
  test.setTimeout(60_000)
  const app = await isolatedApp()
  const displayContext = await browser.newContext()
  const remoteContext = await browser.newContext(phoneOptions(browserName))
  const display = await displayContext.newPage()
  const remote = await remoteContext.newPage()
  let connections = 0
  remote.on('websocket', (socket) => { if (new URL(socket.url()).pathname === '/socket/websocket') connections += 1 })
  const script = 'Saved through a real restart — café 🎥. '.repeat(100).trim() + '\n\nA second paragraph.'
  const position = () => display.locator('.script-track').evaluate((element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)
  try {
    await editor.goto(app.baseURL)
    await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
    await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
    await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
    const displayHref = (await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href'))!
    const remoteHref = (await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!
    await Promise.all([display.goto(displayHref), remote.goto(remoteHref)])
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('ROLLING')
    await expect.poll(position).toBeGreaterThan(10)
    await app.stopApi()
    await expect(remote.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
    await expect(remote.locator('.network-state')).not.toHaveText('CONNECTED')
    // The independent local display engine survives a short server outage.
    const before = await position()
    await expect.poll(position).toBeGreaterThan(before + 20)
    await app.startApi()
    for (const page of [editor, remote, display]) {
      // Socket retries can wait up to 8 seconds before the join request itself.
      // Allow that documented backoff plus transport/scheduling time, not a retry of the test.
      await expect(page.getByRole('heading', { name: 'Session ended' })).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('.network-state')).toHaveText('EXPIRED')
    }
    await expect(display.locator('.script-track p')).toHaveCount(2)
    const endedConnections = connections
    await remote.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await remote.waitForTimeout(250)
    expect(connections).toBe(endedConnections)
    // Reopening the complete old link cannot silently create an empty session.
    await remote.reload()
    await expect(remote.getByRole('heading', { name: 'Session ended' })).toBeVisible()
    await editor.getByRole('link', { name: /BACK TO SCRIPT/ }).click()
    await expect(editor.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script)
    await editor.reload()
    await expect(editor.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script)
    await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
    await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
    const newRemote = (await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!
    const newDisplay = (await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href'))!
    expect(newRemote).not.toBe(remoteHref)
    await Promise.all([remote.goto(newRemote), display.goto(newDisplay)])
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.locator('.state-label')).toHaveText('HOLD')
    await expect(display.locator('.script-track p')).toHaveText(script.split('\n\n'))
  } finally {
    await displayContext.close()
    await remoteContext.close()
    await app.close()
  }
})
