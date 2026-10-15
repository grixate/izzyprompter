# UX / PRO implementation candidate

14 October 2026. Branch `codex/ux-pro-implementation`, based on current main at
`6486342` (including the approved logo integration). Production remains unchanged.

The owner approved implementation and delegated design decisions. The selected
art direction is warm studio paper for immediate use, with a dark, material-led
PRO page. Research informed the actual IZZY composition and artwork. The earlier
proposal for two separately approved page pairs was replaced by direct refinement
of this direction under that delegation; two completed alternatives and owner
visual acceptance are **not** claimed. Screenshots below are review evidence.

## 15 October copy and composition refinement

The owner asked to condense small text, particularly labels above headlines, and
to defer physical iPad/iPhone review. Main, PRO, skins and Offline now omit those
editorial labels. Repeated captions, proof badges, section numbers and payment
explanations are removed. Main has one introductory sentence; PRO leads with the
finishes, scripts and price. Script limits move into an optional disclosure.
Useful input feedback, access checks, unavailable purchase states and the
experimental direct-pairing limitation remain visible when relevant.

Spacing was adjusted with the copy so the editor and product appear sooner.
The refined candidate builds successfully. Its affected product/entry/input suites
passed 22 Chromium checks and 42 Firefox/WebKit checks; the latter explicitly
skipped two native clipboard cases. An initial overlapping test launch collided
with the shared output directory; the sequential rerun above completed cleanly.

Physical review is deferred by the owner; it has not passed and does not block
this local visual refinement. Production publication is still unauthorized.

## 15 October visual and interaction correction

The owner rejected the first copy-only pass and identified overlapping preview
surfaces, clipped product shadows, an orange wheel marker/focus ring, independent
wheel motion in pause, and an Offline page still dominated by forms.

The main page no longer inherits a viewport-sized flex column that compressed
its sections. The demo uses separate screen/phone grid slots on wide screens and
a spaced stack on phones. Product compositions reserve space for rotated bounds
and shadows before the footer; both main and PRO footer clearance are tested.
The added orange index marks on Original/Orbit are removed. Keyboard focus is a
stationary underline on the caption below the wheel, with no ring on the slider
or transport key. Functional wheels rotate only during playback or direct jog;
ambient motion is explicitly limited to decorative showroom instruments. The
preview stops both words and wheel during pause, editing, and a script with no
scrollable distance.

Offline is now a public landing page with one setup action and three concise
steps. The workspace appears on request; existing scripts/drafts resume there.
Empty libraries are omitted. Start/save actions share dimensions; import/export
and phone pairing details are progressively disclosed. Cached app readiness,
script persistence, storage failure recovery and manual pairing remain real
existing behavior. No QR or successful direct pairing is fabricated.

Validation: 54 affected entry/product browser checks passed across Chromium,
Firefox and WebKit, including six widths, separated demo bounds, a usable wheel
size, footer clearance, no wheel ring, and pause/play behavior. Standalone Offline
passed six checks across the three engines; three native opt-ins remain skipped.
Two bundled-release/LAN smoke checks passed. Layout tests first exposed the
inherited flex compression; offline test helpers were updated for the deliberate
setup entry and the added footer logo. Their corrected reruns passed. The prior
copy commit `9bfa96a` passed all required GitHub jobs in
[run 38687716523](https://github.com/grixate/izzyprompter/actions/runs/38687716523);
this correction requires a fresh CI run.

Latest normal-pane screenshots: [main demo](main-demo-corrected.png),
[main footer](main-footer-corrected.png), [Offline landing](offline-landing-corrected.png).
These supersede the earlier copy-refinement captures for the affected surfaces.
Wide and narrow compositions were also inspected live in the browser. Physical
review remains deferred and production is unchanged.

## 15 October navigation and speed preview repair

The owner deferred direct pairing work and asked to hide the separate Skin
Library navigation entry. Header, mobile menu and footer now omit it; the route,
deep links, existing studies and contextual PRO finish previews are preserved.
How it works and Start prompting no longer repeat the main-page destination in
the menu. The logo returns home; PRO, account access and Online/Offline remain.

The decorative instrument speed rail had zero available flex width, and its
simplified markup bypassed skin material styles. It now uses a full-width
speed-module grid with a 0.86× example and matching 36% range fill. Inert step
keys adopt each skin’s material. Component container sizing accommodates small
teasers and cards; old viewport width rules that made the keys oval are removed.
Live controls and the original lab retain their behavior.

Evidence: [PRO speed](pro-speed-corrected.png), [showroom speed](skins-speed-corrected.png),
[simplified mobile menu](navigation-simplified.png). Unit checks: 88 passed;
production build passed. Product tests cover navigation, preserved deep links,
all sixteen live finishes and six widths in three engines. Additional geometry
assertions caught narrow teaser overflow before final adaptive sizing. The final
layout matrix passed all 18 checks across three engines; navigation and sixteen-
finish live-control checks also passed in each engine.

## Implemented scope

| Package | Actual candidate behavior | Remaining gate |
| --- | --- | --- |
| P0 / D0 | Current-main integration, preserved studies, reference research, chosen desktop/mobile composition | Owner visual review; physical visual/motion review |
| P1 | Shared compositor wheel motion, gesture priority, visible/offscreen/background/reduced-motion handling; non-green focus | Physical HOLD/idle comprehension and performance |
| P2 | Public server-owned product data, `/pro` and `/skins` routes, $49 reference → $29 launch, conservative −40% badge | Merchant acceptance before enabling checkout |
| P3 / P4 | Original free + fifteen optional PRO finishes, public inspectable showroom, device preference, live remote application | Per-skin physical orientation/contrast/touch review |
| P5 / P6 | Immediate entry retained, public navigation and mode switch, product demo, PRO page, verified owned/unavailable states, safe email/Google return and purchase handoff | Owner page review; real email/Google/merchant acceptance |
| O1 | Free standalone Offline, separate browser preparation and script saving, actual cached-build readiness, recoverable local editor | Physical storage/lifecycle acceptance |
| O2 | Fresh native Chromium no-app-HTTP attempt ran and failed to reach DIRECT | Reachable native LAN and physical no-uplink pairing required |
| O3 | Manual peer preview receives plain-language progress/errors and disclosure | QR/scanner/automatic signaling and complete paired Offline remain unfinished |
| O4 | Unchanged architecture | Relay, account sync and verifiable offline paid entitlement remain separate scope |
| P7 | Bounded local event adapter and hooks, including verified paid-return observation | Collector, retention and measured conversion outcomes are not configured |
| Q1 | Automated checks and local visual review below | CI candidate, staging, owner/device review and publication gates |

## Architecture and commercial contract

- `Teleprompter.Product` is the source for new checkout and public metadata.
  `IZZY_LAUNCH_OFFER_ACTIVE=true` advertises and charges 2,900 USD cents against a
  4,900-cent reference; `false` changes new purchases to 4,900 and removes the badge.
  Existing purchase attempts retain their stored amounts. Checkout activation is
  separate and unchanged; disabled sales show **Purchases opening soon**.
- The initial UX slice added no schema migration, new tier, subscription, framework or payment provider.
  Existing three-script Free quota, PRO unlimited count, presets, purchase
  verification, journals, conflict recovery and session protocol are reused.
- A signed-in host can authorize its guest remote's appearance through a
  capability-bound POST endpoint returning only `pro`. The capability travels in
  a JSON body under the existing deny-by-default parameter log filter, leaving
  `Authorization` available to staging’s Basic-auth proxy. Database grant queries run
  outside the playback GenServer. The endpoint grants no account-library access.
- Paid application rechecks permission. Focus/minute refresh and failure/revocation
  return to Original, preserving the remembered device choice. Reading surfaces
  are not themed. LOCAL/DIRECT remain free Original without account/API dependence.
- Sign-in return destinations are allowlisted; no session links, arbitrary URLs or
  capability fragments can be carried through the product handoff. A same-tab,
  account-bound purchase intention lasts at most 24 hours and offers an explicit
  finish choice after verified access; it does not auto-apply or prove payment.
- Public and actual controls share rotor motion/presentation. Material previews
  are decorative; they issue no commands. All original design collections remain.

## Verification record

Commands ran locally with synthetic scripts and an isolated PostgreSQL database.
No live payment or real customer content was used.

| Check | Result |
| --- | --- |
| Unit tests | 88 passed |
| TypeScript / Vite production and bundled builds | Passed |
| PostgreSQL Phoenix suite | 154 tests, zero failures |
| Full browser matrix | 189 passed, 2 skipped, 1 WebKit dialog-focus failure |
| Follow-up product/payment/free-library matrix after focus fix | 57 passed across Chromium, Firefox, WebKit; includes all sixteen finishes, revocation, keyboard/reduced motion, 360/390/430/768/1280/1440 widths |
| Standalone Offline suite | 6 passed across three engines; 3 native cases explicitly skipped in the normal suite |
| Separate native Chromium opt-in | Failed: exchange completed but remote did not reach DIRECT within the connection gate; no native pairing pass claimed |
| Bundled production-release / LAN-launcher smoke | 2 passed, including direct loads for `/pro` and `/skins` |
| Dependency advisories | npm zero vulnerabilities; Hex zero unresolved, one existing explicitly reviewed cowlib mitigation |

The full browser matrix preceded the final focus and handoff refinements; the
follow-up covers their affected surfaces. CI must run the complete final candidate. The first Linux CI guest matrix passed
150 checks and skipped its 41 inapplicable cases, but its combined sixteen-finish
WebKit test exhausted the 30-second total budget while still advancing. Trace
inspection showed successful individual actions. That integration test now has
a 90-second total budget and named per-finish steps; normal assertion/action
budgets remain unchanged. The focused local WebKit rerun passed. The next CI account job passed all
154 Phoenix tests, 190 browser checks (2 native-clipboard skips), and the restore
drill. Its guest job passed 150 browser checks but the five-screen Quick Edit
flow reached the total timeout during cleanup; both traces showed all live-edit
and reload assertions succeeding. That flow now has a 60-second total budget,
with its assertion limits unchanged. The complete candidate at `38c32b0` passed all three required GitHub jobs:
[test, accounts and container](https://github.com/grixate/izzyprompter/actions/runs/38686099641).
This run precedes the 15 October copy refinement; its final CI run is tracked in the PR.
Automation is not physical Safari/iPhone/iPad/Android acceptance. No converter,
revenue uplift, real merchant charge or production release is asserted.

Native diagnostics stay in ignored artifacts: pairing data can contain sensitive
capability material. Do not attach them to the PR or publish them as screenshots.
The fresh failure does not establish the network cause; earlier VPN-candidate
findings are historical evidence, not a new routing diagnosis.

## Visual evidence

Screenshots are public pages, synthetic/empty content and no capability links.
The baseline captures below precede the 15 October copy refinement.
Desktop: 1440 × 1000. Phone viewport: 390 × 844.

Latest copy refinement, captured in the normal 533 × 805 in-app pane:
[Main](main-refined.png) · [PRO](pro-refined.png).

| Surface | Desktop | Phone |
| --- | --- | --- |
| Main | [Main](main-desktop.png) | [Main](main-mobile.png) |
| PRO | [PRO](pro-desktop.png) | [PRO](pro-mobile.png) |
| Skins | [Skins](skins-desktop.png) | [Skins](skins-mobile.png) |
| Offline | [Offline](offline-desktop.png) | [Offline](offline-mobile.png) |

[Material showcase](pro-materials-desktop.png) · [Reference research](research.md).
Local craft review found and corrected phone tool overlap, narrow-page overflow,
light-surface label contrast and WebKit focus restoration. The design remains
subject to owner judgment; no model score substitutes for extraordinary quality.

## Event and collection state

`izzy:product-event` carries only an allowlisted event name and bounded categorical
properties. No script, email, user/purchase ID, raw URL, capability or SDP is sent.
The adapter emits an in-memory browser event only; no collector or third party is
configured. Purchase completion is observed only after the account API reports a
paid attempt and verified PRO access, with best-effort same-tab deduplication. It
is not a financial ledger. Pairing-ready events identify the standalone surface;
they do not imply that a direct phone pair succeeded.

## Release and open acceptance

Use the required `test`, `accounts`, `container` GitHub jobs and their exact tested
candidate image. The PR records the current CI link. Staging uses synthetic data
and separate state. Follow `docs/RELEASE_WORKFLOW.md`; no merge deploys production.

Physical iPad/iPhone review is explicitly deferred by the owner. No physical pass
is claimed. Remaining release evidence includes exercising every
marketed finish in portrait/landscape, keyboard/text zoom/reduced motion; verify
email/Google returns and a merchant-approved transaction if sales will be enabled.
Paired Offline remains experimental until native and physical gates pass; the UI
must keep that limitation. No default change to Orbit or offline paid-skin parity
is included. Publication needs explicit authorization and exact-image promotion
with previous-image retention, between takes.

## Payment readiness follow-up — 15 October

The [payment audit](../../PAYMENT_READINESS_2026-10-15.md) records the current
launch blockers and local corrections: bounded durable invoice checks, interrupted
checkout review, receipt mismatch review, strict reauthentication return, guarded
repeat checkout, immutable offer snapshots and trusted release support commands.
This follow-up adds migration `20261015000000_schedule_payment_checks`; back up
and migrate the acceptance database before starting the matching candidate.
Both hosted environments still have sales off and no Lava credentials. Staging's
all-route Basic policy rejects provider callbacks and needs a reviewed delivery
arrangement. No live transaction, refund, payout or hosted update occurred.

Local verification: 88 unit checks, builds, 165 PostgreSQL-backed Phoenix tests,
54 payment/product checks across three browsers, a backup/restore drill and two
bundled-release/LAN checks passed. The production release's support bootstrap
also passed in a fresh process without starting an endpoint or payment worker.
The final Linux run is tracked in the draft PR. A previous Linux run exposed
fallback-font speed-label overflow; the value columns now use their intrinsic
width and the layout matrix explicitly exercises a fallback font.
