# Persistent account sign-ins

Account sign-ins no longer have an automatic server expiry. They end through
explicit logout, removal from Account → Devices, account removal, or an operator
revocation. Email links remain single-use and expire after 15 minutes. Account
channel tickets remain valid for 60 seconds. Live prompting takes retain their
existing lifetime and restart behavior; they are separate from account sign-ins.

## Browser behavior

The existing signed HttpOnly cookie keeps its key, signing salt, SameSite=Lax
policy and HTTPS Secure attribute. Its browser lifetime is 400 days and is renewed
on authenticated HTTP activity at most once a day. Visible, online signed-in tabs
refresh account status every 15 minutes and on returning to visibility. Anonymous
tabs do not send this heartbeat. Network failures preserve identity hints and
pending drafts; they never request another email automatically.

A browser can discard cookies, apply its own lifetime cap or clear private-mode
storage. Already-cleared cookies cannot be recovered on the server. Existing
30-day cookies receive the new lifetime on their next authenticated visit while
the old cookie is still present. Do not promise an unlimited browser cookie.
Chrome documents its 400-day maximum and renewal behavior here:
https://developer.chrome.com/blog/cookie-max-age-expires/

## Browser management

`GET /api/account/sessions` returns only the current account's sign-ins, using
random public UUIDs unrelated to authentication credentials. It includes an
approximate browser/OS label, sign-in time, periodic last-active time and a
current-browser marker. Full User-Agent headers, IPs and locations are not stored
for this feature. Older sign-ins have an unknown activity timestamp until used.
Public IDs cannot authenticate requests; token hashes and raw tokens are never
returned by this endpoint.

Authenticated, CSRF-protected `DELETE /api/account/sessions/:id` removes only a
sign-in owned by that account. `DELETE /api/account/sessions/others` keeps the
current credential. Mutations honor the existing expected-account header to
protect stale tabs after an account switch. Revocation removes the database row
and notifies its account channel immediately; replayed channel tickets fail.
Explicit re-login replaces this browser's previous credential without removing
other browsers. Account views refresh after a failed/closed channel connection,
including revocation before the channel managed to subscribe.

The device dialog lists account access. Capability-based paired remotes are
managed by ending their take; logging out an account does not erase downloaded
text or end those independent takes.

## Migration and release

Follow RELEASE_WORKFLOW.md. Production publication is a separate authorized step.
Migration `20261025000000` adds the persistent flag, safe session UUID, coarse label
and last-active timestamp. It preserves only currently valid legacy sessions;
expired/revoked credentials and login links are never revived. Legacy credentials
still encountered during rollout upgrade in place on authenticated HTTP requests.
The cleanup job excludes persistent sign-ins. No token or CSRF rotation is needed
for normal cookie renewal.

The existing NOT NULL `expires_at` column is kept with a distant compatibility
date for persistent rows, so the previous image can still read them during a code
rollback. The new server uses the persistent flag, not that date, as its expiry
policy. Apply the additive migration using the environment's migrator role before
starting the candidate. The readiness probe requires the new columns. Do not let
the application role create schema objects or run an automatic startup migration.

Retain the previous image. Prefer a code rollback that keeps the added columns;
never remove columns while the new image is serving requests. A local fixture
check verified old valid versus expired sessions and login links, the migration,
previous-image expiry-query compatibility after rollback, and reapplication.
The new privacy wording and updated date travel with the reviewed candidate.

## Verification

Use disposable PostgreSQL, reserved example.com identities and synthetic scripts.
Run server tests on a fresh database before browser fixtures, since existing
aggregate-retention tests intentionally count all rows. Browser suites leave
synthetic records behind; do not reuse that database for aggregate unit tests.

- PostgreSQL-backed ExUnit: persistent age/expiry, retention, legacy upgrade,
  expired-link/session refusal, cookie renewal, CSRF preservation, explicit
  re-login, account isolation and current/other-browser revocation.
- Playwright on Chromium, Firefox and WebKit: browser-state restoration with an
  aged sign-in, no automatic email, retained-cookie refusal after logout,
  individual/bulk logout, delayed channel authentication, account isolation,
  loading/error recovery, 320px–1440px layout and keyboard focus.
- Existing account editing, conflict/offline recovery, remote edits, reading
  preferences and feedback-popover checks remain part of regression coverage.
- The browser matrix has an explicit test-only channel-ticket admission budget:
  all reserved users share one loopback peer. The production limit remains
  60 tickets/peer/minute and 600 total/minute.

Automated WebKit is not a physical iPhone/iPad acceptance check. A hosted review
and actual-device check are still required before production promotion.
