# IZZY Implementation Status

Status date: 2026-10-10

Current follow-up (2026-10-15): [UX/PRO implementation](design/2026-10-14-ux-pro/IMPLEMENTATION.md)
and [payment readiness](PAYMENT_READINESS_2026-10-15.md) supersede the historical
commercial baseline below. New purchases use Lava only, USD 29 at launch. The
candidate adds durable invoice recovery and an additive migration; hosted sales
remain disabled pending merchant setup, callback delivery and real acceptance.

Implementation update (2026-10-12): [LOCAL_COMMUNICATION_PLAN.md](LOCAL_COMMUNICATION_PLAN.md) is active, superseding offline deferrals below. The opt-in [local preview](LOCAL_PREVIEW.md) now includes standalone authority, prepared scripts, cached cold startup and an experimental manual peer adapter. Phoenix still owns hosted sessions. Native paired connectivity, physical acceptance and automatic fallback remain open; see Milestone 10.

Target product principle: **Paste → Scan → Roll**.

This document converts the master product specification into an execution backlog grounded in the current repository. It should be updated after every completed milestone.

## Status legend

- **Implemented** — working in the current prototype.
- **Partial** — present, but not production-ready or not fully tested.
- **Missing** — no implementation exists.
- **Deferred** — intentionally outside the current milestone.

## Baseline

| Area | Status | Current reality |
| --- | --- | --- |
| Script entry | Implemented locally within current input scope | Approved text-first workbench, independent running preview, paste-anywhere, cleanup, and `.txt`/`.md` import work; richer file formats remain deferred |
| Prompt display | Implemented locally for Milestone 2 | Extracted transform engine, lazy character/line layout mapping, and semantic recovery across reflow |
| QR pairing | Implemented for LAN prototype | Server creates short codes and role-specific keys; QR/device links carry fragment capabilities |
| Phone remote | Partial | Established design preserved; measured primary-display position and semantic PREV/NEXT work; physical-device lifecycle checks remain |
| Realtime session | Partial | Protocol v2 has server-side role authorization, replay protection, and revision-checked script updates; public abuse/deployment hardening remains |
| Reconnect | Partial | Network-loss/rejoin restores the same live snapshot; server loss produces an explicit ended-session state instead of an empty session |
| Quick Edit | Implemented locally for Milestone 4 | Current-paragraph edits broadcast while typing; stable IDs, reading-anchor preservation, exclusive ownership, and explicit offline draft recovery |
| Local persistence | Partial | Versioned local document, draft, settings, and semantic position recover safely; live session identity remains ephemeral |
| Settings | Implemented locally for Milestone 2 | Font size, line spacing, width, mirror, and fullscreen; settings persist per browser |
| Keyboard control | Partial | Display shortcuts, remote jog/range controls, separate Play/Pause semantics, focus recovery, and accessible descriptions have Chromium/Firefox/WebKit automation; screen-reader and branded-browser acceptance remain |
| File import | Partial | Drag/drop and file selection support normalized `.txt` and `.md`; unsupported formats fail non-destructively |
| Account/library/sync | Implemented locally; external identity setup pending | PostgreSQL, email/Google identity paths, private library, revisions, per-tab IndexedDB drafts/conflicts, saved-session coordinator and account updates |
| Entitlements/payment | Implemented locally; checkout gated | Fixed ₽2,490/US$29 lifetime product, Pro presets, Prodamus/lava.top adapters, durable inbox, grants, refund/dispute reconciliation and operator audit; merchant verification remains |
| Production deployment | Partial | One-origin OTP release, public/LAN profiles, source launcher, Apple Silicon/macOS 26 portable ZIP preview, health/readiness and release/package smokes; Linux container/CI prepared but build/runtime unverified; public host/TLS, signed installers, and physical acceptance remain |
| Automated tests | Local hardening verified; external gates remain | Latest counts and verification boundaries are recorded in Milestone 8 below; container, real identity/payment services, physical devices and hosted restore remain unverified |

## What is already strong

- Three-surface product model is clear.
- QR pairing is low-friction.
- Display animation avoids React work per frame.
- Transport commands are semantic and compact.
- Phoenix Session supervision is a good fit for ephemeral sessions.
- The remote has a distinctive, coherent interaction and visual language.
- The display continues locally through short socket interruptions.
- Public and LAN socket URLs are already separated through configuration.

These parts should be extended rather than replaced.

## Highest-risk technical gaps

### Addressed in Slice 3.2 — shared document and position identity

Session snapshots contain one canonical document with server-owned paragraph IDs. The primary display publishes measured reading anchors to Phoenix; the remote and other displays share the same identity. Whole-script replacements still regenerate block IDs. Milestone 4 adds revision-aware paragraph patches that preserve IDs and remap the reading anchor through text changes.

### Addressed in Slice 3.1 — session authorization; public hardening remains

Joining requires the correct role capability; whole-script replacement is editor-only, while Quick Edit permits a remote to patch only its exclusively acquired current paragraph. Arbitrary joins cannot create sessions, and commands have replay protection. Slice 5.3 adds creation rate/capacity/body budgets. Public launch still requires actual HTTPS/WSS hosting, edge/socket safeguards, operational hardening, and acceptance. A bearer pairing link intentionally grants its holder the associated role.

### Addressed — draft loss on refresh

Versioned local storage restores the script and draft on refresh. Milestone 2 restores the exact display paragraph/reading line; Slice 3.1 makes server loss explicit and preserves access to the saved draft. Automatic restoration of lost server state remains deferred.

### P1 — physical-device reconnect acceptance remains

Background/freeze/BFCache event handling and real isolated server-restart recovery are now automated. `REMOTE_DEVICE_QA.md` defines physical iOS/Android lock, app switching, Wi-Fi, laptop sleep, and LAN-without-internet checks. Those device results remain unverified; browser simulation is not equivalent.

### Addressed in Slice 3.2 — remote/display position disagreement

The remote consumes primary-display measurements and sends semantic paragraph intents. Browser tests cover font/width/line-spacing changes, rapid navigation, independent layouts, and source handoff. Measurements are sampled, not per-frame; real network/device latency checks remain Slice 3.3.

### P1 — production topology is incomplete

Slice 5.1 bundles Vite assets inside a one-origin Phoenix OTP release with explicit SPA routes, readiness/liveness, exact public origins, and a real release smoke test. Slice 5.2 adds a trusted-LAN profile and first command-line launcher. Slice 5.3 adds pre-parser creation quotas, atomic retained-session capacity, body/script budgets, and explicit retry recovery. Public TLS/proxy provisioning, edge/socket safeguards, measured resource budgets, production observability, and a chosen-host deployment/rollback test remain incomplete. Ordinary-user OS installers and physical acceptance remain separate work; see `OFFLINE_LAN.md`.

### Addressed in Slice 5.6 — dependency policy

Frontend/tool dependencies now use exact versions matching the existing lockfile, with a manifest/lock agreement unit test. No resolved package was upgraded. Use `npm ci`; future upgrades must deliberately update pins/lockfile together and pass the browser/release suite. This is repeatability, not a dependency vulnerability audit.

### P2 — route and component growth

Manual pathname parsing and one large CSS file are acceptable for three surfaces. They will become fragile when Quick Edit, settings, landing, accounts, and workspace screens are added. Refactor only when those routes are introduced.

## Agreed execution order

## Milestone 0 — Architecture baseline

Status: **complete**

Deliverables:

- [x] Inspect frontend, backend, protocol, routing, state, styling, configuration, and tests.
- [x] Create `docs/CURRENT_ARCHITECTURE.md`.
- [x] Create `docs/IMPLEMENTATION_STATUS.md`.
- [x] Record current state ownership and realtime messages.
- [x] Identify preservation decisions and blocking risks.
- [x] Run the baseline production build and server tests.
- [x] Check the running remote state and simple automatic recovery after restarting local servers.
- [x] Add a repeatable browser E2E harness for the canonical flow (delivered in Slice 1.5).

Baseline acceptance:

- No product behaviour was intentionally changed.
- Vite build passes.
- Phoenix tests pass: 3/3.
- Current architecture and next dependencies are explicit.

## Milestone 1 — Document foundation and local recovery

Status: **complete locally; first GitHub CI execution pending push**

Outcome: a user can enter normal text, refresh the page, and recover the same script without data loss.

### Slice 1.1 — Versioned document model

Status: **complete**

- [x] Add `IzzyDocumentV1` with document ID, title, schema version, and stable paragraph IDs.
- [x] Convert the existing plain string into paragraph blocks.
- [x] Provide deterministic serialization and validation.
- [x] Keep a compatibility adapter for the current channel snapshot during migration.
- [x] Unit-test empty text, Unicode, large input, whitespace, and stable IDs.

Acceptance:

- Existing sample text renders identically through the new model.
- Reloading a serialized document does not change block identity.
- Invalid stored data is rejected safely and can fall back to a recoverable empty document.

Verification on 2026-10-09:

- Document unit tests: 7/7 passed.
- Production client build passed.
- Phoenix server tests: 3/3 passed.
- Manual browser smoke check passed for display/remote presence, play, and pause.
- No intentional visual or realtime-protocol change was introduced.

### Slice 1.2 — Deterministic text normalization

Status: **complete**

- [x] Normalize CRLF/line endings and Unicode whitespace.
- [x] Collapse excessive blank lines without destroying paragraph boundaries.
- [x] Remove unsupported pasted styling and foreign markup.
- [x] Preserve plain paragraph text faithfully.
- [x] Add paste fixtures representing Docs, Word, Notion, ChatGPT, email, and websites.

Acceptance:

- Different common paste sources produce the same internal paragraph structure.
- No foreign CSS or arbitrary HTML reaches the prompt renderer.
- Script content is never sent to logs or analytics.

Verification on 2026-10-09:

- Document and normalization unit tests: 17/17 passed.
- Fixtures cover Google Docs, Microsoft Word, Notion, ChatGPT, email, and websites.
- Production client build passed.
- Phoenix server tests: 3/3 passed.
- Manual browser smoke check passed from rich clipboard paste through display rendering.
- Clipboard HTML is ignored; only its `text/plain` representation enters the script state.

### Slice 1.3 — Versioned local persistence

Status: **complete**

- [x] Define a storage envelope with schema version and timestamps.
- [x] Persist current document, draft state, prompt settings, and semantic position separately.
- [x] Add migration hooks from version 1 onward.
- [x] Debounce writes without risking text loss.
- [x] Handle unavailable or full storage without blocking prompting.

Acceptance:

- Refresh restores the latest script and settings.
- Corrupt storage does not crash the app.
- A user can explicitly start over without hidden stale state returning.

Verification on 2026-10-09:

- Document, normalization, and storage unit tests: 24/24 passed.
- Production client build passed.
- Phoenix server tests: 3/3 passed.
- Manual browser refresh restored the exact draft, including Unicode and paragraph boundaries.
- `START OVER` uses a two-step confirmation and cancels pending writes before clearing IZZY data.
- Corrupt entries, unavailable storage, quota errors, legacy envelopes, and stale debounced writes are covered by tests.
- Prompt position is checkpointed semantically; precise restoration across layout changes remains part of Milestone 2.

### Slice 1.4 — Input experience

Status: **complete**

- [x] Replace the prefilled sample with a useful empty state.
- [x] Support paste anywhere in the input surface.
- [x] Add drag/drop and file selection for `.txt` and `.md`.
- [x] Keep `.docx` out of this slice until the proven plain-text path and usage evidence justify its parser cost.
- [x] Defer `.rtf` and `.pdf` until usage evidence justifies them.

Acceptance:

- Normal paste reaches a prompt-ready state in under ten seconds without a wizard.
- Unsupported files produce a clear, non-destructive error.

Verification on 2026-10-09:

- Document, normalization, storage, and import unit tests: 29/29 passed.
- Production client build passed.
- Phoenix server tests: 3/3 passed.
- Desktop and mobile empty-state layouts were visually checked.
- Manual paste-anywhere smoke check produced clean two-paragraph text from rich clipboard data.
- Browser console reported no errors.
- `.txt`/`.md` acceptance, case-insensitive extensions, empty files, unsupported formats, and the 2 MB boundary are covered by tests.

### Slice 1.5 — Test harness

Status: **complete**

- [x] Add client unit tests for document parsing, normalization, and storage migrations.
- [x] Add browser automation with separate editor, display, and remote contexts.
- [x] Preserve the current flow as the first canonical smoke test.
- [x] Configure GitHub Actions and failure diagnostics.

Acceptance:

```text
Open → enter script → start session → open display → connect remote
→ play → scrub → pause
```

runs through the same `npm run test:all` command locally and in CI.

Verification on 2026-10-09:

- Client unit tests: 29/29 passed; Phoenix tests: 3/3 passed; production build passed.
- Chromium E2E: 6/6 passed, without retries.
- Canonical realtime flow passed for desktop and emulated phone remotes with independent contexts.
- Tests verify actual display movement, forward/backward scrubbing, pause stability, speed synchronization, and remote rejoin after reload.
- Input scenarios cover rich clipboard paste outside the textarea, immediate navigation recovery, explicit Start Over, valid/invalid file selection, drag/drop, and corrupt storage.
- E2E owns servers on 4173/4002 and leaves development servers on 5173/4000 untouched.
- GitHub workflow is configured for PRs, pushes to main, and manual runs; it has not yet run remotely because changes remain local.
- Physical phone interruptions and accurate semantic position restoration remain future milestone work.

## Milestone 2 — Prompt engine

Status: **complete locally**

Outcome: prompt motion and reading position remain stable across refresh, resizing, and settings changes.

- [x] Extract prompt engine state and layout mapping from `DisplayPage`.
- [x] Introduce semantic anchor `{ blockId, characterOffset }`.
- [x] Keep reflowed pixel position as a display-local projection over the current server transport.
- [x] Checkpoint semantic position on transport updates, reflow, page exit/backgrounding, and controlled intervals. Live-edit checkpoints belong to Milestone 4.
- [x] Restore after refresh, resize, orientation change, and typography change.
- [x] Add font size, line height, text width, mirror, and fullscreen controls.
- [x] Persist settings.
- [x] Prevent keyboard shortcuts inside inputs, buttons, and editable content.
- [x] Test long scripts and low frame-rate conditions.

Acceptance:

- No visible frame-by-frame React rerenders.
- A refresh returns to the same paragraph and approximately the same word.
- Changing width or font size does not jump to another section.
- Very long documents remain responsive.

Verification on 2026-10-09:

- Client unit tests: 34/34; Phoenix tests: 3/3; production build passed.
- Chromium E2E: 9/9 passed without retries.
- Browser tests preserve a saved character at the reading line through refresh, font/line-height/width changes, viewport orientation changes, mirror, and settings reload.
- A newer remote command while the display is closed invalidates its old checkpoint.
- A 600-paragraph script plays, reflows, and pauses; reflow character measurements stay bounded to the active paragraph.
- Deterministic motion tests cover low frame rate, long frame gaps, document-end clamping, and subsequent remote deltas after reflow.
- The animation loop does no React state updates or DOM layout reads per frame.
- Display settings were visually checked in the existing graphite/orange industrial language; the remote design is unchanged.

Boundary: checkpoints are local and session-scoped, not yet stored on Phoenix. The legacy remote's absolute phrase positions are still estimates; semantic cross-device reconciliation, reconnect/session identity, and stale command handling are Milestone 3 work. Live-edit anchor preservation is Milestone 4 work.

## Milestone 3 — Remote Session v2

Status: **implementation and automated checks complete locally; physical acceptance pending**

Outcome: the remote can survive normal mobile interruptions and public sessions cannot be controlled by an unauthorised client.

- [x] Version the realtime protocol.
- [x] Separate human-readable session code from unguessable capability tokens.
- [x] Enforce editor, display, and remote permissions server-side.
- [x] Stop auto-creating sessions for arbitrary public joins.
- [x] Add command IDs/sequences and reject stale whole-script updates; block patch semantics arrive with Quick Edit.
- [x] Define expired, unauthorized, incompatible, and capacity-limit responses.
- [x] Rehydrate snapshot after reconnect without rescanning.
- [x] Preserve display movement during short outages.
- [x] Automate background/foreground and page-restoration hints, network interruption, and real isolated server restart.
- [ ] Complete physical phone lock/unlock, app backgrounding, laptop sleep, and real network-change acceptance.
- [x] Reconcile remote position from display semantic checkpoints instead of text-length estimates.

Acceptance:

- A locked/unlocked phone reconnects to the same live session.
- Duplicate or reordered commands do not produce large jumps.
- Remote users cannot replace script content unless explicitly allowed.
- An expired session explains recovery rather than silently creating a new empty one.

### Slice 3.1 — Protected session lifecycle and reconnect foundation

Status: **complete locally**

- Explicit HTTP creation initializes content and speed atomically, before pairing links are shown.
- Independent 256-bit capabilities are role-bound. The session process retains hashes only; snapshots omit keys.
- Editor pairing credentials are tab-scoped and survive refresh. Device links use fragments, including same-path hash changes.
- Server-issued session epochs namespace display checkpoints; a new session instance cannot inherit a prior instance's bookmark.
- Validated command IDs and per-role/client high-water sequences reject duplicate/reordered commands. High-water marks are not evicted for newer clients.
- A visibility/online resume forces a fresh join. Offline gestures are dropped, not buffered, and transport updates ignore older revisions.
- Lost server memory or expiry never auto-creates an empty session. The UI offers an explicit return to the saved draft.
- Scripts and capability parameters are filtered from Phoenix logs. Creation responses are non-cacheable.

Verification on 2026-10-09:

- 37 client unit tests, 16 server tests, production build, and 13 Chromium E2E scenarios pass locally.
- The four new browser scenarios passed three consecutive runs before the final full-suite run.
- Phone-emulated network loss keeps the display moving, disables controls, restores changed speed/playback on rejoin, and allows pause after recovery.
- Browser tests cover editor pairing reload, missing/wrong-role keys, unknown sessions, saved-draft recovery, and failed creation followed by retry.
- Server tests cover permission spoofing, stale document revisions, duplicate/reordered seeks, invalid payloads, bounded connections, replay protection after many logical clients, session disappearance, and parameter-log filtering.
- The ended-session screen was visually checked at phone size. The established remote layout/design remains unchanged.

Slice 3.2 delivered the shared semantic state described below. Physical phone lock/unlock and backgrounding, sleep, real network changes, and process-restart browser tests remain Slice 3.3. Core capability authorization does not mean the app is public-deployment-ready.

### Slice 3.2 — Shared semantic reading and accurate remote navigation

Status: **complete locally**

- Server snapshots carry a canonical document with common paragraph IDs and UTF-16 character offsets.
- The primary display publishes actual reading anchors, pixels, and layout bounds to Phoenix. Stale revisions, foreign blocks, and non-primary publishers cannot replace them.
- Remote PREV/NEXT uses paragraph identity rather than text-length estimates. Rapid consecutive commands are ordered and advanced on the server.
- The remote projects measured display pixels between samples and shows a dash until measurements are confirmed; no invented exact position is shown.
- Font, width, and spacing changes preserve reading while updating the phone's pixel projection.
- Secondary displays cannot overwrite the primary. On primary departure, the backup aligns to the shared anchor in its own layout before taking authority.
- Backward jog after semantic jumps works across the shared distance origin; measured bounds prevent dead travel beyond the script start/end.
- Concurrent joins refresh their own presence readout; lookup rejects stopped processes during asynchronous Registry cleanup.
- Existing industrial remote layout remains unchanged. No new screen or visual restyling was introduced.

Verification on 2026-10-09:

- Full `npm run test:all` passed without retries: 41 client unit tests, production build, 23 server tests, and 15 Chromium E2E scenarios.
- New phone-emulated E2E checks actual DOM alignment after typography changes, two immediate NEXT commands, PREV, remote reload, and display-keyboard movement back across the shared distance origin.
- New independent-display E2E checks that secondary reflow cannot overwrite primary pixels, semantic navigation works in both layouts, and closing the primary restores its anchor on the backup.
- Server tests cover UTF-16 validation, publisher authority, stale measurement rejection, semantic replay protection, rapid navigation, source handoff, negative distance cursors, and boundary overshoot.
- Physical-device lock/background/network behaviour and lost-server browser recovery remain Slice 3.3; these results do not claim real iOS/Android coverage.

### Slice 3.3 — Lifecycle and lost-server recovery

Status: **implementation and automated verification complete locally; physical acceptance pending**

- Hidden phone remotes suspend their socket and controls. Backgrounding a display alone does not deliberately interrupt it.
- Online/foreground, persisted page restoration, and document resume request fresh snapshots; same-tick hints coalesce. Page exit/freeze suspends connections.
- Late snapshots cannot enable suspended controls. Old command callbacks cannot interrupt a recovered connection.
- Disposed/terminal sockets cannot reopen through Phoenix's own browser lifecycle listeners. This also prevents obsolete development Strict Mode sockets from waking on page restoration.
- Channels monitor their session process and proactively notify all roles on session expiry/loss, even when paused and sending no commands.
- A real restart test owns its own dynamically ported Vite/Phoenix pair. It stops/restarts only its own API process, preserves the editor draft, rejects old pairing, and validates explicit new-session creation. No production/test HTTP control endpoint was added.
- `REMOTE_DEVICE_QA.md` records the outstanding physical-device matrix without claiming emulation is real-device coverage.

Verification on 2026-10-09:

- Full `npm run test:all` passed without retries: 44 client unit tests, production build, 24 server tests, and 18 Chromium E2E scenarios.
- New lifecycle/process-restart scenarios passed three repeated runs during development, followed by the final full-suite run with freeze/resume coverage.
- Browser event simulation checks background command suppression, continuing display motion, changed speed/HOLD/position on return, one fresh socket for coalesced restoration hints, and no obsolete transport replay.
- The real isolated process restart checks ended states on all three surfaces, preservation through editor reload, terminal-state non-reconnection on resume hints, and new pairing with the original script.
- Server tests verify proactive loss notification and idle expiry for all roles; no user command or silent session recreation is needed.
- Physical iOS/Android lock, app switching, Wi-Fi changes, laptop sleep, and LAN-without-internet acceptance remain **not run**. Milestone 3 is not fully accepted until those results are recorded.

## Milestone 4 — Quick Edit

Status: **implemented and automatically verified locally; physical phone acceptance pending**

Outcome: the user can fix the current paragraph from the phone while every connected surface sees the accepted changes live, preserving the reading point. Per the user's clarification, Done closes editing; it is not a save/publish operation.

- [x] Pause and acquire a fresh measured checkpoint from the paused primary display.
- [x] Open a native, focus-contained remote dialog at the current paragraph, preserving the industrial visual language.
- [x] Auto-send serialized, base-revision-checked block patches after a short 180 ms typing debounce, before Done.
- [x] Broadcast text, remapped semantic anchor, and editing state as one atomic snapshot to all surfaces.
- [x] Preserve paragraph IDs and UTF-16 reading position through insertion, deletion, reflow, and temporary empty text.
- [x] Restrict the edit to one owner connection and one current block. Other remotes can monitor the live text read-only; transport is blocked during editing.
- [x] Keep unsent drafts per session on the phone. Reconnect/reload requires explicit resume; changed live text is never silently overwritten.
- [x] Persist accepted live changes into the computer editor's draft and expose the current paragraph on its pairing view.
- [x] Return to the wheel paused. Done waits for the final accepted patch and releases ownership.
- [x] Add server, persistence, and browser E2E coverage.

Acceptance:

```text
Play → Quick Edit pauses at current word → type → all connected screens update
→ Done closes → same reading word/line → remain paused
```

works without returning to the computer. Concurrent co-authoring/CRDT and editing multiple paragraphs are not part of this milestone. The same word is retained when it survives the edit; replacing/deleting that word clamps to the edited range.

Verification on 2026-10-09: 45 client unit tests, production build, 31 Phoenix tests, and 21 Chromium browser scenarios. Live-edit E2E checks two differently sized displays, the editor, and a second read-only remote **before Done**; it also checks the original reading word after a Unicode prefix insertion, final-keystroke delivery, editor refresh, offline draft recovery, and conflict with a second phone. Real mobile keyboard, IME, lock/unlock, and offline LAN checks still require physical devices.

## Milestone 5 — Free beta productionisation

Status: **in progress — Slices 5.1–5.8 complete locally within documented boundaries; Slice 5.9 prepared with container verification pending; not publicly deployed**

Outcome: anonymous IZZY is a dependable public product before accounts or payments exist.

- [x] Complete visible IZZY naming and remove prototype copy (technical package/backend identifiers remain unchanged).
- [x] Bundle a same-origin client/API/WebSocket OTP release and verify it without Vite.
- [ ] Choose hosting and provision the actual HTTPS/WSS reverse proxy/deployment.
- [x] Add explicit SPA device routes, asset caching, and non-cacheable readiness/liveness checks.
- [x] Bound session creation before parsing, retained sessions, and HTTP/script resources; preserve drafts on refusal.
- [x] Bound realtime frames/channel/session traffic and add local aggregate diagnostics without script/identity data.
- [x] Implement initial offline, reconnecting, expired, parser, and storage error states, including explicit retry and text export when local saving fails.
- [ ] Add privacy-safe product analytics with no script text.
- [ ] Add error monitoring with content redaction.
- [ ] Complete keyboard and screen-reader alternatives.
- [ ] Finish branded Chrome/Safari/Edge and physical iOS/Android acceptance; Chromium/Firefox/WebKit engine automation is available in Slice 5.6.
- [ ] Publish a short product entry page connected to the real app.
- [ ] Run a small real-device beta before expanding scope.

Acceptance:

- No account is required for the full core flow.
- No known P0 defects.
- Pairing and reconnect metrics are observable without collecting script content.
- Support and recovery paths are documented.

### Slice 5.1 — Bundled serving and deployment foundation

- [x] `npm run build:server` generates version-control-ignored client assets inside Phoenix's release priv directory; bundled builds cannot inherit a development socket URL.
- [x] Direct `/display/:code` and `/remote/:code` reloads return app HTML. Missing assets/unknown APIs remain 404; HTML is non-cacheable and fingerprinted assets immutable.
- [x] Add `/health/live` and `/health/ready`; missing client build returns 503 and readiness includes core session/PubSub processes.
- [x] Require explicit validated `PUBLIC_ORIGIN` and a private production secret; reject foreign/null browser HTTP origins and foreign WebSocket origins. Disable production LAN-interface disclosure.
- [x] Preserve trusted-LAN split-port development. Document public-cloud versus internet-free LAN architecture and the remaining local-launcher/profile work.
- [x] Add a real production release/browser smoke test and CI step; no hosting accounts, external infrastructure, or analytics services were created.

Verification on 2026-10-09: `npm run test:all` passes 45 client tests, production build, 39 Phoenix tests, and 21 Chromium scenarios. `npm run test:release` separately builds/boots an OTP release without Vite and verifies direct links/reload, live editing, one-origin sockets, caching, route errors, HTTP/WebSocket origin rejection, private-network non-disclosure, and missing-entry readiness failure/recovery. TLS/proxy hosting, real internet-disconnected LAN, and physical phones remain unverified. See `DEPLOYMENT.md` and `OFFLINE_LAN.md`.

### Slice 5.2 — Explicit internet-free LAN runtime and launcher

Prioritized after the user's offline-on-location clarification. No native desktop framework or cloud fallback was added.

- [x] Add an explicit trusted-LAN runtime profile accepting private IPv4 HTTP, matching listener/origin ports, and exact selected/loopback browser origins without weakening default public HTTPS mode.
- [x] Add `build:local` preparation and `npm run local` startup with no automatic downloads/builds, private-interface selection, manual host/port, busy-port refusal, and missing-build guidance.
- [x] Generate an in-memory per-launch secret; disable distribution and DNS cluster discovery; verify own startup through a non-secret readiness identity.
- [x] Ctrl+C/termination stops only the owned child group, not another process found by port/name.
- [x] Advertise the configured LAN pairing origin so localhost editor access still generates network-address device links.
- [x] Use disposable release directories in smoke tests, preserving a separately running normal local release.
- [x] Verify real LAN-profile creation/playback/live editing/reload with external HTTP blocked, foreign-origin rejection, occupied-port handling, clean stop, and unrelated-server survival.
- [ ] Deliver graphical/OS-specific installers, Windows support, and firewall onboarding.
- [ ] Complete physical phone and router-uplink-disconnected acceptance.

Verification on 2026-10-09: `npm run test:all` passes 51 client/launcher unit tests, production build, 44 Phoenix tests, and 21 Chromium scenarios. Two real production/LAN release smoke tests pass separately. The LAN test uses a detected private interface when available and loopback fallback otherwise; browser routing blocks external HTTP, but this is not a physical internet disconnection. Default local port 4174 has separate browser storage from development port 5173. The existing development app remains running and is not stopped by this slice's launcher/tests.

### Slice 5.3 — Session admission and resource guards

- [x] Gate session creation before JSON parsing with per-peer and total fixed-minute quotas; health, reconnect, and live editing remain independent.
- [x] Bound pseudonymous, in-memory peer keys; ignore forged forwarding headers unless exact proxy addresses are explicitly trusted. LAN mode always uses direct peers.
- [x] Enforce retained-session capacity atomically, including concurrent creation; never evict an existing script to admit another session.
- [x] Separate 3 MiB HTTP JSON and 2 MiB decoded-script budgets, reject unsupported media, and cap normalized paragraphs at 5,000 to prevent short-paragraph identity amplification. Whole-script replacement follows the same document budget.
- [x] Add non-cacheable 429/503 responses with retry hints; preserve/persist drafts, show a Start countdown for rate rejection, and keep retries explicit. Handle proxy-generated HTML size/rate errors too.
- [x] Make public/LAN defaults and bounded overrides explicit; document exact proxy trust and retained-session expiry semantics in `ADMISSION_LIMITS.md`.
- [x] Exercise low-budget real release rejection while an existing paired session still plays and reloads; isolated tests leave the live LAN release untouched.

Verification on 2026-10-09: `npm run test:all` passes 53 client/launcher tests, production build, 64 Phoenix tests, and 24 Chromium scenarios. Two production/LAN release smoke tests pass separately: **143 tests total**, without retries. Tests cover concurrent capacity, independent quotas, bounded peer storage, forwarding-header spoof resistance, parser overshoot, paragraph amplification, draft persistence, explicit cooldown retry, and existing-session survival. The running LAN release was not rebuilt or restarted; guards are available in the new source/test build. These guards are not a full DoS defence. Public hosting/proxy, socket frame/message guards, operational monitoring, measured capacity, and physical mobile/offline acceptance remain open.

### Slice 5.4 — Realtime budgets and local operational diagnostics

Physical-device testing was explicitly deferred by the user on 2026-10-09; it is not marked passed and does not block remaining implementation.

- [x] Bound incoming WebSocket frames/messages to 3 MiB, disable compression, and permit one joined channel per socket.
- [x] Add constant-size channel and shared-session message/byte/heavy-edit budgets before expensive work; normal control payloads have a separate 4 KiB budget.
- [x] Refuse oversized/malformed/burst traffic without applying commands, advancing replay state, or buffering work.
- [x] Treat budget/application refusals as non-connection failures; bounded local cooldown, no reconnect evasion, and no automatic gesture/edit replay.
- [x] Add 32 fixed, concurrency-safe aggregate counters and periodic local summaries without text, keys, addresses, or session/device identities. Diagnostics loss does not block core operation.
- [x] Disable routine socket/join logging, replace identity-bearing session lifecycle logs, and redact session OTP status/crash state and message history.
- [x] Preserve the approved interface and existing live-edit/draft recovery behaviour.

Verification on 2026-10-09: **159 tests pass without retries** — 55 client/launcher, 77 Phoenix, 25 Chromium, and two real release smokes; production build and formatting also pass. Added tests cover simulated sustained 30 Hz jogging, burst/refill/byte/edit limits, shared-session enforcement across channels, no mutation/replay-state change on refusal, fixed diagnostics cardinality/privacy, OTP status redaction, no reconnect/automatic gesture replay, and a real oversized frame closing with code 1009. See `REALTIME_GUARDS.md` for exact budgets and boundaries. These are initial application safeguards, not proven public-host capacity, full pre-channel connection protection, external monitoring, or physical-device acceptance.

### Slice 5.5 — Recovery and keyboard-accessibility polish

- [x] Report failed editor/unsent Quick Edit persistence honestly; offer explicit retry and text-only downloads without blocking the core flow.
- [x] Keep the editor's in-memory script when returning from an ended session without a page reload; never promise recovery when saving failed.
- [x] Make terminal recovery modal and focus-managed; expose explicit reconnect and truthful clipboard fallback.
- [x] Separate wheel slider semantics from the center Play/Pause button; add arrow, Page Up/Down, and Home/End keyboard seeking and accessible instructions.
- [x] Keep display chrome visible during keyboard focus, return focus after Quick Edit, clamp shortcut speeds, and explain fullscreen refusal.
- [x] Respect reduced-motion preferences for decorative animation and avoid continuous position announcements; preserve the approved industrial design.
- [ ] Verify assistive technology and Safari/Firefox/Edge; this is not full accessibility or cross-browser acceptance.

Verification on 2026-10-09: **169 tests pass without retries** — 59 client/launcher, 77 Phoenix, 31 Chromium, and two real production/LAN release smokes. Production build and whitespace checks pass. Screenshots of wheel focus, the storage warning, and terminal recovery were visually checked. Tests cover blocked storage and retry/export, manual-copy fallback, modal focus/recovery without reload, keyboard wheel/playback/settings, fullscreen refusal, and unsent phone edits when local storage is unavailable. See `RECOVERY_ACCESSIBILITY.md` for controls and limitations. The running LAN release was not overwritten or restarted. Physical-device testing remains deferred, not passed; no VoiceOver/NVDA or other-browser result is claimed.

### Slice 5.6 — Browser-engine coverage and repeatable builds

- [x] Extend the full flow suite to Chromium, Firefox, and WebKit; keep the default Chromium command for a faster local check and add `npm run test:browsers` for the wider matrix.
- [x] Adapt narrow-screen context creation to Firefox's lack of mobile emulation without skipping core flows or claiming real-phone acceptance.
- [x] Separate Chromium's native clipboard test from portable simulated paste-event coverage; explicitly skip unsupported native permission automation on Firefox/WebKit.
- [x] Test macOS WebKit navigation with Option+Tab; validate modal exclusion of background controls without assuming identical browser-chrome focus cycles.
- [x] Remove the save-warning test's empty-draft/debounce race by waiting for the current script's attempted write.
- [x] Pin all direct client/tool versions to the already resolved lockfile, without upgrading packages; add an agreement/pinning test and validate the install plan.
- [x] Configure CI for all three engines and release checks; preserve the design and leave running development/LAN sessions untouched.
- [ ] Run branded Safari/Chrome/Edge and VoiceOver/NVDA acceptance; physical device acceptance remains deferred.

Verification on 2026-10-09: **233 checks pass without retries** — 60 client/launcher, 77 Phoenix, 94 browser checks, and two real release smokes; production build, install dry run, and whitespace checks pass. The browser matrix contains 32 Chromium passes, 31 Firefox passes, and 31 WebKit passes, with two explicit native-clipboard skips. Local bundled engines report Chromium 156.0.8078.4, Firefox 157.0, and WebKit 27.2. WebKit wheel-focus layout was visually checked. This is not an installed Safari/Edge or physical mobile result; remote CI execution still requires a push. See `CROSS_BROWSER.md` for exact coverage and boundaries. No installer, external host, or automatic offline cloud-to-local handoff was added.

### Slice 5.7 — Portable Apple Silicon Mac preview

- [x] Build a separate, relocatable ZIP with frontend/OTP assets, bundled Node/ERTS runtimes, required OpenSSL, licences/notices, and a double-click Terminal launcher.
- [x] Pin/verify the official Node archive checksum before extraction; offer an explicit pre-downloaded archive for preparation without that network download.
- [x] Audit native architectures and dependency paths, rewrite copied OpenSSL references, ad-hoc sign modified copies, and record native hashes/minimum OS metadata; fail on unsupported non-system dependencies.
- [x] Refuse existing output directories/ZIPs and clean up only exclusively owned failed output; never overwrite or restart the live ordinary LAN release.
- [x] Open the default browser only after the owned server is ready, with explicit opt-out/fallback; close the owned server on Control+C or terminal SIGHUP.
- [x] Fix macOS localhost-only busy-port detection by probing wildcard/loopback/selected addresses separately; retain readiness-instance race protection.
- [x] Verify the actual moved ZIP with spaces in its path and only OS tools in PATH; pair, play, live-edit before Done, reload, and stop without harming an unrelated server.
- [ ] Verify a clean second Mac, older supported OS builds, physical phone/router operation, Finder/Terminal gestures, and firewall onboarding.
- [ ] Deliver Developer-ID signing/notarization, a native graphical `.app`, Intel Mac/Linux/Windows packages, and distribution/update channels.

Verification on 2026-10-09: the verified artifact is `artifacts/IZZY-local-0.1.0-darwin-arm64-preview2.zip`, about 50 MB compressed. It contains 25 audited native files, including bundled OpenSSL; highest minimum OS metadata is **macOS 26.0**, not a tested older-OS claim. Package smoke checks pass for relocation, native inventory/digest, restricted PATH, blocked external browser HTTP, live edits, SIGINT/SIGHUP shutdown, busy-port refusal, unrelated-server survival, existing-output preservation, tampered archives, and failed-build cleanup. Current tests include 67 client/launcher/package-policy units, 77 Phoenix tests, production build, the three-engine browser suite, two real release smokes, and one Mac portable smoke. See `PORTABLE_PACKAGE.md`. This is an unsigned internal preview, not a signed/notarized installer or physical offline acceptance. The older initial ZIP is unverified; development and the running LAN release remain untouched.

### Slice 5.8 — Browser-first IZZY entry and pairing

- [x] Park further offline packaging at the user's request; preserve the verified preview and its honest host-computer requirement.
- [x] Use IZZY naming on all three surfaces and browser metadata; remove seeded local/prototype labels and the display's fake `READ LINE 42` readout.
- [x] Explain tablet + phone setup without assuming the script device is a computer; retain the approved remote/dial/readout design.
- [x] Show local-network guidance only for private/local pairing addresses, and a clear unreachable-phone warning for loopback links. URL classification is presentation, not a reachability or authorization check.
- [x] Identify which links open reading/control on this device, preserve role-specific fragment capabilities, and explain that sharing a link grants session access.
- [x] Make pairing overflow scrollable on short screens so recovery controls stay reachable.
- [x] Add tablet-to-display/independent-phone browser coverage and local/public copy-policy units.
- [x] Finish updated verification and record results.

Verification on 2026-10-09: 70 units, production build, and 77 Phoenix tests pass. The three-engine suite passes 97 browser checks with two intentional native-clipboard skips; after the short-screen scroll fix, a focused all-engine rerun passes all six tablet/scroll checks (100 distinct passing browser checks across these runs). Entry/pairing were visually inspected at desktop, tablet portrait, and narrow-phone sizes. The two current production/LAN release smokes pass separately. The Slice 5.7 portable ZIP and a fresh disposable package passed their smoke checks before the branding changes; that delivered archive intentionally retains its verified older UI snapshot. Development and the existing LAN release remain running and were not restarted; whitespace checks pass. Remote GitHub CI still requires a push.

No public host has been provisioned. The dev/LAN app still needs its server computer; the UI does not claim computer-free offline operation. The existing portable ZIP is a verified Slice 5.7 snapshot and was not rebuilt for these copy changes. Camera scanning and physical mobile acceptance remain unverified.

### Slice 5.9 — Hosted-beta deployment preparation

Status: **partial — files/preparation complete, Linux build/runtime verification pending**

- [x] Research official Render/Fly hosting, lifecycle, pricing, TLS, and WebSocket guidance; recommend options without selecting or purchasing a service.
- [x] Prepare a three-stage Linux Dockerfile with verified manifest digests, same-origin frontend, non-root OTP runtime, explicit public mode, readiness, disabled distribution/crash dumps, and private writable release-config directory.
- [x] Limit build context to application inputs and exclude host releases, packages, dependency/test artifacts, Git history, and known secret/key file formats.
- [x] Add three container-policy units, an owned-container functional/restart/shutdown smoke, and a Linux CI build/test job that never publishes/deploys.
- [x] Document provider/domain approval, suitable secrets (including Render's too-short generated default), single-instance/always-on limits, proxy trust, public acceptance, and rollback boundaries in `HOSTED_BETA.md`.
- [ ] Build/run the Linux image and pass `test:container` on a Docker-capable runner. The local daemon is unavailable; the explicit test fails at preflight rather than falsely passing/skipping.
- [ ] Get user approval for provider/cost/region/canonical origin and any commit/push/provisioning steps; create no paid resources in this preparation slice.
- [ ] Verify actual TLS/WSS, edge policy, measured resources, privacy-safe alerts/logging, and deployment/rollback on the selected host. Physical-device acceptance remains deferred.

Local verification on 2026-10-09: 73 units, production build, 77 Phoenix tests, and a fresh 34-scenario Chromium run pass; container smoke source syntax passes. The registry metadata for all three pinned manifests was checked, but this is not a built-image result. Development and the existing LAN release stay untouched. No image was pushed and no external service was created. Prior three-engine/release/package results remain as recorded under Slices 5.7/5.8, not evidence of container or public-host acceptance.

### Slice 5.10 — Interactive entry workbench

Status: **implemented locally; first-version design accepted by the user on 2026-10-10**

- [x] Preserve immediate script entry, a single setup action, and restrained import utility; keep login in header navigation.
- [x] Add a long independent sample with running reading preview, pointer/keyboard scrubbing, playback, and speed control.
- [x] Share the actual remote controls and reading surface with the preview, without preview session creation or settings persistence.
- [x] Show the user's script and pause on editing; retain draft recovery and the existing pairing flow.
- [x] Check desktop, tablet, and narrow-phone layouts and complete source-to-implementation visual QA in `design-qa.md`.
- [x] Verify real paired playback, speed, seeking, and live paragraph corrections using an isolated test origin.
- [x] Keep login honest: profiles are unavailable, with no fake sign-in form or account/backend implementation.
- [ ] Run the updated browser regression matrix; five new entry scenarios are written but not executed through the CLI.

Verification from the implementation turn: `npm test` passes 77 client units, production build, and 77 Phoenix tests. In-app browser checks cover preview interaction, editing pause, refresh recovery, dialog keyboard handling, responsive layout, and a synthetic paired-session regression. Browser warning/error logs were empty. Earlier browser-engine results are not a fresh pass for this redesign. The user's existing draft/session and running development/LAN servers were preserved. No commit, push, hosting, accounts, or payment service was created.

Next-work review on 2026-10-10: the Docker CLI is installed, but its runtime is unavailable. Hosted provisioning still needs explicit provider/cost/region/origin approval. Advancing Pro accounts/library before Free beta evidence requires a deliberate change to the execution order, not an inferred scope expansion.

## Milestone 6 — Pro workspace

Status: **implemented locally for the approved V1 scope; hosted acceptance pending**

Initial scope:

- [x] Add Ecto/Postgres as a separate durable data layer.
- [x] Add passwordless authentication and verified Google linking paths (real delivery/OAuth setup pending).
- [x] Add script library, search, autosave, trash/import/export and durable database persistence.
- [x] Add presets and default/live application.
- [x] Add version-aware sync, explicit conflict resolution and account/script/tab-scoped IndexedDB pending drafts.
- [x] Add centralized server-enforced entitlements.
- [ ] Configure managed backups and verify a real isolated restore.

Account persistence requirement clarified on 2026-10-10:

- Script creation/editing and database autosave must work independently of live-session creation or display/remote pairing. A user can prepare a saved script first and connect devices later.
- When internet access is unavailable, preserve edits durably on the device, show them as pending cloud sync, and synchronize after reconnecting; never label a local-only edit as saved to the database.
- Accepted edits made during a live session must also reach the account's saved script, subject to authenticated ownership and version checks. A remote session capability alone must not grant general library write access.
- Keep durable script identity/revisions separate from temporary session identity/playback revisions. Detect competing saved-script edits rather than silently overwriting them with an older session copy.

The approved V1 plan supersedes the earlier deferral: Phoenix remains the launch transport, with durable account scripts implemented independently of pairing. See [accounts/commerce implementation and release gates](ACCOUNTS_COMMERCE.md).

Defer folders, archive, favorites, profiles, advanced themes, and custom keybindings until usage proves their value.

## Milestone 7 — Commerce and launch

Status: **implemented locally; activation and paid-launch verification gated**

- [x] Add a small shared boundary with both Prodamus and lava.top adapters.
- [x] Create the fixed-price Lifetime Pro product.
- [x] Add authenticated, durable, idempotent notification processing and mocked provider contract checks.
- [x] Support entitlement recovery, full/partial refunds, disputes and audited operator matching/reconciliation.
- [x] Add restrained upgrade UX with both providers upfront.
- [x] Preserve the interactive entry workbench and remote design.
- [ ] Verify merchant-approved fixtures and explicitly authorized real purchase/refund/payout checks for both providers.
- [ ] Complete privacy, terms, SEO, backup, monitoring, and launch runbooks.

## Milestone 8 — Local release hardening and test access

Status: **local implementation and verification completed; no paid-launch approval** (2026-10-10).

- [x] Upgrade vulnerable development/server dependencies and add fail-closed npm/Hex advisory checks to CI. One unpatched cowlib advisory has a tested, exact-version, expiring Cowboy mitigation; do not call the dependency tree vulnerability-free.
- [x] Add restrictive production browser headers/CSP and verify inline script rejection without breaking actual bundled-release pairing/editing.
- [x] Redact all routine request parameters and sensitive Ecto inspection fields; preserve existing session crash/status protections. Host logging remains an external acceptance gate.
- [x] Fix checkout callback/timeout ordering, bounded fixed-point amounts, malformed provider envelopes and redirect forwarding. Add independent checkout admission limits.
- [x] Bind browser writes to their intended account; verify account isolation, token/ticket expiry/revocation, stale tab recovery and Google callback/linking guards.
- [x] Strip arbitrary saved-document metadata, reject duplicate paragraph IDs/NULs, tolerate malformed list/preset input and return bounded library card excerpts.
- [x] Verify true multi-connection PostgreSQL creation/login/revision races, database rejection and playback independent of slow persistence.
- [x] Exercise literal XSS text, lost committed-save acknowledgements, unavailable device storage and cross-account unsent journals in Chromium/Firefox/WebKit.
- [x] Perform an actual isolated local PostgreSQL dump/restore round trip, comparing all twelve durable tables and verifying restored ownership/text/revisions/trash/presets/grants/event deduplication. Remove only owned fixture databases/dump; do not touch the preview library.
- [x] Prepare restricted local Free/Pro demo sign-in without real email or a public test endpoint; ignore preview grants outside development.
- [x] Refresh the account-enabled 5174/4004 preview; preserve the independent original 5173/4000 servers and durable preview scripts. Live preview sessions require pairing again after restart.
- [x] Prepare [local test instructions](LOCAL_TESTING.md) and [severity-ranked security report](../security_best_practices_report.md), including remaining release gates.

Verification:

- Client units: **79 passed**; production client and bundled builds pass.
- PostgreSQL Phoenix suite: **134 passed**. Without a database: **87 passed / 47 database tests explicitly excluded**.
- Three-engine browser matrix: **133 passed / 2 intentional native clipboard skips**, zero failures on the final fresh run (Chromium/Firefox/WebKit, PostgreSQL enabled, no local retries). The four new security/recovery cases also passed all engines separately; WebKit passed all four five consecutive times (20 checks). Navigation tests now wait for sign-in and script navigation explicitly.
- Real production/LAN release smoke: **2 passed**, including on-wire frame/origin restrictions, CSP and live edits without Vite.
- Isolated local backup/restore: **1 passed**. This is not evidence for managed-host backup/PITR.
- npm audit: **0 reported vulnerabilities**. Hex OSV: **36 pins, 0 unresolved / 1 explicitly mitigated**; exception expires 2026-11-10 and must be reviewed before launch.
- Formatting, application compile with warnings-as-errors and diff whitespace checks pass. CI now includes advisory checks, full account browser coverage and restore drill; remote CI has not run.

No hosting, merchant activation, real purchase/refund/payout, real SMTP/Google acceptance, physical-device acceptance, commit or push was performed. Docker remains unverified because no engine is running locally. Next steps are actual host/edge/database/backup verification, identity setup, both provider approvals/contracts/authorized transactions, policy approval and physical phone/tablet acceptance. Further offline packaging remains parked.

## Milestone 9 — Online free release preparation

Status: **local free-launch preparation verified; external acceptance remains open** (2026-10-11).

- [x] Record the owner's decision: online free V1, no offline field implementation or paid activation. Preserve historical provider/Pro/LAN work without deleting data.
- [x] Hide unavailable purchase offers and empty locked preset forms fail-closed, including commerce request failures. Preserve historical purchase status and existing Pro access. Stop idle commerce polling for free users without pending purchases.
- [x] Replace the empty upgrade sidebar with a restrained three-step workflow in the existing visual language. Explain that hosted phone/tablet use needs internet, not shared Wi-Fi or a computer. Verify desktop/phone layout screenshots.
- [x] Explain the free limit without suggesting unavailable Pro; retain editing/export at the limit. Add four real-browser free-launch cases per engine: disabled checkout, three-script/trash/restore behavior, commerce failure and historical purchases.
- [x] Patch newly published Decimal CVE-2026-97853: pin 3.1.2 and repeat account/guest, advisory and release checks. No application call to the affected `Decimal.round/3` path was found; exploitability in IZZY was not demonstrated.
- [x] Add [FREE_LAUNCH.md](FREE_LAUNCH.md) with current scope, configuration, explicit migrations, backup/rollback, privacy and physical iPad/iPhone gates. Mark older offline/payment proposals deferred/historical.
- [x] Restart the account-enabled local preview at `http://192.168.1.13:5174/`, payments explicitly disabled; preserve the persistent preview library. Confirm the API is enabled and readiness succeeds. Existing live sessions need fresh pairing.

Verification for this slice:

- Client units: **79 passed**. Production client and bundled builds pass.
- PostgreSQL Phoenix suite: **134 passed**; guest-only: **87 passed / 47 explicitly excluded database tests**.
- Final fresh Chromium/Firefox/WebKit run: **145 passed / 2 intentional native clipboard skips**, no failures or automatic retries. This includes twelve added free-launch checks and existing live editing, storage failures, account isolation, conflicts, real restart and long-script cases.
- An initial Chromium restart assertion hit its 8-second timeout, equal to the socket's maximum retry backoff before transport/join. Its local assertion now allows 15 seconds for backoff plus join/scheduling; production reconnect behavior is unchanged. The complete fresh matrix then passed. This is not a claim of instantaneous reconnect or physical-device acceptance.
- Real bundled production/LAN smoke: **2 passed**; isolated PostgreSQL backup/restore drill: **1 passed**.
- npm audit: **0 reported**. Hex OSV: **36 pins, 0 unresolved / 1 explicitly mitigated** Cowlib advisory; exception still expires 2026-11-10. Do not call this vulnerability-free.
- Formatting and application compilation with warnings-as-errors pass; upstream Phoenix dependency emits existing type warnings when rebuilding. Diff whitespace checks pass.

Remaining free-launch gates: Docker-capable Linux image verification and remote CI; selected host HTTPS/WSS/edge abuse limits and measured capacity; production database migrations/backups/actual restore/rollback; real SMTP and optional Google acceptance; owner-approved privacy/terms/support; physical iPad/iPhone tests against hosted HTTPS. Payment certification belongs to a later paid release. No public deployment, real identity delivery, merchant activation, commit or push was performed.

## Milestone 10 — Local communication foundation

Status: **standalone preview verified in browser engines; native paired feasibility open** (2026-10-12).

- [x] Extract a narrow controller contract and reuse the existing display, renderer and remote with a local reading-device authority. Preserve hosted protocol v2/Phoenix ownership.
- [x] Add `/local` without account/API discovery: independent prepared-script library, recoverable editor draft, TXT/MD import, explicit guest-draft copy, save/retry/export and paused semantic recovery. Store text/settings/anchors separately from ephemeral peer credentials.
- [x] Add production-only versioned service-worker app preparation, local navigation caching, manifest and explicit Phoenix routes/static headers. Cache app assets, excluding account/API responses; defer waiting build activation until clients close.
- [x] Implement experimental manual offer/answer file/text exchange with no STUN/TURN/signaling server, authenticated chunked snapshots, ordered acknowledged controls, revision-checked Quick Edit, bounds/backpressure, heartbeat loss pause and fresh re-pairing. Protocol tests use deterministic fake RTC; they do not prove ICE connectivity.
- [x] Check standalone cold-open, controls, font/anchor restore, pending editor recovery, storage denial/retry and no API dependence across Chromium/Firefox/WebKit. Verify cold offline startup in the real bundled release under Phoenix CSP.
- [ ] Close native peer feasibility: current Mac candidates expose a VPN route; native ICE stayed checking even with diagnostic mDNS/loopback flags. Flags are removed from normal tests. No VPN configuration was changed. Three native browser cases remain opt-in, not passing acceptance.
- [ ] Prove fresh no-uplink router/hotspot pairing and lock/background/reload behavior on actual iPad/iPhone/Android and installed contexts. QR ergonomics, app-update transitions and measured latency/server-load comparison remain open.
- [ ] Add online rendezvous, automatic path selection, host-routed Phoenix relay/handoff and account revision/conflict synchronization. Existing hosted sessions remain separately available.

Verification: **88 client units passed; 6 offline browser cases passed / 3 native peer cases intentionally skipped; 33 shared hosted regression cases passed across three engines; 2 real production/LAN release smokes passed.** Phoenix guest suite: **90 passed / 54 database cases excluded**. Production and bundled builds, Elixir formatting and diff whitespace checks pass. Browser-engine automation is not physical mobile/offline paired acceptance. No new dependency, public deployment, commit or push was performed.

## State ownership target

| State | Owner | Notes |
| --- | --- | --- |
| Local draft before a session | Local persistence | Must survive refresh without an account |
| Document revision in a live session | Phoenix for hosted; reading-device controller for local | Each session family has exactly one authority |
| Transport ordering, status, speed, time anchor | Phoenix for hosted; reading-device controller for local | No transparent takeover or second authority |
| Exact rendered pixel offset | Display | Never streamed every frame |
| Semantic reading anchor | Display-generated, stored by that take's authority | Prepared local scripts retain anchors for paused recovery |
| Remote controls | Remote intent only | Never independently authoritative |
| Durable account scripts | Library context/PostgreSQL | Separate from ephemeral Session processes; saved before pairing |
| Entitlements | Commerce/grants in PostgreSQL | Server-enforced; one effective Pro status from valid production grants |

## Testing priority

1. Document normalization and storage migration unit tests.
2. Semantic anchor conversion tests.
3. Session/channel permission and reconnect integration tests.
4. Canonical multi-surface E2E flow.
5. Quick Edit E2E flow.
6. Manual iOS background/lock matrix.
7. Long-script and poor-network performance tests.

## Deliberately out of scope

Do not add during the current launch cycle:

- AI writing or rewriting;
- recording or camera capture;
- video editing, transcription, or subtitles;
- collaboration or team workspaces;
- native applications;
- OBS/conference integrations;
- marketplace, community, or enterprise administration.

Record attractive ideas separately and continue the active milestone.

## Immediate next action

Advance the active [local communication plan](LOCAL_COMMUNICATION_PLAN.md), especially native reachable-LAN and fresh no-uplink tablet/phone feasibility. The standalone preview can proceed independently; paired offline support remains experimental until that gate passes. Next implement online rendezvous and host-routed fallback without changing state ownership, then account synchronization and physical performance acceptance. Existing deployment, payment, signed packaging and external identity gates remain separate; no hosting is provisioned by this slice. Keep physical entries in `REMOTE_DEVICE_QA.md` unverified until actual device evidence is recorded.

