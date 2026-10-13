# Recovery and keyboard access — Slice 5.5

The established graphite/orange industrial interface is preserved. This slice changes recovery behaviour and input semantics, not the product layout.

## Honest local recovery

- A failed editor draft write shows **LOCAL SAVE UNAVAILABLE**. Prompting and session creation remain available; the text is only guaranteed in the current tab until saving succeeds.
- **Retry local save** attempts the current draft again. **Download script** exports plain UTF-8 text without pairing credentials. Downloads are explicit user actions, not automatic backups.
- Quick Edit distinguishes acknowledged live text from unsent text. If local persistence fails for an unsent correction, it offers retry, copy, and a paragraph download. Closing the dialog retains the in-memory draft, but refreshing or closing the browser tab can lose it.
- Clipboard success is reported only after a successful operation. A refused pairing-link copy exposes the complete selectable link; a refused paragraph copy selects the text and explains manual copying.
- Network interruptions expose an explicit reconnect action. Controls stay disabled until fresh session state arrives; rejected/offline gestures are not queued for replay.
- Ended/invalid sessions use a native modal recovery dialog. Returning from the editor's pairing screen preserves its current in-memory script without reloading the page, including when browser storage is unavailable. Returning from another device cannot recover an editor draft that was never stored on that device.

Browser storage is not a durable backup or cloud sync. The live server remains ephemeral; automatic session reconstruction after a server restart is still out of scope.

## Keyboard behaviour

| Surface | Control | Keys |
| --- | --- | --- |
| Remote | Focused jog wheel | Arrows: small seek; Page Up/Down: coarse seek; Home/End: first/last script anchor |
| Remote | Separate center Play/Pause button | Enter or Space |
| Remote | Speed slider | Native range-control keys; speed stays within 0.50–1.50× |
| Display | Outside interactive controls | Space: play/pause; arrows: seek; +/−: speed; F: fullscreen |

The wheel slider and center button are siblings: the button is not hidden inside a slider's accessibility semantics. Focus indicators also cover links and text fields. Shortcuts do not hijack typing, settings, links, or modal dialogs. Display chrome remains visible while its controls have keyboard focus. Quick Edit returns focus to its invoker, or the wheel if that invoker is unavailable.

Native recovery dialogs trap focus and require an explicit recovery action. Fullscreen refusal is explained rather than producing an unhandled error. Reduced-motion preferences suppress decorative transitions/pulses, not the teleprompter's core scrolling behaviour. Continuous position changes do not create continuous live-region announcements.

## Verification boundaries

Browser automation covers keyboard seeking and playback, speed bounds, settings focus, fullscreen refusal, storage failure/retry/download, modal recovery without reload, clipboard refusal, and an unsent phone correction with unavailable storage. Slice 5.6 extends these scenarios from Chromium to Firefox and WebKit; see [browser coverage](CROSS_BROWSER.md) for deliberate platform differences. Existing multi-screen live-edit and reconnect tests remain required.

Screenshots of keyboard focus, the storage warning, and the ended-session dialog are visually checked during this slice. These checks are not a WCAG conformance claim. VoiceOver/NVDA, installed branded Safari/Chrome/Edge, physical touch keyboards, actual device sleep and disconnected-router acceptance remain unverified. Physical-device acceptance was explicitly deferred by the user; see [the device checklist](REMOTE_DEVICE_QA.md).
