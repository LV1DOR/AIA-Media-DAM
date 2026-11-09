#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ ${1:-} == --approved-isolated-restore ]] || exit 2
[[ ${AIA_BACKUP_ID:-} =~ ^p0-[0-9TZ]+$ ]] || exit 2
[[ $(id -u) == 0 ]] || exit 1
job=/volume1/docker/aia-media-backups/$AIA_BACKUP_ID
restore="$job/isolated-restore"
network=aia-media-p0-restore-isolated
db=aia-media-p0-restore-db
web=aia-media-p0-restore-web
dbvolume=aia-media-p0-restore-database
filesvolume=aia-media-p0-restore-filestore
app_image=sha256:0ab7853ff0b41a2ca2e1bd07092749f12ece4f806ce8bf6866a9b23635ce411f
db_image=sha256:823a099a93df6416c6c7ed33c79a2d43e92ffbd2ccc0e83973ef045f2dae1ac0
test -s "$job/independent-recovery.tar"
for name in "$db" "$web"; do
  if docker container inspect "$name" >/dev/null 2>&1; then echo 'Refusing existing restore container' >&2; exit 1; fi
done
for name in "$dbvolume" "$filesvolume"; do
  if docker volume inspect "$name" >/dev/null 2>&1; then echo 'Refusing existing restore volume' >&2; exit 1; fi
done
if docker network inspect "$network" >/dev/null 2>&1; then exit 1; fi
mkdir -m 700 "$restore"
python3 - "$job/independent-recovery.tar" "$restore" <<'PY'
import sys,tarfile,pathlib,shutil
archive,destination=sys.argv[1:]
expected={'database.sql','filestore.tar','configuration.tar','filestore.sha256','manifest.json'}
with tarfile.open(archive) as tar:
 if {m.name for m in tar.getmembers()} != expected or any(not m.isfile() for m in tar.getmembers()): raise SystemExit('Unexpected recovery members')
 for member in tar.getmembers():
  with tar.extractfile(member) as source, open(pathlib.Path(destination)/member.name,'xb') as target: shutil.copyfileobj(source,target)
config=pathlib.Path(destination)/'source-config'
config.mkdir(mode=0o700)
expected={'config.php','db.env','docker-compose.yaml','Dockerfile','entrypoint.sh','cronjob','LICENSE'}
with tarfile.open(pathlib.Path(destination)/'configuration.tar') as tar:
 if {m.name for m in tar.getmembers()} != expected or any(not m.isfile() for m in tar.getmembers()): raise SystemExit('Unexpected configuration members')
 for member in tar.getmembers():
  with tar.extractfile(member) as source, open(config/member.name,'xb') as target: shutil.copyfileobj(source,target)
PY
python3 - "$restore" <<'PY'
import pathlib,secrets,sys
root=pathlib.Path(sys.argv[1])
dbpass=secrets.token_hex(32)
rootpass=secrets.token_hex(32)
(root/'database.env').write_text('MARIADB_ROOT_PASSWORD='+rootpass+'\nMARIADB_DATABASE=resourcespace\nMARIADB_USER=resourcespace_restore\nMARIADB_PASSWORD='+dbpass+'\n')
source=(root/'source-config/config.php').read_text()
opening='<?php\n' if source.rstrip().endswith('?>') else ''
override="\n"+opening+"// Isolated recovery overrides\n$mysql_server='aia-media-p0-restore-db';\n$mysql_db='resourcespace';\n$mysql_username='resourcespace_restore';\n$mysql_password='"+dbpass+"';\n$baseurl='http://127.0.0.1:18088';\n"
(root/'config.php').write_text(source+override)
PY
chmod 600 "$restore/database.env" "$restore/config.php"
chown 33:33 "$restore/config.php"
docker run --rm --network none --mount "type=bind,src=$restore/config.php,dst=/config.php,readonly" --entrypoint php "$app_image" -l /config.php >/dev/null
docker network create --internal "$network" >/dev/null
docker volume create "$dbvolume" >/dev/null
docker volume create "$filesvolume" >/dev/null
docker run -d --name "$db" --network "$network" --memory 1g --env-file "$restore/database.env" --mount "type=volume,src=$dbvolume,dst=/var/lib/mysql" "$db_image" >/dev/null
ready=0
for attempt in $(seq 1 60); do
  if docker exec "$db" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb --user=root --batch --skip-column-names --execute="SELECT 1" resourcespace' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ $ready == 1 ]] || exit 1
docker exec -i "$db" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb --user=root resourcespace' < "$restore/database.sql"
docker run --rm --network none --mount "type=volume,src=$filesvolume,dst=/var/www/html/filestore" --mount "type=bind,src=$restore,dst=/recovery,readonly" --entrypoint tar "$app_image" --acls --xattrs --numeric-owner -xpf /recovery/filestore.tar -C /var/www/html/filestore
docker run --rm --network none --mount "type=volume,src=$filesvolume,dst=/var/www/html/filestore" --mount "type=bind,src=$restore,dst=/recovery,readonly" --entrypoint sh "$app_image" -c 'cd /var/www/html/filestore && sha256sum -c /recovery/filestore.sha256' > "$restore/checksum-verification.txt"
docker run -d --name "$web" --network "$network" --memory 1g --mount "type=volume,src=$filesvolume,dst=/var/www/html/filestore" --mount "type=bind,src=$restore/config.php,dst=/var/www/html/include/config.php,readonly" "$app_image" >/dev/null
[[ $(docker network inspect --format '{{.Internal}}' "$network") == true ]] || exit 1
python3 - "$restore" "$AIA_BACKUP_ID" <<'PY'
import json,pathlib,sys,datetime,subprocess
root=pathlib.Path(sys.argv[1])
web=json.loads(subprocess.check_output(['docker','inspect','aia-media-p0-restore-web']))[0]
published=any(web['NetworkSettings']['Ports'].values())
if published: raise SystemExit('Restore unexpectedly publishes a host port')
report={'backupId':sys.argv[2],'restoredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'restoredFromIndependentWorkstationCopy':True,'networkInternal':True,'portsPublished':published,'accessMethod':'NAS host to internal container IP over private SSH','newDatabaseAndFilestoreVolumes':True,'productionVolumesMounted':False,'exactRuntimeImagesUsed':True,'filestoreFilesChecksumVerified':len((root/'checksum-verification.txt').read_text().splitlines()),'applicationTestsPending':True}
(root/'restore-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
PY
