import { test, expect } from '@playwright/test'

const documents = [
  ['/terms', 'Terms of Service'], ['/privacy', 'Privacy Policy'],
  ['/refunds', 'Refund Policy'], ['/contact', 'Contact'],
] as const

test('legal documents open directly without account/product services or session cookies', async ({ page, context }) => {
  const apiRequests: string[] = []
  await page.route('**/api/**', route => { apiRequests.push(new URL(route.request().url()).pathname); return route.abort() })
  for (const [path, title] of documents) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page).toHaveTitle(`${title} — IZZY Prompter`)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByLabel('Draft status')).toBeVisible()
  }
  await page.goto('/privacy/')
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible()
  expect(apiRequests).toEqual([])
  expect(await context.cookies()).toEqual([])
  await page.goto('/contact')
  await expect(page.getByRole('link', { name: 'grix08@gmail.com' })).toHaveAttribute('href', 'mailto:grix08@gmail.com')
  await expect(page.locator('article')).toContainText('Greg Mikkelsen')
  await expect(page.locator('article')).toContainText('Germany')
})

for (const width of [320, 390, 1280]) {
  test(`legal articles and shared footers fit ${width}px and remain scrollable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    for (const [path] of documents) {
      await page.goto(path)
      await expect(page.locator('.legal-section').last()).toBeAttached()
      await page.locator('.legal-section').last().scrollIntoViewIfNeeded()
      await expect(page.locator('.legal-section').last()).toBeVisible()
      const footer = page.getByRole('navigation', { name: 'Legal', exact: true })
      await footer.scrollIntoViewIfNeeded()
      await expect(footer).toBeVisible()
      expect(await page.locator('.legal-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(await page.locator('.legal-article').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    for (const path of ['/', '/pro', '/skins', '/account', '/local']) {
      await page.goto(path)
      const footer = page.getByRole('navigation', { name: 'Legal', exact: true })
      await footer.scrollIntoViewIfNeeded()
      for (const [href] of documents) await expect(footer.locator(`a[href="${href}"]`)).toBeVisible()
      const contrast = await footer.locator('a').first().evaluate(link => {
        const luminance = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3)
          .map(value => Number(value) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
          .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
        const foreground = luminance(getComputedStyle(link).color)
        const background = luminance(getComputedStyle(link.closest('main')!).backgroundColor)
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
      })
      expect(contrast).toBeGreaterThanOrEqual(4.5)
      expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    }
  })
}

test('guest and local drafts survive immediate navigation through legal links', async ({ page }) => {
  const guest = 'Synthetic guest draft before reading the privacy policy.'
  await page.goto('/')
  await page.locator('textarea').fill(guest)
  await page.getByRole('navigation', { name: 'Legal', exact: true }).getByRole('link', { name: 'Privacy', exact: true }).click()
  await expect(page).toHaveURL('/privacy')
  await page.getByRole('link', { name: 'Back to IZZY', exact: true }).click()
  await expect(page.locator('textarea')).toHaveValue(guest)

  const local = 'Synthetic local draft before reading the refund policy.'
  await page.goto('/local')
  await page.getByRole('button', { name: 'Set up Offline', exact: true }).click()
  await page.getByRole('textbox', { name: 'Local script text' }).fill(local)
  await page.getByRole('navigation', { name: 'Legal', exact: true }).getByRole('link', { name: 'Refunds', exact: true }).click()
  await expect(page).toHaveURL('/refunds')
  await page.goto('/local')
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(local)
})

test('purchase disclosures open legal documents without closing the finish dialog', async ({ page, context }) => {
  await page.route('**/api/product', route => route.fulfill({ json: {
    id: 'lifetime_pro', currency: 'USD', price_minor: 2900, reference_price_minor: 4900,
    discount_percent: 40, launch_offer: true, checkout_available: true,
  } }))
  await page.goto('/pro')
  await expect(page.locator('.lifetime-note')).toContainText('No subscription')
  await expect(page.locator('.pro-hero .purchase-terms')).toContainText('Refund Policy')
  await page.goto('/skins?skin=ivory')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const opened = context.waitForEvent('page')
  await dialog.locator('.purchase-terms').getByRole('link', { name: 'Terms', exact: true }).click()
  const policy = await opened
  await expect(policy.getByRole('heading', { name: 'Terms of Service', exact: true })).toBeVisible()
  await policy.close()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('offline workspace explains that legal documents need an online connection', async ({ page, context }) => {
  await page.goto('/local')
  await page.getByRole('navigation', { name: 'Legal', exact: true }).scrollIntoViewIfNeeded()
  await context.setOffline(true)
  await expect(page.getByText('Policies are available online.', { exact: true })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Policies are available online.', { exact: true })).toHaveCount(0)
})
