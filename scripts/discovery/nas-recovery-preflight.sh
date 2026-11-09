#!/bin/sh
# P0.2 read-only recovery preflight. Run as an authorized NAS operator.
# Emits no credentials, environment dump, filenames from media, or DB row data.
set -eu
if [ "$#" -ne 1 ] || [ "$1" != '--read-only' ]; then
    printf '%s\n' 'Usage: sh nas-recovery-preflight.sh --read-only' >&2
    exit 2
fi
test "$(id -u)" -eq 0 || { printf '%s\n' 'Authorized sudo access required' >&2; exit 1; }
docker inspect --format '{{.State.Running}} {{.State.Paused}} {{.Image}}' resourcespace resourcespace-db
docker inspect --format '{{range .Mounts}}{{println .Type .Name .Source .Destination}}{{end}}' resourcespace resourcespace-db
docker exec resourcespace-db sh -c '
root_secret=${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}
database_name=${MARIADB_DATABASE:-${MYSQL_DATABASE:-}}
test -n "$root_secret" && test "$database_name" = resourcespace || exit 1
MYSQL_PWD="$root_secret" mariadb --user=root --batch --skip-column-names --execute="
SELECT VERSION();
SELECT ENGINE,COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() GROUP BY ENGINE;
SELECT @@event_scheduler;
" "$database_name"
'
du -sk /volume1/@docker/volumes/resourcespace_filestore_data/_data /volume1/@docker/volumes/resourcespace_mariadb_data/_data
df -Pk /volume1
docker image inspect --format '{{.Id}} {{.Size}}' resourcespace-resourcespace mariadb:11.4
for tool in bash timeout tar sha256sum gpg python3; do command -v "$tool"; done
printf '%s\n' 'READ_ONLY_PREFLIGHT_COMPLETE; no backup, pause, snapshot, restore or migration performed'
