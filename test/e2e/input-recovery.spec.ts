import { test, expect } from '@playwright/test'

test('paste outside the textarea normalizes rich text and survives immediate refresh', async ({ page, context, baseURL, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native clipboard permission automation is Chromium-only; portable paste-event coverage runs on all engines.')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Your screen is the prompter/ })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob(['Первый\u00a0абзац.\r\n\r\n\r\nSecond paragraph.'], { type: 'text/plain' }),
      'text/html': new Blob(['<p style="color:red">First</p><script>bad()</script>'], { type: 'text/html' }),
    })])
  })
  await page.getByRole('link', { name: 'Log in', exact: true }).focus()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  await expect(editor).toHaveValue('Первый абзац.\n\nSecond paragraph.')
  await expect(page.getByRole('status')).toHaveText('PASTE CLEAN · READY')
  // Navigate immediately so pagehide flush, rather than the debounce, preserves the draft.
  await page.goto(`${baseURL}/?reload=1`)
  await expect(editor).toHaveValue('Первый абзац.\n\nSecond paragraph.')
  await page.getByRole('button', { name: 'START OVER', exact: true }).click()
  await expect(editor).not.toHaveValue('')
  await page.getByRole('button', { name: 'CONFIRM START OVER' }).click()
  await expect(editor).toHaveValue('')
  await page.reload()
  await expect(editor).toHaveValue('')
  await expect(page.getByRole('heading', { name: /Your screen is the prompter/ })).toBeVisible()
})

test('plain-text paste event ignores rich markup and survives immediate refresh', async ({ page, baseURL }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Log in', exact: true }).focus()
  await page.evaluate(() => {
    const transfer = new DataTransfer()
    transfer.setData('text/plain', 'Первый\u00a0абзац.\r\n\r\n\r\nSecond paragraph.')
    transfer.setData('text/html', '<p style="color:red">Foreign</p><script>bad()</script>')
    // Firefox deliberately strips payloads from constructed ClipboardEvents.
    // Supply the event payload explicitly: this tests our paste handler, not
    // native OS clipboard access (covered separately where supported).
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: transfer })
    document.activeElement!.dispatchEvent(event)
  })
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  await expect(editor).toHaveValue('Первый абзац.\n\nSecond paragraph.')
  await expect(page.getByRole('status')).toHaveText('PASTE CLEAN · READY')
  await page.goto(`${baseURL}/?reload=1`)
  await expect(editor).toHaveValue('Первый абзац.\n\nSecond paragraph.')
})

test('file import normalizes text, persists it, and preserves it on invalid input', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'Camera notes.MD', mimeType: 'text/markdown',
    buffer: Buffer.from('\ufeffOpening\u00a0line\r\n\r\n\r\nSecond line.'),
  })
  await expect(editor).toHaveValue('Opening line\n\nSecond line.')
  await expect(page.getByRole('status')).toHaveText('LOADED · CAMERA NOTES.MD')
  await input.setInputFiles({ name: 'unsupported.pdf', mimeType: 'application/pdf', buffer: Buffer.from('ignored') })
  await expect(page.getByRole('status')).toHaveText('UNSUPPORTED FORMAT · USE .TXT OR .MD')
  await expect(editor).toHaveValue('Opening line\n\nSecond line.')
  await page.reload()
  await expect(editor).toHaveValue('Opening line\n\nSecond line.')
})

test('corrupt storage recovers to a usable editor', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('izzy.document', '{broken')
    localStorage.setItem('izzy.draft', '{broken')
    localStorage.setItem('izzy.prompt-settings', '{broken')
    localStorage.setItem('izzy.prompt-position', '{broken')
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Your screen is the prompter/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill('Recovery works.')
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeEnabled()
})

test('dropping a file loads its text and invalid drops preserve the draft', async ({ page }) => {
  await page.goto('/')
  const surface = page.locator('.editor-input')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  const validDrop = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['Dropped\u00a0text\r\n\r\nSecond paragraph.'], 'take.txt', { type: 'text/plain' }))
    return transfer
  })
  const invalidDrop = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['ignored'], 'take.docx'))
    return transfer
  })

  try {
    await surface.dispatchEvent('dragenter', { dataTransfer: validDrop })
    await expect(surface).toHaveClass(/is-dragging/)
    await surface.dispatchEvent('drop', { dataTransfer: validDrop })
    await expect(editor).toHaveValue('Dropped text\n\nSecond paragraph.')
    await expect(surface).not.toHaveClass(/is-dragging/)
    await surface.dispatchEvent('drop', { dataTransfer: invalidDrop })
    await expect(page.getByRole('status')).toHaveText('UNSUPPORTED FORMAT · USE .TXT OR .MD')
    await expect(editor).toHaveValue('Dropped text\n\nSecond paragraph.')
  } finally {
    await validDrop.dispose()
    await invalidDrop.dispose()
  }
})
