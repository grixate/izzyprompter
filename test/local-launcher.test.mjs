import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseHost, localHosts, parseOptions, privateIPv4 } from '../scripts/local-options.mjs'
import { portAvailable } from '../scripts/local-network.mjs'
import { createServer } from 'node:net'
import { once } from 'node:events'

test('local address validation permits only RFC1918 IPv4, never public or ambiguous hosts', () => {
  for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.1.13']) assert.equal(privateIPv4(ip), true)
  for (const ip of ['8.8.8.8', '198.18.0.1', '172.15.0.1', '172.32.0.1', '127.0.0.1', '169.254.1.1', '192.168.001.1', 'localhost', 'host.local', 'https://192.168.1.13', '::1']) assert.equal(privateIPv4(ip), false)
})

test('network detection excludes loopback, IPv6, VPN and container interfaces and deduplicates', () => {
  const entry = (address, internal = false) => ({ address, internal })
  assert.deepEqual(localHosts({ utun0: [entry('10.9.0.1')], docker0: [entry('172.17.0.1')], lo0: [entry('127.0.0.1', true)], en0: [entry('192.168.1.13'), entry('fe80::1'), entry('192.168.1.13')], eth0: [entry('10.0.0.2')], bad: null }), ['192.168.1.13', '10.0.0.2'])
})

test('local options have a separate default port and accept an explicit owned address', () => {
  assert.deepEqual(parseOptions([]), { port: 4174, host: null, help: false, open: null })
  assert.deepEqual(parseOptions(['--host', '192.168.1.13', '--port', '4300']), { port: 4300, host: '192.168.1.13', help: false, open: null })
  assert.equal(parseOptions(['--help']).help, true)
  assert.equal(parseOptions(['--host', '127.0.0.1']).host, '127.0.0.1')
})

test('browser opening is explicit or can be disabled by the portable wrapper user', () => {
  assert.equal(parseOptions(['--open']).open, true)
  assert.equal(parseOptions(['--no-open']).open, false)
  assert.throws(() => parseOptions(['--open', '--no-open']))
  assert.throws(() => parseOptions(['--open', '--open']))
})

test('invalid, duplicate and missing options fail rather than silently changing network mode', () => {
  for (const args of [['--port', '0'], ['--port', '65536'], ['--port', '4e3'], ['--port', '1.5'], ['--port'], ['--host', '--port', '4000'], ['--host', '8.8.8.8'], ['--host', 'host.local'], ['--port', '4000', '--port', '4001'], ['--cloud']]) assert.throws(() => parseOptions(args))
})

test('host selection cannot advertise a private address that is not on this computer', () => {
  assert.equal(chooseHost(null, ['192.168.1.13', '10.0.0.2']), '192.168.1.13')
  assert.equal(chooseHost('10.0.0.2', ['192.168.1.13', '10.0.0.2']), '10.0.0.2')
  assert.throws(() => chooseHost('192.168.2.44', ['192.168.1.13']))
})

test('no LAN address falls back to explicit computer-only loopback mode', () => {
  assert.equal(chooseHost(null, []), '127.0.0.1')
  assert.equal(chooseHost('127.0.0.1', ['192.168.1.13']), '127.0.0.1')
})

test('port checks refuse both wildcard and localhost-only listeners without stopping them', async () => {
  for (const address of ['127.0.0.1', '0.0.0.0']) {
    const sentinel = createServer().listen(0, address)
    await once(sentinel, 'listening')
    const port = sentinel.address().port
    try {
      await assert.rejects(portAvailable(port, '127.0.0.1'), /Port .* is unavailable/)
      assert.equal(sentinel.listening, true)
    } finally { await new Promise((done) => sentinel.close(done)) }
    await portAvailable(port, '127.0.0.1')
  }
})
