import assert from 'node:assert/strict'
import test from 'node:test'
import { lifecycleAction } from '../src/realtime/lifecycle.ts'

const foreground = { role: 'remote', visible: true, online: true }

test('hidden phone controls suspend, while a hidden display can continue locally', () => {
  assert.equal(lifecycleAction('visibility', { ...foreground, visible: false }), 'suspend')
  assert.equal(lifecycleAction('visibility', { ...foreground, visible: false, role: 'display' }), 'none')
  assert.equal(lifecycleAction('visibility', { ...foreground, visible: false, role: 'editor' }), 'none')
})

test('foreground and online hints require a fresh join only when visible and online', () => {
  assert.equal(lifecycleAction('visibility', foreground), 'resume')
  assert.equal(lifecycleAction('online', foreground), 'resume')
  assert.equal(lifecycleAction('resume', foreground), 'resume')
  assert.equal(lifecycleAction('resume', { ...foreground, visible: false }), 'none')
  assert.equal(lifecycleAction('online', { ...foreground, visible: false }), 'none')
  assert.equal(lifecycleAction('visibility', { ...foreground, online: false }), 'none')
})

test('page exit suspends all roles; only a persisted pageshow requests restoration', () => {
  for (const role of ['editor', 'display', 'remote']) {
    assert.equal(lifecycleAction('pagehide', { ...foreground, role }), 'suspend')
    assert.equal(lifecycleAction('offline', { ...foreground, role }), 'suspend')
    assert.equal(lifecycleAction('freeze', { ...foreground, role }), 'suspend')
  }
  assert.equal(lifecycleAction('pageshow', foreground), 'none')
  assert.equal(lifecycleAction('pageshow', { ...foreground, persisted: true }), 'resume')
  assert.equal(lifecycleAction('pageshow', { ...foreground, persisted: true, online: false }), 'none')
})
