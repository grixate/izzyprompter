import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const execute = promisify(execFile)

test('isolated PostgreSQL backup restores private scripts, revisions, trash, presets and idempotent commerce facts', { timeout: 90_000 }, async () => {
  const uri = new URL(process.env.IZZY_RESTORE_PG_URL || 'postgresql://grixate@127.0.0.1:55432/postgres')
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname), 'Restore drill only accepts a loopback PostgreSQL server')
  const pgBin = process.env.IZZY_PG_BIN || '/opt/homebrew/opt/postgresql@16/bin'
  const pgEnv = { ...process.env, PGHOST: uri.hostname, PGPORT: uri.port || '5432', PGUSER: decodeURIComponent(uri.username), PGPASSWORD: decodeURIComponent(uri.password) }
  const prefix = `izzy_restore_${randomBytes(8).toString('hex')}`
  const source = `${prefix}_source`, restored = `${prefix}_restored`
  const temporary = await mkdtemp(join(tmpdir(), 'izzy-restore-'))
  await chmod(temporary, 0o700)
  const dump = join(temporary, 'fixture.dump')
  const created = []
  const pg = (tool, args) => execute(join(pgBin, tool), args, { env: pgEnv, timeout: 30_000, maxBuffer: 1024 * 1024 })
  const mix = async (db, args) => {
    const database = new URL(uri); database.pathname = `/${db}`
    // No app/endpoint/worker startup: this drill cannot send mail, create
    // invoices or process restored notifications against real providers.
    const result = await execute('mix', args, { cwd: 'api', env: { ...process.env, MIX_ENV: 'test', DATABASE_URL: database.href, IZZY_PAYMENTS_ENABLED: 'false' }, timeout: 45_000, maxBuffer: 1024 * 1024 })
    return result.stdout
  }
  try {
    for (const db of [source, restored]) { await pg('createdb', [db]); created.push(db) }
    await mix(source, ['ecto.migrate'])
    await mix(source, ['run', '--no-start', '-e', `
      Application.ensure_all_started(:ecto_sql)
      Application.ensure_all_started(:postgrex)
      {:ok, _} = Teleprompter.Repo.start_link()
      alias Teleprompter.{Repo, Accounts, Library, Commerce}
      user = Repo.insert!(%Accounts.User{email: "restore-owner@izzy.example"})
      Repo.insert!(%Accounts.User{email: "restore-other@izzy.example"})
      Accounts.issue_token(user.id, "session", 3600)
      Repo.insert!(%Accounts.Identity{user_id: user.id, provider: "email", subject: user.email})
      document = %{"schemaVersion" => 1, "id" => "restore-document", "title" => "Private", "blocks" => [%{"id" => "stable-paragraph", "type" => "paragraph", "text" => "Unpublished restore fixture."}]}
      script = Repo.insert!(%Library.Script{user_id: user.id, title: "Private", document: document, revision: 7})
      Repo.insert!(%Library.Mutation{script_id: script.id, mutation_id: "restore-mutation", fingerprint: <<1,2,3>>, result: Library.serialize(script)})
      Repo.insert!(%Library.Script{user_id: user.id, title: "Trash", document: document, deleted_at: DateTime.utc_now()})
      Repo.insert!(%Library.Preset{user_id: user.id, name: "Studio", is_default: true, settings: Teleprompter.PromptSettings.defaults()})
      intent = Repo.insert!(%Commerce.Intent{user_id: user.id})
      attempt = Repo.insert!(%Commerce.Attempt{intent_id: intent.id, provider: "lava", environment: "production", amount_minor: 2900, currency: "USD", external_id: "restore-invoice", status: "paid"})
      Repo.insert!(%Commerce.Grant{user_id: user.id, attempt_id: attempt.id})
      Repo.insert!(%Commerce.Attempt{intent_id: intent.id, provider: "lava", environment: "production", amount_minor: 2900, currency: "USD", external_id: "restore-pending-invoice", status: "pending", offer_id: "restore-offer", check_attempts: 3, next_check_at: DateTime.add(DateTime.utc_now(), 600, :second), check_lease_until: DateTime.add(DateTime.utc_now(), -1, :second), check_error: "status_unconfirmed"})
      Repo.insert!(%Commerce.Event{provider: "lava", environment: "production", external_key: "restore-event", status: "processed", payload: %{"external_id" => "restore-invoice", "type" => "paid", "amount_minor" => 2900, "currency" => "USD"}})
      Repo.insert!(%Commerce.Audit{attempt_id: attempt.id, actor: "restore-fixture", action: "verified"})
    `])
    const tables = ['schema_migrations', 'users', 'identities', 'account_tokens', 'scripts', 'script_mutations', 'presets', 'purchase_intents', 'checkout_attempts', 'payment_events', 'entitlement_grants', 'commerce_audits']
    const fingerprints = async db => {
      const result = {}
      for (const table of tables) {
        result[table] = (await pg('psql', ['--dbname', db, '--no-psqlrc', '--tuples-only', '--no-align', '--command', `SELECT count(*)::text || ':' || md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) FROM public.${table} t`])).stdout.trim()
      }
      return result
    }
    const before = await fingerprints(source)
    await pg('pg_dump', ['--dbname', source, '--format=custom', '--no-owner', '--no-privileges', '--file', dump])
    await chmod(dump, 0o600)
    await pg('pg_restore', ['--dbname', restored, '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', dump])
    assert.deepEqual(await fingerprints(restored), before)
    const verification = await mix(restored, ['run', '--no-start', '-e', `
      Application.ensure_all_started(:ecto_sql)
      Application.ensure_all_started(:postgrex)
      {:ok, _} = Teleprompter.Repo.start_link()
      alias Teleprompter.{Repo, Accounts, Library, Commerce}
      owner = Repo.get_by!(Accounts.User, email: "restore-owner@izzy.example")
      other = Repo.get_by!(Accounts.User, email: "restore-other@izzy.example")
      [script] = Library.list(owner)
      true = script.revision == 7
      true = hd(script.document["blocks"])["id"] == "stable-paragraph"
      [] = Library.list(other)
      nil = Library.get(other, script.id)
      [_] = Library.list(owner, "", true)
      [%{is_default: true}] = Library.presets(owner)
      pending = Repo.get_by!(Commerce.Attempt, external_id: "restore-pending-invoice")
      true = pending.check_attempts == 3 and pending.offer_id == "restore-offer" and pending.check_error == "status_unconfirmed"
      true = not is_nil(pending.next_check_at) and not is_nil(pending.check_lease_until)
      true = Commerce.pro?(owner)
      false = Commerce.pro?(other)
      event = Repo.get_by!(Commerce.Event, external_key: "restore-event")
      {:error, :already_processed} = Commerce.process_event(event.id)
      IO.write("RESTORE_VERIFIED")
    `])
    assert.match(verification, /RESTORE_VERIFIED/)
  } finally {
    for (const db of created.reverse()) {
      assert.match(db, /^izzy_restore_[a-f0-9]{16}_(source|restored)$/)
      await pg('dropdb', [db])
    }
    await rm(temporary, { recursive: true, force: true })
  }
})
