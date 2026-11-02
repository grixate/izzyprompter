import { test, expect } from '@playwright/test'

test('tagged visits retain attribution across internal navigation and send no raw URL or script', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
  const visits: Record<string, string>[] = []
  await page.route('**/api/analytics/visit', route => {
    visits.push(route.request().postDataJSON())
    return route.fulfill({ json: { token: 'synthetic-visit', expires_in: 1800 } })
  })
  await page.goto('/?utm_source=Telegram&utm_medium=social&utm_campaign=launch&utm_content=demo_01&email=private@example.com#private-fragment')
  await expect.poll(() => visits.length).toBe(1)
  expect(visits[0]).toEqual({ source: 'telegram', medium: 'social', campaign: 'launch', content: 'demo_01', entry: 'home' })
  await expect.poll(() => page.evaluate(() => !!sessionStorage.getItem('izzy:campaign-visit:v1'))).toBe(true)
  await page.goto('/pro')
  await expect.poll(() => visits.length).toBe(2)
  expect(visits[1]).toEqual({ ...visits[0], token: 'synthetic-visit' })
  expect(JSON.stringify(visits)).not.toMatch(/private|example.com|fragment|https:/)
})

test('automation and explicit browser exclusions never call the collector', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analytics/**', route => { calls++; return route.fulfill({ status: 204 }) })
  await page.goto('/')
  await expect(page.locator('.start-button')).toBeVisible()
  expect(calls).toBe(0)
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
  await page.goto('/?analytics=off&utm_source=telegram')
  await expect(page.locator('.start-button')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('izzy:analytics:exclude'))).toBe('1')
  await page.goto('/pro')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(calls).toBe(0)
})

test('a collector outage never prevents creating a guest take', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
  await page.route('**/api/analytics/**', route => route.abort())
  await page.goto('/?utm_source=telegram&utm_content=outage')
  await page.locator('textarea').fill('Synthetic measurement outage take.')
  await page.locator('.start-button').click()
  await expect(page.getByRole('link', { name: /READ ON THIS DEVICE OPEN DISPLAY/i })).toBeVisible()
})

test('anonymous visitors cannot see private analytics', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'For the owner’s eyes.' })).toBeVisible()
  await expect(page.locator('.analytics-stats')).toHaveCount(0)
})

test('owner report, link builder and narrow layouts render synthetic campaign data', async ({ page }, testInfo) => {
  await page.route('**/api/account', route => route.fulfill({ json: { enabled: true, analytics_admin: true,
    csrf_token: 'synthetic', google_enabled: false, user: { id: 'synthetic-owner', email: 'owner@example.com', pro: false } } }))
  await page.route('**/api/account/channel-ticket', route => route.fulfill({ status: 503 }))
  await page.route('**/api/account/analytics?*', route => route.fulfill({ json: {
    enabled: true, days: 30, from: '2026-10-04', through: '2026-11-02',
    totals: { site_visitors: 128, visits: 164, page_views: 240, start_clicked: 62, session_created: 48, remote_connected: 31, playback_started: 27 },
    campaigns: [{ source: 'telegram', medium: 'social', campaign: 'launch', content: 'demo_01', entry: 'home', counts: { visits: 100, visitors: 80, session_created: 38, remote_connected: 24, playback_started: 20 } },
      { source: 'instagram', medium: 'social', campaign: 'launch', content: 'story_02', entry: 'home', counts: { visits: 64, visitors: 48, session_created: 10, remote_connected: 7, playback_started: 7 } }],
    daily: [{ day: '2026-10-31', counts: { visits: 50 } }, { day: '2026-11-01', counts: { visits: 78 } }, { day: '2026-11-02', counts: { visits: 36 } }], payments: [],
  } }))
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Which posts lead to use?' })).toBeVisible()
  await expect(page.getByRole('row', { name: /telegram.*demo_01/ })).toContainText('20.0%')
  await expect(page.getByRole('textbox', { name: 'Post link', exact: true })).toHaveValue('https://izzyprompter.com/?utm_source=telegram&utm_medium=social&utm_campaign=launch&utm_content=demo_01')
  await page.getByRole('textbox', { name: 'Post', exact: true }).fill('followup_02')
  await expect(page.getByRole('textbox', { name: 'Post link', exact: true })).toHaveValue(/utm_content=followup_02$/)
  await page.locator('main').evaluate(el => { el.scrollTop = 0 })
  await page.screenshot({ path: testInfo.outputPath('campaign-report-desktop.png') })
  await page.getByRole('heading', { name: 'Which posts lead to use?' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('campaign-report-campaigns.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('main').evaluate(el => { el.scrollTop = 0 })
  await page.screenshot({ path: testInfo.outputPath('campaign-report-phone.png') })
  await page.getByRole('heading', { name: 'Give every post its own link.' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('campaign-report-phone-builder.png') })
})
