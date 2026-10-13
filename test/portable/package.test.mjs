import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { access, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { tmpdir, networkInterfaces } from 'node:os'
import { chromium } from '@playwright/test'
import { chooseHost, localHosts } from '../../scripts/local-options.mjs'
import { auditNativeLibraries } from '../../scripts/package-native.mjs'
import { sha256 } from '../../scripts/package-policy.mjs'

const run = promisify(execFile)
const supported = process.platform === 'darwin' && process.arch === 'arm64'
async function eventually(check) {
  const deadline = Date.now() + 25_000
  let last
  while (Date.now() < deadline) {
    try { await check(); return } catch (error) { last = error }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw last
}
async function port() {
  const server = createServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const selected = server.address().port
  await new Promise((done) => server.close(done))
  return selected
}
async function stop(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const finished = once(child, 'exit')
  process.kill(child.pid, signal)
  let timer
  await Promise.race([finished, new Promise((done) => { timer = setTimeout(done, 8000) })])
  clearTimeout(timer)
  if (child.exitCode === null && child.signalCode === null) { process.kill(-child.pid, 'SIGKILL'); await finished; throw new Error('Launcher did not stop gracefully') }
}

test('portable ZIP relocates, runs with only bundled runtimes, pairs/edits without external HTTP, and stops safely', { timeout: 240_000, skip: supported ? false : 'Apple Silicon Mac package verification requires native macOS arm64.' }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'izzy-portable-test-'))
  const output = join(workspace, 'IZZY build with spaces')
  let child, browser, sentinel
  try {
    let archive = process.env.IZZY_PACKAGE_ZIP && resolve(process.env.IZZY_PACKAGE_ZIP)
    if (!archive) {
      const args = ['scripts/package-local.mjs', '--out', output]
      if (process.env.IZZY_NODE_ARCHIVE) args.push('--node-archive', process.env.IZZY_NODE_ARCHIVE)
      await run(process.execPath, args, { cwd: process.cwd(), timeout: 180_000, maxBuffer: 4 * 1024 * 1024 })
      archive = output + '.zip'
    }
    const expectedDigest = (await readFile(archive + '.sha256', 'utf8')).split(' ')[0]
    assert.equal(await sha256(archive), expectedDigest)
    const extraction = join(workspace, 'extracted')
    await run('/usr/bin/ditto', ['-x', '-k', archive, extraction])
    const directories = await readdir(extraction)
    assert.deepEqual(directories, [basename(archive, '.zip')])
    const moved = join(workspace, 'Moved IZZY on location')
    await rename(join(extraction, directories[0]), moved)
    const manifest = JSON.parse(await readFile(join(moved, 'package-manifest.json'), 'utf8'))
    assert.equal(manifest.platform, 'darwin')
    assert.equal(manifest.architecture, 'arm64')
    assert.equal(manifest.notarized, false)
    const audit = await auditNativeLibraries(moved)
    assert.deepEqual(audit.files, manifest.nativeFiles)
    assert.equal(audit.minimumMacOS, manifest.minimumMacOS)
    for (const name of ['Node.txt', 'Erlang-OTP.txt', 'Elixir.txt']) await access(join(moved, 'licenses', name))
    assert.ok((await readdir(join(moved, 'licenses'))).some((name) => name.startsWith('OpenSSL-')))
    const executable = join(moved, 'Start IZZY.command')
    // No installed Node/Mix/Homebrew in PATH; an unrelated current directory
    // and hostile stale launcher settings cannot redirect the packaged release.
    const env = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', IZZY_RELEASE_DIR: '/does-not-exist', IZZY_OPEN_BROWSER: '1' }
    sentinel = createServer((_req, response) => response.end('Unrelated server')).listen(0, '127.0.0.1')
    await once(sentinel, 'listening')
    const sentinelURL = `http://127.0.0.1:${sentinel.address().port}`
    const busy = await run(executable, ['--host', '127.0.0.1', '--port', String(sentinel.address().port), '--no-open'], { cwd: workspace, env }).then(() => null, (error) => error)
    assert.match(busy?.stderr ?? '', /Port .* is unavailable/)
    assert.equal(await (await fetch(sentinelURL)).text(), 'Unrelated server')
    const host = chooseHost(null, localHosts(networkInterfaces()))
    const selectedPort = await port(), loopback = `http://127.0.0.1:${selectedPort}`, origin = `http://${host}:${selectedPort}`
    let outputText = ''
    const start = () => {
      outputText = ''
      child = spawn(executable, ['--host', host, '--port', String(selectedPort), '--no-open'], { cwd: workspace, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.on('data', (chunk) => { outputText = (outputText + chunk.toString()).slice(-6000) })
      child.stderr.on('data', (chunk) => { outputText = (outputText + chunk.toString()).slice(-6000) })
    }
    start()
    await eventually(async () => { assert.equal(child.exitCode, null, outputText); assert.match(outputText, /IZZY LOCAL READY/) })
    assert.equal((await (await fetch(loopback + '/api/network')).json()).pairing_origin, origin)
    browser = await chromium.launch()
    const contexts = await Promise.all([1, 2, 3].map(() => browser.newContext({ serviceWorkers: 'block' })))
    const external = [], sockets = []
    for (const context of contexts) await context.route('**/*', (route) => {
      if ([loopback, origin].includes(new URL(route.request().url()).origin)) return route.continue()
      external.push(route.request().url()); return route.abort('internetdisconnected')
    })
    const [editor, display, remote] = await Promise.all(contexts.map((context) => context.newPage()))
    for (const page of [editor, display, remote]) page.on('websocket', (socket) => sockets.push(new URL(socket.url()).origin))
    const discovery = editor.waitForResponse((response) => new URL(response.url()).pathname === '/api/network')
    await editor.goto(loopback); await discovery
    const paragraph = 'A portable prompter on location. '.repeat(45).trim()
    await editor.getByRole('textbox', { name: 'Teleprompter script' }).fill(paragraph + '\n\nSecond paragraph.')
    // Existing Slice 5.7 ZIPs retain their verified pre-branding UI snapshot.
    await editor.getByRole('button', { name: /^START (?:LOCAL )?SESSION$/ }).click()
    await eventually(async () => assert.equal((await editor.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    const displayLink = await editor.getByRole('link', { name: /OPEN DISPLAY/ }).getAttribute('href')
    const remoteLink = await editor.getByRole('link', { name: /OPEN REMOTE/ }).getAttribute('href')
    assert.equal(new URL(remoteLink).origin, origin)
    await Promise.all([display.goto(displayLink), remote.goto(remoteLink)])
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    await remote.getByRole('button', { name: 'Play', exact: true }).click()
    await eventually(async () => assert.ok(await display.locator('.script-track').evaluate((element) => -new DOMMatrixReadOnly(getComputedStyle(element).transform).m42) > 20))
    await remote.getByRole('button', { name: 'Quick edit current paragraph' }).click()
    await remote.getByRole('textbox').fill('Portable correction. ' + paragraph)
    await eventually(async () => assert.equal(await display.locator('.script-track p').first().textContent(), 'Portable correction. ' + paragraph))
    await eventually(async () => assert.equal(await editor.locator('.pairing-live-edit p').textContent(), 'Portable correction. ' + paragraph))
    await eventually(async () => assert.equal(await remote.getByRole('button', { name: /DONE/ }).isEnabled(), true))
    await remote.getByRole('button', { name: /DONE/ }).click()
    await remote.reload()
    await eventually(async () => assert.equal((await remote.locator('.network-state').textContent()).trim(), 'CONNECTED'))
    assert.deepEqual(external, [])
    assert.ok(sockets.length >= 3 && sockets.every((url) => [loopback.replace('http:', 'ws:'), origin.replace('http:', 'ws:')].includes(url)))
    await browser.close(); browser = null
    await stop(child, 'SIGINT')
    assert.equal(child.exitCode, 0)
    await eventually(async () => assert.rejects(fetch(loopback + '/health/live', { signal: AbortSignal.timeout(500) })))
    // Terminal window close sends SIGHUP. It must not orphan the detached server.
    start()
    await eventually(async () => assert.match(outputText, /IZZY LOCAL READY/))
    await stop(child, 'SIGHUP')
    assert.equal(child.exitCode, 0)
    await eventually(async () => assert.rejects(fetch(loopback + '/health/live', { signal: AbortSignal.timeout(500) })))
    assert.equal(await (await fetch(sentinelURL)).text(), 'Unrelated server')

    // Builder failure paths preserve existing files and remove only new output.
    const marker = join(workspace, 'existing.zip')
    await writeFile(marker, 'Do not overwrite')
    const refused = await run(process.execPath, ['scripts/package-local.mjs', '--out', marker.slice(0, -4)], { timeout: 10_000 }).then(() => null, (error) => error)
    assert.equal(refused?.code, 1)
    assert.equal(await readFile(marker, 'utf8'), 'Do not overwrite')
    await assert.rejects(access(marker.slice(0, -4)))
    const tampered = join(workspace, 'tampered.tar.gz')
    await writeFile(tampered, 'Not an archive')
    const failedOutput = join(workspace, 'Failed output')
    const invalid = await run(process.execPath, ['scripts/package-local.mjs', '--out', failedOutput, '--node-archive', tampered], { timeout: 10_000 }).then(() => null, (error) => error)
    assert.match(invalid?.stderr ?? '', /checksum mismatch/)
    await assert.rejects(access(failedOutput))
    await assert.rejects(access(failedOutput + '.zip'))
    const existing = await run(process.execPath, ['scripts/package-local.mjs', '--out', moved], { timeout: 10_000 }).then(() => null, (error) => error)
    assert.equal(existing?.code, 1)
    await access(executable)
  } finally {
    await browser?.close()
    await stop(child)
    if (sentinel) await new Promise((done) => sentinel.close(done))
    await rm(workspace, { recursive: true, force: true })
  }
})
