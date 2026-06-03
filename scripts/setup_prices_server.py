#!/usr/bin/env python3
"""Migraties, REDIS_URL, eerste sync:prices en cron op .32 / MariaDB .14."""
import sys
import paramiko

NEXT_HOST, NEXT_USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
DB_HOST, DB_USER = "192.168.1.14", "root"
REMOTE_DIR = "/var/www/boodschap-app"
DB_APP_PASSWORD = "kerkpoort"
CRON_FILE = "/etc/cron.d/boodschap-prices"


def safe_print(t: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(t.encode(enc, errors="replace").decode(enc, errors="replace"))


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 900) -> int:
    safe_print(f"$ {cmd}")
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-4000:] if len(out) > 4000 else out.strip())
    if err.strip() and code != 0:
        safe_print("ERR: " + err[-1500:])
    safe_print(f"exit {code}\n")
    return code


def main() -> int:
    ssh_next = paramiko.SSHClient()
    ssh_next.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Verbinden {NEXT_USER}@{NEXT_HOST}…")
    ssh_next.connect(NEXT_HOST, username=NEXT_USER, password=PASSWORD, timeout=30)

    run(
        ssh_next,
        f"grep -q '^REDIS_URL=' {REMOTE_DIR}/.env.local 2>/dev/null || "
        f"echo 'REDIS_URL=redis://{DB_HOST}:6379' >> {REMOTE_DIR}/.env.local",
    )

    ssh_db = paramiko.SSHClient()
    ssh_db.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Verbinden {DB_USER}@{DB_HOST} (migraties)…")
    ssh_db.connect(DB_HOST, username=DB_USER, password=PASSWORD, timeout=30)

    for mig in ["002_prices.sql", "003_checkjebon_dataset.sql"]:
        local = f"sql/migrations/{mig}"
        remote_tmp = f"/tmp/boodschap_{mig}"
        sftp = ssh_db.open_sftp()
        sftp.put(local, remote_tmp)
        sftp.close()
        run(
            ssh_db,
            f"mysql -u boodschap -p'{DB_APP_PASSWORD}' boodschap < {remote_tmp} 2>&1 || "
            f"mysql boodschap < {remote_tmp} 2>&1",
            timeout=120,
        )
        run(ssh_db, f"rm -f {remote_tmp}")

    ssh_db.close()

    safe_print("Eerste sync:prices (kan 1–2 minuten duren)…")
    code = run(
        ssh_next,
        f"cd {REMOTE_DIR} && npm run sync:prices",
        timeout=600,
    )
    if code != 0:
        safe_print("sync:prices mislukt — controleer DATABASE_URL/REDIS op de server.")
        return code

    cron_body = f"""# Boodschap-app prijzen (Checkjebon + AH barcodes)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 5 * * * root cd {REMOTE_DIR} && /usr/bin/node scripts/sync-checkjebon.mjs >> /var/log/boodschap-sync.log 2>&1
0 6 * * * root cd {REMOTE_DIR} && /usr/bin/node scripts/sync-ah-eans.mjs >> /var/log/boodschap-sync.log 2>&1
"""
    sftp = ssh_next.open_sftp()
    with sftp.file(CRON_FILE, "w") as f:
        f.write(cron_body)
    sftp.close()
    run(ssh_next, f"chmod 644 {CRON_FILE}")
    run(ssh_next, "pm2 restart boodschap-app")
    run(ssh_next, f"tail -5 /var/log/boodschap-sync.log 2>/dev/null || echo '(log nog leeg)'")

    ssh_next.close()
    safe_print("Klaar: migraties, sync, cron, pm2 restart.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
