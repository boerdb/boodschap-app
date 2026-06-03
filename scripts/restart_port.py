#!/usr/bin/env python3
"""Herstart boodschap-app op de juiste poort op de server."""
import sys
import paramiko

HOST, USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
REMOTE_DIR = "/var/www/boodschap-app"
PORT = "3009"

def safe_print(text: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(text.encode(enc, errors="replace").decode(enc, errors="replace"))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    f"grep -q '^PORT={PORT}' {REMOTE_DIR}/.env.local || "
    f"(sed -i '/^PORT=/d' {REMOTE_DIR}/.env.local; "
    f"echo 'PORT={PORT}' >> {REMOTE_DIR}/.env.local)",
    f"cd {REMOTE_DIR} && git pull origin main",
    f"cd {REMOTE_DIR} && pm2 delete boodschap-app 2>/dev/null; pm2 start ecosystem.config.cjs && pm2 save",
    f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{PORT}/login",
    f"ss -tlnp | grep ':{PORT} '",
]
for cmd in cmds:
    safe_print(f"$ {cmd}")
    _, o, e = ssh.exec_command(cmd, timeout=120)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out:
        safe_print(out.strip())
    if err.strip() and code != 0:
        safe_print("ERR: " + err.strip())
    safe_print(f"exit {code}\n")

ssh.close()
safe_print(f"App: http://{HOST}:{PORT}")
