#!/usr/bin/python3
"""Private operator check. Output contains aggregate backup state only."""
import json
import os
import subprocess
import time

if os.geteuid() != 0:
    raise SystemExit("Run as root")

result = subprocess.run(
    ["runuser", "-u", "postgres", "--", "pgbackrest", "--stanza=izzy", "check"],
    capture_output=True,
)
if result.returncode:
    raise SystemExit("IZZY WAL archive check failed; inspect protected backup logs")

info = subprocess.check_output(
    ["runuser", "-u", "postgres", "--", "pgbackrest", "--stanza=izzy", "--output=json", "info"],
    text=True,
)
stanza = json.loads(info)[0]
backups = stanza.get("backup", [])
age = time.time() - max((item["timestamp"]["stop"] for item in backups), default=0)
disk = os.statvfs("/var/lib/postgresql")
free = disk.f_bavail * disk.f_frsize
ok = stanza["status"]["code"] == 0 and age < 26 * 3600 and free > 5 * 1024**3
print(json.dumps({"healthy": ok, "backup_age_hours": round(age / 3600, 2), "disk_free_gib": round(free / 1024**3, 2), "cipher": stanza.get("cipher")}))
raise SystemExit(0 if ok else 1)
