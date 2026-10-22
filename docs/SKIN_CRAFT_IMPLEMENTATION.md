# Skin craft collection — implementation record

Started 19 October 2026. Status: **working collection prepared; local browser matrix passed; integration and hosted acceptance pending**.

Owner brief: execute the [revised research and plan](design/2026-10-18-skin-craft-research/report.md), including full transparent bodies, more ambitious linked mechanical details, coherent contemporary palettes and preservation of the existing collection. Production publication is not authorized.

## Source and integration

- Implementation worktree: the chat's attached `skin-craft-research/Teleprompter` worktree; branch `codex/skin-craft-collection`.
- Started from current main `91cd5d6`. Readiness fixes from open [PR #9](https://github.com/grixate/izzyprompter/pull/9) were brought forward as `3b1e9d8`, `00ad274`, `0a9c992`. No other chat's branch or working files were changed.
- The original research remains dated 18 October, with the owner's 19 October refinement. Its archived screenshots describe the earlier baseline, not the new result.

## Current candidate

The allowlisted catalog contains Original plus 25 PRO finish candidates. The ten additions retain stable new IDs and numbers R–16 through R–25: Clear, Spool, Glaze, Pop, Moss, Mono, Loom, Arcade, Observatory and Rally. Existing IDs, free default, permission verification and browser preference key are retained. These are review candidates; no physical-device, audience or owner acceptance is inferred from their presence in the catalog.

### Shared mechanics

`InstrumentMechanism` supplies inert SVG artwork to the real JogControls, lab and RemoteInstrument miniatures. It has no controls, focus stops, remote commands or network calls. State poses derive from the existing enabled/playing/dragging values. The real Play/Pause command is sent immediately.

`useWheelMotion` drives rotor, geared parts and tape from one compositor clock. Secondary rotary ratios are integral and complete whole turns per rotor cycle; repeating tape displacement is a multiple of its eight-unit pattern. Pause and interrupted gestures preserve the full accumulated angle, so the phase is not reconstructed from a wrapped transform matrix. Manual jogging updates all visible linked parts directly; there is no React render or JavaScript loop on each decorative animation frame. The existing offscreen, background and reduced-motion suspension is retained.

Current mechanisms:

| Finish | Candidate detail |
| --- | --- |
| Groove | Pivoted alloy arm, counterweight, headshell, stylus and parking rest; lift during scrub, reversible Play/Pause transition |
| Field reel | Main reel feeds a side tape path through an idler, pinch and smaller take-up reel |
| Spool | Tinted shell and visible reel/tape path; distinct construction from Clear |
| Clear | Translucent shell edge, exposed frame, linked pulley drive and moving pinch |
| Glacier | Frosted interpretation of the exposed belt, retained three-spoke identity |
| Aperture | Six continuous leaf planes open around the always-exposed Play key; fixed optical rim |
| Cartridge | Small cassette window with two synchronized spindles and travelling tape |
| Switchboard | Fixed finger stop; unchanged bidirectional jog, no spring-return input |
| Signal | State-linked physical RUN/HOLD flag, no recording claim |
| Correspondent | Short state-linked brass shutter lever; retained single finger well |
| Foundry | Small secondary gear synchronized opposite the toothed main rim |
| Vector | Fixed glass/reticle above a directional phosphor tail |
| Observatory | Fixed brass meridian and a counter-rotating orbital witness; no invented astronomical data |

Material refinement also covers Original, Orbit, Thumbprint, Bakelite, Inox and Airframe. `skins.css` remains the public entry point; it imports the preserved material rules and the new craft rules. New skins use the same material CSS in the lab and product. The two original archival capsules are unchanged.

### Palette and presentation

Clear uses chalk/green-grey and vermilion; Spool uses smoke violet and acid; Glaze uses blush/oxblood; Pop uses butter/cobalt/clay; Moss uses mineral green/walnut. Mono is matte ink/chalk, Loom woven oxblood/teal, Arcade aqua/cherry, Observatory midnight/brass, Rally chalk/rubber/clay. These implement the research palette directions without replacing existing favourites with colour variants.

The PRO hero and showroom detail provide intentional Play/Pause previews of the same mechanisms. In-session library miniatures remain static. The catalog supplies the displayed finish count, including account, homepage and factual terms copy. Prices, checkout availability, billing and account/session semantics are unchanged.

## Verification log

Initial local unit/build/backend run after the implementation foundation:

- 90 client unit tests passed.
- TypeScript/Vite production build passed.
- 99 non-database backend tests passed; 69 database-tagged cases excluded by local configuration.
- Both archive verifiers passed: 17 founding files and 9 Material memory files.

First Chromium matrix: 73 passed, 8 failed. It exposed contrast shortcomings in five new palettes, narrow-landscape Rally key alignment and two stale last-catalog-entry expectations. The palette/geometry defects were corrected without weakening checks; expected catalog boundaries now derive from the catalog. A ten-case follow-up passed nine and isolated Moss speed-button contrast; that material was then corrected. Those partial runs do not constitute final acceptance.

The expanded local matrix passed **300/300**, with zero retries, failures or skips, across Chromium, Firefox and WebKit (05:47–05:55 UTC). It includes all 26 paired finishes, responsive/focus/reduced-motion checks, in-session library, product pages, mechanisms, entry preview, reading sync, Quick Edit and accessibility/recovery. The initial three-engine run had 221 pass / 22 fail; stale catalog expectations, palette contrast, pointer rounding and rotating-square clearance were corrected. No acceptance assertions were weakened. The PRO overflow repair reserves diagonal clearance for squared miniature rotors, verified throughout a whole turn.

The final tape travel was then rounded to 600 SVG units per main turn, matching the 96-unit tape radius closely and closing the eight-unit dash pattern. [All 27 focused final mechanism cases](design/2026-10-19-skin-craft/mechanism-checks.json) then passed across all three engines without retry, including the 390 px tonearm recording; full CI must validate the final committed source.

[Browser results](design/2026-10-19-skin-craft/browser-checks.json) contain only test titles/statuses. [Rendered contrast](design/2026-10-19-skin-craft/rendered-contrast.json) has 78 per-finish/browser sets (14 targeted selectors, including individual speed keys). The narrowest ratio is 1.019 times its applicable threshold. This targeted pixel sampling is not a full accessibility certification.

Fresh 90 client unit / 99 non-database backend tests and the production build passed. The local offline suite passed six cases across the three engines; three native DIRECT peer cases remain explicitly skipped under the existing physical/network limitation. Both archive verifiers passed again. Dependency checks reported zero npm vulnerabilities and zero unresolved Hex advisories; the existing explicitly reviewed cowlib mitigation remains unchanged.

Paired flows disable retained traces/editor snapshots because those surfaces contain pairing capabilities. Global setup propagates the snapshot setting before browser workers spawn. Assertions remain intact. Deliberate screenshots contain only the synthetic remote body; the isolated Groove lab video contains no pairing surface.

The [collection gallery](design/2026-10-19-skin-craft/review.html) includes actual renders of all 26 live faces, six focused RUN states, a paced six-second synthetic motion recording, original geometry sketches and twelve equal-geometry rendered palette studies. The A materials are the tested candidates; B alternatives are review-only colour trials and do not inherit A’s acceptance. Its fingerprint manifest distinguishes rendered evidence from schematic drawings. The two founding archival capsules remain unchanged. The new `skin-materials.css` is byte-identical to the prior `skins.css`; its wrapper establishes explicit cascade order.

## Current review and integration status

- Draft [PR 12](https://github.com/grixate/izzyprompter/pull/12) is open, pushed and attached. GitHub `test`, `accounts`, `container` must actually succeed before merge.
- Obtain the immutable tested candidate artifact, verify checksums and stage the exact image under `RELEASE_WORKFLOW.md`. Staging restarts terminate staging sessions; keep production on its approved image.
- Owner visual review is the acceptance gate for this design iteration. The owner explicitly declined a participant/device campaign; it is not required to finish this iteration. Physical iPhone/iPad Safari, Android Chrome, VoiceOver/TalkBack and sustained-playback results remain unclaimed.
- The optional audience protocol is retained for future use. No participants were contacted, and no actual conversion data is available. The product event adapter remains local-only.
- Production publication remains a separate owner decision. No production image change or payment activation is included in the current work.

Do not mark the full plan achieved from a passing local build or from the ten new catalog records. Update this record with current-state evidence as work proceeds.

## First GitHub candidate

[Run 39207332361](https://github.com/grixate/izzyprompter/actions/runs/39207332361) reached the WebKit portion but its `test` job hit the 25-minute job limit. The full-catalog product test timed out twice at its old 90-second budget; one five-viewport Arcade case hit its 30-second whole-test limit. The session-capacity hypothesis was not supported: per-finish creations continued successfully. Production/staging capacity was not changed.

The revised harness scales the two full-catalog loop budgets with catalog size, gives five-viewport readiness 60 seconds and makes room for the expanded jobs (40 minutes). Normal 8-second assertion budgets and all functional/contrast assertions remain intact. These are CI execution budgets, not physical-device performance acceptance. The two full-catalog WebKit cases passed again locally (13.8 / 14.4 seconds). A fresh exact-source run is required; the canceled run is not reported as passed.

## Owner update and complete-CI diagnosis

On 19 October the owner declined participant/device recruitment for this design iteration: **the owner evaluates the designs**. Audience sessions are no longer a completion gate for the design work. Physical-device results remain unclaimed; production publication is still a separate decision. The local-only preview was not usable for the owner, so a protected HTTPS review with an isolated synthetic lab is being prepared on staging. This static review does not promote an application image.

The complete [second CI run](https://github.com/grixate/izzyprompter/actions/runs/39210185147) finished with 383 pass / 56 skip / 5 fail in `test` and 434 pass / 2 skip / 8 fail in `accounts`. The final failures wait for pairing links during creation, after earlier cases pass. A fresh local test VM reproduced the test pool boundary: exactly **256 creations and 44 capacity refusals** in a 300-session batch. The full retained multi-browser inventory needs a larger **test-only** pool. It is now 1024; production and staging admission limits are unchanged. Catalog helpers assert the actual 201 creation response, so a future refusal fails clearly before link lookup. The first time-budget diagnosis was incomplete; the earlier capacity hypothesis is now supported by the completed run and local boundary check.

The optional sustained desktop run recorded only the first 60 seconds of Original before a long interruption and whole-test timeout; it is **not passed**, and supplies no long-take or physical-device acceptance.

## Owner-directed quality repair — revision 2

See [the complete owner feedback and response](design/2026-10-19-skin-craft/OWNER_FEEDBACK_V1.md). The mechanism table above describes the first pass and is historical: the added tape/drive overlays, Signal flag, Switchboard stop and Correspondent lever have been removed. Groove no longer has a parking support on the vinyl. Moss no longer has the added recess under its key. Clear/Spool were reconstructed as fixed stators beneath transparent rotating flanges; their stable IDs remain. Foundry has a real 72-tooth rim and a 12-tooth pinion at a shared pitch. Rally now reads as a three-spoke steering wheel.

Nothing's official Phone (3a) design gallery was visually inspected before reconstructing the transparent cases. The new gallery is `design/2026-10-19-skin-craft/v2/review.html`; its comparison buttons preserve the previous screenshots. The owner-liked studies were not regenerated. Browser and build results for this revision are recorded with the new evidence, separately from the first-pass results.

## Curated control pass

The owner replaced the expansion goal with a smaller, recognisable-object selection; see [CURATED_DIRECTION.md](design/2026-10-19-skin-craft/CURATED_DIRECTION.md). The first limited pass is [reviewable here](design/2026-10-19-skin-craft/v3-controls/review.html): twelve retained objects with their own lower-key material/shape/press treatment, Field's central engraved transport and Signal's round key. Nothing/Arcade reconstructions and the other identifying details remain next passes.

The synthetic development review at `/lab/jog?review=controls` reuses the real phrase navigation and Quick Edit trigger components. Real paired transport, paragraph editing, focus restoration, contrast and touch geometry were exercised for all twelve finishes in each of Chromium, Firefox and WebKit (3 matrix tests, no retries or skips). 90 client unit tests and a production build passed. This does not claim current GitHub or physical-device acceptance.
