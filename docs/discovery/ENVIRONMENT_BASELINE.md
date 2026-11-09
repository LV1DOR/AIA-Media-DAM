# Environment baseline — P0

Recorded 7 November 2026. Confidence is explicit: **observed**, **plan-reported**, or **unknown**. No production changes were made.

**Current update, 8 November:** corrected SSH authentication and authorized sudo inspection succeeded. See [NAS inventory](P0_NAS_INVENTORY_2026-11-08.md) and [recovery approval package](../operations/P0_BACKUP_APPROVAL.md). The earlier access failures below are historical. No backend data/configuration/lifecycle change occurred.

Access update, 8 November: the owner authorized NAS SSH, but port 22 timed out and then returned `ECONNREFUSED` before authentication. Port 8088 still connects and a specific VPN route is present. No NAS inventory or new API baseline was obtained; see [the SSH follow-up](P0_FOLLOWUP_2026-11-08.md).

Later update: the owner enabled SSH and transport now succeeds. One authentication attempt for the supplied account was rejected (`Permission denied (publickey,password)`); no remote command ran. The password was used for that authentication attempt but not saved to project files. The host key was recorded locally on first use; see the follow-up for its verification boundary.

## Initial observed workstation/workspace

| Item | Finding | Evidence |
|---|---|---|
| Workspace | `C:\Users\Luke\AIA-Media`; initially only the master plan | Directory listing, `rg --files`, 7 Nov |
| Git | No repository; Git 2.50.1.windows.1 installed | `git status --short`, `git --version` |
| Project guidance | No AGENTS.md in workspace or checked ancestors | Explicit checks of C:\, C:\Users, C:\Users\Luke and workspace |
| Paid template | Not present in this workspace; elsewhere not established | Workspace file inventory only; no broad personal-folder search |
| Node | v22.17.0 | `node --version`; not a chosen application runtime yet |
| Local Docker | Client/server 29.8.2; Compose v5.5.1; context `desktop-linux` | Version-only commands; no workload mutation |
| SSH | Client and config file exist; no HostName entry matching plan IP | Exact-match config check; no keys, passwords or unrelated aliases exposed |
| NAS connectivity | TCP 192.168.250.80:8088 timed out in 4 seconds | One bounded connection attempt; no login/upload/API mutation |

Local Docker versions do **not** describe NAS Docker. The initial timeout was resolved in the follow-up below; it did not establish that the NAS was offline.

## Live follow-up after connectivity was restored

At 2026-11-07T18:02:04.068Z, TCP 8088 connected in 41 ms. Root HTTP returned a login redirect; the server header advertised Apache/2.4.58 (Ubuntu), which is not evidence of the NAS firmware. Signed native API requests succeeded using POST bodies, without keys/signatures in URLs. The repeatable sanitized report was captured at 18:05:15.346Z in [resourcespace-2026-11-07.json](evidence/resourcespace-2026-11-07.json).

- ResourceSpace reports **SVN 11.0 / r29907**, system status OK. This health response did not include a verified cron/backup/restore check.
- `checkperm(a)` returns false; metadata administration returns HTTP 403. DEV also has `v`, `u`, `c`, `e0` and `e-1`: it can see confidential resources and has substantial management/edit permissions. Do not equate absence of `a` with least privilege.
- Resource types: Photo (1), Document (2), Video (3), Audio (4). Existing types were not changed; the photography/video V1 product scope still applies.
- Bounded archive-0 search and structured pagination return successfully. One sample resource's visible field definitions were extracted; titles/content/filenames/media were not saved.
- An unsigned status API request returns HTTP 401 without system status. This is one authentication-negative check, not a full authorization audit.
- Browser automation host is unavailable; no browser login, API Test Tool inspection or screenshot was obtained. The supplied password was not needed or used.
- Owner reports no licensed source or backup/restore evidence. No NAS SSH/Docker credentials/access method has been supplied.

## NAS/application baseline

| Required area | Current evidence | Outstanding evidence / owner |
|---|---|---|
| NAS hardware/firmware | DXP4800 Plus, OS 1.20.0.0142, x86_64, Pentium Gold 8505, 7706 MiB RAM | Owner/system policy and firmware lifecycle; IT |
| Storage | RAID1 healthy, Btrfs volume1; resourcespace_filestore_data/resourcespace_mariadb_data mounts/permissions/sizes observed | Snapshot schedule/offsite policy, sustained load and safe permission changes; IT |
| Docker | NAS Engine 29.6.2, Compose v5.1.3, two containers; image IDs, networks/ports/restart recorded; healthchecks absent | Reproducible custom image, release health and proxy/firewall review; IT |
| ResourceSpace | 11.0/r29907, signed default-userkey API, PHP CLI 8.3.6, fields/groups/process schedule inspected | HTTP PHP, API Test Tool, share lifecycle, complete maintenance/preview schedule; DAM administrator |
| MariaDB | 11.4.13, separate volume, no host-published port, all 66 app tables InnoDB, events OFF | Consistent backup/restore and recovery custody; DBA |
| Network | Historical private endpoint timed out | Current endpoint, authorized access, VLAN, firewall, proxy, TLS/DNS owners; network team |
| Identity | Unknown | IdP, MFA, groups, per-user API delegation and offboarding; IT/security |
| DAM content/workflow | One live-resource search and visible field schema observed; privileged DEV flags recorded | Full taxonomy/state mapping, lower-privilege identities, synthetic test scope and native shares; DAM owner |
| Backups | Owner reports no evidence available | Consistent DB/files/config copy, independent target, checksums and restore; backup operator |
| Performance | Not measured | Representative CPU/RAM/I/O, previews, LAN/WAN throughput and concurrency; IT |
| Transfer policy | Unapproved | Size/concurrency, expiry, MIME policy, encryption, retention; Marketing + IT |
| Public ingress | Unapproved | Domains, firewall/TLS and offsite isolation proof; IT/security |

## Preservation boundary

No NAS container, asset, share, configuration, firewall, DNS or source permission was changed. Read-only API calls accessed authorized metadata; normal application audit/search logging may occur. No backup/restore or staging service was started. The [backup procedure](../operations/P0_BACKUP_RESTORE.md) is prepared but unexecuted. Host inventory and recovery proof remain necessary to pass P0.

See [INVENTORY.md](INVENTORY.md) for the collection checklist and [NEXT_COMMANDS.md](NEXT_COMMANDS.md) for the exact continuation procedure.
