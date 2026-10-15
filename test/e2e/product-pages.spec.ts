import { test, expect } from '@playwright/test'
import { skins } from '../../src/product/catalog'

const offer = { id: 'lifetime_pro', currency: 'USD', price_minor: 2900, reference_price_minor: 4900, discount_percent: 40, launch_offer: true, checkout_available: false }

test('public offer, showroom and locked preview work without an account or checkout', async ({ page }) => {
  await page.goto('/pro')
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible()
  await expect(page.locator('.pro-hero .product-offer')).toContainText('$49')
  await expect(page.locator('.pro-hero .product-offer')).toContainText('$29')
  await expect(page.locator('.pro-hero')).toContainText('Purchases opening soon')
  await page.getByRole('link', { name: 'Explore all 16 finishes' }).click()
  await expect(page.locator('.skin-card')).toHaveCount(16)
  await page.getByRole('button', { name: 'Preview Orbit · Pro finish', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Orbit')
  await expect(page.getByRole('dialog')).toContainText('Purchases opening soon')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Preview Orbit · Pro finish', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Preview Original · Free finish', exact: true }).click()
  await page.getByRole('button', { name: 'Apply this finish', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Original selected')
})

test('offer changes are reflected everywhere; a failed response removes stale pricing', async ({ page }) => {
  await page.route('**/api/product', route => route.fulfill({ json: { ...offer, price_minor: 4900, discount_percent: 0, launch_offer: false } }))
  await page.goto('/pro')
  await expect(page.locator('.pro-hero .product-offer')).toContainText('$49')
  await expect(page.locator('.discount-pill')).toHaveCount(0)
  await expect(page.locator('.product-offer del')).toHaveCount(0)
  await page.unroute('**/api/product')
  await page.route('**/api/product', route => route.abort())
  await page.reload()
  await expect(page.locator('.pro-hero')).toContainText('Price temporarily unavailable')
  await expect(page.locator('.discount-pill')).toHaveCount(0)
})

test('a guest upgrade preserves the skin through the safe sign-in destination', async ({ page }) => {
  await page.route('**/api/product', route => route.fulfill({ json: { ...offer, checkout_available: true } }))
  await page.goto('/skins?skin=ivory')
  await page.getByRole('button', { name: 'Unlock with Pro', exact: true }).click()
  await expect(page).toHaveURL(/\/account\?returnTo=%2Fskins%3Fskin%3Divory$/)
})

test('wheel focus stays outside the wheel; reduced motion stops previews and keyboard input still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const jog = page.getByRole('slider', { name: 'Jog script position' })
  await jog.focus(); await jog.press('ArrowRight')
  await expect(jog).toHaveAttribute('aria-valuenow', '48')
  expect(await jog.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none')
  await expect(page.locator('.preview-remote .wheel-caption')).toHaveCSS('text-decoration-line', 'underline')
  expect(await page.locator('.preview-remote .wheel-rotor').evaluate(el => getComputedStyle(el, '::after').content)).toBe('none')
  expect(await page.locator('.preview-remote .wheel-rotor').evaluate(el => el.getAnimations().length)).toBe(0)
  await page.goto('/skins')
  expect(await page.locator('.skin-card .wheel-rotor').evaluateAll(els => els.reduce((n, el) => n + el.getAnimations().length, 0))).toBe(0)
})

test('visible wheels move and offscreen showroom rotors suspend', async ({ page }) => {
  await page.goto('/skins')
  const first = page.locator('.skin-card .wheel-rotor').first()
  await expect.poll(() => first.evaluate(el => el.getAnimations().length)).toBe(1)
  expect(await page.locator('.skin-card .wheel-rotor').last().evaluate(el => el.getAnimations().length)).toBe(0)
  const before = await first.evaluate(el => getComputedStyle(el).transform)
  await expect.poll(() => first.evaluate(el => getComputedStyle(el).transform)).not.toBe(before)
})

test('every finish can be applied on an entitled remote without changing its controls', async ({ page, browser }) => {
  // Sixteen real modal/apply cycles plus revocation/reload. Linux WebKit's
  // rendering makes this longer than a single flow; retain normal assertion budgets.
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill('First synthetic paragraph.\n\nSecond synthetic paragraph.')
  await page.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
  const href = await page.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const remote = await context.newPage()
  let entitled = true
  await remote.route('**/api/sessions/*/appearance', route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['authorization']?.startsWith('Bearer ') === true).toBe(false)
    const body = route.request().postDataJSON()
    expect(typeof body.token === 'string' && body.token.length === 43).toBe(true)
    return route.fulfill({ json: { pro: entitled } })
  })
  try {
    await remote.goto(href!)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    for (const skin of skins) {
      await test.step(`Apply and inspect ${skin.name}`, async () => {
      await remote.getByRole('button', { name: 'Remote finish', exact: true }).click()
      // The preview follows the current selection; move through the shared catalog.
      while (await remote.locator('#skin-dialog-title').innerText() !== skin.name) await remote.getByRole('button', { name: 'Next skin', exact: true }).click()
      await remote.getByRole('button', { name: /Apply (this finish|to my remote)/ }).click()
      await expect(remote.getByRole('dialog')).toContainText(`${skin.name} selected`)
      await remote.keyboard.press('Escape')
      await expect(remote.getByRole('main', { name: 'Remote controller' })).toHaveClass(new RegExp(`skin--${skin.id}`))
      await expect(remote.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
      const key = remote.getByRole('button', { name: 'Play', exact: true })
      const bounds = await key.boundingBox()
      expect(bounds!.width).toBeGreaterThanOrEqual(40)
      expect(bounds!.height).toBeGreaterThanOrEqual(35)
      })
    }
    const jog = remote.getByRole('slider', { name: 'Jog script position' })
    await jog.press('ArrowRight')
    await expect(jog).toHaveAttribute('aria-valuenow', '48')
    entitled = false
    await remote.getByRole('button', { name: 'Remote finish', exact: true }).click()
    await remote.getByRole('button', { name: /Apply (this finish|to my remote)/ }).click()
    await expect(remote.getByRole('main', { name: 'Remote controller' })).toHaveClass(/skin--original/)
    expect(await remote.evaluate(() => localStorage.getItem('izzy:remote-finish:v1'))).toBe('airframe')
    await remote.keyboard.press('Escape')
    await remote.reload()
    await expect(remote.getByRole('main', { name: 'Remote controller' })).toHaveClass(/skin--original/)
  } finally { await context.close() }
})

for (const width of [360, 390, 430, 768, 1280, 1440]) {
  test(`product surfaces fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/pro', '/skins', '/local']) {
      await page.goto(path)
      // Public pages must also fit when the platform lacks the studio fonts.
      await page.addStyleTag({ content: '.remote-instrument .instrument-speed strong, .offline-hero h1 { font-family: Arial, sans-serif !important; }' })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const speedRails = await page.locator('.remote-instrument .instrument-speed').evaluateAll(els => els.map(el => ({
        rail: el.querySelector<HTMLElement>('.speed-track')?.clientWidth ?? 0,
        overflow: el.scrollWidth - el.clientWidth,
        stepShape: Math.max(...Array.from(el.querySelectorAll<HTMLElement>('.speed-step')).map(step => Math.abs(step.clientWidth - step.clientHeight))),
      })))
      for (const speed of speedRails) {
        expect(speed.rail, `${path} visible speed rail`).toBeGreaterThanOrEqual(20)
        expect(speed.overflow, `${path} speed controls fit`).toBeLessThanOrEqual(1)
        expect(speed.stepShape, `${path} speed keys keep equal dimensions`).toBeLessThanOrEqual(1)
      }
      const overflow = await page.locator('main').first().evaluate(el => el.scrollWidth - el.clientWidth)
      const outside = overflow > 1 ? await page.locator('main').first().evaluate(el => Array.from(el.querySelectorAll('*')).filter(node => node.getBoundingClientRect().right > el.clientWidth + 1).slice(0, 12).map(node => ({ class: node.className, right: Math.round(node.getBoundingClientRect().right) }))) : []
      expect(overflow, `${path} ${JSON.stringify(outside)}`).toBeLessThanOrEqual(1)
      if (path === '/') {
        const screen = await page.locator('.live-preview').boundingBox()
        const remote = await page.locator('.preview-remote').boundingBox()
        const wheel = await page.locator('.preview-remote .jog-wheel').boundingBox()
        expect(wheel!.width).toBeGreaterThanOrEqual(190)
        const horizontalGap = remote!.x - (screen!.x + screen!.width)
        const verticalGap = remote!.y - (screen!.y + screen!.height)
        expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(19)
        const instruments = await page.locator('.home-pro-objects .remote-instrument').all()
        const footer = await page.locator('.public-footer').boundingBox()
        for (const instrument of instruments) {
          const box = await instrument.boundingBox()
          expect(footer!.y - (box!.y + box!.height)).toBeGreaterThan(40)
        }
      }
      if (path === '/pro') {
        const remote = await page.locator('.pro-finale .remote-instrument').boundingBox()
        const footer = await page.locator('.public-footer').boundingBox()
        expect(footer!.y - (remote!.y + remote!.height)).toBeGreaterThan(40)
      }
      if (path === '/local') {
        await expect(page.getByRole('button', { name: 'Set up Offline', exact: true })).toBeVisible()
        await expect(page.getByRole('textbox', { name: 'Local script text' })).toBeHidden()
        await page.getByRole('button', { name: 'Set up Offline', exact: true }).click()
        await expect(page.getByRole('textbox', { name: 'Local script text' })).toBeVisible()
        expect(await page.locator('main').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
      }
    }
  })
}


test('public navigation keeps distinct destinations and hides the library entry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const header = page.locator('.public-nav')
  await expect(header.getByRole('link', { name: /^Pro/ })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
  await expect(header.getByText('How it works', { exact: true })).toHaveCount(0)
  await expect(header.getByText('Start prompting', { exact: true })).toHaveCount(0)
  await expect(page.locator('nav a[href="/skins"]')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  const menu = page.getByRole('navigation', { name: 'Mobile navigation' })
  await expect(menu.getByRole('link')).toHaveCount(2)
  await menu.getByRole('link', { name: /^Izzy Pro/ }).click()
  await expect(page).toHaveURL(/\/pro$/)
  // Hiding discovery must not remove the preserved showroom or deep links.
  await page.goto('/skins?skin=ivory')
  await expect(page.getByRole('dialog')).toBeVisible()
})
