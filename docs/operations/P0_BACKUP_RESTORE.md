# P0 preservation and recovery runbook

Updated 8 November 2026. **Executed successfully**, following owner maintenance approval and delegated engineering choices. See [results](../discovery/P0_RECOVERY_RESULTS.md), [evidence](../discovery/evidence/p0-recovery-2026-11-08.json) and [cleanup](../discovery/evidence/p0-cleanup-2026-11-08.json).

## Recovery set

Recovery ID: p0-20261108T102833765Z.

- NAS: /volume1/docker/aia-media-backups/<id>/, root mode 0700.
- Workstation: C:/Users/Luke/AIA-Media/.local/recovery/<id>/.
- Key reference: C:/Users/Luke/AIA-Media/.local/recovery-keys/<id>/key-reference.json.
- Encrypted data/config/deployment: recovery.tar.cms, SHA-256 550c30a5baaf636cc3b797d6169c8f36658adbfc1909619a5fc1330eab840ece.
- Encrypted portable source: source.tar.gz.cms, SHA-256 ea4f148368e8229119d4d7f1dbb53137d8b68b5a83cc805833d904c7726d566c.
- Exact encrypted images, NAS only: images.tar.cms, SHA-256 a42228b0fde57e931e3269fe75dc7399d08127461aacf3bd8866b1968d3bcdcd.

DB/files/config and portable source were independently checksum/decryption verified. The exact image export was not completely copied off NAS. Partial workstation exports were removed after checksum mismatch; do not claim exact off-NAS image recovery.

## Encryption custody

Standard CMS AES-256-GCM/RSA-3072 was selected under the owner's delegation. The key is DPAPI CurrentUser protected in private-key.dpapi; recipient.pem is public. Direct terminal unprotection would expose key material: use the private child-process helper in recovery-key.mjs. NAS/workstation passwords and API keys are not backup encryption keys.

Preserve the protected key **and this Windows user's usable DPAPI profile**. No independent enterprise key escrow/recovery account has been established. Do not delete or regenerate the recipient while keeping archives encrypted to it. Resolve escrow, retention, RPO/RTO and a stable recovery owner before production.

## Executed capture and restore

1. Validate exact image/mount identities, InnoDB tables, event scheduling, available space and original unpaused state.
2. Export immutable runtime images before application freeze.
3. Pause only ResourceSpace; dump DB and capture matching filestore/config/checksums within a 120-second maximum budget. Actual freeze was 3 seconds. The trap/watchdog is a recovery aid, not protection against every host failure.
4. Resume immediately, encrypt, hash and copy the data bundle to the private workstation; authenticated decryption passed.
5. Reupload the independently verified data through private SSH stdin. Restore exact cached images into fresh clone volumes, fresh DB credentials and an internal network.
6. Verify 133 file hashes, password login, search/collections, original and thumbnail downloads, unsigned denial.
7. Exercise owned native shares in the clone only, then revoke them.
8. Remove temporary SQL/tar/config copies and stop clone services. Keep encrypted backups, safe manifests, clone configuration and retained restore volumes.

The reusable scripts are under scripts/discovery/. backup-resourcespace.sh requires --execute-approved-maintenance and a new recovery ID/public recipient. restore-nas.sh requires --approved-isolated-restore and refuses any existing target name/volume/network. These are **not commands to rerun against the retained clone**. Restore archive membership is allowlisted before extraction.

recover-on-nas.mjs now authenticates/decrypts the encrypted bundle directly into a bounded private memory buffer, rather than trusting a leftover plaintext tar. This helper's decryption matched the recorded archive hash; the updated helper was not used for a second full restore. copy-recovery-source.mjs is specific to this captured revision/hash.

## Retained clone and continuation

Clone containers: aia-media-p0-restore-db and aia-media-p0-restore-web. Network: aia-media-p0-restore-isolated. Volumes: aia-media-p0-restore-database and aia-media-p0-restore-filestore. They are stopped and retained.

For further approved isolated tests, start the clone DB first, wait for authenticated DB readiness privately, then start its web container. Inspect actual network/port/mount state again. Connect through private SSH to the internal container IP; no host listener is published. The configured origin 127.0.0.1:18088 is an HTTP/cookie identity used by the verifier, **not a live NAS port**. Never attach this clone to public ingress.

The original resourcespace and resourcespace-db were verified running/unpaused after cleanup. No original volume/config restoration or deletion took place. If a future capture fails, first inspect whether that job left resourcespace paused; unpause only the affected original container, preserving failure evidence. Never restore a rehearsal over production.

## Outstanding production operations

Recurring encrypted backup scheduling, offsite image export, key escrow, recovery ownership, business RPO/RTO, lower-role denial, representative formats and disaster recovery from complete NAS loss remain unaccepted. Future temporary-transfer/registry recovery must reconcile expiry/revocation before enabling any public ingress.
