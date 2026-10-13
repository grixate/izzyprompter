import type { SessionControllerView } from '../realtime/controller'
import { DEFAULT_TRANSPORT, EMPTY_EDITING, EMPTY_PRESENCE, EMPTY_READING, type CommandResult, type ConnectionState, type SessionSnapshot } from '../realtime/protocol.ts'
import { izzyDocumentToLegacyText } from '../domain/document.ts'
import { localId, localNow, type LocalSessionController } from './controller.ts'
import { bytes, validAnchor, validDocument, validSettings } from './document.ts'

const VERSION = 1, MAX_TRANSFER = 16 * 1024 * 1024, MAX_FRAME = 32 * 1024
class SupersededConnection extends Error {}
type Negotiation = { version: 1; kind: 'offer' | 'answer'; epoch: string; key: string; sdp: string }
type PeerState = { connection: ConnectionState; snapshot: SessionSnapshot | null; message: string; clockOffset: number }
const record = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
function negotiation(text: string, kind: Negotiation['kind']): Negotiation {
  if (bytes(text) > 96 * 1024) throw new Error('Pairing data is too large.')
  const data = JSON.parse(text)
  if (!record(data) || data.version !== VERSION || data.kind !== kind || !/^[a-f0-9]{32}$/.test(data.epoch)
    || !/^[a-f0-9]{32}$/.test(data.key) || typeof data.sdp !== 'string' || data.sdp.length > 64 * 1024
    || !data.sdp.includes('a=fingerprint:')) throw new Error('Invalid or incompatible pairing data.')
  return data as Negotiation
}

/** Experimental manual signaling. No Phoenix, STUN, TURN, discovery or account access. */
export class DirectPeer {
  private state: PeerState = { connection: 'offline', snapshot: null, message: 'Not paired', clockOffset: 0 }
  private listeners = new Set<() => void>()
  private pc: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private material: Negotiation | null = null
  private expires = 0
  private authenticated = false
  private ready = false
  private disposed = false
  private sequence = 0
  private receivedSequence = 0
  private lastSeen = 0
  private pending = new Map<number, { resolve: (r: CommandResult<any>) => void; timer: ReturnType<typeof setTimeout> }>()
  private output = Promise.resolve()
  private syncPromise: Promise<void> | null = null
  private dirty = false
  private sentScript = 0
  private transfer: { id: string; total: number; chunks: string[]; size: number; started: number } | null = null
  private tokens = 120
  private byteTokens = 16 * 1024 * 1024
  private byteTime = localNow()
  private textTokens = 8
  private budgetTime = localNow()
  private timer: ReturnType<typeof setInterval>
  private unsubscribe?: () => void
  private host?: LocalSessionController
  constructor(host?: LocalSessionController) {
    this.host = host
    this.unsubscribe = host?.subscribe(() => { if (this.ready) void this.sync() })
    this.timer = setInterval(() => {
      if (!this.authenticated) {
        if (this.pc && localNow() > this.expires) this.close('Direct setup timed out. Check reachable Wi-Fi, client isolation or VPN routing, then pair again. Hosted mode remains available online.')
        return
      }
      if (localNow() - this.lastSeen > 3000) { this.close('Peer lost. Take paused; pair again.'); return }
      void this.send({ type: 'ping', at: localNow() }).catch(error => this.failed(error, 'Connection failed. Pair again.'))
    }, 1000)
    document.addEventListener('visibilitychange', this.visibility)
    window.addEventListener('pagehide', this.hide)
    document.addEventListener('freeze', this.hide)
  }
  getSnapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private update(patch: Partial<PeerState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()) }
  private failed(error: unknown, message: string) { if (!(error instanceof SupersededConnection)) this.close(message) }
  private visibility = () => { if (document.visibilityState === 'hidden') this.hide() }
  private hide = () => { this.close('Device suspended. Take paused; pair again.') }
  private setup() {
    if (this.disposed) throw new Error('Pairing view closed')
    if (!window.isSecureContext || !window.RTCPeerConnection) throw new Error('Direct preview needs a supported browser over HTTPS or loopback.')
    this.close('Preparing connection')
    this.expires = localNow() + 5 * 60_000
    const pc = new RTCPeerConnection({ iceServers: [] })
    this.pc = pc
    pc.onconnectionstatechange = () => {
      if (this.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) this.close('Peer connection ended. Pair again.')
    }
    pc.ondatachannel = event => {
      if (this.channel || event.channel.label !== 'izzy-direct-v1') { event.channel.close(); return }
      this.bind(event.channel)
    }
    this.update({ connection: 'connecting', snapshot: null, message: 'Exchange pairing data on your local network.' })
    return pc
  }
  private async gathered(pc: RTCPeerConnection) {
    if (pc.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); reject(new Error('Local address gathering timed out. Retry on a reachable network.')) }, 10_000)
      const check = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', check); resolve() } }
      pc.addEventListener('icegatheringstatechange', check)
      check()
    })
    if (pc !== this.pc || !pc.localDescription) throw new Error('Pairing was interrupted.')
    return pc.localDescription.sdp
  }
  createOffer = async () => {
    if (!this.host) throw new Error('Only the reading device creates an offer.')
    const pc = this.setup()
    this.bind(pc.createDataChannel('izzy-direct-v1', { ordered: true }))
    await pc.setLocalDescription(await pc.createOffer())
    this.material = { version: VERSION, kind: 'offer', epoch: this.host.getSnapshot().session_epoch, key: localId(), sdp: await this.gathered(pc) }
    return JSON.stringify(this.material)
  }
  acceptOffer = async (text: string) => {
    if (this.host) throw new Error('Open the remote on the other device.')
    const offer = negotiation(text, 'offer'), pc = this.setup()
    this.material = offer
    await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
    await pc.setLocalDescription(await pc.createAnswer())
    return JSON.stringify({ ...offer, kind: 'answer', sdp: await this.gathered(pc) })
  }
  acceptAnswer = async (text: string) => {
    const answer = negotiation(text, 'answer')
    if (!this.host || !this.material || !this.pc || localNow() > this.expires
      || answer.key !== this.material.key || answer.epoch !== this.material.epoch) throw new Error('This answer belongs to another or expired take. Generate a new offer.')
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp })
    this.expires = localNow() + 10_000
  }
  private bind(channel: RTCDataChannel) {
    this.channel = channel
    channel.bufferedAmountLowThreshold = 32 * 1024
    channel.onclose = () => { if (this.channel === channel) this.close('Remote disconnected. Take paused; pair again.') }
    channel.onerror = () => { if (this.channel === channel) this.close('Connection failed. Pair again.') }
    channel.onopen = () => {
      if (this.channel !== channel) return
      this.lastSeen = localNow()
      if (!this.host) void this.send({ type: 'hello', version: VERSION, key: this.material?.key, epoch: this.material?.epoch }).catch(error => this.failed(error, 'Handshake failed.'))
    }
    channel.onmessage = event => {
      if (channel !== this.channel) return
      try { this.receive(event.data) } catch { this.close('Invalid peer message. Take paused; pair again.') }
    }
  }
  private async frame(value: unknown, channel: RTCDataChannel) {
    if (channel !== this.channel || channel.readyState !== 'open') throw new Error('Peer unavailable')
    if (channel.bufferedAmount > 64 * 1024) await new Promise<void>((resolve, reject) => {
      const low = () => { cleanup(); resolve() }
      const timer = setTimeout(() => { cleanup(); reject(new Error('Peer too slow')) }, 1500)
      const cleanup = () => { clearTimeout(timer); channel.removeEventListener('bufferedamountlow', low) }
      channel.addEventListener('bufferedamountlow', low)
      if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) low()
    })
    if (channel !== this.channel || channel.readyState !== 'open') throw new Error('Connection changed')
    channel.send(JSON.stringify(value))
  }
  private send(value: unknown) {
    const channel = this.channel
    const operation = this.output.then(async () => {
      if (!channel) throw new Error('Peer unavailable')
      const text = JSON.stringify(value)
      if (bytes(text) > MAX_TRANSFER) throw new Error('Peer transfer too large')
      if (bytes(text) <= 16 * 1024) { await this.frame(value, channel); return }
      const id = localId(), total = Math.ceil(text.length / 4000)
      for (let index = 0; index < total; index++) await this.frame({ type: 'chunk', id, index, total, data: text.slice(index * 4000, (index + 1) * 4000) }, channel)
    }).catch(error => { if (channel !== this.channel) throw new SupersededConnection(); throw error })
    this.output = operation.catch(() => {})
    return operation
  }
  private receive(raw: unknown) {
    const activeChannel = this.channel
    if (typeof raw !== 'string' || bytes(raw) > MAX_FRAME) throw new Error('Invalid frame')
    const elapsed = Math.max(0, localNow() - this.byteTime) / 1000
    this.byteTokens = Math.min(16 * 1024 * 1024, this.byteTokens + elapsed * 4 * 1024 * 1024); this.byteTime = localNow()
    if (bytes(raw) > this.byteTokens) throw new Error('Peer byte budget exceeded')
    this.byteTokens -= bytes(raw)
    let message = JSON.parse(raw)
    if (!record(message)) throw new Error('Invalid message')
    if (message.type === 'chunk') {
      if (!this.authenticated || typeof message.id !== 'string' || message.id.length !== 32
        || !Number.isInteger(message.total) || message.total < 1 || message.total > 4096
        || !Number.isInteger(message.index) || typeof message.data !== 'string' || message.data.length > 4000) throw new Error('Invalid chunk')
      if (!this.transfer && message.index === 0) this.transfer = { id: message.id, total: message.total, chunks: [], size: 0, started: localNow() }
      const transfer = this.transfer
      if (!transfer || message.id !== transfer.id || message.total !== transfer.total || message.index !== transfer.chunks.length
        || localNow() - transfer.started > 10_000) throw new Error('Invalid transfer')
      transfer.size += bytes(message.data)
      if (transfer.size > MAX_TRANSFER) throw new Error('Transfer too large')
      transfer.chunks.push(message.data)
      if (transfer.chunks.length < transfer.total) return
      message = JSON.parse(transfer.chunks.join('')); this.transfer = null
      if (!record(message) || message.type === 'chunk') throw new Error('Invalid transfer message')
    }
    if (message.type === 'hello' && this.host && !this.authenticated && localNow() < this.expires
      && message.version === VERSION && message.key === this.material?.key && message.epoch === this.material?.epoch) {
      this.authenticated = true; this.lastSeen = localNow()
      void (async () => { await this.send({ type: 'welcome', version: VERSION, epoch: this.material!.epoch }); if (activeChannel === this.channel) await this.sync() })().catch(error => this.failed(error, 'Handshake failed.'))
      return
    }
    if (message.type === 'welcome' && !this.host && message.version === VERSION && message.epoch === this.material?.epoch) {
      this.authenticated = true; this.lastSeen = localNow(); return
    }
    if (!this.authenticated) throw new Error('Peer not authenticated')
    this.lastSeen = localNow()
    if (message.type === 'ping' && Number.isFinite(message.at)) {
      void this.send({ type: 'pong', at: message.at, hostTime: this.host?.now() }).catch(error => this.failed(error, 'Peer unavailable.')); return
    }
    if (message.type === 'pong') {
      if (!this.host && Number.isFinite(message.hostTime) && Number.isFinite(message.at) && localNow() - message.at >= 0 && localNow() - message.at <= 3000) {
        this.update({ clockOffset: message.hostTime + (localNow() - message.at) / 2 - localNow() })
      }
      return
    }
    if (message.type === 'snapshot' && !this.host) {
      const s = message.value
      if (!record(s) || s.session_epoch !== this.material?.epoch || s.protocol_version !== 2 || !record(s.script)) throw new Error('Invalid snapshot')
      const document = s.script.document ?? (s.script.revision === this.state.snapshot?.script.revision ? this.state.snapshot?.script.document : null)
      if (!validDocument(document) || !record(s.transport) || !['playing', 'paused'].includes(s.transport.status)
        || !Number.isFinite(s.transport.anchor_position) || !Number.isFinite(s.transport.anchor_server_time)
        || !Number.isFinite(s.transport.speed) || s.transport.speed < .5 || s.transport.speed > 1.5
        || !Number.isSafeInteger(s.transport.revision) || !Number.isSafeInteger(s.script.revision)
        || !record(s.reading) || !record(s.editing) || !record(s.presence) || !validSettings(s.display_settings)) throw new Error('Invalid snapshot fields')
      if (s.reading.checkpoint && !validAnchor(document, s.reading.checkpoint.anchor)) throw new Error('Invalid checkpoint')
      const snapshot = { ...s, script: { ...s.script, document, content: izzyDocumentToLegacyText(document) }, connection_id: 'local-remote' } as SessionSnapshot
      this.update({ snapshot, ...(this.state.snapshot ? {} : { clockOffset: s.server_time - localNow() }) })
      if (!this.ready) { this.ready = true; void this.send({ type: 'ready' }).catch(error => this.failed(error, 'Handshake failed.')) }
      return
    }
    if (message.type === 'ready' && this.host) {
      this.ready = true; this.host.peer(true); this.update({ connection: 'connected', message: 'Direct connection established' })
      void this.send({ type: 'ready-ack' }).catch(error => this.failed(error, 'Handshake failed.')); return
    }
    if (message.type === 'ready-ack' && !this.host && this.ready) { this.update({ connection: 'connected', message: 'Direct connection established' }); return }
    if (message.type === 'command' && this.host && this.ready) {
      const elapsed = Math.max(0, localNow() - this.budgetTime) / 1000
      this.tokens = Math.min(120, this.tokens + elapsed * 60); this.textTokens = Math.min(8, this.textTokens + elapsed * 6); this.budgetTime = localNow()
      if (message.epoch !== this.material?.epoch || !Number.isSafeInteger(message.sequence) || message.sequence <= this.receivedSequence
        || typeof message.event !== 'string' || !record(message.payload)) throw new Error('Invalid command envelope')
      this.receivedSequence = message.sequence
      const heavy = message.event === 'script:patch_block'
      const result = this.tokens < 1 || (heavy && this.textTokens < 1) ? { ok: false as const, reason: 'rate_limited' }
        : this.host.execute(message.event, message.payload, 'local-remote')
      this.tokens = Math.max(0, this.tokens - 1); if (heavy) this.textTokens = Math.max(0, this.textTokens - 1)
      void (async () => {
        await this.sync()
        if (activeChannel !== this.channel) return
        await this.send({ type: 'ack', sequence: message.sequence, result: result.ok ? { ok: true } : result })
      })().catch(error => this.failed(error, 'Command sync failed.'))
      return
    }
    if (message.type === 'ack' && !this.host && Number.isSafeInteger(message.sequence)) {
      const pending = this.pending.get(message.sequence)
      if (pending) {
        this.pending.delete(message.sequence); clearTimeout(pending.timer)
        pending.resolve(message.result?.ok && this.state.snapshot ? { ok: true, value: this.state.snapshot }
          : { ok: false, reason: typeof message.result?.reason === 'string' ? message.result.reason : 'invalid_ack' })
      }
      return
    }
    throw new Error('Unknown peer message')
  }
  private sync(): Promise<void> {
    this.dirty = true
    if (this.syncPromise) return this.syncPromise
    if (!this.host || !this.authenticated) return Promise.resolve()
    const activeChannel = this.channel
    this.syncPromise = (async () => { try {
      while (this.dirty && this.authenticated && activeChannel === this.channel) {
        this.dirty = false
        const s = this.host!.getSnapshot(), script = s.script.revision === this.sentScript ? { revision: s.script.revision } : { revision: s.script.revision, document: s.script.document }
        await this.send({ type: 'snapshot', value: { ...s, script, server_time: this.host!.now() } })
        if (activeChannel !== this.channel) break
        this.sentScript = s.script.revision
      }
    } catch (error) { this.failed(error, 'Snapshot transfer failed. Pair again.') }
    finally { if (activeChannel === this.channel) this.syncPromise = null }
    })()
    return this.syncPromise
  }
  request = <T,>(event: string, payload: Record<string, unknown> = {}): Promise<CommandResult<T>> => {
    if (this.host || this.state.connection !== 'connected' || document.visibilityState === 'hidden'
      || !this.channel || this.channel.bufferedAmount > 64 * 1024 || this.pending.size >= 32) return Promise.resolve({ ok: false, reason: 'offline' })
    const sequence = ++this.sequence
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.close('Command timed out. Take paused; pair again.') }, 3000)
      this.pending.set(sequence, { resolve, timer })
      void this.send({ type: 'command', epoch: this.material!.epoch, sequence, event, payload }).catch(error => this.failed(error, 'Command failed.'))
    })
  }
  sendCommand = (event: string, payload?: Record<string, unknown>) => {
    if (this.state.connection !== 'connected') return false
    void this.request(event, payload)
    return true
  }
  view(): SessionControllerView {
    const s = this.state.snapshot
    return { connection: this.state.connection, transport: s?.transport ?? DEFAULT_TRANSPORT,
      script: s?.script ?? { content: '', revision: 0 }, presence: s?.presence ?? EMPTY_PRESENCE,
      reading: s?.reading ?? EMPTY_READING, editing: s?.editing ?? EMPTY_EDITING,
      sessionEpoch: s?.session_epoch ?? null, displayId: s?.display_id ?? null, connectionId: s?.connection_id ?? null,
      displaySettings: null, clockOffset: this.state.clockOffset, now: localNow, path: 'direct',
      request: this.request, send: this.sendCommand, reconnect: () => this.close('Exchange fresh pairing data to reconnect.') }
  }
  close = (message = 'Not paired') => {
    const active = this.authenticated || this.ready
    this.authenticated = false; this.ready = false; this.sentScript = 0; this.dirty = false
    this.output = Promise.resolve(); this.syncPromise = null
    const channel = this.channel, pc = this.pc
    this.channel = null; this.pc = null; this.material = null; this.transfer = null; this.receivedSequence = 0
    channel?.close(); pc?.close()
    this.pending.forEach(p => { clearTimeout(p.timer); p.resolve({ ok: false, reason: 'connection_changed' }) }); this.pending.clear()
    if (active && this.host) { this.host.peer(false); this.host.suspend() }
    this.update({ connection: 'offline', message })
  }
  dispose = () => {
    this.disposed = true; this.close(); clearInterval(this.timer); this.unsubscribe?.(); this.listeners.clear()
    document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('pagehide', this.hide); document.removeEventListener('freeze', this.hide)
  }
}
