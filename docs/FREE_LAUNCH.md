# IZZY — online free launch

Baseline decision: 2026-10-11. Payment direction updated 2026-10-12: integrate lava.top exclusively, US$29 Lifetime Pro in USD; see [Lava.top setup](LAVA_TOP.md). Free-only configuration below remains the deployment baseline until payment activation. **Prepared locally, not deployed or approved for public release.**

## What launches

Planning update (2026-10-12): [Direct communication and offline operation](LOCAL_COMMUNICATION_PLAN.md) reopens local/offline planning. References to offline/WebRTC deferral below describe current release scope; implementation and physical acceptance are still pending. Hosted release behavior is unchanged.

- Guest: paste → pair → prompt, no account required.
- Free account: three active saved scripts; saving before pairing, search, rename, duplicate, TXT/Markdown import, plain-text export and recoverable trash.
- Phoenix synchronization: phone remote, tablet display, live text edits on connected screens and durable account persistence.
- Existing industrial remote, reading window and interactive entry design are preserved. The account sidebar explains the workflow instead of advertising unavailable purchases or showing an empty locked presets form.
- Both devices need internet access to IZZY, but not the same Wi-Fi or a computer. Pending text survives short disconnections where device storage is available; this is **not an offline app or offline pairing**.

Offline installation and WebRTC are deferred. Lava.top payments are now implemented but disabled until configured and verified. Historical purchases/grants remain intact. Do not delete existing Pro data or grant synthetic preview Pro in production.

## Server handoff

The owner supplies the domain, host/region, OS/CPU architecture, deployment method, PostgreSQL service and SMTP service. Share configuration names, not passwords or login links in chat.

Use one always-on Phoenix instance behind HTTPS, serving the compiled frontend and API from the **same canonical origin**, with PostgreSQL. No Vite server, idle suspension, horizontal autoscaling or public Erlang distribution. In-memory live sessions end on app restart; durable scripts do not. The hosted product needs no local computer.

Runtime configuration (host secret store; Phoenix does not read dotenv automatically):

| Variable | Free production requirement |
| --- | --- |
| `PHX_SERVER` | `true` |
| `IZZY_MODE` | `public` |
| `PUBLIC_ORIGIN` | Exact canonical HTTPS origin, no path |
| `SECRET_KEY_BASE` | Fresh production secret, at least 64 bytes; stable across restarts |
| `DATABASE_URL` | Private PostgreSQL connection, not the development database |
| `DATABASE_SSL_VERIFY` | `true` for managed PostgreSQL over TLS; verify provider CA/network requirements |
| `POOL_SIZE` | Existing default 10; measure against host/database limits |
| `MAIL_FROM` | Verified sending address |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Approved delivery; current adapter requires authenticated STARTTLS and certificate verification |
| `IZZY_PAYMENTS_ENABLED` | Explicitly `false` |
| `PRODAMUS_APPROVED`, `LAVA_APPROVED` | Explicitly `false`; no payment credentials needed |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional; unset until exact HTTPS callback/linking is verified |
| `IZZY_TRUSTED_PROXY_IPS` | Only exact verified proxy peers, if needed; never trust arbitrary forwarded headers |

Do not copy development loopback trust authentication, HTTP origins, local mail or demo grants into production. SMTP is required for account-enabled production even with Google. Without SMTP, guest-only beta is a separate reduced scope—not launched accounts.

## Build, migrate and release

The root `Dockerfile` builds a Linux release with the frontend bundled into Phoenix. Run `npm run test:container` on a Docker-capable machine/runner before selecting that image. No local engine was available during preparation; the image is **not verified** on this Mac.

With a production-built release and its secrets present, migrations are explicit:

```sh
bin/teleprompter eval 'Teleprompter.Release.migrate()'
bin/teleprompter start
```

Run migrations once as a controlled release step, never concurrently in multiple replicas. Restrict the internal HTTP port to the proxy. Verify HTTPS redirects, WSS upgrades, HSTS, body limits and connection/handshake timeouts at the real edge. Application message budgets do not replace pre-authentication connection protection.

Check `/health/live` for liveness and `/health/ready` for frontend, session services and account database before routing traffic. Readiness is not a load test or a full business-transaction check.

## Gates before opening the public URL

1. Pass Linux image build/startup on the selected architecture, then an account-enabled deployment smoke against a disposable staging database.
2. Verify real email delivery, sender authentication, expiry, single use, logout and account isolation. If enabling Google, verify callback and explicit linking. Do not log login links, capability fragments, scripts or provider payloads.
3. Confirm checkout disabled in the interface and on direct API requests. Existing adapters are not an activated paid product.
4. Save before pairing; edit from account view and phone; disconnect/reconnect; refresh pending edits; resolve a revision conflict explicitly. Accepted edits must reach all connected views and persist across server restart.
5. Check creation/duplication/restoration limits, editing/export at the limit and trash recovery. Trash retention is 30 days; configure and observe the existing maintenance job.
6. Configure scheduled PostgreSQL backups and perform a **real staging restore**. Record retention, recovery point/time, permissions and the operator procedure. Local fixture restore does not prove hosted backups.
7. Measure realistic long-script/multiple-session CPU, memory and database behavior. Configure privacy-safe error, readiness, backup and resource alerts; inspect actual logs and monitoring.
8. Deploy and roll back on staging. Warn that restarts end live sessions and require fresh pairing. Retain a database backup and compatible previous image; application rollback does not undo migrations automatically.
9. Obtain owner-approved terms, privacy/retention information, support contact and public copy. Free launch removes merchant onboarding as a blocker, not account-data/privacy responsibilities. Do not publish placeholder legal promises.

## Physical iPad + iPhone acceptance

Test the actual HTTPS staging site. Automated WebKit is **not** physical Safari/iOS acceptance.

| Scenario | Required result |
| --- | --- |
| iPad starts, iPhone scans QR | Correct role-bound remote; play, jog and speed work |
| Phone cellular, tablet Wi-Fi | Hosted control works without a local-network dependency |
| Long text and tablet rotation | Readable text, sensible position, reachable controls |
| Quick Edit / account edit | All connected screens update before Done; account reports saved only after persistence |
| Lock phone / switch apps / return | Fresh state; no old jog-command replay |
| Brief connection loss | Honest disabled controls; recoverable pending text; no overwrite of newer edits |
| Expired link / server restart | Clear recovery, no empty replacement session; saved text survives and new pairing is explicit |
| Unavailable device storage | Online account saving works; no false promise of local recovery |

Record OS/browser versions and observed outcomes in `REMOTE_DEVICE_QA.md`; retain failures/open rows. Use synthetic scripts until privacy/operational acceptance is complete.

## Local preview and evidence

See [LOCAL_TESTING.md](LOCAL_TESTING.md) for the account-enabled preview and restricted demo login. Dated verification and limitations are in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and the [security review](../security_best_practices_report.md). No hosting purchase, public deployment, real identity/provider acceptance, commit or push is implied.
