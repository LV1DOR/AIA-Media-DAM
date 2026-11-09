"""Stage an immutable checksummed frontend candidate without switching the live release."""
import sys,json,pathlib,base64,hashlib,tarfile,io,os,re
if '--approved-frontend-stage' not in sys.argv:raise SystemExit('Approved frontend staging mode required')
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing failed')
p=json.load(s);data=base64.b64decode(p['archive'],validate=True)
if len(data)>16*1024**2 or hashlib.sha256(data).hexdigest()!=p['sha256']:raise SystemExit('Source checksum or size differs')
if not re.fullmatch(r'lan-\d{8}-[a-f0-9]{8}',p['release']) or not p['sha256'].startswith(p['release'].rsplit('-',1)[1]):raise SystemExit('Invalid immutable release reference')
root=pathlib.Path('/volume1/docker/aia-media-ecosystem')
if root.is_symlink() or root.stat().st_uid!=0 or root.stat().st_mode&0o777!=0o700:raise SystemExit('Private project root differs')
parent=root/'releases'
if parent.is_symlink():raise SystemExit('Release parent must not be a symlink')
release=parent/p['release'];release.mkdir(mode=0o755)
with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
 members=archive.getmembers()
 for member in members:
  rel=pathlib.PurePosixPath(member.name)
  if rel.is_absolute() or '..' in rel.parts or any(x in rel.parts for x in ['.local','.private','.git','node_modules','.next']) or not member.isfile():raise SystemExit('Unsafe source member')
 for member in members:
  target=release/member.name;target.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
  with archive.extractfile(member) as source,target.open('xb') as out:out.write(source.read())
  target.chmod(0o644)
(release/'source.sha256').write_text(p['sha256']+'\n')
print(json.dumps({'staged':True,'release':p['release'],'sourceSha256':p['sha256'],'files':len(members),'runningServicesChanged':False}))
