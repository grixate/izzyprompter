# Public email sign-in operations

The owner selected the existing netcup VPS on 14 October 2026 as a budget
exception to the earlier managed-PostgreSQL plan. The owner selected encrypted
local backups for now; no cloud backup bucket or additional cloud keys were
created. Sign-in uses Postbox email links. Guest prompting remains available.
Payments stay disabled. Gmail acceptance is sufficient for this initial release.

## Database and runtime boundaries

PostgreSQL 17.11 runs on the existing Debian server. `izzy_production` and
`izzy_staging` have distinct database owners, application roles and passwords.
Each application role has CONNECT, schema USAGE, table SELECT/INSERT/UPDATE/DELETE
and sequence USAGE/SELECT; it cannot create schema objects, roles or databases,
and cannot connect to the other environment's database. Separate migrator roles
own the schema. Default grants cover future objects created by the migrator.

The database listens on loopback and the two private Docker bridge gateways
(172.30.0.1 and 172.31.0.1), never the server's public address. HBA rules require
SCRAM authentication from the corresponding private subnet and named roles.
UFW permits 5432 only on those private bridge interfaces/subnets. Public inbound
access remains 22/80/443. PostgreSQL starts after Docker so its bridge addresses
exist; its service is limited to 768 MB and one CPU. The existing app limits remain
1 GB / 1.5 CPUs for production and 512 MB / 0.5 CPU for staging.

Protected configuration (root-owned mode 0600):

- `/etc/izzy/app.env` and `/etc/izzy-staging/app.env`: runtime credentials and origins.
- Each directory's `database.env`: application and migration database URLs.
- `app.env.before-accounts-20261014`: pre-account runtime rollback copy.
- `/etc/pgbackrest/pgbackrest.conf`: backup encryption key; owned by postgres, mode 0600.

Staging retains HTTP Basic protection, its own application session secret, exact
HTTPS origin, database and Docker network. The initial release uses the existing
send-only SMTP key in both protected environment files; an independent staging
SMTP key was not created after the owner chose to avoid additional cloud keys.
Rotate the existing key before 12 January 2027 at 12:00 Moscow time. It can send
only as `account@izzyprompter.com` through the verified Postbox identity.

## Tested application image

GitHub run `38566128575` passed `test`, `accounts` and `container`. Its candidate
is `izzy:git-3ebc066646e6584841f306da6866f91a9e74f716`, built from that recorded
pull-request merge commit (branch head `0106ee8`). The source and image archives,
checksums and release metadata are retained in:

`/opt/izzy/releases/3ebc066646e6584841f306da6866f91a9e74f716/`

- Image archive SHA-256: `d0a7d9eb1658fdfdcb4f469828713c1e36b825fde5bf7cc499dfd0b2c8c94d39`
- Config digest: `sha256:eb546591131b010c676153340d118b308d3df910bdfe10658831a4b4b5680c12`
- OCI manifest digest: `sha256:81d74d7debe146d5f93377c118949b50b354172e378b218729ace98cbc88b36f`

Docker 29's containerd store reports the manifest digest as image ID; the CI
engine reported the config digest. Both digests and filesystem layers were
checked against the same archive. `host-release.json` records the host identity.
Subsequent operations/documentation changes do not change this candidate's app
files. Promote this staging-tested image rather than rebuilding it.

## Backups and actual recovery evidence

pgBackRest 2.55.1 encrypts repository data with AES-256-CBC and compresses it with
zstd. `/var/lib/pgbackrest/izzy` and its spool are private to postgres. WAL is
continuously archived, with `archive_timeout=300` seconds. Source data and WAL
remain on this VPS; this is not a managed service or a guarantee against loss of
the server's disk. The tested isolated PITR restored to a timestamp before a later
synthetic script revision and matched all twelve durable tables in staging and
the empty, migrated production database. Model checks verified account isolation,
script text/revisions, trash, presets, grants and event idempotency. No app, mail or
payment workers were started in the restored instance. The small fixture recovery
completed in 9.52 seconds; this is not an RTO guarantee for a larger database.
The restore instance was stopped; its private data is retained for review.

An initial isolated startup failed because its max_connections was below the
source's value. The verified retry uses 100, matching the source. Future recovery
settings must satisfy PostgreSQL's source-parameter requirements.

Automatic server jobs:

| Job | Schedule | Purpose |
| --- | --- | --- |
| `izzy-db-backup-full.timer` | Sunday 00:15 UTC (03:15 Moscow) | Full encrypted backup |
| `izzy-db-backup-incr.timer` | Monday–Saturday 00:15 UTC | Incremental encrypted backup |
| `izzy-db-backup-health.timer` | Every 15 minutes | Force/check WAL archive, backup age and free space |

Two weekly full backups and their dependent increments/WAL are retained, giving
roughly one to two weeks of recovery history once established. The health check
fails when the newest completed backup is older than 26 hours, archive checks
fail, or free disk space falls below 5 GB. Failures appear in systemd/journald;
no email or external alert service was configured. The owner is the responsible
operator and should review failed jobs and the most recent copy timestamp.

This Mac runs `com.izzyprompter.backup` at 04:15 local time and when the job loads.
It copies the encrypted repository over the existing SSH connection and saves
recovery keys/runtime files separately in mode-0600 files. Its folder is:

`~/Library/Application Support/IZZY/Backups/`

The job retains the last three successful copies. The first copy completed and
was checked during rollout. The Mac must be awake, online and able to use SSH;
a missed or failed copy preserves the preceding successful copy. For complete
VPS/disk loss, recovery is limited to the latest successful Mac copy, rather than
the local five-minute WAL target. `snapshots/last-success.json` records its time,
archive size and checksum. Both the encrypted archive and its matching recovery
JSON are needed; keep them private and retain the tested application image.

The backup helpers are under `ops/backups/`. Never run `recovery-files.py`
interactively: its stdout contains secrets for the private SSH copy client.

## Operator checks and migration

```sh
ssh izzy-production
sudo /usr/local/sbin/izzy-db-backup-health
sudo systemctl list-timers 'izzy-db-backup-*'
sudo systemctl --failed
sudo docker compose -f /opt/izzy/compose.yaml ps
```

Before schema changes, take a full encrypted backup and verify its Mac copy.
Run migrations once using the protected migrator URL in a temporary root-owned
environment file and the exact release image. Do not print expanded Compose
configuration or put credentials in arguments. Keep payments disabled in all
restore drills. Restore to a new data directory/port with loopback-only access;
never point a restore operation at the live cluster directory. A standalone
restore configuration must set data_directory, HBA, socket, port and archive_mode
to the isolated instance, rather than inherit the source's external Debian config.

## Rollback

Retain the previous `izzy:20261013-9c32196c` image and protected runtime/Compose
copies. Re-selecting the previous image and pre-account environment returns the
public app to guest mode; it does not delete the account database or saved scripts.
Do not reverse migrations or overwrite the database as an application rollback.
App restarts end live prompting sessions, so check aggregate diagnostics and
schedule between takes. See RELEASE_WORKFLOW.md for the manual promotion process.
