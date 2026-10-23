import { test, expect, type Page } from '@playwright/test'

const script = Array.from({ length: 12 }, (_, i) => (`Paragraph ${i + 1}. ` + 'Keep reading at a comfortable pace. '.repeat(14)).trim()).join('\n\n')
const position = (page: Page) => page.locator('.script-track').evaluate(el => -new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)
async function save(page: Page) {
  await page.goto('/local')
  await page.getByRole('heading', { name: 'Your words. Anywhere.' }).waitFor()
  await page.getByRole('textbox', { name: 'Local script title' }).fill('Field script')
  await page.getByRole('textbox', { name: 'Local script text' }).fill(script)
  await page.getByRole('button', { name: 'Save script offline', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Field script', exact: true })).toBeVisible()
}
async function prepare(page: Page) {
  await page.getByRole('heading', { name: 'Your words. Anywhere.' }).waitFor()
  await expect(page.getByRole('region', { name: 'Offline app preparation' })).toHaveAttribute('data-state', 'ready')
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible()
}
test('prepared app cold-opens offline, restores text/settings/anchor and never needs an API', async ({ page, context }) => {
  const errors: string[] = [], api: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/\/api\/|\/socket/.test(request.url())) api.push(request.url()) })
  await save(page); await prepare(page)
  await page.getByRole('button', { name: 'Start reading' }).click()
  await expect(page.locator('.network-state')).toHaveText('LOCAL')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => position(page)).toBeGreaterThan(20)
  await page.keyboard.press('Space')
  await expect(page.locator('.display-footer')).toContainText('STANDBY')
  await page.getByRole('button', { name: 'Prompt settings', exact: true }).click()
  await page.getByRole('slider', { name: 'Text size', exact: true }).fill('72')
  await expect(page.getByRole('slider', { name: 'Text size', exact: true })).toHaveValue('72')
  await page.getByRole('button', { name: 'Close prompt settings' }).click()
  await page.keyboard.press('ArrowDown')
  const before = await position(page)
  await page.getByRole('button', { name: 'Back to local scripts' }).click()
  await expect.poll(() => page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('izzy-prepared-scripts', 1)
    request.onsuccess = () => { const all = request.result.transaction('scripts').objectStore('scripts').getAll(); all.onsuccess = () => { request.result.close(); resolve(all.result[0]?.settings.fontSize) } }
  }))).toBe(72)
  await context.setOffline(true)
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/local')
  await expect.poll(() => reopened.getByRole('img', { name: 'IZZY', exact: true }).evaluateAll((imgs: HTMLImageElement[]) => imgs.length > 0 && imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true)
  for (const path of ['/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']) {
    const response = await reopened.evaluate(async path => {
      const response = await fetch(path)
      return { ok: response.ok, type: response.headers.get('content-type') }
    }, path)
    expect(response.ok).toBe(true)
    expect(response.type).toMatch(/^image\//)
  }
  await reopened.getByRole('button', { name: 'Field script', exact: true }).click()
  await expect(reopened.getByRole('textbox', { name: 'Local script text' })).toHaveValue(script)
  await reopened.getByRole('textbox', { name: 'Local script text' }).fill(script + '\n\nUnsent local correction.')
  await reopened.reload()
  await expect(reopened.getByRole('textbox', { name: 'Local script text' })).toHaveValue(script + '\n\nUnsent local correction.')
  await reopened.getByRole('textbox', { name: 'Local script text' }).fill(script)
  await reopened.getByRole('button', { name: 'Start reading' }).click()
  await expect(reopened.locator('.display-footer')).toContainText('STANDBY')
  await expect.poll(() => position(reopened)).toBeGreaterThan(0)
  expect(Math.abs(await position(reopened) - before)).toBeLessThan(100)
  await reopened.getByRole('button', { name: 'Prompt settings', exact: true }).click()
  await expect(reopened.getByRole('slider', { name: 'Text size', exact: true })).toHaveValue('72')
  const cacheKeys = await reopened.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat())
  expect(cacheKeys).not.toContain('/account'); expect(cacheKeys.some(p => p.startsWith('/api'))).toBe(false)
  expect(await reopened.evaluate(() => fetch('/account').then(() => true).catch(() => false))).toBe(false)
  expect(errors).toEqual([]); expect(api).toEqual([])
})
test('native direct peer: controls, Quick Edit and peer loss with app HTTP blocked', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.IZZY_TEST_NATIVE_PEER !== '1', 'Opt-in native network gate: this Mac exposes only an unreachable VPN candidate. Run on a reachable LAN; physical acceptance remains pending.')
  const hostContext = await browser.newContext(), remoteContext = await browser.newContext()
  const host = await hostContext.newPage(), remote = await remoteContext.newPage()
  const errors: string[] = []
  host.on('pageerror', e => errors.push(e.message)); remote.on('pageerror', e => errors.push(e.message))
  try {
    await save(host); await prepare(host)
    // Prepare the same local app shell on the remote before leaving connectivity.
    await remote.goto(`${baseURL}/local`); await prepare(remote)
    // Block app HTTP while leaving the local ICE/mDNS network available.
    // Browser offline emulation can disable that network too; physical WAN loss is a separate gate.
    for (const context of [hostContext, remoteContext]) {
      await context.route('**/*', route => route.abort('internetdisconnected'))
      await context.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
      await context.addInitScript(() => {
        const Base = window.RTCPeerConnection
        ;(window as any).__testPeers = []
        window.RTCPeerConnection = class extends Base {
          constructor(config?: RTCConfiguration) { super(config); (window as any).__testPeers.push(this) }
        }
      })
    }
    await host.reload(); await remote.goto(`${baseURL}/local/remote`)
    await host.getByRole('button', { name: 'Field script', exact: true }).click()
    await host.getByRole('button', { name: 'Start reading' }).click()
    await host.getByRole('button', { name: 'Connect phone', exact: true }).click()
    await host.getByRole('button', { name: 'Create connection file' }).click()
    const offerDownload = host.waitForEvent('download')
    await host.getByRole('button', { name: 'Download connection file', exact: true }).click()
    const offer = await (await import('node:fs/promises')).readFile((await (await offerDownload).path())!, 'utf8')
    expect(JSON.parse(offer).sdp).not.toContain(' typ relay')
    await remote.getByLabel('Upload connection file', { exact: true }).setInputFiles({ name: 'izzy-direct-offer.json', mimeType: 'application/json', buffer: Buffer.from(offer) })
    const answerDownload = remote.waitForEvent('download')
    await remote.getByRole('button', { name: 'Download phone reply', exact: true }).click()
    const answer = await (await import('node:fs/promises')).readFile((await (await answerDownload).path())!, 'utf8')
    await host.getByLabel('Upload phone reply file').setInputFiles({ name: 'izzy-direct-answer.json', mimeType: 'application/json', buffer: Buffer.from(answer) })
    await expect(remote.locator('.network-state')).toHaveText('DIRECT')
    await host.getByRole('button', { name: 'Close direct pairing' }).click()
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(host.locator('.display-footer')).toContainText('ROLLING')
    await expect.poll(() => position(host)).toBeGreaterThan(20)
    await remote.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(host.locator('.display-footer')).toContainText('STANDBY')
    const before = await position(host)
    await remote.getByRole('slider', { name: 'Jog script position' }).focus()
    await remote.keyboard.press('ArrowDown')
    await expect.poll(() => position(host)).toBeGreaterThan(before + 20)
    await remote.getByRole('slider', { name: 'Playback speed' }).fill('0.72')
    await expect(host.locator('.display-footer')).toContainText('0.72×')
    await remote.getByRole('button', { name: 'Next phrase' }).click()
    await expect(remote.locator('.phrase-count')).toContainText('02 / 12')
    await remote.getByRole('button', { name: /Quick Edit/i }).click()
    const field = remote.getByRole('textbox', { name: /Current paragraph/i })
    await expect(field).toBeVisible()
    const correction = 'Edited locally. ' + await field.inputValue()
    await field.fill(correction)
    await expect(host.locator('.script-track p').nth(1)).toHaveText(correction)
    await remote.getByRole('button', { name: 'Done', exact: true }).click()
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(host.locator('.display-footer')).toContainText('ROLLING')
    await remote.close()
    await expect(host.locator('.display-footer')).toContainText('STANDBY')
    await expect(host.getByText('REMOTE WAITING')).toBeVisible()
    await host.getByRole('button', { name: 'Back to local scripts' }).click()
    expect(await host.getByRole('textbox', { name: 'Local script text' }).inputValue()).toContain('Edited locally.')
    expect(errors).toEqual([])
  } catch (error) {
    const states = await Promise.all([host, remote].map(page => page.evaluate(() => (window as any).__testPeers?.map((pc: RTCPeerConnection) => ({ connection: pc.connectionState, ice: pc.iceConnectionState, gathering: pc.iceGatheringState, signaling: pc.signalingState })))))
    await testInfo.attach('peer-states', { body: JSON.stringify(states), contentType: 'application/json' })
    throw error
  } finally { await hostContext.close(); await remoteContext.close() }
})
test('storage failure preserves the in-memory script through local prompting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    ;(window as any).__testIndexedDB = window.indexedDB
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: () => { throw new DOMException('Denied', 'SecurityError') } } })
  })
  await page.goto('/local')
  await page.getByRole('heading', { name: 'Your words. Anywhere.' }).waitFor()
  await page.getByRole('textbox', { name: 'Local script text' }).fill(script)
  await page.getByRole('button', { name: 'Start reading' }).click()
  await expect(page.locator('.script-track p')).toHaveCount(12)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.display-footer')).toContainText('ROLLING')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Prompt settings', exact: true }).click()
  await page.getByRole('slider', { name: 'Local playback speed', exact: true }).fill('0.72')
  await expect(page.locator('.display-footer')).toContainText('0.72×')
  const beforeJog = await position(page)
  await page.getByRole('button', { name: 'Jog forward', exact: true }).click()
  await expect.poll(() => position(page)).toBeGreaterThan(beforeJog + 20)
  await page.getByRole('button', { name: 'Next paragraph', exact: true }).click()
  await page.getByRole('button', { name: 'Close prompt settings', exact: true }).click()
  await expect(page.getByText(/Local save failed/)).toBeVisible()
  await page.getByRole('button', { name: 'Back to local scripts' }).click()
  await expect(page.getByRole('textbox', { name: 'Local script text' })).toHaveValue(script)
  await page.evaluate(() => Object.defineProperty(window, 'indexedDB', { configurable: true, value: (window as any).__testIndexedDB }))
  await page.getByRole('button', { name: 'Save script offline', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Local script', exact: true })).toBeVisible()
})
