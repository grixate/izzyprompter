import { test, expect } from '@playwright/test'

const text = 'A synthetic field script.\n\nReady to read without the internet.'

test('the menu switch starts offline preparation and opens both steps without another setup action', async ({ page, context }) => {
  await page.setViewportSize({ width: 428, height: 926 })
  await page.goto('/')
  await page.getByRole('group', { name: 'Connection mode' }).getByRole('button', { name: 'Offline', exact: true }).click()
  await expect(page).toHaveURL('/local')
  const requests: string[] = []
  page.on('request', r => { if (/\/api\/|\/socket/.test(r.url())) requests.push(new URL(r.url()).pathname) })
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choose your controls' })).toBeVisible()
  await expect(page.locator('details')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Offline app preparation' })).toHaveAttribute('data-state', 'ready')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  await context.setOffline(true)
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/local')
  await expect(reopened.getByRole('textbox', { name: 'Local script text' })).toBeEditable()
  await expect(reopened.getByText('Ready offline', { exact: true })).toBeVisible()
  expect(requests).toEqual([])
})

test('visible upload, default local controls and start save a real script without a separate save step', async ({ page }) => {
  await page.goto('/local')
  await expect(page.getByRole('button', { name: 'Start reading', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Upload text file' })).toBeVisible()
  await page.getByLabel('Upload script file').setInputFiles({ name: 'Field notes.md', mimeType: 'text/markdown', buffer: Buffer.from(text) })
  await expect(page.getByRole('textbox', { name: 'Local script title' })).toHaveValue('Field notes.md')
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(text)
  await expect(page.getByRole('radio', { name: /Use this device/ })).toBeChecked()
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  await expect(page.locator('.script-track p')).toHaveCount(2)
  await expect(page.locator('.display-footer')).toContainText('STANDBY')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to local scripts' }).click()
  await expect(page.getByRole('button', { name: 'Field notes.md', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(text)
})

test('phone choice goes straight into visible connection steps and can fall back without losing text', async ({ page }) => {
  await page.setViewportSize({ width: 428, height: 926 })
  await page.goto('/local')
  await page.getByRole('textbox', { name: 'Local script text' }).fill(text)
  await page.getByRole('radio', { name: /Connect a phone/ }).check()
  await page.getByRole('button', { name: 'Connect phone & start', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Open the controls on your phone' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create connection file', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Upload phone reply', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Upload phone reply', exact: true })).toBeDisabled()
  await expect(dialog.locator('details')).toHaveCount(0)
  await expect(dialog.locator('textarea')).toHaveCount(0)
  expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await dialog.getByRole('button', { name: 'Close direct pairing' }).click()
  await expect(page.locator('.script-track p').first()).toHaveText('A synthetic field script.')
  await page.getByRole('button', { name: 'Back to local scripts' }).click()
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(text)
})

test('preparation failure keeps text editable and retry prepares without reloading or discarding it', async ({ page }) => {
  await page.addInitScript(() => {
    const register = ServiceWorkerContainer.prototype.register
    let fail = true
    ServiceWorkerContainer.prototype.register = function (...args) {
      if (fail) { fail = false; return Promise.reject(new DOMException('Keep internet connected and retry.', 'NetworkError')) }
      return register.apply(this, args)
    }
  })
  await page.goto('/local')
  const preparation = page.getByRole('region', { name: 'Offline app preparation' })
  await expect(preparation).toHaveAttribute('data-state', 'error')
  await page.getByRole('textbox', { name: 'Local script text' }).fill(text)
  await preparation.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(preparation).toHaveAttribute('data-state', 'ready')
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(text)
})

test('phone entry prepares automatically, exposes file upload and handles bad files without navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/local/remote')
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turn this phone into your remote.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload connection file', exact: true })).toBeVisible()
  await expect(page.locator('details')).toHaveCount(0)
  await page.getByLabel('Upload connection file', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('not a connection') })
  await expect(page.getByRole('status').filter({ hasText: 'Could not connect.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download phone reply', exact: true })).toHaveCount(0)
  expect(await page.locator('main').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
})

test('copying the online draft is explicit and keeps online and offline drafts independent', async ({ page }) => {
  const online = 'Synthetic online draft to bring into the offline workspace.'
  await page.goto('/')
  await page.locator('.editor-input textarea').fill(online)
  await page.getByRole('group', { name: 'Connection mode' }).getByRole('button', { name: 'Offline', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue('')
  await page.getByRole('button', { name: 'Use online draft', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(online)
  await page.getByRole('textbox', { name: 'Local script text' }).fill(text)
  await page.getByRole('group', { name: 'Connection mode' }).getByRole('button', { name: 'Online', exact: true }).click()
  await expect(page.locator('.editor-input textarea')).toHaveValue(online)
  await page.getByRole('group', { name: 'Connection mode' }).getByRole('button', { name: 'Offline', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(text)
})
