#!/bin/bash
set -euo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
case "${1:-}" in full|incr) backup_type=$1 ;; *) echo 'Use full or incr' >&2; exit 1 ;; esac
exec 9>/run/lock/izzy-pg-backup.lock
flock -w 600 9
nice -n 10 runuser -u postgres -- pgbackrest --stanza=izzy --repo=1 --type="$backup_type" backup
echo "IZZY encrypted $backup_type backup completed."
