#!/usr/bin/env python3
"""git pull + build + pm2 restart op .32"""
import sys
import paramiko

HOST, USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
REMOTE_DIR = "/var/www/boodschap-app"

def safe_print(t: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(t.encode(enc, errors="replace").decode(enc, errors="replace"))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
for cmd in [
    f"cd {REMOTE_DIR} && git pull origin main",
    f"cd {REMOTE_DIR} && npm ci",
    f"cd {REMOTE_DIR} && npm run build",
    "pm2 restart boodschap-app",
]:
    safe_print(f"$ {cmd}")
    _, o, e = ssh.exec_command(cmd, timeout=600)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-4000:] if len(out) > 4000 else out.strip())
    if err.strip() and code != 0:
        safe_print("ERR: " + err[-1500:])
    safe_print(f"exit {code}\n")
    if code != 0:
        raise SystemExit(code)
ssh.close()
