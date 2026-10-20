import { createSyntheticSession } from './helpers/create-synthetic-session'
import { test, expect, type Page } from '@playwright/test'
import { skins, skinStorageKey, controlCraftSkins } from '../../src/product/catalog'
import { phoneOptions } from './helpers/phone'
import { checkRenderedContrast } from './helpers/rendered-contrast'
import { tabKey } from './helpers/keyboard'

// Pairing URLs are capabilities: do not put them in traces or editor snapshots.
test.use({ trace: 'off', screenshot: 'off' })

const paragraphs = [
  'Opening synthetic camera notes. '.repeat(12).trim(),
  'A longer second paragraph for scrubbing, playback and live corrections. '.repeat(30).trim(),
  'Closing synthetic camera notes. '.repeat(12).trim(),
]
const jog = (page: Page) => page.getByRole('slider', { name: 'Jog script position' })
const position = (page: Page) => jog(page).getAttribute('aria-valuenow').then(Number)
const displayPosition = (page: Page) => page.locator('.script-track').evaluate(el => -new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)
const paragraphDistance = (page: Page, index: number) => page.locator('.script-track p').nth(index).evaluate(el => {
  const range = document.createRange(); range.setStart(el.firstChild!, 0); range.setEnd(el.firstChild!, 1)
  const rect = range.getBoundingClientRect()
  return Math.abs((rect.top + rect.bottom) / 2 - document.querySelector('.focus-band')!.getBoundingClientRect().top)
})

async function pair(editor: Page, display: Page, remote: Page) {
  await editor.goto('/')
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraphs.join('\n\n'))
  await createSyntheticSession(editor)
  const displayHref = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
  const remoteHref = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
  // Entitlement is the only simulated API; transport and reading use Phoenix.
  await remote.route('**/api/sessions/*/appearance', route => route.fulfill({ json: { pro: true } }))
  await Promise.all([display.goto(displayHref!), remote.goto(remoteHref!)])
  await expect(jog(remote)).toHaveAttribute('aria-valuetext', /Display position/)
  await expect(remote.getByRole('button', { name: 'Next phrase' })).toBeEnabled()
  await editor.goto('about:blank')
}

async function turn(page: Page, clockwise: boolean) {
  const box = (await page.locator('.jog-wheel').boundingBox())!
  const x = box.x + box.width / 2, y = box.y + box.height / 2, radius = box.width * .41
  await page.mouse.move(x + radius, y)
  await page.mouse.down()
  for (let step = 1; step <= 8; step++) {
    const angle = step * Math.PI / 16 * (clockwise ? 1 : -1)
    await page.mouse.move(x + radius * Math.cos(angle), y + radius * Math.sin(angle))
  }
  await page.mouse.up()
  await expect(page.locator('.jog-wheel')).not.toHaveClass(/is-dragging/)
}

for (const skin of skins) {
  test(`${skin.name}: real paired transport, editing and recovery`, async ({ page: editor, browser, browserName }, testInfo) => {
    test.setTimeout(60_000)
    const displays = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const phones = await browser.newContext(phoneOptions(browserName))
    await phones.addInitScript(({ key, id }) => localStorage.setItem(key, id), { key: skinStorageKey, id: skin.id })
    const display = await displays.newPage(), remote = await phones.newPage()
    try {
      await pair(editor, display, remote)
      await expect(remote.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
      await expect(remote.locator('.remote-identity strong')).toHaveText(`R–${skin.number}`)
      await checkRenderedContrast(remote, testInfo)
      if (browserName === 'chromium') await remote.locator('main').screenshot({ path: testInfo.outputPath(`${skin.id}-paired.png`) })
      await remote.getByRole('button', { name: 'Play', exact: true }).click()
      const start = await displayPosition(display)
      await expect.poll(() => displayPosition(display)).toBeGreaterThan(start + 20)
      await expect(remote.locator('.state-label')).toHaveText('RUN')
      await expect(remote.locator('.jog-wheel')).toHaveAttribute('data-running', 'true')
      if (browserName === 'chromium' && ['groove','clear','spool','field','aperture','foundry'].includes(skin.id)) {
        await expect.poll(() => remote.locator('.jog-wheel').evaluate(el => el.getAnimations({subtree:true}).filter(a => a.effect?.getTiming().iterations !== Infinity).length)).toBe(0)
        await remote.locator('main').screenshot({path: testInfo.outputPath(`${skin.id}-running.png`)})
      }
      await remote.getByRole('button', { name: 'Pause', exact: true }).click()
      await expect(display.locator('.display-footer')).toContainText('STANDBY')
      await expect(remote.locator('.state-label')).toHaveText('HOLD')
      await expect(remote.locator('.jog-wheel')).toHaveAttribute('data-running', 'false')
      await expect.poll(() => remote.locator('.jog-wheel').evaluate(el => el.getAnimations({subtree:true}).length)).toBe(0)
      await remote.getByRole('button', { name: 'Next phrase' }).click()
      await expect(remote.locator('.phrase-count')).toContainText('02 / 03')
      await expect.poll(() => paragraphDistance(display, 1)).toBeLessThan(8)
      await expect.poll(async () => Math.abs(await position(remote) - await displayPosition(display))).toBeLessThan(3)
      const before = await position(remote)
      await turn(remote, true)
      await expect.poll(() => position(remote)).toBeGreaterThan(before + 60)
      await expect.poll(async () => Math.abs(await position(remote) - await displayPosition(display))).toBeLessThan(3)
      await turn(remote, false)
      await expect.poll(() => position(remote)).toBeLessThan(before + 40)
      // Synthetic cancellation of a real captured gesture, without a pointerup.
      const cancelWheel = remote.locator('.jog-wheel')
      await cancelWheel.evaluate(el => el.addEventListener('pointerdown', event => {
        (el as HTMLElement).dataset.testPointer = String((event as PointerEvent).pointerId)
      }, { once: true }))
      const cancelBox = (await cancelWheel.boundingBox())!
      await remote.mouse.move(cancelBox.x + cancelBox.width * .91, cancelBox.y + cancelBox.height / 2)
      await remote.mouse.down()
      await expect(cancelWheel).toHaveClass(/is-dragging/)
      const pointerId = await cancelWheel.evaluate(el => Number((el as HTMLElement).dataset.testPointer))
      await cancelWheel.dispatchEvent('pointercancel', { pointerId })
      await expect(cancelWheel).not.toHaveClass(/is-dragging/)
      await remote.mouse.up()
      await jog(remote).press('End')
      await expect(remote.locator('.phrase-count')).toContainText('03 / 03')
      await jog(remote).press('Home')
      await expect(remote.locator('.phrase-count')).toContainText('01 / 03')
      await expect.poll(() => paragraphDistance(display, 0)).toBeLessThan(8)
      // The first measured line can sit below pixel zero; assert the display's
      // real position rather than assuming an anchor is a raw pixel endpoint.
      await expect.poll(async () => Math.abs(await position(remote) - await displayPosition(display))).toBeLessThan(3)
      for (const key of ['ArrowRight', 'PageDown']) {
        const previous = await displayPosition(display)
        await jog(remote).press(key)
        await expect.poll(() => displayPosition(display)).toBeGreaterThan(previous)
        await expect.poll(async () => Math.abs(await position(remote) - await displayPosition(display))).toBeLessThan(3)
      }
      for (const key of ['ArrowLeft', 'PageUp']) {
        const previous = await displayPosition(display)
        await jog(remote).press(key)
        await expect.poll(() => displayPosition(display)).toBeLessThan(previous)
        await expect.poll(async () => Math.abs(await position(remote) - await displayPosition(display))).toBeLessThan(3)
      }
      const speed = remote.getByRole('slider', { name: 'Playback speed' })
      if(controlCraftSkins.has(skin.id)) {
        const exact=remote.getByRole('textbox',{name:'Exact playback speed'})
        await expect(remote.getByRole('button',{name:'Increase speed'})).toHaveCount(0)
        await exact.fill('1.37');await exact.press('Enter');await expect(speed).toHaveValue('1.37')
        await expect(display.locator('.display-footer')).toContainText('1.37×')
        await speed.press('End');await speed.press('ArrowUp');await expect(speed).toHaveValue('1.5')
        await speed.press('ArrowDown');await expect(speed).toHaveValue('1.49')
        await speed.press('Home');await speed.press('ArrowDown');await expect(speed).toHaveValue('0.5')
        await speed.press('ArrowUp');await expect(speed).toHaveValue('0.51')
      } else {
        await speed.fill('1.5')
        await remote.getByRole('button', { name: 'Increase speed' }).click()
        await expect(speed).toHaveValue('1.5')
        await remote.getByRole('button', { name: 'Decrease speed' }).click()
        await expect(speed).toHaveValue('1.45')
        await speed.fill('0.5')
        await remote.getByRole('button', { name: 'Decrease speed' }).click()
        await expect(speed).toHaveValue('0.5')
        await remote.getByRole('button', { name: 'Increase speed' }).click()
        await expect(speed).toHaveValue('0.55')
      }
      await remote.getByRole('button', { name: 'Next phrase' }).click()
      await expect(remote.locator('.phrase-count')).toContainText('02 / 03')
      await remote.getByRole('button', { name: 'Previous phrase' }).click()
      await expect(remote.locator('.phrase-count')).toContainText('01 / 03')
      await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
      await remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' }).fill('Corrected synthetic opening. ' + paragraphs[0])
      await expect(display.locator('.script-track p').first()).toHaveText('Corrected synthetic opening. ' + paragraphs[0])
      await remote.getByRole('button', { name: 'DONE', exact: false }).click()
      // Disconnect in the middle of an actual captured pointer gesture.
      const wheel = remote.locator('.jog-wheel')
      await wheel.scrollIntoViewIfNeeded()
      await wheel.evaluate(el => el.addEventListener('pointerdown', event => {
        (el as HTMLElement).dataset.testPointer = String((event as PointerEvent).pointerId)
      }, { once: true }))
      const box = (await wheel.boundingBox())!
      await remote.mouse.move(box.x + box.width * .91, box.y + box.height / 2)
      await remote.mouse.down()
      await expect(wheel).toHaveClass(/is-dragging/)
      await phones.setOffline(true)
      await expect(jog(remote)).toHaveAttribute('aria-disabled', 'true')
      await expect(remote.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
      await expect(speed).toBeDisabled()
      await expect(wheel).toHaveAttribute('data-available', 'false')
      await expect(wheel).toHaveAttribute('data-running', 'false')
      expect(await wheel.evaluate(el => el.hasPointerCapture(Number((el as HTMLElement).dataset.testPointer)))).toBe(false)
      await jog(remote).press('PageDown')
      await phones.setOffline(false)
      await expect(jog(remote)).toHaveAttribute('aria-disabled', 'false')
      await remote.mouse.move(box.x + box.width / 2, box.y + box.height * .91)
      await remote.mouse.up()
      await expect(wheel).not.toHaveClass(/is-dragging/)
      await expect.poll(async () => Math.abs(await position(remote) - await displayPosition(display))).toBeLessThan(3)
      await expect(remote.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
      await remote.reload()
      await expect(jog(remote)).toHaveAttribute('aria-disabled', 'false')
      await expect(remote.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
    } finally { await phones.close(); await displays.close() }
  })

  test(`${skin.name}: responsive controls, keyboard focus and reduced motion`, async ({ page, browserName }, testInfo) => {
    // Five complete viewport/focus cycles need room on Linux WebKit runners.
    test.setTimeout(60_000)
    await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), { key: skinStorageKey, id: skin.id })
    await page.route('**/api/sessions/*/appearance', route => route.fulfill({ json: { pro: true } }))
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraphs.join('\n\n'))
    await createSyntheticSession(page)
    await page.goto((await page.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href'))!)
    await expect(page.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport)
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${viewport.width}: horizontal overflow`).toBeLessThanOrEqual(1)
      for (const name of controlCraftSkins.has(skin.id)?['Play','Exact playback speed','Playback speed']:['Play', 'Decrease speed', 'Increase speed', 'Playback speed']) {
        const control = page.getByRole(name === 'Playback speed' ? 'slider' : name==='Exact playback speed'?'textbox':'button', { name, exact: true })
        const box = (await control.boundingBox())!
        expect.soft(box.width, `${viewport.width}: ${name} width`).toBeGreaterThanOrEqual(44)
        expect.soft(box.height, `${viewport.width}: ${name} height`).toBeGreaterThanOrEqual(44)
        await control.scrollIntoViewIfNeeded()
        await expect.soft(control).toBeInViewport()
      }
      const wheelBox = (await page.locator('.jog-wheel').boundingBox())!
      const playBox = (await page.getByRole('button', { name: 'Play', exact: true }).boundingBox())!
      const separate = ['graphite', 'glacier', 'correspondent', 'airframe', 'arcade'].includes(skin.id)
      expect.soft(Math.abs(playBox.x + playBox.width / 2 - wheelBox.x - wheelBox.width / 2), `${viewport.width}: centered Play key`).toBeLessThan(1)
      if (separate) expect.soft(playBox.y, `${viewport.width}: separate Play key`).toBeGreaterThan(wheelBox.y + wheelBox.height)
      else expect.soft(Math.abs(playBox.y + playBox.height / 2 - wheelBox.y - wheelBox.height / 2), `${viewport.width}: centered Play key`).toBeLessThan(1)
      // The speed input is transparent: its visible track must show keyboard focus.
      await jog(page).focus()
      await page.keyboard.press('ArrowRight')
      const wheelFocus = await jog(page).evaluate(el => {
        const own = getComputedStyle(el)
        const caption = getComputedStyle(el.closest('.wheel-column')!.querySelector('.wheel-caption')!)
        return own.outlineStyle !== 'none' || (caption.display !== 'none' && caption.textDecorationLine.includes('underline'))
      })
      expect.soft(wheelFocus, `${viewport.width}: visible jog focus`).toBe(true)
      const captionBox = (await page.locator('.wheel-caption').boundingBox())!
      const readoutBox = (await page.locator('.transport-readout').boundingBox())!
      const focusedPlayBox = (await page.getByRole('button', { name: 'Play', exact: true }).boundingBox())!
      expect.soft(captionBox.y, `${viewport.width}: focus cue clears readout`).toBeGreaterThanOrEqual(readoutBox.y + readoutBox.height)
      if (separate) expect.soft(captionBox.y + captionBox.height, `${viewport.width}: focus cue clears Play`).toBeLessThanOrEqual(focusedPlayBox.y)
      if (viewport.width === 320 && browserName === 'chromium' && skin.id === 'field') {
        await page.locator('main').screenshot({ path: testInfo.outputPath('field-narrow-focus.png') })
      }
      await page.keyboard.press(tabKey(browserName))
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeFocused()
      expect.soft(await page.getByRole('button', { name: 'Play', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
      await page.getByRole('slider', { name: 'Playback speed' }).focus()
      await page.keyboard.press('ArrowRight')
      expect.soft(await page.locator('.speed-track').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
      if (viewport.width === 390 && browserName === 'chromium') {
        await page.locator('main').screenshot({ path: testInfo.outputPath(`${skin.id}.png`) })
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await page.getByRole('button', { name: 'Play', exact: true }).evaluate(el =>
      Math.max(...getComputedStyle(el).transitionDuration.split(',').map(Number.parseFloat)))).toBeLessThanOrEqual(.00001)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.locator('.state-label')).toHaveText('RUN')
    await expect.poll(() => page.locator('.jog-wheel').evaluate(el => el.getAnimations({subtree:true}).length)).toBe(0)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
  })
}

test('every finish can be selected during real playback and keeps a truthful readout', async ({ page: editor, browser, browserName }) => {
  test.setTimeout(30_000 + skins.length * 6_000)
  const displays = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const phones = await browser.newContext(phoneOptions(browserName))
  const display = await displays.newPage(), remote = await phones.newPage()
  try {
    await pair(editor, display, remote)
    await remote.getByRole('slider', { name: 'Playback speed' }).fill('1.1')
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    for (const skin of skins) {
      await remote.getByRole('button', { name: 'Change remote skin' }).click()
      await remote.getByRole('button', { name: `Use ${skin.name}`, exact: true }).click()
      await expect(remote.getByRole('dialog')).toHaveCount(0)
      await expect(remote.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
      await expect(remote.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled()
      await expect(remote.getByRole('slider', { name: 'Playback speed' })).toHaveValue('1.1')
      await expect(display.locator('.display-footer')).toContainText('ROLLING')
      const before = await displayPosition(display)
      await expect.poll(() => displayPosition(display)).toBeGreaterThan(before + 1)
      const clock = await remote.evaluate(() => ({
        text: document.querySelector('.timecode')!.textContent!,
        pixels: Number(document.querySelector('[aria-label="Jog script position"]')!.getAttribute('aria-valuenow')),
      }))
      const match = /^(\d+):(\d{2})\.(\d)$/.exec(clock.text)!
      expect(match, `${skin.name}: complete readout`).not.toBeNull()
      const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 10
      // Allow a tenth's truncation plus the slider's rounded pixel precision.
      expect(Math.abs(seconds - clock.pixels / (52 * 1.1)), `${skin.name}: nominal time`).toBeLessThan(.12)
    }
    await remote.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
  } finally { await phones.close(); await displays.close() }
})
