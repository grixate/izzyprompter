# IZZY — Browser Teleprompter

Development and corrections follow [the release workflow](docs/RELEASE_WORKFLOW.md): local work → automated checks → private staging → owner review → manual production release. The saved live baseline is tagged `v0.1.0-live`.

**Local preview (2026-10-12):** `/local` now supports standalone prompting, prepared scripts and cached offline startup. An experimental manual WebRTC remote is included; native two-device connectivity and physical phone/tablet acceptance remain open. Phoenix remains available. See [usage and verification limits](docs/LOCAL_PREVIEW.md) and the [active architecture plan](docs/LOCAL_COMMUNICATION_PLAN.md).

**Current product offer (2026-10-17): Lifetime Pro through lava.top, USD only: US$29 launch offer, US$49 when launch mode ends.** The server owns the price. The public product page and fifteen Pro remote finishes are implemented; live checkout remains disabled pending merchant setup and verification. Follow [Lava.top setup](docs/LAVA_TOP.md). Guest prompting and three-script accounts remain free. See [account operations](docs/ACCOUNT_OPERATIONS.md) for the hosted baseline; offline field acceptance is pending.

An interaction-first teleprompter with three separate browser surfaces connected in real time by Phoenix Channels:

- editor and pairing screen;
- teleprompter display;
- phone remote with a tactile jog wheel.

The core hosted workflow is **Paste → Scan → Roll**. A tablet can open the script page and display while a phone controls it. The guest website is live at [izzyprompter.com](https://izzyprompter.com) and needs no user computer; email-link accounts are available; payments remain disabled. See [server setup](docs/SERVER_SETUP.md). The development/LAN hosted workflow needs its server computer running. The new `/local` preview uses a reading-device controller instead.

The sixteen-study remote design collection and its future creative process are preserved in the [remote instrument design playbook](docs/REMOTE_DESIGN_PLAYBOOK.md), with a repository skill at `.agents/skills/izzy-remote-design`. The `/lab/jog` workbench remains development-only; the public `/skins` showroom uses the released finish catalog and server entitlement checks.

## Run

Accounts, three-script libraries, offline pending edits, lifetime-Pro presets and lava.top checkout are now implemented. They are opt-in; guest mode still runs without PostgreSQL. See [account/payment setup and launch gates](docs/ACCOUNTS_COMMERCE.md) and `.env.example`. Checkout is disabled until merchant approval and verification; no real payments have been tested. Legal pages and purchase disclosures are prepared as drafts; follow [legal publication readiness](docs/LEGAL_PAGES.md) before publishing them.

For the current local preview, Free/Pro demo sign-in and hands-on phone/tablet checklist, see [local testing](docs/LOCAL_TESTING.md). The [security and edge-case review](security_best_practices_report.md) records repairs, verified mitigations and remaining launch gates.

```bash
npm install
npm run dev
```

This starts Vite on port `5173` and Phoenix on port `4000`. Open the **Network** URL printed by Vite rather than `localhost` when pairing a phone. Both devices must be on the same LAN.

The internet is not used by a running session. Once dependencies are installed, editor, remote, display, transport state and QR pairing all work entirely over the local network.

## Local release (without a development server)

An Apple Silicon/macOS 26 **portable ZIP preview** now includes the launcher's Node runtime, the OTP release/runtime, and its OpenSSL dependency. Extract it and double-click `Start IZZY.command`; no development setup or runtime downloads are needed. This is not a signed/notarized installer or clean-second-Mac acceptance. Prepare with `npm run package:local` on a matching Mac; see [portable package instructions and limitations](docs/PORTABLE_PACKAGE.md). The normal source-launcher path below remains available.

Prepare once with dependencies installed, before going offline:

```sh
npm run build:local
```

Then start with `npm run local`. Open the printed network URL (default port **4174**), create a session, and scan its QR. Stop with Ctrl+C. Optional address/port selection: `npm run local -- --host 192.168.1.13 --port 4174`.

The launcher makes no downloads/builds at startup, refuses busy ports (including localhost-only listeners) without stopping other apps, and uses only a detected private IPv4 or explicit loopback. If no LAN address is found, it warns that phone pairing is unavailable. The source launcher requires Node.js and a prebuilt release for the same OS/architecture; the Mac ZIP includes them. macOS/Linux source-launcher support exists, Windows/graphical installers do not. Stop before rebuilding. Trusted-LAN HTTP is unencrypted; never expose this mode publicly. See [Offline LAN](docs/OFFLINE_LAN.md) for limitations and physical-test status.

This separate port has separate browser storage from development; paste/import your script into the local version. Existing development sessions are not restarted by the local launcher.

## Public website mode

The root `Dockerfile` prepares a Linux-only hosted deployment image, without the Mac offline package. The image build, container smoke, and public HTTPS browser smoke passed on the provisioned Debian server on 2026-10-13; the guest-only website is live at [izzyprompter.com](https://izzyprompter.com). See [server setup and remaining operational checks](docs/SERVER_SETUP.md). Earlier build/test instructions, hosting options, and acceptance gates are in [Hosted beta preparation](docs/HOSTED_BETA.md). The CI job builds/tests only and does not publish or deploy.

The bundled one-origin release serves the client, API, and WebSocket from Phoenix without Vite at runtime. Build it with `npm run build:server`, then `MIX_ENV=prod mix release` in `api/`; see [deployment instructions](docs/DEPLOYMENT.md) for required `PUBLIC_ORIGIN`, secret, TLS proxy, health checks, and outstanding public-beta limits. Public HTTPS is active on the provisioned host. The frontend-only build described below remains a separate option.

The same frontend can be hosted on a normal HTTPS domain. Phoenix Channels then relay commands over secure WebSockets, so the display and phone can be on different networks. Host both behind one domain with `/socket` proxied to Phoenix, or set `VITE_SOCKET_URL` to a separate public Phoenix endpoint before building.

The frontend also calls `POST /api/sessions` on the same Phoenix endpoint to create a session. Proxy `/api` as well as `/socket`. Role capabilities protect joining and commands; creation rate limits, retained-session capacity, and HTTP/script budgets are implemented. Actual HTTPS/WSS hosting, proxy/edge/socket safeguards, and operational acceptance are still required. Plain HTTP LAN mode is intended for a trusted local network. See [admission limits](docs/ADMISSION_LIMITS.md) for defaults, explicit retry recovery, and proxy-trust setup.

Public mode and local mode are complementary:

- **Public:** easiest zero-install experience; requires internet during the session.
- **Local:** runs from a computer on the LAN; keeps working without internet after dependencies are installed.

The existing server-backed workflow needs a reachable Phoenix instance. The new [standalone preview](docs/LOCAL_PREVIEW.md) cold-opens from a prepared browser cache and saves scripts on-device; its manual paired mode remains experimental. The trusted-LAN profile, command-line launcher and first Mac portable ZIP remain separate options. Signed installers and physical internet-disconnected acceptance are not complete. See [Offline LAN](docs/OFFLINE_LAN.md).

## Controls

- Paste or edit the script and start a session.
- Open the display in a second browser tab or device.
- Scan the QR code with a phone to open the remote.
- Press the center of the wheel to play or pause.
- Drag the wheel clockwise or counterclockwise to seek.
- Use the speed slider beneath the wheel to adjust speed.
- Use Previous / Next to jump between phrases.
- Use Quick Edit to pause at the current paragraph and correct it from the phone. Changes appear on every connected screen as you type (short auto-sync delay); Done only closes editing and leaves playback paused. A display must be connected to identify the current reading point.
- Desktop: Space toggles playback, arrow keys seek, `+` / `-` change speed, and `F` opens the display fullscreen.
- With the remote wheel focused, arrows jog, Page Up/Down make larger moves, and Home/End seek to the first/last script anchor. Tab reaches the separate center Play/Pause button; Enter or Space activates it.
- If Mac Safari skips buttons or links with Tab, use Option+Tab to include them; this follows [Safari's keyboard navigation behaviour](https://help.apple.com/safari/mac/8.0/en.lproj/cpsh003.html).
- On the display, open the settings icon to adjust text size, line spacing, text width, or mirror the text. Settings persist in that browser; keyboard transport shortcuts do not intercept settings inputs.

The display remembers the reading paragraph and character independently for the ten most recently used sessions. Refresh, resizing, orientation, and typography changes restore the reading line rather than reusing a stale pixel offset. If the remote changes transport while the display is closed, its newer command takes precedence. This recovery requires the same live server session; server-restart recovery is not implemented yet.

The primary display publishes its measured paragraph/character anchor and position to Phoenix. The remote uses these checkpoints instead of estimating layout from text length; Previous / Next selects actual paragraph IDs and remains correct after typography changes. A second display has its own layout and cannot overwrite the primary's measurements. If the primary leaves, the next connected display resumes from the shared anchor. Checkpoints are sampled twice per second while moving and immediately after commands/reflow—not streamed every frame. Without confirmed display measurements, the position readout shows a dash.

The display scroll loop runs locally against a transform in `requestAnimationFrame`; React and the network do not render every animation frame. Phoenix sends authoritative transport anchors and semantic commands. If the socket briefly drops while playing, the display continues scrolling from its last known state.

Quick Edit keeps paragraph IDs and remaps the reading word through text changes on differently sized displays. One device edits at a time; other remotes can open a read-only live monitor. The script device's pairing page shows the live paragraph and saves accepted corrections into its draft. If the phone loses connection, unsent text remains in the tab and is also stored locally when browser storage permits; sending it requires explicit resume. A newer correction is never silently overwritten. This is plain-text current-paragraph editing, not simultaneous collaborative authoring.

If local saving fails, the editor and unsent Quick Edit drafts show a warning with explicit retry and plain-text download options. Keep that tab open until you have saved or exported the text. Failed clipboard copying offers manual selection instead of claiming success. Recovery dialogs preserve the editor's in-memory script without a page reload, and keyboard focus stays visible and returns after editing. See [recovery and keyboard access](docs/RECOVERY_ACCESSIBILITY.md) for exact behaviour and remaining screen-reader/cross-browser checks.

Sessions are ephemeral supervised Elixir processes and expire after six hours of inactivity. Guest prompting requires no database/account. Account scripts persist in PostgreSQL independently of live sessions.

Realtime guards bound inbound message size, command/byte bursts per channel and shared session, and heavy text-operation throughput. Refused commands do not trigger reconnect/replay. Local diagnostics report only fixed aggregate counts, never script text or session/device identities; there is no external monitoring service yet. See [realtime guards and diagnostics](docs/REALTIME_GUARDS.md) for budgets and remaining deployment boundaries.

## Pairing and recovery (protocol v2)

The server creates the short session code and separate editor, display, and remote keys. The QR code and device links include the appropriate key in the URL fragment (`#key=…`), not the HTTP query. Use the **complete** link; knowing only the six-character code is not enough to join. Treat a pairing link like a bearer credential: anyone with it has that device's permissions. Never share the editor's tab credentials.

The editor's pairing information survives refresh in that tab via session storage. It does not replace the locally saved script and is not a cloud account. Display and remote links keep their key across reload. A short network outage reconnects to the same live server snapshot without scanning again; offline controls are disabled and gestures are not queued for later replay. The display can continue locally while the phone is offline.

A hidden phone remote suspends its connection and controls. Returning to the foreground, restoring a persisted page, or resuming a frozen document requests fresh playback and reading state before controls are enabled. The display can continue during a short outage while its browser is runnable; actual device sleep/freezing cannot render frames. Session-process expiry/loss proactively notifies even paused pages instead of waiting for the next command.

If the server restarts or the session expires, the app explains that the session ended rather than silently creating an empty one. Return to the editor and start a new session using the saved draft. Old prototype links without a capability key no longer work. See [Session Protocol v2](docs/SESSION_PROTOCOL_V2.md) for message contracts and current limits.

## Tests

Use Node.js 24 or newer, Elixir 1.19, and Erlang/OTP 28 for the same runtime family as CI.

```bash
npm ci
cd api
mix deps.get
cd ..
npx playwright install chromium
npm run test:all
```

- `npm test` runs document, normalization, persistence, import, and prompt-engine unit tests, the production client build, and Phoenix tests.
- `npm run test:e2e` runs browser scenarios in Chromium and starts its own Vite/Phoenix servers on `127.0.0.1:4173` and `127.0.0.1:4002`. Keep those ports free; your development session on `5173`/`4000` can stay open.
- The restart scenario additionally starts a separate app on dynamically selected loopback ports and restarts only the Phoenix process it owns. It never restarts your development server or the other tests' shared server.
- `npm run test:all` runs both suites.
- `npm run test:browsers` runs the wider Chromium/Firefox/WebKit matrix. Install those engines first with `npx playwright install chromium firefox webkit`. Run it separately from other E2E commands because they own the same test-server ports.
- `npm run test:package` separately builds/verifies a relocated Mac portable ZIP, including bundled runtime/native dependency checks, pairing/live edits, safe shutdown, and non-destructive builder failures. Native macOS arm64 only; other platforms are explicitly skipped. Set `IZZY_PACKAGE_ZIP` to verify a prepared ZIP without another build/download.
- `npm run test:release` separately builds and boots a real production OTP release on its own loopback port, verifies same-origin browser pairing/live edits without Vite, origin restrictions, caching, and health/readiness recovery. It never restarts the development server.

The canonical flow uses independent editor, display, and remote browser contexts, with both desktop and emulated phone remotes. It checks script delivery, presence, play, actual display movement, forward/backward wheel scrubbing, pause, speed, and remote reload. Other scenarios cover rich clipboard paste, immediate page recovery, Start Over, file selection, drag/drop, corrupt storage, exact display recovery through reflow, stale bookmark precedence, semantic paragraph navigation, primary-display handoff, and a 600-paragraph script. Low-frame-rate playback is covered with deterministic unit tests.

GitHub Actions is configured to run client/server tests, the three-engine browser matrix, and production/LAN smoke checks on pull requests and pushes to `main`; remote execution is pending a push. Failures preserve screenshots, traces, and an HTML report for seven days. Locally, inspect the latest report with `npx playwright show-report`.

All direct client/tool dependencies are pinned to the existing lockfile versions. No packages were upgraded in this pass. See [browser coverage and repeatable builds](docs/CROSS_BROWSER.md) for the engine/real-browser distinction, deliberate clipboard skips, and update policy.

The current local suite has 67 client/launcher/package-policy unit tests, 77 Phoenix tests, a production build, 32 Chromium E2E scenarios (the wider matrix passes 94 checks across Chromium/Firefox/WebKit, with two deliberate native-clipboard skips), two separate production/LAN release smoke tests, and one native Mac portable-ZIP smoke test. Recovery checks cover keyboard controls/focus, blocked local storage, explicit retry/text backup, modal return without reload, and clipboard refusal. Live editing is checked on two differently sized displays, the editor, and a second remote before Done, including reading-word preservation, offline recovery, and conflicting phone drafts. Creation tests cover throttling, retained-session capacity, request/script budgets, proxy-header trust, and non-destructive retry. Realtime tests cover bursts/refill, sustained simulated jog traffic, shared-session quotas, non-mutating refusal, no reconnect/replay, diagnostics privacy, and a real oversized frame closing with code 1009. The LAN launcher is tested with non-local HTTP blocked, network-address pairing from localhost, and isolated shutdown; disposable release tests do not overwrite the normal local release. Lifecycle tests simulate visibility, page restoration, and freeze/resume events; the process-restart test restarts a real server. Phone emulation does not replace physical iOS/Android testing. Lock/unlock, app switching, real Wi-Fi changes, laptop sleep, and the real mobile keyboard are deferred at the user's request and remain unverified in the [physical-device checklist](docs/REMOTE_DEVICE_QA.md).
