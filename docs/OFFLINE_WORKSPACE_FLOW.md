# Offline workspace

Owner correction, 23 October 2026: entering Offline is the preparation action.
Do not put another “Set up” or “Prepare” button, landing-page gate, or accordion
between the mode switch and the working editor.

## User flow

1. Choose Offline in navigation, or open `/local`. The app automatically checks
   the current offline build and saves its public shell if necessary. A compact
   status shows preparing, verified ready, or an actionable failure with Retry.
   Editing stays available throughout preparation. Reconnecting also retries.
2. Add words: visible TXT/MD upload, explicit copy of the online draft, or paste
   in the editor. Title, text, export and local save are visible. The online draft
   and existing offline drafts are independent; entering this route copies
   neither automatically and overwrites neither.
3. Choose controls: “Use this device” by default, or “Connect a phone” with its
   experimental status and local-network requirements shown beside the choice.
4. Start reading saves the script and enters the existing paused local display.
   It does not require a separate save action. Storage failure preserves the
   in-memory text and offers export; a failure is not described as a saved copy.
   The phone option instead opens the connection instructions on that same
   paused display. Cancelling an unconnected exchange invalidates its offer and
   leaves standalone reading available.
5. Saved scripts remain visible below the editor and controls. Local scripts,
   draft recovery, font/settings and semantic reading position use the existing
   storage/controller; this change does not migrate their schema.

## Phone connection

`/local/remote` automatically prepares its own shell and presents the connection
steps inline, not behind a dialog or accordion. A visible link from the workspace
opens this role. The host's QR opens that public page only: it does **not** pair
or carry a take capability.

The existing direct peer still uses a manual, bounded offer/answer file exchange
on a reachable local network. Host: create/download a connection file, transfer
it to the phone, upload its reply. Phone: upload the connection file, automatically
generate the reply, then download/transfer it back. Optional copy/paste remains
available; raw negotiation text is not needed for the primary file path. Never
log, screenshot or commit those capability-bearing files or text.

There is no new signaling service, cloud fallback or camera permission. Opening
both devices online first is still necessary to cache their app shells. Fresh
offline pairing, file transfers, device suspension and reachability on physical
iPhone/iPad/Android remain unverified; do not describe this UI change as completed
paired-Offline acceptance. The existing opt-in native peer test remains intact
and now uses the visible file exchange.

## Cache and data boundaries

App preparation is deduplicated across mounted surfaces and never forces a
waiting service worker over an active take. It does not request optional browser
persistent-storage permission on entry. Browser data can be cleared: keep the
export/backup reminder. Only the existing public shell/assets are cached; no
account/API responses, customer scripts or pairing material enter the worker.

## Acceptance

`test/offline/flow.spec.ts` covers switch-to-ready with no extra action and cold
offline reopen; upload/start without a separate save; phone-choice entry and
standalone fallback; failed preparation/retry preserving text; invalid connection
files; and separate online/offline drafts. `local.spec.ts` retains the real
offline text/settings/anchor and denied-storage checks in all three engines.
Public-page geometry/legal navigation and the real production-release CSP/cache
smoke also exercise the revised flow. No physical-device result is implied.
