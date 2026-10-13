import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
const ignore = await readFile(new URL('../.dockerignore', import.meta.url), 'utf8')

test('hosted container pins its three base manifests and copies only built release into runtime', () => {
  const bases = dockerfile.match(/^FROM .+$/gm)
  assert.equal(bases.length, 3)
  for (const base of bases) assert.match(base, /@sha256:[a-f0-9]{64} AS (client|server|runtime)$/)
  const runtime = dockerfile.split(' AS runtime\n')[1]
  assert.match(runtime, /COPY --from=server --chown=izzy:izzy \/release/)
  assert.doesNotMatch(runtime, /npm|mix (?:deps|compile|release)|COPY (?:src|api|\. )/)
  assert.match(runtime, /USER izzy:izzy/)
  assert.match(runtime, /install -d -o izzy -g izzy -m 0700 \/app\/tmp/)
  assert.match(runtime, /CMD \["bin\/teleprompter", "start"\]/)
  assert.match(runtime, /STOPSIGNAL SIGTERM/)
})

test('container retains one-origin build and fail-closed public runtime configuration', () => {
  assert.match(dockerfile, /RUN npm ci\n/)
  assert.match(dockerfile, /RUN npm run build:server\n/)
  assert.match(dockerfile, /IZZY_MODE=public/)
  assert.match(dockerfile, /RELEASE_DISTRIBUTION=none/)
  assert.match(dockerfile, /ERL_CRASH_DUMP=\/dev\/null/)
  assert.match(dockerfile, /\/health\/ready/)
  assert.doesNotMatch(dockerfile, /^(?:ENV|ARG) (?:PUBLIC_ORIGIN|SECRET_KEY_BASE)/m)
  assert.doesNotMatch(dockerfile, /mix phx\.server|VITE_SOCKET_URL=/)
})

test('container context defaults to exclusion and omits host secrets and generated releases', () => {
  const rules = ignore.split('\n').filter((line) => line && !line.startsWith('#'))
  assert.equal(rules[0], '**')
  for (const required of ['!src/**', '!api/lib/**', '!api/mix.lock', '!package-lock.json', '!scripts/offlinePlugin.ts', '!public/**']) assert.ok(rules.includes(required))
  for (const excluded of ['**/.env*', '**/*.key', '**/*.pem', '**/erl_crash.dump', '**/_build/**', '**/node_modules/**', 'api/priv/static/app/**']) assert.ok(rules.includes(excluded))
  // Re-including a parent also includes its descendants in Docker's matcher.
  // Re-exclude each broad API level before admitting specific children.
  for (const directory of ['api', 'api/priv', 'api/priv/static', 'scripts']) {
    assert.ok(rules.indexOf(`${directory}/*`) > rules.indexOf(`!${directory}/`))
  }
  // The offline Vite plugin is build input. Admit only that file after
  // excluding other scripts, including launchers and package builders.
  const buildScriptRules = new Set(['!scripts/', '!scripts/offlinePlugin.ts'])
  for (const line of rules.filter((line) => line.startsWith('!') && !buildScriptRules.has(line))) assert.doesNotMatch(line, /^!(?:\.git|artifacts|test|packaging|scripts|docs|\.env|api\/_build|api\/deps)(?:\/|$)/)
})
