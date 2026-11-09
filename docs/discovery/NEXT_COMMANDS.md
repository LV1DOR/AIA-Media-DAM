> Historical discovery snapshot, superseded by [current handoff](CURRENT_HANDOFF.md). Backup approval and the core restore gate have since completed; use current status before executing any old continuation commands.

# Exact next commands and required inputs

These commands resume **read-only P0 discovery**. They do not approve backups, new services, migrations, restarts or public ingress. Use existing approved secure access; do not paste passwords/API keys into shell history or chat.

**Current:** corrected credentials succeeded and NAS inventory/read-only recovery preflight are complete. Access troubleshooting below is historical. Next action is review of [P0_BACKUP_APPROVAL.md](../operations/P0_BACKUP_APPROVAL.md), with maintenance approval, encryption custody and independent/isolated target inputs before any backup/write/restore. The read-only preflight may be repeated by streaming `scripts/discovery/nas-recovery-preflight.sh --read-only` through an authorized sudo SSH session.

**Follow-up:** ResourceSpace at the plan address is now reachable and signed API reads are verified. Step 1 is resolved for this session; step 2 (approved NAS SSH/Docker method/operator) is the outstanding access requirement. The owner reports no backup/restore evidence and no licensed Media Vault source. Application access does not provide NAS/backup access.

**8 November:** NAS SSH is now authorized. Connection to port 22 timed out, then was refused before authentication; ResourceSpace remains reachable. Obtain confirmation that SSH is enabled and its actual port before repeating the inventory command. No credentials were used or saved in this failed transport attempt. The alias examples below still require an approved, working host/port definition.

**Latest:** owner enabled SSH; port 22 now accepts connections. The supplied account was rejected after one password attempt. Verify account/credential/SSH eligibility before retrying. No remote command ran and no credential was saved to project files. A first-use host key was cached locally with `accept-new`; it has not been independently verified. Future connections can use strict checking against this cached key, with that trust limitation recorded.

## 1. Obtain current connectivity

IT supplies the current NAS/ResourceSpace host/port and approved VPN/SSH alias. Recheck the supplied endpoint, not a guessed IP range:

```powershell
$nasAddress = Read-Host 'Current approved NAS/ResourceSpace host'
$resourceSpacePort = Read-Host 'Current ResourceSpace port'
node scripts/discovery/probe.mjs $nasAddress $resourceSpacePort
```

A timeout does not prove the NAS is down. No scanning, credential guessing or automatic host-key acceptance is included.

## 2. Verify selected SSH host/context, then collect inventory

Use an alias supplied/confirmed by IT. Host keys must already be verified through the approved process. Batch mode refuses interactive credential prompts.

```powershell
$nasAlias = Read-Host 'Approved existing NAS SSH alias'
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes $nasAlias 'docker context show'
```

Confirm with IT that this context targets the NAS engine, rather than a remote/unrelated engine. Then save private output locally:

```powershell
New-Item -ItemType Directory -Force -Path .local/discovery | Out-Null
Get-Content -Raw scripts/discovery/collect-nas.sh |
  ssh -o BatchMode=yes -o StrictHostKeyChecking=yes $nasAlias 'sh -s -- --inventory-only' |
  Out-File -Encoding utf8 .local/discovery/nas-inventory.txt
if ($LASTEXITCODE -ne 0) { throw 'NAS inventory incomplete; inspect private output' }
```

The first pass lists containers without inspecting all private workloads. After identifying the exact relevant container IDs, run again with those IDs; the script rejects option-like/unsafe identifiers. This example prompts for actual IDs rather than guessing names:

```powershell
$damContainerId = Read-Host 'Verified ResourceSpace container ID (hex only)'
$dbContainerId = Read-Host 'Verified MariaDB container ID (hex only)'
if ($damContainerId -notmatch '^[a-f0-9]{12,64}$' -or $dbContainerId -notmatch '^[a-f0-9]{12,64}$') {
  throw 'Use verified hexadecimal container IDs'
}
$remoteInventoryCommand = 'sh -s -- --inventory-only ' + $damContainerId + ' ' + $dbContainerId
Get-Content -Raw scripts/discovery/collect-nas.sh |
  ssh -o BatchMode=yes -o StrictHostKeyChecking=yes $nasAlias $remoteInventoryCommand |
  Out-File -Encoding utf8 .local/discovery/nas-relevant-containers.txt
if ($LASTEXITCODE -ne 0) { throw 'Relevant-container inventory incomplete' }
```

Do not attach raw output publicly. Review mount paths/container names and transcribe sanitized facts into ENVIRONMENT_BASELINE/INVENTORY. Do not run unrestricted `docker inspect`, `docker compose config`, environment dumps or log exports on production: these can print secrets.

## 3. Complete app and recovery discovery

Using the authorized ResourceSpace test/admin session, record version, API Test Tool/native auth availability, permissions, metadata/state mapping and extension points without changing settings. Obtain the template's approved local source path and license/invoice reference. Obtain backup operator and existing manifest/restore report; if absent, prepare exact environment-specific commands for operator approval using P0_BACKUP_RESTORE.md.

## 4. Check upstream evidence locally

```powershell
node scripts/discovery/validate.mjs
```

For a new ResourceSpace discovery report, an approved secure launcher must provide per-process `AIA_DISCOVERY_RS_URL`, `AIA_DISCOVERY_RS_USER` and `AIA_DISCOVERY_RS_KEY`. The script accepts no key/password command-line argument. It needs the native API key, not the account password. After securely injecting these variables:

```powershell
node scripts/discovery/inspect-resourcespace.mjs .local/discovery/resourcespace-new.json --allow-private-http
```

The HTTP flag is only for this approved private IPv4 endpoint; default transport is HTTPS. Output must be a new file. The script reads selected status/permissions/types, one search row and that row's visible field definitions, recording only a minimized report. It cannot inventory the NAS or prove backup/share behavior. Never commit environment values or raw source responses.

The Gokapi upstream inspector writes new files with exclusive creation; it refuses to overwrite the existing private snapshot. To refresh later, preserve the old evidence and intentionally choose a new workspace/evidence location before running it again. Changing versions requires rechecking capability assertions and owner decisions.

## 5. Before any backend write

Finish the inventory and tested restore, record P0 outcome, then agree F1–F5 test scope and synthetic data. Only then prepare actual staging commands, image digests and isolated paths for review. No NAS write/start/restart/public-port/migration command has been executed or provided as ready to run while those inputs are unknown.
