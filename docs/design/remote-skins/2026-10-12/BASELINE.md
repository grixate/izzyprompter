# Founding remote collection — preserved baseline

Captured 12 October 2026. Twelve interactive studies, three collections; Aperture includes the corrected six-segment geometry. Orbit is the preferred default candidate; the owner especially praised Vector. No production skin/default change or payment activation is part of this baseline.

## Contents

- `collection-01.png`: the first four studies, preserved from the original comparison capture.
- `collection-02.png`: Signal, Groove, Glacier and Bakelite, preserved from their comparison capture.
- `collection-03.png`: a fresh final-round comparison after the Aperture repair.
- `aperture-corrected.png`: focused repaired Aperture, preserved from the repair handoff.
- `source/`: frozen source files relevant to rendering and operating these studies, including the dependency manifest/lockfile. These copies are evidence, not code to edit or a complete app checkout.
- `manifest.json`: SHA-256/byte counts for the images and frozen source files, plus capture facts and live-file comparisons at archive time.

The source capsule includes the lab page/styles/artwork, shared controls, global styles, keyboard/motion helpers and route entry. It deliberately omits unrelated application modules, backend code, credentials, live session URLs and unlicensed platform fonts. Rebuilding still requires the complete corresponding IZZY checkout. A recorded Git HEAD describes the base commit; the working tree was dirty and the lab files were uncommitted. It is not an immutable release identifier for this design.

## Capture facts and limits

The fresh collection-03 comparison was captured at a 1280 × 720 CSS-pixel viewport with device pixel ratio 2 and reduced motion disabled, in the Codex in-app browser on this Mac. All studies were reset: paused, demo position 310/2400, speed 0.86×. The computed font stacks included Avenir Next Condensed for model labels and SFMono-Regular/Consolas/monospace for the readout. Exact browser build/zoom and original capture metadata for the older images were not recorded; do not infer them from this capture.

Images are visible-viewport review evidence, not full-length page exports. The first collection and second collection were captured before the later rounds were appended. The old, visibly uneven Aperture artwork remains only in historical working previews; use `aperture-corrected.png` and the fresh `collection-03.png` as the canonical visual targets here.

Past code checks and their limitations are in [the lab record](../../../JOG_WHEEL_LAB.md). Archiving this baseline adds no new physical-device or accessibility certification. The current task changed documentation, the reusable skill and archive files only.

## Preserve, do not silently refresh

Do not update these baseline images or frozen sources when the live implementation changes. Make a new dated/revision archive for an intentional correction or a later collection, then identify the latest canonical version in the playbook. Hashes detect edits but are not backups by themselves.

The repository now contains these files outside ignored `artifacts/`, ready for version control. They are saved locally; no commit or GitHub push was performed by this documentation task.

To verify the archived files without comparing them to evolving live source, run from the repository:

```sh
node .agents/skills/izzy-remote-design/scripts/verify-baseline.mjs docs/design/remote-skins/2026-10-12
```

Do not regenerate hashes merely to clear a mismatch. Investigate whether the archive was edited or a new revision needs its own directory.
