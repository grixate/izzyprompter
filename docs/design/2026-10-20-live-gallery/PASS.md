# Live collection — 20 October 2026

[Open the interactive gallery](review.html). All 14 selected skins embed the preserved [touch-layout demo](../2026-10-20-touch-layout/PASS.md); app sources and previous galleries are unchanged.

Each independent iframe has an actual 428 CSS-pixel viewport. The modeled iPhone 13 Pro Max screen is 428 × 926; browser mode reserves 180 pixels for illustrative system/browser chrome, leaving 428 × 746 for the remote. These dimensions match the installed Playwright device preset. The shell is an approximation, not a claim of exact Safari chrome. Full-screen mode gives the remote 428 × 926. Gallery zoom and narrow-window fitting transform the whole device without changing the iframe viewport.

Controls work directly inside each card. Jump selection, per-card reset and standalone links make review easier. Frames load lazily; no account or paired session is required. The demo uses synthetic scripts only.

`node docs/design/2026-10-20-live-gallery/verify.mjs` passed for all 14 frames in Chromium and WebKit (28 interactive cases): fixed viewport/no overflow, Play/Pause with advancing position, Next, keyboard jog and pointer drag, exact speed, slider keyboard adjustment, editing and reset. Full-screen sizing, 75% zoom, narrow 390px parent sizing and jump navigation passed in both engines. No page errors were recorded. See [checks.json](checks.json) and [gallery.png](gallery.png).

No physical-device/soft-keyboard checks, app source changes, hosted publication, commit or push in this gallery-only pass. Client unit/build checks were not repeated for this HTML wrapper. The frozen remote's existing validation remains recorded in its own baseline.

The manifest preserves this gallery and records hashes of its referenced frozen dependencies. Previous manifests were not rewritten.
