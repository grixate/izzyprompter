import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Probe authentication only: the unknown event is acknowledged without storing
// an event, creating an invoice, sending mail, or granting an entitlement.
const origin = 'https://staging.izzyprompter.com'
const secret = (await readFile(join(homedir(), '.ssh/izzy_lava_staging_webhook_secret'), 'utf8')).trim()
assert.match(secret, /^[a-f0-9]{64}$/)
const credentials = JSON.parse(await readFile(join(homedir(), '.ssh/izzy_staging_access.json'), 'utf8'))
const body = JSON.stringify({ eventType: 'izzy.integration.probe' })
const checks = []
async function request(path, options = {}) {
  return fetch(origin + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10_000) })
}
try {
  for (const [label, key, status] of [
    ['missing key rejected', undefined, 401],
    ['wrong key rejected', 'invalid-integration-probe', 401],
    ['outbound key rejected', (await readFile(join(homedir(), '.ssh/izzy_lava_api_key'), 'utf8')).trim(), 401],
    ['inbound key accepted', secret, 200],
  ]) {
    const headers = { 'Content-Type': 'application/json' }
    if (key) headers['X-Api-Key'] = key
    const response = await request('/api/payments/lava', { method: 'POST', headers, body })
    assert.equal(response.status, status, label)
    assert.equal(response.headers.get('www-authenticate'), null, 'Callback must reach app authentication')
    assert.equal(await response.text(), status === 200 ? 'success' : 'Unauthorized', label)
    checks.push(label)
  }
  // Even the correct webhook key must not unlock any other method or route.
  for (const [method, path] of [
    ['GET', '/api/payments/lava'], ['PUT', '/api/payments/lava'],
    ['POST', '/api/payments/lava/'], ['POST', '/api/payments/lava/extra'],
    ['POST', '/api/payments/prodamus'], ['GET', '/'],
    ['GET', '/health/ready'], ['GET', '/api/account/'], ['GET', '/api/product'],
  ]) {
    const response = await request(path, { method, headers: { 'X-Api-Key': secret } })
    assert.equal(response.status, 401, `${method} ${path}`)
    assert.match(response.headers.get('www-authenticate') || '', /^Basic /)
    await response.arrayBuffer()
  }
  checks.push('all other staging routes retain HTTP Basic protection')
  const authorization = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
  const productResponse = await request('/api/product', { headers: { Authorization: authorization } })
  assert.equal(productResponse.status, 200)
  assert.equal((await productResponse.json()).checkout_available, false)
  checks.push('staging checkout remains disabled')
  const publicResponse = await fetch('https://izzyprompter.com/api/product', {
    redirect: 'manual', signal: AbortSignal.timeout(10_000),
  })
  assert.equal(publicResponse.status, 200)
  assert.equal((await publicResponse.json()).checkout_available, false)
  checks.push('production checkout remains disabled')
  console.log(JSON.stringify({ result: 'passed', checks, realInvoicesCreated: 0 }, null, 2))
} catch {
  // Request exceptions may carry header values. Never dump request objects.
  console.error(JSON.stringify({ result: 'failed', completedChecks: checks,
    details: 'A staging authentication or checkout assertion failed; request details withheld.' }))
  process.exitCode = 1
}
