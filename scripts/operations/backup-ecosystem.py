#!/usr/bin/env python3
"""Bounded consistent capture; CMS encryption; temporary transfer payloads excluded."""
import pathlib, subprocess, json, os, datetime, shutil, hashlib, fcntl, threading, time
ROOT=pathlib.Path('/volume1/docker/aia-media-ecosystem')
BASE=pathlib.Path('/volume1/docker/aia-media-backups')
if os.geteuid()!=0 or ROOT.is_symlink() or ROOT.stat().st_mode&0o777!=0o700: raise SystemExit('Private NAS root required')
lock=(ROOT/'.private/backup.lock').open('w')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
os.umask(0o077)
job=BASE/('ecosystem-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
job.mkdir(mode=0o700);stage=job/'staging';stage.mkdir(mode=0o700)
cert=ROOT/'.private/recovery-recipient.pem'
subprocess.run(['openssl','x509','-in',str(cert),'-noout'],check=True,stdout=subprocess.DEVNULL)
if shutil.disk_usage(BASE).free<10*1024**3: raise SystemExit('Insufficient backup headroom')
def run(args,**kw):return subprocess.run(args,check=True,timeout=110,**kw)
def mounts(name):return {m['Destination']:m['Source'] for m in json.loads(subprocess.check_output(['docker','inspect',name]))[0]['Mounts']}
rs=mounts('resourcespace');api=mounts('aia-media-api');gateway=mounts('aia-media-gateway');engine=mounts('aia-media-gokapi')
permanent_bytes=int(subprocess.check_output(['du','-sb',rs['/var/www/html/filestore']]).split()[0])
if shutil.disk_usage(BASE).free < permanent_bytes*2+5*1024**3:raise SystemExit('Insufficient permanent-media backup capacity')
paused=[];expired=threading.Event();guard=threading.Lock()
def release():
 with guard:
  for name in paused[:]:
   subprocess.run(['docker','unpause',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15)
   paused.remove(name)
def deadline():expired.set();release()
timer=threading.Timer(120,deadline);timer.daemon=True
started=time.monotonic()
try:
 timer.start()
 for name in ['aia-media-api','resourcespace']:
  paused.append(name);run(['docker','pause',name],stdout=subprocess.DEVNULL)
 with (stage/'resourcespace.sql').open('wb') as out:
  run(['docker','exec','resourcespace-db','sh','-c','MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec mariadb-dump -uroot --single-transaction --quick --routines --events --triggers --hex-blob "${MARIADB_DATABASE:-$MYSQL_DATABASE}"'],stdout=out)
 # Copy-on-write reflinks complete the same frozen write boundary without copying every original byte.
 for source,destination in [(rs['/var/www/html/filestore'],'filestore'),(api['/data'],'registry'),('/volume1/docker/resourcespace','resourcespace-config'),(str(ROOT/'.private'),'private-config'),(gateway['/data'],'caddy-data'),(engine['/app/config'],'gokapi-config')]:
  run(['cp','-a','--reflink=always',source,str(stage/destination)])
 if expired.is_set():raise RuntimeError('Consistency deadline exceeded; capture rejected')
 freeze=round(time.monotonic()-started,2)
except BaseException:
 release()
 if stage.parent==job and job.parent==BASE and not stage.is_symlink():shutil.rmtree(stage)
 raise
finally:release();timer.cancel()
try:
 release_ref=(ROOT/'.private/compose.env').read_text().split('AIA_RELEASE=',1)[1].splitlines()[0]
 (stage/'release.json').write_text(json.dumps({'release':release_ref,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'freezeSeconds':freeze,'temporaryPayloadsIncluded':False,'restorePolicy':'Quarantine every transfer; clear all sessions and recipient grants before ingress. Reinitialize Gokapi; do not revive temporary payload links.'}))
 # Include immutable source release so restoration does not depend on a remote registry.
 run(['cp','-a','--reflink=always',str(ROOT/'releases'/release_ref),str(stage/'release')])
 archive=job/'recovery.tar.cms'
 with archive.open('wb') as out:
  tar=subprocess.Popen(['tar','-C',str(stage),'-cf','-','.'],stdout=subprocess.PIPE)
  try:subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-gcm','-stream','-outform','DER','-recip',str(cert)],stdin=tar.stdout,stdout=out,check=True,timeout=3600)
  finally:tar.stdout.close()
  if tar.wait(timeout=30):raise RuntimeError('Archive failed')
 sha=hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()
 result={'backupId':job.name,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'freezeSeconds':freeze,'encryptedBytes':archive.stat().st_size,'sha256':sha,'temporaryPayloadsIncluded':False,'independentCopyVerified':False}
 (job/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')
 (ROOT/'.private/backup-status.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result))
finally:
 # This is a fixed, newly-created child below the checked private backup root.
 if stage.parent==job and job.parent==BASE and not stage.is_symlink():shutil.rmtree(stage)
