# Hosted beta preparation — Slice 5.9

Current scope (2026-10-11): follow [FREE_LAUNCH.md](FREE_LAUNCH.md) for the account-enabled online free release. This older document describes the guest-only baseline; its no-database/no-migration path does not launch account libraries. Hosting prices/options below are historical research, not a current quote or selected provider.

Status: 2026-10-09. **Prepared, not deployed.** No provider account, paid service, domain, registry push, or deployment credentials have been created. Local Docker CLI exists but no Docker daemon is available, so the container build and runtime smoke are **unverified**, not passed. The Linux CI job is configured but has not run remotely.

## Product topology

The hosted version is one HTTPS website serving the script page, display, phone remote, API, and secure WebSocket. A user opens it on a tablet, enters a script, scans the remote QR with a phone, and opens the display on the tablet. Their computer is not part of this topology. Both devices need access to the hosted server; they need not share Wi-Fi. This does not implement phone + tablet-only offline operation.

Keep exactly **one always-running application instance**, in one region, with no autoscaling or idle suspension. Session processes live in its memory. More replicas would split session ownership; a database/Redis alone would not fix the current routing/state model. Deployment, restart, crash, or rollback ends active sessions. The browser's script draft remains recoverable, but the live session is not durable. Deploy between recording sessions and announce that interruption.

## Hosting shortlist

Research checked on 2026-10-09; these are options, not purchases or provisioned resources. Prices exclude possible traffic/build/storage/tax charges and should be rechecked at purchase. Account, payment, and regional availability must be confirmed by the user.

| Option | Fit for this beta | Initial compute reference |
| --- | --- | --- |
| Render paid web service | My simplest operational recommendation: Docker support, one service, managed HTTPS, WebSockets, dashboard deployment/rollback | The listed 0.5 CPU / 512 MB tier is $7/month. This is a starting experiment, not a proven IZZY capacity estimate. [Pricing](https://render.com/pricing), [WebSockets](https://render.com/docs/websocket), [TLS](https://render.com/docs/tls) |
| Fly.io | Good alternative for Phoenix and explicit regional/machine control; more deployment settings to manage | The pricing table lists shared CPU / 1 GB around $5.92 per 30 days in one regional selection; prices vary by region. Disable autostop and keep one machine. [Pricing](https://fly.io/docs/about/pricing/), [Autostop](https://fly.io/docs/reference/fly-proxy-autostop-autostart/) |

I would not use Render's Free service for recording sessions: it can spin down after 15 idle minutes and can take roughly a minute to resume. Idle suspension loses IZZY's in-memory sessions. [Free-service limits](https://render.com/docs/free)

A custom domain is optional for the first beta: Render provides a managed-TLS `onrender.com` address. Choose exactly one canonical origin and set `PUBLIC_ORIGIN` to it. If a custom domain is added later, update that origin and deliberately retire/redirect the old app address; mixing origins breaks role pairing and separates browser drafts. [Managed TLS](https://render.com/docs/tls), [Custom domains](https://render.com/docs/custom-domains)

## Portable Linux deployment image

The root `Dockerfile` uses three stages: Node builds the same-origin frontend, Elixir/OTP builds the release on Linux, and a Debian runtime receives only that release plus OS libraries. The runtime does not need Node, npm, Mix, Git, a database, or the Mac portable package. This follows [Docker's multi-stage model](https://docs.docker.com/build/building/multi-stage/) and [Phoenix release deployment](https://hexdocs.pm/phoenix/releases.html).

- Base manifests are pinned by SHA-256: Node 24.21.0, Elixir 1.19.5 / OTP 28.2, and Debian Bookworm. Registry entries were checked for Linux amd64/arm64 support. Both application build and runtime use the Bookworm family. This does not replace a successful build on each target architecture.
- `npm ci` and `mix.lock` preserve resolved application dependencies. Apt package indices and Hex/Rebar bootstrap downloads are not snapshot-pinned; this is not a fully bit-reproducible or vulnerability-audited image.
- The runtime uses non-root UID 10001, an owner-only writable `/app/tmp` for the release's runtime config, no Erlang distribution, explicit public mode, SIGTERM shutdown, and readiness health checks. VM crash dumps are disabled to avoid writing script-bearing process memory to disk.
- The build context excludes repository history, existing host releases, Mac packages, dependencies, test artifacts, and known environment/private-key file patterns. Secrets are provided only at runtime, never baked into build arguments. See `.dockerignore`; do not place secrets in application source.
- No port is published by building an image. Public TLS, connection/handshake policy, resource limits, and monitoring still belong to the selected hosting topology.

On a machine with a running Docker runtime:

```sh
docker build --tag izzy:local .
npm ci
npx playwright install chromium
npm run test:container
```

`IZZY_CONTAINER_IMAGE` can select an already-built image instead of the default `izzy:local`. The test creates a uniquely named container, publishes only a dynamically chosen **loopback** host port, and uses a generated test-only secret. It checks readiness/health, non-root execution, absence of build tools, static assets, origin rejection, independent tablet/phone surfaces, playback, live corrections before Done, reload, explicit session loss with draft recovery after restart, and clean stop. Cleanup removes only its exact owned container ID, not unrelated containers or images. It does not prune Docker resources.

The smoke applies 512 MB / one CPU limits as a first functional envelope, not a production load benchmark. It uses HTTP/WS on loopback, not a real TLS proxy or public phone connection. The CLI deliberately fails when Docker is unavailable instead of counting an environment skip as success.

The GitHub workflow's `container` job builds and tests the image on Linux after the normal client/server/browser/release job. It does **not** publish an image or deploy a service. Passing local policy-string/unit checks does not establish that the Linux image works; inspect the actual CI result before deployment. The first CI image is amd64 only; arm64 runtime acceptance remains open.

## Render setup after user approval

Do not create the service until the user approves provider/cost and the first image smoke passes. These are saved settings, not an executed setup:

- Git repository: `https://github.com/grixate/izzyprompter.git`, with the approved changes committed/pushed explicitly.
- Service: Docker web service; build context repository root; Dockerfile `./Dockerfile`; no custom start command.
- Region: choose close to intended testers, not automatically from the developer's current network. One instance, no autoscaling.
- Compute: paid always-running tier. Start small only after measuring memory with representative scripts/devices; raise RAM or lower retained-session capacity as needed.
- Automatic deploys: **off** during the beta, so a routine push cannot interrupt a recording.
- Health check: `/health/ready`; start command is the image's `bin/teleprompter start`. No database or migrations.

Render's Docker service uses the image's `CMD` unless overridden; health paths and manual deployment are configurable. [Docker deployment behaviour](https://render.com/docs/deploys), [Health checks](https://render.com/docs/health-checks)

Set private runtime values in the hosting dashboard:

| Variable | Value / handling |
| --- | --- |
| `PUBLIC_ORIGIN` | Exact chosen `https://…` website origin, no trailing slash/path/hash |
| `SECRET_KEY_BASE` | Generate at least 64 bytes of random secret input (`mix phx.gen.secret` or Node crypto); store only in the provider's secret field |
| `PORT` | Let the platform supply its listener port; the app and health check use it |
| `IZZY_MODE` | `public` (already the image default); never `lan` |
| `IZZY_MAX_SESSIONS` | Consider a conservative beta cap such as 8 until memory/traffic is measured; this is not a capacity guarantee |
| `IZZY_TRUSTED_PROXY_IPS` | Leave unset until the exact forwarding chain has been verified; never trust arbitrary client-supplied forwarding headers |

Do not use Render Blueprint `generateValue: true` directly for `SECRET_KEY_BASE`: its documented generated string is 44 characters, below IZZY's 64-byte runtime minimum. Generate a suitable value explicitly instead. [Blueprint secret generation](https://render.com/docs/blueprint-spec#generating-random-secrets)

Without verified proxy trust, creation attempts may share the proxy peer's rate budget. This is conservative but can reject legitimate simultaneous testers. Solve it using the actual deployment's exact trusted proxy addresses or a deliberately designed provider-aware resolver—not a wildcard/CIDR trust shortcut or disabled quotas.

## Acceptance and rollback gate

Before distributing the beta link:

1. Pass the Linux container smoke and keep its immutable application image/approved source revision recorded. Check readiness, valid HTTPS certificates, HTTP redirects/HSTS, and secure same-origin WebSockets on the chosen host.
2. Inspect the actual proxy path: direct internal listener not public, forwarding headers not spoofable, explicit edge connection/handshake limits/timeouts. Existing frame/message budgets do not bound all unauthenticated sockets.
3. Review provider/framework access and error logs using synthetic content. No script text, patches, capability fragments, session/device IDs, or full URLs in analytics/error reporting. Review retention and operator access before adding a monitoring vendor. Test resource exhaustion alerts using aggregate data.
4. Measure RSS/CPU/egress with representative long scripts, multiple devices, concurrent sessions, reconnect storms, and invalid connections. Do not load-test a shared/public target without explicit scope/authorization.
5. Run tablet + phone on real networks, including different Wi-Fi/mobile data, lock/app switching, orientation, paste/IME, and browser fullscreen/wake-lock limitations. Physical testing remains deferred until the user resumes it; do not mark it passed from browser emulation.
6. During an agreed interruption window, deploy a new revision, verify old sessions end explicitly without overwriting their drafts, start a new session, and test live edits. Roll back to the recorded prior revision/image, then repeat readiness and new-session checks. Rollback restores code, **not** an in-memory session.

For Render, rollback/manual specific-commit deployment must keep auto-deploy disabled, otherwise a later push can reintroduce the reverted version. [Manual deployments](https://render.com/docs/deploys#deploying-a-specific-commit)

This slice prepares an online deployment path, not public-beta acceptance. Edge policy, measured resources, public monitoring, actual host/rollback, and resumed physical-device testing remain required. Further offline work stays parked.
