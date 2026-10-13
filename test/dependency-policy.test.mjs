import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('direct client/tool dependencies are exact versions matching the committed lockfile', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'))
  for (const group of ['dependencies', 'devDependencies']) {
    assert.deepEqual(lock.packages[''][group], manifest[group])
    for (const [name, version] of Object.entries(manifest[group])) {
      assert.match(version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/, `${name} must use an exact version`)
      assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${name} must match the locked version`)
    }
  }
})
