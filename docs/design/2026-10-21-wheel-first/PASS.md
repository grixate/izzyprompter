# Wheel-first collection — 21 October 2026

[Live gallery, all selected14](review.html). The owner approved the [Orbit trial](../2026-10-20-orbit-wheel/review.html) and requested the same treatment for the remaining designs.

## Result

The approved composition now lives in `src/product/remote-wheel.css`, imported last by `skins.css`. It is scoped to standalone craft remotes (the selected14), in portrait viewports at least620px high. Other historical studies, shorter viewports, landscape, lab comparison cards and library miniatures retain their existing responsive layout.

- The wheel is dominant: approximately378px on a428×746 browser viewport, with an additional12px clearance allocation for Cartridge's slot. No visible wheel is replaced by an empty large container.
- A compact identity row and one-row instrument display free height while preserving counters, pixels, segments, camera frame, chronometer/seconds subdial and truthful transport state.
- Linear rails, rollers, dials and vertical levers retain their construction in a shallow auxiliary strip. Speed remains0.20–1.00, step0.01, initial0.56, with exact entry.
- Arcade, Thumbprint and Correspondent keep a separate Play key in a left-hand bay beneath the wheel; speed occupies the rest of that strip. Container dimensions anchor the button independently of wheel-width limits. The shared button, input, gesture and playback logic is unchanged.
- Phrase, edit and appearance controls share the bottom row with52–56px targets. The speed/action dead zone remains at least20px.
- Groove's tonearm, Clear's lighting, Foundry's gears, Switchboard's number plate and Observatory's three elliptical orbits are preserved.

## Actual validation

-92 client unit tests passed. The final production client build and frozen-preview build passed.
-12 Playwright cases passed across Chromium, Firefox and WebKit: selected14 touch layout (including the new428×746 dominant-wheel assertion), historical26-skin viewport geometry, paired editor with keyboard-sized viewport, and delayed speed-acknowledgement behavior. No GitHub job or physical-device result is implied.
- Frozen demo verification passed420 states:14 skins ×10 viewport sizes ×3 engines. Checked viewport fit, visible wheel diameter, touch dimensions, speed/action separation, legend legibility and gaps, display/wheel separation and Cartridge slot clearance. All42 engine/skin flows exercised Play/Pause, phrase navigation, keyboard jog, pointer drag, exact speed, native range keyboard interaction and Quick Edit. Zero page errors.
- Live-gallery checks covered14 frame presence, interaction in Groove/Arcade/Correspondent, browser and full-screen sizing,75% scaling without changing the internal viewport, and a saved gallery view.
- All14 rendered faces were visually reviewed in four sheets. The saved skin screenshots show a deliberately jogged/rotated pose; they are evidence, not the review interface. Initial gallery state is paused at0.56.

The first verifier attempt assumed ArrowRight always increases vertical native ranges and used a portrait-only collision assumption in landscape; those test assumptions were corrected. Visual review also caught and fixed the identity row's inherited column direction and the Cartridge slot clearance before the passing run.

No physical iPhone/iPad, OS soft-keyboard or screen-reader certification. The gallery's browser shell is illustrative. No hosted publication, commit, push or merge in this pass. Existing frozen previews and manifests are preserved.

## Reproduction and preservation

Build with `node docs/design/2026-10-21-wheel-first/build-review.mjs`; verify with `node docs/design/2026-10-21-wheel-first/verify.mjs` while the static server serves `docs/design` on8780. See `checks.json`, `gallery-checks.json`, `validation.json`, `source/` and `manifest.json`. The gallery embeds the frozen build; it does not require account/session state.
