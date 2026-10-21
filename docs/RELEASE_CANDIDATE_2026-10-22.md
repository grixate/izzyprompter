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

## Validation and remaining acceptance

This file is a working release record. Record actual checks and image promotion
below as they complete. Browser emulation is not a physical iPhone/iPad check;
no physical-device certification or unperformed payment/refund test is implied.

Completed before hosted migration: full encrypted database backup and verified
copy to the owner's existing protected Mac backup directory. The production
aggregate check found zero paid production attempts and zero active grants at
inspection. No customer entitlements were altered.

The combined local browser checks cover font changes, paragraph/full-script
editing, semantic position, draft recovery, saved-text/profile restoration and
feedback retry in Chromium/Firefox/WebKit. A prior CI run against the pre-merge
branch exposed obsolete default-speed and control-shape expectations; the
recovery checks now follow 0.56, native craft sliders and the compact layout.

Hosted acceptance uses `ops/releases/seed-launch-fixture.exs`, the private
temporary JSON it creates, and `scripts/verify-launch-hosted.mjs`. Staging alone
may seed a visibly synthetic test-environment grant to exercise all fourteen
skins. Production uses a free synthetic account, creates no invoices or grants,
and sends no email. The cleanup script refuses accounts outside its reserved
fixture namespace and refuses any production payment attempts. Credentials and
capability links must never enter terminal output or screenshots.

Enable feedback before the public acceptance pass. Keep production metrics off
during synthetic checks, remove fixtures/end takes, then enable the already
staging-tested metrics worker between takes. This keeps synthetic verification
out of the production product report.
