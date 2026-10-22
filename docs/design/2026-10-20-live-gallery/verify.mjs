import { chromium, webkit, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('./', import.meta.url)
const items = JSON.parse(await readFile(new URL('../2026-10-20-touch-layout/instruments.json', root)))
const results = []
for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1320 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto('http://127.0.0.1:8780/2026-10-20-live-gallery/review.html')
    await expect(page.locator('iframe')).toHaveCount(14)
    for (const [id] of items) {
      const card = page.locator(`#${id}`)
      await card.scrollIntoViewIfNeeded()
      const frame = page.frameLocator(`#${id} iframe`)
      const speed = frame.getByRole('slider', { name: 'Playback speed', exact: true })
      const jog = frame.getByRole('slider', { name: 'Jog script position' })
      await expect(speed).toHaveValue('0.56')
      const geometry = await frame.locator('main').evaluate(el => ({
        width: innerWidth, height: innerHeight,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overflowY: el.scrollHeight - el.clientHeight
      }))
      expect(geometry).toEqual({ width: 428, height: 746, overflowX: 0, overflowY: 0 })
      await frame.getByRole('button', { name: 'Play', exact: true }).click()
      await expect(frame.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
      await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(310)
      await frame.getByRole('button', { name: 'Pause', exact: true }).click()
      await frame.getByRole('button', { name: 'Next phrase' }).click()
      await expect(jog).toHaveAttribute('aria-valuenow', '600')
      await jog.press('ArrowRight')
      await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(600)
      const beforeDrag = Number(await jog.getAttribute('aria-valuenow'))
      const box = await jog.boundingBox()
      await page.mouse.move(box.x + box.width * .84, box.y + box.height * .5)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .84, { steps: 12 })
      await page.mouse.up()
      await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).not.toBe(beforeDrag)
      const exact = frame.getByRole('textbox', { name: 'Exact playback speed' })
      await exact.fill('0.62')
      await exact.press('Enter')
      await expect(speed).toHaveValue('0.62')
      await speed.press('ArrowRight')
      await expect(speed).toHaveValue('0.63')
      await frame.getByRole('button', { name: 'Quick edit current paragraph' }).click()
      const editor = frame.getByRole('textbox', { name: 'Demo current paragraph' })
      await expect(editor).toBeFocused()
      await editor.fill('Synthetic gallery test.')
      await frame.getByRole('button', { name: 'Done', exact: true }).click()
      await expect(editor).not.toBeVisible()
      await card.getByRole('button', { name: `Сбросить` }).click()
      await expect(speed).toHaveValue('0.56')
      await expect(jog).toHaveAttribute('aria-valuenow', '310')
      results.push({ engine, id, ...geometry, playPause: true, phrase: true, jogKeyboardAndDrag: true, speed: true, editor: true, reset: true })
    }
    await page.locator('#mode').selectOption('standalone')
    const orbit = page.frameLocator('#ivory iframe')
    expect(await orbit.locator('main').evaluate(() => innerHeight)).toBe(926)
    await page.locator('#mode').selectOption('browser')
    await page.locator('#zoom').selectOption('0.75')
    expect(await orbit.locator('main').evaluate(() => [innerWidth, innerHeight])).toEqual([428, 746])
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    expect(await orbit.locator('main').evaluate(() => [innerWidth, innerHeight])).toEqual([428, 746])
    await page.locator('#jump').selectOption('ivory')
    await expect.poll(async () => Math.abs((await page.locator('#ivory').boundingBox()).y - 20)).toBeLessThan(2)
    await page.setViewportSize({ width: 1440, height: 1320 })
    await page.locator('#zoom').selectOption('1')
    await page.evaluate(() => scrollTo(0, 0))
    if (engine === 'chromium') await page.screenshot({ path: new URL('gallery.png', root).pathname })
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
}
await writeFile(new URL('checks.json', root), JSON.stringify({ results, pageErrors: 0, physicalDevices: false }, null, 2) + '\n')
console.log('Passed: 14 live frames × Chromium/WebKit, viewport, controls, editing, reset, scale and navigation.')
