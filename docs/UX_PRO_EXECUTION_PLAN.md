# IZZY UX, Offline and Lifetime PRO — execution plan

Date: 14 October 2026. Status: implemented review candidate; external acceptance gates remain open. See the [implementation evidence](design/2026-10-14-ux-pro/IMPLEMENTATION.md) for actual scope and check results.

This plan covers the full `IZZY_Prompter_UX_PRO_Implementation_Spec_v1.0.md` correction brief. It supersedes the initial review's unresolved pricing question. The owner confirmed a **US$49 reference price and US$29 launch price** in this chat. Everything else below distinguishes existing behavior, implementation decisions, proposed defaults, and acceptance gates.

## 1. Outcome and scope

A visitor understands the browser prompter and phone remote within the first screen; enters a script immediately; finds Online, Offline, skins and PRO without searching; previews every released skin before buying; and sees one consistent lifetime offer. A prepared user can prompt without internet and, on explicitly supported devices/networks, pair a phone without internet. The wheel feels consistent across the product without compromising control accuracy or accessibility.

The complete program includes entry/navigation, wheel motion, production skins, public showroom, PRO conversion, standalone and paired Offline, entitlement behavior, analytics instrumentation, responsive/accessibility verification, and controlled release. Completing the visual work alone does not complete the program.

**Owner design mandate, 14 October:** the main page and PRO page must have extraordinary design quality. Art direction, typography, product composition, materials, motion and mobile composition are explicit acceptance requirements. Passing functional checks does not close either page. Follow the [main/PRO design brief](MAIN_PRO_DESIGN_BRIEF.md); research and compare visual directions before committing to production layouts.

Preserve React/Vite, Phoenix, existing account persistence, protocol v2, the local controller, all design studies, recovery behavior and the release workflow. Keep core prompting, phone remote, Online and Offline free. Account library limits remain three active scripts for Free and unlimited count for PRO; per-document/resource bounds still apply. The separate 20-script prepared local library is unchanged by this pass. No new subscription, tier, framework, cloud-history feature, or full editor redesign.

## 2. Baseline and evidence policy

Planning baseline: fetched `origin/main` at `da5adbb0ddf3d69c9fc1262f693e6b301e3fde3f`. The plan is written on `codex/ux-pro-execution-plan` in an isolated worktree. The original `codex/implement-logo-pack` checkout is preserved; logo changes are not yet in this fetched main and must not be lost or duplicated during integration.

Current main adds Postbox email configuration and account operations, including database isolation, encrypted backups and a restore drill. Those runbooks supersede the initial review's older guest-only infrastructure assumption. This planning turn has not inspected the running server or rerun their recorded checks. Recheck actual release identity and flags when preparing a candidate; historical evidence is not a new pass.

| Boundary | Existing implementation | Planned work |
| --- | --- | --- |
| Entry | `src/pages/StartPage.tsx`, immediate editor, persistence, session creation | Copy, hierarchy, navigation and sections around the accepted workbench |
| Preview | `src/components/LivePreview.tsx`, real text movement and shared controls | Correct combined label, visible wheel motion, consistent demo behavior |
| Wheel | `src/components/JogControls.tsx`, pointer/keyboard input | Shared visual/motion primitive, continuous angle and skin presentation |
| Focus | Global green focus rule in `src/styles.css` | Scoped accessible non-green wheel/transport focus |
| Routes | `src/App.tsx`, explicit Phoenix router | Public `/pro` and `/skins`, direct-load/reload handling |
| Accounts | Account provider/API, saved scripts, pending journals, presets | Reuse limits, grants, conflicts and authentication; add appearance settings only as needed |
| Commerce | `Teleprompter.Commerce`, lava.top, USD 2,900 cents | Shared public product metadata, reference price, offer availability and purchase entry |
| Skins | Sixteen DEV-only studies in `JogLabPage.tsx` and scoped lab CSS | Production catalog, audited rendering, entitlement and application; preserve lab |
| Offline | Local controller, IndexedDB, worker preparation, manual direct peer | Progressive preparation, actual direct feasibility, practical pairing and recovery |
| Measurement | Operational telemetry and aggregate diagnostics | Fixed conversion event contract and bounded instrumentation; no new external provider |
| Release | Candidate-image CI artifact and manual promotion | Use existing checks, isolated staging, exact-image release and rollback |

Code inspected during planning is evidence for architecture only. Browser screenshots, physical results, merchant transactions and GitHub runs must be recorded when they actually occur.

## 3. Fixed commercial contract

| Field | Decision |
| --- | --- |
| Public name / internal code | Izzy Pro / `lifetime_pro` |
| Purchase | One payment, lifetime; no subscription |
| Currency | USD only for new purchases |
| Reference price | 4,900 cents / US$49 |
| Active launch price | 2,900 cents / US$29 |
| Savings | US$20; exact reduction approximately 40.816% |
| Badge | `-40%` / `Save 40%`, conservatively derived by flooring the computed percentage |
| Provider | Existing lava.top integration |
| End date | None specified; no countdown or invented deadline |
| Activation | Product offer presentation and checkout activation are separate capabilities |

One server-owned product definition supplies public price, reference price, currency, launch-offer state, feature availability and checkout availability. Both the public response and actual checkout consume it; do not create a separate marketing price constant. Public metadata contains no purchases, user identities, secrets, invoice IDs or provider credentials. Entitlements continue to come from server grants, not marketing feature flags.

When the offer ends, new checkout and every public price/badge change together to the configured regular price. Existing checkout attempts retain their immutable amount/currency and provider state; do not rewrite them. If checkout is disabled or metadata cannot be loaded, retain the showroom with an honest unavailable state and no stale discount/purchase action. A PRO owner sees `Pro active` / `Open Izzy` and is not invited to buy again.

## 4. Product decisions and defaults

The following defaults let implementation proceed without repeatedly interrupting for routine choices. Review the actual resulting screens before release. A failed technical gate requires changing the plan, not inventing successful behavior.

| Topic | Working decision | Release decision still needed |
| --- | --- | --- |
| Homepage | Retain immediate input and interactive preview; improve the existing page | Owner reviews the final desktop/mobile composition |
| Live idle motion | Very slow ambient motion when connected, clear HOLD state; direct input always wins | Confirm on a physical remote that idle rotation does not imply playback |
| Default skin | Orbit remains the default candidate; preserve Original | Default replacement requires actual device/design acceptance |
| Catalog | Evaluate all sixteen studies; first implementation subset: Orbit, Field reel, Thumbprint, Signal, Groove, Inox | Approve the actual usable subset; remaining studies stay preserved until they pass |
| Appearance preference | Device choice takes precedence; account preference supplies a default where available; never restyle the reading screen | Validate logged-out paired-remote entitlement and offline permission behavior |
| Offline discovery | Public and free; show real preparation/readiness; manual phone path stays experimental until proven | Approve supported device/browser/topology list from physical evidence |
| Standalone start | Always available independently of phone connection | None; remote readiness must not block standalone use |
| Analytics | Event contract plus optional first-party aggregate measurement, no third-party provider | Record whether collection is enabled and its retention before production |
| Publication | Local → PR/checks → staging review → authorized exact-image promotion | Production publication remains an explicit owner action |

Paid appearance must not depend on an untrusted local boolean. First ship online server-validated skin application. For offline paid skins, explicitly design a verifiable cached entitlement and its expiry/revocation policy before enabling them. Until then, guarantee the free default offline and describe the limitation; basic Offline never waits for an account or purchase check. This is an open subtask, not silently completed offline PRO parity.

## 5. Delivery structure and dependencies

Use focused branches/PRs from current main. The identifiers below are planned work packages, not existing GitHub PRs. Rebase each next package on the integrated dependency; do not build one long chain of unreviewed branches.

| ID | Deliverable | Depends on | Relative scope |
| --- | --- | --- | --- |
| P0 | Baseline, behavior contract and visual inventory | None | Small |
| D0 | Reference research, two coherent page directions, desktop/mobile composition and motion prototype | P0 | Medium; mandatory for main and PRO |
| P1 | Shared wheel rendering/motion and focus correction | P0 | Medium |
| P2 | Public product/offer configuration and route foundation | P0 | Medium |
| P3 | Production skin catalog and application | P1, entitlement contract from P0 | Large |
| P4 | Public skin library and large preview | P2, P3 | Medium |
| P5 | Homepage, navigation and mode control | D0 reviewed direction, P1, P2; final teaser uses P3/P4 | Medium |
| P6 | PRO page, owned states, purchase and login handoff | D0 reviewed direction, P2, P4 | Large |
| O1 | Standalone Offline preparation and recovery UX | P0; navigation integrates with P5 | Medium |
| O2 | Native peer and offline signaling feasibility | P0 | High uncertainty |
| O3 | Complete paired Offline and progressive pairing UI | O1, O2 passing | Large |
| O4 | Optional online introduction/relay, account sync and offline paid-skin parity | O3 plus explicit sub-scope decisions | Large; separate architecture milestone |
| P7 | Event adapter and measurement verification | Contract in P0; integration in P4–P6/O1/O3 | Medium |
| Q1 | Full acceptance, release evidence and staged review | All capabilities included in a candidate | Medium plus physical-device access |

Execution order: P0 → D0 → P1 → P2 → P3 → P4 → P5 → P6, with O1 following the route/state contract and O2 started early enough to expose connectivity risk before final Offline claims. This is a dependency schedule, not authorization to launch parallel agents. P7's event hooks accompany the relevant changes; Q1 closes each release candidate. O4 is not required to preserve the existing Online mode or prove a purely offline pair, and must not balloon the correction pass.

Do not promise calendar dates before P0/P1 establish the integration baseline and O2 produces a go/no-go. UI work is bounded; physical reachability and merchant acceptance are the schedule risks. Track completed deliverables and blocked gates separately.

## 6. Work package specifications

### P0 — baseline and implementation contract

- Record current source, release image identity/feature flags, app entry routes and actual available capabilities without reading secrets into output.
- Resolve logo integration against latest main. Preserve all sixteen studies and existing scripts; use isolated synthetic accounts/scripts for review.
- Capture current entry, paired remote, account library, local setup and skin lab at desktop, tablet and 360/390/430 px widths. Record overflow, control sizes, focus and motion behavior.
- Record a repeatable baseline: guest script entry → session creation → scan/open remote → playback → jog → Quick Edit → reload/recovery. Keep the accepted fast-entry path.
- Define view/state inventories: logged-out, Free, PRO, revoked PRO, accounts unavailable, checkout unavailable, metadata failure, active session, offline unprepared/prepared/error/connected.

**Deliverable:** architecture/state map, screenshot inventory, capability table and baseline run record. **Exit:** no unknown ownership for drafts, transport, entitlement or pricing; no baseline failure concealed by the redesign.

### D0 — art direction and design acceptance

- Use the curated [design research](design/2026-10-14-ux-pro/research.md) as a starting point, not a layout template. References must resolve a concrete question about composition, material, mechanism explanation or page pacing; refresh only where necessary.
- Produce two coherent page pairs for exploration: each includes a main-page first screen, PRO hero and material-showcase section at desktop and mobile sizes. They must differ in composition and pacing, rather than only colors. Preserve IZZY's identity and immediate input in both.
- Select and refine one direction through visual review before P5/P6 production layout. Do not ask for abstract approval: show real IZZY skin/control artwork, actual copy, the offer, and the mobile composition. This design checkpoint is separate from production-publication approval.
- Build a small code-native motion proof for wheel/script relationship and skin transition continuity. Review static/reduced-motion and first-load states alongside animation; no long loader or scroll-jacking.
- Record type scale, grid/spacing, palette, material/light treatment, product framing/crops, section rhythm and motion ownership. Reuse existing design tokens; any extension needs a visible purpose.
- Judge the pages against the brief's design scorecard, actual narrow-screen results and close-up detail checks. Iterate weak composition/material/typography even when the implementation works.

**Deliverable:** annotated references, two paired directions, chosen full-page desktop/mobile compositions, motion proof and completed design scorecard. **Exit:** owner-reviewed visual direction and no unresolved design blocker for the main/PRO layouts. Research is complete enough to inform exploration; the visual concepts have not yet been produced or accepted.

### P1 — shared wheel system and focus

- Extend `JogControls` with a reusable rotor/presentation primitive; keep all pointer capture, keyboard seeking, command bounds and enablement safeguards.
- Expose skin/size, decorative versus interactive mode, ambient/playback/direct/static rotation, disabled state and reduced-motion behavior. Adapt props to the existing code rather than creating a framework.
- Maintain one continuous visual angle. On pointer down, direct manipulation owns rotation; on release resume the appropriate motion from the current angle. No canonical-angle snap, doubled seek, accumulated background frames, or gesture replay.
- Derive playback presentation from current playback direction/speed and confirmed reading movement where available. Decorative animation never generates transport commands. Pause ambient motion when disconnected/hidden; decorative previews pause offscreen.
- Respect reduced motion at startup and when the preference changes: stop decorative/idle motion; retain direct functional feedback. Preserve text-preview pause on editing and foreground/offscreen suspension.
- Replace the green wheel/transport focus rule with a neutral or orange `:focus-visible` treatment on the interactive wrapper. Test mouse, keyboard and nested play button; do not globally remove outlines or neutralize intentional skin colors.
- Use transforms and a shared CSS/clock strategy for visible skin previews; no independent per-frame React updates for sixteen thumbnails.

**Deliverable:** shared primitive used by entry and real remote, followed by skins. **Exit:** direct input remains exact, keyboard focus is visible and non-green, no motion fights input, reduced motion/background behavior works, and actual display movement remains correct.

### P2 — product data and public routes

- Extend the current server-owned commercial source with the fixed contract in section 3. Define active price/reference/promotion from the same product record used at checkout.
- Expose a minimal public product response; keep `/api/account/commerce` private and preserve purchase history. Resolve availability from both global flags and actual provider readiness.
- Add explicit `/pro` and `/skins` frontend and Phoenix routes; preserve existing account, login and pairing URLs and query/fragment handling. Verify refresh/direct navigation in bundled production and container builds.
- Create shared client product data/copy utilities and explicit loading/unavailable states. Avoid importing heavy skin previews into remote pages that do not need them.
- Cover the active/inactive promotion, missing metadata, disabled provider and already-owned cases. Client requests cannot choose amount, reference price or entitlement.

**Exit:** navigation/page/account offers cannot disagree; advertised US$29 equals new checkout's 2,900 cents; private commerce data is never public; no stale launch badge after configuration changes.

### P3/P4 — production skins and public showroom

- Extract catalog entries and scoped tokens from the approved studies; preserve lab metadata, archives and experimental controls separately. Original remains available; Orbit is a candidate, not an automatic production replacement.
- Audit all sixteen for rotor/transport structure, touch targets, contrast, focus, text zoom, clipping, orientation and reading-state clarity. Production admission is per skin; do not promise an unreviewed study as included.
- Use an allowlisted stable skin ID and versioned preference. No arbitrary CSS, asset URL or HTML from users. Prefer existing account settings mechanisms; any schema change is additive with safe unknown-ID fallback.
- Resolve online paid choices through server grants. A guest remote capability must not grant account-library access. Define how an entitled host/owner authorizes the paired remote's choice without leaking account credentials.
- Store default/preferred choice separately from effective appearance. Revocation or logout falls back to the free default without deleting the remembered preference, scripts or presets. Test account switch, stale state, reload, unknown skin and entitlement refresh.
- Build `/skins` with rotating visible wheels, narrow phase offsets, subtle PRO markers, selected state and accessible skin names. Click opens a large preview before upgrade; free users never hit a login wall just to inspect.
- Owned users get Apply; unowned users get Unlock with Pro and current lifetime price when checkout is available. If unavailable, retain preview with an honest state. Preserve intended skin through safe login/purchase return; apply only after entitlement confirmation and user intent.
- Support intentional two-column/snap-scroll mobile presentation and keyboard-operable modal/close/focus restoration. Avoid continuous animation cost from offscreen cards.

**Exit:** every advertised skin actually applies to the live remote; all guest/Free/PRO/revoked states work; animation and controls share one implementation; the archive remains intact.

### P5 — homepage, navigation and Online/Offline control

- Use the brief's headline/support copy as the starting point; keep the editor and useful demo immediately available. Do not add an extra marketing page before script entry.
- Correct the combined caption to `ONE SCRIPT. TWO SCREENS.`; use local PROMPTER/REMOTE labels only where they help. Relate preview wheel and script movement without showing fake connection status.
- Provide Start prompting and Explore Izzy Pro, with No download / Phone remote / Online + Offline / Free core proof. If no text is entered, Start focuses the editor; when ready it advances real setup. Never start an empty session or run the sample as the user's script.
- Add brief Open Izzy → Scan → Control explanation, an honest Offline section and a strong skin-led PRO teaser. Use actual released visuals and sparse copy.
- Public nav: brand, clear Online/Offline state, PRO + active discount, start action, secondary skins/how-it-works. On narrow widths retain a readable mode affordance; use a compact current-mode button/sheet if a full segmented control does not fit. Keep PRO easy to find.
- Mode is a user choice, not a connectivity detector. Route determines the current workspace; persisted preference does not silently redirect a returning user or strand them in unavailable Offline.
- Flush/preserve drafts before leaving; local and account copies do not silently merge. During an active take, disable switching with a clear reason; an explicit end-and-switch action can be added only with a real end transition. Do not merely navigate away and leave ownership ambiguous.
- Replace primary user-facing Hosted labels with Online; retain internal identifiers and contextual technical diagnostics where needed.

**Exit:** a guest finds mode and PRO immediately; first-screen mechanism is clear; script entry/import/recovery remains fast; no silent session interruption; desktop/mobile navigation has no dead links or overflow.

### P6 — lifetime showcase, entitlements and purchase path

- Build `/pro` around one large actual remote: Make it yours → skin showcase → public library → actual saved-script/preset workflow → Offline reassurance → final purchase block. Conditionally omit capabilities not available in that candidate.
- Show US$49 reference, US$29 current, active `-40%`, and One payment. No subscription. Reuse product data in every CTA; no fake urgency. Use normal scrolling; a quiet sticky purchase affordance is optional after mobile obstruction checks.
- Keep Free/PRO boundaries precise: unlimited prompting and free Online/Offline; three active account scripts for Free, unlimited count for PRO; polished default skin, paid skins; existing named/default presets for PRO. Do not imply unlimited offline storage or unbounded script size.
- Use real library/preset UI in synthetic examples. Do not fabricate folders, version history, automatic backup or comprehensive local/account sync.
- Reuse current limit enforcement. At the limit preserve editing/prompting/export and offer Manage scripts; show upgrade only when purchase is available. Never delete/migrate existing scripts for marketing.
- Handle guest → sign-in → intended PRO/skin destination using a validated internal return target, including expired login/retry and reload. Signing in does not automatically charge or create a second invoice.
- Reuse lava checkout, pending/ambiguous state, verification and grants. A redirect is not payment confirmation. Existing PRO owners and pending purchasers get contextual actions rather than repeated Buy prompts; notification/polling behavior stays bounded.
- Keep the public showcase viewable when owned or checkout is disabled. Final purchase availability requires merchant setup and authorized real acceptance in `LAVA_TOP.md`; pricing approval does not enable the payment flag.

**Exit:** all included benefits exist and work; public/owned/unavailable states are complete; login returns correctly; checkout is not duplicated; only server-confirmed entitlement unlocks paid application.

### O1 — standalone Offline preparation and recovery

- Make Offline public and free with one focal preparation flow: prepare this browser → save the script on this device → start. Reuse the cached app, prepared store, recoverable draft and local controller.
- Separate app-cache readiness, script persistence, browser support and remote connectivity. Recheck on reopen; show no green Ready state based only on network hints or a previous successful preparation.
- Explain once that both devices must be prepared before internet is removed. An offline QR cannot serve the app to a never-prepared phone. Ordinary browser and installed/Home Screen contexts are verified separately.
- Keep manual networking/exchange under Connection options when appropriate; retain useful diagnostics without exposing raw exceptions as the primary message. Provide one clear recovery action plus export/retry where storage fails.
- Preserve standalone Start without a phone. Pairing remains an explicit experimental path until O2/O3 pass, and its necessary offer/answer steps remain usable.
- Cover unsupported browser, storage denied/full/evicted, failed asset preparation, update waiting, copied draft, reload and safe paused anchor recovery. Never activate a new app build during a take.

**Exit:** a user can prepare, close, remove connectivity, reopen and prompt their saved script; failure preserves text and gives a practical next action. This does not close paired-Offline acceptance.

### O2 — offline phone feasibility, started before polishing the promise

- Reproduce and document the existing native ICE failure without changing the user's VPN/network configuration implicitly. Compare reachable trusted router topologies and candidate types without logging raw SDP, addresses or pairing secrets.
- Run real iPad/iPhone Safari and Android Chrome combinations using prepared apps and trusted HTTPS, then close both apps, remove router uplink and create a fresh pair. Test each advertised hotspot host/client direction separately with cellular unavailable.
- Measure offer/answer size, gather time, camera permissions, scan reliability and full round-trip pairing time. Current production headers deny camera; if a scanner is needed, permit it only on specific pairing documents and keep other permission restrictions.
- Prototype bounded two-way scan/import using existing peer protocol. A single online-style link is not an offline discovery solution. Test whether one QR per direction is viable; retain import/manual recovery. Compression or animated codes need a separate measured usability justification.
- Go/no-go report lists exact device/OS/browser/context/topology and failure evidence. If native pairing or practical signaling fails, narrow advertised support or escalate architecture; do not replace the requirement with a standalone demo and call it done.

**Exit:** at least the proposed supported combinations can form a new authenticated connection from cold prepared apps with no uplink, and users can complete the exchange practically. Passing mocked RTC tests does not close this gate.

### O3 — complete paired Offline and progressive setup

- Implement initializing → preparation/pairing ready → waiting for remote → authenticated snapshot accepted → connected → active, with recoverable-error and unsupported states. Map to existing peer/controller state; avoid a second independent UI truth.
- Display a dominant scan surface where proven, concise instructions and text/import alternatives. Same-network instructions are guidance; success follows the actual peer handshake, not assumed network membership.
- Complete play/pause, speed, wheel, edges/paragraph navigation, settings, exact reading anchors and revision-checked Quick Edit. Transfer large snapshots with size/backpressure bounds; controls enable only after fresh snapshot acceptance.
- Preserve one reading-device authority, command sequencing, connection generation, acknowledgements and stale-command refusal. Decorative wheel feedback never substitutes for confirmed display response.
- Peer loss, lock/background, reload, stale version/material and network change produce explicit safe pause/re-pair recovery. Unsent edits are preserved and require explicit resume; gestures are not queued and replayed later.
- No API/login/session-creation/rendezvous request is required for fresh offline operation after preparation. Do not disable a healthy local peer because internet status changes.
- Use plain-language failures and Connection options diagnostics. Retain standalone continuation and export when a phone cannot connect.

**Exit:** full remote functionality and failure/recovery pass physically for each supported configuration, including fresh no-uplink pairing. “Paired Offline complete” requires this evidence.

### O4 — related architecture work kept explicit

Online rendezvous, host-routed relay, automatic path handoff, local/account conflict synchronization, and offline paid-skin entitlement are distinct follow-on subpackages. They improve a unified direct-first product but are not silently included in a cosmetic pass.

If approved for this program, follow `LOCAL_COMMUNICATION_PLAN.md`: Phoenix relays to the same local authority; never replay an uncertain jog as a new command; absent host refuses; internet return cannot overwrite a running take. Account saving uses existing revision/mutation rules and distinguishes applied to take / saved on device / saved to account. For cached paid appearance, settle offline validity and revocation semantics explicitly. Until complete, retain separate supported Online and Offline paths and document limits.

### P7 — conversion events and measurement

- Define a single allowlisted event adapter; call it at actual state transitions/user intent, not component rerenders. Wire hooks as each package lands.
- Include all requested events: homepage start/PRO; mode change `{from,to,surface}`; Offline opened/ready/connected/error; skins opened/previewed; locked-skin upgrade; PRO viewed/checkout; verified purchase completed; script-limit upgrade.
- Allow only bounded placement/surface, released skin ID, mode and normalized reason. No script content, QR/offer/answer, local address, URL/query/fragment, account email, invoice or persistent device identity.
- Reuse existing telemetry infrastructure for optional first-party aggregate counts if collection is enabled; use an explicit rate-limited bounded ingestion contract if browser events need one. Operational error counters remain distinct from product events. No external analytics provider is added by this plan.
- Verified purchase completion originates from the durable commerce transition, deduplicated, never the return URL. Browser adapters must tolerate blocked/unavailable collection without disrupting prompting or checkout.
- Measure starts, connected remotes, first playback, skin previews, checkout attempts and verified purchases by placement where available. Aggregate event ratios are directional counts, not unique-user funnel attribution. Set conversion targets after a comparable baseline; do not claim uplift from an unmeasured launch.

**Exit:** event names/properties and deduplication are tested, collection/retention state is recorded, and event failure cannot affect the core workflow.

## 7. Acceptance and test strategy

Use targeted meaningful tests for new behaviors plus relevant existing regression suites. A documentation-only plan needs no application test run. During implementation, run required checks once per changed candidate; repeat when code/failures justify it. No historical count is presented as a fresh pass.

| Boundary | Required evidence |
| --- | --- |
| Wheel/motion | Forward/reverse pointer seeking, keyboard/page/edge controls, play/speed, interrupted capture, angle continuity, idle/HOLD clarity, disabled/disconnected state, offscreen/hidden suspension, dynamic reduced motion |
| Entry/navigation | Empty/input/restored/imported script, failed storage/copy, edit pause, mode change with unsaved draft and active session, mobile menu, direct route loads, reload/back navigation |
| Skin application | Every marketed skin, unknown ID, guest/Free/PRO/revoked, host-entitled guest remote, reload/account switch, fallback without deleting preference, keyboard preview/apply/close |
| Product/checkout | US$49→US$29, promotion off/changed, provider unavailable, product fetch failure, forged client amount, owned/pending state, safe login return, notification-before/after-redirect and duplicate events |
| Existing account behavior | Three-script quota including trash/restore, no data loss, unlimited PRO count, preset save/application, version conflicts, disconnected pending edits, account isolation |
| Standalone Offline | Prepare/save separately, cold-open with networking disabled, storage denial/eviction, stale/update waiting build, paused recovery and export |
| Paired Offline | Fresh no-uplink exchange, all controls/Quick Edit, long payload, failed/expired exchange, network isolation, lock/background/reload, reconnection generation and no stale gestures |
| Accessibility | Keyboard-only flow, intentional non-green wheel focus, dialog focus return, semantic mode state, named skin/owned states, live status announcements, contrast, reduced motion and large text |
| Responsive | 360, 390 and 430 px phones; tablet portrait/landscape; 1280 and 1440+ desktop; no horizontal overflow, usable QR/touch targets, unobstructive sticky CTA |
| Design craft | Distinctive IZZY identity, immediate mechanism comprehension, desirable real skins, precise typography/alignment, varied section rhythm, coherent material/light treatment, intentional mobile framing, polished static/animated/reduced-motion states; complete D0 scorecard and owner visual review |
| Performance | Visible grid versus static baseline, offscreen suspension, no layout-driven rotation, long-script/jog/Quick Edit responsiveness; compare on the same target device |

Implementation commands are selected by boundary: `npm run test:unit`, `npm run build`, Phoenix tests with and without PostgreSQL as applicable, `npm run test:browsers`, `npm run test:offline`, `npm run test:release`, `npm run test:container`; `npm run test:restore` for relevant data/schema/release changes. The required GitHub `test`, `accounts`, and `container` jobs must pass before merge. Preserve their logs/run links.

Chromium/Firefox/WebKit automation is separate from actual Chrome/Firefox/Safari checks and physical iPhone/iPad/Android acceptance. Record what ran, versions and result; list every skip or untested scenario. Keep `REMOTE_DEVICE_QA.md` current. Do not close O2/O3 using deterministic peers or phone emulation.

## 8. Release groups and rollback

| Group | Contents | Public claim allowed after acceptance |
| --- | --- | --- |
| A — clarity | P1/P2/P5 and O1; public PRO/showroom links only when their actual pages exist | Improved entry, visible modes, standalone Offline with clear remote-preview limits |
| B — PRO product | P3/P4/P6/P7, owned/disabled-checkout states | Only released skins and real library/presets; purchasing only after merchant gates |
| C — paired Offline | O2/O3 passing and integrated UX | Fresh paired Offline for explicitly supported combinations |
| D — optional integration | Approved O4 subpackages | Only the particular relay/sync/offline-entitlement capabilities verified |

These are independently reviewable release groups, not a requirement to publish each separately. If the owner wants one launch, combine the accepted groups into one candidate. Never claim completion of the entire correction document while a required paired-Offline gate remains open.

For each group: build from a recorded commit; inspect successful CI; verify candidate artifact checksums/image identity; retain image/source metadata beyond CI retention; review on isolated staging using synthetic content; record owner review. Preserve current account/SMTP/database operations and backups. Before schema changes, verify current backup/Mac-copy recovery evidence and run migrations once with the release's controlled process.

Staging Basic authentication can interfere with credential-free offline asset caching. Use isolated trusted-origin local acceptance for offline tests without weakening staging. Physical offline evidence remains required.

Production promotion requires explicit authorization. Promote the exact staging-tested image, retain the previous image/config selection, schedule between takes, and verify health, guest pairing/playback, account sign-in/library where enabled, public product routes, entitlement and purchase availability as applicable. Application rollback changes the image/config; it does not overwrite the database, delete scripts or undo irreversible migrations. Feature flags must safely disable a new offer/skin surface without removing existing grants or disrupting free prompting.

## 9. Risk register and decision triggers

| Risk | Early check / mitigation | Stop or escalation trigger |
| --- | --- | --- |
| Offline native reachability | O2 early physical router/hotspot tests | No fresh no-uplink pair on target devices: narrow support or architecture decision; no full Offline claim |
| Offline QR exchange too large/awkward | Measure both directions and scan success before polished layout | Unusable exchange: retain import and prototype a justified alternative; do not ship misleading one-scan copy |
| Idle rotation confuses paused state | Actual phone HOLD/play comparison in P1 | Confusion: revise idle visual treatment before approving shared motion |
| Skin variants break input/accessibility | Per-skin admission on common control primitive | A failing study stays in lab, absent from paid included list |
| Guest remote lacks owner identity | Define capability-bound online appearance authorization | No verified entitlement path: default skin works; paid apply unavailable until resolved |
| Paid skins while fully offline | Separate verifiable cached-permission design | Unsettled expiry/revocation policy: do not claim offline paid-skin parity |
| Offer data diverges | One server product source and response/checkout tests | Price/availability mismatch blocks release |
| Conversion page harms immediate use | Compare baseline task flow and first-screen editor | Extra mandatory step or draft loss blocks approval |
| Logo/main divergence | Preserve branch; integrate reviewed brand changes deliberately | Conflict resolved without deleting source assets/studies or rolling back account work |
| Release hides an untested gate | Evidence checklist and capability table per image | Missing physical/merchant/check evidence remains visibly open |

## 10. Definition of done and handoff

For each work package, update this ledger with branch/PR, commit, implemented scope, tests/run links, screenshots and remaining gates. Status values: planned → implementing → locally verified → CI verified → staging reviewed → released. A blocked external gate is recorded separately; it does not turn unfinished work into complete work.

The final handoff contains:

1. Architecture note identifying reused/refactored components and any additive schema/config changes.
2. Commercial and feature matrix showing actual available versus preview versus deferred behavior.
3. Desktop/mobile screenshots for entry, Offline, skins and PRO, using synthetic scripts and no credentials/pairing fragments.
4. Acceptance checklist covering all brief sections, with explicit fails/skips and physical-device results.
5. Event contract and collection state; measured baseline/results where collection exists.
6. Candidate image/source identity, staging review, publication decision, previous-image selection and rollback instructions.
7. Open product/technical decisions with a recommended next action and owner, not hidden assumptions.

### Coverage of the source brief

| Brief sections | Plan coverage |
| --- | --- |
| 0–1: objectives/guardrails | 1–2 and release groups |
| 2: information architecture | P2/P5/P6 |
| 3: global wheel | P1 and per-skin acceptance |
| 4: homepage | P5 |
| 5: mode control | P5/O1/O3 |
| 6: Offline redesign | O1/O2/O3; explicit O4 boundaries |
| 7: product model | 1/3/4, P3/P6 and offline-entitlement decision |
| 8: skin library | P3/P4 |
| 9–10: PRO/conversion/upgrades | P2/P6 |
| 11–13: visual/responsive/accessibility | P0/P1/P3–P6 and section 7 |
| 14: analytics | P7 |
| 15: architecture/config/deep links | 2–6 |
| 16: copy inventory | P5/P6/O1/O3, conditional on verified capability |
| 17–18: acceptance/QA | 7–10, including actual physical evidence |
| 19–21: sequence/constraints/deliverables | 5–10 |

The dated initial plan above records the intended program. The [implementation ledger](design/2026-10-14-ux-pro/IMPLEMENTATION.md) supersedes its initial status and documents changes to sequencing, design delegation and the open Offline/device/merchant gates. It does not mark planned alternatives or external acceptance as completed.

## References

- Owner's correction document, version 1.0, 14 October 2026, and explicit US$49→US$29 pricing decision in this chat.
- [Release workflow](RELEASE_WORKFLOW.md), [account operations](ACCOUNT_OPERATIONS.md), [Postbox delivery](POSTBOX_EMAIL.md).
- [Accounts and commerce](ACCOUNTS_COMMERCE.md), [lava.top acceptance](LAVA_TOP.md).
- [Remote skins](REMOTE_SKINS.md), [design playbook](REMOTE_DESIGN_PLAYBOOK.md).
- [Local preview](LOCAL_PREVIEW.md), [local communication plan](LOCAL_COMMUNICATION_PLAN.md), [physical-device checklist](REMOTE_DEVICE_QA.md).

Where historical documents conflict, current source, dated owner decisions and newer release/account runbooks take precedence. This plan adds no permission to expose secrets, activate payments or publish production.
