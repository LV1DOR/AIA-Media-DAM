import sys,json,pathlib,os,re,subprocess,hashlib
if '--approved-frontend-build' not in sys.argv:raise SystemExit('Approved candidate build required')
s=sys.stdin.buffer
line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing failed')
p=json.load(s)
root=pathlib.Path('/volume1/docker/aia-media-ecosystem')
if not re.fullmatch(r'lan-\d{8}-[a-f0-9]{8}',p['release']):raise SystemExit('Invalid release')
release=root/'releases'/p['release']
if (release/'source.sha256').read_text().strip()!=p['sha256']:raise SystemExit('Source receipt differs')
baseline=p.get('baselineRelease')
if not isinstance(baseline,str) or not re.fullmatch(r'lan-\d{8}-[a-f0-9]{8}',baseline):raise SystemExit('Explicit baseline release required')
if (root/'current').resolve().name!=baseline:raise SystemExit('Live baseline changed')
private=root/'.private'
meta=json.loads(subprocess.check_output(['docker','inspect','resourcespace','resourcespace-db','aia-media-api','aia-media-web','aia-transfer-web','aia-media-gokapi','aia-media-gateway']))
rs=next(c for c in meta if c['Name']=='/resourcespace')
filestore=pathlib.Path(next(m['Source'] for m in rs['Mounts'] if m['Destination']=='/var/www/html/filestore'))
hashes={}
for f in filestore.rglob('*'):
 if f.is_file() and f.relative_to(filestore).parts[0]!='tmp':
  with f.open('rb') as src:hashes[f.relative_to(filestore).as_posix()]=hashlib.file_digest(src,'sha256').hexdigest()
state={'baselineRelease':baseline,'candidate':p['release'],'sourceSha256':p['sha256'],'filestoreRoot':str(filestore),'permanentHashes':hashes,'containers':[{'name':c['Name'][1:],'id':c['Id'],'imageId':c['Image'],'startedAt':c['State']['StartedAt'],'health':c['State'].get('Health',{}).get('Status')} for c in meta]}
checkpoint=private/(p['release']+'-before.json')
with checkpoint.open('x') as out:json.dump(state,out)
checkpoint.chmod(0o600)
for image in ['aia-media-api:','aia-media-web:','aia-transfer-web:']:
 if subprocess.run(['docker','image','inspect',image+p['release']],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:raise SystemExit('Candidate image already exists')
env=dict(os.environ,AIA_RELEASE=p['release'])
log=private/(p['release']+'-build.log')
with log.open('x') as out:
 result=subprocess.run(['docker','compose','--env-file',str(private/'compose.env'),'-f',str(release/'infra/compose/compose.yaml'),'build','api','media','transfer'],env=env,stdout=out,stderr=subprocess.STDOUT)
log.chmod(0o600)
if result.returncode:raise SystemExit('Candidate build failed; private log: '+str(log))
images=json.loads(subprocess.check_output(['docker','image','inspect']+[name+p['release'] for name in ['aia-media-api:','aia-media-web:','aia-transfer-web:']]))
report={'built':True,'release':p['release'],'sourceSha256':p['sha256'],'preservedPermanentFiles':len(hashes),'images':[{'tags':i['RepoTags'],'id':i['Id']} for i in images],'runningServicesChanged':False}
receipt=private/(p['release']+'-images.json')
receipt.write_text(json.dumps(report,indent=2)+'\n');receipt.chmod(0o600)
print(json.dumps(report))
