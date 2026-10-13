# IZZY — realtime budgets and aggregate diagnostics

Status: 2026-10-09, Slice 5.4. Verified locally, not publicly deployed. Physical-device acceptance is deferred at the user's request, not passed.

## Traffic budgets

The browser uses one session channel per WebSocket. The server permits one joined channel per transport, preventing a single socket from multiplying channel budgets. The existing 64-connections-per-session cap still applies across sockets. This does not cap all open unauthenticated sockets; the deployment edge must enforce connection and handshake policy.

Cowboy rejects incoming frames/messages larger than **3 MiB**, before Phoenix JSON decoding. Compression is explicitly disabled. A real release/browser test sends an oversized frame and observes WebSocket close code 1009. This protects inbound messages, not outbound snapshots or total network bandwidth.

After decoding, each joined channel checks a constant-size token budget before forwarding work to its session. The session checks a shared budget before document/transport work, so opening more authorized channels does not multiply that session's accepted command throughput. Reconnecting resets the channel budget but not the surviving session budget.

| Budget | Per channel: burst / refill | Per session: burst / refill |
| --- | --- | --- |
| Messages | 120 / 60 per second | 240 / 120 per second |
| Payload bytes | 8 MiB / 2 MiB per second | 16 MiB / 4 MiB per second |
| Heavy text operations | 8 / 6 per second | 16 / 12 per second |

Heavy operations are `script:update` and `script:patch_block`. Normal controls/checkpoints are limited to **4 KiB** of decoded Erlang external-term size; text-operation payloads to **3 MiB**. This decoded-term estimate includes envelope/field overhead and is distinct from JSON wire size and the existing 2 MiB script-text budget. Payloads must be maps. Invalid/oversized attempts also spend the cheap message budget. No payload, client identity, or deferred work is retained in a budget.

These are conservative starting budgets, not benchmarked public-host capacity. Normal jog input is already coalesced to about 30 messages/second and Quick Edit debounced by 180 ms. Deterministic tests exercise 30 Hz jog input for more than three simulated minutes. The existing 600-paragraph playback/reflow test and multi-display live editing pass, but this is not a real-device or production load test.

## Refusal and recovery

`rate_limited` and `payload_too_large` reject a command before mutation/broadcast. Channel rate refusals include bounded-in-practice `retry_after_ms` hints derived from their budget; session aggregate refusals use the client's conservative fallback. A rejected command does not advance its replay high-water mark.

The browser treats these refusals as application errors, not a broken connection. It does not reconnect to evade a limit, queue gestures, or automatically replay edits. Rate refusal applies a local cooldown of 50–2,000 ms (250 ms without a usable hint). Work attempted during that cooldown is refused locally, not stored. Quick Edit keeps its existing explicit unsent-draft recovery. A later user action can proceed after refill. Existing fatal authorization/session-loss handling remains unchanged.

## Diagnostics and privacy

`Teleprompter.Diagnostics` owns **32 fixed aggregate counters**: four operations (`creation`, `join`, `command`, `session`) × eight outcomes. Writes are atomic ETS increments, not one queued diagnostics message per command. Arbitrary operation/outcome labels are ignored, avoiding user-controlled cardinality. Failure of the counter table does not block prompting.

Every 60 seconds, the server logs one `izzy_diagnostics` JSON summary with cumulative counters and process uptime. No scripts, patches, keys, session/device IDs, addresses, user-agent strings, or arbitrary error messages enter this summary. Counters are ephemeral, reset when diagnostics restarts, and are not product analytics, per-user histories, latency metrics, or an external alerting service. A process-local snapshot is available through `Teleprompter.Diagnostics.snapshot()` for trusted operator use; no public diagnostics HTTP endpoint was added.

Routine socket/join/payload logging is disabled. Session-ID lifecycle log lines were replaced with aggregate counts; socket IDs no longer embed client IDs. The session's OTP status/crash formatter redacts its state, last message, reason, and message log to avoid dumping script text or recent patches. Existing Phoenix parameter filtering remains. This is not a blanket guarantee that every framework, reverse-proxy, unexpected exception, or future monitoring integration is sanitized; production log review and retention/redaction policy are still required. Do not attach unrestricted Phoenix telemetry metadata to a reporter: it can contain socket/payload/connection data.

## Verification and remaining work

`npm run test:all`: 55 client/launcher tests, production build, 77 server tests, 25 Chromium scenarios. `npm run test:release`: two real public/LAN release smokes. **159 tests passed without retries.** New tests cover bursts/refill, byte/edit quotas, malformed/oversized controls, independent channel/shared-session enforcement, non-mutating refusal, redacted OTP status, fixed/concurrent diagnostics counters, no reconnect/replay, and real wire-size enforcement.

Public edge connection/handshake limits, malformed pre-channel traffic handling, measured memory/CPU/egress budgets, operational alerts, real HTTPS deployment, cross-browser accessibility/recovery polish, and easier offline packaging remain separate work. Physical iOS/Android and actual router-uplink-disconnected checks remain explicitly unverified. The separately running LAN release is not overwritten/restarted by tests and retains its previously built code until intentionally rebuilt/relaunched.
