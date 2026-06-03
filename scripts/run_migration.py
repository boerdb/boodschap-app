#!/usr/bin/env python3
"""Voer SQL-migraties uit op MariaDB .14."""
import os
import sys
import paramiko

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_HOST, DB_USER, PASSWORD = "192.168.1.14", "root", "kerkpoort"


def safe_print(t: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(t.encode(enc, errors="replace").decode(enc, errors="replace"))


def main() -> int:
    migs = sys.argv[1:] or ["004_preferred_stores.sql"]
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Verbinden {DB_USER}@{DB_HOST}…")
    ssh.connect(DB_HOST, username=DB_USER, password=PASSWORD, timeout=30)
    for mig in migs:
        local = os.path.join(ROOT, "sql", "migrations", mig)
        remote = f"/tmp/boodschap_{mig}"
        sftp = ssh.open_sftp()
        sftp.put(local, remote)
        sftp.close()
        safe_print(f"$ mysql boodschap < {remote}")
        _, o, e = ssh.exec_command(f"mysql boodschap < {remote} 2>&1", timeout=120)
        out = o.read().decode("utf-8", errors="replace")
        err = e.read().decode("utf-8", errors="replace")
        code = o.channel.recv_exit_status()
        if out.strip():
            safe_print(out)
        if err.strip():
            safe_print(err)
        safe_print(f"exit {code}\n")
        ssh.exec_command(f"rm -f {remote}")
        if code != 0:
            return code
    ssh.close()
    safe_print("Migraties klaar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
