import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

const origin = process.env.IZZY_SMOKE_ORIGIN || 'https://staging.izzyprompter.com'
const checks = []
let browser, phase = 'configuration'
try {
  const staging = origin === 'https://staging.izzyprompter.com'
  assert.ok(staging || (origin === 'https://izzyprompter.com' && process.env.IZZY_VERIFY_PRODUCTION === '1'))
  const fixture = JSON.parse(await readFile(process.env.IZZY_LAUNCH_FIXTURE, 'utf8'))
  assert.ok(/^release-probe-/.test(fixture.email) && fixture.email.endsWith('@example.invalid'))
  assert.match(fixture.token, /^[A-Za-z0-9_-]{43}$/)
  if (!staging) assert.equal(fixture.pro, false, 'Production acceptance must not seed paid grants')
  const credentials = staging ? JSON.parse(await readFile(join(homedir(), '.ssh/izzy_staging_access.json'), 'utf8')) : null
  const options = credentials ? { httpCredentials: { username: credentials.username, password: credentials.password } } : {}
  browser = await chromium.launch()
  const contexts = await Promise.all([browser.newContext(options), browser.newContext({ ...options, viewport: { width: 1280, height: 800 } }), browser.newContext({ ...options, viewport: { width: 428, height: 746 }, isMobile: true, hasTouch: true })])
  const [editor, display, remote] = await Promise.all(contexts.map(context => context.newPage()))
  const errors = []
  for (const page of [editor, display, remote]) page.on('pageerror', () => errors.push('browser_error'))
  phase = 'health and public collection'
  assert.equal((await contexts[0].request.get(origin + '/health/ready')).status(), 200)
  const product = await (await contexts[0].request.get(origin + '/api/product')).json()
  const selected = ['original','ivory','field','graphite','signal','groove','switchboard','vector','cartridge','correspondent','foundry','clear','arcade','observatory']
  assert.deepEqual(product.skins, selected)
  assert.equal(product.price_minor, 2900)
  assert.equal(product.checkout_available, !staging)
  checks.push('health, selected fourteen and unchanged paid offer')
  phase = 'sign-in without mail'
  await editor.goto(origin + '/account/login#token=' + fixture.token)
  await editor.getByRole('button', { name: 'Sign in to IZZY', exact: true }).click()
  await expect(editor.getByRole('heading', { name: 'Your scripts', exact: true })).toBeVisible({ timeout: 25_000 })
  const status = await editor.evaluate(async () => (await fetch('/api/account/')).json())
  assert.equal(status.user.id, fixture.id)
  assert.equal(status.user.pro, fixture.pro)
  assert.equal(status.feedback_enabled, true)
  checks.push('account login and feature availability')
  phase = 'feedback submission'
  const feedback = editor.getByRole('region', { name: 'Leave your feedback.' })
  await feedback.getByRole('textbox', { name: 'Your message' }).fill('Synthetic launch acceptance feedback. Remove this fixture after verification.')
  await feedback.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(feedback.getByRole('status')).toContainText('review queue')
  checks.push('authenticated feedback delivered')
  phase = 'saved script and pairing'
  await editor.getByRole('button', { name: 'New script', exact: true }).click()
  const original = ['Synthetic launch words for a real paired take. '.repeat(60).trim(), 'Second synthetic paragraph. '.repeat(50).trim(), 'A synthetic closing.']
  await editor.getByRole('textbox', { name: 'Saved script text', exact: true }).fill(original.join('\n\n'))
  await expect(editor.getByRole('status')).toHaveText('Saved to account')
  const start = async () => {
    await editor.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
    const dialog = editor.getByRole('dialog')
    const displayLink = await dialog.getByRole('link', { name: 'Open reading screen' }).getAttribute('href')
    const remoteLink = await dialog.getByRole('textbox', { name: 'Remote link' }).inputValue()
    for (const link of [displayLink, remoteLink]) assert.equal(new URL(link).origin, origin)
    await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
    await expect(remote.getByRole('button', { name: 'Next phrase' })).toBeEnabled({ timeout: 25_000 })
  }
  const end = async () => {
    await editor.getByRole('dialog').getByRole('button', { name: 'Back to script', exact: true }).click()
    await editor.getByRole('button', { name: 'End session', exact: true }).click()
    await expect(editor.getByRole('button', { name: 'SET UP PROMPTER', exact: true })).toBeVisible()
  }
  await start()
  checks.push('saved script and independent phone/display pairing')
  const position = () => display.locator('.script-track').evaluate(element => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)
  const names = { original:'Original', ivory:'Orbit', field:'Field reel', graphite:'Thumbprint', signal:'Signal', groove:'Groove', switchboard:'Switchboard', vector:'Vector', cartridge:'Cartridge', correspondent:'Correspondent', foundry:'Foundry', clear:'Clear', arcade:'Arcade', observatory:'Observatory' }
  const screenshots = process.env.IZZY_HOSTED_SCREENSHOTS_DIR
  if (screenshots) await mkdir(screenshots, { recursive: true })
  for (const skin of fixture.pro ? selected : ['original']) {
    phase = 'paired instrument ' + skin
    if (fixture.pro) {
      await remote.getByRole('button', { name: 'Reading settings', exact: true }).click()
      await remote.getByRole('button', { name: 'Change remote skin', exact: true }).click()
      await remote.getByRole('button', { name: 'Use ' + names[skin], exact: true }).click()
    }
    await expect(remote.getByRole('main', { name: 'Remote controller' })).toHaveClass(new RegExp('skin--' + skin))
    const wheel = await remote.locator('.jog-wheel').boundingBox()
    assert.ok(wheel.width >= 340)
    const speed = remote.getByRole('textbox', { name: 'Exact playback speed' })
    await speed.fill('0.60'); await speed.press('Enter')
    await expect(display.locator('.display-footer')).toContainText('0.60×')
    await speed.fill('0.56'); await speed.press('Enter')
    await expect(display.locator('.display-footer')).toContainText('0.56×')
    const before = await position()
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect.poll(position).toBeGreaterThan(before + 4)
    await remote.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(display.locator('.display-footer')).toContainText('STANDBY')
    if (screenshots) await remote.screenshot({ path: join(screenshots, skin + '.png') })
  }
  checks.push('real playback, exact speed and dominant wheel for ' + (fixture.pro ? 14 : 1) + ' instruments')
  phase = 'font and full script replacement'
  await remote.getByRole('button', { name: 'Reading settings', exact: true }).click()
  await remote.getByRole('slider', { name: 'TEXT SIZE', exact: true }).fill('88')
  await expect(remote.getByRole('status', { name: 'Reading settings status' })).toHaveText('Saved to your account')
  await expect(display.locator('.standalone-display')).toHaveCSS('--prompt-size', '88px')
  await remote.getByRole('button', { name: 'Close reading settings' }).click()
  await remote.getByRole('slider', { name: 'Jog script position' }).press('Home')
  await remote.getByRole('button', { name: 'Next phrase' }).click()
  await expect(remote.locator('.phrase-count')).toContainText('02 / 03')
  await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  await remote.getByRole('combobox', { name: 'Text to edit' }).selectOption('document')
  const replacement = ['An inserted synthetic introduction.', ...original].join('\n\n')
  await remote.getByRole('textbox', { name: 'SCRIPT TEXT' }).fill(replacement)
  await expect(editor.getByRole('textbox', { name: 'Saved script text', exact: true })).toHaveValue(replacement)
  await expect(remote.getByText('Updated', { exact: true })).toBeVisible()
  await remote.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(remote.locator('.phrase-count')).toContainText('03 / 04')
  checks.push('remote font, full-script save and preserved reading anchor')
  phase = 'cross-session restoration'
  await end(); await start()
  await expect(display.locator('.standalone-display')).toHaveCSS('--prompt-size', '88px')
  await expect(display.locator('.script-track p')).toHaveCount(4)
  await end()
  assert.deepEqual(errors, [])
  checks.push('new take restores cloud preferences and text; zero browser errors')
  console.log(JSON.stringify({ result:'passed', origin, checks, realCharges:0, emailsSent:0 }, null, 2))
} catch {
  // Browser and parsing errors can contain pairing/login data: never dump them.
  console.error(JSON.stringify({ result:'failed', origin, phase, completedChecks:checks, details:'Private request context withheld.' }))
  process.exitCode = 1
} finally {
  await browser?.close()
}
