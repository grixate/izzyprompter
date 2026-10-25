import { test as base, expect, type Page } from '@playwright/test'
import { createSyntheticSession } from './helpers/create-synthetic-session'

type Rig = { remote: Page; display: Page; pair: () => Promise<void> }
const test = base.extend<{ rig: Rig }>({ rig: async ({ page: editor, browser }, use) => {
  const screens = await browser.newContext(), phones = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const display = await screens.newPage(), remote = await phones.newPage()
  try {
    await use({ remote, display, pair: async () => {
      await editor.goto('/')
      await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill('A synthetic opening for the edit loader.\n\nA second synthetic paragraph.')
      await createSyntheticSession(editor)
      const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
      const remoteLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
      await Promise.all([display.goto(displayLink!), remote.goto(remoteLink!)])
      await expect(remote.getByRole('button', { name: 'Quick edit current paragraph' })).toBeEnabled()
    } })
  } finally { await screens.close(); await phones.close() }
} })

test('records synthetic local edit opening timing', async ({ rig }, info) => {
  const samples: { elapsedMs: number; pauses: number; begins: number }[] = []
  let pauses = 0, begins = 0
  rig.remote.on('websocket', socket => socket.on('framesent', ({ payload }) => {
    const frame = JSON.parse(String(payload))
    if (frame[3] === 'transport:pause') pauses++
    if (frame[3] === 'script:begin_edit') begins++
  }))
  await rig.pair()
  for (let n = 0; n < 5; n++) {
    pauses = 0; begins = 0
    await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).evaluate(button => {
      performance.mark('edit-tapped'); (button as HTMLButtonElement).click()
    })
    await expect(rig.remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toHaveValue('A synthetic opening for the edit loader.')
    samples.push({ elapsedMs: Math.round(await rig.remote.evaluate(() => performance.now() - performance.getEntriesByName('edit-tapped').at(-1)!.startTime)), pauses, begins })
    await rig.remote.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(rig.remote.getByRole('dialog')).toBeHidden()
  }
  expect(samples.map(sample => sample.pauses)).toEqual([0, 0, 0, 0, 0])
  expect(samples.map(sample => sample.begins)).toEqual([1, 1, 1, 1, 1])
  await info.attach('synthetic-local-opening-timing', { body: JSON.stringify(samples), contentType: 'application/json' })
  console.log('Synthetic local edit timings:', JSON.stringify(samples))
})

async function checkpointGate(display: Page) {
  const gate = { hold: false, queued: [] as (() => void)[], release() { this.hold = false; this.queued.splice(0).forEach(send => send()) } }
  await display.routeWebSocket('**/socket/websocket*', socket => {
    const server = socket.connectToServer()
    socket.onMessage(message => {
      const frame = JSON.parse(String(message))
      if (gate.hold && frame[3] === 'reading:checkpoint') gate.queued.push(() => server.send(message))
      else server.send(message)
    })
  })
  return gate
}

test('opens the animated shell before a delayed checkpoint and requests ownership only after the push', async ({ rig, browserName }, info) => {
  const gate = await checkpointGate(rig.display)
  let begins = 0, pauses = 0
  rig.remote.on('websocket', socket => socket.on('framesent', ({ payload }) => {
    const frame = JSON.parse(String(payload))
    if (frame[3] === 'script:begin_edit') begins++
    if (frame[3] === 'transport:pause') pauses++
  }))
  await rig.pair()
  await rig.remote.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(rig.remote.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  gate.hold = true
  await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  const dialog = rig.remote.getByRole('dialog', { name: 'Quick edit', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Finding your line', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('textbox')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
  await expect.poll(() => gate.queued.length).toBeGreaterThan(0)
  expect(begins).toBe(0)
  expect(pauses).toBe(1)
  const scan = dialog.locator('.edit-line-scan')
  await expect(scan).toHaveCSS('animation-name', 'edit-find-line')
  const first = await scan.evaluate(el => getComputedStyle(el).transform)
  await expect.poll(() => scan.evaluate(el => getComputedStyle(el).transform)).not.toBe(first)
  if (browserName === 'chromium') await dialog.screenshot({ path: info.outputPath('finding-your-line.png') })
  await rig.remote.emulateMedia({ reducedMotion: 'reduce' })
  await expect(scan).toHaveCSS('animation-name', 'none')
  gate.release()
  const field = rig.remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })
  await expect(field).toBeEditable()
  await expect(field).toBeFocused()
  expect(begins).toBe(1)
  await rig.remote.getByRole('button', { name: 'Done', exact: true }).click()
})

for (const rejectRelease of [false, true]) test(`Cancel handles a late grant without reopening; release failure=${rejectRelease}`, async ({ rig }) => {
  let beginRef: string | null = null, release: (() => void) | undefined, ends = 0, delay = true
  await rig.remote.routeWebSocket('**/socket/websocket*', socket => {
    const server = socket.connectToServer()
    socket.onMessage(message => {
      const frame = JSON.parse(String(message))
      if (frame[3] === 'script:begin_edit') beginRef = frame[1]
      if (frame[3] === 'script:end_edit') {
        ends++
        if (rejectRelease && ends === 1) {
          socket.send(JSON.stringify([...frame.slice(0, 3), 'phx_reply', { status: 'error', response: { reason: 'save_in_progress' } }]))
          return
        }
      }
      server.send(message)
    })
    server.onMessage(message => {
      const frame = JSON.parse(String(message))
      if (delay && frame[3] === 'phx_reply' && frame[1] === beginRef && frame[4].status === 'ok') release = () => socket.send(message)
      else socket.send(message)
    })
  })
  await rig.pair()
  await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  await expect.poll(() => Boolean(release)).toBe(true)
  await rig.remote.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(rig.remote.getByRole('dialog')).toBeHidden()
  delay = false; release!()
  await expect(rig.remote.getByRole('button', { name: 'Quick edit current paragraph' })).toBeEnabled()
  if (rejectRelease) await expect(rig.remote.getByRole('status')).toContainText('Open Quick Edit to finish it')
  else await expect(rig.remote.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await expect(rig.remote.getByRole('dialog')).toBeHidden()
  expect(ends).toBe(1)
  await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  await expect(rig.remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
  await rig.remote.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(rig.remote.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('an opening failure stops the animation and offers a working retry', async ({ rig }) => {
  let reject = true
  await rig.remote.routeWebSocket('**/socket/websocket*', socket => {
    const server = socket.connectToServer()
    socket.onMessage(message => {
      const frame = JSON.parse(String(message))
      if (reject && frame[3] === 'script:begin_edit') {
        reject = false
        socket.send(JSON.stringify([...frame.slice(0, 3), 'phx_reply', { status: 'error', response: { reason: 'editing_active' } }]))
      } else server.send(message)
    })
  })
  await rig.pair()
  await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  const dialog = rig.remote.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('Keep the display connected')
  await expect(dialog.locator('.edit-line-scan')).toHaveCSS('animation-name', 'none')
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(rig.remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
  await rig.remote.getByRole('button', { name: 'Done', exact: true }).click()
})

test('a missing checkpoint times out without polling and can be retried after recovery', async ({ rig }) => {
  const gate = await checkpointGate(rig.display)
  let begins = 0
  rig.remote.on('websocket', socket => socket.on('framesent', ({ payload }) => { if (JSON.parse(String(payload))[3] === 'script:begin_edit') begins++ }))
  await rig.pair()
  await rig.remote.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(rig.remote.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  gate.hold = true
  await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  await expect(rig.remote.getByRole('dialog').getByRole('alert')).toBeVisible({ timeout: 5000 })
  expect(begins).toBe(0)
  gate.release()
  await rig.remote.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(rig.remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
  await rig.remote.getByRole('button', { name: 'Done', exact: true }).click()
})

test('accepts the local-controller reply shape while opening a playing take', async ({ rig }) => {
  const pauseRefs = new Set<string>()
  await rig.remote.routeWebSocket('**/socket/websocket*', socket => {
    const server = socket.connectToServer()
    socket.onMessage(message => {
      const frame = JSON.parse(String(message))
      if (frame[3] === 'transport:pause') pauseRefs.add(frame[1])
      server.send(message)
    })
    server.onMessage(message => {
      const frame = JSON.parse(String(message))
      if (frame[3] === 'phx_reply' && pauseRefs.has(frame[1]) && frame[4].status === 'ok') {
        frame[4].response = { transport: frame[4].response }
        socket.send(JSON.stringify(frame))
      } else socket.send(message)
    })
  })
  await rig.pair()
  await rig.remote.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(rig.remote.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await rig.remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
  await expect(rig.remote.getByRole('textbox', { name: 'CURRENT PARAGRAPH' })).toBeEditable()
  expect(pauseRefs.size).toBe(1)
  await rig.remote.getByRole('button', { name: 'Done', exact: true }).click()
})
