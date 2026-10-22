import { test, expect } from '@playwright/test'
import { sampleScript } from '../../src/script'

const previewText = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1}. Words for a synthetic preview and playback check.`).join('\n\n')

test('the example connects the empty editor and working preview without replacing your draft', async ({ page }) => {
  const creations: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/sessions$/.test(request.url())) creations.push(request.url())
  })
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  const jog = page.locator('.preview-remote').getByRole('slider', { name: 'Jog script position' })
  await expect(editor).toHaveValue('')
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeDisabled()
  await expect(editor).toHaveAttribute('placeholder', sampleScript)
  await expect(page.locator('.live-preview .script-track p').first()).toHaveText(sampleScript.split('\n\n')[0])
  await page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  await page.locator('.preview-remote').getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(editor).toHaveValue('')
  await page.getByRole('button', { name: 'Use example', exact: true }).click()
  await expect(editor).toHaveValue(sampleScript)
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeEnabled()
  await page.reload()
  await expect(editor).toHaveValue(sampleScript)
  await editor.fill(previewText)
  await page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  await page.locator('.preview-remote').getByRole('button', { name: 'Pause', exact: true }).click()
  await jog.press('Home')
  await expect(jog).toHaveAttribute('aria-valuenow', '0')
  await jog.press('ArrowRight')
  await expect(jog).toHaveAttribute('aria-valuenow', '48')
  await jog.press('End')
  const maximum = Number(await jog.getAttribute('aria-valuemax'))
  await expect(jog).toHaveAttribute('aria-valuenow', String(Math.round(maximum)))
  await page.locator('.preview-remote').getByRole('button', { name: 'Increase speed' }).click()
  await expect(page.locator('.preview-remote').getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.61')
  await page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await jog.getAttribute('aria-valuenow'))).toBeLessThan(maximum)
  await expect(editor).toHaveValue(previewText)
  expect(creations).toEqual([])
  await page.reload()
  await expect(page.locator('.preview-remote').getByRole('slider', { name: 'Playback speed' })).toHaveValue('0.61')
})

test('editing pauses the preview, shows your words, and preserves the draft', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Teleprompter script' })
  await editor.fill('My own opening line.\n\nA second paragraph for the camera.')
  await expect(page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByLabel('Your script preview')).toContainText('My own opening line.')
  await expect(page.getByRole('button', { name: 'SET UP PROMPTER' })).toBeEnabled()
  await page.reload()
  await expect(editor).toHaveValue('My own opening line.\n\nA second paragraph for the camera.')
  await expect(page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true })).toBeVisible()
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

test('reduced motion keeps an empty preview paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.locator('.preview-remote').getByRole('slider', { name: 'Jog script position' })).toHaveAttribute('aria-valuenow', '0')
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

test('preview keeps the reading line and paired device proportions through responsive reflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const width of [320, 390, 650, 651, 768, 1280, 1600]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 })
      // WebKit can acknowledge a viewport resize before applying its media-query layout.
      // Poll the complete geometry instead of sampling that intermediate frame.
      await expect(async () => {
        const geometry = await page.locator('.preview-stage').evaluate(stage => {
          const display = stage.querySelector<HTMLElement>('.live-preview')!
          const remote = stage.querySelector<HTMLElement>('.preview-remote')!
          const track = display.querySelector<HTMLElement>('.script-track')!
          const line = display.querySelector<HTMLElement>('.focus-band')!
          const d = display.getBoundingClientRect()
          const r = remote.getBoundingClientRect()
          const lineY = line.getBoundingClientRect().top - d.top - display.clientTop
          return {
            lineY, expectedY: display.clientHeight * .42,
            padding: parseFloat(getComputedStyle(track).paddingTop),
            display: { x: d.x, y: d.y, width: d.width, bottom: d.bottom },
            remote: { x: r.x, y: r.y, width: r.width },
            overflow: document.documentElement.scrollWidth - innerWidth,
            controls: Array.from(remote.querySelectorAll('.jog-wheel, .transport-readout, .speed-module')).map(control => {
              const bounds = control.getBoundingClientRect()
              return { name: control.className, left: bounds.left, right: bounds.right, panelLeft: r.left, panelRight: r.right }
            }),
          }
        })
        expect(Math.abs(geometry.lineY - geometry.expectedY)).toBeLessThan(1)
        expect(Math.abs(geometry.padding - geometry.lineY)).toBeLessThan(2)
        expect(geometry.overflow).toBe(0)
        for (const control of geometry.controls) {
          expect(control.left, JSON.stringify(control)).toBeGreaterThanOrEqual(control.panelLeft)
          expect(control.right, JSON.stringify(control)).toBeLessThanOrEqual(control.panelRight)
        }
        if (width <= 650) {
          expect(geometry.display.width).toBe(geometry.remote.width)
          expect(geometry.display.x).toBe(geometry.remote.x)
          expect(geometry.remote.y - geometry.display.bottom).toBeGreaterThanOrEqual(20)
        } else {
          expect(geometry.remote.x).toBeGreaterThan(geometry.display.x + geometry.display.width)
        }
      }).toPass({ timeout: 8_000 })
    })
  }
})


test('pause stops the wheel and words together; play resumes both', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill(previewText)
  await page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true }).click()
  const rotor = page.locator('.preview-remote .wheel-rotor')
  const track = page.locator('.live-preview .script-track')
  await page.locator('.preview-remote').getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(() => rotor.evaluate(el => el.getAnimations().length)).toBe(0)
  const stopped = await rotor.evaluate(el => getComputedStyle(el).transform)
  const words = await track.evaluate(el => getComputedStyle(el).transform)
  await page.waitForTimeout(350)
  expect(await rotor.evaluate(el => getComputedStyle(el).transform)).toBe(stopped)
  expect(await track.evaluate(el => getComputedStyle(el).transform)).toBe(words)
  await page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => rotor.evaluate(el => getComputedStyle(el).transform)).not.toBe(stopped)
  await expect.poll(() => track.evaluate(el => getComputedStyle(el).transform)).not.toBe(words)
  await page.getByRole('textbox', { name: 'Teleprompter script' }).fill('A short line.')
  await page.locator('.preview-remote').getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => rotor.evaluate(el => el.getAnimations().length)).toBe(0)
})
