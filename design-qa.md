# Design QA

## Source visual truth

- `/Users/grixate/Downloads/teenage-engineering-tp-7_1_SYN0008702-000.webp` — 1600 × 1600 px. Used for the cool machined finish, restrained labeling, recessed display, large wheel hierarchy, tight seams, bottom key bank, and limited orange accents.
- `/Users/grixate/Downloads/U-D100_02.webp` — 675 × 676 px. Used for the dark monolithic body, matte texture, subtle edge highlights, and dominant jog wheel.
- `/Users/grixate/Desktop/Screenshot 2026-10-08 at 16.50.45.png` — 120 × 276 px focused issue capture. Used as the exact visual target for correcting the wheel index marker overlap.
- `/var/folders/6_/_w9p3ldd2y35d4fd05wrzny00000gn/T/TemporaryItems/NSIRD_screencaptureui_CQix7a/Screenshot 2026-10-08 at 17.09.42.png` — focused follow-up capture showing that the corrected marker still implied an unnecessary absolute index.
- `/var/folders/6_/_w9p3ldd2y35d4fd05wrzny00000gn/T/TemporaryItems/NSIRD_screencaptureui_KgHymy/Screenshot 2026-10-08 at 17.10.52.png` — focused speed-control capture used to evaluate spacing and unnecessary scale ticks.

The references are photographs of physical products, not UI layouts. The implementation intentionally borrows their material and control principles without reproducing either product's exact geometry, branding, or trade dress.

## Implementation evidence

- Full-view implementation capture: `browser-capture://iab/tab-8`, route `http://192.168.1.13:5173/remote/9LFX3J`, 511 × 806 px/CSS viewport at device scale 1.
- Pairing implementation capture: `browser-capture://iab/tab-12`, route `http://192.168.1.13:5173/`, 1280 × 720 px/CSS viewport at device scale 1.
- Responsive evidence: the remote capture is a narrow phone-like viewport; the pairing view was also checked against its existing portrait breakpoint rules.
- Focused regions checked: recessed OLED/status display, centered wheel and center transport button, horizontal speed control, bottom phrase key bank, inset phrase monitor, QR surround, session identifier, and flat action row.
- State during final comparison: remote connected and paused (`HOLD`), speed 0.86×, phrase 02/18; pairing page connected with display and remote waiting.

## Density normalization

The 1600 × 1600 and 675 × 676 reference images were fit inside 1280 × 720 browser captures. The implementation was judged by normalized proportions and hierarchy rather than raw pixel dimensions: wheel dominance, control spacing, material contrast, label density, edge treatment, and accent restraint. Browser chrome and the physical-product backgrounds were excluded from fidelity judgments.

## Comparison history

### Pass 1

- P2: the remote wheel felt under-dominant compared with both references, weakening the physical-controller hierarchy.
- Fix: enlarged the wheel across desktop, portrait, and short-portrait breakpoints while preserving clearance for the OLED, speed rail, and phrase controls.

### Post-fix pass

- The wheel now occupies the primary visual and interaction zone, with a clearer center button and more credible surrounding hardware proportions.
- The graphite body, precision seams, orange speed rail, silver control center, recessed OLED, and bottom key bank read as one coherent instrument.
- No P0, P1, or P2 visual defects remain.

### Refinement pass 2

- P2: the vertical speed rail pulled the wheel off-axis and made the principal interaction feel smaller than the physical references.
- P2: the pairing screen stacked inset borders, raised button gradients, and drop shadows, creating an over-beveled appearance inconsistent with the otherwise restrained system.
- P3: the orange line preceding `JOG / SCRUB` looked decorative rather than functional.
- Fix: changed the control deck to a centered vertical composition, increased the wheel within balanced viewport limits, and rebuilt speed as a horizontal control directly beneath it.
- Fix: removed the decorative line and retained only the wheel's functional orange position marker and speed fill.
- Fix: flattened the pairing screen into a solid aluminum plane with a single hairline QR frame, rule-based session label, and low-relief action tiles.

### Refinement pass 2 — post-fix evidence

- The final same-input comparison included both physical references, the 511 × 806 remote capture, and the 1280 × 720 pairing capture.
- The wheel is visibly centered and dominant without crowding the OLED or bottom key bank; speed now reads as a subordinate adjustment.
- The pairing screen now uses one consistent depth level. QR, copy, and actions remain distinct through spacing and hairlines rather than bevel stacking.
- No actionable P0, P1, or P2 findings remain.

### Refinement pass 3 — wheel marker

- P2: the orange wheel index began halfway through the surrounding tick ring and extended across the inner-disc boundary, making it look like a floating bar rather than a seated index mark.
- Fix: moved the marker outward from 7.8% to 5.2%, reduced its width from 5px to 4px, changed its height to 6.2% of the wheel, and replaced the broad glow with a restrained inset highlight.
- Post-fix evidence: the focused source capture and revised browser-rendered remote were placed in the same comparison input. The orange marker now aligns with the gray tick band and terminates before the inner disc with a visible dark separation.
- No actionable P0, P1, or P2 findings remain.

### Refinement pass 4 — remove false index

- P2: the geometrically corrected orange marker still communicated an absolute home position, but the control is an infinite relative jog wheel with no meaningful zero point.
- Fix: removed the marker entirely. The uninterrupted radial ticks now provide motion texture, the OLED reports absolute position, and the wheel's existing drag-brightness response supplies interaction feedback.
- Post-fix evidence: browser-rendered capture of session `MFQFGW` shows a clean, continuous tick ring with no false index or inner-disc collision; no console errors were present.
- No actionable P0, P1, or P2 findings remain.

### Refinement pass 5 — simplify secondary controls

- P2: the speed control sat too close to the wheel and its dense tick scale implied precision not needed for a control already backed by a numeric value.
- P2: the `NOW READING` paragraph duplicated the prompter display, consumed vertical space, and could become misleading because the remote only approximated the active paragraph rather than the exact visible sentence.
- Fix: increased the wheel-to-speed gap from 12px to 26px at phone width, removed speed scale ticks while preserving the accessible slider, fill line, +/- controls, and numeric readout, and removed the paragraph preview.
- Post-fix evidence: browser-rendered session `MFQFGW` shows a distinct secondary speed zone, a clean continuous rail, and a simplified lower section containing only phrase navigation. Speed +/- interaction was retested from 0.86× to 0.91× and back; no console errors were present.
- No actionable P0, P1, or P2 findings remain.

## Required surfaces

- Typography: compact technical labels and tabular numerals are consistent; primary reading text remains highly legible.
- Spacing and layout: the wheel is centered on the device axis, the speed control is subordinate beneath it, and the pairing composition uses clear flat planes and generous negative space.
- Colors and tokens: cool aluminum, graphite, orange, signal green, and restrained neutrals are consistently tokenized.
- Image quality and assets: source photos are used only as references and are not embedded in the product. Existing code-native icons remain crisp at all tested sizes.
- Copy and content: transport and status labels are terse, consistent, and appropriate to a dedicated device.
- Interaction: QR pairing, phone-to-display Play/Pause, phrase navigation, live position updates, and the revised speed +/- controls were exercised successfully; the speed display moved from 0.86× to 0.91× and back.
- Console: no browser errors observed during the final interaction pass; only Vite hot-update debug entries were present.
- Build verification: Vite/TypeScript production build passed; Phoenix test suite passed with 3 tests and 0 failures.

## Final result

passed
