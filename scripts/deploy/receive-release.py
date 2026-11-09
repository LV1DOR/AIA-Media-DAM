"""Extract an authenticated, checksummed source release into a fresh private NAS path."""
import sys,json,pathlib,base64,hashlib,tarfile,io,os,re,subprocess
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing failed')
p=json.load(s)
if p.get('mode')!='approved-lan-release' or not re.fullmatch(r'lan-\d{8}-[a-f0-9]{8}',p.get('release','')):raise SystemExit('Invalid approved release')
data=base64.b64decode(p['archive'],validate=True)
if len(data)>16*1024**2 or hashlib.sha256(data).hexdigest()!=p['sha256']:raise SystemExit('Source checksum/size differs')
root=pathlib.Path('/volume1/docker/aia-media-ecosystem')
if root.is_symlink() or root.stat().st_uid!=0 or root.stat().st_mode&0o777!=0o700:raise SystemExit('Private project root differs')
private=root/'.private';private.mkdir(mode=0o700,exist_ok=True)
old=root/'resourcespace-before-plugin.php';moved=private/'resourcespace-before-plugin.php'
if old.exists() and not moved.exists():old.rename(moved)
release=root/'releases'/p['release']
release.parent.mkdir(mode=0o700,exist_ok=True)
if release.exists():raise SystemExit('Refusing to overwrite an existing immutable release')
release.mkdir(mode=0o700)
with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as tar:
 for member in tar.getmembers():
  rel=pathlib.PurePosixPath(member.name)
  if rel.is_absolute() or '..' in rel.parts or any(x in rel.parts for x in ['.local','.private','node_modules','.git','.next']) or not (member.isfile() or member.isdir()):raise SystemExit('Unsafe release member')
  target=release/str(rel)
  if member.isdir():target.mkdir(parents=True,exist_ok=True,mode=0o755)
  else:
   target.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
   with tar.extractfile(member) as src,target.open('xb') as out:out.write(src.read())
   target.chmod(0o644)
(release/'source.sha256').write_text(p['sha256']+'\n')
for directory in release.rglob('*'):
 if directory.is_dir():directory.chmod(0o755)
release.chmod(0o755)
settings=p['settings']
if any(not re.fullmatch(r'AIA_[A-Z0-9_]+',key) or '\n' in value or '\r' in value for key,value in settings.items()):raise SystemExit('Invalid environment configuration')
env=private/'app.env'
if env.exists():
 existing=dict(line.split('=',1) for line in env.read_text().splitlines() if '=' in line)
 if existing.get('AIA_MASTER_KEY')!=settings['AIA_MASTER_KEY']:raise SystemExit('Refusing to replace the registry encryption identity')
else:
 with os.fdopen(os.open(env,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600),'w') as out:out.write(''.join(key+'='+value+'\n' for key,value in settings.items()))
compose=private/'compose.env';compose.write_text('AIA_RELEASE='+p['release']+'\nAIA_ENV_FILE='+str(env)+'\n');compose.chmod(0o600)
print(json.dumps({'release':p['release'],'directory':str(release),'sourceChecksumVerified':True,'privateRuntimeConfigPrepared':True}))
