#!/usr/bin/python3
"""Send recovery secrets only over the owner's SSH connection to a private file.

Do not run interactively: stdout contains credentials and backup encryption keys.
"""
import json
import os
from pathlib import Path

if os.geteuid() != 0 or os.isatty(1):
    raise SystemExit("Use the private backup client over SSH")

paths = [
    "/etc/pgbackrest/pgbackrest.conf",
    "/etc/izzy/app.env",
    "/etc/izzy/database.env",
    "/etc/izzy-staging/app.env",
    "/etc/izzy-staging/database.env",
    "/etc/postgresql/17/main/pg_hba.conf",
    "/etc/postgresql/17/main/conf.d/izzy-staging.conf",
    "/etc/postgresql/17/main/conf.d/izzy-backup.conf",
    "/opt/izzy/compose.yaml",
    "/opt/izzy-staging/compose.yaml",
    "/opt/izzy-staging/.env",
]
print(json.dumps({name: Path(name).read_text() for name in paths}))
