import { test, expect } from '@playwright/test'
import { accountFixture } from './helpers/account'

test.describe('online free launch', () => {
  test.skip(!process.env.IZZY_E2E_DATABASE_URL, 'Requires a migrated disposable PostgreSQL database')
  test.beforeEach(async ({ page }) => {
    await page.goto(`/account/login#token=${accountFixture().token}`)
    await page.getByRole('button', { name: 'Sign in to IZZY', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your scripts', exact: true })).toBeVisible()
  })

  test('disabled checkout has no upsell, locked empty presets or provider setup placeholder', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: 'From words to a take.' })).toBeVisible()
    await expect(page.getByText('Both devices need an internet connection to IZZY.', { exact: false })).toBeVisible()
    await expect(page.locator('.pro-panel, .preset-panel')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Unlock Lifetime Pro' })).toHaveCount(0)
    const result = await page.evaluate(async () => {
      const account = await (await fetch('/api/account')).json()
      const response = await fetch('/api/account/checkout', { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': account.csrf_token },
        body: JSON.stringify({ provider: 'prodamus', currency: 'USD' }) })
      return { status: response.status, body: await response.json() }
    })
    expect(result).toEqual({ status: 422, body: { reason: 'payments_unavailable' } })
    await expect(page.getByRole('link', { name: 'My scripts', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.start-header .brand-context')).toHaveCount(0)
    for (const name of ['New script', 'Trash', 'Upload']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCSS('font-size', '13px')
      await expect(page.getByRole('button', { name, exact: true })).toHaveCSS('height', '44px')
    }
    await expect(page.locator('.library-empty')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('free-library-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('free-library-phone.png'), fullPage: true })
  })

  test('three-script limit preserves editing and export, and trash frees space without enabling a fourth restore', async ({ page }) => {
    // Set up synthetic documents through the real cookie/CSRF-protected API.
    const scripts = await page.evaluate(async () => {
      const account = await (await fetch('/api/account')).json()
      const results = []
      for (let i = 1; i <= 3; i++) {
        const response = await fetch('/api/account/scripts', { method: 'POST',
          headers: { 'content-type': 'application/json', 'x-csrf-token': account.csrf_token },
          body: JSON.stringify({ title: `Free script ${i}`, content: `Words for take ${i}.` }) })
        if (!response.ok) throw new Error('Could not create free launch fixture')
        results.push(await response.json())
      }
      return results as { id: string }[]
    })
    await page.reload()
    await expect(page.locator('.script-card')).toHaveCount(3)
    await page.getByRole('button', { name: 'New script', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Move one to trash to make room')
    await expect(page.getByRole('status')).not.toContainText('unlock Pro')
    await page.getByRole('button', { name: 'Duplicate Free script 1', exact: true }).click()
    await expect(page.locator('.script-card')).toHaveCount(3)
    await page.goto(`/account/scripts/${scripts[0].id}`)
    await page.getByRole('textbox', { name: 'Saved script text', exact: true }).fill('Still editable at the free limit.')
    await expect(page.getByRole('status')).toHaveText('Saved to account')
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    expect((await downloaded).suggestedFilename()).toBe('izzy-script.txt')
    await page.goto('/account')
    await page.getByRole('button', { name: 'Move Free script 3 to trash', exact: true }).click()
    await expect(page.locator('.script-card')).toHaveCount(2)
    await page.getByRole('button', { name: 'New script', exact: true }).click()
    await expect(page).toHaveURL(/\/account\/scripts\/[a-f0-9-]+$/)
    await page.goto('/account')
    await page.getByRole('button', { name: 'Trash', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Trash', exact: true })).toBeVisible()
    await expect(page.locator('.library-toolbar').getByRole('button')).toHaveCount(0)
    const back = await page.getByRole('button', { name: 'Back to scripts', exact: true }).boundingBox()
    const title = await page.getByRole('heading', { name: 'Trash', exact: true }).boundingBox()
    expect(back!.y + back!.height).toBeLessThan(title!.y)
    expect(back!.x).toBeLessThanOrEqual(title!.x)
    await expect(page.locator('.script-card')).toHaveCount(1)
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Move one to trash to make room')
    await expect(page.getByRole('heading', { name: 'Free script 3', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back to scripts', exact: true }).click()
    await expect(page.locator('.script-card')).toHaveCount(3)
  })

  test('unavailable commerce never flashes an offer or blocks the free library', async ({ page }) => {
    await page.route('**/api/account/commerce', route => route.fulfill({ status: 503, json: { reason: 'database_unavailable' } }))
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Your scripts', exact: true })).toBeVisible()
    await expect(page.locator('.pro-panel')).toHaveCount(0)
    await page.getByRole('button', { name: 'New script', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Saved script text', exact: true })).toBeEnabled()
  })

  test('old purchase status stays readable when new checkout is disabled', async ({ page }) => {
    await page.route('**/api/account/commerce', route => route.fulfill({ json: {
      enabled: false, providers: [], purchases: [{ id: 'synthetic-history', provider: 'prodamus', currency: 'USD',
        amount_minor: 2900, status: 'refunded', checkout_url: null, environment: 'test', review_required: false }],
    } }))
    await page.reload()
    await expect(page.locator('.purchase-status')).toContainText('refunded')
    await expect(page.locator('.pro-panel')).toContainText('PURCHASE HISTORY')
    await expect(page.getByRole('button', { name: 'Unlock Lifetime Pro' })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Purchase currency' })).toHaveCount(0)
  })
})
