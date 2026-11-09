from pathlib import Path
import os,tarfile,io,gzip,hashlib,json,datetime
root=Path.cwd();out=root/'.local/frontend-qa/releases';out.mkdir(parents=True,exist_ok=True)
skip={'.local','.git','.private','node_modules','.next','.next-review','coverage','dist','vendor-private','__pycache__'}
files=[]
for base,dirs,names in os.walk(root):
 dirs[:]=[d for d in dirs if d not in skip]
 for name in names:
  p=Path(base)/name
  if name.startswith('.env') and name!='.env.example':continue
  if p.suffix in {'.pem','.key','.pfx','.p12','.sql','.db','.log','.pyc'} or '.sqlite' in name or name.endswith('.tsbuildinfo') or name=='next-env.d.ts':continue
  if p.is_symlink():raise RuntimeError('Unexpected source symlink')
  files.append(p)
buffer=io.BytesIO()
with gzip.GzipFile(fileobj=buffer,mode='wb',mtime=0) as compressed:
 with tarfile.open(fileobj=compressed,mode='w') as archive:
  for p in sorted(files):
   info=tarfile.TarInfo(p.relative_to(root).as_posix());data=p.read_bytes();info.size=len(data);info.mode=0o644;info.mtime=0;archive.addfile(info,io.BytesIO(data))
data=buffer.getvalue();sha=hashlib.sha256(data).hexdigest();release='lan-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')+'-'+sha[:8]
archive=out/(release+'.tar.gz');archive.write_bytes(data)
manifest={'release':release,'sha256':sha,'archive':str(archive),'bytes':len(data),'files':len(files)}
(out/'candidate.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest))
