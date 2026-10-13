import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chmod, cp, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { nodeRuntime, packageOptions, sha256, verifyNodeArchive } from './package-policy.mjs'
import { auditNativeLibraries, bundleNativeLibraries } from './package-native.mjs'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

async function downloadRuntime(path) {
  console.log('Downloading the pinned Node runtime for packaging only…')
  const response = await fetch(nodeRuntime.baseURL + nodeRuntime.archive, { signal: AbortSignal.timeout(120_000), redirect: 'error' })
  if (!response.ok) throw new Error(`Node download failed (${response.status}).`)
  if (Number(response.headers.get('content-length')) > 150 * 1024 * 1024) throw new Error('Node download is too large.')
  const file = await open(path, 'wx')
  try {
    let bytes = 0
    for await (const chunk of response.body) {
      bytes += chunk.length
      if (bytes > 150 * 1024 * 1024) throw new Error('Node download is too large.')
      await file.write(chunk)
    }
  } finally { await file.close() }
}

async function installedLicense(start, candidates, target) {
  let directory = resolve(start)
  for (let level = 0; level < 7; level += 1) {
    for (const name of candidates) {
      try { await cp(join(directory, name), target, { force: false, errorOnExist: true }); return }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    if (dirname(directory) === directory) break
    directory = dirname(directory)
  }
  throw new Error(`Missing runtime licence near ${start}; package creation stopped.`)
}

async function collectLicenses(destination, nodeDirectory, nativeNotices) {
  const licenses = join(destination, 'licenses')
  await mkdir(licenses)
  await cp(join(nodeDirectory, 'LICENSE'), join(licenses, 'Node.txt'))
  const { stdout } = await run('elixir', ['-e', 'IO.puts(:code.root_dir()); IO.puts(:code.lib_dir(:elixir))'], { cwd: root })
  const [otpRoot, elixirRoot] = stdout.trim().split('\n')
  await installedLicense(otpRoot, ['LICENSE.txt', 'LICENSE', 'COPYRIGHT'], join(licenses, 'Erlang-OTP.txt'))
  await installedLicense(elixirRoot, ['LICENSE', 'LICENSE.txt'], join(licenses, 'Elixir.txt'))
  for (const [index, path] of nativeNotices.entries()) await cp(path, join(licenses, `OpenSSL-${index + 1}.txt`))
  // Include attribution/readmes for the packages whose compiled code ships.
  for (const [kind, directory, names] of [
    ['beam', join(root, 'api/deps'), await readdir(join(root, 'api/deps'))],
    ['js', join(root, 'node_modules'), ['react', 'react-dom', 'scheduler', 'lucide-react', 'qrcode.react', 'phoenix']],
  ]) {
    for (const name of names) {
      const source = join(directory, name)
      const notices = (await readdir(source)).filter((file) => /^(LICENSE|COPYING|NOTICE|README)(\..*)?$/i.test(file) || file === 'hex_metadata.config')
      if (!notices.length) throw new Error(`Missing attribution files for ${name}`)
      const target = join(licenses, `${kind}-${name}`)
      await mkdir(target)
      for (const file of notices) await cp(join(source, file), join(target, file))
    }
  }
}

async function main() {
  const options = packageOptions(process.argv.slice(2))
  if (options.help) {
    console.log('Build Apple Silicon Mac preview\n\nnpm run package:local -- [--out NEW_DIRECTORY] [--node-archive VERIFIED_TAR_GZ]\n\nRequires installed project dependencies, macOS build tools, Mix/OTP, and internet for the pinned Node archive unless supplied locally. Existing destinations are refused. The running LAN release is never overwritten.')
    return
  }
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Portable packaging currently supports native Apple Silicon macOS builds only.')
  const destination = options.out ?? join(root, 'artifacts', `IZZY-local-${manifest.version}-darwin-arm64`)
  await mkdir(dirname(destination), { recursive: true })
  // Exclusive creation establishes exactly which paths cleanup may remove.
  await mkdir(destination)
  let archiveOwned = false, complete = false
  const archive = `${destination}.zip`
  const workspace = await mkdtemp(join(tmpdir(), 'izzy-package-build-'))
  try {
    const reservation = await open(archive, 'wx'); await reservation.close(); archiveOwned = true
    const nodeArchive = options.nodeArchive ?? join(workspace, nodeRuntime.archive)
    if (!options.nodeArchive) await downloadRuntime(nodeArchive)
    await verifyNodeArchive(nodeArchive)
    const nodeDirectory = join(workspace, `node-v${nodeRuntime.version}-darwin-arm64`)
    await run('/usr/bin/tar', ['-xzf', nodeArchive, '-C', workspace, `${basename(nodeDirectory)}/bin/node`, `${basename(nodeDirectory)}/LICENSE`])
    console.log('Building a separate release; the running LAN build is untouched…')
    await run('npm', ['run', 'build:server'], { cwd: root, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
    await run('mix', ['release', '--path', join(destination, 'release')], {
      cwd: join(root, 'api'), env: { ...process.env, MIX_ENV: 'prod' }, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    })
    await mkdir(join(destination, 'runtime'))
    await cp(join(nodeDirectory, 'bin/node'), join(destination, 'runtime/node'))
    await mkdir(join(destination, 'scripts'))
    for (const file of ['local.mjs', 'local-options.mjs', 'local-network.mjs']) await cp(join(root, 'scripts', file), join(destination, 'scripts', file))
    for (const file of ['Start IZZY.command', 'README.txt']) await cp(join(root, 'packaging', file), join(destination, file))
    await chmod(join(destination, 'Start IZZY.command'), 0o755)
    const native = await bundleNativeLibraries(destination)
    await collectLicenses(destination, nodeDirectory, native.notices)
    const audit = await auditNativeLibraries(destination)
    const { stdout: nodeVersion } = await run(join(destination, 'runtime/node'), ['--version'], { env: { PATH: '/usr/bin:/bin' } })
    if (nodeVersion.trim() !== `v${nodeRuntime.version}`) throw new Error('Bundled Node version does not match the package pin.')
    await writeFile(join(destination, 'package-manifest.json'), JSON.stringify({
      format: 1, product: 'IZZY', version: manifest.version, platform: 'darwin', architecture: 'arm64',
      builtAt: new Date().toISOString(), minimumMacOS: audit.minimumMacOS, minimumOSVerified: false,
      runtime: nodeRuntime, nativeLibraries: native.libraries, nativeFiles: audit.files,
      signedInstaller: false, notarized: false, physicalAcceptance: false,
    }, null, 2) + '\n', { flag: 'wx' })
    await run('/usr/bin/ditto', ['-c', '-k', '--keepParent', destination, archive], { timeout: 120_000 })
    await writeFile(`${archive}.sha256`, `${await sha256(archive)}  ${basename(archive)}\n`, { flag: 'wx' })
    complete = true
    console.log(`IZZY PACKAGE READY\n${archive}\nFolder: ${destination}\nMinimum OS from binary metadata: ${audit.minimumMacOS} (not an OS-matrix test).\nInternal unsigned preview; no public upload was made.`)
  } finally {
    await rm(workspace, { recursive: true, force: true })
    if (!complete) {
      // Only a new directory and ZIP exclusively created by this invocation.
      await rm(destination, { recursive: true, force: true })
      if (archiveOwned) await rm(archive, { force: true })
    }
  }
}

main().catch((error) => { console.error(`IZZY package: ${error.message}`); process.exitCode = 1 })
