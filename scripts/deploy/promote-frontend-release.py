"""Promote only verified application images; preserve engines/volumes and roll back on failed checks."""
import sys,json,pathlib,re,subprocess,os,time,sqlite3,tempfile,tarfile,hashlib,fcntl,uuid
if '--approved-frontend-rollout' not in sys.argv:raise SystemExit('Approved frontend rollout required')
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing failed')
p=json.load(s);root=pathlib.Path('/volume1/docker/aia-media-ecosystem');private=root/'.private'
if root.is_symlink() or root.stat().st_uid!=0 or root.stat().st_mode&0o777!=0o700:raise SystemExit('Private project root differs')
if not re.fullmatch(r'lan-\d{8}-[a-f0-9]{8}',p['release']):raise SystemExit('Invalid candidate')
release=root/'releases'/p['release'];receipt=(release/'source.sha256').read_text().strip()
if receipt!=p['sha256']:raise SystemExit('Candidate checksum differs')
native=json.loads((private/(p['release']+'-native.json')).read_text());built=json.loads((private/(p['release']+'-images.json')).read_text())
if native.get('sourceSha256')!=receipt or not native.get('passed') or not native.get('testCollectionRemoved') or not native.get('permanentFilesUnchanged'):raise SystemExit('Native verification gate is incomplete')
if built.get('sourceSha256')!=receipt:raise SystemExit('Build receipt differs')
for image in built['images']:
 actual=json.loads(subprocess.check_output(['docker','image','inspect',image['tags'][0]]))[0]
 if actual['Id']!=image['id']:raise SystemExit('Candidate image identity changed')
state=json.loads((private/(p['release']+'-before.json')).read_text());old=root/'releases'/state['baselineRelease']
if not (root/'current').is_symlink() or (root/'current').resolve()!=old:raise SystemExit('Live release changed since review')
lock=(private/'backup.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
os.umask(0o077)
compose_env=private/'compose.env';old_env=compose_env.read_bytes();app_env_digest=hashlib.sha256((private/'app.env').read_bytes()).hexdigest()
containers=json.loads(subprocess.check_output(['docker','inspect','aia-media-api','resourcespace','resourcespace-db','aia-media-gokapi','aia-media-gateway']))
api=next(c for c in containers if c['Name']=='/aia-media-api');registry=pathlib.Path(next(m['Source'] for m in api['Mounts'] if m['Destination']=='/data'))/'registry.sqlite'
protected={c['Name']:(c['Id'],c['Image'],c['State']['StartedAt']) for c in containers if c['Name']!='/aia-media-api'}
connection=sqlite3.connect('file:'+str(registry)+'?mode=ro',uri=True)
if connection.execute("SELECT count(*) FROM transfers WHERE state='draft'").fetchone()[0] or connection.execute('SELECT count(*) FROM files WHERE finalizing=1').fetchone()[0]:raise SystemExit('An upload/finalization is in progress; defer rollout')
schema=connection.execute('SELECT version FROM schema_version').fetchone()[0]
expected_schema=p.get('expectedRegistrySchema',schema)
if type(expected_schema) is not int or not schema<=expected_schema<=6:raise SystemExit('Unapproved registry migration')
def capture_table(db,table,where='1',params=()):
 columns=[row[1] for row in db.execute('PRAGMA table_info('+table+')')]
 quoted=','.join('"'+name.replace('"','""')+'"' for name in columns)
 return {'columns':columns,'select':quoted,'rows':db.execute('SELECT '+quoted+' FROM '+table+' WHERE '+where+' ORDER BY rowid',params).fetchall()}
preserved={name:capture_table(connection,name) for name in ['users','invitations','profile_photos','background_photos'] if connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(name,)).fetchone()}
sessions_before=capture_table(connection,'sessions')
account_count=len(preserved['users']['rows'])
checkpoint=private/(p['release']+'-registry-checkpoint.tar.cms')
with tempfile.TemporaryDirectory(prefix=p['release']+'-checkpoint-',dir=private) as temporary:
 stage=pathlib.Path(temporary);database=stage/'registry.sqlite';destination=sqlite3.connect(database);connection.backup(destination)
 if destination.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise SystemExit('Registry checkpoint failed validation')
 destination.close();connection.close();(stage/'compose.env').write_bytes(old_env);(stage/'release.json').write_text(json.dumps({'rollbackRelease':state['baselineRelease'],'candidate':p['release'],'registrySchema':schema}))
 with checkpoint.open('xb') as output:
  archive=subprocess.Popen(['tar','-C',str(stage),'-cf','-','.'],stdout=subprocess.PIPE)
  try:subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-gcm','-stream','-outform','DER','-recip',str(private/'recovery-recipient.pem')],stdin=archive.stdout,stdout=output,check=True,timeout=60)
  finally:archive.stdout.close()
  if archive.wait(timeout=10):raise SystemExit('Registry checkpoint archive failed')
checkpoint_sha=hashlib.file_digest(checkpoint.open('rb'),'sha256').hexdigest()
def compose(directory,tag):
 env=dict(os.environ,AIA_RELEASE=tag)
 subprocess.run(['docker','compose','--env-file',str(compose_env),'-f',str(directory/'infra/compose/compose.yaml'),'-f',str(directory/'infra/compose/ingress.override.yaml'),'up','-d','--no-deps','--no-build','api','media','transfer'],env=env,check=True,timeout=120,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def wait_healthy():
 for attempt in range(60):
  rows=json.loads(subprocess.check_output(['docker','inspect','aia-media-api','aia-media-web','aia-transfer-web']))
  if all(c['State'].get('Health',{}).get('Status')=='healthy' for c in rows):return rows
  if any(not c['State']['Running'] for c in rows):raise RuntimeError('An application container stopped')
  time.sleep(2)
 raise RuntimeError('Application health deadline exceeded')
def set_link(target):
 temporary=root/('current-frontend-'+uuid.uuid4().hex);temporary.symlink_to(target);os.replace(temporary,root/'current')
def replace_environment(data):
 temporary=private/('compose.env-frontend-'+uuid.uuid4().hex);temporary.write_bytes(data);temporary.chmod(0o600);os.replace(temporary,compose_env)
try:
 compose(release,p['release']);running=wait_healthy()
 for c in running:
  expected=next(i['id'] for i in built['images'] if i['tags'][0].split(':',1)[0] == {'/aia-media-api':'aia-media-api','/aia-media-web':'aia-media-web','/aia-transfer-web':'aia-transfer-web'}[c['Name']])
  if c['Image']!=expected:raise RuntimeError('Running image differs from verified candidate')
 after=json.loads(subprocess.check_output(['docker','inspect']+[name[1:] for name in protected]))
 if any((c['Id'],c['Image'],c['State']['StartedAt'])!=protected[c['Name']] for c in after):raise RuntimeError('A protected engine was changed')
 check=sqlite3.connect('file:'+str(registry)+'?mode=ro',uri=True)
 try:
  if check.execute('SELECT version FROM schema_version').fetchone()[0]!=expected_schema:raise RuntimeError('Registry migration differs from the approved schema')
  for table,snapshot in preserved.items():
   actual=check.execute('SELECT '+snapshot['select']+' FROM '+table+' ORDER BY rowid').fetchall()
   if actual!=snapshot['rows']:raise RuntimeError('Existing '+table+' records changed during rollout')
  expiry_index=sessions_before['columns'].index('expires');now_ms=int(time.time()*1000)
  live_sessions=set(check.execute('SELECT '+sessions_before['select']+' FROM sessions WHERE expires>?',(now_ms,)).fetchall())
  if any(row not in live_sessions for row in sessions_before['rows'] if row[expiry_index]>now_ms):raise RuntimeError('An existing valid session was lost')
 finally:check.close()
 permanent={};filestore=pathlib.Path(state['filestoreRoot'])
 for f in filestore.rglob('*'):
  if f.is_file() and f.relative_to(filestore).parts[0]!='tmp':
   with f.open('rb') as src:permanent[f.relative_to(filestore).as_posix()]=hashlib.file_digest(src,'sha256').hexdigest()
 if permanent!=state['permanentHashes']:raise RuntimeError('Permanent media checksum comparison failed')
 if hashlib.sha256((private/'app.env').read_bytes()).hexdigest()!=app_env_digest:raise RuntimeError('Private runtime configuration changed')
 new_env=re.sub(rb'(?m)^AIA_RELEASE=.*$',('AIA_RELEASE='+p['release']).encode(),old_env)
 if new_env==old_env:raise RuntimeError('Compose release reference was not changed')
 replace_environment(new_env);set_link(release)
 report={'deployed':True,'release':p['release'],'sourceSha256':receipt,'rollbackRelease':state['baselineRelease'],'registrySchemaBefore':schema,'registrySchema':expected_schema,'accountsPreserved':account_count,'existingAccountDataUnchanged':True,'validSessionsPreserved':True,'staffSecurityRecordsUnchanged':True,'privateRuntimeConfigUnchanged':True,'protectedEnginesUnchanged':True,'permanentFilesUnchanged':True,'permanentFilesChecked':len(permanent),'encryptedRegistryCheckpointSha256':checkpoint_sha,'containers':[{'name':c['Name'][1:],'imageId':c['Image'],'health':c['State']['Health']['Status']} for c in running]}
 (private/(p['release']+'-deployment.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
except BaseException:
 compose(old,state['baselineRelease']);wait_healthy();replace_environment(old_env);set_link(old);raise
