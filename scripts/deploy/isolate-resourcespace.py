"""Move the legacy native entry point to NAS loopback; API uses Docker DNS."""
import pathlib,subprocess,json
root=pathlib.Path('/volume1/docker/resourcespace')
private=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private')
override=root/'docker-compose.override.yaml'
body=override.read_text()
if '    ports: !override' not in body:
 if '  resourcespace:\n' not in body:raise SystemExit('Unknown source service')
 (private/'resourcespace-override-before-isolation.yaml').write_text(body)
 body=body.replace('  resourcespace:\n','  resourcespace:\n    ports: !override ["127.0.0.1:8088:80"]\n',1)
 override.write_text(body)
config=root/'config.php';text=config.read_text()
if '$baseurl="http://resourcespace";' not in text:
 addition=('\n<?php\n' if text.rstrip().endswith('?>') else '\n')+'$baseurl="http://resourcespace";\n'
 with config.open('a') as out:out.write(addition)
env=private/'app.env'
env.write_text('\n'.join('AIA_RS_URL=http://resourcespace' if line.startswith('AIA_RS_URL=') else line for line in env.read_text().splitlines())+'\n');env.chmod(0o600)
cmd=['docker','compose','-p','resourcespace','-f',str(root/'docker-compose.yaml'),'-f',str(override)]
subprocess.run(cmd+['config','--quiet'],check=True)
subprocess.run(cmd+['up','-d','--no-build'],check=True,stdout=subprocess.DEVNULL)
source=json.loads(subprocess.check_output(['docker','inspect','resourcespace']))[0]
if source['HostConfig']['PortBindings'].get('80/tcp')!=[{'HostIp':'127.0.0.1','HostPort':'8088'}]:raise SystemExit('Legacy exposure differs')
print(json.dumps({'nativeHostBinding':'127.0.0.1:8088','apiSourceOrigin':'http://resourcespace','originalVolumesPreserved':True}))
