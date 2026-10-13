import { test, expect, type Page } from '@playwright/test'
import { openPromptSettings } from './helpers/display'

type Anchor = { blockId: string; characterOffset: number }
const content = Array.from({ length: 12 }, (_, index) =>
  `Paragraph ${index + 1}. ` + 'These words follow the reading line through every layout change. '.repeat(18),
).join('\n\n')

async function storedAnchor(page: Page): Promise<Anchor> {
  return page.evaluate(() => {
    const id = location.pathname.split('/').at(-1)!
    return JSON.parse(localStorage.getItem('izzy.display-positions')!).data[id].anchor
  })
}

async function anchorDistance(page: Page, anchor: Anchor) {
  return page.evaluate((target) => {
    const paragraph = [...document.querySelectorAll<HTMLElement>('p[data-block-id]')]
      .find((element) => element.dataset.blockId === target.blockId)!
    const text = paragraph.firstChild!
    const range = document.createRange()
    range.setStart(text, target.characterOffset)
    range.setEnd(text, Math.min(text.textContent!.length, target.characterOffset + 1))
    const rect = range.getBoundingClientRect()
    const line = document.querySelector('.focus-band')!.getBoundingClientRect().top
    return Math.abs((rect.top + rect.bottom) / 2 - line)
  }, anchor)
}

async function openDisplay(editor: Page, display: Page, script = content, paragraphs = 12) {
  await editor.goto('/')
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
  await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED')
  const href = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
  await display.goto(href!)
  await expect(display.locator('.script-track p')).toHaveCount(paragraphs)
  await expect(display.locator('.network-state')).toHaveText('CONNECTED')
  // Seek far enough to read a later paragraph.
  for (let step = 0; step < 42; step += 1) await display.locator('body').press('ArrowDown')
  // A key event is not a server acknowledgement. Wait for every command
  // before capturing the bookmark used by the refresh assertion.
  await expect.poll(() => display.evaluate(() => {
    const id = location.pathname.split('/').at(-1)!
    return JSON.parse(localStorage.getItem('izzy.display-positions')!).data[id].serverPosition
  })).toBe(42 * 48)
  await expect.poll(async () => (await storedAnchor(display)).characterOffset).toBeGreaterThan(0)
}

test('refresh, font size, text width, and orientation preserve the reading anchor', async ({ page: editor, browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const display = await context.newPage()
  try {
    await openDisplay(editor, display)
    const before = await storedAnchor(display)
    await display.reload()
    await expect(display.locator('.network-state')).toHaveText('CONNECTED')
    await expect.poll(() => anchorDistance(display, before)).toBeLessThan(8)
    await openPromptSettings(display)
    const beforeFont = await storedAnchor(display)
    await display.getByRole('slider', { name: 'Text size', exact: true }).fill('90')
    await expect.poll(() => anchorDistance(display, beforeFont)).toBeLessThan(8)
    const beforeWidth = await storedAnchor(display)
    await display.getByRole('slider', { name: 'Text width', exact: true }).fill('45')
    await expect.poll(() => anchorDistance(display, beforeWidth)).toBeLessThan(8)
    const beforeSpacing = await storedAnchor(display)
    await display.getByRole('slider', { name: 'Line spacing', exact: true }).fill('1.8')
    await expect.poll(() => anchorDistance(display, beforeSpacing)).toBeLessThan(8)
    await display.screenshot({ path: testInfo.outputPath('display-settings.png') })
    const beforeResize = await storedAnchor(display)
    await display.setViewportSize({ width: 700, height: 1000 })
    await expect.poll(() => anchorDistance(display, beforeResize)).toBeLessThan(8)
    await display.getByRole('checkbox', { name: 'Mirror text' }).check()
    await expect(display.locator('.script-content')).toHaveClass(/is-mirrored/)
    const beforeRefresh = await storedAnchor(display)
    await display.reload()
    await expect(display.locator('.network-state')).toHaveText('CONNECTED')
    await expect.poll(() => anchorDistance(display, beforeRefresh)).toBeLessThan(8)
    await openPromptSettings(display)
    await expect(display.getByRole('slider', { name: 'Text size' })).toHaveValue('90')
    await expect(display.getByRole('slider', { name: 'Text width' })).toHaveValue('45')
    await expect(display.getByRole('checkbox', { name: 'Mirror text' })).toBeChecked()
    // Slider keyboard input must not also scrub the script.
    const original = await storedAnchor(display)
    await display.getByRole('slider', { name: 'Text size' }).press('ArrowDown')
    await expect.poll(() => anchorDistance(display, original)).toBeLessThan(8)
  } finally { await context.close() }
})

test('a 600-paragraph script can play, reflow, and pause without measuring every character', async ({ page: editor, browser }) => {
  const context = await browser.newContext()
  const display = await context.newPage()
  const longScript = Array.from({ length: 600 }, (_, index) =>
    `Section ${index + 1}. ` + 'Long scripts should stay responsive while reading and changing settings. '.repeat(12),
  ).join('\n\n')
  try {
    await openDisplay(editor, display, longScript, 600)
    // Count actual character-range measurements during reflow. Only the
    // active paragraph should be mapped, not the entire half-megabyte script.
    await display.evaluate(() => {
      const original = Range.prototype.getBoundingClientRect
      document.documentElement.dataset.rangeReads = '0'
      Range.prototype.getBoundingClientRect = function () {
        document.documentElement.dataset.rangeReads = String(Number(document.documentElement.dataset.rangeReads) + 1)
        return original.call(this)
      }
    })
    // Exercise the hidden-toolbar path rather than depending on the runner
    // completing setup inside the three-second visibility window.
    await expect(display.locator('.display-header')).toHaveClass(/is-hidden/)
    await openPromptSettings(display)
    const anchor = await storedAnchor(display)
    await display.getByRole('slider', { name: 'Text width', exact: true }).fill('55')
    await expect.poll(() => anchorDistance(display, anchor)).toBeLessThan(8)
    const measurements = Number(await display.locator('html').getAttribute('data-range-reads'))
    expect(measurements).toBeGreaterThan(0)
    expect(measurements).toBeLessThan(2_000)
    await display.getByRole('button', { name: 'Close prompt settings' }).click()
    const position = () => display.locator('.script-track').evaluate(
      (element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
    )
    const beforePlay = await position()
    await display.getByRole('button', { name: 'Play', exact: true }).click()
    await expect.poll(position).toBeGreaterThan(beforePlay + 20)
    await display.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    const paused = await position()
    await expect.poll(position).toBeCloseTo(paused, 0)
  } finally { await context.close() }
})

test('a remote seek while display is closed takes precedence over its old bookmark', async ({ page: editor, browser }) => {
  const context = await browser.newContext()
  const display = await context.newPage()
  const remoteContext = await browser.newContext()
  const remote = await remoteContext.newPage()
  try {
    await openDisplay(editor, display)
    const displayHref = display.url()
    const targetId = await display.evaluate((anchor) => {
      const blocks = [...document.querySelectorAll<HTMLElement>('p[data-block-id]')]
      const index = blocks.findIndex((block) => block.dataset.blockId === anchor.blockId)
      return blocks[Math.min(blocks.length - 1, index + 1)].dataset.blockId!
    }, await storedAnchor(display))
    await display.close()
    const remoteHref = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
    await remote.goto(remoteHref!)
    await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
    await remote.getByRole('button', { name: 'Next phrase' }).click()
    const reopened = await context.newPage()
    await reopened.goto(displayHref)
    await expect(reopened.locator('.network-state')).toHaveText('CONNECTED')
    await expect.poll(() => anchorDistance(reopened, { blockId: targetId, characterOffset: 0 })).toBeLessThan(8)
  } finally {
    await context.close()
    await remoteContext.close()
  }
})
