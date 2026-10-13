# IZZY entry workbench — design QA

Date: 2026-10-09

final result: passed

## Scope and visual truth

Implement the approved text-first entry concept, extended by the user's request for a long, running preview with a working scrub control. Preserve the established reading screen and industrial remote. No authentication backend, deployment, or pairing redesign is included.

Source visual truth: `/Users/grixate/.codex/generated_images/01a11812-0eeb-7c20-b9ab-517175613d25/exec-b764bb93-a0f2-4762-98fd-7143d90b3d6a.png`.

Implementation: `http://192.168.1.13:5173/`.

Evidence directory: `/tmp/izzy-live-preview-GjfWwC/`.

- Source pixels: 1672 × 941. The raster mock has no declared CSS viewport or device density. Its near-16:9 frame was normalized to 1280 × 720 for comparison: `00-source-normalized.png`.
- Implementation CSS viewport: 1280 × 720. Final browser devicePixelRatio: 2; the browser screenshot API exports at 1280 × 720 pixels, already normalized to CSS size. Final implementation screenshot: `12-desktop-final.jpg`.
- Comparison state: empty editor, sample at position zero, 0.86×, paused, no account. Pausing makes the comparison repeatable; the actual initial sample auto-plays unless reduced motion is requested.
- Full-view source and implementation were opened together in the same comparison input. The final pair is `00-source-normalized.png` and `12-desktop-final.jpg`.
- Focused controls pair: `13-source-controls.png` / `14-implementation-controls.jpg`, both 400 × 640, cropped from corresponding reading-preview/remote regions.
- Focused editor pair: `15-source-editor.png` / `16-implementation-editor.jpg`, both 800 × 480. The implementation crop cuts the last part of Import text because its writing region is wider; the full-view capture confirms the complete utility is visible. This is a crop limitation, not UI clipping.

## Findings and comparison history

No actionable P0/P1/P2 findings remain in the reviewed scope.

1. **P2 — initial desktop composition overflowed.** `01-desktop-initial.jpg` showed the setup action and remote controls extending below the 720px frame, and a narrow preview region. The preview column grew from 350px to 400px; inherited setup-button minimum width/height were explicitly reset; remote padding and vertical rhythm were tightened. Post-fix evidence: `02-desktop-refined.jpg` and `11-desktop-final.jpg`.
2. **P2 — oversized editor on a tall tablet.** `06-tablet.jpg` showed the blank editor consuming most of the screen and pushing setup far below the remote. Its maximum height is now 420px. Post-fix evidence: `10-tablet-final.jpg` at 834 × 1112.
3. **P2 — supporting typography was too quiet relative to the selected mock.** The source/implementation comparison showed undersized explanatory text. The main supporting sentence increased from 14px to 17px; editor helper and preview caption increased to 13px and 12px. Post-fix evidence: `11-desktop-final.jpg` and the final full/focused pairs.
4. **P2 — dial scale and above-the-fold fit needed a final balance pass.** `11-desktop-final.jpg` still had a smaller dial than the target and a 4px vertical overflow. The dial increased from 192px to 208px while surrounding spacing decreased. `12-desktop-final.jpg` confirms a 1280 × 720 main frame with scrollHeight 720, all controls visible, and the caption ending at approximately y705.

The final full-view and focused comparison was performed after these changes. No further visual fixes followed that comparison.

## Required fidelity surfaces

- **Fonts and typography:** Uses the existing product families: Avenir Next Condensed for the two-line statement, Avenir Next for writing/reading text, and SFMono/Consolas for instrument labels. The headline retains the mock's condensed, heavy hierarchy and desktop wrapping. Reading text deliberately uses the real prompter's stronger weight, rather than the raster mock's lighter sample. Labels, numeric alignment, wrapping, and ellipsis were inspected in full and focused captures. Mobile headline wrapping changes naturally at 320px; no clipping occurs.
- **Spacing and layout rhythm:** Header navigation, hairline split, bordered writing field, right-aligned setup action, OLED, centered dial, and speed control below the dial preserve the chosen composition. The desktop split is approximately 69/31, a modest adjustment from the mock for usable writing space. The taller reading preview is intentional. Phone screens stack writing/setup before the preview; the entire preview remains reachable by vertical scrolling. The 208px desktop dial and 218px phone dial are visually balanced against their panels.
- **Colors and tokens:** Retains paper `#d9dad6`, ink `#171816`, graphite `#252623`, orange `#ff5b22`, and the established signal-green focus treatment. The entry uses flat silver and restrained borders rather than reproducing raster lighting or heavy bevels. Disabled setup is visibly inactive; enabled setup is dark with strong text contrast. Dark preview surfaces and orange reading guide match the real display.
- **Image quality and asset fidelity:** No product photograph, decorative illustration, or logo image from the selected mock was substituted. The mock depicts application UI: its instrument is implemented using the actual shared remote controls and the actual shared reading surface, as requested, not a static screenshot or invented illustration. Existing Lucide icons and the established product wordmark are reused. Borders, dial edges, focus guide, icons, and OLED were inspected in focused captures; any JPEG softness belongs to the captured evidence, not a raster UI implementation.
- **Copy and content:** Keeps the approved screen/phone explanation, a single primary setup action, import as a quiet utility, and login in navigation. Sample text is a separate 12-paragraph, 400+ word script. Entering a draft switches the preview to the user's words and pauses motion. File constraints, save feedback, reset confirmation, connection failures, and pairing guidance remain available. Login explicitly says saved profiles are not implemented; no fake account form is present. The live-corrections caption refers to the real paired remote, not an editing feature inside the miniature preview.

## Interaction and responsive verification

Verified through the in-app browser:

- Initial sample playback; Pause and Play; a pointer drag moving the preview about 146px; keyboard Home and ArrowRight moving it to 0 and 48px; speed changing from 0.86× to 0.91×.
- Preview controls leave the editor empty. Editing switches to the user's script and pauses playback. Immediate refresh restores a synthetic 14-paragraph draft.
- Native profile dialog, explanatory copy, Escape dismissal, and focus restoration to Log in.
- Desktop 1280 × 720; tablet 834 × 1112; phone 390 × 844; narrow phone 320 × 720. Document scrollWidth equals viewport width at tested phone sizes. Primary setup is before the preview in reading and visual order. Speed controls and dial remain within the panel.
- Final phone evidence: `19-phone-entry-final.jpg` and `20-phone-preview-final.jpg`. Narrow-phone evidence: `17-narrow-phone.jpg` and `18-narrow-phone-controls.jpg`.
- A separate test origin (`127.0.0.1:5175`) protected the user's existing draft and session. A synthetic paired session was created; real remote Play/Pause, speed adjustment, keyboard seek, and a live paragraph correction reached the real display. Evidence: `07-own-script.jpg`, `08-real-display.jpg`, `09-real-remote.jpg`.
- Browser warning/error logs were empty for entry, isolated editor, display, and remote during these checks.
- Temporary test tabs and the test-only server were closed; viewport override was reset. The existing user remote tab was not operated on.

## Verification and remaining gaps

- `npm test`: 77 frontend unit tests passed, production build passed, 77 Elixir tests passed.
- `git diff --check`: passed.
- Added four preview unit cases and five browser regression scenarios. Existing setup selectors were updated to the new user-facing label.
- Browser regression specifications were **not run through the Playwright CLI**. Interaction verification above used the in-app browser. Full Chromium/Firefox/WebKit automation remains a separate verification step requiring approval under the Product Design browser policy.
- Reduced-motion startup, visibility suspension, and offscreen suspension are implemented; reduced-motion has a browser regression specification, but media emulation and full background lifecycle testing were not executed in this run. No claim of cross-browser/device certification is made.
- Login/profile functionality remains intentionally unavailable. This handoff implements its navigation placement and honest unavailable state only.

## Implementation checklist

- [x] Text-first workbench and single setup action.
- [x] Long, independent sample with actual scrub/play/speed controls.
- [x] Shared real remote and reading-surface components.
- [x] Own-script preview and pause-on-edit behavior.
- [x] Draft preservation and existing pairing/live-edit flow.
- [x] Responsive visual comparison and browser checks.
- [x] Frontend/backend tests and production build.
- [ ] Real login and saved profiles — outside this task.
- [ ] Full multi-engine browser regression run — not claimed as completed.

Follow-up polish: a larger-viewport instrument could use slightly more breathing room; the existing 1440px breakpoint already increases the dial to 222px. This is not a blocking issue at reviewed sizes.
