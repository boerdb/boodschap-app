#!/usr/bin/env python3
"""Deploy via git pull op NEXT-server (192.168.1.32) naar /var/www/boodschap-app."""
import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "192.168.1.32")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "kerkpoort")
REMOTE_DIR = os.environ.get("DEPLOY_DIR", "/var/www/boodschap-app")
DB_HOST = os.environ.get("DB_HOST", "192.168.1.14")
GIT_REPO = os.environ.get(
    "GIT_REPO", "git@github.com:boerdb/boodschap-app.git"
)
GIT_BRANCH = os.environ.get("GIT_BRANCH", "main")
PORT = os.environ.get("APP_PORT", "3008")
DB_APP_PASSWORD = os.environ.get("DB_APP_PASSWORD", "kerkpoort")


def run(ssh: paramiko.SSHClient, cmd: str, check: bool = True, timeout: int = 900):
    print(f"$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip() and code != 0:
        print(err.rstrip(), file=sys.stderr)
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return code, out, err


def main() -> int:
    env_content = f"""DATABASE_URL=mysql://boodschap:{DB_APP_PASSWORD}@{DB_HOST}:3306/boodschap
NODE_ENV=production
APP_TIMEZONE=Europe/Amsterdam
PORT={PORT}
"""

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Verbinden met {USER}@{HOST}…")
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(ssh, "mkdir -p /var/www")
    _, out, _ = run(
        ssh, f"test -d {REMOTE_DIR}/.git && echo yes || echo no", check=False
    )
    if "yes" in out:
        run(
            ssh,
            f"cd {REMOTE_DIR} && git fetch origin && git checkout {GIT_BRANCH} "
            f"&& git pull origin {GIT_BRANCH}",
        )
    else:
        run(ssh, f"rm -rf {REMOTE_DIR}")
        run(ssh, f"git clone -b {GIT_BRANCH} {GIT_REPO} {REMOTE_DIR}")

    run(
        ssh,
        f"cat > {REMOTE_DIR}/.env.local << 'ENVEOF'\n{env_content}ENVEOF",
    )

    code, _, _ = run(ssh, "node -v", check=False)
    if code != 0:
        print("Node.js installeren…")
        run(ssh, "apt-get update -qq", timeout=600)
        run(ssh, "apt-get install -y -qq ca-certificates curl git", timeout=600)
        run(ssh, "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -", timeout=600)
        run(ssh, "apt-get install -y -qq nodejs", timeout=600)

    run(ssh, f"cd {REMOTE_DIR} && npm ci", timeout=600)
    run(ssh, f"cd {REMOTE_DIR} && npm run build", timeout=600)

    run(ssh, "npm install -g pm2", check=False)
    run(
        ssh,
        f"cd {REMOTE_DIR} && pm2 delete boodschap-app 2>/dev/null; "
        f"pm2 start ecosystem.config.cjs && pm2 save",
        check=False,
    )

    run(ssh, "pm2 list", check=False)
    ssh.close()
    print(f"\nKlaar: http://{HOST}:{PORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
