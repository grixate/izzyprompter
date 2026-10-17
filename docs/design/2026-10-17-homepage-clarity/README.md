# Homepage clarity and mobile preview

17 October 2026. Review candidate on `codex/homepage-clarity`, based on current `origin/main` (`7fc4310`). This branch does not include the separate remote skin library work.

## Changes

- Lead with “Add your script once. Read from any screen.” Explain browser prompting, phone control, synchronized scripts, and no file transfers or app installs.
- Clarify the steps below the editor: add the script here, open the display, and scan the session QR with the phone. Joining the same session is still required; opening the website on a second device alone does not find a guest script.
- Match the preview cue to the actual display at 42% height. Scale the script's top and bottom padding with the preview height rather than retaining a fixed 42 px offset.
- On screens up to 650 px wide, center the reading screen and remote in one 300 px column, shrinking to available space on the narrowest screens. Both objects share a width and a 20 px gap. The wheel retains its existing usable size; the transport readout fills the wider remote.
- Preserve the existing separate, staggered desktop objects and all actual session and remote behavior.

## Verification

- `npm run build`: passed.
- `npm run test:unit`: 88 passed.
- `npx playwright test test/e2e/entry-preview.spec.ts test/e2e/input-recovery.spec.ts`: 34 passed, 2 intentionally skipped (native clipboard permission automation is Chromium-only; portable paste coverage passed in all three engines).
- The responsive regression covers 320, 390, 650, 651, 768, 1280, and 1600 px in Chromium, Firefox and WebKit: cue position, script padding, equal mobile widths/alignment, separate desktop objects, no horizontal overflow, and contained controls.
- Existing playback, wheel, speed, reduced-motion, draft persistence, paste/import/drop, and recovery scenarios passed.
- In-app browser visual review at desktop and 390 px mobile. Screenshots show synthetic sample text only.
- Physical iPhone/iPad/Android checks have not run. GitHub job results must be checked separately. No staging or production deployment was performed.

## Screenshots

- [Desktop](desktop.jpg)
- [Mobile entry](mobile-entry.jpg)
- [Mobile paired preview](mobile-preview.jpg)
