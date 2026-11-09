# Historical backup proposal

**Superseded on 8 November 2026:** the owner approved maintenance and delegated the remaining recovery choices. Execution and restore succeeded using CMS encryption rather than the proposed GPG mechanism. See [actual results](../discovery/P0_RECOVERY_RESULTS.md) and [current runbook](P0_BACKUP_RESTORE.md). Text below is retained as the pre-approval review record, not current status.

# P0 backup change for approval — NAS inventory, 8 November 2026

**Prepared, not approved, not executed.** The master plan's P0.3 requires human backup approval. SSH access authorized inventory; it has not been treated as approval to interrupt the live app, create a recovery set or copy production media elsewhere.

## Concrete proposed change

- Backup source: existing `resourcespace` and `resourcespace-db` only. No Gokapi/registry deployment.
- Proposed new private destination: `/volume1/docker/aia-media-backups/<UTC-backup-id>/`, root-owned directory mode 0700 and files created under `umask 077`. This directory does not exist as an approved backup destination yet. It is on the same NAS and cannot be the sole recovery copy.
- Export both exact runtime images before the application freeze. The locally built ResourceSpace image has no registry digest; losing the NAS without its image/source would prevent an exact rebuild. Record image IDs, release revision and checksums.
- Briefly **pause only `resourcespace`**, including its Apache/cron processes. Public/staff requests on 8088 will stall/fail during this window. Keep MariaDB running to make a consistent logical dump. Proposed total pause limit: 120 seconds, with each operation limited by the remaining budget and an EXIT/HUP/INT/TERM unpause trap. A kill/power failure still needs operator recovery; never promise the trap covers it.
- While paused: use a single-transaction logical dump with routines/events/triggers; archive the filestore and runtime/deployment config. All 66 database tables currently use InnoDB; DB event scheduling is OFF. Maintenance approval must also exclude any other DB writer during the capture.
- Unpause immediately after the consistent DB/files/config capture, before encrypting/checksumming/copying the recovery set.
- Encrypt the recovery archive using an **AIA-approved GPG recipient public-key fingerprint** and retain custody/recovery proof outside this NAS. Do not reuse the SSH password, generate an unapproved key or put a passphrase in a command line.
- Copy only the encrypted archive and safe manifest to the owner-approved independent target. Verify archive checksum and decryption/readability from another machine before an isolated restore.

The images total approximately 2.86 GB of reported image size; export/compression sizes are not yet measured. The filestore uses 3296 KiB and DB data uses 172108 KiB. `/volume1` has roughly 3.6 TiB available at inventory time. Allow substantial staging/encryption headroom; recheck exact free space immediately before execution.

Vendor verification: [Docker pause](https://docs.docker.com/reference/cli/docker/container/pause/) suspends all processes in the selected container. [MariaDB dump](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump) documents InnoDB consistent-transaction backups; avoid concurrent schema changes and keep DB/files/config within the approved common write boundary. This is a proposed engineering procedure, not a tested restore guarantee.

## Verified sources and commands

The following commands identify exact inputs. They are **read-only** and can be rerun by the authorized NAS operator:

```sh
sh nas-recovery-preflight.sh --read-only
```

The script is in `scripts/discovery/` in this workspace. Pipe its content over SSH rather than writing it into production during discovery. Current expected results:

| Component | Confirmed source |
|---|---|
| ResourceSpace runtime image | `sha256:0ab7853ff0b41a2ca2e1bd07092749f12ece4f806ce8bf6866a9b23635ce411f` |
| MariaDB runtime image | `sha256:823a099a93df6416c6c7ed33c79a2d43e92ffbd2ccc0e83973ef045f2dae1ac0` |
| MariaDB registry digest | `mariadb@sha256:250e1609e93c0e6aecf64bfbab2d84d5e89d2481540fe77447ff6c855c3b1873` |
| Database | `resourcespace`, MariaDB 11.4.13, 66 InnoDB tables |
| Originals/previews volume | `/volume1/@docker/volumes/resourcespace_filestore_data/_data` |
| Runtime config bind | `/volume1/docker/resourcespace/config.php` → `/var/www/html/include/config.php` |
| Deployment/build sources | `/volume1/docker/resourcespace/{docker-compose.yaml,db.env,Dockerfile,entrypoint.sh,cronjob,LICENSE}` |
| App code revision | SVN r29907; API reports 11.0 |

Credentials already injected into the DB container can be used without printing them or copying them to the command line. The logical dump operation, **only inside the approved capture window**, is:

```sh
docker exec resourcespace-db sh -c '
root_secret=${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}
database_name=${MARIADB_DATABASE:-${MYSQL_DATABASE:-}}
test -n "$root_secret" && test "$database_name" = resourcespace || exit 1
MYSQL_PWD="$root_secret" exec mariadb-dump --user=root --single-transaction --quick --routines --events --triggers --hex-blob "$database_name"
'
```

This command's stdout is a **sensitive full database dump**. It must be redirected directly into the approved private staging area or encryption stream; never print it in chat/tool output or commit it. Physical copying of the live `/var/lib/mysql` directory is not the proposed consistency method.

The exact image export and scoped file archive commands for the approved job are:

```sh
docker image save sha256:0ab7853ff0b41a2ca2e1bd07092749f12ece4f806ce8bf6866a9b23635ce411f sha256:823a099a93df6416c6c7ed33c79a2d43e92ffbd2ccc0e83973ef045f2dae1ac0
tar -C /volume1/@docker/volumes/resourcespace_filestore_data/_data -cpf - .
tar -C /volume1/docker/resourcespace -cpf - config.php db.env docker-compose.yaml Dockerfile entrypoint.sh cronjob LICENSE
```

Each stdout must go directly to protected job output; these are reviewed component commands, **not a ready-to-run combined backup job**. The runner with budget/traps/secret-safe logging will be finalized against the approved target and encryption recipient before execution. No pause/unpause/archive/dump command above has been run.

## Isolated restore proposal

Restore into a new project `aia-media-restore-p0` on an approved isolated target, with new DB/filestore/config storage, an internal Docker network, no production mounts and no live public shares/notifications. Keep the restored web container offline from public/LAN ingress until outbound mail/jobs and stale shares are safely contained. Do not copy production `.env` files into an ordinary developer application setup; this is a separately approved restricted recovery rehearsal.

Load the exact saved images, import the logical dump into the new database and restore matching filestore/config with correct ownership. Before any browser reachability, rebind the clone's config to its new DB and disable outbound integrations without exposing secrets. Validate approved operator login, one original's checksum, preview, collection browsing and restricted-user denial. Then run F1 synthetic share tests in the clone and measure recovery time. The current 0 external shares does not replace a restore-time check.

## Approval inputs still needed

1. Owner approval for the new NAS backup directory and a maintenance window permitting the proposed up-to-120-second application pause.
2. Approved GPG recipient fingerprint/key custody and the independent encrypted-copy destination.
3. Approved isolated restore host, access restrictions, operator and rollback/recovery owner; RPO/RTO acceptance remains a business decision.

If any preflight fact changes, stop and update this change. Do not change ownership, chmod the existing volumes, enable ports, install software, stop MariaDB, clean existing media or remove backup files as part of this proposal. Abort recovery action: verify container state and run `docker unpause resourcespace` only if this change left it paused; preserve incomplete evidence privately for diagnosis.
