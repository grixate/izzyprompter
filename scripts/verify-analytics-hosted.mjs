import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Staging only. The private fixture comes from ops/releases/analytics-fixture.exs.
// Credentials and capability-bearing URLs must never enter console output or captures.
const origin = 'https://staging.izzyprompter.com'
assert.ok(process.env.IZZY_ANALYTICS_FIXTURE, 'Provide the protected staging fixture file')
const fixture = JSON.parse(await readFile(process.env.IZZY_ANALYTICS_FIXTURE, 'utf8'))
const credentials = JSON.parse(await readFile(join(homedir(), '.ssh/izzy_staging_access.json'), 'utf8'))
const campaign = `acceptance-${Date.now().toString(36)}`
const browser = await chromium.launch()
const contexts = []
try {
  const context = await browser.newContext({ httpCredentials: { username: credentials.username, password: credentials.password } })
  contexts.push(context)
  // Explicit synthetic opt-in; normal automated smoke checks stay excluded.
  await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
  const editor = await context.newPage()
  await editor.goto(`${origin}/?utm_source=staging-probe&utm_medium=synthetic&utm_campaign=${campaign}&utm_content=paired-take`)
  await expect.poll(() => editor.evaluate(() => !!sessionStorage.getItem('izzy:campaign-visit:v1'))).toBe(true)
  const before = await editor.evaluate(() => JSON.parse(sessionStorage.getItem('izzy:campaign-visit:v1')).token)
  await editor.reload()
  await expect.poll(() => editor.evaluate(() => !!sessionStorage.getItem('izzy:campaign-visit:v1'))).toBe(true)
  const after = await editor.evaluate(() => JSON.parse(sessionStorage.getItem('izzy:campaign-visit:v1')).token)
  assert.equal(before, after, 'Reload must retain the visit')
  assert.equal((await context.request.get(origin + '/api/account/analytics')).status(), 401)
  await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill('Synthetic campaign acceptance. No customer text. '.repeat(25))
  await editor.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
  await expect(editor.locator('.network-state')).toHaveText('CONNECTED', { timeout: 20000 })
  const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
  const remoteLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
  for (const url of [displayLink, remoteLink]) assert.equal(new URL(url).origin, origin)
  const paired = await browser.newContext({ httpCredentials: { username: credentials.username, password: credentials.password } })
  contexts.push(paired)
  const display = await paired.newPage(), remote = await paired.newPage()
  await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
  await expect(remote.locator('.network-state')).toHaveText('CONNECTED', { timeout: 20000 })
  await remote.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => display.locator('.script-track').evaluate(node => -new DOMMatrixReadOnly(getComputedStyle(node).transform).m42), { timeout: 15000 }).toBeGreaterThan(10)
  await remote.getByRole('button', { name: 'Pause', exact: true }).click()
  await remote.getByRole('button', { name: 'Play', exact: true }).click()
  await remote.getByRole('button', { name: 'Pause', exact: true }).click()
  await paired.close()

  // A real email-token consume, without sending email or exposing a login URL.
  const signedIn = await editor.evaluate(async token => {
    const status = await (await fetch('/api/account')).json()
    const visit = JSON.parse(sessionStorage.getItem('izzy:campaign-visit:v1')).token
    return (await fetch('/api/account/login', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-csrf-token': status.csrf_token, 'x-izzy-visit': visit,
    }, body: JSON.stringify({ token }) })).ok
  }, fixture.token)
  assert.equal(signedIn, true)
  await editor.goto(origin + '/analytics')
  await expect(editor.getByRole('heading', { name: 'Which posts lead to use?' })).toBeVisible()

  // The worker flushes once a minute. Keep each individual wait below a minute.
  let row
  const deadline = Date.now() + 100000
  while (Date.now() < deadline) {
    const response = await context.request.get(origin + '/api/account/analytics?days=1')
    assert.equal(response.status(), 200)
    assert.equal(response.headers()['cache-control'], 'no-store')
    const report = await response.json()
    row = report.campaigns.find(c => c.source === 'staging-probe' && c.campaign === campaign)
    if (row?.counts.playback_started === 1 && row?.counts.signed_in === 1) break
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  assert.ok(row, 'Tagged campaign must appear after flush')
  assert.equal(row.counts.visits, 1)
  assert.equal(row.counts.page_views, 2)
  for (const event of ['start_clicked', 'session_created', 'remote_connected', 'playback_started', 'signed_in']) assert.equal(row.counts[event], 1)
  await editor.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(editor.getByRole('row', { name: /staging-probe.*paired-take/ })).toContainText('100.0%')
  assert.match(await editor.getByRole('textbox', { name: 'Post link', exact: true }).inputValue(), /^https:\/\/izzyprompter.com\/\?utm_source=/)
  assert.equal(await editor.evaluate(() => localStorage.getItem('izzy:analytics:exclude')), '1')
  console.log('Staging campaign acceptance passed: tagged visit, reload deduplication, real paired playback, sign-in, private report, and post-link builder. Synthetic data only; no provider transaction or physical-device certification.')
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser.close()
}
