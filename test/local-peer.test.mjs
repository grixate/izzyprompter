import assert from 'node:assert/strict'
import test from 'node:test'
import { createIzzyDocumentFromLegacyText } from '../src/domain/document.ts'
import { DEFAULT_PROMPT_SETTINGS } from '../src/domain/storage.ts'
import { LocalSessionController } from '../src/local/controller.ts'
import { DirectPeer } from '../src/local/peer.ts'

// Deterministic wire/lifecycle tests. This is explicitly not an ICE/browser test.
const peers = new Map()
let id = 0
const frames = []
class Channel extends EventTarget {
  label = 'izzy-direct-v1'; readyState = 'connecting'; bufferedAmount = 0
  send(text) { frames.push(JSON.parse(text).type); queueMicrotask(() => { if (this.other.readyState === 'open') this.other.onmessage?.({ data: text }) }) }
  close() {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'; queueMicrotask(() => this.onclose?.())
    if (this.other) { const other = this.other; this.other = null; other.other = null; other.close() }
  }
}
class Peer extends EventTarget {
  id = String(++id); iceGatheringState = 'complete'; connectionState = 'new'; localDescription = null
  constructor() { super(); peers.set(this.id, this) }
  createDataChannel() { this.channel = new Channel(); return this.channel }
  async createOffer() { return { type: 'offer', sdp: `v=0\na=fingerprint:sha-256 test\nx-peer:${this.id}` } }
  async createAnswer() { return { type: 'answer', sdp: `v=0\na=fingerprint:sha-256 test\nx-peer:${this.id}` } }
  async setLocalDescription(value) { this.localDescription = value }
  async setRemoteDescription(value) {
    const remote = peers.get(value.sdp.match(/x-peer:(\d+)/)[1])
    if (value.type === 'offer') {
      this.channel = new Channel(); this.channel.other = remote.channel; remote.channel.other = this.channel
      this.ondatachannel?.({ channel: this.channel })
    } else {
      this.channel.readyState = remote.channel.readyState = 'open'
      queueMicrotask(() => { this.channel.onopen?.(); remote.channel.onopen?.() })
    }
  }
  close() { this.connectionState = 'closed'; this.channel?.close(); peers.delete(this.id) }
}
const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
globalThis.document = document
globalThis.window = Object.assign(new EventTarget(), { isSecureContext: true, RTCPeerConnection: Peer })
globalThis.RTCPeerConnection = Peer

async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)) }
  assert.fail('Peer did not reach expected state')
}
async function pair(host, remote) { const offer = await host.createOffer(); const answer = await remote.acceptOffer(offer); await host.acceptAnswer(answer); await until(() => remote.getSnapshot().connection === 'connected') }

test('authenticated chunked snapshot, controls, Quick Edit, peer loss and fresh re-pairing', async () => {
  const doc = createIzzyDocumentFromLegacyText('Reading word '.repeat(4000) + '\n\nSecond paragraph')
  const controller = new LocalSessionController(doc, DEFAULT_PROMPT_SETTINGS)
  const host = new DirectPeer(controller), remote = new DirectPeer()
  try {
    await pair(host, remote)
    assert.equal(remote.getSnapshot().snapshot.script.content, controller.getSnapshot().script.content)
    assert.ok(frames.includes('chunk'), 'initial script transfers in bounded frames')
    assert.equal(controller.getSnapshot().presence.remote, 1)
    assert.equal((await remote.request('transport:play')).ok, true)
    assert.equal(controller.getSnapshot().transport.status, 'playing')
    assert.equal((await remote.request('transport:pause')).ok, true)
    const s = controller.getSnapshot()
    controller.execute('reading:checkpoint', { anchor: { blockId: doc.blocks[0].id, characterOffset: 8 },
      position: 100, maximum: 10000, transport_position: s.transport.anchor_position,
      transport_revision: s.transport.revision, script_revision: s.script.revision })
    const begin = await remote.request('script:begin_edit')
    assert.equal(begin.ok, true)
    assert.equal(begin.value.editing.active.owner_id, 'local-remote', 'ack waits for the new snapshot')
    const patch = await remote.request('script:patch_block', { block_id: doc.blocks[0].id, base_revision: 1, text: 'New reading word' })
    assert.equal(patch.ok, true)
    assert.equal(patch.value.script.revision, 2)
    assert.equal(patch.value.script.document.blocks[0].text, 'New reading word')
    assert.equal((await remote.request('script:patch_block', { block_id: doc.blocks[0].id, base_revision: 1, text: 'Stale' })).reason, 'edit_conflict')
    assert.equal((await remote.request('reading:checkpoint', {})).reason, 'forbidden')
    await remote.request('script:end_edit')
    await remote.request('transport:play')
    remote.close()
    await until(() => controller.getSnapshot().presence.remote === 0)
    assert.equal(controller.getSnapshot().transport.status, 'paused')
    assert.equal((await remote.request('transport:play')).ok, false)
    await pair(host, remote)
    assert.equal((await remote.request('transport:set_speed', { speed: 1.2 })).ok, true)
    assert.equal(controller.getSnapshot().transport.speed, 1.2)
  } finally { host.dispose(); remote.dispose() }
})
test('pairing rejects oversized, mismatched and obsolete negotiation material', async () => {
  const doc = createIzzyDocumentFromLegacyText('Hello')
  const host = new DirectPeer(new LocalSessionController(doc, DEFAULT_PROMPT_SETTINGS)), remote = new DirectPeer()
  try {
    await assert.rejects(() => remote.acceptOffer('x'.repeat(100000)), /too large/)
    const offer = await host.createOffer(), answer = await remote.acceptOffer(offer)
    const wrong = { ...JSON.parse(answer), key: '0'.repeat(32) }
    await assert.rejects(() => host.acceptAnswer(JSON.stringify(wrong)), /another or expired/)
    await host.createOffer()
    await assert.rejects(() => host.acceptAnswer(answer), /another or expired/)
  } finally { host.dispose(); remote.dispose() }
})
