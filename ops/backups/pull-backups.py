#!/usr/bin/env python3
"""Owner's Mac: copy encrypted backups and recovery secrets without logging them."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile

os.umask(0o077)
root = Path(__file__).resolve().parent / "snapshots"
root.mkdir(mode=0o700, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
archive = root / ("encrypted-repository-" + stamp + ".tar")
recovery = root / ("recovery-" + stamp + ".json")
temporary = archive.with_suffix(".partial")
ssh = ["/usr/bin/ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "izzy-production", "sudo"]
try:
    with temporary.open("xb") as stream:
        result = subprocess.run(ssh + ["/usr/local/sbin/izzy-export-backups"], stdout=stream, stderr=subprocess.PIPE, timeout=600)
    if result.returncode:
        raise RuntimeError("Encrypted repository export failed; previous copies retained")
    with tarfile.open(temporary) as repository:
        if not any(member.name.endswith("backup.info") for member in repository):
            raise RuntimeError("Repository copy is incomplete")
    result = subprocess.run(ssh + ["/usr/local/sbin/izzy-recovery-files"], capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError("Recovery material copy failed; previous copies retained")
    material = json.loads(result.stdout)
    if "/etc/pgbackrest/pgbackrest.conf" not in material:
        raise RuntimeError("Recovery material is incomplete")
    with recovery.open("x") as stream:
        json.dump(material, stream)
    temporary.rename(archive)
    with archive.open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    (root / "last-success.json").write_text(json.dumps({"copied_at": stamp, "archive": archive.name, "sha256": checksum, "bytes": archive.stat().st_size}, indent=2) + "\n")
    for old in sorted(root.glob("encrypted-repository-*.tar"))[:-3]:
        old_stamp = old.stem.removeprefix("encrypted-repository-")
        old.unlink()
        (root / ("recovery-" + old_stamp + ".json")).unlink(missing_ok=True)
    print("Encrypted IZZY backup and protected recovery material copied successfully.")
except Exception:
    temporary.unlink(missing_ok=True)
    if not archive.exists():
        recovery.unlink(missing_ok=True)
    raise SystemExit("IZZY backup copy failed; previous successful copies retained. Check SSH access and private backup logs.")
