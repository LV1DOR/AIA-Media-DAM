"""Restore only AIA-owned registry files from private framed archive into isolated storage."""
import sys,tarfile,io,pathlib,json,subprocess,shutil,datetime
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing required')
data=s.read(32*1024**2+1)
if len(data)>32*1024**2:raise SystemExit('Restore proof archive too large')
root=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private/restore-proof')
root.mkdir(mode=0o700,exist_ok=True)
job=root/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');job.mkdir(mode=0o700)
try:
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as archive:
  for member in archive.getmembers():
   name=member.name.removeprefix('./')
   if name not in ['registry/registry.sqlite','registry/registry.sqlite-wal','registry/registry.sqlite-shm']:continue
   if not member.isfile() or member.size>64*1024**2:raise SystemExit('Invalid registry archive member')
   (job/pathlib.PurePosixPath(name).name).write_bytes(archive.extractfile(member).read())
 if not (job/'registry.sqlite').exists():raise SystemExit('Registry absent')
 code='''const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/restore/registry.sqlite');
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Integrity failed');
 const users=db.prepare('SELECT count(*) n FROM users').get().n;
 const schema=db.prepare('SELECT version FROM schema_version').get().version;
 db.exec("BEGIN; DELETE FROM sessions; DELETE FROM grants; UPDATE transfers SET state='revoking' WHERE source='library' AND state IN ('active','draft'); UPDATE transfers SET state='revoked' WHERE source='temporary'; UPDATE files SET source_id=NULL,source_upload=NULL WHERE transfer_id IN (SELECT id FROM transfers WHERE source='temporary'); COMMIT;");
 if(db.prepare('PRAGMA table_info(files)').all().some(c=>c.name==='finalizing'))db.exec("UPDATE files SET finalizing=0 WHERE transfer_id IN (SELECT id FROM transfers WHERE source='temporary')");
 if(db.prepare("SELECT count(*) n FROM transfers WHERE state IN ('active','draft')").get().n!==0)throw Error('Restored links remain active');
 console.log(JSON.stringify({integrityCheck:'ok',schemaVersion:schema,staffRowsRestored:users,sessionsCleared:db.prepare('SELECT count(*) n FROM sessions').get().n===0,recipientGrantsCleared:true,activeTransfersQuarantined:true,disposableTemporaryPointersCleared:true,network:'none',liveVolumesMounted:false}));db.close();'''
 result=json.loads(subprocess.check_output(['docker','run','--rm','--network','none','--read-only','--mount','type=bind,src='+str(job)+',dst=/restore','node@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d','node','-e',code],timeout=30))
 result['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();print(json.dumps(result))
finally:
 if job.parent==root and not job.is_symlink():shutil.rmtree(job)
