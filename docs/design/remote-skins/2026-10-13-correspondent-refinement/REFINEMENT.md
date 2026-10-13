# Correspondent — single wheel cue

13 October 2026 · Narrow refinement of R–12 / `correspondent`

The owner noted that the wheel had both a thin index line and a recessed dot. Retain the recessed finger well and remove the line: the well carries the tactile, camera-like character without duplicating the directional cue. This is a decision for Correspondent, not a rule to remove useful indices or scales from other designs.

Implementation: remove only `.lab-device--correspondent .wheel-disc::before` from the live lab CSS. The finger-well `::after`, brass rim, leather, transport placement and shared controls remain unchanged. Keep the R–12 ID. No other face, production remote or default preference changes.

The original [Material memory capsule](../2026-10-13-material-memory/COLLECTION.md) remains preserved with its historical two-cue design. This note and `correspondent-single-cue.png` describe the latest visual target; do not overwrite or re-hash the original capsule to disguise the correction.

Verification: browser computed style confirms the removed pseudo-element has `content: none`, with the finger well still present. Pointer scrubbing moves 310 → 418 → 310; Play/Pause work and the line remains absent while rotating. The current face stylesheet equals its original Material memory snapshot with only that single rule removed. Production build and 88 client tests pass; the original nine-file material archive still verifies. No new physical-device, screen-reader or full accessibility certification is claimed for this CSS-only refinement.
