import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, open, readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { highestVersion, minimumMacOS, otoolDependencies, sha256, systemLibrary } from './package-policy.mjs'

const run = promisify(execFile)
const machoMagic = new Set(['cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'])

export async function nativeFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Portable package must not contain symlinks: ${path}`)
    if (entry.isDirectory()) { files.push(...await nativeFiles(path)); continue }
    if (!entry.isFile()) continue
    const file = await open(path, 'r')
    try {
      const magic = Buffer.alloc(4)
      await file.read(magic, 0, 4, 0)
      if (machoMagic.has(magic.toString('hex'))) files.push(path)
    } finally { await file.close() }
  }
  return files
}

async function dependencies(path) {
  const [{ stdout }, { stdout: ids }] = await Promise.all([
    run('/usr/bin/otool', ['-L', path]), run('/usr/bin/otool', ['-D', path]),
  ])
  const id = ids.split('\n')[1]?.trim()
  return otoolDependencies(stdout).filter((dependency) => dependency !== id)
}

export async function bundleNativeLibraries(root) {
  const files = await nativeFiles(root)
  const copied = new Map(), changed = new Set(), notices = new Set()
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    for (const dependency of await dependencies(file)) {
      if (systemLibrary(dependency)) continue
      if (dependency.startsWith('@loader_path/')) {
        const resolved = resolve(dirname(file), dependency.slice('@loader_path/'.length))
        if (relative(root, resolved).startsWith('..')) throw new Error('Native dependency escapes the package.')
        await stat(resolved)
        continue
      }
      // First package supports the installed Homebrew OTP's OpenSSL dependency.
      // Never silently collect arbitrary builder-machine libraries/licences.
      if (!/^\/(?:opt\/homebrew|usr\/local)\/(?:opt\/openssl@3|Cellar\/openssl@3\/[^/]+)\/lib\/lib(?:crypto|ssl)\.3\.dylib$/.test(dependency)) {
        throw new Error(`Unsupported non-system native dependency: ${dependency}`)
      }
      const source = await realpath(dependency)
      const destination = join(dirname(file), basename(source))
      const digest = await sha256(source)
      if (copied.has(destination) && copied.get(destination) !== digest) throw new Error('Conflicting native library names.')
      if (!copied.has(destination)) {
        // Refuse collisions rather than overwrite any release-owned file.
        try { await stat(destination); throw new Error(`Native library collision: ${destination}`) }
        catch (error) { if (error.code !== 'ENOENT') throw error }
        await cp(source, destination, { force: false, errorOnExist: true })
        copied.set(destination, digest)
        notices.add(join(dirname(dirname(source)), 'LICENSE.txt'))
        files.push(destination)
        await run('/usr/bin/install_name_tool', ['-id', `@loader_path/${basename(destination)}`, destination])
        changed.add(destination)
      }
      await run('/usr/bin/install_name_tool', ['-change', dependency, `@loader_path/${basename(destination)}`, file])
      changed.add(file)
    }
  }
  for (const file of changed) await run('/usr/bin/codesign', ['--force', '--sign', '-', file])
  return { notices: [...notices], libraries: [...copied.keys()].map((path) => relative(root, path)) }
}

export async function auditNativeLibraries(root) {
  const versions = [], inventory = []
  for (const file of await nativeFiles(root)) {
    await run('/usr/bin/lipo', [file, '-verify_arch', 'arm64'])
    const { stdout } = await run('/usr/bin/otool', ['-l', file])
    versions.push(...minimumMacOS(stdout))
    const refs = await dependencies(file)
    for (const dependency of refs) {
      if (systemLibrary(dependency)) continue
      if (!dependency.startsWith('@loader_path/')) throw new Error(`Unbundled dependency remains: ${dependency}`)
      const target = resolve(dirname(file), dependency.slice('@loader_path/'.length))
      if (relative(root, target).startsWith('..')) throw new Error('Native dependency escapes the package.')
      await stat(target)
    }
    inventory.push({ path: relative(root, file), sha256: await sha256(file), dependencies: refs })
  }
  return { minimumMacOS: highestVersion(versions), files: inventory }
}
