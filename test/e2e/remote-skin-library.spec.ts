import { createSyntheticSession } from './helpers/create-synthetic-session'
import { skins } from '../../src/product/catalog'
import { test, expect, type Page } from '@playwright/test'

async function openSkins(page: Page) {
  await page.getByRole('button', { name: 'Remote settings', exact: true }).click()
  await page.getByRole('button', { name: 'Change remote skin' }).click()
}
// Pairing capabilities must not enter retained traces or editor screenshots.
test.use({ trace:'off', screenshot:'off' })

async function openRemote(page: Page, pro = true) {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill('A synthetic take for the remote skin library.\n\nA second paragraph for playback checks.')
  await createSyntheticSession(page)
  const href = await page.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
  await page.route('**/api/sessions/*/appearance', route => route.fulfill({ json: { pro } }))
  await page.goto(href!)
  await expect(page.locator('.network-state')).toHaveText('CONNECTED')
  // Wait for the initial entitlement check before opening the library.
  if (pro) {
    await openSkins(page)
    await expect(page.getByRole('button', { name: 'Use Orbit', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
  }
}

for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
  test(`remote skin library fits and keeps playback at ${viewport.width} × ${viewport.height}`, async ({ page, browserName }) => {
    test.setTimeout(30_000 + skins.length * 1_000)
    await page.setViewportSize(viewport)
    await openRemote(page)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    const trigger = page.getByRole('button', { name: 'Remote settings', exact: true })
    const bounds = await trigger.boundingBox()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    await openSkins(page)
    const dialog = page.getByRole('dialog', { name: 'Skins' })
    await expect(dialog.getByRole('button', { name: /^Use / })).toHaveCount(skins.length)
    await expect(dialog.getByRole('button', { name: 'Use Original', exact: true })).toBeFocused()
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    const box = await dialog.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
    await expect(dialog.getByRole('button', { name: 'Close skin library' })).toBeInViewport()
    await expect(dialog.locator('.remote-skin-footer')).toHaveCount(0)
    for (const sample of await dialog.locator('.remote-skin-sample').all()) {
      const stage = await sample.boundingBox()
      const object = await sample.locator('.remote-instrument').boundingBox()
      expect(object!.y + object!.height).toBeLessThanOrEqual(stage!.y + stage!.height - 4)
    }
    expect(await dialog.locator('.wheel-rotor').evaluateAll(els => els.reduce((n, el) => n + el.getAnimations().length, 0))).toBe(0)
    if (browserName === 'chromium' && viewport.width === 390) await page.screenshot({ path: 'artifacts/remote-skin-library/mobile-library.png' })
    // The last tile can be reached by scrolling the library, without moving its close control.
    await dialog.getByRole('button', { name: `Use ${skins.at(-1)!.name}`, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(page.getByRole('main', { name: 'Remote controller' })).toHaveClass(new RegExp(`skin--${skins.at(-1)!.id}`))
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    if (browserName === 'chromium' && viewport.width === 390) await page.screenshot({ path: 'artifacts/remote-skin-library/mobile-remote.png' })
    await openSkins(page)
    await expect(page.getByRole('button', { name: `Use ${skins.at(-1)!.name}`, exact: true })).toBeFocused()
    await expect(page.getByRole('button', { name: `Use ${skins.at(-1)!.name}`, exact: true })).toBeInViewport()
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.getByRole('main', { name: 'Remote controller' })).toHaveClass(new RegExp(`skin--${skins.at(-1)!.id}`))
  })
}

test('locked skins stay in the session and storage failure leaves the library recoverable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openRemote(page, false)
  const trigger = page.getByRole('button', { name: 'Remote settings', exact: true })
  await openSkins(page)
  await page.getByRole('button', { name: 'Use Orbit · Pro skin', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Orbit requires Pro.')
  await expect(page.getByRole('link', { name: 'Pro details' })).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('main', { name: 'Remote controller' })).toHaveClass(/skin--original/)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.unroute('**/api/sessions/*/appearance')
  await page.route('**/api/sessions/*/appearance', route => route.fulfill({ json: { pro: true } }))
  await page.reload()
  await openSkins(page)
  await expect(page.getByRole('button', { name: 'Use Orbit', exact: true })).toBeVisible()
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable') } })
  await page.getByRole('button', { name: 'Use Orbit', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Could not change the skin')
  await expect(page.getByRole('button', { name: 'Use Orbit', exact: true })).toBeEnabled()
  await expect(page.getByRole('main', { name: 'Remote controller' })).toHaveClass(/skin--original/)
  await page.getByRole('button', { name: 'Close skin library' }).click()
  await expect(trigger).toBeFocused()
})

test('keyboard focus stays inside the library; closing during a selection is safe', async ({ page }) => {
  await openRemote(page)
  await openSkins(page)
  await page.getByRole('button', { name: 'Close skin library' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: `Use ${skins.at(-1)!.name}`, exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close skin library' })).toBeFocused()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/sessions/*/appearance', async route => { await gate; await route.fulfill({ json: { pro: true } }) })
  await page.getByRole('button', { name: 'Use Orbit', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Applying Orbit…')
  await expect(page.getByRole('button', { name: 'Use Signal', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Remote settings', exact: true })).toBeFocused()
  release()
  await expect(page.getByRole('main', { name: 'Remote controller' })).toHaveClass(/skin--ivory/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
