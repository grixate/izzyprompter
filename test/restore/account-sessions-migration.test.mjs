import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

const execute = promisify(execFile)

test('persistent sign-in migration preserves valid credentials, never revives expired ones and supports rollback in non-UTC databases', { skip: !process.env.IZZY_RESTORE_PG_URL, timeout: 120_000 }, async () => {
  const uri = new URL(process.env.IZZY_RESTORE_PG_URL)
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname), 'Migration drill requires a loopback test server')
  const pgBin = process.env.IZZY_PG_BIN || '/opt/homebrew/opt/postgresql@16/bin'
  const pgEnv = { ...process.env, PGHOST: uri.hostname, PGPORT: uri.port || '5432', PGUSER: decodeURIComponent(uri.username), PGPASSWORD: decodeURIComponent(uri.password), PGDATABASE: uri.pathname.slice(1) || 'postgres' }
  const pg = (tool, args) => execute(join(pgBin, tool), args, { env: pgEnv, timeout: 30_000, maxBuffer: 1024 * 1024 })
  for (const zone of ['UTC', 'America/Los_Angeles', 'Europe/Moscow']) {
    const db = `izzy_session_policy_${randomBytes(8).toString('hex')}`
    assert.match(db, /^izzy_session_policy_[a-f0-9]{16}$/)
    await pg('createdb', [db])
    const database = new URL(uri); database.pathname = `/${db}`
    const mix = args => execute('mix', args, { cwd: 'api', env: { ...process.env, MIX_ENV: 'test', DATABASE_URL: database.href, IZZY_PAYMENTS_ENABLED: 'false' }, timeout: 45_000, maxBuffer: 1024 * 1024 })
    const sql = command => pg('psql', ['--dbname', db, '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--command', command])
    try {
      await sql(`ALTER DATABASE ${db} SET timezone='${zone}'`)
      await mix(['ecto.migrate', '--to', '20261024000000'])
      // Synthetic hashes have no associated bearer token. Fixtures are UTC naive
      // timestamps like Ecto's utc_datetime_usec, even on a non-UTC connection.
      await sql(`
        INSERT INTO users(id,email,inserted_at,updated_at)
        VALUES(gen_random_uuid(),'migration-fixture@example.com',CURRENT_TIMESTAMP AT TIME ZONE 'UTC',CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
        INSERT INTO account_tokens(hash,user_id,kind,expires_at,inserted_at)
        SELECT decode(repeat(v.hash,32),'hex'),u.id,v.kind,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+v.lifetime,CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        FROM users u CROSS JOIN (VALUES
          ('01','session',INTERVAL '15 minutes'),('02','session',INTERVAL '-15 minutes'),
          ('03','login',INTERVAL '10 minutes'),('04','login',INTERVAL '-10 minutes')
        ) AS v(hash,kind,lifetime);
      `)
      await mix(['ecto.migrate'])
      const verify = `DO $$ BEGIN
        IF (SELECT count(*) FROM account_tokens WHERE persistent AND session_id IS NOT NULL AND expires_at>(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+INTERVAL '90 years') != 1 THEN RAISE EXCEPTION 'Valid legacy sign-in was not preserved'; END IF;
        IF (SELECT count(*) FROM account_tokens WHERE kind='login' AND NOT persistent AND session_id IS NULL) != 2 THEN RAISE EXCEPTION 'Email links were changed'; END IF;
        IF (SELECT count(*) FROM account_tokens WHERE kind='session' AND NOT persistent AND expires_at<(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND session_id IS NULL) != 1 THEN RAISE EXCEPTION 'Expired sign-in revived'; END IF;
      END $$;`
      await sql(verify)
      await mix(['ecto.rollback', '--step', '1'])
      // The previous image reads expires_at without the new fields. Leaving the
      // compatibility expiry must preserve its access checks after rollback.
      await sql(`DO $$ BEGIN
        IF (SELECT count(*) FROM account_tokens WHERE kind='session' AND expires_at>(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) != 1 THEN RAISE EXCEPTION 'Previous image cannot read valid sign-in'; END IF;
        IF (SELECT count(*) FROM account_tokens WHERE kind='session' AND expires_at<(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) != 1 THEN RAISE EXCEPTION 'Rollback revived expired sign-in'; END IF;
      END $$;`)
      await mix(['ecto.migrate'])
      await sql(verify)
    } finally {
      await pg('dropdb', [db])
    }
  }
})
