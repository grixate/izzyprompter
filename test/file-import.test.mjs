import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_SCRIPT_FILE_BYTES,
  prepareScriptImport,
  validateScriptFile,
} from '../src/domain/fileImport.ts'

test('accepts txt and markdown filenames case-insensitively', () => {
  assert.deepEqual(validateScriptFile({ name: 'Camera script.TXT', size: 120 }), {
    ok: true,
    title: 'Camera script',
  })
  assert.deepEqual(validateScriptFile({ name: 'Launch.Md', size: 120 }), {
    ok: true,
    title: 'Launch',
  })
})

test('rejects unsupported formats without reading or changing the current draft', () => {
  for (const name of ['script.docx', 'script.rtf', 'script.pdf', 'script', 'script.txt.exe']) {
    assert.deepEqual(validateScriptFile({ name, size: 120 }), {
      ok: false,
      message: 'UNSUPPORTED FORMAT · USE .TXT OR .MD',
    })
  }
})

test('rejects oversized files at the validation boundary', () => {
  assert.equal(validateScriptFile({ name: 'large.txt', size: MAX_SCRIPT_FILE_BYTES }).ok, true)
  assert.deepEqual(validateScriptFile({ name: 'large.txt', size: MAX_SCRIPT_FILE_BYTES + 1 }), {
    ok: false,
    message: 'FILE TOO LARGE · 2 MB MAX',
  })
})

test('normalizes imported file content through the canonical text pipeline', () => {
  assert.deepEqual(
    prepareScriptImport(
      { name: '  Field notes.md', size: 60 },
      '\ufeffFirst\u00a0paragraph\r\n\r\n\r\nSecond paragraph\u200b',
    ),
    {
      ok: true,
      title: 'Field notes',
      content: 'First paragraph\n\nSecond paragraph',
    },
  )
})

test('rejects an empty or formatting-only supported file', () => {
  assert.deepEqual(prepareScriptImport({ name: 'empty.txt', size: 8 }, '\ufeff\u200b  \r\n'), {
    ok: false,
    message: 'NO READABLE TEXT IN FILE',
  })
})
