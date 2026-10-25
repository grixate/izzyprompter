import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { accountFixture } from './helpers/account'
import { tabKey } from './helpers/keyboard'

// Consume a reserved fixture through the real cookie/CSRF API without putting
// a sign-in credential into navigation diagnostics, traces or output files.
async function signIn(page: Page, fixture: ReturnType<typeof accountFixture>) {
  await page.goto('/account')
  await expect(page.getByRole('button', { name: 'Email me a sign-in link', exact: true })).toBeVisible()
  await page.evaluate(async token => {
    const status = await (await fetch('/api/account')).json()
    const response = await fetch('/api/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': status.csrf_token }, body: JSON.stringify({ token }) })
    if (!response.ok) throw new Error(`Synthetic sign-in failed (${response.status})`)
  }, fixture.token)
  await page.goto('/account')
  await expect(page.getByRole('button', { name: 'Devices', exact: true })).toBeVisible()
}

function ageSession(userId: string) {
  execFileSync('mix', ['run', '--no-start', '-e', `
    Application.ensure_all_started(:ecto_sql)
    Application.ensure_all_started(:postgrex)
    {:ok, _} = Teleprompter.Repo.start_link()
    import Ecto.Query
    id = System.fetch_env!("IZZY_SESSION_TEST_USER")
    old = DateTime.add(DateTime.utc_now(), -120 * 86400, :second)
    Teleprompter.Repo.update_all(from(t in Teleprompter.Accounts.Token, where: t.user_id == ^id and t.kind == "session"), set: [inserted_at: old, last_seen_at: old, expires_at: old])
  `], { cwd: 'api', env: { ...process.env, MIX_ENV: 'test', DATABASE_URL: process.env.IZZY_E2E_DATABASE_URL, IZZY_SESSION_TEST_USER: userId }, stdio: 'ignore' })
}

test.describe('persistent account sign-ins', () => {
  test.skip(!process.env.IZZY_E2E_DATABASE_URL, 'Requires an isolated migrated PostgreSQL database')
  test.setTimeout(90_000)

  test('aged sign-in survives browser restart without email, and explicit logout invalidates a retained cookie', async ({ browser, browserName }) => {
    const original = await browser.newContext()
    let emails = 0
    original.on('request', request => { if (request.url().endsWith('/api/account/login-link')) emails++ })
    const fixture = accountFixture()
    const first = await original.newPage()
    await signIn(first, fixture)
    const cookie = (await original.cookies()).find(item => item.name === '_teleprompter_key')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    // Linux WebKit clamps server cookies to one year; the server's 400-day
    // Max-Age is covered by the HTTP tests. Both must outlive the old 30 days.
    const minimumDays = browserName === 'webkit' ? 360 : 399
    expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + minimumDays * 86400)
    const state = await original.storageState() // memory only; never write credentials to disk
    ageSession(fixture.id)
    await original.close()
    const restored = await browser.newContext({ storageState: state })
    restored.on('request', request => { if (request.url().endsWith('/api/account/login-link')) emails++ })
    try {
      const page = await restored.newPage()
      await page.goto('/account')
      await expect(page.getByRole('button', { name: 'Devices', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Devices', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Signed-in browsers' })
      await expect(dialog.locator('li')).toHaveCount(1)
      await expect(dialog.getByText('This browser', { exact: true })).toBeVisible()
      await dialog.getByRole('button', { name: 'Done', exact: true }).click()
      await page.getByRole('button', { name: 'Log out', exact: true }).click()
      await page.waitForURL('/')
      await expect.poll(() => page.evaluate(async () => (await (await fetch('/api/account')).json()).user)).toBeNull()
      const replay = await browser.newContext({ storageState: state })
      try {
        const copy = await replay.newPage()
        await copy.goto('/account')
        await expect(copy.getByRole('button', { name: 'Email me a sign-in link', exact: true })).toBeVisible()
      } finally { await replay.close() }
      expect(emails).toBe(0)
    } finally { await restored.close() }
  })

  test('device controls revoke one browser and all others, isolate accounts, and fit a phone', async ({ browser, browserName, page }, testInfo) => {
    const fixture = accountFixture()
    const phone = await browser.newContext({ viewport: { width: 390, height: 700 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1 Version/18.0 Mobile/15E148 Safari/604.1' })
    const desktop = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/130.0' })
    const stranger = await browser.newContext()
    try {
      await signIn(page, fixture)
      const phonePage = await phone.newPage(), otherPage = await desktop.newPage(), unrelated = await stranger.newPage()
      let subscribed = false
      phonePage.on('websocket', socket => {
        if (!new URL(socket.url()).pathname.startsWith('/account/socket')) return
        socket.on('framereceived', frame => {
          const value = JSON.parse(String(frame.payload))
          if (value[3] === 'phx_reply' && value[4]?.status === 'ok') subscribed = true
        })
      })
      await signIn(phonePage, accountFixture(fixture.id))
      await signIn(otherPage, accountFixture(fixture.id))
      await signIn(unrelated, accountFixture())
      await expect.poll(() => subscribed).toBe(true)
      await page.setViewportSize({ width: 390, height: 700 })
      await page.getByRole('button', { name: 'Devices', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Signed-in browsers' })
      await expect(dialog.locator('li')).toHaveCount(3)
      await expect(dialog.getByText('This browser', { exact: true })).toHaveCount(1)
      await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeInViewport()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (testInfo.project.name === 'chromium') await dialog.screenshot({ path: 'artifacts/persistent-sessions-2026-10-25/devices-phone.png' })
      await dialog.getByRole('button', { name: 'Log out Safari · iPhone', exact: true }).click()
      await expect(dialog.locator('li')).toHaveCount(2)
      await expect.poll(() => phonePage.evaluate(async () => (await (await fetch('/api/account')).json()).user)).toBeNull()
      await phonePage.bringToFront()
      await expect(phonePage.getByRole('button', { name: 'Devices', exact: true })).toHaveCount(0)
      await dialog.getByRole('button', { name: 'Log out other browsers', exact: true }).click()
      await expect(dialog.getByText('Other browsers will need a new sign-in link. This browser stays signed in.')).toBeVisible()
      await dialog.getByRole('button', { name: 'Log out other browsers', exact: true }).click()
      await expect(dialog.locator('li')).toHaveCount(1)
      await expect(otherPage.getByRole('button', { name: 'Devices', exact: true })).toHaveCount(0)
      await unrelated.reload()
      await expect(unrelated.getByRole('button', { name: 'Devices', exact: true })).toBeVisible()
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 568 })
        await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeInViewport()
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
        for (let index = 0; index < 5; index++) {
          await page.keyboard.press(tabKey(browserName))
          expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
        }
      }
      if (testInfo.project.name === 'chromium') await dialog.screenshot({ path: 'artifacts/persistent-sessions-2026-10-25/devices-desktop.png' })
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Devices', exact: true })).toBeFocused()
    } finally { await Promise.all([phone.close(), desktop.close(), stranger.close()]) }
  })

  test('revocation before the account channel connects clears the cached sign-in', async ({ page, browser }) => {
    const fixture = accountFixture()
    await signIn(page, fixture)
    const remote = await browser.newContext({ userAgent: 'Mozilla/5.0 (Android) Chrome/130.0' })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    try {
      const delayed = await remote.newPage()
      let blocked = false
      await delayed.route('**/api/account/channel-ticket', async route => { blocked = true; await gate; await route.continue() })
      await signIn(delayed, accountFixture(fixture.id))
      await expect.poll(() => blocked).toBe(true)
      await page.getByRole('button', { name: 'Devices', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Signed-in browsers' })
      await dialog.getByRole('button', { name: 'Log out Chrome · Android', exact: true }).click()
      await expect(dialog.locator('li')).toHaveCount(1)
      release()
      await expect(delayed.getByRole('button', { name: 'Devices', exact: true })).toHaveCount(0)
      await expect(delayed.getByRole('button', { name: 'Email me a sign-in link', exact: true })).toBeVisible()
    } finally { release(); await remote.close() }
  })

  test('a stale revoked-cookie response cannot overwrite a newer sign-in', async ({ page, context }) => {
    const fixture = accountFixture()
    await signIn(page, fixture)
    await page.goto('about:blank')
    const oldCookie = (await context.cookies()).find(cookie => cookie.name === '_teleprompter_key')!
    const status = await (await context.request.get('/api/account')).json()
    const next = accountFixture(fixture.id)
    const login = await context.request.post('/api/account/login', { headers: { 'x-csrf-token': status.csrf_token }, data: { token: next.token } })
    expect(login.status()).toBe(200)
    const stale = await context.request.get('/api/account', { headers: { Cookie: `_teleprompter_key=${oldCookie.value}` } })
    expect((await stale.json()).user).toBeNull()
    const cookieUntouched = stale.headers()['set-cookie'] === undefined
    expect(cookieUntouched).toBe(true)
    const current = await (await context.request.get('/api/account')).json()
    expect(current.user?.id).toBe(fixture.id)
  })

  test('loading and network failure keep browser management recoverable', async ({ page }) => {
    await signIn(page, accountFixture())
    await page.route('**/api/account/sessions', async route => { await new Promise(resolve => setTimeout(resolve, 400)); await route.abort() })
    await page.getByRole('button', { name: 'Devices', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Signed-in browsers' })
    await expect(dialog.getByText('Checking your browsers…')).toBeVisible()
    await expect(dialog.getByRole('alert')).toContainText('Connection unavailable')
    await page.unroute('**/api/account/sessions')
    await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(dialog.locator('li')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Close devices', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Devices', exact: true })).toBeFocused()
  })
})
