#!/usr/bin/env python3
"""Draai beide boodschap-prices cronjobs eenmalig (zoals /etc/cron.d/boodschap-prices)."""
import sys
from datetime import datetime, timezone

import paramiko

HOST, USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
REMOTE = "/var/www/boodschap-app"
LOG = "/var/log/boodschap-sync.log"


def safe_print(t: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(t.encode(enc, errors="replace").decode(enc, errors="replace"))


def run(ssh: paramiko.SSHClient, label: str, cmd: str, timeout: int = 600) -> int:
    safe_print(f"\n=== {label} ===")
    safe_print(f"$ {cmd}")
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        safe_print(out)
    if err.strip() and code != 0:
        safe_print("ERR: " + err[-2000:])
    safe_print(f"exit {code}\n")
    return code


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run(ssh, "Log marker", f"echo '--- manual cron test {ts} ---' >> {LOG}")

    c1 = run(
        ssh,
        "05:00 — sync-checkjebon.mjs",
        f"cd {REMOTE} && /usr/bin/node scripts/sync-checkjebon.mjs >> {LOG} 2>&1",
        timeout=300,
    )
    run(ssh, "Log (na checkjebon)", f"tail -12 {LOG}")

    c2 = run(
        ssh,
        "06:00 — sync-ah-eans.mjs",
        f"cd {REMOTE} && /usr/bin/node scripts/sync-ah-eans.mjs >> {LOG} 2>&1",
        timeout=180,
    )
    run(ssh, "Log (na ah-eans)", f"tail -8 {LOG}")

    run(ssh, "Redis", f"cd {REMOTE} && npm run test:redis 2>&1 | tail -6")

    ssh.close()
    if c1 != 0 or c2 != 0:
        safe_print("Eén of meer jobs mislukt.")
        return 1
    safe_print("Beide cron-taken succesvol gedraaid (test).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
