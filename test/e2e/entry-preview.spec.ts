import { test, expect } from '@playwright/test'

test('the entry preview runs independently, scrubs, and never creates a session', async ({ page }) => {
  const creations: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/sessions$/.test(request.url())) creations.push(request.url())
  })
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  const jog = page.getByRole('slider', { name: 'Jog script position' })
  await expect(editor).toHaveValue('')
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeDisabled()
  await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await jog.press('Home')
  await expect(jog).toHaveAttribute('aria-valuenow', '0')
  await jog.press('ArrowRight')
  await expect(jog).toHaveAttribute('aria-valuenow', '48')
  await jog.press('End')
  const maximum = Number(await jog.getAttribute('aria-valuemax'))
  await expect(jog).toHaveAttribute('aria-valuenow', String(Math.round(maximum)))
  await page.getByRole('button', { name: 'Increase speed' }).click()
  await expect(page.getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.91')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeLessThan(maximum)
  await expect(editor).toHaveValue('')
  expect(creations).toEqual([])
  await expect.poll(() => page.evaluate(() => localStorage.getItem('izzy.prompt-settings'))).toBeNull()
})

test('editing pauses the preview, shows your words, and preserves the draft', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  await editor.fill('My own opening line.\n\nA second paragraph for the camera.')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByLabel('Your script preview')).toContainText('My own opening line.')
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeEnabled()
  await page.reload()
  await expect(editor).toHaveValue('My own opening line.\n\nA second paragraph for the camera.')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('login opens account setup without blocking the guest flow', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  if (process.env.IZZY_E2E_DATABASE_URL) await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toBeVisible()
  else await expect(page.getByText('Accounts aren’t configured on this server yet.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Or continue without an account' }).click()
  await expect(page.getByRole('textbox', { name: 'Teleprompter script' })).toBeVisible()
})

test('reduced motion starts the sample paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Jog script position' })).toHaveAttribute('aria-valuenow', '0')
})

test('phone entry has no horizontal overflow and keeps setup before the preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const setup = await page.getByRole('button', { name: 'SET UP PROMPTER' }).boundingBox()
  const preview = await page.getByLabel('Interactive teleprompter preview').boundingBox()
  expect(setup!.y + setup!.height).toBeLessThan(preview!.y)
  expect(setup!.x + setup!.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
