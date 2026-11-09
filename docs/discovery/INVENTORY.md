# P0 inventory and evidence checklist

Status: authenticated NAS/Docker inspection and read-only recovery preflight completed; owner/policy/recovery evidence remains incomplete. See [NAS evidence](P0_NAS_INVENTORY_2026-11-08.md). Do not substitute workstation output for NAS evidence.

| ID | Evidence required | Collection / handling | Status |
|---|---|---|---|
| INV-01 | Authorized NAS/SSH/VPN endpoint and operator | SSH/sudo inspection works; maintenance/operator ownership unconfirmed | PARTIAL |
| INV-02 | NAS model, firmware, RAID, filesystem, snapshots | DXP4800 Plus, OS 1.20.0.0142, healthy RAID1, Btrfs; no snapshots reported; policy unknown | PARTIAL |
| INV-03 | Architecture, RAM, disk availability | x86_64, 7706 MiB total RAM, volume capacity/free and instantaneous load recorded | OBSERVED |
| INV-04 | Engine/Compose versions, containers and digests | NAS 29.6.2/Compose v5.1.3; exact image IDs/digest recorded | OBSERVED |
| INV-05 | Relevant mounts, restart/health, ports/networks | Separate named volumes, config bind, unless-stopped, no healthchecks; networks/ports recorded | OBSERVED |
| INV-06 | ResourceSpace/PHP/MariaDB exact versions | r29907/11.0; PHP CLI 8.3.6; MariaDB 11.4.13; HTTP PHP settings not audited | PARTIAL |
| INV-07 | API Test Tool, native auth, plugins/permissions | Native signed POST and selected permission flags verified; UI/groups unverified | PARTIAL |
| INV-08 | Fields/states/groups and approved synthetic test scope | Field IDs, six group policies and aggregate resource/share counts read; workflow decisions/test scope open | PARTIAL |
| INV-09 | Backup set and independently readable copy | Manifest with consistency method/checksums; secure storage reference | MISSING |
| INV-10 | Isolated restore report | Login, original hash, preview, collection and permission verification | MISSING |
| INV-11 | IdP/DNS/proxy/monitoring ownership | Owner-provided references; no secret values | MISSING |
| INV-12 | Capacity/load/uplink baseline | Representative window and offsite tests approved by IT | MISSING |
| INV-13 | Media Vault source, invoice and scope | Approved source path/reference and license review | MISSING |

The collector intentionally does not read Compose environment, container environments, labels, command lines, logs, databases or media. Its allowlist output includes private container names, ports and mount paths: save to ignored `.local/`, review, then transcribe only necessary facts here. Firmware, RAID, snapshot policy, application versions, backup consistency and authorization require additional operator evidence; Docker inspect alone cannot prove them.
