# IZZY Current Architecture

Status date: 2026-10-09

This document describes the repository as it exists before productisation work. It is a factual baseline, not the target architecture.

Implementation progress is tracked in `IMPLEMENTATION_STATUS.md`. Since this baseline, Milestone 1 added the versioned local document/input/storage layers and automated tests; Milestone 2 added `src/prompt/` for display-local motion, lazy DOM character mapping, session-scoped semantic checkpoints, and persistent display settings. Slice 3.1 replaced implicit creation and open-role joins with the capability-protected protocol documented in `SESSION_PROTOCOL_V2.md`. Slice 3.2 added server-owned paragraph IDs, primary-display semantic checkpoints, accurate remote navigation, and display authority handoff. Slice 3.3 added guarded browser lifecycle recovery, proactive session-process loss notification, and real isolated process-restart browser coverage; physical-device acceptance is tracked separately in `REMOTE_DEVICE_QA.md`. The older descriptions below are retained as baseline history, not the current protocol contract.

Milestone 4 adds live current-paragraph Quick Edit. Phone input is sent as revision-checked block patches after a short typing debounce; Phoenix atomically broadcasts text, remapped UTF-16 reading anchor, and exclusive edit ownership. All connected surfaces update before Done. Display layouts are remeasured before publishing new checkpoints; accepted text is also saved into the computer editor's draft. Unsent phone drafts survive reload and require explicit recovery. These additions supersede the baseline's missing Quick Edit/conflict-handling descriptions below.

Slice 5.8 renames the visible product to IZZY, makes entry/pairing instructions device-neutral, and distinguishes local/loopback guidance from website pairing. A tablet can open the display with a separate phone remote; automated browser coverage is not physical-device acceptance. Further offline packaging is parked at the user's request. Technical backend/package identifiers and the baseline history below remain unchanged.

## System overview

Slice 5.2 adds explicit trusted-LAN runtime configuration and a Node.js local launcher for the prebuilt OTP release. Startup does not build/download, generates a transient secret, selects a private interface, and checks its own readiness identity; shutdown targets only its child group. DNS/distribution discovery is disabled in LAN mode. API discovery supplies a configured pairing origin for localhost-opened editors. Disposable release tests exercise this profile with external HTTP blocked; OS installers and physical offline acceptance remain pending.

Slice 5.1 adds a bundled one-origin Phoenix release: generated Vite assets, explicit SPA routes, health/readiness, runtime production-origin validation, origin-restricted HTTP/WebSockets, and disabled production LAN disclosure. A real production-release browser test runs without Vite. Public TLS/hosting and abuse controls are not complete; see `DEPLOYMENT.md`. Internet-free LAN uses a local host, not a cached cloud website; the ordinary-user local package remains future work in `OFFLINE_LAN.md`.

IZZY is currently a browser-based teleprompter prototype with three independent web surfaces connected through Phoenix Channels:

```text
Editor / pairing ─┐
Display ──────────┼── Phoenix WebSocket channel ── ephemeral Session GenServer
Phone remote ─────┘
```

The server orders transport changes and stores the session snapshot. The display projects that snapshot into locally animated pixels. The remote sends user intents and renders an optimistic local approximation of the current position.

The architecture is small and appropriate for the current prototype. There is no technical reason to rewrite the frontend or replace Phoenix.

## Repository layout

```text
/
├── src/                  React/Vite client
│   ├── pages/            Editor/pairing, display, and remote surfaces
│   └── realtime/         Phoenix client, protocol types, connection state
├── api/                  Phoenix application
│   ├── lib/teleprompter/ Ephemeral session processes
│   └── lib/teleprompter_web/
│       ├── channels/     Session WebSocket protocol
│       └── controllers/  LAN address discovery
├── docs/                 Architecture and implementation planning
├── README.md             Local/public prototype instructions
└── design-qa.md          Visual QA history for the current design
```

## Technology

### Client

- React 19.3
- TypeScript 7.0
- Vite 8.3
- Phoenix JavaScript client 1.8
- `qrcode.react` for pairing QR codes
- `lucide-react` for UI icons
- One global CSS file with responsive breakpoints and design tokens

There is no component framework, client router or general state-management/persistence library. Tests use Node's built-in runner and Playwright; account pending edits use IndexedDB directly.

### Server

- Elixir 1.16+ project (verified runtime: Elixir 1.19 / OTP 28)
- Phoenix 1.7.24
- Cowboy 2.19
- Phoenix PubSub
- OTP Registry and DynamicSupervisor
- In-memory per-session GenServer state

V1 extension (2026-10-10): optional Ecto/PostgreSQL now stores accounts/verified identities, hashed login/browser tokens, saved scripts/revisions/mutation receipts, presets and commerce records. Swoosh handles email and Assent handles Google. The separate authenticated account channel broadcasts library/purchase changes; saved sessions coordinate durable writes without blocking playback. Prodamus/lava.top adapters share a durable event worker and grants. Guest builds remain database-free. Actual hosting/SMTP/Google/merchant verification is gated; see [accounts and commerce](ACCOUNTS_COMMERCE.md). Object storage, a general job/billing platform and external production observability remain absent.

## Client routing and surfaces

Routing is parsed directly from `window.location.pathname` in `src/App.tsx`.

| Route | Component | Responsibility |
| --- | --- | --- |
| `/` | `StartPage` | Script textarea, session creation, pairing QR, display/remote links |
| `/display/:sessionId` | `DisplayPage` | Prompt rendering, smooth scrolling, fullscreen, keyboard transport |
| `/remote/:sessionId` | `RemotePage` | Jog wheel, play/pause, speed, previous/next paragraph |
| `/account`, `/account/login` | `AccountPage` | Email/Google login, library, explicit guest-draft adoption, Pro checkout and presets |
| `/account/scripts/:id` | `AccountPage` / saved editor | Independent autosave, pending/conflict recovery and saved-script session pairing |

Unknown routes fall back to `StartPage`. Route state is not persisted.

## Current user flow

1. `StartPage` loads a hardcoded sample script.
2. The user edits the textarea and presses `START LOCAL SESSION`.
3. The browser generates a six-character session ID.
4. The editor joins `session:<ID>` and sends the whole script once.
5. The pairing screen creates display and remote URLs plus a QR code.
6. Display and remote join the same channel with their declared roles.
7. The remote sends transport intents; Phoenix broadcasts canonical transport anchors.
8. The display animates continuously from the latest anchor without requiring a network message per frame.

## Current script model

The canonical session script is a UTF-8 string plus an integer revision:

```text
script: {
  content: string,
  revision: integer
}
```

Both display and remote infer paragraphs by splitting on blank lines. Paragraph identity is positional; blocks do not have stable IDs. There is no normalization, schema version, title, formatting model, patch protocol, or conflict handling.

Consequences:

- editing before the current position invalidates pixel offsets;
- paragraphs cannot be referenced reliably after edits;
- Quick Edit cannot safely restore the reading position yet;
- persistence and future sync have no migration boundary;
- the remote estimates paragraph anchors from character count instead of rendered layout.

## Transport model

Phoenix stores:

```text
status              playing | paused
anchor_position     non-negative pixel offset
speed               0.5–1.5
anchor_server_time  server timestamp in milliseconds
revision            monotonically increasing integer
```

The base rate is hardcoded to 52 pixels per second in the client and server.

### Display behaviour

- Uses `requestAnimationFrame` and a `translate3d` transform.
- Keeps the frame loop outside React renders.
- Advances locally while playing.
- Reconciles gently with the expected server position.
- Snaps when drift is large or when playback changes from playing to paused.
- Re-measures maximum scroll position with `ResizeObserver`.
- Continues visually from its last anchor during a brief network interruption.

This is a good foundation and should be preserved.

### Remote behaviour

- Sends relative seek deltas at most approximately every 33 ms while dragging.
- Updates wheel rotation and local position optimistically.
- Advances its local position every 200 ms while playing.
- Calculates previous/next paragraph anchors from approximate character lengths.
- Uses vibration as progressive enhancement.

The wheel interaction and visual design should be preserved while the position and reconnect model are upgraded.

## Realtime protocol

### Join

```text
topic: session:<sessionId>
payload: { role: editor | display | remote }
```

The server returns a snapshot containing session ID, script, transport, presence, and server time.

### Client to server

```text
transport:play
transport:pause
transport:set_speed { speed }
transport:seek_delta { delta }
transport:seek_to { position }
script:update { content }
```

### Server to clients

```text
transport:update
script:update
presence:update
```

Unknown events receive an error response. Events do not currently carry command IDs, base revisions, semantic anchors, or protocol versions.

## Connection behaviour

`useSession` creates one Phoenix socket per page and exposes:

- `connecting`;
- `connected`;
- `reconnecting`;
- `offline`.

The Phoenix client uses exponential reconnect delays capped at eight seconds. A successful join replaces local script, transport, presence, and server clock offset with the session snapshot.

Observed baseline behaviour:

- a remote left open while both development servers were stopped rendered `OFFLINE`;
- after the servers restarted, it automatically rejoined the same session and rendered `CONNECTED` without rescanning the QR;
- the session was recreated empty because current sessions exist only in server memory.

Backgrounding, phone lock/unlock, laptop sleep, mobile network changes, long outages, and stale command ordering are not covered by automated tests.

## Server process model

- `Teleprompter.Application` starts PubSub, a unique Registry, a DynamicSupervisor, telemetry, and the Phoenix endpoint.
- `Teleprompter.Sessions.fetch_or_start/1` normalizes an ID and creates a Session process when none exists.
- Each Session is a temporary GenServer with a six-hour inactivity timeout.
- The Session stores one script, one transport state, and a map of connected client IDs to roles.
- Presence is derived from role frequencies.
- A server restart loses all sessions and content.

The process model remains appropriate for ephemeral sessions. V1 durable scripts now live in the separate Library context/PostgreSQL; Session processes only bind privately to a saved revision and serialize accepted edits through that context. Restarting Phoenix ends live sessions but does not remove saved scripts.

## LAN and public topology

### Development / LAN

- Vite listens on port 5173.
- Phoenix listens on port 4000.
- `/api/network` reports detected LAN IPv4 addresses.
- The pairing screen prefers the first reported LAN address when opened through localhost.
- Devices must reach both ports on the host computer.

### Intended public mode

The client already supports either:

- same-origin `/socket`; or
- an explicit `VITE_SOCKET_URL`.

Production hosting is not implemented. Phoenix does not currently serve the Vite SPA or provide an SPA fallback. There is no container/release configuration, reverse-proxy configuration, health check, deployment workflow, or production smoke test.

The preferred launch topology is one HTTPS origin with WSS, either by serving the built client through Phoenix or by placing both services behind one proxy.

## Persistence

There is no local or server persistence.

The following are lost on refresh or restart:

- editor draft;
- reading position;
- settings;
- session state;
- recent scripts.

No storage schema or migrations exist.

## Security and privacy baseline

Current behaviour is suitable for a prototype on a trusted LAN, not for a public service:

- six-character IDs are the only session locator;
- joining an unknown ID automatically creates a session;
- roles are self-declared by the client;
- every role can currently send every accepted channel event;
- WebSocket origin checks are disabled in development;
- the network controller uses permissive CORS;
- there is no authentication, authorization, rate limiting, audit trail, or abuse protection;
- script text resides in server memory for the session lifetime.

Before public deployment, session capabilities and role permissions must be introduced. Script contents must never be sent to analytics or error metadata.

## Styling and design system

- All visual styling is in `src/styles.css`.
- Shared tokens cover graphite, cool metal, orange accents, signal green, and muted states.
- The display and remote are responsive through portrait, short-portrait, and short-landscape media queries.
- The remote is the most resolved product surface.
- Product naming still says `CUE`; the package and backend still say `teleprompter`.
- Prototype strings remain, including `REALTIME PROTOTYPE · 02` and `READ LINE 42`.

Do not redesign the remote while implementing the foundation unless a change is required by a new state or interaction.

## Existing tests and verification

Automated coverage consists of:

- TypeScript compilation and Vite production build;
- one Phoenix Session behaviour test;
- two Phoenix error-rendering tests.

Baseline on 2026-10-09:

```text
Vite production build: passed
Phoenix tests: 3 passed, 0 failed
```

There are no client unit tests, channel integration tests, browser E2E tests, accessibility tests, visual-regression tests, or network-condition tests.

## Architecture decisions to preserve

1. Keep React/Vite and Phoenix; no framework rewrite.
2. Keep local `requestAnimationFrame` display motion.
3. Keep semantic intent messages rather than streaming rendered frames.
4. Keep ephemeral Session processes separate from future durable Workspace data.
5. Keep anonymous core usage and optional accounts.
6. Keep the remote focused on transport rather than document-management controls.

## Architecture decisions required next

1. Define a versioned document format with stable block IDs.
2. Define semantic reading anchors and their conversion to/from display pixels.
3. Define versioned local persistence and migrations.
4. Define explicit state ownership between editor, server session, display, and remote.
5. Define a versioned realtime protocol with role permissions and session capabilities.
6. Choose a single-origin production deployment topology before public beta.

