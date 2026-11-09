#!/usr/bin/env bash
# Owner-approved P0 recovery capture. No application configuration is modified.
set -Eeuo pipefail
umask 077
[[ ${1:-} == --execute-approved-maintenance ]] || { echo 'Explicit approved-maintenance mode required' >&2; exit 2; }
[[ ${AIA_BACKUP_ID:-} =~ ^p0-[0-9TZ]+$ ]] || { echo 'Invalid recovery job ID' >&2; exit 2; }
[[ -n ${AIA_RECOVERY_CERT_B64:-} ]] || { echo 'Public recovery certificate required' >&2; exit 2; }
[[ $(id -u) == 0 ]] || exit 1
base=/volume1/docker/aia-media-backups
job="$base/$AIA_BACKUP_ID"
stage="$job/staging"
expected_app=sha256:0ab7853ff0b41a2ca2e1bd07092749f12ece4f806ce8bf6866a9b23635ce411f
expected_db=sha256:823a099a93df6416c6c7ed33c79a2d43e92ffbd2ccc0e83973ef045f2dae1ac0
[[ $(docker inspect --format '{{.Image}}' resourcespace) == "$expected_app" ]] || exit 1
[[ $(docker inspect --format '{{.Image}}' resourcespace-db) == "$expected_db" ]] || exit 1
[[ $(docker inspect --format '{{.State.Running}} {{.State.Paused}}' resourcespace) == 'true false' ]] || exit 1
[[ $(docker inspect --format '{{.State.Running}} {{.State.Paused}}' resourcespace-db) == 'true false' ]] || exit 1
[[ $(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/www/html/filestore"}}{{.Source}}{{end}}{{end}}' resourcespace) == /volume1/@docker/volumes/resourcespace_filestore_data/_data ]] || exit 1
[[ $(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/www/html/include/config.php"}}{{.Source}}{{end}}{{end}}' resourcespace) == /volume1/docker/resourcespace/config.php ]] || exit 1
readarray -t db_preflight < <(docker exec resourcespace-db sh -c '
root_secret=${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}
database_name=${MARIADB_DATABASE:-${MYSQL_DATABASE:-}}
test -n "$root_secret" && test "$database_name" = resourcespace || exit 1
MYSQL_PWD="$root_secret" mariadb --user=root --batch --skip-column-names --execute="SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND ENGINE <> '\''InnoDB'\''; SELECT @@event_scheduler;" "$database_name"
')
[[ ${db_preflight[0]:-invalid} == 0 && ${db_preflight[1]:-invalid} == OFF ]] || exit 1
[[ $(df -Pk /volume1 | awk 'NR==2 {print $4}') -gt 10000000 ]] || { echo 'Insufficient recovery staging headroom' >&2; exit 1; }
if [[ -e $base ]]; then
  [[ ! -L $base && -d $base && $(stat -c '%u %a' "$base") == '0 700' ]] || { echo 'Backup root ownership/mode mismatch' >&2; exit 1; }
else
  mkdir -m 700 "$base"
fi
mkdir -m 700 "$job"
mkdir -m 700 "$stage"
printf '%s' "$AIA_RECOVERY_CERT_B64" | base64 -d > "$job/recipient.pem"
openssl x509 -in "$job/recipient.pem" -noout >/dev/null
encrypt() {
  openssl cms -encrypt -binary -aes-256-gcm -stream -outform DER -recip "$job/recipient.pem" -out "$1"
}
printf '%s\n' 'Exporting immutable runtime images before application freeze'
timeout 900 docker image save "$expected_app" "$expected_db" | encrypt "$job/images.tar.cms"
paused=0
release_app() {
  if [[ $paused == 1 ]]; then
    docker unpause resourcespace >/dev/null
    paused=0
    rm -f -- "$job/paused-by-this-job"
  fi
}
trap release_app EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
deadline=$(( $(date +%s) + 115 ))
remaining() {
  local seconds=$(( deadline - $(date +%s) ))
  [[ $seconds -gt 0 ]] || { echo 'Capture budget exhausted' >&2; exit 1; }
  timeout "$seconds" "$@"
}
touch "$job/paused-by-this-job"
paused=1
docker pause resourcespace >/dev/null
(
  sleep 120
  if [[ -f $job/paused-by-this-job ]]; then
    docker unpause resourcespace >/dev/null 2>&1 || true
    rm -f -- "$job/paused-by-this-job"
  fi
) </dev/null >/dev/null 2>&1 &
freeze_started=$(date +%s)
printf '%s\n' 'Capturing database, filestore and configuration inside bounded freeze'
remaining docker exec resourcespace-db sh -c '
root_secret=${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}
database_name=${MARIADB_DATABASE:-${MYSQL_DATABASE:-}}
test -n "$root_secret" && test "$database_name" = resourcespace || exit 1
MYSQL_PWD="$root_secret" exec mariadb-dump --user=root --single-transaction --quick --routines --events --triggers --hex-blob "$database_name"
' > "$stage/database.sql"
remaining tar --acls --xattrs --numeric-owner -C /volume1/@docker/volumes/resourcespace_filestore_data/_data -cpf "$stage/filestore.tar" .
remaining tar --acls --xattrs --numeric-owner -C /volume1/docker/resourcespace -cpf "$stage/configuration.tar" config.php db.env docker-compose.yaml Dockerfile entrypoint.sh cronjob LICENSE
remaining bash -c 'cd /volume1/@docker/volumes/resourcespace_filestore_data/_data; find . -type f -print0 | sort -z | xargs -0 sha256sum' > "$stage/filestore.sha256"
release_app
freeze_seconds=$(( $(date +%s) - freeze_started ))
printf 'Application resumed; freeze duration %s seconds\n' "$freeze_seconds"
python3 - "$AIA_BACKUP_ID" "$freeze_seconds" "$expected_app" "$expected_db" > "$stage/manifest.json" <<'PY'
import json,sys,datetime
print(json.dumps({'backupId':sys.argv[1],'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'freezeSeconds':int(sys.argv[2]),'appImage':sys.argv[3],'dbImage':sys.argv[4],'database':'resourcespace','consistency':'app paused; DB single transaction; filestore/config copied in same freeze','encryption':'OpenSSL CMS AuthEnvelopedData AES-256-GCM / RSA-3072','restoreTested':False},indent=2))
PY
tar -C "$stage" -cf - database.sql filestore.tar configuration.tar filestore.sha256 manifest.json | encrypt "$job/recovery.tar.cms"
cd "$job"
sha256sum images.tar.cms recovery.tar.cms > encrypted.sha256
cp "$stage/manifest.json" "$job/manifest.json"
printf '%s\n' 'Encrypted recovery set complete; private staging retained until independent decryption verification'
cat "$job/manifest.json"
sha256sum images.tar.cms recovery.tar.cms
