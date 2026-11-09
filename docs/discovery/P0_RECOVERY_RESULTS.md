# P0 recovery results - 8 November 2026

> This is the earlier P0 capture/restore report. Later implementation added health checks, restricted filestore root permissions, isolated native HTTP, daily encrypted backups and schema 3 recovery. See [current status](../../STATUS.md) and [LAN acceptance](../testing/LAN_ACCEPTANCE.md); remaining findings below describe the time of P0 collection.

**Core P0 exit passed:** an auditable inventory and tested ResourceSpace restore exist. The owner explicitly approved maintenance and delegated recovery-key, independent-copy and isolated-target choices. These are executed results, superseding the earlier proposal.

## Capture and independent recovery

Recovery ID: p0-20261108T102833765Z. Capture point: 2026-11-08T10:31:25.643116+00:00. NAS root: /volume1/docker/aia-media-backups/p0-20261108T102833765Z/, root-owned mode 0700 with private file creation. Exact images, paths and DB engines were checked before capture.

Only ResourceSpace was paused, for **3 seconds**, within the approved 120-second ceiling. MariaDB stayed running. A single-transaction logical dump and filestore/config copies shared the application-write boundary. All 66 tables were InnoDB; DB event scheduling was off. No outside writer was observed; this does not establish a general multi-writer snapshot service.

Standard OpenSSL CMS authenticated encryption uses AES-256-GCM and an RSA-3072 recipient. The private key is protected by Windows DPAPI CurrentUser and restricted ACLs. This implements the delegated choice; the earlier GPG-only proposal was not executed. Public certificate SHA-256: 3bfa7bf7c8f831d3ab0b701528fa3a04177f46c6df3791c14c030aad7bf9e5db.

| Artifact | Encrypted bytes | Independent workstation copy |
|---|---:|---|
| DB, filestore, configuration and deployment bundle | 3,547,066 | Checksum and authenticated decryption passed |
| Portable ResourceSpace source r29907, excluding filestore/runtime config/SVN metadata | 54,430,850 | Checksum and authenticated decryption passed |
| Exact application and MariaDB runtime images | 2,844,899,342 | **Not complete**; preserved encrypted on NAS |

The full image transfer was interrupted because the private link was slow. Partial workstation image files are invalid recovery archives. The complete portable source independently preserves code; an exact off-NAS image restore is **not proven**. The tested clone used exact cached NAS images.

Workstation encrypted copies: .local/recovery/<recovery-id>/. Recipient reference and protected key: .local/recovery-keys/<recovery-id>/. Successful decryption on the independent workstation was demonstrated. These are private recovery artifacts, not repository deliverables.

## Isolated restore and application proof

The verified workstation archive was decrypted, uploaded through private SSH stdin, hash-checked and restored into fresh aia-media-p0-restore-database and aia-media-p0-restore-filestore volumes. No production volume was mounted. New clone DB credentials and base URL were set in its own configuration.

The aia-media-p0-restore-isolated network is internal. Runtime inspection confirms **no published web/database host ports**. An initial report's loopbackOnlyPort=18088 described the requested mapping, not an active listener: Docker suppressed publication on the internal network. Tests connected from the NAS host to the internal container IP through SSH, preserving the configured HTTP origin for cookies. The reusable runner now explicitly publishes no port and checks runtime state.

| Check | Result |
|---|---|
| Filestore checksums | 133 files matched |
| Password login/protected search | Passed; unauthenticated search denied |
| Signed API / unsigned API | Signed status/search passed; unsigned denied 401 |
| Collection browsing | Passed |
| Original download | 5,509 bytes; backed-up checksum matches |
| Thumbnail | JPEG, 8,553 bytes; backed-up checksum matches |
| Native collection password | Wrong denied; correct accepted |
| Source share revocation | Signed userkey POST returned true; cached native preview denied |
| Native share expiry | Past date set through native authenticated UI; cached preview denied with existing recipient session |
| Original app/database after trials | Running, unpaused, original mounts unchanged |

Share proofs used a two-asset collection in the clone and an actual source-generated **preview** URL. They do not establish every original/download/ZIP/cache path. Expiry is a calendar date rounded by the source to end of day. A revoked URL may return HTTP 200 with a denial page; returned bytes/checksums established denial.

Application recovery passed at 10:52:29 UTC. Elapsed work includes troubleshooting and is not an accepted/measured RTO. No production restoration was attempted.

## Remaining limits

- Representative JPG/TIFF/RAW/MP4 uploads and preview timings, least-privileged identity denial, API Test Tool screenshots and representative working-period load remain open.
- Stable business recovery ownership, RPO/RTO, independent key escrow and recurring/offsite retention are not established. DPAPI currently depends on this Windows user's profile; losing it can lose decryption access.
- The original filestore permissions, existing LAN HTTP binding, absent Docker healthchecks and incomplete maintenance schedule remain unchanged findings.
- No browser screenshots or marketing UAT were produced. Native form trials were HTTP integration tests.

See [sanitized evidence](evidence/p0-recovery-2026-11-08.json) and [recovery runbook](../operations/P0_BACKUP_RESTORE.md). This core exit permits isolated feasibility work, not production exposure or completion of every later checklist.
