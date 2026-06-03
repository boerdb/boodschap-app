#!/usr/bin/env python3
import sys
import paramiko

def safe_print(text: str) -> None:
    enc = sys.stdout.encoding or "utf-8"
    print(text.encode(enc, errors="replace").decode(enc, errors="replace"))

HOST, USER, PASSWORD = "192.168.1.32", "root", "kerkpoort"
REMOTE_DIR = "/var/www/boodschap-app"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    f"cd {REMOTE_DIR} && npm run build",
    f"cd {REMOTE_DIR} && pm2 delete boodschap-app 2>/dev/null; "
    "pm2 start ecosystem.config.cjs && pm2 save",
    "pm2 list",
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3008/login",
]
for cmd in cmds:
    safe_print(f"$ {cmd}")
    _, o, e = ssh.exec_command(cmd, timeout=600)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out:
        safe_print(out[-3000:] if len(out) > 3000 else out)
    if err.strip() and code != 0:
        safe_print("ERR: " + err[-800:])
    safe_print(f"exit {code}\n")
ssh.close()
