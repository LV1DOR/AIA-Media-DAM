# NAS operations and recovery

Owner-authorized LAN installation, 8 November 2026. Root: `/volume1/docker/aia-media-ecosystem`, mode 0700. Its `current` symlink selects an immutable source release. Runtime secrets live in `.private/app.env`, mode 0600; registry envelopes require the same `AIA_MASTER_KEY` after restore. Do not regenerate it over existing data. Operator SSH is `IT@192.168.250.80`, pinned host key recorded in the P0 inventory. Credentials belong in the private handover, never command arguments or Git.

## Service operations

On the NAS through approved SSH, use the release and private Compose environment together:

```sh
root=/volume1/docker/aia-media-ecosystem
docker compose --env-file "$root/.private/compose.env" \
  -f "$root/current/infra/compose/compose.yaml" \
  -f "$root/.private/ingress.override.yaml" ps
```

Use the same prefix with `up -d --no-build` after a verified image build. Do not use `down -v`. Only Caddy publishes LAN 8443/8444. Native ResourceSpace binds NAS loopback 8088, its DB has no host port, and Gokapi has no host port. The API reaches ResourceSpace through the existing Docker frontend network. No router forwarding, public DNS or Internet ingress was configured. Separate Media and Transfer images can be rolled independently; the API/registry remains shared infrastructure.

ResourceSpace uses its original DB/filestore volumes and exact original images. Its project additionally uses `/volume1/docker/resourcespace/docker-compose.override.yaml` for upload limits, resource limits, health checks and loopback binding. Always include that file when operating the original project. The source base URL is internal `http://resourcespace`. For emergency native UI access, an approved operator may use the NAS loopback route; SSH forwarding is currently disabled and this installation did not change that policy.

Logs: `docker logs --tail 100 <container>`. App logs redact cookies, request bodies and opaque IDs. Treat upstream logs as private. Audit events retain 180 days; native engine logs have separate retention. The 30-second API worker expires links, retries source cleanup and completes managed native offboarding. Review pending cleanup in Settings → System. Investigate persistent failures rather than deleting registry rows.

## TLS and access

The private CA public root is `.local/deployment/AIA-LAN-CA.crt` on the workstation. SHA-256 fingerprint:

`A7:7D:35:A6:F9:E4:66:D6:A8:D9:D0:86:CC:4C:CD:FC:A9:C4:F5:5A:AD:84:7B:2D:72:07:B4:74:25:CD:93:97`

IT installs trust after out-of-band fingerprint verification. No trust-store changes or certificate-warning bypass were automated. Preserve Caddy's data volume/private CA keys in encrypted recovery. Browser trust must be refreshed if the CA changes. Public Internet deployment requires a real domain, network design, external throughput testing and its own approval; LAN installation does not imply that release.

Initial owner credentials are in `.local/deployment/OWNER_ACCESS.txt` under restricted workstation ACLs. An administrator must enroll TOTP on first login. For lost MFA/password, use `scripts/operations/operator.mjs` inside the API container, with `--approved-maintenance` and a JSON request on private stdin. Supported actions: `reset-mfa` and `reset-password`, with `username` and, for the latter, a new `password` of at least 14 characters. Never pass the JSON/secret in argv, a visible terminal command or shell history. Reset invalidates existing sessions. `create-qa`/`disable-qa` are operator-only installation tools, not HTTP routes.

## Backup and restore

Daily capture script: `.private/backup-ecosystem.py`. It takes a lock, checks disk space, pauses only the API and ResourceSpace for a bounded consistent capture, makes a MariaDB logical dump and Btrfs reflink copies, then resumes both before encryption. A 120-second watchdog releases the pause and rejects an over-budget capture. CMS AES-256-GCM uses the preserved RSA public recipient. No decryption key resides on the NAS.

Backup sets: `/volume1/docker/aia-media-backups/ecosystem-<UTC>/`. `manifest.json` identifies the source release, timestamp, encrypted bytes and checksum. `.private/backup-status.json` records the latest completed capture. Failure logs are private `.private/backup.log`; a successful capture is not an independent-copy or restore result. Temporary Gokapi payloads are excluded. The first whole ResourceSpace restore and the independent ecosystem registry restore have separate evidence under `docs/testing/evidence` and the P0 recovery report.

The workstation key reference is `.local/recovery-keys/p0-20261108T102833765Z/key-reference.json`; its private key is DPAPI CurrentUser protected. Losing that Windows profile can lose recovery access. Keep workstation encrypted copies and establish independent key escrow/offsite retention. The large exact-image export is NAS-only; do not claim an off-NAS exact-image recovery. Business RPO/RTO and named recovery ownership still need to be adopted.

Restore into **fresh isolated volumes/network first**, never over live changes:

1. Verify the encrypted artifact checksum against its manifest. Decrypt through `scripts/discovery/recovery-key.mjs` with the original Windows profile, keeping plaintext in private storage or pipes. Require authenticated decryption success.
2. Restore MariaDB through its native import and permanent filestore/config from the same capture. Preserve image/revision pins and ownership. P0's restore scripts show the tested source restore contract; update source config to the isolated DNS name before starting its web service.
3. Restore registry SQLite plus its matching WAL from the same frozen set into a fresh API volume. `verify-registry-restore.py` demonstrates an offline integrity check with no network/live mounts. Clear staff sessions and recipient grants; mark active/draft library shares `revoking` **before enabling ingress**. Mark temporary records revoked, clear their discarded source IDs/upload UUIDs and finalization intent, then initialize a fresh temporary engine. Preserve the master key and user mappings.
4. Reinitialize disposable Gokapi with a new private engine API key. Never revive its old temporary links without the corresponding payloads. Reconcile native DAM shares, retaining permanent originals. Retest ownership, wrong passwords, expiry and cached-link revocation.
5. Restore Caddy data/config only on an isolated listener initially. Verify original hashes, login/MFA, search, collections, preview/download and cleanup, then choose an explicit cutover. Preserve the failed system until recovery is accepted.

## Rollback and emergency stop

For an access incident, stop `aia-media-gateway` immediately; this closes both LAN product entry points. For a component regression, retain data volumes and select the previous known-good images/release after checking schema compatibility (current additive registry schema 3). Do not roll the API back to a version without durable finalization recovery while any file is processing. Frontends can roll independently. Do not restore a stale DB over new work. The immutable receiver refuses replacing the master key and existing release paths.

To remove the new product, stop its containers, then revert the new plugin/config from the encrypted preservation set or `.private/resourcespace-before-plugin.php` after reviewing later legitimate configuration changes. Do not delete originals. Restoring native LAN port 8088 reopens a separate authentication surface and requires a deliberate operator decision. Local launch/stop rehearsal and recovery proof do not replace a human incident walkthrough.

## Maintenance

Daily: check health, backup completion, disk headroom and cleanup queue. Weekly: copy encrypted backups independently and inspect errors. Monthly: restore a sample, audit users/roles and dependencies, review native advisories and test upgrades against retained fixtures. Quarterly/before major events: full restore and representative load/WAN tests. Patch by exact version/digest with a new release; retain rollback evidence. Docker logs rotate at 3 × 10 MB per configured service. NAS updates may replace host schedules: verify them after upgrades. No external email/alert destination is configured.
