#!/usr/bin/env python3
"""Schema + app-user op MariaDB (192.168.1.14), zelfde patroon als med-track-pwa."""
import os
import sys
from pathlib import Path

import paramiko

DB_HOST = os.environ.get("DB_HOST", "192.168.1.14")
DB_USER = os.environ.get("DB_SSH_USER", "root")
DB_PASSWORD = os.environ.get("DB_SSH_PASSWORD", "kerkpoort")
DB_APP_USER = os.environ.get("DB_APP_USER", "boodschap")
DB_APP_PASSWORD = os.environ.get("DB_APP_PASSWORD", "kerkpoort")
NEXT_HOSTS = os.environ.get(
    "DB_GRANT_HOSTS", "192.168.1.32,192.168.1.%,localhost"
).split(",")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = PROJECT_ROOT / "sql" / "schema.sql"


def main() -> int:
    if not SCHEMA_FILE.is_file():
        print(f"Schema niet gevonden: {SCHEMA_FILE}", file=sys.stderr)
        return 1

    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")
    grant_parts = []
    for host in NEXT_HOSTS:
        host = host.strip()
        if not host:
            continue
        grant_parts.append(
            f"CREATE USER IF NOT EXISTS '{DB_APP_USER}'@'{host}' "
            f"IDENTIFIED BY '{DB_APP_PASSWORD}';\n"
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON boodschap.* "
            f"TO '{DB_APP_USER}'@'{host}';\n"
        )
    grant_sql = "".join(grant_parts) + "FLUSH PRIVILEGES;\n"
    full_sql = schema_sql + "\n" + grant_sql

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Verbinden met {DB_HOST}…")
    ssh.connect(DB_HOST, username=DB_USER, password=DB_PASSWORD, timeout=30)

    sftp = ssh.open_sftp()
    remote_schema = "/tmp/boodschap-schema.sql"
    with sftp.file(remote_schema, "w") as f:
        f.write(full_sql)
    sftp.close()

    cmd = f"mysql -uroot -p{DB_PASSWORD} < {remote_schema} && rm -f {remote_schema}"
    print(f"$ mysql < schema + grants")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=120)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out.strip())
    if err.strip():
        print(err.strip(), file=sys.stderr)

    verify_cmd = (
        f"mysql -u{DB_APP_USER} -p{DB_APP_PASSWORD} -h127.0.0.1 boodschap "
        "-e \"SELECT invite_code, name FROM households LIMIT 5;\""
    )
    _, stdout2, stderr2 = ssh.exec_command(verify_cmd, timeout=30)
    code = stdout.channel.recv_exit_status()
    print(stdout2.read().decode())
    if stderr2.read().decode().strip():
        print(stderr2.read().decode(), file=sys.stderr)

    ssh.close()
    if code != 0:
        print("Setup mislukt.", file=sys.stderr)
        return code

    print("OK — database boodschap + user", DB_APP_USER)
    print(
        "DATABASE_URL=mysql://"
        f"{DB_APP_USER}:{DB_APP_PASSWORD}@{DB_HOST}:3306/boodschap"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
