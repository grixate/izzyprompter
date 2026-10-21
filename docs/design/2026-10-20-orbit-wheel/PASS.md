# Orbit — wheel-first trial / 20 October 2026

[Live comparison](review.html) · [Standalone trial](live/index.html?skin=ivory)

An isolated prototype for Orbit only. The app sources, remaining skins and previous frozen gallery are unchanged. Shared React controls are built with one additional CSS file, `orbit-wheel.css`, for portrait viewports at least620px high; smaller/landscape viewports retain the prior layout. This is a first composition trial, not the finished14-skin implementation.

The wheel fills most of the width. Time/header are quieter, speed occupies a shallow auxiliary row, and phrase/edit/appearance actions share the bottom strip. Input semantics, touch targets, speed bounds and editor remain shared.

Actual Chromium and WebKit checks passed at428×746,390×660 and428×926: no main overflow, targets at least48px, Play/Pause, Next, keyboard jog, exact speed entry and editor focus/Done. At428×746 the wheel grows from230.9px to378.2px (88% of viewport width); at390×660 from244.7px to320px. Results are in `checks.json`. The prototype Vite build passed. Full client unit/build and paired-session suites were not repeated because product sources are unchanged. No physical-device/keyboard certification, hosted publication, commit or push.

`orbit.png` records the trial after interaction, not its initial demo state. Before references the preserved touch-layout demo. Build with `node docs/design/2026-10-20-orbit-wheel/build-review.mjs` from the repository root.
