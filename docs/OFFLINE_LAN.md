# IZZY — internet-free LAN mode

Status: 2026-10-09. Slice 5.2 implements the trusted-LAN runtime profile and command-line launcher; Slice 5.7 adds an Apple Silicon/macOS 26 portable ZIP preview with included runtimes. Physical offline acceptance and a signed ordinary-user installer remain pending.

Priority update (2026-10-12): preserve this computer-hosted implementation; further package work remains deferred. The owner has reopened planning for direct phone + tablet communication without requiring a computer. Follow [Direct communication and offline operation](LOCAL_COMMUNICATION_PLAN.md) for the proposed topology and acceptance gates; computer-free offline operation is not implemented yet.

## Product model

The computer on location hosts both IZZY's pages and the Elixir/Phoenix session server. Display and phone connect directly to its LAN address. A router/access point supplies the local network; its internet uplink is not required. QR pairing contains a local remote URL plus its role capability. Script edits, transport, presence, and reconnect traffic stay between these devices on that local network.

The editor, display, and remote have no runtime dependency on third-party fonts, CDN assets, accounts, or a cloud relay. Dependencies must be installed/built beforehand. Core LAN operation already exists in `npm run dev`; physical internet-disconnected testing is still outstanding in `REMOTE_DEVICE_QA.md`.

## Intended ordinary-user experience

1. Install/download a local IZZY package **before** going to the location.
2. Start IZZY on the computer; it starts the bundled local server and shows the reachable address/QR.
3. Join the same reachable Wi-Fi on the phone, scan, and operate the prompter without internet.

Slice 5.7's [portable Mac preview](PORTABLE_PACKAGE.md) provides an extracted ZIP with a double-click Terminal launcher, included Node/OTP runtimes, bundled OpenSSL, and usage/notice files. It needs no development installation at launch. This first build requires Apple Silicon/macOS 26 and is not a signed/notarized `.app` or OS installer; clean-second-Mac acceptance, graphical start/stop, firewall onboarding, other OS packages, and physical tests remain open. The source launcher described below still needs installed Node.js and a compatible prebuilt release.

## Available now in the repository

Prepare once, before going offline, with project dependencies already installed:

```sh
npm run build:local
```

Then start without building, downloading, Vite, Mix, or Elixir tooling at runtime:

```sh
npm run local
```

The launcher requires Node.js, supports macOS/Linux, and starts the bundled OTP release including its Erlang runtime. Windows packaging is not implemented or verified. Default port is **4174**, separate from development's 5173/4000. Open the printed network URL on the computer, create a session, and scan the QR on the phone. Stop with **Ctrl+C**. Stop the local server before rebuilding its release. Restarting does not preserve in-memory sessions.

If multiple networks are available, select explicitly:

```sh
npm run local -- --host 192.168.1.13 --port 4174
```

Only a detected private IPv4 on this computer (or explicit 127.0.0.1) is accepted. Detection excludes common VPN/container interfaces and public/link-local addresses; heuristics cannot prove phone reachability. Without an eligible address it starts computer-only loopback and warns that phone pairing is unavailable. If the network/IP changes, restart; automatic Wi-Fi/cloud handoff is not implemented.

A busy port is refused; the launcher never stops a process found by port/name. A per-launch non-secret readiness identity prevents mistaking another app for its own server. Ctrl+C/termination stops only the owned child process group. Missing builds produce guidance, never automatic downloads. The cookie/session secret is generated in memory for each launch, not saved or printed. Distribution and DNS cluster discovery are disabled. `IZZY_RELEASE_DIR` can select a separately prepared release directory for packaging/testing; the default is `api/_build/prod/rel/teleprompter`.

The explicit profile is `IZZY_MODE=lan`, with an HTTP `PUBLIC_ORIGIN` on private IPv4/loopback whose port matches the listener. Allowed browser origins are exactly the selected origin and same-port localhost/127.0.0.1, never a wildcard. Public mode remains the default and requires HTTPS outside loopback. LAN API discovery returns its configured `pairing_origin`; opening the computer editor via localhost still produces network-address QR links. No port-forwarding/firewall rules or external infrastructure are created. The listener binds all IPv4 interfaces: do not expose it to untrusted networks or forward it publicly.

Browser storage is origin-specific. Port 4174 and development port 5173 have separate saved drafts; this work does not silently migrate browser data. Paste/import the intended script into the local version. Starting/stopping the local server leaves existing development sessions untouched.

Slice 5.3 adds conservative LAN defaults: 16 retained sessions, 30 creation attempts per peer / minute, and 120 total / minute. Closing a browser does not immediately discard its session; inactive sessions expire after six hours. Capacity refuses new creation rather than removing an existing script. The entry page preserves the draft and explains retry/size failures. See `ADMISSION_LIMITS.md` for budgets and optional runtime overrides. A previously built/running release does not acquire new guards until it is stopped, rebuilt, and relaunched; do not overwrite a running release or restart an active session without intending to end it.

## Automated verification

Slice 5.6 pins the existing frontend/tool versions for repeatable preparation without upgrading packages. Chromium/Firefox/WebKit flow checks supplement the release checks below, but are not physical internet-disconnected acceptance. Slice 5.7 adds separate moved-ZIP verification with included runtimes and no development tools in its command path; see `PORTABLE_PACKAGE.md`. Source-launcher requirements above are unchanged.

`npm run test:release` creates disposable releases in separate temporary directories and starts the real launcher. Independent contexts open the editor via loopback and pair the display/phone via the configured network address. Non-local HTTP requests are blocked. Tests check creation, playback/motion, live edits before Done, reload, same-network sockets, foreign-origin rejection, busy-port refusal, clean stop, and survival of an unrelated server. A detected private interface is used when available; loopback fallback only proves computer-local operation. Unit tests cover argument/interface selection and runtime validation. Release tests do not overwrite the ordinary launcher's release or stop it.

This does **not** disconnect the router uplink, test OS firewall/guest isolation, or exercise a physical phone. Physical offline acceptance remains pending.

A public HTTPS website is a separate cloud mode. Caching its page or installing it as a PWA does not make its remote cloud session server reachable offline. An HTTPS page also cannot simply switch to an unencrypted private-network WebSocket without browser restrictions. Local mode opens the locally served page directly; automatic discovery/cloud-to-local handoff is not promised.

## Practical constraints

- The computer must remain awake with IZZY running. Closing it or stopping its server ends connectivity; a server restart loses ephemeral sessions.
- Devices need mutual LAN reachability. Guest Wi-Fi/client isolation, captive portals, VPN routes, and firewalls can block pairing even when both show the same Wi-Fi name.
- A phone switching to cellular cannot reach a private LAN address. Rejoin the reachable Wi-Fi; local mode has no cloud fallback requirement.
- Trusted-LAN HTTP does not encrypt script text or keys in transit. It is not intended for an untrusted shared network. Native-wrapper/secure local transport options need a separate decision if that threat model is required.
- Local browser storage is a draft/bookmark store, not the real-time session authority or a durable server backup.
- Mobile secure-context features and the real keyboard/IME require physical verification. They must not be assumed from desktop emulation.

Use the existing physical-device matrix to test creating a **fresh** session with the router internet uplink disabled, not merely leaving a previously connected cloud page open.
