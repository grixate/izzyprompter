import test from 'node:test'
import assert from 'node:assert/strict'
import { pairingEnvironment } from '../src/realtime/pairing.ts'

test('loopback pairing explains that another device cannot open this address', () => {
  for (const host of ['localhost', 'app.localhost', '127.0.0.1', '127.10.2.3', '[::1]']) {
    assert.equal(pairingEnvironment(`http://${host}:4174`), 'loopback', host)
  }
})

test('private and link-local pairing addresses need local-network guidance', () => {
  for (const host of ['10.0.0.2', '172.16.0.1', '172.31.255.254', '192.168.1.13', '169.254.3.4', 'izzy.local', '[fd12::1]', '[fe80::1]']) {
    assert.equal(pairingEnvironment(`http://${host}:4174`), 'lan', host)
  }
})

test('website pairing does not tell users to share Wi-Fi or start a computer', () => {
  for (const host of ['izzy.example', '172.15.0.1', '172.32.0.1', '192.169.1.1', '[2001:db8::1]']) {
    assert.equal(pairingEnvironment(`https://${host}`), 'website', host)
  }
})
