#!/usr/bin/env python3
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("192.168.1.32", username="root", password="kerkpoort", timeout=30)
cmds = [
    "ss -tlnp | grep -E ':30[0-9]{2} ' || true",
    """python3 -c "import json,subprocess; d=json.loads(subprocess.check_output(['pm2','jlist'])); 
[print(x['name'], x.get('pm2_env',{}).get('env',{}).get('PORT','-')) for x in d]" 2>/dev/null || true""",
]
for c in cmds:
    _, o, _ = ssh.exec_command(c)
    print(o.read().decode("utf-8", errors="replace"))
    print("---")
ssh.close()
