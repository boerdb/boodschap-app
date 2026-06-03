#!/usr/bin/env python3
"""Seed Ben en Ineke op MariaDB (192.168.1.14)."""
import os
import sys
from pathlib import Path

import paramiko

DB_HOST = os.environ.get("DB_HOST", "192.168.1.14")
PASSWORD = os.environ.get("DB_SSH_PASSWORD", "kerkpoort")
USER = os.environ.get("DB_SSH_USER", "root")
SQL_FILE = Path(__file__).resolve().parent.parent / "sql" / "seed-users.sql"


def main() -> int:
    sql = SQL_FILE.read_text(encoding="utf-8")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(DB_HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = ssh.open_sftp()
    remote = "/tmp/boodschap-seed-users.sql"
    with sftp.file(remote, "w") as f:
        f.write(sql)
    sftp.close()
    cmd = f"mysql -uroot -p{PASSWORD} < {remote} && rm -f {remote}"
    _, o, e = ssh.exec_command(cmd)
    print(o.read().decode())
    err = e.read().decode()
    if err.strip():
        print(err, file=sys.stderr)
    verify = (
        "mysql -uroot -pkerkpoort boodschap -e "
        "\"SELECT u.display_name, h.invite_code FROM users u "
        "JOIN household_members hm ON hm.user_id=u.id "
        "JOIN households h ON h.id=hm.household_id "
        "WHERE h.invite_code='THUIS' ORDER BY u.display_name;\""
    )
    _, o2, _ = ssh.exec_command(verify)
    print(o2.read().decode())
    ssh.close()
    print("Gebruikers Ben en Ineke zijn klaar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
