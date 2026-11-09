# P0 NAS inventory — authenticated inspection, 8 November 2026

**Result: NAS access and substantial P0.2 inventory completed. P0 exit remains NO-GO pending a consistent recovery set and tested restore.** The corrected credential worked. No asset, configuration, permission, container lifecycle, snapshot or firewall change was made.

Evidence was observed over SSH from 09:50:39 to 09:57:40 UTC. Docker inspection required sudo; no group membership was changed. The existing first-use host key matched the cached ED25519 key; independent host identity verification remains unproven. The missing `/home/IT` warning did not prevent commands and was not repaired. Credentials were not saved to workspace files.

## Host and Docker

| Area | Observed result |
|---|---|
| Hardware | UGREEN DXP4800 Plus; Pentium Gold 8505; 6 logical CPUs |
| OS | Debian 12 base; NAS OS_VERSION 1.20.0.0142; Linux 6.18.15; x86_64 |
| RAM | 7706 MiB total; 4155 MiB available at the sample |
| Storage | Two-member md1 RAID1, both healthy (`UU`); Btrfs `/volume1` |
| Volume space | 3,890,884,608 KiB total; 3,885,449,336 KiB available at preflight |
| Snapshots | `btrfs subvolume list -s /volume1` returned none; scheduling/offsite policy unknown |
| Engine | Docker client/server 29.6.2, Compose v5.1.3, context default; root `/volume1/@docker` |
| Containers | Only `resourcespace` and `resourcespace-db` observed; both running for about 12 days |
| Lifecycle | Both `unless-stopped`; neither has a Docker healthcheck |
| Networking | App publishes 8088 on IPv4/IPv6 all host interfaces; DB 3306 is not host-published |
| App networks | resourcespace_backend and resourcespace_frontend bridge networks; neither has `internal=true` |
| Deployment | `/volume1/docker/resourcespace/docker-compose.yaml`; local ResourceSpace Dockerfile build |

An all-interface bind is not proof of public internet exposure. Firewall, proxy, domain/TLS ownership and external reachability still need IT evidence. Compose does not explicitly declare resource limits or log rotation; daemon defaults are not audited. The source build uses SVN checkout; its recipe is not visibly pinned to installed r29907. The exact local image has no registry digest, so recovery needs its export or an independently reproducible equivalent.

## Data boundaries and versions

The app mounts `resourcespace_filestore_data` at `/var/www/html/filestore`, and binds `config.php` into `/var/www/html/include/config.php`. Its actual volume source uses 3296 KiB. The DB uses separate `resourcespace_mariadb_data`, 172108 KiB. Exact paths, ownership and image identities are in the [sanitized JSON inventory](evidence/nas-inventory-2026-11-08.json) and [backup change](../operations/P0_BACKUP_APPROVAL.md).

The filestore root directory is mode 0777, UID/GID 0/0; config is 0600, UID/GID 33/33; DB directory is 0755, UID/GID 999/999. These observations are not an ACL/authorization audit; do not chmod/remount the existing volumes during discovery.

ResourceSpace working-copy revision: **r29907**, matching the earlier 11.0 API baseline. PHP CLI: **8.3.6**. MariaDB server/dump client: **11.4.13**. All 66 application tables use InnoDB, and DB event scheduling is OFF. Only schema metadata, group policy strings and aggregate resource/share counts were read; no user rows, asset values, API keys or DB secrets were printed/exported.

PHP CLI reports upload_max_filesize 2M and post_max_size 8M, with no CLI memory/execution limit. These are not a verified Apache/browser upload limit. Large-file readiness remains untested.

## DAM/workflow and operations

- Current resource aggregates: four archive-0/access-0 rows and one archive-3/access-0 row. These are database state counts, not an owner-approved mapping of “Approved” and “Deleted”. No originals were opened or downloaded.
- No external access-key rows currently exist. This does not prove sharing works or remove the need for restore-time stale-share checks.
- Six existing groups were found: Administrators, General Users, Super Admin, Archivists and two Restricted User groups. Their policy strings explain why DEV can be privileged without `a`; no user-to-group identities were exported.
- Relevant fields include year 88, event89 89, legacy event 74, source 54, title 8 and date 12. No field name matched championship/rights/licen in the scoped metadata-name query. Rights may live in plugin records/other fields; do not silently create a replacement taxonomy.
- Apache and cron processes run inside the app. The installed ResourceSpace daily cron job only invokes `cron_copy_hitcount.php`; root/www-data have no personal crontabs. Full maintenance/preview queue scheduling remains unproven.
- `private-backup` contains three historical config copies only. No complete DB/media/config recovery set or independent-copy evidence was found in this relevant project folder. Other NAS backup products/destinations remain unknown.

## F1 source findings and correction

Read-only installed-source inspection confirms that `api/index.php` defaults to **`authmode=userkey`** for the signed user-key requests used on 7 November. **`authmode=native` is the browser-session route.** Earlier reports called signed requests “native”; that terminology was inaccurate and is corrected in the discovery tool/evidence. No authentication behavior was changed.

`api_delete_access_keys` exists in installed `include/api_bindings.php`; its POST assertion is conditional on native mode. The assertion helper returns immediately when that flag is false. This source behavior is more permissive than the public documentation's native-only note; **it is not proof that signed remote revocation is authorized/safe end to end**. Owner attribution, lower-role denial, source revocation and bypass tests must run on the isolated clone. No mutating call was tried.

No clear external-share creation wrapper was found in the scoped installed bindings search. Collection creation is present. Enabled plugins/other extension points and actual supported share creation remain F1 work; do not invent an endpoint or select a plugin without approval.

## Recovery preflight and next gate

`scripts/discovery/nas-recovery-preflight.sh --read-only` was streamed into the existing SSH session without writing a remote script file. It completed successfully and reconfirmed images, mounts, InnoDB engines, event scheduler, free space and required tools. The only failed DB authentication was an initial attempt using the alternate MARIADB environment names; no password value was exposed. Using the actually injected MYSQL-named variables succeeded.

[P0_BACKUP_APPROVAL.md](../operations/P0_BACKUP_APPROVAL.md) now contains actual paths, image IDs, source-safe dump/export/archive commands, proposed maintenance boundary, recovery validation and the owner decisions needed before writes. No dump, image export, pause, snapshot, backup directory or restore clone was created. A real backup needs maintenance approval plus encryption custody and an independent target. The Media Vault license/source gate remains open separately.
