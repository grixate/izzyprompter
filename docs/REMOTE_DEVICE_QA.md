# Remote Session v2 — physical-device acceptance

Status update: 2026-10-12. **Physical phone/tablet checks have not run.** The owner has reopened local communication implementation; use the additional [local preview checklist](LOCAL_PREVIEW.md) and [acceptance matrix](LOCAL_COMMUNICATION_PLAN.md#required-acceptance-matrix). The hosted v2 matrix below remains separately unverified.

Automated Chromium tests cover network loss, simulated visibility/freeze/BFCache events, fresh-snapshot recovery, and a real isolated Phoenix process restart. They do not demonstrate operating-system lock/unlock, browser eviction, real Wi-Fi changes, or laptop sleep.

Local preview automation now covers standalone cold offline startup/recovery in Chromium, Firefox and WebKit. The native direct spike on the development Mac stalled in ICE checking with a VPN host candidate; no physical peer result or no-uplink pairing pass is claimed. Preserve this failure and record actual device/OS/browser/topology before closing the direct gate. Deterministic fake-RTC protocol tests are separate evidence.

## Setup

1. Keep the computer and phone on the same reachable, trusted LAN. Open the computer's Network URL on port 5173, not localhost on the phone.
   For the bundled LAN variant, prepare `npm run build:local` beforehand, then use `npm run local` and its printed network URL (default 4174). Do not rebuild or download dependencies during the internet-disconnected run. The launcher is not an OS installer; Node.js is still required.
2. Paste a multi-paragraph script long enough for at least two minutes of reading. Start a new session and open the display.
3. Scan the complete remote QR link. Check that the phone shows CONNECTED and DSP 01 READY.
4. Record device model, OS version, browser/version, computer/browser, host URL, and date. Do not record or share capability fragments, script contents, or real client material in test reports.
5. Repeat the matrix on iOS Safari and Android Chrome. Public HTTPS hosting is not covered by this LAN matrix.

## Matrix

| Scenario | Steps | Expected result | Physical result |
| --- | --- | --- | --- |
| Short lock | Play; lock the phone for 30 seconds; change speed and pause from the computer; unlock | Display continues while phone is locked. Phone returns to the same session with current speed and HOLD, no new QR | Not run |
| Long lock | Play; lock for 2–5 minutes; unlock | If the page survives, it rejoins the live session. If the browser reloads it, the complete URL still joins. No delayed wheel motion or duplicate command | Not run |
| Switch apps | Leave the remote for another app for 30 seconds; change playback on the computer; return | Controls remain unavailable until a fresh snapshot; current playback and position return | Not run |
| Interrupted gesture | Start turning the wheel, then lock/switch apps before finishing; return | No stuck dragging and no buffered seek burst on return; a new drag works | Not run |
| Phone network off/on | Disable phone Wi-Fi for 15 seconds, then reconnect to the same LAN | Display keeps moving. Phone reports loss when detected, cannot issue effective commands offline, then rejoins without QR | Not run |
| Unreachable network | Switch the phone to a network that cannot reach the LAN computer, then return | It stays disconnected on the unreachable network. LAN mode does not promise access over cellular. Returning to the reachable LAN restores the live session | Not run |
| Laptop sleep | Sleep the host computer for 30 seconds while the phone is open; wake it | No claim of playback while the host/display is asleep. If the server process survives, reconnect uses the same session and current clock; observe reading jumps and record them | Not run |
| Server restart | Save the draft; stop/restart the app while devices are paired | Old session ends explicitly. Editor retains the draft. Creating a new session produces new pairing links; old QR does not create an empty session | Automated process check passed; physical not run |
| LAN without internet | Keep Wi-Fi/LAN connected, disable only the router's internet uplink; create a fresh session and pair | Local page, QR, play, wheel, speed, and navigation work without the internet uplink while the local app is running | Not run |
| Reflow and takeover | Change display font/width while paused; optionally connect a differently sized backup display and close the primary | Phone position follows the primary's measurements. Backup takes over near the same reading word; no competing position reports | Automated Chromium check passed; physical not run |
| Quick Edit live typing | Play; open Quick Edit on the phone; type a correction using the real keyboard/IME; inspect display, computer pairing page, and a second remote before Done | Playback pauses at the measured paragraph. All connected surfaces update while typing; no premature IME fragment; dialog remains usable with the keyboard open; Done closes and stays paused | Automated Chromium check passed except physical keyboard/IME; physical not run |
| Quick Edit interrupted | While editing, disable Wi-Fi or switch apps; type unsent text where possible; restore/reload; explicitly resume | Unsent draft is kept. Reconnection alone never replays it. Another phone's newer correction is protected. Copy/Use live text recovery is usable on the real phone | Automated Chromium offline/conflict check passed; physical not run |

Observe reconnection latency rather than assuming instantaneous failure detection. Silent network loss may first be noticed by a socket heartbeat or a command timeout. Controls must not replay old gestures after recovery. If the session is gone, recovery is explicit; there is no durable server-session restoration yet.

## Result record

For each run record: scenario, device/browser, pass/fail, time until loss was shown, time until CONNECTED returned, whether QR was needed, whether text moved unexpectedly, and a brief reproduction using synthetic text. Attach a screenshot/video only if it contains no sensitive script or pairing key.

Milestone 3 and Quick Edit remain pending physical acceptance until this matrix has results. Passing browser emulation alone does not close mobile reliability acceptance.
