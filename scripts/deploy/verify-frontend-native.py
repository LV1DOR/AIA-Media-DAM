"""Verify the candidate BFF against the native source with an isolated in-memory registry."""
import sys,json,pathlib,re,subprocess,hashlib,datetime
if '--approved-native-frontend-test' not in sys.argv:raise SystemExit('Approved isolated native test required')
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing failed')
p=json.load(s);root=pathlib.Path('/volume1/docker/aia-media-ecosystem');private=root/'.private'
if not re.fullmatch(r'lan-\d{8}-[a-f0-9]{8}',p['release']):raise SystemExit('Invalid candidate')
if (root/'releases'/p['release']/'source.sha256').read_text().strip()!=p['sha256']:raise SystemExit('Candidate receipt differs')
state=json.loads((private/(p['release']+'-before.json')).read_text())
meta=json.loads(subprocess.check_output(['docker','inspect','aia-media-api','resourcespace']))
networks=set(meta[0]['NetworkSettings']['Networks'])&set(meta[1]['NetworkSettings']['Networks'])
if len(networks)!=1:raise SystemExit('Expected one approved source network')
# Read the deployed owner's existing encrypted identity; no production registry writes or sessions.
identity_code="""import {DatabaseSync} from 'node:sqlite';import {SecretBox} from '/app/services/transfer-api/src/security.ts';import path from 'node:path';const db=new DatabaseSync(path.join(process.env.AIA_DATA_DIR||'/data','registry.sqlite'),{readOnly:true});try{const row=db.prepare(\"SELECT rs_credentials FROM users WHERE username='admin' AND disabled=0\").get();if(!row?.rs_credentials)throw new Error('Owner native identity unavailable');process.stdout.write(JSON.stringify(new SecretBox(process.env.AIA_MASTER_KEY).open(row.rs_credentials)));}finally{db.close();}"""
identity=subprocess.check_output(['docker','exec','aia-media-api','node','--import','tsx','--input-type=module','-e',identity_code],stderr=subprocess.PIPE)
result=subprocess.run(['docker','run','--rm','-i','--network',next(iter(networks)),'--env-file',str(private/'app.env'),'--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','768m','--cpus','2','aia-media-api:'+p['release'],'node','--import','tsx','scripts/test/frontend-native.mts','--approved-native-frontend-test','--identity-stdin'],input=identity,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
if result.returncode:
 sys.stderr.write(result.stderr.decode()[-5000:]);raise SystemExit('Isolated native frontend verification failed; live release unchanged')
report=json.loads(result.stdout);report.update({'release':p['release'],'sourceSha256':p['sha256'],'deployedRegistryMounted':False,'identitySource':'Read-only deployed owner record','listenerOpened':False})
hashes={};filestore=pathlib.Path(state['filestoreRoot'])
for f in filestore.rglob('*'):
 if f.is_file() and f.relative_to(filestore).parts[0]!='tmp':
  with f.open('rb') as src:hashes[f.relative_to(filestore).as_posix()]=hashlib.file_digest(src,'sha256').hexdigest()
report['permanentFilesUnchanged']=hashes==state['permanentHashes'];report['permanentFilesChecked']=len(hashes)
if not report.get('passed') or not report.get('testCollectionRemoved') or not report['permanentFilesUnchanged']:raise SystemExit('Native verification or preservation gate failed')
(private/(p['release']+'-native.json')).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
