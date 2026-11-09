"""Owner-authorized P5 configuration. Framed private stdin; native DB functions only."""
import sys,json,pathlib,subprocess,os
stream=sys.stdin.buffer
line=stream.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=stream.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private input framing failed')
payload=json.load(stream)
if payload.get('mode')!='install-approved-plugin':raise SystemExit('Approved installation mode required')
files=payload['files']
if set(files)!={'aia_transfer.yaml','api/api_bindings.php'}:raise SystemExit('Unexpected plugin members')
original=json.loads(subprocess.check_output(['docker','inspect','resourcespace']))[0]
if original['Image']!='sha256:0ab7853ff0b41a2ca2e1bd07092749f12ece4f806ce8bf6866a9b23635ce411f' or original['State']['Paused']:raise SystemExit('Source image/state drift')
config=pathlib.Path('/volume1/docker/resourcespace/config.php')
root=pathlib.Path('/volume1/docker/aia-media-ecosystem')
root.mkdir(mode=0o700,exist_ok=True)
if root.is_symlink() or root.stat().st_uid!=0 or (root.stat().st_mode&0o777)!=0o700:raise SystemExit('Private project root differs')
private=root/'.private';private.mkdir(mode=0o700,exist_ok=True)
before=private/'resourcespace-before-plugin.php'
if not before.exists():
 with os.fdopen(os.open(before,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600),'wb') as target:target.write(config.read_bytes())
stage=root/'plugin/aia_transfer'
for name,body in files.items():
 p=stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body);p.chmod(0o644)
stage.chmod(0o755);(stage/'api').chmod(0o755)
subprocess.check_call(['docker','exec','resourcespace','mkdir','-p','/var/www/html/filestore/plugins'])
subprocess.check_call(['docker','exec','resourcespace','chmod','755','/var/www/html/filestore/plugins'])
subprocess.check_call(['docker','cp',str(stage),'resourcespace:/var/www/html/filestore/plugins/'])
subprocess.check_call(['docker','exec','resourcespace','php','-l','/var/www/html/filestore/plugins/aia_transfer/api/api_bindings.php'],stdout=subprocess.DEVNULL)
php='''chdir("/var/www/html");include "include/boot.php";
$roles=["marketer"=>["name"=>"AIA Marketing","permissions"=>"s,g,c,e-1,q,f*,j*,z1,z2,z3,z-2"],"reviewer"=>["name"=>"AIA Reviewers","permissions"=>"s,g,c,t,e-2,e-1,e0,e1,e2,q,f*,j*,z3"]];
$ids=[];foreach($roles as $role=>$options){$matches=array_values(array_filter(get_usergroups(),fn($g)=>$g["name"]===$options["name"]));$ids[$role]=$matches?(int)$matches[0]["ref"]:(int)save_usergroup(0,$options);save_usergroup($ids[$role],$options);}echo json_encode($ids);'''
groups=json.loads(subprocess.check_output(['docker','exec','resourcespace','php','-r',php]))
text=config.read_text()
addition=('\n<?php\n' if text.rstrip().endswith('?>') else '\n')
if '"aia_transfer"' not in text and "'aia_transfer'" not in text:addition+='$plugins[]="aia_transfer";\n'
group_line='$aia_transfer_groups=["marketer"=>'+str(groups['marketer'])+',"reviewer"=>'+str(groups['reviewer'])+'];\n'
if '$aia_transfer_groups=' not in text:addition+=group_line
if addition.strip() not in ('','<?php'):
 checked=subprocess.run(['docker','exec','-i','resourcespace','php','-l'],input=(text+addition).encode(),capture_output=True)
 if checked.returncode:raise SystemExit('Proposed source config did not parse')
 with config.open('a') as target:target.write(addition)
print(json.dumps({'installed':True,'container':'resourcespace','sourceRevision':29907,'persistentPluginInFilestore':True,'sourceConfigPreserved':True,'groups':groups,'existingMediaDeleted':False,'containerRestarted':False}))
