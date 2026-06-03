#!/usr/bin/env python3
import sys
import paramiko

HOST, USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
REMOTE_DIR = "/var/www/boodschap-app"
PORT = "3009"

def safe_print(t: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(t.encode(enc, errors="replace").decode(enc, errors="replace"))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    f"cd {REMOTE_DIR} && git pull origin main",
    f"sed -i 's/PORT: 3008/PORT: {PORT}/' {REMOTE_DIR}/ecosystem.config.cjs",
    f"grep PORT {REMOTE_DIR}/ecosystem.config.cjs",
    f"sed -i '/^PORT=/d' {REMOTE_DIR}/.env.local && echo 'PORT={PORT}' >> {REMOTE_DIR}/.env.local",
    f"cd {REMOTE_DIR} && pm2 delete boodschap-app 2>/dev/null; pm2 start ecosystem.config.cjs && pm2 save",
    "sleep 2",
    f"ss -tlnp | grep ':{PORT} '",
    f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{PORT}/login",
]
for cmd in cmds:
    safe_print(f"$ {cmd}")
    _, o, e = ssh.exec_command(cmd, timeout=120)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        safe_print(out.strip())
    if err.strip() and code != 0:
        safe_print("ERR: " + err.strip())
    safe_print(f"exit {code}")
ssh.close()
safe_print(f"\nhttp://{HOST}:{PORT}")
