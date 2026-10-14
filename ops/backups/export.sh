#!/bin/bash
set -euo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
exec 9>/run/lock/izzy-pg-backup.lock
flock -w 600 9
# Backup expiry cannot delete files during this copy. The archiver only adds
# completed files atomically; unfinished temporary files are excluded.
runuser -u postgres -- pgbackrest --stanza=izzy check >/dev/null
tar --exclude='*.tmp' --exclude='*.partial' -C /var/lib/pgbackrest -cf - izzy
