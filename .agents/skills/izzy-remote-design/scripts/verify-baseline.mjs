#!/usr/bin/env node
import { readFile, realpath } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

// Read-only verification: compare the frozen archive, never mutable live code.
try {
  if (process.argv.length !== 3) throw new Error('Usage: node verify-baseline.mjs <baseline-directory>')
  const root = await realpath(process.argv[2])
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.kind !== 'izzy-remote-design-baseline' ||
      !Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error('Invalid baseline manifest')
  const seen = new Set()
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || path.isAbsolute(entry.path) ||
        entry.path.split(/[\\/]/).some(part => part === '..' || part === '') || seen.has(entry.path) ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error('Invalid or duplicate archive member')
    }
    seen.add(entry.path)
    const member = await realpath(path.join(root, entry.path))
    if (!member.startsWith(root + path.sep)) throw new Error('Archive member escapes the baseline directory')
    const contents = await readFile(member)
    if (contents.byteLength !== entry.bytes || createHash('sha256').update(contents).digest('hex') !== entry.sha256) {
      throw new Error(`Baseline mismatch: ${entry.path}`)
    }
  }
  console.log(`Verified ${manifest.files.length} preserved files in ${manifest.baselineId}.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
