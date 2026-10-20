# Jog wheel studies — 2026-10-12

For future rounds, repairs and brand collaborations, use the canonical [remote instrument design playbook](REMOTE_DESIGN_PLAYBOOK.md) and the repository's `izzy-remote-design` skill. This file remains the collection/verification record, not a second set of design instructions.

An interactive design experiment requested by the owner. Open `/lab/jog` on the Vite development server (currently `http://192.168.1.13:5173/lab/jog`). It needs no Phoenix session, account, database or internet connection. The Mac must remain running and phones must be able to reach its development server; this is not the planned hosted/offline product.

The route and its lazy-loaded styling are development-only and removed from the production build. No public navigation link or backend route was added. The existing `JogControls` component, remote styling and protocol are unchanged. Every study owns disposable demo playback/position; nothing writes to account scripts, drafts or session storage. Shortlisting is temporary and clears on page refresh. Leaving focus view can remount other studies and reset their demo playback.

## Directions

1. **Field reel:** broad satin-silver disc, shallow rim, subtle diagonal engraving and small hub. Move play below the wheel so the disc is entirely for scrubbing.
2. **Thumbprint:** graphite disc with a finger recess, fine gripped perimeter and separate play key. Explore grip and directional feedback without a full scale.
3. **Orbit:** warm ivory ring and central dark play button, one orange index, minimal depth. A digital-first alternative, not a replica of the recorder.
4. **Original:** current production wheel geometry as the comparison baseline; lab-only contextual casing and optional rotation are not production changes.
5. **Signal (R–04):** safety-orange enamel, charcoal wheel and a squared cream play key. A broadcast/field-instrument direction.
6. **Groove (R–05):** warm studio casing, concentric vinyl grooves and an orange label-like hub.
7. **Glacier (R–06):** frosted blue reel with three spokes and a separate peach transport key.
8. **Bakelite (R–07):** oxblood resin, a stationary recessed square bay around the round wheel, and a porcelain-like central play key.
9. **Switchboard (R–08):** petrol-green enamel and an ivory rotary telephone face with ten finger wells and a dark central transport key.
10. **Vector (R–09):** a phosphor-green sweep under a stationary reticle, a dark glass face and matching green readout. Decorative instrument language, not radar or added telemetry.
11. **Cartridge (R–10):** warm grey ABS, an ultramarine shuttle disc, chunky grip ribs and a square lavender key, inspired by eighties video equipment.
12. **Aperture (R–11):** six blade-like optical planes inside a fine champagne rim, a compact central key and a dark cinematic casing. A local SVG face, not an external image dependency.
13. **Correspondent (R–12):** black leather, a painted disc with exposed brass edges and a separate shutter-like key.
14. **Foundry (R–13):** a three-arm cast-bronze handwheel, recessed-looking patina and a central bronze key.
15. **Inox (R–14):** brushed stainless steel, a shallow thumb channel and a rectangular dark transport key.
16. **Airframe (R–15):** a pale machined six-slot reel, stationary casing fasteners and separate rust-orange transport.

The first four designs remain on the page, unchanged except for Orbit's candidate label/context. Collection 02 adds four studies below them. The owner prefers **R–03 / Orbit as the default**; it is marked as the default candidate and is the initial focus selection on a fresh load. No production default or Pro gating has changed. The owner's future Pro-skins idea is recorded in [REMOTE_SKINS.md](REMOTE_SKINS.md).

Collection 03, **Somewhere out of time**, appends the final four below Collection 02. The original eight face rules and study definitions are preserved. At the owner's request, pause the exploration here with twelve working studies and three collections; do not add more rounds automatically.

On 2026-10-13, the owner requested another four, reopening exploration as Collection 04, **Material memory**. The original twelve face styles and definitions are preserved, including the corrected Aperture; the lab now contains sixteen. [The dated collection record](design/remote-skins/2026-10-13-material-memory/COLLECTION.md) preserves the brief, concept cards, new evidence and actual checks. The local preview address is now `http://192.168.1.17:5173/lab/jog`; the earlier address above is historical.

Grounding: the owner's TP–7 and Ulanzi image attachments, the existing IZZY preview and [Teenage Engineering's TP–7 product page](https://teenage.engineering/products/tp-7). The manufacturer describes the reel as a scrubbing control and visual playback feedback. Our interpretation explores broad surfaces, small readouts, material restraint and control separation, not TE branding or a claim of physical haptics. CSS faces are interactive UI, not photographic renderings.

## Interaction

- Drag around a wheel; arrows/Page Up/Page Down/Home/End work on its keyboard-focusable slider.
- Separate accessible play/pause action, speed range and plus/minus controls. Playback advances the demo excerpt and position.
- Compare all or focus one, choose Precise/Balanced/Fast sensitivity, toggle playback rotation, shortlist and reset demo controls.
- Reduced-motion preference removes decorative wheel rotation. No sound, vibrations or actual session commands are emitted.

## Verification

Checked in the Codex in-app browser: comparison/focus, playback/pause, keyboard bounds, speed adjustment, shortlisting, reset and responsive phone layout. Production TypeScript/Vite build and existing 79 client unit tests pass. Confirm the final generated production assets contain no lab page/style chunk. These are local prototype checks, not physical iPhone/iPad or full application release acceptance.

Collection 02 verification: all four new studies play/pause, reach 0/2400 using Home/End, and increment speed from 0.86× to 0.91×. Pointer dragging on Bakelite changes demo position. Phone layouts at 390 px and 320 px have no horizontal page overflow; desktop comparison shows all eight studies. Browser viewport overrides were reset after checking. The production asset hashes remain unchanged, confirming the development-only additions did not enter the release bundle. Collection 02 preview: `artifacts/jog-wheel-studies-collection-02.png` (the original preview is preserved).

Collection 03 verification: all four final studies play/pause, reach 0/2400 using Home/End, and increment speed from 0.86× to 0.91×. Vector pointer dragging changes position under the stationary grid. Focus/compare navigation includes all twelve; 390 px and 320 px phone checks show no horizontal page overflow. Aperture's compact key has an expanded mobile touch area. Production build and 79 client unit tests pass; the release asset hashes are still unchanged. Final-round preview: `artifacts/jog-wheel-studies-collection-03.png`. Earlier previews are preserved. This does not replace physical-device launch testing.

Aperture correction: replaced the uneven last-over-first blade overlap with six rotationally symmetric segments sharing boundary endpoints around a clear hexagonal opening. The artwork now fits the disc without 110% oversizing. The optical rim, central key, radar and other ten studies are unchanged. In-browser checks confirm pointer scrubbing (310 → 417), playback/pause, Home/End (0/2400), and a 320 px phone rendering without horizontal overflow. Updated preview: `artifacts/jog-wheel-aperture-fixed.png`; historical collection previews remain preserved. Build and 79 client tests pass.

Correspondent refinement, 2026-10-13: keep its recessed finger well as the single wheel cue and remove the duplicate thin index line. The historical Material memory capsule is unchanged; [the refinement record](design/remote-skins/2026-10-13-correspondent-refinement/REFINEMENT.md) identifies the latest target. Other faces and shared controls are untouched.


19 October — Clear and Arcade rebuilt around graphite Phone (1) glass and a TAITO paddle spinner. Synthetic review and paired browser evidence: [object pass](design/2026-10-19-skin-craft/v4-objects/PASS.md). No new IDs, release selection, grants or hosted app update.


20 October — first time/speed batch implemented for Groove, Clear and Arcade. The selected collection remains14. [Implementation, gallery and actual validation](design/2026-10-20-time-speed/PASS.md).21 paired browser cases,90 unit tests and build passed; no hosted app publication or physical-device claim.


20 October — the full selected14 now have instrument-specific time and self-contained speed controls. No duplicate +/-; editable exact speed, native keyboard precision, captured relative gestures, and ACK ordering are shared. [Current collection and evidence](design/2026-10-20-collection/PASS.md).87 paired browser cases have successful latest results across Chromium/Firefox/WebKit; static review and miniatures checked separately. No merge, hosted publication or physical-device claim.


20 October — phone remote is now a fixed viewport instrument. Grid allocation keeps all controls visible without page scrolling; short portrait and landscape layouts preserve touch targets. Shared Quick Edit is a native drawer outside the casing, including the standalone fourteen-skin demo. [Current implementation and actual evidence](design/2026-10-20-fixed-remote/PASS.md). Historical previews remain preserved.


20 October — Quick Edit is now a minimal prompter sheet: compact header/Done, quiet text surface and no normal footer. Full VisualViewport geometry and safe insets keep editing above the keyboard/browser chrome. Shared across all selected14; sync and draft recovery preserved. [Current preview and evidence](design/2026-10-20-quiet-editor/PASS.md). 18 browser cases passed in three engines; final six layout cases and static nine states passed. Physical keyboards/devices are not certified.
