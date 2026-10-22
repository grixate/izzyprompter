# Release candidate — 22 October 2026

Owner authorization: finish the remaining launch work, verify production
readiness and publish production. This supersedes the earlier publication hold;
the staged-image, backup and active-take safeguards still apply.

## Required release outcome

- The public collection contains exactly the fourteen selected remotes, including
  Clear and Arcade. Earlier studies/frozen previews remain preserved.
- Owner-approved dominant wheels, mechanisms, time displays, speed gestures and
  0.20–1.00 range survive integration. Original retains its monitor.
- The remote edits any paragraph or replaces the entire script, with revision
  checks, ownership, draft recovery and a separate reading anchor. Keyboard
  viewport/safe-area behavior remains intact.
- Text size changes from the remote and display share canonical settings. Last
  account preferences persist separately from named Pro profiles. New defaults
  use 0.56; existing valid preferences/typography are preserved.
- Account feedback is enabled, retry-safe and private; the operator can review
  and resolve entries. Primary retention and backup limits are documented.
- Minimal server-only aggregate analytics is enabled, without Google or an
  analytics-cookie banner. Reports do not claim visitor attribution or retention.
- Public Privacy matches the additional processing. Seller details remain as
  instructed. Existing paid-offer prices, entitlements and provider configuration
  are preserved and technically checked.
- Required `test`, `accounts`, `container` GitHub jobs pass for the combined
  candidate. Preserve and verify the exact source/image checksums.
- Verified backup and Mac copy precede additive hosted migrations. Staging uses
  separate state, secrets and resource limits. Review synthetic paired sessions,
  account persistence, feedback, metrics, skins, payment configuration and errors.
- Promote the same staging-tested image between active takes, keep the previous
  image/configuration, then verify public flows and record rollback coordinates.

## Initial authoritative observations

Both hosted environments are healthy and use
`izzy:git-e941cae1fc173f477965227b29b4d98e542767a6` (OCI image
`sha256:51f9a1c324d161fb44671093fef8b0720a853e5f79fd2d2839793bc788ff8a8f`).
The production backup check is healthy. Payment-readiness probes show configured
Lava/USD at 2,900 minor units, sales already enabled on production and disabled
on staging, schema ready and no pending/review queue entries at inspection.
These are configuration/queue checks, not evidence of a real charge/refund.

## Owner acceptance decisions

The owner explicitly authorized publication after technical acceptance and will
verify a real purchase/refund after launch. That decision supersedes the real
transaction gate for this release; no charge, receipt or refund pass is claimed.
Physical-device/user sessions were declined earlier. Browser emulation is not a
physical iPhone/iPad certification.

## Completed local acceptance

- 95 Node unit checks and 176 PostgreSQL-backed backend checks passed.
- Reading controls, paragraph/full-script editing, semantic position, recovery,
  account preferences and feedback passed in Chromium, Firefox and WebKit.
- The full operator acceptance flow passed against the running local app with
  an actual synthetic account/grant: fourteen remotes, paired playback, exact
  speed, dominant wheel, full-script save, semantic anchor and new-take settings.
  No provider transaction or email was sent. The fixture was removed afterward.
- Targeted geometry/mechanism checks passed 70 cases across the three engines
  (two existing non-Chromium trusted-touch skips); fallback-font 320 px checks
  passed in all three; six keyboard/visual-viewport cases passed with a 16 px
  script selector. The selector uses one row and leaves at least 72 px for text.
- Offline acceptance passed six cases; three existing native direct-peer cases
  were skipped. Backup/restore covered the additional columns and tables.
- A fresh full encrypted production database backup and the protected Mac copy
  completed before hosted migration. Backups and runtime secrets stay outside Git.
- Read-only Lava API acceptance found the configured offer and its USD 29 price.
  Production sales were already enabled; staging checkout remains disabled.

Full Linux CI remains required. It exposed two additional issues:
long finish names/tier badges exceeded narrow catalog cards with wider fallback
fonts; those captions now wrap. The backup-display fixture had coincident line
counts despite different widths; repeated short words plus an explicit measured
height precondition now exercise distinct layouts without weakening publication
or semantic-handoff assertions. Public geometry is checked after fonts settle.
All 72 targeted public-page and display-sync cases passed locally with these
corrections across the three engines, including the wider caption font. The
completed Linux run confirmed the only remaining failures were these same
catalog/fixture cases. The account job has 50 minutes to include its full
PostgreSQL/browser matrix and restore after variable dependency-mirror latency;
no checks or assertions were removed.

## Hosted acceptance and promotion

The required `test`, `accounts`, `container` jobs must pass. Use the retained CI
image/source/checksum artifact; do not rebuild a different production image.

Use `ops/releases/seed-launch-fixture.exs`, its protected temporary JSON, and
`scripts/verify-launch-hosted.mjs`. Staging may seed a synthetic grant using the
production entitlement environment and reserved `release-fixture` provider. It
is never a provider transaction. The seed rejects synthetic Pro outside the
staging origin or an explicitly opted-in disposable loopback origin. Cleanup
refuses other account namespaces and real-provider attempts.

Production acceptance uses a free fixture, creates no invoices or grants, and
sends no email. Keep its metrics off during synthetic checks, remove fixtures
and end takes, then enable the staging-tested worker between takes. This keeps
synthetic verification out of the production aggregate report.

The restart guard uses Caddy's private live reverse-proxy request count. A real
staging editor/remote probe showed two active WebSockets and zero after close;
idle host TCP pools alone are insufficient evidence. Check the target has zero
active requests before migration/restart. Keep the previous immutable image and
protected Compose/runtime copies. Record actual hosted results, source/image
checksums, owner decisions and rollback coordinates in the protected release
record on the host and Mac. Credentials/capability links must never appear in
terminal output, screenshots or Git.
