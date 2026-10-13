import { test, expect } from '@playwright/test'
import { accountFixture } from './helpers/account'

const purchaseId = '6fef5a2e-3403-489c-bbbc-64a63b270621'
const purchase = { id: purchaseId, provider: 'lava', currency: 'USD', amount_minor: 2900,
  status: 'pending', checkout_url: 'https://app.lava.top/payment/fixture', environment: 'production', review_required: false }
const commerce = { enabled: true, prices: { USD: 2900 }, providers: [{ id: 'lava', recommended: true, currencies: ['USD'] }], purchases: [] as typeof purchase[] }

test.describe('lava.top checkout', () => {
  test.skip(!process.env.IZZY_E2E_DATABASE_URL, 'Requires a migrated disposable PostgreSQL database')
  test.beforeEach(async ({ page }) => {
    await page.goto(`/account/login#token=${accountFixture().token}`)
    await page.getByRole('button', { name: 'Sign in to IZZY', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your scripts.', exact: true })).toBeVisible()
  })

  test('offers only US$29 once and opens the hosted Lava checkout', async ({ page }, testInfo) => {
    await page.route('**/api/account/commerce', route => route.fulfill({ json: commerce }))
    await page.route('**/api/account/checkout', async route => {
      expect(route.request().postDataJSON()).toEqual({ provider: 'lava', currency: 'USD', confirm_switch: false })
      await route.fulfill({ json: purchase })
    })
    await page.route('https://app.lava.top/payment/fixture', route => route.fulfill({ contentType: 'text/html', body: '<h1>Lava checkout fixture</h1>' }))
    await page.reload()
    await expect(page.locator('.pro-panel')).toContainText('$29 · paid once')
    await expect(page.locator('.pro-panel')).toContainText('lava.top')
    await expect(page.locator('.pro-panel')).not.toContainText('Prodamus')
    await expect(page.locator('.pro-panel')).not.toContainText('₽')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('lava-offer-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Unlock Lifetime Pro', exact: true }).click()
    await expect(page).toHaveURL(purchase.checkout_url)
  })

  test('ignores forged return status, verifies stored purchase, and refreshes account access', async ({ page }, testInfo) => {
    let verified = false
    let checks = 0
    await page.route('**/api/account', async route => {
      const response = await route.fetch()
      const data = await response.json()
      await route.fulfill({ json: { ...data, user: { ...data.user, pro: verified } } })
    })
    await page.route('**/api/account/commerce', route => route.fulfill({ json: { ...commerce, purchases: [{ ...purchase, status: verified ? 'paid' : 'pending' }] } }))
    await page.route(`**/api/account/purchases/${purchaseId}/check`, async route => {
      checks++
      await route.fulfill({ json: { ...purchase, status: verified ? 'paid' : 'pending' } })
    })
    await page.goto(`/account?purchase=${purchaseId}&invoiceId=forged-provider-id&status=success`)
    await expect.poll(() => checks).toBe(1)
    await expect(page.locator('.pro-panel')).toContainText('Waiting for payment confirmation')
    await expect(page.locator('.account-eyebrow')).toContainText('FREE')
    await expect(page.getByRole('link', { name: 'Resume checkout' })).toHaveAttribute('href', purchase.checkout_url)
    verified = true
    await page.getByRole('button', { name: 'Check payment status' }).click()
    await expect(page.locator('.pro-panel')).toContainText('Payment confirmed')
    await expect(page.locator('.account-eyebrow')).toContainText('PRO')
    await expect(page.getByRole('button', { name: 'Unlock Lifetime Pro' })).toHaveCount(0)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath('lava-confirmed-desktop.png'), fullPage: true })
  })

  test('failed payment can be retried; disabled sales still show pending purchases', async ({ page }) => {
    await page.route('**/api/account/commerce', route => route.fulfill({ json: { ...commerce, purchases: [{ ...purchase, status: 'failed', checkout_url: null }] } }))
    await page.goto(`/account?purchase=${purchaseId}&status=failed`)
    await expect(page.locator('.pro-panel')).toContainText('Payment was not completed')
    await expect(page.getByRole('button', { name: 'Unlock Lifetime Pro' })).toBeEnabled()
    await page.unroute('**/api/account/commerce')
    await page.route('**/api/account/commerce', route => route.fulfill({ json: { ...commerce, enabled: false, purchases: [purchase] } }))
    await page.route(`**/api/account/purchases/${purchaseId}/check`, route => route.fulfill({ json: purchase }))
    await page.reload()
    await expect(page.getByRole('button', { name: 'Unlock Lifetime Pro' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check payment status' })).toBeEnabled()
    await expect(page.getByRole('link', { name: 'Resume checkout' })).toBeVisible()
  })
})
