import type { IzzyDocumentV1 } from '../domain/document.ts'
import { izzyDocumentToLegacyText } from '../domain/document.ts'
import type { PromptSettingsV1 } from '../domain/storage.ts'
import { serverPosition } from '../prompt/motion.ts'
import { clamp, type ReadingAnchor } from '../prompt/position.ts'
import { latestReading } from '../realtime/reading.ts'
import type { CommandResult, ReadingCheckpoint, SessionSnapshot, TransportState } from '../realtime/protocol.ts'
import { bytes, remapOffset, validAnchor, validContent, validDocument, validSettings } from './document.ts'

export const localId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
export const localNow = () => performance.now()
const failure = (reason: string): CommandResult<never> => ({ ok: false, reason })
const pixel = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100_000_000

/** Single authority for a local take. Its clock is monotonic and never a server clock. */
export class LocalSessionController {
  private state: SessionSnapshot
  private listeners = new Set<() => void>()
  readonly now: () => number
  constructor(document: IzzyDocumentV1, settings: PromptSettingsV1, anchor: ReadingAnchor | null = null,
    now = localNow, epoch = localId()) {
    this.now = now
    if (!validDocument(document) || !validSettings(settings)) throw new Error('Invalid local script or settings')
    const target = anchor && validAnchor(document, anchor) ? anchor : { blockId: document.blocks[0].id, characterOffset: 0 }
    this.state = {
      // This is the UI snapshot shape. Direct wire messages have their own version.
      protocol_version: 2, session_id: `LOCAL-${document.id}`, session_epoch: epoch,
      script: { document: structuredClone(document), content: izzyDocumentToLegacyText(document), revision: 1 },
      transport: { status: 'paused', speed: settings.speed, anchor_position: 0, anchor_server_time: now(), revision: 1,
        semantic_anchor: { anchor: target, script_revision: 1, revision: 1, transport_position: 0 } },
      display_id: 'local-display', connection_id: 'local-display',
      presence: { editor: 1, display: 1, remote: 0 }, reading: { revision: 0, source_id: 'local-display', checkpoint: null },
      editing: { revision: 0, active: null }, display_settings: { ...settings }, settings_revision: 1, server_time: now(),
    }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(state: SessionSnapshot) { this.state = { ...state, server_time: this.now() }; this.listeners.forEach(fn => fn()) }
  private at(position: number, changes: Partial<TransportState> = {}): TransportState {
    return { ...this.state.transport, anchor_position: position, anchor_server_time: this.now(),
      revision: this.state.transport.revision + 1, ...changes }
  }
  private get position() { return serverPosition(this.state.transport, 0, this.now()) }
  private seekAnchor(anchor: ReadingAnchor) {
    const transport = this.at(this.position)
    transport.semantic_anchor = { anchor: { ...anchor }, script_revision: this.state.script.revision,
      revision: transport.revision, transport_position: transport.anchor_position }
    return transport
  }
  settings = (value: PromptSettingsV1) => {
    if (!validSettings(value)) return
    const s = this.state
    if (JSON.stringify(s.display_settings) === JSON.stringify(value)) return
    this.publish({ ...s, display_settings: { ...value }, settings_revision: (s.settings_revision ?? 0) + 1 })
  }
  peer = (connected: boolean) => {
    const s = this.state
    if (s.presence.remote === Number(connected)) return
    this.publish({ ...s, presence: { ...s.presence, remote: Number(connected) } })
  }
  suspend = () => {
    const s = this.state
    const anchor = latestReading(s.reading, s.transport, s.script.revision)?.anchor
    let transport = this.at(this.position, { status: 'paused' })
    if (anchor) {
      transport = { ...transport, semantic_anchor: { anchor, script_revision: s.script.revision,
        revision: transport.revision, transport_position: transport.anchor_position } }
    }
    this.publish({ ...s, transport, editing: { revision: s.editing.revision + 1, active: null } })
  }
  execute = (event: string, payload: Record<string, unknown> = {}, owner = 'local-display'): CommandResult<SessionSnapshot> => {
    const s = this.state, doc = s.script.document!
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('invalid_command')
    let next = s
    if (event === 'reading:checkpoint') {
      if (owner !== 'local-display') return failure('forbidden')
      if (payload.script_revision !== s.script.revision || payload.transport_revision !== s.transport.revision
        || !validAnchor(doc, payload.anchor) || !pixel(payload.position) || !pixel(payload.maximum)
        || payload.position > payload.maximum || typeof payload.transport_position !== 'number'
        || !Number.isFinite(payload.transport_position) || Math.abs(payload.transport_position) > 100_000_000) return failure('stale_reading')
      const checkpoint = { ...payload, anchor: { ...payload.anchor }, source_id: 'local-display', server_time: this.now() } as ReadingCheckpoint
      next = { ...s, reading: { ...s.reading, revision: s.reading.revision + 1, checkpoint } }
    } else if (event.startsWith('transport:')) {
      if (s.editing.active) return failure('editing_active')
      let transport: TransportState
      if (event === 'transport:play' || event === 'transport:pause') transport = this.at(this.position, { status: event === 'transport:play' ? 'playing' : 'paused' })
      else if (event === 'transport:set_speed' && typeof payload.speed === 'number' && Number.isFinite(payload.speed) && payload.speed >= .5 && payload.speed <= 1.5) {
        transport = this.at(this.position, { speed: payload.speed })
      } else if (event === 'transport:seek_delta' && typeof payload.delta === 'number' && Number.isFinite(payload.delta) && Math.abs(payload.delta) <= 10_000) {
        const cp = s.reading.checkpoint, current = this.position, intent = s.transport.semantic_anchor
        let target = current + payload.delta
        if (cp && cp.script_revision === s.script.revision && (!intent || cp.transport_revision >= intent.revision)) {
          const local = clamp(cp.position + current - cp.transport_position, 0, cp.maximum)
          target = cp.transport_position + clamp(local + payload.delta, 0, cp.maximum) - cp.position
        } else if (!intent) target = Math.max(0, target)
        transport = this.at(target)
      } else if (event === 'transport:seek_anchor' && validAnchor(doc, payload.anchor)) transport = this.seekAnchor(payload.anchor)
      else if (event === 'transport:step_block' && (payload.direction === -1 || payload.direction === 1)) {
        const anchor = latestReading(s.reading, s.transport, s.script.revision)?.anchor
        const index = doc.blocks.findIndex(b => b.id === anchor?.blockId)
        if (index < 0) return failure('reading_unavailable')
        transport = this.seekAnchor({ blockId: doc.blocks[clamp(index + payload.direction, 0, doc.blocks.length - 1)].id, characterOffset: 0 })
      } else return failure('invalid_command')
      next = { ...s, transport }
    } else if (event === 'script:begin_edit') {
      const cp = s.reading.checkpoint
      if (s.editing.active) return failure('editing_active')
      if (s.transport.status !== 'paused') return failure('pause_required')
      if (!cp || cp.script_revision !== s.script.revision || cp.transport_revision !== s.transport.revision) return failure('reading_unavailable')
      next = { ...s, editing: { revision: s.editing.revision + 1,
        active: { owner_id: owner, block_id: cp.anchor.blockId, anchor: { ...cp.anchor } } } }
    } else if (event === 'script:end_edit') {
      if (s.editing.active?.owner_id !== owner) return failure('edit_not_owned')
      next = { ...s, editing: { revision: s.editing.revision + 1, active: null } }
    } else if (event === 'script:patch_block') {
      const edit = s.editing.active
      if (!edit || edit.owner_id !== owner) return failure('edit_not_owned')
      if (payload.base_revision !== s.script.revision) return failure('edit_conflict')
      if (payload.block_id !== edit.block_id || !validContent(payload.text, true)) return failure('invalid_patch')
      const old = doc.blocks.find(b => b.id === edit.block_id)!
      const text = payload.text
      const document = { ...doc, blocks: doc.blocks.map(b => b.id === old.id ? { ...b, text } : b) }
      const content = izzyDocumentToLegacyText(document)
      if (bytes(content) > 2 * 1024 * 1024) return failure('invalid_patch')
      const anchor = { ...edit.anchor, characterOffset: remapOffset(old.text, text, edit.anchor.characterOffset) }
      const revision = s.script.revision + 1, transport = this.at(this.position, { status: 'paused' })
      transport.semantic_anchor = { anchor, script_revision: revision, revision: transport.revision, transport_position: transport.anchor_position }
      next = { ...s, script: { document, content, revision }, transport,
        reading: { ...s.reading, revision: s.reading.revision + 1, checkpoint: null },
        editing: { revision: s.editing.revision + 1, active: { ...edit, anchor } } }
    } else return failure('unknown_event')
    this.publish(next)
    return { ok: true, value: this.state }
  }
}
