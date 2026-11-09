#!/bin/sh
# P0.2: read-only collector. Run on the approved NAS, never assume local context.
# Output contains private infrastructure paths: save outside version control.
# Does not read env/labels/logs/config/database content or acquire elevated rights.
set -eu

if [ "$#" -lt 1 ] || [ "$1" != "--inventory-only" ]; then
    printf '%s\n' 'Usage: sh collect-nas.sh --inventory-only [explicit-container-id ...]' >&2
    exit 2
fi
shift
for candidate in "$@"; do
    case "$candidate" in
        ''|*[!a-zA-Z0-9_.-]*|-*) printf '%s\n' 'Invalid container identifier' >&2; exit 2 ;;
    esac
done

printf '\n%s\n' '=== Capture time UTC ==='
date -u '+%Y-%m-%dT%H:%M:%SZ'
printf '\n%s\n' '=== Architecture/kernel (not NAS model/firmware) ==='
uname -smr
printf '\n%s\n' '=== Filesystem capacity ==='
df -Pk
if command -v free >/dev/null 2>&1; then
    printf '\n%s\n' '=== Memory ==='
    free -m
fi
command -v docker >/dev/null 2>&1 || { printf '%s\n' 'Docker not available to this user' >&2; exit 1; }
printf '\n%s\n' '=== Docker context: verify this is NAS ==='
docker context show
printf '\n%s\n' '=== Docker engine/client versions ==='
docker version --format '{{json .Client.Version}} {{if .Server}}{{json .Server.Version}}{{end}}'
printf '\n%s\n' '=== Compose version ==='
if ! docker compose version; then printf '%s\n' 'Compose unavailable; record this gap'; fi
printf '\n%s\n' '=== Containers (no command/env/labels) ==='
docker ps -a --no-trunc --format '{{json .ID}} {{json .Names}} {{json .Image}} {{json .Status}} {{json .Ports}}'
printf '\n%s\n' '=== Networks ==='
docker network ls --format '{{json .ID}} {{json .Name}} {{json .Driver}}'
printf '\n%s\n' '=== Volume names/drivers ==='
docker volume ls --format '{{json .Name}} {{json .Driver}}'
for candidate in "$@"; do
    printf '\n%s\n' '=== Explicitly selected container: allowlisted fields only ==='
    docker inspect --type container --format '{"id":{{json .Id}},"name":{{json .Name}},"imageId":{{json .Image}},"imageRef":{{json .Config.Image}},"status":{{json .State.Status}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}},"restart":{{json .HostConfig.RestartPolicy}},"ports":{{json .NetworkSettings.Ports}},"mounts":{{json .Mounts}}}' "$candidate"
    image_id=$(docker inspect --type container --format '{{.Image}}' "$candidate")
    docker image inspect --format '{"id":{{json .Id}},"digests":{{json .RepoDigests}},"architecture":{{json .Architecture}},"os":{{json .Os}}}' "$image_id"
done
printf '\n%s\n' '=== Not collected: firmware/RAID/snapshots, app versions, API permissions, backup/restore, representative load ==='
