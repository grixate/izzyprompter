# IZZY development and release workflow

Keep the public release running while changes move through local development,
automated checks, private staging, owner review, and an explicitly approved
production release. Git pushes and merges do not deploy production.

## Current environments

| Environment | Address | Purpose |
| --- | --- | --- |
| Local | Vite/Phoenix on this Mac | Implementation and fast iteration |
| Staging | https://staging.izzyprompter.com | Authenticated review on real devices |
| Production | https://izzyprompter.com | Approved public release |

Staging starts with the same immutable image as production. It is a different
container, Docker network, loopback port, origin, and secret. Sessions and browser
drafts are separate. Staging is capped at 512 MB, half a CPU, and four retained
sessions. Both containers share one VPS, so heavy load experiments need separate
resources and explicit scope.

Staging requires the `izzy-review` HTTP Basic login over valid HTTPS. Its password
is in `~/.ssh/izzy_staging_access.json` on this Mac (mode 0600), outside the repo.
The server holds only the password hash in `/etc/caddy/staging-users`; Caddy
removes the Authorization header before proxying to Phoenix. Every route,
including assets, health, API, and WebSockets, requires authentication. Response
headers discourage indexing and shared caching. On a phone, open staging and
enter the same login before using a pairing link.

HTTP Basic protection can interfere with the offline preview's credential-free
cache requests. Use the local offline test suite for offline acceptance; do not
weaken staging authentication to make a worker install succeed. A physical
device check is still required for mobile acceptance.

## Baseline and backups

`v0.1.0-live` identifies commit `1f95ab272e5187c52ec769cc0c2bf21e7ca804e4`,
the saved guest-launch baseline. All 136 files from the deployed source archive
were compared byte-for-byte with that baseline. The image and individual source
hashes are recorded in `ops/releases/v0.1.0-live.json`.

The source and tag are backed up to the existing GitHub repository. The initial
GitHub run exposed an outdated container policy assertion and browser tests that
tried to click an auto-hidden toolbar. Follow-up test changes fix the assertion
and activate settings through focus, without changing application source or the live image.
Do not move the baseline tag to hide that history.

The original Docker image is also saved on the server and this Mac:

- Server: `/opt/izzy/backups/izzy-20261013-9c32196c.tar.gz`
- Mac: `artifacts/releases/izzy-20261013-9c32196c.tar.gz` (ignored by Git)
- SHA-256: `984ab6ad2d30abeb03861b62a1ddb7273987cf43967191ba129816c71d4fd26b`

`gzip -dc IMAGE.tar.gz | docker image load` restores the image. Loading an image
does not start or deploy it. Runtime secrets are separate from this image backup;
preserve `/etc/izzy/app.env` through an approved secure backup process as well.
The initial guest release had no account database. The owner-approved VPS
account rollout, protected database settings, encrypted backups and verified
restore drill are described in ACCOUNT_OPERATIONS.md. Future releases must
preserve those recovery and migration/rollback controls.

## Each correction or feature

1. Start a focused `codex/` branch from up-to-date `main`. Agree on the expected
   behavior, implement locally, and run checks appropriate to the change.
2. Commit and push the branch, open a pull request, and inspect the GitHub checks.
   CI runs client/server tests, dependency audits, browser checks, offline checks,
   release smoke, container smoke, and separate PostgreSQL-backed account checks.
3. Build a candidate from a recorded commit, not an uncommitted working tree.
   Use a unique image tag such as `izzy:git-COMMIT_SHA`; never overwrite a release
   tag. Retain the commit, image ID, source checksum, and validation evidence.
4. Deploy that image to staging only. Keep its selection in
   `/opt/izzy-staging/.env` as `IZZY_IMAGE=izzy:git-COMMIT_SHA`, then run
   `docker compose -f /opt/izzy-staging/compose.yaml up -d` on the server.
   Confirm readiness and run the hosted smoke below. Review on the owner's
   actual tablet/phone for changes that affect prompting or interaction.
5. Merge after checks and review. A merge does not change production. Record
   which image has approval, even if the merge produces a different Git SHA.
6. After explicit publication approval, promote the exact staging-tested image
   ID to production. Do not rebuild it for production. Record the previous
   image, switch the image in `/opt/izzy/compose.yaml`, and run its Compose update
   between takes. Keep runtime secrets and the canonical production origin.
7. Verify public health and the critical hosted flow; record the release/tag.
   If the check fails, restore the previous image selection and repeat checks.
   Code rollback cannot undo database migrations or restore in-memory sessions.

Build candidates in a suitable CI/build environment where possible. Large builds
on the shared VPS can contend with production; do not run test suites or load
tests there against the live application. The GitHub container job retains its
successfully tested image as a seven-day `izzy-candidate-RUN_ID` artifact. It
includes `image.tar.gz`, a tracked-source archive, SHA-256 checksums and
`release.json` recording the source commit and Docker image ID. Pull-request
builds record the actual checked-out merge commit. Download the artifact,
validate its checksums, load the image and confirm its ID before choosing it
for staging. Keep a protected host copy for rollback; artifact retention is not
a release backup. The workflow has no server credentials, registry publication
or deployment steps.

## Hosted verification

From this repository on the Mac, with Playwright installed:

```sh
node scripts/verify-hosted.mjs
```

For a reviewed account-enabled release, set `IZZY_EXPECT_ACCOUNTS=1`. This changes
only the expected account-availability check; it does not create users, enable
accounts, or replace real delivered-email acceptance.

The default is authenticated staging. It creates one synthetic guest session,
checks anonymous refusal, readiness, secure pairing, actual playback, phone live
edits, reload, and foreign-origin refusal. Credentials and pairing fragments are
not printed. The script closes browser contexts but does not restart the app;
the synthetic session expires through normal inactivity cleanup.

Production verification requires explicit opt-in:

```sh
IZZY_SMOKE_ORIGIN=https://izzyprompter.com IZZY_VERIFY_PRODUCTION=1 \
  node scripts/verify-hosted.mjs
```

## Operations

Use `ssh izzy-production`, then `sudo` for administration:

```sh
sudo docker compose -f /opt/izzy/compose.yaml ps
sudo docker compose -f /opt/izzy-staging/compose.yaml ps
curl --fail http://127.0.0.1:4000/health/ready
curl --fail http://127.0.0.1:4001/health/ready
sudo docker stats --no-stream
```

App containers start automatically. A staging restart affects only staging
sessions. Caddy configuration changes should be validated first, then applied
with `systemctl reload caddy`; existing WebSockets may briefly reconnect on a
proxy reload, while app session state remains alive. Avoid unnecessary proxy
reloads for ordinary image updates.

To disable staging alone, stop its Compose service. Its proxy will return 502
after authentication; production remains available. For full staging removal,
remove only its Caddy site block and DNS record after an approved configuration
change. Do not stop the shared Caddy service to disable staging.
