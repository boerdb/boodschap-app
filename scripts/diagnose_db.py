#!/usr/bin/env python3
"""Controleer boodschap-database op DB-server."""
import os
import sys

import paramiko

DB_HOST = os.environ.get("DB_HOST", "192.168.1.14")
PASSWORD = os.environ.get("DB_SSH_PASSWORD", "kerkpoort")
USER = os.environ.get("DB_SSH_USER", "root")


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(DB_HOST, username=USER, password=PASSWORD, timeout=30)
    cmd = (
        "mysql -uroot -pkerkpoort boodschap -e "
        "'SHOW TABLES; SELECT COUNT(*) AS households FROM households; "
        "SELECT COUNT(*) AS items FROM list_items;'"
    )
    _, o, e = ssh.exec_command(cmd)
    print(o.read().decode())
    err = e.read().decode()
    if err:
        print(err, file=sys.stderr)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
