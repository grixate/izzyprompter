# IZZY local security and edge-case review

2026-10-11 scope update: the owner selected an **online, free launch**. Merchant verification below remains a gate for a future paid release, not the current free beta. Identity, privacy, hosting, backup and physical-device gates still apply. Follow [FREE_LAUNCH.md](docs/FREE_LAUNCH.md). The original dated review is retained; the addendum below records subsequent checks.

Date: 2026-10-10. Scope: current React/TypeScript frontend, Phoenix account/library/session boundaries, provider adapters, dependency locks and local release. This is a repository-grounded engineering review and adversarial regression run, **not** a penetration-test certificate or paid-launch approval.

## Executive summary

The identified local issues below were repaired or explicitly mitigated. Cross-account requests, stale writes, expired/replayed login links, forged channel tickets and invalid payment notifications are refused in automated checks. No real merchant, identity, hosting or confidential customer data was used. Paid checkout remains disabled.

The JavaScript/React security-best-practices skill guided frontend review; Phoenix/Plug documentation and real server tests guided the Elixir checks. No Elixir-specific skill or blanket security guarantee is implied. Hosting/edge controls, provider-approved contracts, real identity delivery and physical devices remain release gates.

## Findings, ordered by severity

### SEC-01 — Critical advisory in development dependency; high advisories in server HTTP dependency — FIXED

Evidence: `package.json` pins concurrently 10.0.6; `package-lock.json` resolves patched shell-quote 1.12.0. `api/mix.exs:47` and `api/mix.lock:31` now pin Req 0.6.3, with compatible Finch 0.24.0. Cowlib is 2.21.0 (`api/mix.lock:6`).

Impact: vulnerable shell quoting can execute commands when malicious input reaches the development helper; vulnerable Req decompression could exhaust memory on an upstream compressed response, and affected multipart header handling could permit injection. App exploitability of the shell-quote/multipart paths was not demonstrated: current development commands are constants and payment calls do not upload user-controlled multipart files.

Remediation: upgraded to patched releases, rebuilt and exercised provider mocks and real release startup. `npm run test:security-deps` checks npm plus every pinned Hex package against OSV, fails closed on unavailable/incomplete responses, and runs in CI. It reports mitigations explicitly, never calls them zero vulnerabilities. Sources: [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), [Req decompression](https://osv.dev/vulnerability/EEF-CVE-2026-49755), [Req multipart](https://osv.dev/vulnerability/EEF-CVE-2026-49756), [cowlib cookie encoding](https://osv.dev/vulnerability/EEF-CVE-2026-43969).

### SEC-02 — Medium: provider timeout could overwrite a verified payment result — FIXED

Evidence: `api/lib/teleprompter/commerce.ex:145` now locks/reloads the current attempt before marking a failed link request ambiguous; only a still-creating attempt can transition. Terminal paid/refunded/disputed states survive.

Impact: a valid notification received while checkout creation timed out could previously leave inconsistent status and encourage unnecessary checkout switching. No unauthorized entitlement was demonstrated.

Verification: authenticated payment completion inside a mocked provider request followed by HTTP 504 retains the paid state and grant. Existing repeat/delayed event, wrong amount/currency, duplicate purchase, refund/dispute and switching tests also pass. No real payment was sent.

Additional defense: provider requests now refuse redirects as well as automatic retries. A synthetic 302 test verifies lava invoice creation, reconciliation and Prodamus link creation make no follow-up request, preventing an unexpected redirect from carrying credentials or signed order data elsewhere. This is defense in depth, not a demonstrated compromised-provider incident.

### SEC-03 — Medium: hostile money/envelope input was insufficiently bounded — FIXED

Evidence: `api/lib/teleprompter/commerce/provider.ex:26` bounds fixed-point money before Decimal operations; `api/lib/teleprompter/commerce/lava.ex:56` requires correctly shaped refund/dispute/payment envelopes. Provider callback bodies are capped at 64 KiB in `api/lib/teleprompter_web/limited_body.ex:6`.

Impact: authenticated malformed callbacks could cause unnecessary processing or pathological numeric allocation. Authentication remains required; this was not an unsigned-payment bypass.

Verification: giant exponents, fractional cents, negative/NaN/infinite/malformed amounts and malformed authenticated envelopes cannot grant access. Canonical script persistence strips unknown nested metadata, rejects duplicate paragraph IDs and rejects PostgreSQL-incompatible NULs before insertion. List-shaped query parameters/missing preset bodies now produce bounded normal/error responses rather than crashes.

### SEC-04 — Medium: old browser tabs could create a draft copy under a different cookie account — FIXED

Evidence: `src/account/api.ts:23`, `src/account/useSavedScript.ts:35` and `api/lib/teleprompter_web/account_auth.ex:19` bind writes to the confirmed/intended account and reject a mismatch with `409 account_changed`. Draft journals retain account/script/tab scopes.

Impact: after another tab changed the shared login cookie, a create/copy action could put the old tab's private text into the newly signed-in account. Existing script read/write ownership was already checked server-side; this is accidental cross-account adoption, not arbitrary ID access.

Verification: server rejects stale-account copy requests; real browsers switch identities with an unsent journal, show no other-account draft, refuse foreign script access, and recover text only when the original identity returns. Missing account-binding headers do not bypass normal ownership, authentication or CSRF checks.

### SEC-05 — Medium: account/provider data could enter routine diagnostics — FIXED FOR REVIEWED PATHS

Evidence: `api/config/config.exs:39` uses deny-all Phoenix parameter filtering (`{:keep, []}`), rather than a narrow key list. Ecto inspection redacts emails, identity subjects, token hashes, script titles/documents, mutation results, preset names, payment URLs/events and audit details. Database query logging remains disabled; routine session payload logging and OTP session status redaction remain in place.

Impact: logs could retain unpublished scripts, sign-in material or provider details. Verification checks custom/unknown parameter names and inspected schemas. Host access/error logs, APM metadata, crash collection and retention still require actual production review; this does **not** guarantee all third-party logging is sanitized. [Phoenix logging documentation](https://phoenix.hexdocs.pm/Phoenix.Logger.html).

### SEC-06 — Medium: authenticated checkout requests lacked their own admission budget — FIXED

Evidence: `api/lib/teleprompter_web/controllers/commerce_controller.ex:5` admits checkout through an independent bounded gate: six requests/account/minute, 100 total/minute, at most 1,024 retained hashed account keys. Failure is closed; rejection returns 429 and Retry-After. This is distinct from script autosave and email budgets.

Impact: an authenticated client could repeatedly request/switch hosted checkout links and consume provider resources. Existing pending-attempt reuse and explicit switching are retained. Verification exhausts checkout admission while ordinary script creation still succeeds. Distributed/edge abuse and provider-side limits remain hosting concerns; no general billing system was introduced.

### SEC-07 — Medium availability: library cards downloaded full documents — FIXED

Evidence: `api/lib/teleprompter/library.ex:13` selects paginated summaries with a PostgreSQL-side 110-character excerpt; the list endpoint and client use that summary contract. Full content remains available only through an owned script read.

Impact: a 30-item library page could serialize/download roughly 60 MB at the 2 MiB/script limit just to show cards, unnecessarily stressing the server and phone. Verification uses a long document, checks a sub-1,000-byte summary response without a document field and confirms the owner's full text is unchanged and another account sees nothing. Search still needs measured database indexing/resource tuning as real volume grows.

### SEC-08 — Low defense-in-depth: production browser restrictions incomplete — FIXED

Evidence: `api/lib/teleprompter_web/security_headers.ex:6` and endpoint placement (`api/lib/teleprompter_web/endpoint.ex:24`) add nosniff, no-referrer, DENY framing, restrictive permissions and an HTML Content Security Policy. Production scripts are same-origin only, with no unsafe-inline/eval script permission; objects/base injection/framing are blocked. Inline styles are intentionally allowed for live React geometry.

Verification: bundled production checks actual response headers and that an injected inline script is blocked while pairing/live edits still work. Script markup remains literal text in three browser engines; no raw HTML rendering sink was found in reviewed app code. Vite development does not use the strict production shell. HSTS and TLS belong to the actual HTTPS edge. [Phoenix security guidance](https://phoenix.hexdocs.pm/security.html).

## Remaining advisory — mitigation, not a patch

### SEC-09 — Medium upstream structured-header CRLF advisory — MITIGATED, RECHECK REQUIRED

Cowlib 2.21.0 remains listed for [EEF-CVE-2026-43966](https://cna.erlef.org/cves/CVE-2026-43966.html); no patched release was available at this review. Pinned Cowboy 2.19.0 rejects CR/LF response headers by default (protection introduced in 2.16). Reviewed app code does not feed untrusted values into structured-header encoders.

`api/test/teleprompter/cowboy_header_safety_test.exs:4` deliberately bypasses Plug validation and exercises the cowlib encoder plus actual Cowboy TCP response: the malicious header produces HTTP 500, never an injected header. `docs/security-advisory-exceptions.json` allows only this exact cowlib/Cowboy pin combination until **2026-11-10**. Dependency changes, expiration, or new findings fail the advisory gate. Recheck before launch and remove the exception when patched. Do not disable Cowboy's invalid-response-header protection.

## 2026-10-11 free-launch addendum

### SEC-10 — Upstream Decimal numeric allocation advisory — PATCHED

The repeat advisory check found CVE-2026-97853, published after the original review. `api/mix.exs` and `api/mix.lock` now pin Decimal **3.1.2**, replacing 3.1.1. The upstream issue permits excessive allocation when `Decimal.round/3` receives extreme precision. No app call to that affected function was found; a remotely exploitable IZZY path was not demonstrated. Provider amount parsing remains separately bounded. Sources: [Decimal advisory](https://github.com/ericmj/decimal/security/advisories/GHSA-6c27-994x-c52f), [Erlang Ecosystem Foundation record](https://cna.erlef.org/cves/CVE-2026-97853.html).

Post-patch verification: 134 PostgreSQL server tests, 87 guest-only tests (47 database exclusions), 79 client units, 145 checks across Chromium/Firefox/WebKit (two intentional clipboard skips), two actual bundled-release smoke checks and one isolated restore drill pass. Builds, formatting and application warnings-as-errors compilation pass. npm reports zero vulnerabilities; the 36 Hex pins have zero unresolved findings and the existing exact-version Cowlib mitigation—not zero advisories. An initial restart-test timeout was corrected to include the existing eight-second retry backoff plus transport time; the fresh full browser run passed without retries or production reconnect changes.

Free-launch behavior is now fail-closed in the interface as well as the server: no unavailable Pro sale or empty locked preset form; direct authenticated checkout refuses disabled payments. Commerce errors do not block the free library. Creation, duplication and restoration respect the three-script limit while editing/export remain available. Existing purchase history and access are preserved, not deleted. This slice adds twelve browser checks and deliberately does not activate merchants, change entitlement rules or claim offline support.

## Release gates still open

1. **High operational priority:** configure/verify HTTPS/WSS, HSTS, private origin listener, exact proxy trust, pre-auth socket/handshake/concurrent-connection limits and timeouts. Application frame/message budgets do not cap all idle unauthenticated connections. Measure memory/CPU/database/egress under the chosen host; verify alerts without capturing scripts/tokens.
2. **High commercial priority:** both merchants must approve the lifetime product, currencies and receipt/tax/refund process. Verify official signed/secret-authenticated merchant fixtures and authorized purchase/refund/payout checks. Redirects alone never prove payment. Local synthetic integration tests are not merchant certification.
3. **Identity:** verify real SMTP delivery, sender authentication and Google's exact HTTPS callback, including account linking on the configured client. Unit tests do not prove provider setup.
4. **Recovery:** local isolated dump/restore is verified; actual managed backup/PITR permissions, retention, RPO/RTO, restore timing and deployment/rollback remain unverified.
5. **Environment:** Linux container build/startup needs a working Docker runner; this Mac has no running Docker engine. CI changes are prepared, not remotely executed. Physical iOS/Android/tablet background/reconnect and hosted editing still need acceptance.
6. **Local preview boundary:** HTTP, debug mode, trust-authenticated loopback PostgreSQL and synthetic Pro are development-only. Do not expose the preview publicly or enter confidential scripts. Do not reuse development signing keys/database trust settings in production.

## Verification record

Final results: 79 client units; 134 PostgreSQL server tests; 87 server tests without a database (47 explicitly excluded); 133 browser checks passed across Chromium/Firefox/WebKit with two intentional native clipboard skips and no failures/retries; two real bundled-production/LAN smoke checks; one isolated restore drill. Production builds, formatting, application warnings-as-errors compilation and diff checks pass. npm reports zero vulnerabilities; all 36 Hex pins have zero unresolved advisories and one explicitly mitigated advisory, not zero advisories. See the dated hardening entry in `docs/IMPLEMENTATION_STATUS.md` for details.

Automated coverage includes independent-connection races, real server/wire guards and an actual backup round trip. Browser simulation is not physical-device testing. No externally hosted service, paid transaction, real refund, email delivery or remote CI execution was performed.

The restore drill removed only its randomly named fixture databases and temporary fixture dump; the persistent preview and user libraries were preserved. The account preview server was intentionally restarted to load dependency/config changes; old live preview sessions end and require new pairing.
