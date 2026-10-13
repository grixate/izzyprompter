import test from 'node:test'
import assert from 'node:assert/strict'
import { hexPackages, auditHex, classifyFindings } from '../scripts/audit-hex.mjs'

test('Hex auditing parses pins as data and fails closed on unavailable or incomplete responses', async () => {
  const packages = hexPackages('%{\n "req": {:hex, :req, "0.6.3", "digest"},\n}')
  assert.equal(packages[0].version, '0.6.3')
  assert.throws(() => hexPackages('System.cmd("unsafe", [])'))
  await assert.rejects(auditHex(packages, async () => ({ ok: false, status: 503 })))
  await assert.rejects(auditHex(packages, async () => ({ ok: true, json: async () => ({ results: [] }) })))
  await assert.rejects(auditHex(packages, async () => ({ ok: true, json: async () => ({ results: [{ next_page_token: 'more' }] }) })))
  for (const result of [null, { vulns: {} }, { vulns: [null] }, { vulns: [{ id: '' }] }]) {
    await assert.rejects(auditHex(packages, async () => ({ ok: true, json: async () => ({ results: [result] }) })))
  }
  assert.deepEqual(await auditHex(packages, async () => ({ ok: true, json: async () => ({ results: [{}] }) })), [])
})

test('advisory exceptions expire and cannot survive changed package or mitigation pins', () => {
  const packages = [{ package: { name: 'cowboy' }, version: '2.19.0' }]
  const findings = [{ package: 'cowlib', version: '2.21.0', id: 'fixture' }]
  const exceptions = [{ ...findings[0], requires: { cowboy: '2.19.0' }, expires: '2026-11-10', reason: 'tested' }]
  assert.equal(classifyFindings(findings, packages, exceptions, new Date('2026-10-10')).reviewed.length, 1)
  assert.equal(classifyFindings(findings, packages, exceptions, new Date('2026-11-10')).unresolved.length, 1)
  assert.equal(classifyFindings(findings, [], exceptions, new Date('2026-10-10')).unresolved.length, 1)
  assert.equal(classifyFindings([{ ...findings[0], version: '2.22.0' }], packages, exceptions, new Date('2026-10-10')).unresolved.length, 1)
})
