import { test, expect, type Page } from '@playwright/test'
import { phoneOptions } from './helpers/phone'

const paragraphs = ['Opening words. '.repeat(12).trim(), 'The current paragraph has a camera-ready line. '.repeat(40).trim(), 'Closing words. '.repeat(15).trim()]
async function pair(editor: Page, display: Page, remote: Page) {
  await editor.goto('/')
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraphs.join('\n\n'))
  await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
  const displayLink = (await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href'))!
  const remoteLink = (await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!
  await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
  await expect(remote.getByRole('button', { name: 'Next phrase' })).toBeEnabled()
  await remote.getByRole('button', { name: 'Next phrase' }).click()
  await expect(remote.locator('.phrase-count')).toContainText('02 / 03')
  await expect(remote.getByRole('button', { name: 'Quick edit current paragraph' })).toBeEnabled()
  return { displayLink, remoteLink }
}

test('typing is live on two displays, the editor, and another phone before Done', async ({ page: editor, browser, browserName }, testInfo) => {
  // Five independent screens, live edits and reload recovery, including native
  // context teardown on Linux WebKit. Individual assertions retain their limits.
  test.setTimeout(60_000)
  const displays = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const backupContext = await browser.newContext({ viewport: { width: 700, height: 900 } })
  const phones = await browser.newContext(phoneOptions(browserName))
  const observerContext = await browser.newContext()
  const display = await displays.newPage(), backup = await backupContext.newPage(), remote = await phones.newPage(), observer = await observerContext.newPage()
  try {
    const links = await pair(editor, display, remote)
    await Promise.all([backup.goto(links.displayLink), observer.goto(links.remoteLink)])
    await expect(backup.locator('.script-track p')).toHaveCount(3)
    const ids = await display.locator('p[data-block-id]').evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.blockId))
    for (let step = 0; step < 12; step += 1) await display.locator('body').press('ArrowDown')
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveValue(paragraphs[1])
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    await observer.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await expect(observer.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveAttribute('readonly', '')
    const originalAnchor = await display.evaluate(() => {
      const id = location.pathname.split('/').at(-1)!
      return JSON.parse(localStorage.getItem('izzy.display-positions')!).data[id].anchor as { blockId: string; characterOffset: number }
    })
    expect(originalAnchor.characterOffset).toBeGreaterThan(0)
    const prefix = 'Live correction 🎥 — café. '
    const corrected = prefix + paragraphs[1]
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill(corrected)
    for (const screen of [display, backup]) await expect(screen.locator('.script-track p').nth(1)).toHaveText(corrected)
    await expect(editor.locator('.pairing-live-edit p')).toHaveText(corrected)
    await expect(observer.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveValue(corrected)
    await expect(remote.getByRole('status').filter({hasText:/^Updated$/})).toBeVisible()
    expect(await display.locator('p[data-block-id]').evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.blockId))).toEqual(ids)
    // The original word after the insertion is still at the reading line.
    for (const screen of [display, backup]) {
      const distance = await screen.evaluate((anchor) => {
      const p = document.querySelector(`[data-block-id="${anchor.blockId}"]`)!
      const range = document.createRange(); range.setStart(p.firstChild!, anchor.characterOffset); range.setEnd(p.firstChild!, anchor.characterOffset + 1)
      const rect = range.getBoundingClientRect()
      return Math.abs((rect.top + rect.bottom) / 2 - document.querySelector('.focus-band')!.getBoundingClientRect().top)
      }, { ...originalAnchor, characterOffset: originalAnchor.characterOffset + prefix.length })
      expect(distance).toBeLessThan(8)
    }
    await remote.screenshot({ path: testInfo.outputPath('quick-edit-phone.png') })
    const last = corrected + ' Last keystrokes.'
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).press('End')
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill(last)
    await expect(display.locator('.script-track p').nth(1)).toHaveText(last)
    await remote.getByRole('button', { name: 'Done', exact: false }).click()
    await expect(remote.getByRole('dialog')).not.toBeVisible()
    await expect(remote.getByRole('button', { name: 'Quick edit current paragraph' })).toBeFocused()
    await expect(remote.locator('.state-label')).toHaveText('HOLD')
    await observer.getByRole('button', { name: 'Done', exact: false }).click()
    await editor.reload()
    await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
    await editor.getByRole('button', { name: 'EDIT SCRIPT', exact: true }).click()
    await expect(editor.getByRole('textbox', { name: 'Teleprompter script' })).toHaveValue([paragraphs[0], last, paragraphs[2]].join('\n\n'))
  } finally { await displays.close(); await backupContext.close(); await phones.close(); await observerContext.close() }
})

test('recovered offline draft never overwrites a correction from another phone', async ({ page: editor, browser }) => {
  const displayContext = await browser.newContext()
  const phoneContext = await browser.newContext()
  const otherContext = await browser.newContext()
  const display = await displayContext.newPage(), remote = await phoneContext.newPage(), other = await otherContext.newPage()
  try {
    const links = await pair(editor, display, remote)
    await other.goto(links.remoteLink)
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
    await phoneContext.setOffline(true)
    await expect(remote.locator('.network-state')).not.toHaveText('CONNECTED')
    const draft = 'Unsent old draft. ' + paragraphs[1]
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill(draft)
    await expect(other.getByRole('button', { name: 'Quick edit current paragraph' })).toHaveText('QUICK EDIT')
    await other.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    const correction = 'Accepted from the other phone. ' + paragraphs[1]
    await other.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill(correction)
    await expect(display.locator('.script-track p').nth(1)).toHaveText(correction)
    await other.getByRole('button', { name: 'Done', exact: false }).click()
    await phoneContext.setOffline(false)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'RESUME LIVE EDIT' }).click()
    await expect(remote.getByRole('alert')).toContainText('The live text changed')
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveValue(draft)
    await expect(display.locator('.script-track p').nth(1)).toHaveText(correction)
    await remote.getByRole('button', { name: 'USE LIVE TEXT' }).click()
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveValue(correction)
    await expect(remote.getByRole('status').filter({hasText:/^Updated$/})).toBeVisible()
    await remote.getByRole('button', { name: 'Done', exact: false }).click()
    await expect(remote.getByRole('dialog')).not.toBeVisible()
  } finally { await displayContext.close(); await phoneContext.close(); await otherContext.close() }
})

test('offline draft survives refresh and is sent only after explicit resume', async ({ page: editor, browser }) => {
  const displayContext = await browser.newContext()
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const display = await displayContext.newPage(), remote = await phoneContext.newPage()
  try {
    await pair(editor, display, remote)
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
    await phoneContext.setOffline(true)
    await expect(remote.locator('.network-state')).not.toHaveText('CONNECTED')
    const draft = 'Unsent correction. ' + paragraphs[1]
    await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill(draft)
    await expect(display.locator('.script-track p').nth(1)).toHaveText(paragraphs[1])
    await phoneContext.setOffline(false)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.reload()
    await expect(remote.getByRole('dialog')).toBeVisible()
    await expect(remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveValue(draft)
    await expect(display.locator('.script-track p').nth(1)).toHaveText(paragraphs[1])
    await remote.getByRole('button', { name: 'RESUME LIVE EDIT' }).click()
    await expect(display.locator('.script-track p').nth(1)).toHaveText(draft)
    await expect(remote.getByRole('status').filter({hasText:/^Updated$/})).toBeVisible()
    await remote.getByRole('button', { name: 'Done', exact: false }).click()
    await expect(remote.getByRole('dialog')).not.toBeVisible()
  } finally { await displayContext.close(); await phoneContext.close() }
})

test('an unsent phone edit with unavailable storage offers a backup without claiming reload recovery', async ({ page: editor, browser }) => {
  const displayContext = await browser.newContext()
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await phoneContext.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage) throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  const display = await displayContext.newPage(), remote = await phoneContext.newPage()
  try {
    await pair(editor, display, remote)
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    const field = remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })
    await expect(field).toBeFocused()
    await phoneContext.setOffline(true)
    await expect(remote.locator('.network-state')).not.toHaveText('CONNECTED')
    const draft = 'This draft currently exists only in this tab.'
    await field.fill(draft)
    await expect(remote.getByRole('alert').filter({ hasText: 'LOCAL SAVE UNAVAILABLE' })).toContainText('Unsent edits exist only in this tab')
    const downloaded = remote.waitForEvent('download')
    await remote.getByRole('button', { name: 'DOWNLOAD DRAFT' }).click()
    expect((await downloaded).suggestedFilename()).toBe('izzy-paragraph.txt')
    await remote.getByRole('button', { name: 'Close · keep draft' }).click()
    await expect(remote.getByRole('dialog')).not.toBeVisible()
    await expect(display.locator('.script-track p').nth(1)).toHaveText(paragraphs[1])
    await phoneContext.setOffline(false)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await expect(field).toHaveValue(draft)
    await remote.getByRole('button', { name: 'RESUME LIVE EDIT' }).click()
    await expect(display.locator('.script-track p').nth(1)).toHaveText(draft)
    await expect(remote.getByRole('status').filter({hasText:/^Updated$/})).toBeVisible()
    await remote.getByRole('button', { name: 'Done', exact: false }).click()
  } finally { await displayContext.close(); await phoneContext.close() }
})
