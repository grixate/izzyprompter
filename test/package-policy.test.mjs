import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { highestVersion, minimumMacOS, nodeRuntime, otoolDependencies, packageOptions, sha256, systemLibrary, verifyNodeArchive } from '../scripts/package-policy.mjs'

test('portable build accepts explicit new output/archive paths and refuses ambiguous options', () => {
  assert.deepEqual(packageOptions([]), { out: null, nodeArchive: null, help: false })
  assert.deepEqual(packageOptions(['--out', 'output with spaces', '--node-archive', 'node.tar.gz']), { out: resolve('output with spaces'), nodeArchive: resolve('node.tar.gz'), help: false })
  assert.equal(packageOptions(['--help']).help, true)
  for (const args of [['--out'], ['--out', '--help'], ['--unknown'], ['--out', 'one', '--out', 'two']]) assert.throws(() => packageOptions(args))
})

test('runtime archive is pinned to an official version, HTTPS source and SHA-256 digest', () => {
  assert.equal(nodeRuntime.baseURL, `https://nodejs.org/dist/v${nodeRuntime.version}/`)
  assert.equal(nodeRuntime.archive, `node-v${nodeRuntime.version}-darwin-arm64.tar.gz`)
  assert.match(nodeRuntime.sha256, /^[a-f0-9]{64}$/)
})

test('native audit distinguishes OS libraries from builder or package-relative dependencies', () => {
  assert.equal(systemLibrary('/usr/lib/libSystem.B.dylib'), true)
  assert.equal(systemLibrary('/System/Library/Frameworks/Cocoa.framework/Cocoa'), true)
  for (const path of ['/opt/homebrew/lib/libcrypto.dylib', '/usr/local/lib/libssl.dylib', '/usr/library/fake', '@rpath/libcrypto.dylib', '@loader_path/libcrypto.3.dylib']) assert.equal(systemLibrary(path), false)
  assert.deepEqual(otoolDependencies('file:\n\t/usr/lib/libz.1.dylib (compatibility version 1.0.0, current version 1.2.12)\n\t@loader_path/libcrypto.3.dylib (compatibility version 3.0.0, current version 3.0.0)\n'), ['/usr/lib/libz.1.dylib', '@loader_path/libcrypto.3.dylib'])
})

test('minimum OS inventory parses old/new Mach-O commands and compares versions numerically', () => {
  assert.deepEqual(minimumMacOS('cmd LC_BUILD_VERSION\n platform 1\n minos 14.0\n sdk 26.2\ncmd LC_VERSION_MIN_MACOSX\n cmdsize 16\n version 13.5.1\n sdk 14.0'), ['14.0', '13.5.1'])
  assert.equal(highestVersion(['13.9', '13.10', '13.10.1']), '13.10.1')
  assert.equal(highestVersion(['14.0', '13.10.1']), '14.0')
})

test('tampered or empty archives fail verification before extraction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'izzy-package-policy-'))
  try {
    const archive = join(directory, 'untrusted.tar.gz')
    await writeFile(archive, 'tampered')
    assert.match(await sha256(archive), /^[a-f0-9]{64}$/)
    await assert.rejects(verifyNodeArchive(archive), /checksum mismatch/)
    await writeFile(archive, '')
    await assert.rejects(verifyNodeArchive(archive), /unexpected size/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
