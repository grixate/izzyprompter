# IZZY V1 — accounts, library and lifetime Pro

Updated 2026-10-12: **lava.top is the sole checkout provider; Lifetime Pro is US$29 once, USD only.** This supersedes the earlier dual-provider proposal. Historical purchases and grants remain readable. Payment activation, Google/SMTP delivery and public deployment require server/merchant configuration and verification; no real purchase, refund or payout has been performed. Follow [Lava.top setup](LAVA_TOP.md).

## Product and architecture

- Guest prompting remains available without a database or login. Hosted phone/tablet sessions require internet access to the Phoenix server, not a user computer.
- A free account has three non-trashed scripts. A production Pro grant removes the count limit and enables named/default presets. Document and realtime budgets remain unchanged.
- Fixed prices are **RUB 249,000 kopecks** or **USD 2,900 cents**. The browser cannot set a price. No exchange-rate calculation occurs in IZZY.
- React, account HTTP endpoints, authenticated account channels and capability-based session channels run on one origin. PostgreSQL stores accounts, tokens, scripts/revisions, mutation receipts, presets, checkout attempts, event inbox, grants and audits.
- Ordinary account editing saves after 500 ms, one request at a time. Newest pending text is journaled in IndexedDB under account/script/draft identity. Each tab has its own journal; closed-tab drafts can be explicitly recovered from the account library. Another account's data is never silently adopted. Device storage is not a backup: browser clearing/private-mode restrictions can remove it; export remains available.
- Compare-and-swap revisions and mutation IDs prevent silent overwrites/repeated writes. Conflicts explicitly choose saved, local, or a new copy. Receipts expire after 30 days; an old retry then conflicts against its stale revision instead of overwriting newer text.
- Saved scripts do not require pairing. A live session privately binds one saved script, serializes library and remote Quick Edit changes, and acknowledges saved text only after database commit. Playback stays in the session process while a supervised task writes to PostgreSQL. Account notifications and session snapshots update other views. Restarting Phoenix ends sessions, not saved scripts.
- Presets are copied into a session. Explicit live application preserves playback position and broadcasts display settings. Revocation never deletes scripts/presets: existing scripts remain editable/exportable; new scripts above the free allowance and preset application are blocked on the server.
- Trash is recoverable for 30 days and does not count toward the free quota. A bounded maintenance pass removes expired trash, login/session tokens and old mutation receipts. Commerce history is not purged by that job.

## Development setup

Use PostgreSQL 16+, Node 24+, Elixir 1.19 / OTP 28. `.env.example` lists runtime variables without real secrets. Phoenix reads exported environment variables, not the file automatically. Do not expose a trust-authenticated development database beyond loopback.

```sh
export DATABASE_URL='postgresql://izzy:YOUR_LOCAL_PASSWORD@127.0.0.1:5432/izzy_dev'
export PUBLIC_ORIGIN='http://localhost:5173'
cd api
mix deps.get
mix ecto.create
mix ecto.migrate
cd ..
npm ci
npm run dev
```

Open `/account` from the existing header. Development uses `Swoosh.Adapters.Local`; inspect delivered mail in a local IEx process with `Swoosh.Adapters.Local.Storage.Memory.all()`. Login links are secrets: do not copy mail bodies into diagnostics. There is intentionally no public test-login bypass or production mail-preview route. Production requires SMTP with STARTTLS and certificate verification; set `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USERNAME`, `SMTP_PASSWORD` and verify actual inbox delivery/SPF/DKIM.

For the already running account preview on port 5174, use the restricted development-only `mix izzy.preview_login` helper and Free/Pro reserved identities in [local testing](LOCAL_TESTING.md). It opens a normal single-use email login without sending mail or printing the token. Synthetic preview grants never count in production. This is not a public authentication bypass.

Register Google's exact callback URL `https://YOUR_DOMAIN/auth/google/callback`, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Verified Google identities are accepted, but an existing email account is not merged automatically: sign in by email first and explicitly link Google. Email login links last 15 minutes, are single-use and require a confirmation POST (email scanners do not consume them). Browser sessions last 30 days and are revocable by logout; account channel connections check expiry/revocation. Account operations use HttpOnly cookies, same-origin requests and CSRF protection. Production cookies are Secure.

## Payment readiness, 15 October 2026

The candidate includes persistent bounded checks for known Lava invoices,
reauthenticated purchase returns, support-review references and trusted minimal
release-eval tooling. See [payment readiness](PAYMENT_READINESS_2026-10-15.md).
Migration `20261015000000_schedule_payment_checks` is additive and must run before
the candidate serves account traffic. Sales and hosted configuration are unchanged.

## Payment setup — disabled by default

The owner selected lava.top exclusively on 2026-10-12 and confirmed a US$29 lifetime purchase, without rubles at launch. New checkout accepts only `provider=lava` and `currency=USD`; prices are server-owned. No subscriptions or paid skin selection are shipped by this integration. The twelve skins remain in the development lab.

Follow [Lava.top setup and acceptance](LAVA_TOP.md) for the one-time offer, server credentials, webhook selection, return flow and payment checks. Checkout stays disabled by default until the merchant is configured and verified. Missing or identical outbound/inbound credentials keep the offer unavailable, even if the global payment flag is on.

The Prodamus adapter and callback authentication remain for historical transaction support, but cannot start new checkout even if old Prodamus approval variables are set. Existing purchases, refunds and grants are not migrated or deleted.

### Shared processing and support

Set `IZZY_PAYMENTS_ENABLED=true` only after the release gates pass. Hosted payment pages own card entry; IZZY stores normalized transaction facts, not raw card/customer callback payloads. Authenticated events enter a durable unique inbox before delivery is acknowledged. A worker retries internal processing every five seconds. Invalid authentication, mismatched amounts/currencies and unmatched transactions cannot grant access.

A pending same-provider/currency checkout is reused. An ambiguous invoice-creation timeout blocks automatic retries. Moving from a legacy provider requires a warning/explicit confirmation after reviewing recorded status; older links may remain payable where cancellation is unavailable. Two paid attempts produce one effective Pro status and a duplicate-refund review flag. Full refunds revoke only the associated grant; another active grant keeps access. Partial refunds retain access. Disputes suspend the affected grant; delayed payment events cannot undo refunds/disputes.

Checkout HTTP admission is independently capped at six requests/account/minute and 100 total/minute; it does not consume script autosave budgets. Provider HTTP calls disable automatic retries and redirects, so credentials/signed orders are not forwarded to an unexpected redirect target. A timeout never overwrites a concurrently verified terminal payment state.

Operator support uses trusted release IEx/eval access (wrap eval operations in
`Teleprompter.Release.commerce(fn -> ... end)` on the new candidate), **not public HTTP endpoints**. Inspect `Teleprompter.Commerce.purchases(user)` and `Teleprompter.Repo.all(Teleprompter.Commerce.Event)` with scoped queries; do not dump all customer data into logs. Each action requires an operator identity and verified provider reference:

```elixir
Teleprompter.Commerce.reconcile(attempt_id, "operator:YOUR_ID")
Teleprompter.Commerce.operator_confirm(attempt_id, "paid", "operator:YOUR_ID", verified_reference)
Teleprompter.Commerce.operator_confirm(attempt_id, "failed", "operator:YOUR_ID", verified_failure_or_no_invoice_reference)
Teleprompter.Commerce.operator_confirm(attempt_id, "refunded", "operator:YOUR_ID", verified_full_refund_reference)
Teleprompter.Commerce.operator_confirm(attempt_id, "partial_refund", "operator:YOUR_ID", verified_partial_refund_reference)
Teleprompter.Commerce.operator_match_event(event_id, attempt_id, "operator:YOUR_ID", verified_match_reference)
Teleprompter.Commerce.operator_restore_dispute(attempt_id, "operator:YOUR_ID", verified_dispute_won_reference)
```

These functions record confirmed outcomes; **they do not send money or issue a provider refund**. Execute the refund in the approved provider workflow first. Never mark a payment confirmed from an email, return URL, screenshot alone, or an ambiguous timeout. Review unresolved events, ambiguous attempts and duplicate-payment flags routinely. Event processing is retryable across server restarts.

## Deployment, backup and restore gate

For the initial email-sign-in release, the owner selected the existing netcup
VPS and encrypted local backups on 14 October 2026 as a budget exception to the
managed-database recommendation below. See [account operations](ACCOUNT_OPERATIONS.md)
for the actual isolated databases, daily Mac recovery copy, verified hosted
restore and limits of local backups. Payments remain disabled.


Use one always-on Phoenix instance behind HTTPS with managed PostgreSQL; do not enable autoscaling/sleep/horizontal replicas while live sessions are in memory. Add `/account/socket` WebSocket forwarding and `/auth`, `/account` routes alongside the existing API/session routes. Set production SMTP, `DATABASE_URL`, exact HTTPS `PUBLIC_ORIGIN`, secret key, approved provider credentials and connection limits in the host's secret manager. Set `DATABASE_SSL_VERIFY=true` for managed PostgreSQL with a system-trusted certificate; it verifies CA and hostname. A host using a private CA needs an explicitly configured trusted CA before deployment, not disabled certificate verification.

Build the existing container or bundled release. Run migrations **once as a release step**, before routing traffic; they are not run on ordinary application startup:

```sh
bin/teleprompter eval 'Teleprompter.Release.migrate()'
bin/teleprompter start
```

Readiness checks the bundle, core processes and a bounded database/schema query when accounts are enabled. Liveness does not depend on PostgreSQL. A database outage must not restart the app in a loop or force playback commands to wait for saves. Account UI retains pending edits and reports failed saves.

Before accepting customers, enable managed automatic backups and point-in-time recovery. Record retention, encryption, restore permissions, RPO/RTO and responsible operator. Perform a real **isolated** restore drill, never restore over the live database: restore a backup to a new database, migrate to the matching release, start a separate instance with payments disabled and isolated mail/provider credentials, verify account isolation, script text/revisions, trash, presets, grants and inbox deduplication. Confirm no notifications/real payment calls escape the drill. Record timings and evidence; securely remove the isolated restore only after review. A written procedure is not a verified restore.

The local `npm run test:restore` drill now actually dumps/restores two newly created fixture databases, compares every durable table and verifies restored account isolation, script revisions/IDs, trash, presets, grants and event idempotency without starting provider/mail workers. It removes only its owned fixture databases and dump. This verifies the data model/restore tooling, not a future host's backups or PITR. See [local instructions](LOCAL_TESTING.md) and [security review](../security_best_practices_report.md).

## Verification and outstanding gates

```sh
npm test
cd api
DATABASE_URL='postgresql://.../izzy_test' MIX_ENV=test mix ecto.migrate
DATABASE_URL='postgresql://.../izzy_test' mix test
cd ..
IZZY_E2E_DATABASE_URL='postgresql://.../izzy_test' npm run test:browsers
npm run test:security-deps
npm run test:restore
npm run test:release
```

Use a migrated **disposable** database for tests. Without `DATABASE_URL`, database tests are explicitly excluded and guest-only tests still run. The account browser fixture creates isolated users directly in the test database; production exposes no fixture endpoint. CI has separate guest, PostgreSQL/account-browser, and container jobs, with no deployment/payment activation.

Still required before paid launch: real SMTP/Google callbacks, actual provider-approved currencies/conversions/notifications, provider-supported or authorized real purchase/refund/payout checks for **lava.top**, policy/receipts review, chosen-host deployment/rollback and backup restore drill, container startup, and physical phone/tablet pairing/background/reconnect/realtime editing on the hosted HTTPS release. Automated browser tests are not substitutes for those checks. WebRTC, subscriptions, teams, DOCX/PDF, rich text, version-history UI and internet-free phone/tablet pairing remain deferred.
