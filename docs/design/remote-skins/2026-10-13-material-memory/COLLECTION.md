# Collection 04 — Material memory

13 October 2026 · Four additional working lab studies · R–12 through R–15

## Brief and boundary

The owner reopened the exploration after the founding twelve, asking for another four inspired by raw materials: leather, aged-camera brass, metal, bronze and aviation aluminium. Apply the existing remote design playbook, preserve the first three collections and corrected Aperture, and stop after four new pieces. This is development-gallery work only; Orbit remains the default candidate. No production remote, Pro entitlement, account/session behaviour or payment setting changed.

The source worlds are the owner's material suggestions interpreted through camera construction, cast handwheels, stainless instruments and machined lightweight structures. No new external reference assets were needed. These are CSS/SVG material interpretations, not photographs, physical simulations or engineering material specifications. The camera direction is not a Leica collaboration, logo treatment or product replica.

## Concept selection

The set separates warm/aged from cool/precise, cast from machined, wrapped from solid, and central from separate transport. Considered but not developed: a titanium version too close to the stainless study, and a stone/ceramic object that added less to this particular raw-metal brief. Exactly four new variants were implemented.

### R–12 / Correspondent / `correspondent`

- **Source world:** a well-travelled black-painted camera.
- **Physical principle:** leather wrapping and brass visible where paint has worn away.
- **Digital translation:** stationary fine-grain leather casing, metal top cap, uneven brass wheel edge and a separate shutter-like key.
- **Signature:** a quiet black wheel whose rim has a warm, interrupted brass highlight.
- **Stationary / moving:** casing, top-cap seam and key stay fixed; index and finger well rotate with the disc.
- **Omitted:** maker logos, fake exposure values, strap stitching and ornamental camera controls.
- **Difference:** warmer and more material-led than Thumbprint; the leather wrap and aged edge carry the identity rather than a new gesture.
- **Risk:** texture can read as coarse reptile skin. Reduced the local texture tile to 42 CSS px after comparison review, so the grain remains subordinate.

### R–13 / Foundry / `foundry`

- **Source world:** a cast-bronze machine handwheel.
- **Physical principle:** thick curved arms, polished contact surfaces and darker patina inside recesses.
- **Digital translation:** three-arm SVG casting, oxidised-looking wells, fine casing grain and a central bronze transport key.
- **Signature:** a continuous heavy rim with three gently curved arms.
- **Stationary / moving:** casing/readout/key fixed; the casting and its recessed surface turn together.
- **Omitted:** meaningless pressure scales, fake fasteners and elaborate corrosion that obscures the control.
- **Difference:** more substantial and irregularly finished than Glacier's pale, light reel; it is a casting, not another translucent three-spoke colourway.
- **Risk:** warm metal behind light text. Darkened the casing and restrained grain brightness; this is a palette improvement, not a complete accessibility certification.

### R–14 / Inox / `inox`

- **Source world:** a brushed stainless instrument.
- **Physical principle:** a clean sheet-metal enclosure and a broad, precise machined face.
- **Digital translation:** restrained linear brushing, crisp bearing seams, one shallow thumb channel and a rectangular black transport key.
- **Signature:** the slanted recessed channel in an otherwise quiet steel disc.
- **Stationary / moving:** casing and key fixed; the brushed wheel surface/channel rotate.
- **Omitted:** oversized chrome bevels, unbound scales, screws on every corner and bright accent colours.
- **Difference:** Field reel's satin disc is softer and has a separate key; Inox is cooler, squared and closer to a precision appliance.
- **Risk:** repeated brushing can alias. Kept it low-contrast at a four-pixel period and reviewed desktop/phone rendering; physical high-DPI/Safari and performance review remain open.

### R–15 / Airframe / `airframe`

- **Source world:** an aircraft workshop's machined lightweight parts.
- **Physical principle:** material removed through six repeated lightening slots, with a retained central cap.
- **Digital translation:** self-contained six-slot SVG reel, pale anodised-looking casing, four stationary corner fasteners and a separate rust-orange transport key.
- **Signature:** six elongated milled apertures rather than spokes or a full grip scale.
- **Stationary / moving:** casing/fasteners/key fixed; slots, hub and its two small fasteners rotate together.
- **Omitted:** fictional airspeed readouts, aviation brand marks and excessive rivet decoration.
- **Difference:** more mechanically explicit than Glacier; the slots and squared enclosure communicate a subtractive construction.
- **Risk:** a small separate key. Its 36 px visible height has a 5 px extension on both sides on phones, giving a 46 px-high target; an actual click outside the visible top edge verified activation without scrubbing.

## Implementation

Metadata and the fourth collection divider are appended in `src/pages/JogLabPage.tsx`. New styles are appended after the original twelve face rules in `src/pages/jog-lab.css`. Local artwork:

- `src/assets/lab-leather.svg`: deterministic pebbled grain with a static, seeded noise overlay.
- `src/assets/lab-cast-grain.svg`: subtle, bounded cast-surface grain.
- `src/assets/lab-foundry.svg`: three curved arms, a continuous rim and recessed-looking patina.
- `src/assets/lab-airframe.svg`: six equal lightening slots and central cap details.

No new library, network asset, animation timer, interaction fork or backend call was introduced. The same shared JogControls and TransportReadout operate each design. Appearance is not persisted as a user setting.

## Actual verification

| Check | Result |
| --- | --- |
| First twelve definitions/styles | Compared with the frozen founding sources: original study metadata remains a prefix of the expanded array; the original CSS remains an unchanged file prefix |
| Shared controls and repaired Aperture | Byte-identical to the founding source capsule |
| Founding archive | All 17 preserved files still pass the integrity checker |
| Keyboard on all four | Home 0; ArrowRight 48; ArrowLeft 0; PageDown 480; End 2400; PageUp exercised |
| Speed on all four | Plus changes 0.86× → 0.91×; minus returns it; Airframe's keyboard-operated range changes 0.86× → 0.87× |
| Playback on all four | Play from the end restarts at the beginning, advances position to 12 in the check, and Pause stops it |
| Pointer on all four | Forward 310 → 411, reverse → 310; dragging state released normally |
| Decorative rotation off | On Correspondent, position advances while the rotor's computed transform remains unchanged |
| Phone layout | All four focused studies checked at 390 × 844 and 320 × 844; no page overflow and speed controls stay within viewport |
| Touch targets | At 320 px, Foundry centre key ~50 px and Inox ~54 px; separate keys have a 46 px-high expanded target. Airframe's expanded area was activated directly |
| Tablet compare | 834 × 1112: two columns; 1112 × 834: four columns; all 16 present and no horizontal page overflow |
| Gallery utilities | Focus/compare and reset exercised throughout; Correspondent shortlist toggles on/off correctly |
| Browser console | No warnings or errors recorded in the new preview tab |
| Client unit suite | 88 tests passed on this checkout |
| Production build | TypeScript/Vite pass; lab selectors and new lab artwork excluded from release output |

Temporary browser viewport overrides were reset. A normal 1280 × 720 comparison capture uses the shared demo/reset state: paused at 310/2400, speed 0.86×, decorative spin enabled. Final visual evidence and source hashes are saved with this note.

Not claimed: physical iPhone/iPad testing, multi-engine certification, OS reduced-motion emulation, screen-reader acceptance, full gradient contrast certification, explicit pointer-cancel testing or measured frame-rate/battery performance. Those remain release gates, not reasons to mislabel this working gallery as production-ready.

## Preservation and handoff

`comparison.png` is the fourth-row review capture; `correspondent-focus.png` shows the leather/brass detail. `source/` freezes this round's lab files/artwork; it is a reference capsule, not a standalone application. The manifest preserves hashes and states its parent baseline. Do not overwrite the 12 October archive or silently refresh this one when live code changes.

The Mac's LAN address changed from 192.168.1.13 to 192.168.1.17 during this round. The preview is currently `http://192.168.1.17:5173/lab/jog`; it is a local address, not a deployed public website. A future address change requires a new preview link, not changing product code.

All sixteen are retained; Orbit is still the preferred default candidate. No commit, GitHub push or public brand publication was performed. Further generation waits for the owner's next request.
