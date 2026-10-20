import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { tabKey } from './helpers/keyboard'

const script = 'Read this opening paragraph. '.repeat(50).trim() + '\n\n' + 'Read the second paragraph. '.repeat(50).trim()
async function pair(editor: Page) {
  await editor.goto('/')
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
  return {
    display: (await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href'))!,
    remote: (await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!,
  }
}

test('remote wheel works by keyboard and exposes Play as a separate accessible control', async ({ page: editor, browser, browserName }, testInfo) => {
  const links = await pair(editor)
  const context = await browser.newContext()
  const display = await context.newPage(), remote = await context.newPage()
  try {
    await display.goto(links.display)
    await remote.goto(links.remote)
    const wheel = remote.getByRole('slider', { name: 'Jog script position' })
    await expect(wheel).toHaveAttribute('aria-valuetext', /Display position/)
    expect(await wheel.locator('button').count()).toBe(0)
    await wheel.focus()
    await wheel.press('ArrowRight')
    await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeGreaterThan(30)
    await wheel.press('Home')
    await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeLessThan(80)
    await wheel.press('PageDown')
    await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeGreaterThan(400)
    await wheel.press('End')
    await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeGreaterThan(1000)
    await wheel.press('Home')
    await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeLessThan(80)
    await wheel.press(tabKey(browserName))
    await expect(remote.getByRole('button', { name: 'Play', exact: true })).toBeFocused()
    await remote.keyboard.press('Enter')
    await expect(display.locator('.display-footer')).toContainText('ROLLING')
    await remote.getByRole('button', { name: 'Pause', exact: true }).press('Space')
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    await wheel.focus()
    await remote.screenshot({ path: testInfo.outputPath('remote-keyboard-focus.png') })
  } finally { await context.close() }
})

test('display chrome remains visible while focused and speed shortcuts clamp safely', async ({ page: editor, browser }) => {
  const links = await pair(editor)
  const context = await browser.newContext()
  const display = await context.newPage()
  try {
    await display.goto(links.display)
    await expect(display.locator('.network-state')).toHaveText('CONNECTED')
    const settings = display.getByRole('button', { name: 'Prompt settings', exact: true })
    await settings.focus()
    await display.waitForTimeout(3200)
    await expect(display.locator('.display-header')).not.toHaveClass(/is-hidden/)
    await settings.press('Enter')
    await expect(display.getByRole('slider', { name: 'Text size' })).toBeFocused()
    await display.keyboard.press('Escape')
    await expect(settings).toBeFocused()
    await display.locator('body').click({ position: { x: 10, y: 200 } })
    for (let index = 0; index < 20; index += 1) {
      await display.locator('body').press('+')
      await expect(display.locator('.display-footer')).toContainText(`${Math.min(1, 0.86 + (index + 1) * 0.05).toFixed(2)}×`)
    }
    await expect(display.locator('.display-footer')).toContainText('1.00×')
    await expect(display.locator('.network-state')).toHaveText('CONNECTED')
    await display.evaluate(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied'))
    })
    await display.getByRole('button', { name: 'Fullscreen display' }).focus()
    await display.keyboard.press('Enter')
    await expect(display.getByRole('status')).toContainText('Fullscreen unavailable')
  } finally { await context.close() }
})

test('unavailable local storage offers a text-only backup and explicit retry without blocking creation', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, 'izzyTestAllowStorage', { value: false, writable: true })
    Object.defineProperty(window, 'izzyTestFailedDraft', { value: '', writable: true })
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && !(window as unknown as { izzyTestAllowStorage: boolean }).izzyTestAllowStorage) {
        if (key === 'izzy.draft') (window as unknown as { izzyTestFailedDraft: string }).izzyTestFailedDraft = JSON.parse(value).data.content
        throw new DOMException('Full', 'QuotaExceededError')
      }
      original.call(this, key, value)
    }
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  // Wait for this script's attempted save, not a warning from the initial
  // empty draft. Otherwise enabling storage can race its pending debounce.
  await expect.poll(() => page.evaluate(() => (window as unknown as { izzyTestFailedDraft: string }).izzyTestFailedDraft)).toBe(script)
  const warning = page.getByRole('complementary', { name: 'Local save warning' })
  await expect(warning).toContainText('LOCAL SAVE UNAVAILABLE')
  await page.screenshot({ path: testInfo.outputPath('storage-warning.png') })
  const downloaded = page.waitForEvent('download')
  await warning.getByRole('button', { name: 'DOWNLOAD SCRIPT' }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('izzy-script.txt')
  expect(await readFile((await download.path())!, 'utf8')).toBe(script)
  await page.evaluate(() => { (window as unknown as { izzyTestAllowStorage: boolean }).izzyTestAllowStorage = true })
  await warning.getByRole('button', { name: 'RETRY LOCAL SAVE' }).click()
  await expect(warning).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script)
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(page.locator('.network-state')).toHaveText('CONNECTED')
})

test('terminal recovery is modal and returns the in-memory script without a page reload', async ({ page, browserName }, testInfo) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage) throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  let sessionId = ''
  await page.routeWebSocket('**/socket/websocket**', (socket) => {
    const server = socket.connectToServer()
    socket.onMessage((message) => {
      const frame = JSON.parse(String(message))
      if (frame[3] === 'phx_join') sessionId = frame[2]
      server.send(message)
    })
    server.onMessage((message) => {
      socket.send(message)
      const frame = JSON.parse(String(message))
      if (frame[3] === 'phx_reply' && frame[4]?.status === 'ok' && frame[4]?.response?.protocol_version === 2) {
        setTimeout(() => socket.send(JSON.stringify([null, null, sessionId, 'session:ended', { reason: 'session_unavailable' }])), 200)
      }
    })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await page.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  const problem = page.getByRole('alertdialog', { name: 'Session ended' })
  await expect(problem).toBeVisible()
  const back = problem.getByRole('link', { name: /BACK TO SCRIPT/ })
  await expect(back).toBeFocused()
  // Native dialogs may include browser chrome and the dialog container in
  // their cycle. Assert the real contract: no underlying app control gets
  // focus, rather than assuming an identical two-Tab cycle on every engine.
  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press(tabKey(browserName))
    expect(await problem.evaluate((node) => {
      const active = document.activeElement
      return node.matches(':modal') && (node.contains(active) || active === document.body || active === document.documentElement)
    })).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(problem).toBeVisible()
  await back.focus()
  await page.screenshot({ path: testInfo.outputPath('ended-session-dialog.png') })
  await page.evaluate(() => { (window as unknown as { izzyMemoryMarker: boolean }).izzyMemoryMarker = true })
  await back.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue(script)
  expect(await page.evaluate(() => (window as unknown as { izzyMemoryMarker: boolean }).izzyMemoryMarker)).toBe(true)
  await expect(page.getByRole('complementary', { name: 'Local save warning' })).toBeVisible()
})

test('clipboard refusal exposes a selectable pairing link rather than claiming success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } })
    document.execCommand = () => false
  })
  const links = await pair(page)
  await page.getByRole('button', { name: /COPY LINK/ }).click()
  const fallback = page.getByRole('textbox', { name: 'Remote pairing link' })
  await expect(fallback).toHaveValue(links.remote)
  await fallback.focus()
  expect(await fallback.evaluate((element: HTMLInputElement) => element.selectionEnd - element.selectionStart!)).toBe(links.remote.length)
  await expect(page.getByRole('button', { name: /COPY LINK/ })).toBeVisible()
})
