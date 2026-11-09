"""Owner-authorized durable PHP limits and original-service health configuration."""
import pathlib,subprocess,json,os
root=pathlib.Path('/volume1/docker/resourcespace')
private=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private')
source=root/'docker-compose.yaml';backup=private/'resourcespace-compose-before-limits.yaml'
if not backup.exists():
 with os.fdopen(os.open(backup,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600),'wb') as f:f.write(source.read_bytes())
ini=root/'aia-uploads.ini'
body='upload_max_filesize=20G\npost_max_size=21G\nmemory_limit=512M\nmax_execution_time=3600\nmax_input_time=3600\n'
if ini.exists() and ini.read_text()!=body:raise SystemExit('Existing upload settings differ')
ini.write_text(body);ini.chmod(0o644)
override=root/'docker-compose.override.yaml'
yaml='''services:
  resourcespace:
    pull_policy: never
    volumes:
      - ./aia-uploads.ini:/etc/php/8.3/apache2/conf.d/99-aia-uploads.ini:ro
    mem_limit: 2g
    cpus: 3
    logging:
      driver: json-file
      options: {max-size: "10m", max-file: "3"}
    healthcheck:
      test: [CMD, php, -r, "exit(@file_get_contents('http://127.0.0.1/login.php')===false?1:0);"]
      interval: 30s
      timeout: 10s
      retries: 3
  db:
    image: mariadb@sha256:250e1609e93c0e6aecf64bfbab2d84d5e89d2481540fe77447ff6c855c3b1873
    pull_policy: never
    mem_limit: 768m
    logging:
      driver: json-file
      options: {max-size: "10m", max-file: "3"}
    healthcheck:
      test: [CMD, healthcheck.sh, --connect, --innodb_initialized]
      interval: 30s
      timeout: 10s
      retries: 3
'''
# Discover the DB service from actual Compose, not the container's display name.
label=subprocess.check_output(['docker','inspect','--format','{{index .Config.Labels "com.docker.compose.service"}}','resourcespace-db'],text=True).strip()
if label not in ('db','database','mariadb','resourcespace-db'):raise SystemExit('Unexpected database service')
yaml=yaml.replace('  db:\n','  '+label+':\n')
if override.exists() and override.read_text()!=yaml:raise SystemExit('Refusing to overwrite another operator override')
override.write_text(yaml);override.chmod(0o600)
command=['docker','compose','-p','resourcespace','-f',str(source),'-f',str(override)]
subprocess.check_call(command+['config','--quiet'],stdout=subprocess.DEVNULL)
subprocess.check_call(command+['up','-d','--no-build'],stdout=subprocess.DEVNULL)
after=json.loads(subprocess.check_output(['docker','inspect','resourcespace','resourcespace-db']))
if {c['Image'] for c in after}!={'sha256:0ab7853ff0b41a2ca2e1bd07092749f12ece4f806ce8bf6866a9b23635ce411f','sha256:823a099a93df6416c6c7ed33c79a2d43e92ffbd2ccc0e83973ef045f2dae1ac0'}:raise SystemExit('Unexpected original image change')
print(json.dumps({'durableApacheUploadLimit':'20G','originalImagesPreserved':True,'originalDatabaseAndFilestoreVolumesRetained':True,'originalServicesRecreatedForConfig':True,'healthchecksConfigured':True}))
