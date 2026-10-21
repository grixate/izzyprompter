import { test, expect } from '@playwright/test'
import { accountFixture } from './helpers/account'

test.describe('saved script editor', () => {
  test.skip(!process.env.IZZY_E2E_DATABASE_URL, 'Requires a migrated disposable PostgreSQL database')
  test('empty preview, counters, remote geometry and the last device speed survive the full take flow', async ({ page, browser }, testInfo) => {
    test.setTimeout(60_000)
    await page.goto(`/account/login#token=${accountFixture().token}`)
    await page.getByRole('button', { name: 'Sign in to IZZY', exact: true }).click()
    await page.getByRole('button', { name: 'New script', exact: true }).click()
    const title = page.getByRole('textbox', { name: 'Script title', exact: true })
    const text = page.getByRole('textbox', { name: 'Saved script text', exact: true })
    await expect(title).toBeEnabled()
    await expect(page.locator('.script-workspace .section-index')).toHaveCount(0)
    await expect(page.locator('.live-preview .script-content')).toHaveText('')
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
    await expect(page.locator('#saved-content-count')).toHaveText('0 characters · 2,097,152 bytes left of 2 MB')
    await title.fill('Camera')
    await expect(page.locator('#saved-title-count')).toHaveText('6 / 200 characters · 194 left')
    await text.fill('Привет 🌍')
    await expect(page.locator('#saved-content-count')).toHaveText('8 characters · 2,097,135 bytes left of 2 MB')
    await expect(page.getByRole('status')).toHaveText('Saved to account')
    await expect(page.getByLabel('Your script preview')).toContainText('Привет 🌍')
    const speed = page.getByRole('slider', { name: 'Playback speed', exact: true })
    await speed.fill('0.56')
    await page.reload()
    await expect(speed).toHaveValue('0.56')
    for (const width of [320, 390, 768, 1280, 1600]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
        const geometry = await page.locator('.preview-remote').evaluate(remote => {
          const play = remote.querySelector<HTMLButtonElement>('.transport-button')!
          const p = play.getBoundingClientRect()
          return { width: p.width, height: p.height, radius: getComputedStyle(play).borderRadius,
            speeds: Array.from(remote.querySelectorAll('.speed-module button')).map(b => ({ width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height, radius: getComputedStyle(b).borderRadius })) }
        })
        expect(Math.abs(geometry.width - geometry.height)).toBeLessThan(1)
        expect(geometry.radius).toBe('50%')
        for (const button of geometry.speeds) { expect(button.height).toBeGreaterThanOrEqual(28); expect(Math.abs(button.width - button.height)).toBeLessThan(1); expect(button.radius).toBe('50%') }
      }).toPass({ timeout: 8000 })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({ path: testInfo.outputPath('saved-editor-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const remoteUrl = await dialog.getByRole('textbox', { name: 'Remote link' }).inputValue()
    const remoteContext = await browser.newContext()
    const remote = await remoteContext.newPage()
    await remote.goto(remoteUrl)
    const remoteSpeed = remote.getByRole('slider', { name: 'Playback speed', exact: true })
    await expect(remoteSpeed).toBeEnabled()
    await expect(remoteSpeed).toHaveValue('0.56')
    await remoteSpeed.fill('0.64')
    await expect(speed).toHaveValue('0.64')
    await dialog.getByRole('button', { name: 'Back to script', exact: true }).click()
    await page.getByRole('button', { name: 'End session', exact: true }).click()
    await remoteContext.close()
    await page.goto('/account')
    await page.getByRole('button', { name: 'New script', exact: true }).click()
    await expect(speed).toHaveValue('0.64')
    await page.goto('/')
    await expect(speed).toHaveValue('0.64')
  })
})
