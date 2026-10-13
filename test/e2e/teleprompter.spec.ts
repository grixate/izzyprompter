import { test, expect, type Page } from '@playwright/test'
import { phoneOptions } from './helpers/phone'

const paragraphs = [
  'Первый абзац — камера готова. Keep your eyes close to the lens and speak naturally.',
  'The second paragraph gives the remote something real to scrub through. '.repeat(12).trim(),
  'A third paragraph makes the script longer than the display viewport. '.repeat(12).trim(),
]
const script = paragraphs.join('\n\n')

const displayPosition = (display: Page) => display.locator('.script-track').evaluate(
  (element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
)

async function dragWheel(remote: Page, direction: 1 | -1) {
  const bounds = await remote.getByRole('slider', { name: 'Jog script position' }).boundingBox()
  if (!bounds) throw new Error('Jog wheel has no visible bounds')
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const radius = bounds.width * 0.4
  await remote.mouse.move(center.x + radius, center.y)
  await remote.mouse.down()
  for (let step = 1; step <= 16; step += 1) {
    const angle = direction * Math.PI * step / 16
    await remote.mouse.move(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
    )
  }
  await remote.mouse.up()
}

for (const mobileRemote of [false, true]) {
  test(`editor → display → ${mobileRemote ? 'phone' : 'desktop'} remote → play → scrub → pause`, async ({ browser, browserName, page: editor, baseURL }) => {
    const displayContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const remoteContext = await browser.newContext(
      mobileRemote ? phoneOptions(browserName) : { viewport: { width: 900, height: 900 } },
    )
    const display = await displayContext.newPage()
    const remote = await remoteContext.newPage()
    const errors: string[] = []
    for (const page of [editor, display, remote]) page.on('pageerror', (error) => errors.push(error.message))

    try {
      await editor.goto('/')
      await expect(editor.getByRole('button', { name: 'SET UP PROMPTER' })).toBeDisabled()
      await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(script)
      await editor.getByRole('button', { name: 'SET UP PROMPTER' }).click()
      await expect(editor.locator('.network-state')).toHaveText('CONNECTED')

      const displayHref = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
      const remoteHref = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
      expect(displayHref).toBeTruthy()
      expect(remoteHref).toBeTruthy()
      expect(new URL(displayHref!).origin).toBe(baseURL)
      expect(new URL(remoteHref!).origin).toBe(baseURL)
      await Promise.all([
        display.goto(displayHref!),
        remote.goto(remoteHref!),
      ])
      await expect(display.locator('.network-state')).toHaveText('CONNECTED')
      await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
      await expect(display.locator('.script-track p')).toHaveText(paragraphs)
      await expect(remote.getByText('DSP 01 READY')).toBeVisible()
      await expect(display.getByText('REMOTE READY')).toBeAttached()
      await expect(editor.getByText('DISPLAY ● READY')).toBeVisible()
      await expect(editor.getByText('REMOTE ● READY')).toBeVisible()

      await remote.getByRole('button', { name: 'Play', exact: true }).click()
      await expect(remote.locator('.state-label')).toHaveText('RUN')
      await expect(display.locator('.display-footer')).toContainText('ROLLING')
      await expect.poll(() => displayPosition(display)).toBeGreaterThan(15)

      const beforeScrub = await displayPosition(display)
      await dragWheel(remote, 1)
      await expect.poll(() => displayPosition(display)).toBeGreaterThan(beforeScrub + 150)
      await remote.getByRole('button', { name: 'Pause', exact: true }).click()
      await expect(remote.locator('.state-label')).toHaveText('HOLD')
      await expect(display.locator('.display-footer')).toContainText('STANDBY')
      const pausedPosition = await displayPosition(display)
      // Sample over an interval: a paused display must stop physically moving.
      await display.waitForTimeout(400)
      expect(Math.abs(await displayPosition(display) - pausedPosition)).toBeLessThan(2)

      await dragWheel(remote, -1)
      await expect.poll(() => displayPosition(display)).toBeLessThan(pausedPosition - 150)
      await remote.getByRole('button', { name: 'Increase speed' }).click()
      await expect(display.locator('.display-footer')).toContainText('0.91×')
      await remote.reload()
      await expect(remote.locator('.network-state')).toHaveText('CONNECTED')
      await expect(remote.locator('.state-label')).toHaveText('HOLD')
      await expect(remote.getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.91')
      expect(errors).toEqual([])
    } finally {
      await displayContext.close()
      await remoteContext.close()
    }
  })
}
