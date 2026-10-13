# IZZY — bundled deployment foundation

V1 account/payment extension (2026-10-10): see [accounts and commerce runbook](ACCOUNTS_COMMERCE.md) for PostgreSQL migrations, SMTP/Google, Prodamus/lava.top, backup restore and paid-launch gates. Forward `/account/socket` WebSocket upgrades and `/auth`/`/account` routes too. Account-enabled readiness also checks the database schema; saved scripts survive a Phoenix restart although live sessions end.

Status: 2026-10-09. Slices 5.1–5.4 are locally verified; no public service has been provisioned or deployed. Session creation/body/capacity and realtime frame/message guards plus local aggregate diagnostics exist; public launch still requires edge connection safeguards, operational hardening, and acceptance. Physical-device testing is deferred, not passed.

## One-origin release

Slice 5.9 adds a root multi-stage Linux `Dockerfile`, runtime/container smoke, and a non-deploying CI job. The Docker runtime is unavailable on the development Mac, so the image build/smoke is **not yet verified**. See [hosted beta preparation](HOSTED_BETA.md) for hosting research, exact runtime settings, verification boundaries, and approval/rollback gates. No provider/cost/domain has been selected or provisioned.

Phoenix can serve the built React client, API, and WebSocket on the same origin. Vite is needed only to build the client, not to run the resulting release. Existing split-port development remains available with `npm run dev`.

Build on the same OS/architecture family as the target runtime:

```sh
npm ci
npm run build:server
cd api
mix deps.get --only prod
MIX_ENV=prod mix release
```

`build:server` writes generated assets only to `api/priv/static/app/`, which is ignored by Git and included in the release. It deliberately ignores `VITE_SOCKET_URL`: a bundled client always uses its own page origin for API/WebSocket traffic. The ordinary `npm run build` still supports a separate configured endpoint. Do not use an inherited development socket URL for a production frontend.

Set private runtime environment values in your process/service manager:

| Variable | Purpose |
| --- | --- |
| `PHX_SERVER=true` | Enable the HTTP listener |
| `PUBLIC_ORIGIN=https://izzy.example` | Exact external origin, optionally with a non-default port; no path, credentials, query, or fragment |
| `PORT=4000` | Internal HTTP port, not the public TLS port |
| `SECRET_KEY_BASE` | Random secret of at least 64 bytes; generate with `mix phx.gen.secret`, never commit or share |
| `IZZY_MAX_SESSIONS`, `IZZY_CREATE_PER_IP`, `IZZY_CREATE_TOTAL` | Optional bounded session/admission overrides; see `ADMISSION_LIMITS.md` |
| `IZZY_TRUSTED_PROXY_IPS` | Optional exact proxy addresses for safe forwarded-client resolution; ignore forwarding headers by default |

Start `api/_build/prod/rel/teleprompter/bin/teleprompter start`. The runtime no longer silently assumes `example.com`/`PHX_HOST`: missing or invalid `PUBLIC_ORIGIN` fails startup. `IZZY_MODE=public` is the default and requires HTTPS outside loopback. The separate, explicit `IZZY_MODE=lan` profile permits trusted private IPv4 HTTP; use the launcher and constraints in `OFFLINE_LAN.md`, not that profile for a public deployment.

A reverse proxy must terminate TLS, redirect public HTTP to HTTPS, set HSTS, and forward `/`, `/assets`, `/api`, `/health`, and WebSocket upgrades on `/socket` to the one Phoenix listener. Keep the listener on a private network/firewall; it binds all IPv4 interfaces and does not provide TLS itself. Public browser HTTP and WebSocket origins are restricted to `PUBLIC_ORIGIN`. Requests without an Origin (for example health probes/non-browser clients) are supported; origin restrictions are not a substitute for capability authorization or rate limits.

Use **one Phoenix instance** for now. Session state lives in a process on that instance; DNS discovery alone does not provide shared session ownership, replication, or multi-node recovery. Restart/deployment ends active sessions. The editor's local draft survives, and the user explicitly creates a new session.

Public defaults retain at most 32 session processes and admit 10 creation attempts per socket/proxy-resolved peer and 60 total per minute. Limits run before JSON parsing. Closing a tab does not free its retained six-hour-idle session immediately; capacity rejects new creation without evicting existing scripts. Raw JSON is limited to 3 MiB, decoded scripts to 2 MiB / 5,000 paragraphs. Configure actual proxy trust and edge limits deliberately; [ADMISSION_LIMITS.md](ADMISSION_LIMITS.md) documents configuration, recovery, privacy, and remaining boundaries.

## Routes and health

- `/`, `/display/:code`, `/remote/:code` serve the client HTML with `Cache-Control: no-store`; direct device-link refresh works without Vite.
- `/assets/*` serves Vite's fingerprinted assets with long-lived immutable caching.
- Unknown pages, missing JS/CSS, and unknown API routes stay 404. There is no catch-all returning HTML in place of a missing asset or API response.
- `/health/live` reports HTTP 200 when the application can respond.
- `/health/ready` reports HTTP 200 only when the client entry file and core PubSub/session supervision processes are present; otherwise 503. Both health responses are non-cacheable, contain no session data, and do not create sessions.
- A missing client build yields 503 `app_unavailable`, not a blank successful page. Readiness is a shallow process/artifact check, not an end-to-end WebSocket or network test.
- `/api/network` exposes LAN discovery only in trusted development/explicit LAN mode. Public production returns an empty host list, never the server's private interfaces. LAN mode also returns its configured `pairing_origin` for network-address QR links when the editor uses localhost.

## Verification

```sh
npm run test:all
npm run test:release
```

The second command builds real `MIX_ENV=prod` OTP releases in disposable temporary directories, not the normal launcher's release. Public-profile verification uses a dynamically selected loopback port and random test secret without Vite. Independent contexts check creation, direct links/reload, live editing, same-origin sockets, caching, missing-route 404s, HTTP/WebSocket foreign-origin rejection, no private-network disclosure, and readiness failure/recovery with a missing entry file. A separate LAN launcher scenario blocks external HTTP and verifies network-address pairing from localhost, playback/live editing, occupied-port refusal, and stopping only its own server. Development and ordinary local sessions are not restarted or overwritten. CI runs both commands; a CI pass is only known once the workflow actually runs.

This is not verification of public certificates, a real proxy, hosting, router isolation, physical phones, or internet-free LAN operation. No hosting provider/domain or monitoring vendor has been selected, and no deployment credentials were created.

## Remaining before public beta

Edge request/connection/handshake timeouts and rate limits, measured resource budgets, actual proxy configuration, external content-redacted monitoring/alerts, branded-browser/physical-device acceptance, and a deployment/rollback smoke test on the chosen HTTPS host remain open. Recovery UX and visible IZZY naming are implemented in Slices 5.5/5.8. Initial frame/channel/session guards and local diagnostics are documented in [REALTIME_GUARDS.md](REALTIME_GUARDS.md); they do not make this foundation a public beta.
