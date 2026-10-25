# Reading controls, feedback and minimal metrics

This release integrates the approved fourteen remote skins and their large-wheel
composition with shared reading controls, feedback and minimal metrics.
The row keeps two controls: Quick Edit and Reading settings. Skin selection is
inside Reading settings so the narrow wheel-first layout gains no third button.
The earlier study IDs and frozen galleries remain preserved outside the public collection.
Follow RELEASE_WORKFLOW.md; neither a commit nor a merge deploys production.

## Reading and preferences

- The remote's Reading settings button opens text-size controls (20–160, step 2).
  The display's existing typography controls use the same revisioned authority.
  Rapid changes are serialized/coalesced; offline commands are not replayed.
- Quick Edit can select another paragraph or the entire script without moving the reading anchor.
  Playback remains paused; existing draft recovery, edit ownership and saved
  script revision checks apply. Full replacements retain the identity of unchanged
  paragraphs, remap the reading word when possible, and fall back to a nearby
  paragraph when the current one is removed. Temporarily empty text remains editable.
- Every signed-in account can remember its latest reading settings. This is
  separate from Pro's named profiles. New defaults use speed 0.56; existing valid
  saved settings are preserved. The skin branch's reviewed speed range must also
  be retained when integrating.
- A selected/default named profile takes precedence when starting a saved take;
  otherwise account preferences take precedence over device settings. Changing
  preferences does not mutate another running take.
- Session capabilities authorize only that session's reading settings and its
  bound owner's preferences. Client-supplied account IDs cannot select an owner.
  Saving is debounced off the session command path. Database failures/conflicts
  have visible states, and applying settings to the display is separate from
  saving them to the account. A conflict needs an explicit save decision.
- Account writes use a revision check so a stale take cannot silently overwrite
  a newer one. Guest/local settings stay on the device; local mode makes no
  cloud-saving claim. Device-storage failure is reported.
- Preferences become durable after the saved acknowledgement. A server restart
  before the debounce/write completes can lose pending preferences. Existing
  sessions remain ephemeral; this does not add crash recovery for live takes.

## Feedback

`FEEDBACK_ENABLED=true` enables the account form and endpoint. It is off by
default. It requires accounts/PostgreSQL. Review the additional Privacy wording
before enabling it in a public release.

Fields: problem/idea/other, optional rating 1–5, message 10–2,000 characters.
The library shows a compact Leave feedback button. It opens a modal panel;
the optional rating is collapsed initially. Closing preserves an unsent draft
for this page visit, including the request ID used for safe retries. The panel
follows the visible viewport on phones and keeps its action row accessible.
No scripts, URLs, diagnostics or device fingerprints are attached automatically.
Account identity comes from the signed-in session, with existing CSRF and
account-change checks. Request IDs make an unchanged retry idempotent. The
per-account limit is five new messages per rolling 24 hours.

Feedback is linked to the account, deleted with it, and retained for up to 90
days in the primary database. Cleanup runs shortly after startup and daily
while the feature is enabled. When disabling the feature permanently, run a
final cleanup/delete as appropriate; the disabled worker does not run. Existing
backup retention and restored-data deletion procedures still apply.

No public inbox exists. An authorized operator can review the local console:

```elixir
Teleprompter.Feedback.inbox()
Teleprompter.Feedback.resolve("ENTRY_UUID")
Teleprompter.Feedback.purge_expired()
```

Message contents are redacted from default struct inspection. Inspect a selected
entry deliberately in a private operator session; do not paste messages into
shared logs or screenshots. Review the queue regularly. No notification emails
or external messaging integration are added.

Suggested Privacy addition, requiring approval before public enablement:
"If you send feedback, we store your message, selected topic, optional rating
and its association with your account to investigate problems and improve IZZY.
Feedback is retained for up to 90 days in our active database. Please do not
include sensitive information or private script content. Contact us to request
access or deletion. Backup copies expire under our backup-retention policy."
The legal basis and final wording must match the approved Privacy policy.

## Metrics without Google

`PRODUCT_METRICS_ENABLED=true` enables a small server-side aggregate worker.
It is off by default and requires PostgreSQL. Enable separately per environment;
development, staging and synthetic activity must not be mixed with production.

Only UTC day, an allowlisted event name and count are persisted. Initial events:
session created, first remote connection per live session, first playback per
live session, and a new feedback submission. Reconnecting or pressing Play again
does not count as another first action. There is no browser collector, analytics
cookie, visitor/session identifier in the metrics table, raw event history,
referrer, script text or URL capture.

Counters are buffered in a fixed-cardinality ETS table, capped per buffered key,
then flushed to PostgreSQL once a minute. Failed writes restore the pending
batch; failed batches older than the previous UTC day are discarded to bound
memory. Process/server crashes can lose buffered counts. Counts are best effort
and do not represent unique users, acquisition attribution, D1/D7 retention or
a linked conversion funnel. This deliberately does not reproduce all of GA4.

An operator can inspect aggregate totals without exposing a public report:

```elixir
Teleprompter.Metrics.report(30)
```

Payment state counts/amounts are queried separately from durable production
checkout records, grouped by status and currency. They are all-time current
states, not a dated revenue ledger; pending/unverified browser clicks do not
become purchases. A later refund changes the reported current state. Amounts
must not be added across currencies or presented as net payout/revenue.

No consent banner or external analytics script is introduced. This describes
the implementation, not a guarantee of GDPR/cookie compliance. Existing
authentication, logs, provider integrations and browser storage still need the
separate release review.

## Validation and rollout

Apply both additive migrations using the migrator role and existing backup
procedure before running the candidate. The ordinary app role remains unable
to change the schema. Roll back the application image rather than dropping
new tables/columns containing user data.

Use synthetic account data for checks of font reflow, paragraph selection,
draft recovery, cross-device preferences, conflicting takes, feedback retries,
access controls and restored database contents. Browser emulation does not
replace physical phone keyboard/Safari acceptance. No physical-device or hosted
acceptance is claimed by this document.
