# UX / PRO implementation candidate

14 October 2026. Branch `codex/ux-pro-implementation`, based on current main at
`6486342` (including the approved logo integration). Production remains unchanged.

The owner approved implementation and delegated design decisions. The selected
art direction is warm studio paper for immediate use, with a dark, material-led
PRO page. Research informed the actual IZZY composition and artwork. The earlier
proposal for two separately approved page pairs was replaced by direct refinement
of this direction under that delegation; two completed alternatives and owner
visual acceptance are **not** claimed. Screenshots below are review evidence.

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
- No schema migration, new tier, subscription, framework or payment provider.
  Existing three-script Free quota, PRO unlimited count, presets, purchase
  verification, journals, conflict recovery and session protocol are reused.
- A signed-in host can authorize its guest remote's appearance through a
  capability-bound endpoint returning only `pro`. Database grant queries run
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
with its assertion limits unchanged. The complete final candidate is rerun.
Automation is not physical Safari/iPhone/iPad/Android acceptance. No converter,
revenue uplift, real merchant charge or production release is asserted.

Native diagnostics stay in ignored artifacts: pairing data can contain sensitive
capability material. Do not attach them to the PR or publish them as screenshots.
The fresh failure does not establish the network cause; earlier VPN-candidate
findings are historical evidence, not a new routing diagnosis.

## Visual evidence

Screenshots are public pages, synthetic/empty content and no capability links.
Desktop: 1440 × 1000. Phone viewport: 390 × 844.

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

Before production approval: inspect main/PRO on actual devices; exercise every
marketed finish in portrait/landscape, keyboard/text zoom/reduced motion; verify
email/Google returns and a merchant-approved transaction if sales will be enabled.
Paired Offline remains experimental until native and physical gates pass; the UI
must keep that limitation. No default change to Orbit or offline paid-skin parity
is included. Publication needs explicit authorization and exact-image promotion
with previous-image retention, between takes.
