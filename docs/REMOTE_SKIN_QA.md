# Remote skin readiness — 18 October 2026

This is the acceptance record for the sixteen **live online remote** finishes,
not the disposable `/lab/jog` demos or the inert showroom/library previews.
Construction and preservation remain governed by [REMOTE_DESIGN_PLAYBOOK.md](REMOTE_DESIGN_PLAYBOOK.md).
The product decisions remain in [REMOTE_SKINS.md](REMOTE_SKINS.md).

## Operating contract

Every finish uses `RemoteSurface`, `JogControls`, `TransportReadout`, the same
session controller and measured display position. A finish cannot introduce
separate transport logic, speed limits, connection rules or editing behavior.

The same functional readout is present in every skin: transport position,
position-derived nominal time at the selected speed, and RUN/HOLD. It is not a
recording timer or a remaining-time estimate. Without a display measurement,
position/time show a dash rather than invented progress; DSP 00 WAIT identifies
the missing display. Vector changes the glass/ink treatment. Correspondent,
Foundry, Inox and Airframe change the readout frame/material treatment. These are
appearance differences, with the same information and behavior.

The only control-placement difference is Play/Pause: five finishes place the
button below the wheel; the others place it at the center. Each uses a real,
separately focusable button. Artwork, finger wells, blades, reticles and scales
are inert. The rotating index is wheel orientation, not script completion.

## Corrections in this review

- Speed step buttons and the range now have at least 44 × 44 CSS px hit areas.
  The speed module fits narrow screens, and its transparent range has a visible
  focus cue and position thumb.
- Restored readable speed-key ink, phrase actions, Quick Edit, connection/display
  labels and readout labels. Signal's live ink is darker against its orange
  material. Essential live labels are larger than the archived lab microtype.
- Jog focus remains visible on all finishes, including those hiding the idle
  caption. Play and speed each have their own visible keyboard focus.
- Short screens scroll inside the remote, keeping the tools reachable rather
  than relying on a body that deliberately disables scrolling.
- Restored Orbit's missing orange index and each material's speed-fill color
  from the preserved studies. Header model numbers follow the actual finish;
  transport instructions no longer assume a center button.
- Finish changes do not animate essential transport ink through intermediate
  colors with poor contrast.
- Fixed the shared wheel retaining pointer capture after disconnect. Disabling
  controls discards the active pointer; reconnection cannot resume that gesture.
  A second pointer cannot take over a drag, and release/capture loss completes a
  gesture only once.
- Corrected the shared timecode: seconds and tenths now come from one nominal
  time calculation. The previous decimal digit was a pixel remainder, and whole
  seconds rounded ahead. Unit checks cover subsecond, minute and speed changes.

The studies, stable IDs, default, entitlement model and protocol are preserved.
Local/DIRECT still use Original; the shared gesture correction also applies to
those controls. No hosted environment was changed by this review.

## Catalog matrix

The test suite enumerates `src/product/catalog.ts`; adding a finish automatically
adds both its functional and responsive acceptance tests.

| ID | Finish | Play/Pause | Readout appearance | Browser result |
| --- | --- | --- | --- | --- |
| original / R–00 | [Original](design/2026-10-18-remote-skin-readiness/original-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| ivory / R–03 | [Orbit](design/2026-10-18-remote-skin-readiness/ivory-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| field / R–01 | [Field reel](design/2026-10-18-remote-skin-readiness/field-paired.png) | Below wheel | Dark glass | Pass: Chromium / Firefox / WebKit |
| graphite / R–02 | [Thumbprint](design/2026-10-18-remote-skin-readiness/graphite-paired.png) | Below wheel | Dark glass | Pass: Chromium / Firefox / WebKit |
| signal / R–04 | [Signal](design/2026-10-18-remote-skin-readiness/signal-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| groove / R–05 | [Groove](design/2026-10-18-remote-skin-readiness/groove-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| glacier / R–06 | [Glacier](design/2026-10-18-remote-skin-readiness/glacier-paired.png) | Below wheel | Dark glass | Pass: Chromium / Firefox / WebKit |
| oxide / R–07 | [Bakelite](design/2026-10-18-remote-skin-readiness/oxide-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| switchboard / R–08 | [Switchboard](design/2026-10-18-remote-skin-readiness/switchboard-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| vector / R–09 | [Vector](design/2026-10-18-remote-skin-readiness/vector-paired.png) | Center | Phosphor glass | Pass: Chromium / Firefox / WebKit |
| cartridge / R–10 | [Cartridge](design/2026-10-18-remote-skin-readiness/cartridge-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| aperture / R–11 | [Aperture](design/2026-10-18-remote-skin-readiness/aperture-paired.png) | Center | Dark glass | Pass: Chromium / Firefox / WebKit |
| correspondent / R–12 | [Correspondent](design/2026-10-18-remote-skin-readiness/correspondent-paired.png) | Below wheel | Brass frame / warm ink | Pass: Chromium / Firefox / WebKit |
| foundry / R–13 | [Foundry](design/2026-10-18-remote-skin-readiness/foundry-paired.png) | Center | Bronze frame | Pass: Chromium / Firefox / WebKit |
| inox / R–14 | [Inox](design/2026-10-18-remote-skin-readiness/inox-paired.png) | Center | Steel frame | Pass: Chromium / Firefox / WebKit |
| airframe / R–15 | [Airframe](design/2026-10-18-remote-skin-readiness/airframe-paired.png) | Below wheel | Aluminium frame | Pass: Chromium / Firefox / WebKit |

## Repeatable checks

```sh
npm test
npx playwright test test/e2e/remote-skin-readiness.spec.ts
npx playwright test test/e2e/remote-skin-library.spec.ts test/e2e/entry-preview.spec.ts test/e2e/reading-sync.spec.ts test/e2e/quick-edit.spec.ts test/e2e/accessibility-recovery.spec.ts
git diff --check
node .agents/skills/izzy-remote-design/scripts/verify-baseline.mjs docs/design/remote-skins/2026-10-12
node .agents/skills/izzy-remote-design/scripts/verify-baseline.mjs docs/design/remote-skins/2026-10-13-material-memory
```

Each finish pairs to a real local Phoenix session and display using synthetic
text. Only the Pro appearance grant is mocked; this suite does not certify live
account eligibility or payment acceptance. It checks actual display movement,
Play/Pause, both drag directions, synthetic pointer cancellation of a captured
gesture, arrows/Page/Home/End, speed range/step bounds, phrase navigation, live
Quick Edit propagation, disconnection during a captured gesture, disabled input,
reconnection and preference/reload.

An additional paired-display test selects all sixteen finishes through the real
library during playback, checking that the display keeps rolling, speed persists,
and the position-derived timecode stays consistent for every finish.

Responsive checks use 320 × 568, 390 × 844, 844 × 390, 768 × 1024 and
1280 × 900 CSS px. They check overflow, reachable controls, 44 px minimum hit
areas, button alignment, separate keyboard focus stops and reduced-motion
playback. The paired page also measures essential text/icon contrast against
samples of its rendered background, including gradients. This targets the
playbook's 4.5:1 text / 3:1 icon thresholds; it is not a complete accessibility
audit or a measurement of every pixel in a gradient. Traces/editor snapshots are
disabled in this suite to avoid retaining pairing capabilities.

The existing library checks cover selection, playback continuity, storage denial,
revocation, keyboard containment and closing during verification. Reading/editing
regressions check the measured display anchor and multi-screen behavior.

Local results on 18 October 2026:

- Client unit suite: 91 passed, including three timecode regression cases.
- Production TypeScript/Vite build: passed. Lab page and lab-scoped CSS remain absent from release assets.
- Backend suite: 99 passed; 66 database-tagged cases excluded by the local configuration.
- New catalog suite: 99 passed (33 per engine), no skips, failures or flaky results.
- Existing library, entry preview, reading sync, Quick Edit and accessibility/recovery suites: 72 passed across the three engines.
- Offline regression: 6 passed across the three engines; 3 native-peer cases remain opt-in/skipped under the documented VPN/LAN limitation.
- Preserved archive hashes: all 17 founding and 9 Material memory files verified.
- Diff whitespace check: passed.

The targeted rendered-background checks produced 48 per-finish/browser records.
The lowest sampled essential text ratio was 4.70:1;
the lowest sampled large-timecode/icon ratio was 3.70:1.
These sample minima do not replace physical legibility or screen-reader review.

[Reviewed comparison and all full-size paired screenshots](design/2026-10-18-remote-skin-readiness/README.md)
· [Per-test browser/contrast evidence](design/2026-10-18-remote-skin-readiness/browser-results.json)
· [Surrounding regression evidence](design/2026-10-18-remote-skin-readiness/regression-results.json).

GitHub checks and any later staging/device results belong to the review PR and
release record; none is inferred from these local results.

## Remaining release acceptance

Browser automation does not close the physical-device gate. For **each** finish,
record actual iPhone Safari, iPad Safari and Android Chrome results before calling
it production-approved:

1. Real touch scrubbing in both directions, interrupted touch, Play/Pause, speed
   edges and Quick Edit with the native keyboard/IME.
2. Portrait/landscape, browser chrome and safe areas, enlarged text/browser zoom,
   focus and essential readout legibility under real viewing conditions.
3. VoiceOver/TalkBack: separate jog and Play stops, announced position/speed,
   disabled/reconnecting state, and library focus return.
4. Reduced motion and sustained playback performance on the actual device.
5. The lock/app-switch/network recovery scenarios in
   [REMOTE_DEVICE_QA.md](REMOTE_DEVICE_QA.md).

Record device/OS/browser/date and pass/fail, without script material or pairing
keys. Hosted acceptance uses the isolated staging environment and exact candidate
image under [RELEASE_WORKFLOW.md](RELEASE_WORKFLOW.md). Production publication
still requires explicit owner authorization; merging a PR does not deploy it.
