# IZZY local / offline preview

Date: 2026-10-12. First implementation slice; opt-in at `/local`. Hosted prompting still uses Phoenix. Standalone prompting is covered by browser-engine automation; native paired connectivity and physical mobile acceptance remain open.

## Try standalone prompting

For offline preparation, use a production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4187 --strictPort
```

Open `http://127.0.0.1:4187/local`. This is a separate browser origin from the development/account previews, with separate storage. The bundled Phoenix release also serves `/local`; offline preparation on actual phones/tablets requires trusted HTTPS. Private-IP HTTP development links cannot prepare a service worker. `npm run dev` supports local prompting in an open tab but does not register the offline worker.

1. Paste/import TXT or MD, or explicitly copy the current guest editor draft from the same origin.
2. Choose **Save script offline**, then **Prepare app offline**. These verify document persistence and app caching separately. The local library holds up to 20 scripts, each at most 2 MB and 5,000 paragraphs.
3. Choose **Start local prompting**. Play/pause, speed, jogging, paragraph navigation, typography and mirroring use the reading device's controller and monotonic clock. Open the display settings for touch speed/navigation controls; keyboard shortcuts also work. No API, account discovery or Phoenix connection is needed.
4. Use **Back to local scripts** to edit, or export a text backup. Accepted text, settings and semantic reading position save locally; unsaved editor changes have a separate recoverable draft.
5. Test preparation in the exact browser/install context you intend to use: disconnect internet, close the tab, reopen `/local`, select the saved script and start. Reload/suspension resumes paused with a fresh session identity.

Storage can be denied, cleared or evicted. A failed save keeps in-memory text and exposes retry/export; do not close that tab before preserving the text. Local copies do not automatically save to an account. Export contains text, not typography or peer credentials. Browser tabs and Home Screen installations need separate verification.

## Experimental direct remote

Both browsers must load a trusted HTTPS origin (or loopback for same-computer tests) and have a reachable peer network. Prepare the app on both devices before removing internet. The reading device does not serve the website to a never-prepared phone.

1. Start a local take, choose **Pair remote preview**, then **Create pairing offer**.
2. Open `/local/remote` on the phone. Import/paste the offer and choose **Create pairing answer**.
3. Return the answer file/text to the reading device and choose **Accept remote answer**. Controls enable after authentication and snapshot transfer.

File/text transfer is deliberately manual in this feasibility preview; it requires an independent transfer method available on those devices. There is no in-app scanner or automatic discovery. Pairing material grants control of the take; share it only with your device. It expires during setup, and a new offer invalidates the previous connection. Network changes require fresh material.

The adapter uses a reliable ordered WebRTC DataChannel with no external ICE servers, signaling requests, STUN or TURN. The reading-device controller orders commands and owns Quick Edit revisions. Snapshots are chunked and bounded; command acknowledgments follow state transfer. Measured checkpoints belong to the display. On peer loss, missing heartbeats or browser suspension, the paired take pauses and requires fresh pairing; `navigator.onLine` does not decide peer health. Display controls remain available for deliberate standalone continuation.

Native connection tests on this Mac stalled in ICE checking while exposing only a VPN host candidate. No VPN/network configuration was changed. Deterministic protocol tests prove message behavior, not native ICE reachability. Keep this path experimental until native LAN and physical no-uplink iPad/iPhone/Android tests pass. Isolated Wi-Fi, VPNs and hotspot topology may prevent connections; the hosted workflow is available separately online.

Pending: online rendezvous, automatic path selection, host-routed Phoenix relay/handoff, QR scanner, account synchronization/conflicts, physical lifecycle tests and latency/server-resource measurements. The current hosted session channel cannot act as a transparent fallback for a locally owned take.

## Implementation and checks

- `src/local/controller.ts`: local authority, semantic navigation/checkpoints, exclusive revision-checked Quick Edit, suspension.
- `src/realtime/controller.ts`: shared UI contract; existing display, renderer and remote reused by hosted/local adapters.
- `src/local/peer.ts`: separately versioned experimental direct protocol; fresh capability per pairing, bounds, flow control and heartbeat loss handling.
- `src/local/store.ts`, `editorDraft.ts`: prepared IndexedDB records and separate recoverable editor draft.
- `scripts/offlinePlugin.ts`: build-specific cache of app assets and only `/local`/`/local/remote` navigation. Account/API responses are not cached. No forced worker activation under an active take; close all IZZY tabs to activate a waiting build.

```sh
npm run test:unit
npm run test:offline
npm run test:release
# Native network gate, requires reachable host candidates:
IZZY_TEST_NATIVE_PEER=1 npx playwright test --config playwright.local.config.ts
```

Verified: 88 client unit tests; 6 standalone offline/recovery cases across Chromium/Firefox/WebKit; 33 shared hosted display/remote/Quick Edit regressions across those engines; 2 real bundled production/LAN release smokes, including cold offline startup under Phoenix headers. Three native peer cases are intentionally opt-in and skipped by the default offline suite. Phoenix guest suite: 90 passed, 54 database cases excluded; no database/account acceptance is implied by this slice.

Browser-engine automation is not physical Safari/iOS, Home Screen, no-uplink router or hotspot acceptance. App-update transitions and performance/capacity comparisons still need dedicated evidence. No public deployment, dependency addition, commit or push was performed.
