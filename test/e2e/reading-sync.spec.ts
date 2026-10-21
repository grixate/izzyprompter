import { test, expect, devices, type Page } from '@playwright/test'
import { openPromptSettings } from './helpers/display'

const paragraphs = [
  'Короткое вступление. Camera ready.',
  'The second paragraph is deliberately much longer than the others. '.repeat(35).trim(),
  'Третий абзац — café 👋. Different text lengths must not become guessed pixel positions. '.repeat(8).trim(),
  'The final paragraph. '.repeat(12).trim(),
]
type Anchor = { blockId: string; characterOffset: number }
const position = (page: Page) => page.locator('.script-track').evaluate(
  (element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
)
const remotePosition = (page: Page) => page.getByRole('slider', { name: 'Jog script position' })
  .getAttribute('aria-valuenow').then(Number)
const bookmark = (page: Page): Promise<Anchor> => page.evaluate(() => {
  const id = location.pathname.split('/').at(-1)!
  return JSON.parse(localStorage.getItem('izzy.display-positions')!).data[id].anchor
})
const distance = (page: Page, anchor: Anchor) => page.evaluate((target) => {
  const paragraph = [...document.querySelectorAll<HTMLElement>('p[data-block-id]')]
    .find((element) => element.dataset.blockId === target.blockId)!
  const range = document.createRange()
  range.setStart(paragraph.firstChild!, target.characterOffset)
  range.setEnd(paragraph.firstChild!, target.characterOffset + 1)
  const rect = range.getBoundingClientRect()
  return Math.abs((rect.top + rect.bottom) / 2 - document.querySelector('.focus-band')!.getBoundingClientRect().top)
}, anchor)

async function pair(editor: Page, display: Page, remote: Page) {
  await editor.goto('/')
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraphs.join('\n\n'))
  await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
  const displayHref = (await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href'))!
  const remoteHref = (await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!
  await Promise.all([display.goto(displayHref), remote.goto(remoteHref)])
  await expect(display.locator('.script-track p')).toHaveCount(4)
  await expect(remote.locator('.phrase-count')).toContainText('01 / 04')
  await expect(remote.getByRole('slider', { name: 'Jog script position' })).toHaveAttribute('aria-valuetext', /Display position/)
  return displayHref
}

test('phone navigation uses measured paragraphs through typography changes, rapid steps, and reload', async ({ page: editor, browser }) => {
  const displayContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const remoteContext = await browser.newContext(devices['iPhone 13'])
  const display = await displayContext.newPage()
  const remote = await remoteContext.newPage()
  try {
    await pair(editor, display, remote)
    const ids = await display.locator('p[data-block-id]').evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.blockId!))
    await remote.getByRole('button', { name: 'Next phrase' }).click()
    await expect.poll(() => distance(display, { blockId: ids[1], characterOffset: 0 })).toBeLessThan(8)
    await expect(remote.locator('.phrase-count')).toContainText('02 / 04')
    await openPromptSettings(display)
    await display.getByRole('slider', { name: 'Text size', exact: true }).fill('90')
    await display.getByRole('slider', { name: 'Text width', exact: true }).fill('40')
    await display.getByRole('slider', { name: 'Line spacing', exact: true }).fill('1.8')
    await expect.poll(() => distance(display, { blockId: ids[1], characterOffset: 0 })).toBeLessThan(8)
    await expect.poll(async () => Math.abs(await remotePosition(remote) - await position(display))).toBeLessThan(2)
    // Issue both commands without waiting for a display checkpoint between them.
    await remote.getByRole('button', { name: 'Next phrase' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
    await expect.poll(() => distance(display, { blockId: ids[3], characterOffset: 0 })).toBeLessThan(8)
    await expect(remote.locator('.phrase-count')).toContainText('04 / 04')
    await remote.getByRole('button', { name: 'Previous phrase' }).click()
    await expect.poll(() => distance(display, { blockId: ids[2], characterOffset: 0 })).toBeLessThan(8)
    await remote.reload()
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await expect(remote.locator('.phrase-count')).toContainText('03 / 04')
    await expect.poll(async () => Math.abs(await remotePosition(remote) - await position(display))).toBeLessThan(2)
    await display.getByRole('button', { name: 'Close prompt settings' }).click()
    // Keyboard movement on the display must also update the phone's true paragraph.
    await display.locator('.reading-window').click({ position: { x: 100, y: 100 } })
    // A 48px step can still be inside the first 162px-tall line.
    for (let step = 0; step < 6; step += 1) await display.locator('body').press('ArrowUp')
    await expect(remote.locator('.phrase-count')).toContainText('02 / 04')
  } finally {
    await displayContext.close()
    await remoteContext.close()
  }
})

test('only the primary display publishes position and its differently sized backup takes over', async ({ page: editor, browser }) => {
  const primaryContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const backupContext = await browser.newContext({ viewport: { width: 650, height: 1000 } })
  const remoteContext = await browser.newContext()
  const primary = await primaryContext.newPage()
  const backup = await backupContext.newPage()
  const remote = await remoteContext.newPage()
  try {
    const displayHref = await pair(editor, primary, remote)
    await backup.goto(displayHref)
    await expect(backup.locator('.network-state')).toHaveText('CONNECTED')
    await openPromptSettings(backup)
    await backup.getByRole('slider', { name: 'Text size', exact: true }).fill('90')
    await backup.getByRole('slider', { name: 'Text width', exact: true }).fill('45')
    await backup.getByRole('button', { name: 'Close prompt settings' }).click()
    for (const screen of [primary, backup]) {
      await expect(screen.locator('.standalone-display')).toHaveCSS('--prompt-size', '90px')
      await expect(screen.locator('.standalone-display')).toHaveCSS('--prompt-width', '45%')
    }
    await remote.getByRole('button', { name: 'Next phrase' }).click()
    const id = await primary.locator('p[data-block-id]').nth(1).getAttribute('data-block-id')
    const beginning = { blockId: id!, characterOffset: 0 }
    await expect.poll(() => distance(primary, beginning)).toBeLessThan(8)
    await expect.poll(() => distance(backup, beginning)).toBeLessThan(8)
    for (let step = 0; step < 12; step += 1) await primary.locator('body').press('ArrowDown')
    await expect.poll(async () => (await bookmark(primary)).characterOffset).toBeGreaterThan(0)
    await expect.poll(async () => Math.abs(await remotePosition(remote) - await position(primary))).toBeLessThan(2)
    // Reflowing a secondary screen must not replace the primary's pixels.
    await backup.setViewportSize({ width: 900, height: 700 })
    await expect.poll(async () => Math.abs(await position(backup) - await position(primary))).toBeGreaterThan(100)
    await backup.waitForTimeout(650)
    expect(Math.abs(await remotePosition(remote) - await position(primary))).toBeLessThan(2)
    const sharedAnchor = await bookmark(primary)
    await primary.close()
    await expect.poll(() => distance(backup, sharedAnchor)).toBeLessThan(8)
    await expect(remote.getByRole('slider', { name: 'Jog script position' })).toHaveAttribute('aria-valuetext', /Display position/)
    await expect.poll(async () => Math.abs(await remotePosition(remote) - await position(backup))).toBeLessThan(2)
    await expect(remote.locator('.phrase-count')).toContainText('02 / 04')
  } finally {
    await primaryContext.close()
    await backupContext.close()
    await remoteContext.close()
  }
})
