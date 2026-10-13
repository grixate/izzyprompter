import { test, expect } from '@playwright/test'
import { phoneOptions } from './helpers/phone'

test('tablet starts a script and opens its display while a separate phone controls it', async ({ page: tablet, browser, browserName }) => {
  await tablet.setViewportSize({ width: 768, height: 1024 })
  const phoneContext = await browser.newContext(phoneOptions(browserName))
  const phone = await phoneContext.newPage()
  try {
    await tablet.goto('/')
    await expect(tablet).toHaveTitle('IZZY — Browser Teleprompter')
    await expect(tablet.locator('.wordmark')).toContainText('IZZY / TELEPROMPTER')
    const paragraphs = ['A tablet can be the reading screen.', 'The phone controls the shared session. '.repeat(40).trim()]
    await tablet.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraphs.join('\n\n'))
    await tablet.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
    await expect(tablet.locator('.network-state')).toHaveText('CONNECTED')
    await expect(tablet.locator('.pairing-copy')).toContainText('A tablet works as the reading screen')
    // Loopback test hosting must not pretend that its QR is phone-reachable.
    await expect(tablet.locator('.lan-note')).toContainText('THIS DEVICE ONLY')
    await expect(tablet.locator('.pairing-note')).toContainText('Pairing links grant access')
    await expect(tablet.locator('.qr-frame svg')).toHaveAccessibleName("Scan to open this session's phone remote")

    const remoteLink = await tablet.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
    const popup = tablet.waitForEvent('popup')
    await tablet.getByRole('link', { name: /OPEN DISPLAY/ }).click()
    const display = await popup
    await phone.goto(remoteLink!) // QR navigation equivalent; not a physical-camera test.
    await expect(display.locator('.network-state')).toHaveText('CONNECTED')
    await expect(phone.locator('.network-state')).toHaveText('CONNECTED')
    await expect(display.locator('.script-track p')).toHaveText(paragraphs)
    await expect(phone.locator('.eyebrow')).toContainText('IZZY REMOTE')
    await expect(phone.getByText('DSP 01 READY')).toBeVisible()
    await phone.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('ROLLING')
    await expect.poll(() => display.locator('.script-track').evaluate((node) => -new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBeGreaterThan(10)
    await phone.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    await display.close()
  } finally {
    await phoneContext.close()
  }
})

test('short phone pairing screen scrolls to its recovery controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill('Keep every setup control reachable.')
  await page.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
  const pairing = page.locator('.pairing-page')
  await expect(pairing).toBeVisible()
  await expect.poll(() => pairing.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(100)
  await page.mouse.move(190, 600)
  await page.mouse.wheel(0, 1000)
  await expect.poll(() => pairing.evaluate((node) => node.scrollTop)).toBeGreaterThan(100)
  const edit = page.getByRole('button', { name: 'EDIT SCRIPT', exact: true })
  await expect(edit).toBeInViewport()
  await edit.click()
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue('Keep every setup control reachable.')
})
