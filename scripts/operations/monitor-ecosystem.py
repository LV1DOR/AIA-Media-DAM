#!/usr/bin/env python3
"""Local operator monitoring; no external messages or credential output."""
import pathlib,subprocess,json,datetime,shutil
root=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private')
now=datetime.datetime.now(datetime.timezone.utc);problems=[]
names=['aia-media-api','aia-media-web','aia-transfer-web','aia-media-gokapi','aia-media-gateway','resourcespace','resourcespace-db']
containers=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=20))
health={}
for c in containers:
 state=c['State'];name=c['Name'].lstrip('/');status=state.get('Health',{}).get('Status','running' if state['Running'] else 'stopped');health[name]=status
 if status not in ['healthy','running'] or state.get('Paused'):problems.append('Service unhealthy: '+name)
disk=shutil.disk_usage('/volume1');free=disk.free
if free < max(100*1024**3,disk.total*.1):problems.append('Low NAS disk headroom')
try:
 backup=json.loads((root/'backup-status.json').read_text());age=(now-datetime.datetime.fromisoformat(backup['completedAt'])).total_seconds()
 if age>30*3600:problems.append('Backup older than 30 hours')
except (OSError,ValueError,KeyError):age=None;problems.append('No readable completed backup status')
result={'checkedAt':now.isoformat(),'serviceHealth':health,'freeBytes':free,'backupAgeSeconds':age,'problems':problems,'externalAlertDestinationConfigured':False}
(root/'monitor-status.json').write_text(json.dumps(result,indent=2)+'\n')
for problem in problems:subprocess.run(['logger','-t','aia-media','-p','daemon.warning',problem],timeout=5)
print(json.dumps(result));raise SystemExit(1 if problems else 0)
