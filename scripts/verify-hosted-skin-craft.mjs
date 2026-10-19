import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { skins } from '../src/product/catalog.ts'

// Manual staging acceptance only. No production target, account or grant writes.
const origin = 'https://staging.izzyprompter.com'
const credentials = JSON.parse(await readFile(join(homedir(), '.ssh/izzy_staging_access.json'), 'utf8'))
const browser = await chromium.launch()
const contexts = []
const results = []
try {
  const options = { httpCredentials: { username: credentials.username, password: credentials.password } }
  contexts.push(await browser.newContext(options), await browser.newContext(options), await browser.newContext({ ...options, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }))
  const [editor, display, remote] = await Promise.all(contexts.map(context => context.newPage()))
  const errors = []
  for (const page of [editor, display, remote]) page.on('pageerror', error => errors.push(error.message))
  // This guest smoke deliberately simulates PRO permission only. Real grants are
  // independently verified by account CI; this is live transport/artwork coverage.
  await remote.route('**/api/sessions/*/appearance', route => route.fulfill({ json: { pro: true } }))
  await editor.goto(origin)
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill('Synthetic skin craft staging review. '.repeat(120))
  await editor.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
  const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
  const remoteLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
  assert.ok([displayLink, remoteLink].every(link => new URL(link).origin === origin), 'Pairing must stay on staging')
  await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
  await expect(remote.locator('.network-state')).toHaveText('CONNECTED', { timeout: 20000 })
  await expect(remote.getByRole('slider', { name: 'Jog script position' })).toHaveAttribute('aria-valuetext', /Display position/)
  const output = 'artifacts/skin-craft/staging'
  await mkdir(output, { recursive: true })
  for (const skin of skins) {
    await remote.getByRole('button', { name: 'Change remote skin', exact: true }).click()
    await remote.getByRole('dialog').getByRole('button', { name: `Use ${skin.name}`, exact: true }).click()
    await expect(remote.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
    const wheel = remote.locator('.jog-wheel')
    const position = () => display.locator('.script-track').evaluate(el => -new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)
    const before = await position()
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(wheel).toHaveAttribute('data-running', 'true')
    await expect.poll(position).toBeGreaterThan(before + 8)
    await remote.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(wheel).toHaveAttribute('data-running', 'false')
    await expect.poll(() => wheel.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
    assert.ok(await remote.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${skin.id}: horizontal bounds`)
    if (['groove', 'clear', 'spool'].includes(skin.id)) await remote.locator('main').screenshot({ path: `${output}/${skin.id}.png` })
    results.push({ skin: skin.id, transport: 'passed', pause: 'passed', bounds: 'passed' })
  }
  await remote.emulateMedia({ reducedMotion: 'reduce' })
  await remote.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(remote.locator('.jog-wheel')).toHaveAttribute('data-running', 'true')
  await expect.poll(() => remote.locator('.jog-wheel').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await remote.getByRole('button', { name: 'Pause', exact: true }).click()
  assert.equal(errors.length, 0, 'No browser runtime errors')
  console.log(JSON.stringify({ origin, browser: 'chromium', viewport: '390×844 emulation', permission: 'simulated PRO; no grant writes', results, reducedMotion: 'passed' }, null, 2))
} catch (error) {
  // Browser diagnostics may contain the in-memory pairing URL. Never retain it.
  const message = String(error?.message ?? error).replace(/https?:\/\/[^\s'"<>]+/g, '[URL]').replace(/[A-Za-z0-9_-]{43}/g, '[capability]')
  console.error(message)
  process.exitCode = 1
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
}
