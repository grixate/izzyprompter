import { test, expect, type Page } from '@playwright/test'
import { accountFixture } from './helpers/account'
import { tabKey } from './helpers/keyboard'

test.skip(!process.env.IZZY_E2E_DATABASE_URL || process.env.FEEDBACK_ENABLED !== 'true', 'Requires feedback and a disposable PostgreSQL database')

async function signIn(page: Page) {
  await page.goto(`/account/login#token=${accountFixture().token}`)
  await page.getByRole('button', { name: 'Sign in to IZZY', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your scripts', exact: true })).toBeVisible()
}

test('feedback starts compact, traps focus and retains a draft through Escape and backdrop dismissal', async ({ page, browserName }, info) => {
  await signIn(page)
  const trigger = page.getByRole('button', { name: 'Leave feedback', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Leave feedback', exact: true })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0)
  expect(await page.locator('.feedback-entry').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(105)
  if (browserName === 'chromium') await page.locator('.feedback-entry').screenshot({ path: info.outputPath('feedback-entry.png') })
  await trigger.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Leave feedback', exact: true })).toBeFocused()
  await expect(dialog.getByRole('combobox', { name: 'How was your experience?' })).toHaveCount(0)
  await dialog.getByRole('textbox', { name: 'Your message' }).fill('Synthetic feedback draft that must survive closing.')
  const send = dialog.getByRole('button', { name: 'Send feedback', exact: true })
  await send.focus()
  await send.press(tabKey(browserName))
  await expect(dialog.getByRole('button', { name: 'Close feedback', exact: true })).toBeFocused()
  await dialog.getByRole('textbox', { name: 'Your message' }).press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(dialog.getByRole('textbox', { name: 'Your message' })).toHaveValue(/must survive closing/)
  await page.mouse.click(2, 2)
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(dialog.getByRole('textbox', { name: 'Your message' })).toHaveValue(/must survive closing/)
})

for (const width of [320, 390, 768, 1280]) {
  test(`feedback fits ${width}px and keeps its actions above a shortened visual viewport`, async ({ page, browserName }, info) => {
    await page.setViewportSize({ width, height: 844 })
    await signIn(page)
    await page.getByRole('button', { name: 'Leave feedback', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Leave feedback', exact: true })
    const fits = async (top: number, bottom: number) => {
      await expect(async () => {
        const bounds = await dialog.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        expect(bounds!.y).toBeGreaterThanOrEqual(top)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(bottom)
        for (const name of ['Close feedback', 'Send feedback']) {
          const control = await dialog.getByRole('button', { name, exact: true }).boundingBox()
          expect(control!.y).toBeGreaterThanOrEqual(top)
          expect(control!.y + control!.height).toBeLessThanOrEqual(bottom)
          expect(control!.height).toBeGreaterThanOrEqual(44)
        }
      }).toPass({ timeout: 4000 })
    }
    await fits(0, 844)
    await expect(dialog.getByRole('textbox', { name: 'Your message' })).toHaveCSS('font-size', '16px')
    if (browserName === 'chromium') await dialog.screenshot({ path: info.outputPath(`feedback-${width}.png`) })
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 360 })
      Object.defineProperty(window.visualViewport!, 'offsetTop', { configurable: true, value: 64 })
      window.visualViewport!.dispatchEvent(new Event('resize'))
      window.visualViewport!.dispatchEvent(new Event('scroll'))
    })
    await fits(64, 424)
    await expect(dialog.locator('.feedback-body')).toHaveCSS('overflow-y', 'auto')
    await dialog.getByRole('textbox', { name: 'Your message' }).fill('Synthetic feedback in a keyboard-sized viewport.')
    await expect(dialog.getByRole('button', { name: 'Send feedback', exact: true })).toBeEnabled()
    if (browserName === 'chromium' && width === 390) await dialog.screenshot({ path: info.outputPath('feedback-keyboard.png') })
  })
}

test('a lost acknowledgement can be retried after closing without changing its idempotency key', async ({ page, browserName }, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await signIn(page)
  const posted: { request_id: string; message: string; category: string; rating: number }[] = []
  await page.route('**/api/account/feedback', async route => {
    posted.push(route.request().postDataJSON())
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    if (posted.length === 1) await route.abort()
    else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Leave feedback', exact: true })
  await dialog.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('idea')
  await dialog.getByRole('textbox', { name: 'Your message' }).fill('Synthetic feedback with a lost server acknowledgement.')
  await dialog.getByText('Add a rating', { exact: false }).click()
  await dialog.getByRole('combobox', { name: 'How was your experience?' }).selectOption('4')
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close feedback', exact: true }).click()
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Your message' })).toHaveValue(/lost server acknowledgement/)
  await expect(dialog.getByRole('combobox', { name: 'Topic', exact: true })).toHaveValue('idea')
  await expect(dialog.getByRole('combobox', { name: 'How was your experience?' })).toHaveValue('4')
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('review queue')
  expect(posted).toHaveLength(2)
  expect(posted[1]).toEqual(posted[0])
  await expect(dialog.getByRole('heading', { name: 'Message received.' })).toBeFocused()
  const bounds = await dialog.boundingBox()
  for (const name of ['Write another', 'Done']) {
    const button = await dialog.getByRole('button', { name, exact: true }).boundingBox()
    expect(button!.x).toBeGreaterThanOrEqual(bounds!.x)
    expect(button!.x + button!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
  }
  if (browserName === 'chromium') await dialog.screenshot({ path: info.outputPath('feedback-sent-320.png') })
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Your message' })).toHaveValue('')
  await expect(dialog.getByRole('combobox', { name: 'Topic', exact: true })).toHaveValue('problem')
})

test('closing during submission keeps the in-flight request and shows its eventual confirmation', async ({ page }) => {
  await signIn(page)
  let finish!: () => void
  const pending = new Promise<void>(resolve => { finish = resolve })
  let requests = 0
  await page.route('**/api/account/feedback', async route => {
    requests++
    await pending
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ received: true }) })
  })
  try {
    const trigger = page.getByRole('button', { name: 'Leave feedback', exact: true })
    const dialog = page.getByRole('dialog', { name: 'Leave feedback', exact: true })
    await trigger.click()
    await dialog.getByRole('textbox', { name: 'Your message' }).fill('Synthetic slow feedback submission.')
    await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Sending…', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Close feedback', exact: true }).click()
    await trigger.click()
    await expect(dialog.getByRole('button', { name: 'Sending…', exact: true })).toBeDisabled()
    finish()
    await expect(dialog.getByRole('status')).toContainText('review queue')
    expect(requests).toBe(1)
  } finally { finish() }
})
