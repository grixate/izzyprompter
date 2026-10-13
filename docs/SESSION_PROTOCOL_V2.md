# Session Protocol v2 — Slices 3.1–3.3 and Quick Edit

Status: implementation and automated lifecycle checks completed locally on 2026-10-09. Physical mobile acceptance remains pending; see `REMOTE_DEVICE_QA.md`.

## Creation and identity

`POST /api/sessions` accepts `{ protocol_version: 2, content, speed }`. Content must be nonempty normalized UTF-8, at most 2 MiB / 5,000 paragraphs; speed must be numeric in 0.5–1.5. Raw HTTP JSON has a separate 3 MiB budget. Successful creation returns HTTP 201 with `{ protocol_version: 2, session_id, tokens: { editor, display, remote } }` and `Cache-Control: no-store`.

Slice 5.3 checks creation attempts before parsing JSON and atomically bounds retained session processes. Rate rejection is 429 `rate_limited` with `Retry-After`; exhausted session capacity is 503 `session_capacity`. Both are non-cacheable and preserve the editor draft for explicit retry without evicting live sessions. Oversized JSON returns 413, unsupported media 415, invalid script/speed 422. Defaults, proxy trust, and limitations are documented in `ADMISSION_LIMITS.md`.

The six-character code is human-readable identity, not authorization. Each role has an independent cryptographically random 256-bit bearer capability. The session process stores SHA-256 hashes, compared in constant time. Snapshots never include capabilities. A random `session_epoch` distinguishes session instances and namespaces display bookmarks.

Device URLs are `/display/:id#key=…` and `/remote/:id#key=…`. Fragments are not part of HTTP requests or query logs, but are visible in browser history and can be copied. Possessing a link grants its role. Editor capabilities remain in tab session storage; script drafts remain in the separate versioned local document storage.

## Join

Socket params require a bounded `client_id` (8–96 bytes). Join topic is `session:<id>` with `{ protocol_version: 2, role, token }`. Only existing sessions can be joined. The server binds the verified role to the channel; subsequent payload roles cannot elevate it.

The snapshot includes protocol version, code, epoch, script `{ content, revision, document }`, transport, reading, editing, presence, and server time. Every join receives its server-owned `connection_id`; display joins additionally receive `display_id` (other roles receive null). Each channel connection has a server-owned presence identity, so a client-chosen ID cannot overwrite another device's presence or edit ownership. Presence is refreshed for the joining page as well, avoiding a stale join snapshot during simultaneous device pairing.

## Permissions

| Operation | Editor | Display | Remote |
| --- | --- | --- | --- |
| Read session script/transport/presence | Yes | Yes | Yes |
| Play, pause, speed, seek | Yes | Yes (keyboard/local controls) | Yes |
| Replace script | Yes, current base revision required | No | No |
| Begin/patch/end current-paragraph edit | Yes, exclusive connection ownership | No | Yes, exclusive connection ownership |
| Publish semantic checkpoint | No | Elected primary only | No |

## Commands and ordering

Slice 5.4 bounds incoming WebSocket messages to 3 MiB, allows one channel per socket, and applies constant-size message/byte/heavy-edit budgets per channel and shared session. Ordinary control/checkpoint payloads are capped separately at 4 KiB decoded-term size. `rate_limited` and `payload_too_large` refuse work without advancing replay state; channel refusals include `retry_after_ms`. The client never reconnects just to bypass a refusal, queues no rejected work, and applies a bounded local cooldown. See `REALTIME_GUARDS.md` for exact limits and remaining edge-connection boundaries.

Existing event names remain: `transport:play`, `transport:pause`, `transport:set_speed`, `transport:seek_delta`, `transport:seek_to`, and `script:update`. Slice 3.2 adds `transport:seek_anchor { anchor }`, `transport:step_block { direction: -1 | 1 }`, and `reading:checkpoint`.

Each command carries `protocol_version: 2`, a positive safe-integer `sequence`, and `command_id: <socket client_id>:<sequence>`. A high-water mark per verified role/logical client rejects any sequence already applied or older than it. Transport retains its monotonically increasing revision. A new page load creates a fresh logical client ID; reconnect preserves the page's sequence. High-water marks remain for the session lifetime rather than being evicted and permitting old commands to replay.

`script:update` additionally requires the current integer `base_revision` and no active Quick Edit. Invalid or stale updates do not alter content.

Transport input payloads are bounded: speed 0.5–1.5, seek delta magnitude at most 10,000 pixels, legacy absolute seek input 0–100,000,000. Commands are serialized by the session GenServer. `anchor_position` is a shared distance cursor, not an absolute rendered offset: after a semantic jump or reflow, it can be negative while the display's measured position stays nonnegative. Relative seeks use the latest confirmed primary-display projection to clamp at the script boundaries and discard overshoot. This permits backward jogging immediately after NEXT, even when the shared distance cursor started at zero. Do not use `transport:seek_to` to target a paragraph; send its semantic anchor instead.

## Shared document and reading state

The server normalizes plain text and builds an `IzzyDocumentV1` with random paragraph IDs at creation/whole-script replacement. All devices use that same identity; snapshots/rejoins never regenerate IDs. Character offsets are JavaScript/DOM UTF-16 code units, including supplementary Unicode characters. Whole-script replacement creates new IDs and invalidates the checkpoint. Quick Edit patches preserve every paragraph ID, changing only the acquired block's text.

`reading` contains `{ revision, source_id, checkpoint }`. The first connected display is the primary measurement source. Other displays independently render the same transport but cannot publish checkpoints. On departure, the next display in connection order becomes primary, aligns to the last shared semantic anchor in its own layout, and publishes fresh measurements. The last checkpoint survives a period without displays, but the remote does not present its old pixel position as a live measurement.

`reading:checkpoint` carries the normal command envelope plus:

```text
anchor: { blockId, characterOffset }
position, maximum          actual nonnegative display pixels, capped at 100,000,000
transport_position         signed shared distance at measurement, magnitude capped at 100,000,000
transport_revision         exact current transport revision
script_revision            exact current script revision
```

The server checks the elected connection, revision pair, block identity, character bounds, and numeric bounds. Accepted checkpoints gain server-owned `source_id` and `server_time`, increment the reading revision, and broadcast as `reading:update`. Late or invalid measurements return `stale_reading` without replacing good state or triggering a reconnect loop. Clients ignore older reading revisions.

The primary samples while moving every 500 ms and publishes immediately on transport/reflow/reconnect. Identical paused samples are suppressed. React and the network still do no per-frame scroll work. The remote's paragraph indicator reflects the latest measured anchor; between samples it projects pixel movement from the transport clock. It does not infer paragraphs from string length. Sampling and network latency still apply: this is not an exact live word cursor.

Semantic seeks validate the target and store `transport.semantic_anchor { anchor, script_revision, revision, transport_position }`. Each display resolves that anchor using its own DOM layout. A newer semantic intent wins over an older checkpoint until the display confirms it; the remote temporarily shows a dash rather than guessed pixels. `step_block` advances from the newest intent or checkpoint server-side, so rapid NEXT commands progress through distinct paragraphs even before the next measurement arrives. With no valid shared anchor it returns `reading_unavailable` instead of guessing.

## Live current-paragraph editing

`editing` is `{ revision, active: null | { owner_id, block_id, anchor } }`. Ownership is bound to the server-issued channel connection ID, never a client-supplied payload identity.

- `script:begin_edit` requires an editor/remote role, no active edit, paused transport, and a fresh checkpoint matching both current script and transport revisions from the current primary display. It acquires that checkpoint's block and reading anchor. The remote first pauses, then retries while awaiting the actual paused measurement; it does not estimate the current block from text length.
- `script:patch_block { block_id, base_revision, text }` requires the same owning connection and block, current base revision, valid UTF-8, and both patch/full-script sizes at most 2 MiB. Intermediate trailing whitespace and empty text are valid. Patches retain block identity; newline input stays inside that block rather than changing paragraph structure. The server remaps the saved UTF-16 reading offset through the common prefix/suffix, increments script/transport/editing revisions, stores a new paused semantic intent, and invalidates the old reading checkpoint.
- `script:end_edit` requires the owner and releases the lock without resuming playback. Owner departure also releases the lock and broadcasts `editing:update`. A new connection cannot reuse old ownership.
- Play, pause, speed, and seek commands are rejected with `editing_active` during an edit. Whole-script replacement is also rejected. Other remotes show the live block read-only.

All accepted edit actions broadcast **one `session:update` full snapshot** and reply with that snapshot. Text and remapped anchor therefore arrive together, not as separately rendered messages. Displays invalidate old DOM mappings and measure the new text before applying/publishing anchors. The editor saves accepted text into its local draft. Clients still reject obsolete script/transport/reading/editing revisions.

The phone serializes patches with a 180 ms debounce and keeps unsent input in versioned, session/epoch-scoped local storage. Accepted changes appear on all connected screens **while typing**, not on Done. Done is enabled after acknowledgement of the latest text and only ends editing. IME composition is not sent until composition ends. Short typing/network latency is expected; this is not per-keystroke or per-frame synchronization.

On interruption, patches stop and unsent drafts remain local. A recovered draft requires explicit resume and reacquisition. If live text differs from both the last acknowledgement and local draft, resume refuses to overwrite it; the user can copy the draft or explicitly use the live text. No automatic offline patch replay, silent conflict overwrite, rich-text editing, or simultaneous co-authoring is implemented.

## Recovery and failure

- Phoenix reconnect returns a fresh snapshot without resending the editor's script.
- Online/foreground, document resume, and persisted pageshow events request a fresh join, avoiding a falsely healthy sleeping socket. Same-tick hints are coalesced. Ordinary initial pageshow does not force a second join.
- A hidden phone remote disconnects and disables its controls; a hidden display is not deliberately disconnected just for visibility. Page exit/freeze suspends connections. Display-local animation can continue through a short outage while the browser remains runnable; an actually frozen/asleep device cannot render frames.
- Phoenix's public connect entry point is gated by live, non-terminal, non-suspended page state. Disposed sockets cannot reconnect from library-owned browser listeners after cleanup, and terminal sessions cannot wake up on pageshow/online hints.
- Responses/timeouts from an earlier connection generation cannot tear down a successfully recovered connection. A late snapshot received while suspended cannot re-enable controls.
- Offline controls are disabled; pending wheel deltas are discarded, not replayed on reconnect.
- The display continues locally during a short socket/phone interruption.
- Join errors are terminal for missing keys, incompatible protocol, missing sessions, or capacity limits. The app stops retrying them and shows recovery guidance.
- Each joined channel monitors its session process. Expiry or process loss proactively pushes `session:ended { reason: session_unavailable }` and closes the channel, including when paused and sending no commands. The client enters a terminal ended state rather than waiting for a user action. Commands racing with loss still return `session_unavailable`. Leaving or snapshotting a missing session never creates one.
- Server restart loses ephemeral sessions. Recovery is explicit new-session creation from the editor's saved draft, not transparent restoration of server memory.

Sessions expire after six hours of inactivity. Capacity is bounded to 64 simultaneous channel connections and 1,024 command-producing logical role/client identities over a session lifetime. A capacity-limit response requires closing unused connections or creating a new session.

## Privacy and deployment boundary

Phoenix filters `password`, `token`, `key`, `content`, and patch `text` parameters from logs. No script content or key is intentionally logged. API responses containing credentials are non-cacheable. Tests use synthetic script content and test-only credentials.

Routine socket/join/payload logging is disabled; session lifecycle counts replace identity-bearing log lines. The session OTP formatter redacts state/messages/reasons/history. Local diagnostics use 32 fixed aggregate counters and periodic summaries with no text, keys, addresses, or session/device labels. No external reporter or public diagnostics route exists. Review framework/proxy crash logs and future monitoring independently; these changes are not blanket redaction of every possible log source.

LAN HTTP mode does not encrypt traffic and is only appropriate on a trusted network. Creation rate/capacity/body guards and exact public-origin restrictions exist, but public use still requires actual HTTPS/WSS hosting, edge/socket safeguards, operational hardening, and production acceptance. There is no key revocation, account identity, durable server storage, or multi-node session recovery yet. Physical mobile lifecycle testing remains pending.

## Automated lifecycle verification

Chromium scenarios simulate hidden/visible, pagehide/persisted pageshow, and freeze/resume hints. They check current speed/playback/reading after rejoin, disabled background controls, one new session socket for coalesced restoration hints, and no old transport replay. These are deterministic event tests, not physical lock or browser-freezing tests.

A separate browser scenario starts its own Vite and Phoenix processes on dynamically selected loopback ports, stops and restarts that Phoenix process, and verifies explicit old-session loss, saved-draft recovery, new pairing, and no silent empty-session creation. It shuts down only processes it created; development and shared E2E servers are untouched. Test-only port/origin environment overrides exist only in the test configuration; no lifecycle-management HTTP endpoint was added.
