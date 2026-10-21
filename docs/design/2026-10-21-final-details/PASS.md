# Final control details — 21 October 2026

[Live gallery](review.html) · [Original](live/index.html?skin=original) · [Field Reel](live/index.html?skin=field) · [Switchboard](live/index.html?skin=switchboard)

The owner accepted the large-wheel collection and requested five focused refinements. The selected14, dominant wheel, speed bounds and protocol remain intact. Previous galleries are preserved.

## Changes

- CounterTime now keeps drum positions stable and animates only a newly changed glyph during a consecutive forward second. Pause/resume no longer re-enables an animation across unchanged digits. Reduced-motion behavior remains supported. This fixes Groove, Foundry and Correspondent and also benefits the shared Switchboard counter.
- Pointer focus no longer outlines the large invisible speed-input rectangle. Keyboard focus is indicated on the visible handle; exact entry uses an underline. Native keyboard adjustments remain available.
- Signal, Vector, Orbit and Correspondent accept clockwise/counterclockwise rotation around their actual pivot, with normalized angle differences across the closing seam. First contact never jumps. A centre-start gesture retains up/down adjustment; Shift makes fine changes. Continuous values are bounded before rounding so small pointer moves accumulate and reversal at a limit is immediate.
- Field Reel and Switchboard now have visible sliding roller carriages. The grip texture stays on the carriage. Relative drag follows the rail's travel distance, giving a direct relationship between hand movement and visual movement; first contact still does not jump.
- Original regains the black inset monitor, light monospaced numerals and small fractional part from the preserved12 October reference (`docs/design/remote-skins/2026-10-12/collection-01.png`). Its wheel remains approximately378px in the428×746 browser viewport.

## Actual verification

-92 unit tests and the final client/frozen-preview builds passed.
- Latest combined Playwright run:16 passed,2 skipped. Chromium/Firefox/WebKit covered counter animation events before and after pause/resume; dial direction, reversing, seam crossing, fine adjustment, limits and focus treatment; roller hand/carriage alignment; Original's monitor; the14-skin touch-layout checks; paired14-skin precision, acknowledgements, speed bounds, exact entry and rendered contrast.
- The two skips are trusted touch-move tests on Firefox/WebKit: that test uses Chromium's input protocol. Chromium exercised real browser touch events for all six dial/roller skins, checking direction, no initial jump and capture release. This is emulation, not a physical iPhone certification.
- Frozen demo verification passed420 states (14 skins ×10 sizes ×3 engines), including transport, mouse jog, keyboard/exact speed, editor, geometry and legibility. Zero page errors.
- Gallery presence and Original Play/Pause were checked through its iframe. Roller endpoints and Original's screen were visually inspected. `after/` includes the final14 rendered faces and roller endpoint evidence; `gallery.png` records the interactive wrapper.

The first combined run exposed test assumptions: rounded native mouse coordinates in Firefox/WebKit need a0.02 tolerance for a short angular gesture (exact entry/keyboard assertions stay exact), and fully clipped screen-reader hints must not be sampled as visible contrast targets. The contrast helper now excludes only the standard fully clipped form; visible help remains checked. The final combined run passed after those corrections.

No hosted publication, commit, push or merge. Physical devices, OS soft keyboard and screen-reader behavior were not certified. Existing earlier run evidence is not rewritten.

## Reproduce

`node docs/design/2026-10-21-final-details/build-review.mjs`

`node docs/design/2026-10-21-final-details/verify.mjs` (static server serves `docs/design` on8780)

`npx playwright test test/e2e/skin-final-details.spec.ts test/e2e/time-speed-craft.spec.ts test/e2e/remote-touch.spec.ts --reporter=list`

The frozen build is standalone and synthetic. Source snapshots and a hash manifest preserve the repair for review.
