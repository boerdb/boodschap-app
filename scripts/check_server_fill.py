#!/usr/bin/env python3
"""Controleer of cron/sync al data heeft gevuld op de server."""
import sys
import paramiko

HOST, USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
REMOTE = "/var/www/boodschap-app"


def safe_print(t: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(t.encode(enc, errors="replace").decode(enc, errors="replace"))


def run(ssh, cmd: str, timeout: int = 120) -> tuple[int, str]:
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    return code, (out + err).strip()


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    safe_print("=== Cron (/etc/cron.d/boodschap-prices) ===")
    _, text = run(ssh, "cat /etc/cron.d/boodschap-prices 2>/dev/null || echo '(ontbreekt)'")
    safe_print(text)

    safe_print("\n=== Sync-log (cron schrijft hierheen) ===")
    _, text = run(
        ssh,
        "if [ -f /var/log/boodschap-sync.log ]; then wc -l /var/log/boodschap-sync.log; tail -20 /var/log/boodschap-sync.log; else echo 'Log nog leeg — cron nog niet gedraaid of geen output'; fi",
    )
    safe_print(text)

    safe_print("\n=== Redis Checkjebon ===")
    _, text = run(ssh, f"cd {REMOTE} && npm run test:redis 2>&1 | tail -12")
    safe_print(text)

    safe_print("\n=== MariaDB vulling ===")
    db_cmd = (
        f"mysql -h 192.168.1.14 -u boodschap -pkerkpoort boodschap -N -e "
        "\"SELECT CONCAT('checkjebon: ', IFNULL(byte_size,0), ' bytes, stores=', IFNULL(store_count,0), ', synced=', synced_at) FROM checkjebon_dataset WHERE id=1; "
        "SELECT CONCAT('price_cache: ', COUNT(*), ' rijen') FROM price_cache; "
        "SELECT CONCAT('barcodes op lijst: ', COUNT(*)) FROM list_items WHERE barcode IS NOT NULL AND barcode <> '';\""
    )
    code, text = run(ssh, db_cmd)
    safe_print(text if text else f"mysql exit {code}")

    safe_print("\n=== sync:ah-eans (cron 06:00) — handmatig draaien? ===")
    _, text = run(
        ssh,
        f"cd {REMOTE} && npm run sync:ah-eans 2>&1 | tail -15",
        timeout=180,
    )
    safe_print(text)

    ssh.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
