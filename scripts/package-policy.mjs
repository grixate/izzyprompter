import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

// Pinned to the official distribution and its published SHASUMS256.txt.
// No downloads happen when the finished package starts.
export const nodeRuntime = {
  version: '24.21.0',
  archive: 'node-v24.21.0-darwin-arm64.tar.gz',
  sha256: 'bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057',
  baseURL: 'https://nodejs.org/dist/v24.21.0/',
}

export function packageOptions(args) {
  const options = { out: null, nodeArchive: null, help: false }
  const seen = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--help' || flag === '-h') { options.help = true; continue }
    if (!['--out', '--node-archive'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or repeated package option: ${flag}`)
    seen.add(flag)
    const value = args[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    options[flag === '--out' ? 'out' : 'nodeArchive'] = resolve(value)
  }
  return options
}

export async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export async function verifyNodeArchive(path) {
  const size = (await stat(path)).size
  if (!size || size > 150 * 1024 * 1024) throw new Error('Node archive has an unexpected size.')
  if (await sha256(path) !== nodeRuntime.sha256) throw new Error('Node archive checksum mismatch; nothing was extracted.')
}

export const systemLibrary = (path) => path.startsWith('/usr/lib/') || path.startsWith('/System/Library/')
export const otoolDependencies = (output) => output.split('\n').slice(1)
  .map((line) => line.match(/^\s+(.+?) \(compatibility version /)?.[1]).filter(Boolean)

export function minimumMacOS(output) {
  return [...output.matchAll(/\bminos\s+(\d+\.\d+(?:\.\d+)?)/g), ...output.matchAll(/LC_VERSION_MIN_MACOSX\s+cmdsize\s+\d+\s+version\s+(\d+\.\d+(?:\.\d+)?)/g)]
    .map((match) => match[1])
}
export function highestVersion(versions) {
  return versions.reduce((highest, version) => {
    const a = highest.split('.').map(Number), b = version.split('.').map(Number)
    for (let index = 0; index < 3; index += 1) {
      if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0) ? highest : version
    }
    return highest
  }, '0.0')
}
