"""Install owner-authorized host jobs from framed stdin; no remote messaging."""
import pathlib,sys,json,subprocess,os
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing required')
payload=json.load(s);root=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private')
if os.geteuid()!=0 or root.is_symlink():raise SystemExit('Private root required')
for name,body in payload.items():
 if name not in ['backup-ecosystem.py','monitor-ecosystem.py']:raise SystemExit('Unexpected operator script')
 compile(body,name,'exec');target=root/name;target.write_text(body);target.chmod(0o700)
cron=pathlib.Path('/etc/cron.d/aia-media')
body='''# AIA Media owner-authorized LAN operations; times are NAS host local time.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root timeout 4000 python3 /volume1/docker/aia-media-ecosystem/.private/backup-ecosystem.py >> /volume1/docker/aia-media-ecosystem/.private/backup.log 2>&1
*/5 * * * * root python3 /volume1/docker/aia-media-ecosystem/.private/monitor-ecosystem.py >> /volume1/docker/aia-media-ecosystem/.private/monitor.log 2>&1
'''
if cron.exists() and cron.read_text()!=body:raise SystemExit('Existing host schedule differs')
cron.write_text(body);cron.chmod(0o644)
rotate=pathlib.Path('/etc/logrotate.d/aia-media')
config='''/volume1/docker/aia-media-ecosystem/.private/backup.log /volume1/docker/aia-media-ecosystem/.private/monitor.log {
 daily
 rotate 7
 size 1M
 missingok
 notifempty
 compress
 copytruncate
}
'''
if rotate.exists() and rotate.read_text()!=config:raise SystemExit('Existing log rotation differs')
rotate.write_text(config);rotate.chmod(0o644)
active=subprocess.check_output(['systemctl','is-active','cron'],text=True).strip()
if active!='active':raise SystemExit('Host cron inactive')
subprocess.run(['logrotate','--debug',str(rotate)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'dailyBackup':'03:30 NAS host timezone','monitorEveryMinutes':5,'hostCronActive':True,'logRotationConfigured':True,'externalAlertDeliveryConfigured':False}))
