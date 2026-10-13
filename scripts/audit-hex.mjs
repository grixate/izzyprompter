import { readFile } from 'node:fs/promises'

// Parse only the pinned Hex tuples; never evaluate mix.lock as source code.
export function hexPackages(lock) {
  const entries = [...lock.matchAll(/^\s*"([a-z0-9_]+)": \{:hex, :([a-z0-9_]+), "([0-9][^"]*)"/gm)]
  if (!entries.length) throw new Error('No pinned Hex packages found')
  return entries.map(([, , name, version]) => ({ package: { name, ecosystem: 'Hex' }, version }))
}

export async function auditHex(packages, fetcher = fetch) {
  const response = await fetcher('https://api.osv.dev/v1/querybatch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries: packages }), signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`OSV returned ${response.status}; audit did not pass`)
  const data = await response.json()
  if (!Array.isArray(data.results) || data.results.length !== packages.length || data.results.some(result =>
    !result || typeof result !== 'object' || result.next_page_token
    || (result.vulns !== undefined && (!Array.isArray(result.vulns) || result.vulns.some(vuln => !vuln || typeof vuln.id !== 'string' || !vuln.id))))) {
    throw new Error('Incomplete OSV response; audit did not pass')
  }
  return data.results.flatMap((result, index) => (result.vulns ?? []).map(vuln => ({
    package: packages[index].package.name, version: packages[index].version, id: vuln.id,
  })))
}

export function classifyFindings(findings, packages, exceptions, now = new Date()) {
  const versions = new Map(packages.map(item => [item.package.name, item.version]))
  const reviewed = [], unresolved = []
  for (const finding of findings) {
    const exception = exceptions.find(item => item.id === finding.id && item.package === finding.package && item.version === finding.version
      && new Date(`${item.expires}T00:00:00Z`) > now
      && Object.entries(item.requires ?? {}).every(([name, version]) => versions.get(name) === version))
    if (exception) reviewed.push({ ...finding, reason: exception.reason, expires: exception.expires })
    else unresolved.push(finding)
  }
  return { reviewed, unresolved }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  try {
    const packages = hexPackages(await readFile(new URL('../api/mix.lock', import.meta.url), 'utf8'))
    const findings = await auditHex(packages)
    const exceptions = JSON.parse(await readFile(new URL('../docs/security-advisory-exceptions.json', import.meta.url), 'utf8'))
    const { reviewed, unresolved } = classifyFindings(findings, packages, exceptions)
    for (const finding of unresolved) console.error(`${finding.package}@${finding.version}: https://osv.dev/vulnerability/${finding.id}`)
    for (const finding of reviewed) console.log(`REVIEWED MITIGATION (recheck before ${finding.expires}): ${finding.id}: ${finding.reason}`)
    console.log(`Hex advisory check: ${packages.length} pinned packages, ${unresolved.length} unresolved, ${reviewed.length} explicitly mitigated. This is not a code audit.`)
    if (unresolved.length) process.exitCode = 1
  } catch (error) { console.error(`Hex advisory check unavailable: ${error.message}`); process.exitCode = 1 }
}
