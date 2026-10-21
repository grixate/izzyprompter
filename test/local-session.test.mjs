import assert from 'node:assert/strict'
import test from 'node:test'
import { createIzzyDocumentFromLegacyText } from '../src/domain/document.ts'
import { DEFAULT_PROMPT_SETTINGS } from '../src/domain/storage.ts'
import { LocalSessionController } from '../src/local/controller.ts'
import { remapOffset, validContent } from '../src/local/document.ts'

function fixture() {
  let time = 100
  const document = createIzzyDocumentFromLegacyText('Alpha reading word\n\nSecond paragraph\n\nThird paragraph')
  const controller = new LocalSessionController(document, DEFAULT_PROMPT_SETTINGS, null, () => time, 'test-epoch')
  const checkpoint = (position = 100, maximum = 1000, offset = 6) => {
    const s = controller.getSnapshot()
    return controller.execute('reading:checkpoint', { anchor: { blockId: document.blocks[0].id, characterOffset: offset },
      position, maximum, transport_position: s.transport.anchor_position,
      script_revision: s.script.revision, transport_revision: s.transport.revision })
  }
  return { controller, document, checkpoint, advance: delta => { time += delta } }
}
test('standalone play/pause uses the monotonic clock and preserves elapsed movement', () => {
  const { controller, advance } = fixture()
  controller.execute('transport:play'); advance(2000)
  assert.equal(controller.execute('transport:pause').ok, true)
  assert.equal(controller.getSnapshot().transport.anchor_position, 52 * .56 * 2)
  advance(60000)
  assert.equal(controller.getSnapshot().transport.status, 'paused')
  assert.equal(controller.getSnapshot().presence.remote, 0)
})
test('reading controls share canonical settings and reject delayed revisions', () => {
  const { controller } = fixture()
  assert.equal(controller.execute('settings:update', { settings_revision: 1, patch: { fontSize: 90 } }).ok, true)
  assert.equal(controller.getSnapshot().display_settings.fontSize, 90)
  assert.equal(controller.execute('settings:update', { settings_revision: 1, patch: { fontSize: 20 } }).reason, 'settings_conflict')
  assert.equal(controller.execute('settings:update', { settings_revision: 2, patch: { content: 'private' } }).reason, 'invalid_settings')
  assert.equal(controller.execute('transport:set_speed', { speed: .6 }).ok, true)
  assert.equal(controller.getSnapshot().display_settings.speed, .6)
})
test('editing another paragraph keeps the reading anchor separate from the edit selection', () => {
  const { controller, document, checkpoint } = fixture()
  checkpoint(100, 1000, 6)
  assert.equal(controller.execute('script:begin_edit', {}, 'local-remote').ok, true)
  assert.equal(controller.execute('script:select_block', { block_id: document.blocks[2].id }, 'impostor').reason, 'edit_not_owned')
  assert.equal(controller.execute('script:select_block', { block_id: document.blocks[2].id }, 'local-remote').ok, true)
  assert.equal(controller.execute('script:patch_block', { block_id: document.blocks[2].id, base_revision: 1, text: 'A new closing paragraph' }, 'local-remote').ok, true)
  assert.deepEqual(controller.getSnapshot().transport.semantic_anchor.anchor, { blockId: document.blocks[0].id, characterOffset: 6 })
})
test('semantic navigation and measured bounds discard overshoot before reversing', () => {
  const { controller, checkpoint, document } = fixture()
  assert.equal(checkpoint(950).ok, true)
  controller.execute('transport:seek_delta', { delta: 500 })
  assert.equal(controller.getSnapshot().transport.anchor_position, 50)
  checkpoint(1000)
  controller.execute('transport:seek_delta', { delta: -48 })
  assert.equal(controller.getSnapshot().transport.anchor_position, 2)
  controller.execute('transport:step_block', { direction: 1 })
  assert.equal(controller.getSnapshot().transport.semantic_anchor.anchor.blockId, document.blocks[1].id)
})
test('invalid and remote-forged checkpoints cannot replace local measurements', () => {
  const { controller, checkpoint } = fixture()
  checkpoint()
  const before = controller.getSnapshot()
  assert.equal(controller.execute('reading:checkpoint', {}, 'local-remote').reason, 'forbidden')
  assert.equal(controller.execute('reading:checkpoint', { position: NaN }).reason, 'stale_reading')
  assert.equal(controller.execute('transport:set_speed', { speed: Infinity }).ok, false)
  assert.equal(controller.execute('transport:seek_delta', { delta: NaN }).ok, false)
  assert.equal(controller.execute('transport:seek_anchor', { anchor: { blockId: 'missing', characterOffset: 0 } }).ok, false)
  assert.equal(controller.getSnapshot(), before)
})
test('Quick Edit requires paused fresh measurements, ownership and current revisions', () => {
  const { controller, checkpoint, document } = fixture()
  assert.equal(controller.execute('script:begin_edit', {}, 'local-remote').reason, 'reading_unavailable')
  checkpoint()
  assert.equal(controller.execute('script:begin_edit', {}, 'local-remote').ok, true)
  assert.equal(controller.execute('transport:play').reason, 'editing_active')
  const patch = { block_id: document.blocks[0].id, base_revision: 1, text: 'New Alpha reading word' }
  assert.equal(controller.execute('script:patch_block', patch, 'other').reason, 'edit_not_owned')
  assert.equal(controller.execute('script:patch_block', { ...patch, base_revision: 0 }, 'local-remote').reason, 'edit_conflict')
  assert.equal(controller.execute('script:patch_block', patch, 'local-remote').ok, true)
  const s = controller.getSnapshot()
  assert.equal(s.script.document.blocks[0].id, document.blocks[0].id)
  assert.equal(s.transport.semantic_anchor.anchor.characterOffset, 10)
  assert.equal(s.script.revision, 2)
  assert.equal(s.reading.checkpoint, null)
  assert.equal(controller.execute('script:end_edit', {}, 'local-remote').ok, true)
  assert.equal(controller.getSnapshot().transport.status, 'paused')
})
test('disconnect/suspension clears ownership and restores from a semantic anchor paused', () => {
  const { controller, checkpoint, document } = fixture()
  checkpoint(); controller.execute('script:begin_edit', {}, 'local-remote'); controller.peer(true)
  controller.peer(false); controller.suspend()
  assert.equal(controller.getSnapshot().editing.active, null)
  const recovered = new LocalSessionController(document, DEFAULT_PROMPT_SETTINGS,
    controller.getSnapshot().transport.semantic_anchor.anchor, () => 900000, 'new-epoch')
  assert.equal(recovered.getSnapshot().transport.status, 'paused')
  assert.equal(recovered.getSnapshot().transport.semantic_anchor.anchor.characterOffset, 6)
  assert.equal(recovered.getSnapshot().session_epoch, 'new-epoch')
})
test('large, non-finite and invalid text inputs fail without mutating a take', () => {
  assert.equal(validContent('a'.repeat(2 * 1024 * 1024 + 1)), false)
  assert.equal(validContent('x\0y'), false)
  assert.equal(validContent(Array(5002).fill('x').join('\n\n')), false)
  const { controller, checkpoint } = fixture()
  checkpoint(); controller.execute('script:begin_edit', {}, 'local-remote')
  const before = controller.getSnapshot()
  assert.equal(controller.execute('script:patch_block', { block_id: before.editing.active.block_id, base_revision: 1, text: 'x\0y' }, 'local-remote').ok, false)
  assert.equal(controller.getSnapshot(), before)
})
test('UTF-16 remapping preserves the reading suffix through emoji and inserted prefixes', () => {
  assert.equal(remapOffset('🎬 Read this word', 'Intro 🎬 Read this word', 8), 14)
  assert.equal(remapOffset('abXYcd', 'abZcd', 4), 3)
  assert.equal(remapOffset('abcd', 'abXYcd', 2), 4)
})
