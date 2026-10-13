# IZZY — computer-free offline field use

**Historical proposal; superseded on 2026-10-12 by [Direct communication and offline operation](LOCAL_COMMUNICATION_PLAN.md).** Implementation has started in the [local preview](LOCAL_PREVIEW.md); paired offline and physical-device acceptance remain open. The research below describes the earlier baseline; its previous deferral and delivery order are no longer current.

Date: 2026-10-11. Status: researched proposal; no offline browser implementation or physical-device acceptance is claimed.

## Product priority

The owner now prioritizes a complete free hosted release and field use without internet. Paid launch work is deferred; Prodamus is the probable future choice, not an instruction to activate or remove any adapter. The 2026-10-10 lava-first proposal is not the current delivery priority. Existing guest/free-account behavior and limits remain unchanged pending an explicit product decision.

This reopens computer-free offline design, previously parked in `OFFLINE_LAN.md`. Preserve the existing computer-hosted LAN package as an optional tool; it does not solve phone + tablet field use.

## What exists, and what does not

- React serves the editor, display and remote; Phoenix owns live session commands/documents. Keep this hosted path.
- `src/prompt/` already renders and animates locally and stores semantic reading checkpoints. An already-open display may keep moving from its last playing snapshot when disconnected; that is not a supported offline session.
- `DisplayPage` disables transport controls without a connected session, and `useSession` cannot create/order commands without Phoenix.
- Guest workspace storage and account-scoped IndexedDB pending edits exist. Pending edits are not a complete offline library: clean saved scripts are not retained there as a downloadable collection.
- There is no service-worker registration, offline app shell, install manifest, browser-to-browser transport or computer-free pairing implementation.
- `navigator.onLine` currently gates some connection/save paths. Do not reuse that flag as proof of cloud or peer reachability.
- The production Permissions Policy denies camera use. An in-app offline QR scanner would need a narrowly scoped policy change, not a global weakening of browser defenses.

## Separate three promises

1. **Prepared standalone prompting:** preload IZZY and a script on the reading device; later cold-open, edit, play, pause and scrub without internet, a computer or any network.
2. **Prepared two-device prompting:** preload IZZY on both devices; connect them over a reachable local network without internet; pair and use the existing remote design. This needs a new transport and physical feasibility checks.
3. **Two unrelated devices with all connectivity disabled:** not a supported browser-only remote scenario. Preloading or exchanging QR codes does not create an ongoing radio link. QR can exchange connection setup data, not continuously carry remote commands.

“No external Wi-Fi” can mean the devices supply their own hotspot, rather than joining a venue router. Treat that as a device-specific topology to verify, not a universal promise. Apple describes Personal Hotspot as a cellular sharing feature with carrier-plan requirements; this is not evidence that it will reliably supply an offline LAN when cellular service is absent. [Apple hotspot requirements](https://support.apple.com/en-gb/109321).

## Proposed user experience

### Prepare before leaving

Open the hosted HTTPS website on the intended device and choose **Make available offline** for the script. Retain the no-login guest path. Offer optional **Add to Home Screen**; this remains a website, not an App Store download.

Preparation commits the document, title, settings, stable paragraph IDs, revision/base information and reading checkpoint to device storage. Cache and validate the required application assets. Show **Available on this device** only after storage succeeds; distinguish app readiness from individual script readiness. Do not promise permanent availability.

For a phone remote, prepare its app shell separately. Offline startup must not depend on fresh login, account lookup, DNS, a CDN or `/api/sessions`. Normal browser tabs and Home Screen installations may use different storage contexts: prepare and test the exact context that will be used on location.

Offer plain-text export as a user-controlled backup. Request persistent storage where supported, but handle refusal, quota failure and clearing/eviction honestly. Browsers can evict best-effort website storage; installation alone is not a permanent backup. [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

### On location, one device

Open IZZY from its saved entry point, choose a prepared script and start a local session. Allow editing, typography, mirroring, speed, playback and scrubbing without a server. Save changes and position locally; restore paused after cold start or page suspension, without counting time away as reading progress.

Use the current prompt renderer and visual language. Do not put a copy of the entire industrial phone remote over the reading screen; preserve compact on-screen controls. Keyboard-style hardware clickers can be investigated separately with actual key mapping/device checks, not assumed to be generic Bluetooth browser support.

### On location, phone + tablet

Both devices must already have the app available offline. Join a tested hotspot or local access point with no internet uplink. The reading device hosts the local session logically; it does not run Phoenix or become an HTTP server.

Prototype a WebRTC DataChannel with local candidates and no external ICE servers. Exchange fresh offer/answer and gathered candidates on location through a two-way QR exchange; provide a bounded manual import fallback for the prototype. Ordinary hosted session-code QR links are insufficient because their server is unavailable. Do not prepare connection addresses at home and assume they survive network changes.

WebRTC defines direct host candidates and requires an application-chosen signaling exchange. QR signaling is a proposed implementation, not an already-verified mobile capability. [WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity).

Measure payload size and scan reliability: the complete negotiation may not fit a comfortably scannable single QR. Use bounded encoding and, if necessary, a tested multi-frame exchange rather than promising exactly two easy scans. Establishing a channel must not require microphone access; camera permission is only for explicitly requested scanning. Test current Safari local-candidate and permission behavior instead of depending on developer-menu bypasses or old browser claims.

After confirmed pairing, transfer the bounded script/settings snapshot over the channel, not inside the QR. Reuse the industrial remote with play/pause, speed, scrub and paragraph navigation. No cloud relay or secret internet dependency is acceptable for the claimed offline mode.

## Architecture boundaries

### App availability

- Add a manifest, icons and a versioned service-worker app shell. Precache all necessary bundled assets, not only HTML; supply offline navigation for explicitly supported local routes.
- Cache static resources only. Do not blindly cache `/api`, authentication, callbacks or private account responses. Store selected documents deliberately in IndexedDB with guest/account ownership metadata.
- Serve the worker at a suitable root scope through Phoenix with correct MIME/cache headers and explicit routes. Keep existing CSP; add narrowly scoped worker/manifest allowances as needed.
- Keep the active build coherent. Do not force-reload a take for an update or delete an old cache while open clients still need it. Upgrade offline data schemas without discarding drafts.
- Service workers need HTTPS, with localhost as a development exception. The current `http://192.168…` phone preview is not an adequate install/offline acceptance environment; use trusted local HTTPS or the eventual HTTPS staging host. [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

### Session authority

- Keep Phoenix authoritative for hosted sessions. Introduce a small session-controller boundary around command submission/snapshots rather than rewriting the application or creating a general multi-transport framework.
- Standalone mode uses a local TypeScript controller with document/transport revisions, input validation and bounded commands. Reuse existing domain types, stable paragraph IDs, semantic anchors and rendering helpers.
- Paired offline mode adds one remote to that same local controller. The display is the only ordering authority; the remote sends intents and receives acknowledged snapshots/reading updates. This V1 mode is not a mesh or team-editing system.
- Maintain an explicit mode and fresh session epoch. On cloud failure, preserve the last text/anchor and offer local takeover; do not silently create two authorities. Returning internet must not replay old gestures or let an old cloud snapshot overwrite the local take.
- On peer reconnection request a fresh snapshot, not queued play/scrub gestures. Proposed safe default: pause when the paired controller loses its heartbeat; preserve the anchor and allow explicit standalone continuation. Confirm this behavior in device trials before finalizing product copy.
- The offline document should remain editable. If remote Quick Edit is included, serialize it through the display controller with revision checks, edit ownership and anchor remapping; do not bypass the rules because transport is peer-to-peer. Gate paired-mode completeness separately if only transport controls are initially prototyped.
- Use a monotonic local playback clock. Background suspension, reload and font/layout changes must not jump to an extrapolated end position.
- Treat network hints as hints: distinguish cloud disconnected, peer connected and standalone. Probe the actual transport with bounded timeouts; `navigator.onLine` is not a reliable feature gate. [MDN onLine guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine).

### Persistence and later account synchronization

- Add a dedicated offline document collection; do not repurpose/overwrite the existing pending-edit journal. Retain base saved revision, document IDs, local mutations and settings separately from ephemeral playback.
- Store account documents under that account's device scope. Cached identity is not permission to call account APIs or proof of an active login. Reading a deliberately downloaded local copy must not require a network sign-in.
- Reauthenticate before upload, verify the same account, and reuse expected revisions/mutation IDs plus existing conflict choices. Never silently adopt another account's data or overwrite a newer server document.
- Resolve unsent changes and offer export before user-requested removal/logout cleanup. Do not share private offline copies with a newly signed-in account. State clearly that same-device browser storage is not encryption or an OS-account privacy boundary.
- Account session publication goes through the existing saved-script coordinator and one-writable-session constraint. A local take is not automatically attached to a possibly active old hosted session. Reading position is separate from script content.
- Do not turn offline scripts into an unlimited cloud library or remove free-account limits. Guest text can be prepared without an account; new cloud-script adoption remains explicit and subject to existing limits.

### Pairing safety

- Bind short-lived negotiation material and the accepted peer fingerprint to a fresh local session. Use a high-entropy capability and explicit on-screen acceptance, not a short code alone.
- Bound and validate QR/manual imports, document sizes, command rates and transport buffers; render script text as text. Do not log capabilities, raw negotiation data or scripts.
- Do not send account cookies, login links or account-channel credentials to the remote. Pairing grants control of that local take only, not library ownership.
- Use WebRTC's encrypted channel; do not fall back to a public HTTPS page opening arbitrary insecure LAN WebSockets. Permit camera only on the pairing surface if required; retain microphone denial.

## Delivery and acceptance gates

### 0. Prove the riskiest topology first

Build an isolated, non-production prototype: cached pages, manual/QR negotiation, one local data channel and a small acknowledged command. Test fresh pairing with external connectivity blocked on real iPhone/iPad and Android combinations, including hotspot host-to-client and no-uplink-router paths. Record OS/browser/network versions and required permissions. Re-test after both pages close, after hotspot restart and after device lock.

If this fails on a target combination, do not advertise universal offline remote support. Ship standalone offline first and decide whether a supported router topology or a future native companion is justified. No desktop emulation can close this gate.

### 1. Deliver standalone offline foundation

Implement the app shell, offline document store, prepare/remove/export actions, local session controller and existing display controls. Reuse the current design; this is functionality work, not another landing-page redesign.

Acceptance: prepare a script, close the app, disable all networking, cold-open, edit and prompt; close and reopen again with text/settings/anchor intact. Show honest storage failures and no cloud-saved claim. Check ordinary tabs and installed contexts separately.

### 2. Productize only proven peer topologies

Add peer transport to the controller boundary, practical pairing UX, document/settings sync, command ordering and recovery. Start with one display and one remote. Include or explicitly gate live Quick Edit; do not imply the whole remote works if only play/pause has been proven.

Acceptance: create a fresh offline pair, not merely disconnect an existing online pair; operate all promised controls and edits, test background/resume, peer loss, reload, re-pairing, version mismatch and malformed inputs. Validate movement/position preservation under different typography.

### 3. Account recovery and full free-release checks

Verify pending account edits, expired login, account switch, conflict/copy recovery and reconnect while a hosted writable session is active. Re-run unit, Phoenix/PostgreSQL, browser, production-release, restore and container checks as applicable. Existing results are a baseline, not evidence for the new offline implementation.

Before public claims, exercise real HTTPS phone/tablet online pairing as well as airplane-mode standalone and no-uplink peer scenarios. Include denied camera/storage permissions, private browsing, quota exhaustion, manually cleared storage, long text/Unicode/IME, active-take update, OS suspension and network changes.

## Proposed launch wording

Until physical acceptance: do not claim offline operation is already available.

After standalone acceptance: **“Prepare your script once. Prompt without internet.”** Explain that phone remote control still requires the hosted connection unless the particular direct-connect mode has separately passed its acceptance gate.

After paired acceptance: describe only verified device/network combinations. “Works without internet” must not imply “works without any connection between devices” or “no preparation needed.”

No hosting, merchant activation, runtime changes, physical acceptance, commit or push is performed by this planning document.
