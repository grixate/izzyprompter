# IZZY server setup — 2026-10-13

The guest application is live at **https://izzyprompter.com**, activated with
owner approval on 2026-10-13. Phoenix runs behind Caddy on a private listener.
Accounts and payments are disabled; this is not the account-enabled free launch.
Private staging and the ongoing development process are documented in
[the release workflow](RELEASE_WORKFLOW.md).

## Host and access

- Server: `159.195.86.205`, Debian 13.7, amd64, 2 CPUs, approximately 4 GB RAM.
- Canonical domain: `izzyprompter.com`; apex and `www` A records resolve to this
  server. DNS is managed by REG.ru; no AAAA record was observed.
- This Mac has the SSH alias `izzy-production`, using `izzyadmin` and the
  dedicated key at `~/.ssh/izzy_production_ed25519`.
- Connect with `ssh izzy-production`; administration uses `sudo`.
- Admin access was verified before password and keyboard-interactive SSH
  authentication were disabled. Root key access is retained for recovery.
- UFW permits inbound TCP 22, 80, and 443 only, for IPv4 and IPv6.
- Automatic package security updates are enabled. Reboots are not automatic.

Do not commit private keys or `/etc/izzy/app.env`. The environment file is
root-owned, mode 0600, and contains a stable, randomly generated production
secret. No server secrets were copied into the repository or chat.

## Runtime

- Docker Engine and Compose are installed from Docker's official Debian repo.
- The one application container is unprivileged, has a read-only root filesystem,
  drops Linux capabilities, has bounded CPU/memory/processes/logs, and restarts
  automatically. Its HTTP port is bound to `127.0.0.1:4000` only.
- Compose configuration: `/opt/izzy/compose.yaml`; reviewable copy:
  [`../ops/compose.yaml`](../ops/compose.yaml).
- Network: `172.30.0.0/24`, gateway `172.30.0.1`. This exact gateway is configured
  as the trusted proxy peer. Caddy explicitly replaces X-Forwarded-For with the
  connection's remote host. The container's actual upstream connections were
  observed coming from this gateway after public activation.
- Caddy is configured for canonical HTTPS, a `www` redirect, HSTS, request/header
  limits, timeouts, and WebSocket proxying. Configuration validation passed.
  Caddy is active and enabled at boot. Reviewable configuration:
  [`../ops/Caddyfile`](../ops/Caddyfile).
- PostgreSQL 17 is installed and listens on loopback only. No application database
  or account credentials have been created. SMTP, migrations, backups, and a real
  restore must be completed before enabling accounts.
- Payments, Google sign-in, and accounts are disabled. Sessions remain in memory
  and end on container restart. The retained-session cap is initially 8; this is
  not a measured capacity guarantee.

## Source and verification

The image was built from an allowlisted snapshot of the current working tree,
including uncommitted work at deployment time. That source is now preserved in
commit `1f95ab272e5187c52ec769cc0c2bf21e7ca804e4` and tag `v0.1.0-live`, backed up
to GitHub. All 136 archived source files matched the saved baseline byte-for-byte.

- Image: `izzy:20261013-9c32196c`
- Image ID: `sha256:4480c30344efcc9e26282c6cb539cdc1d1dd61038e9a42ba7ef1a9245478515e`
- Source archive: `/opt/izzy/source-20261013-9c32196c.tar.gz`
- Archive SHA-256: `9c32196cf5b35ae2affc369673ca8431f2782d0e26454c02aee2cb97c0acbe06`
- Extracted source: `/opt/izzy/releases/20261013-9c32196c`
- Build log: `/opt/izzy/build-20261013-9c32196c.log`

The Linux image built successfully. The existing container smoke test passed
against the real server through an SSH tunnel: unprivileged runtime, health,
same-origin editor/display/remote pairing, playback, phone live edits, reload,
foreign-origin rejection, explicit session loss on restart, draft recovery, and
clean shutdown. The production Compose container also returned readiness 200;
`/`, `/local`, the offline manifest/icon/service worker all returned 200, and the
account API confirmed that sign-in is disabled.

After public activation, a separate Chromium smoke passed against the real
HTTPS site using independent editor, tablet display, and emulated phone contexts:
secure pairing links, WSS-only sockets, actual display movement, phone live edits,
remote/display reload, and zero JavaScript errors. Public checks also confirmed
readiness 200, HTTP-to-HTTPS 308, HTTPS `www`-to-apex 301, HSTS/CSP, and rejection
of foreign HTTP and WebSocket origins with 403. Certificates for both names
verified through the system trust store; issuer is Let's Encrypt, with initial
expiry on 2027-01-11. Caddy handles renewal automatically.

These browser checks do not replace physical iPad/iPhone acceptance.

## Private staging

`https://staging.izzyprompter.com` now runs the same image in a separate,
resource-limited container on `127.0.0.1:4001`. Its network is `172.31.0.0/24`
with gateway `172.31.0.1`; its secrets are in `/etc/izzy-staging/app.env` and
Compose configuration in `/opt/izzy-staging/compose.yaml`. Accounts and payments
are disabled there too. The REG.ru staging A record points to the same VPS.

All staging routes require HTTP Basic authentication over verified HTTPS.
Credentials are stored on this Mac at `~/.ssh/izzy_staging_access.json`, mode
0600; the server keeps the password hash in `/etc/caddy/staging-users` only.
The authenticated three-context hosted smoke passed, including pairing,
playback, live edits, and reload. Anonymous pages, API, assets, and WebSocket
handshakes returned 401. The production container was not restarted.

The original image is saved on the server and this Mac; backup paths and
SHA-256 are recorded in the release workflow. These are code/image backups,
not a complete backup of server secrets or a future account database.

To repeat the container smoke test, use two local terminals. Port 4400 must be
free on both machines. The test starts and removes its own disposable container;
it does not restart the production container.

```sh
ssh -N -L 127.0.0.1:4400:127.0.0.1:4400 izzy-production
```

```sh
DOCKER_HOST=ssh://root@izzy-production \
  IZZY_CONTAINER_PORT=4400 \
  IZZY_CONTAINER_IMAGE=izzy:20261013-9c32196c npm run test:container
```

## Operations and rollback

On the server:

```sh
sudo docker compose -f /opt/izzy/compose.yaml ps
curl --fail http://127.0.0.1:4000/health/ready
sudo docker stats --no-stream
```

Both Caddy and the application start automatically. The container and PostgreSQL
listeners remain bound to loopback; Docker's NAT rule for port 4000 explicitly
matches destination 127.0.0.1. An external HTTP request to the raw port timed out
without returning application data. TCP-only probes from this Mac reported
success even on the blocked database port, so those probes are not reliable
evidence of external port isolation; repeat from an independent network.
Additional public traffic protection, operational alerts, representative load,
independent port isolation, and physical iPad/iPhone acceptance remain open
operational checks.

For an emergency stop of both public hostnames, stop Caddy with
`sudo systemctl disable --now caddy`. Retain the source archive and immutable
image. Future application changes should retain the previous tested image and
be deployed between takes: application restarts always end live sessions.
