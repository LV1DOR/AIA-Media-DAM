# Staging-only deployment proposal — P0 draft

**Not deployed, not approved, not production-ready.** P0/P1 exit gates must pass before starting services. This satisfies TASK 00's request for a draft, not P3 acceptance.

## Isolation and sequencing

1. Inventory the actual NAS and validate an independently readable, consistent backup.
2. Restore ResourceSpace into an isolated environment with new DB/filestore/config storage. Do not attach production volumes, credentials or external notification jobs. Reconcile existing shares and restrict egress before exposing the clone.
3. Select approved Gokapi release/digest and filesystem after F2/D-06 review. The reviewed schema belongs to v2.2.4; no image digest/CPU compatibility has been verified.
4. Use a new staging Compose project, new Gokapi data/config volumes and a private bridge. Its lifecycle remains independent of the ResourceSpace DB/clone. Select registry storage only after checking local filesystem locking/WAL and backup semantics.
5. Complete Gokapi setup through loopback/approved tunnel. Enable staff authentication; verify per-user File Request rights are absent. `GOKAPI_GUEST_UPLOAD_BY_DEFAULT=false` only changes the default and is **not** proof that every account/route is disabled.
6. Validate single/multiple files, passwords, expiry, revoke, cleanup and source-direct paths before introducing a registry resolver.

The adjacent [staging.compose.yaml](staging.compose.yaml) is deliberately limited to Gokapi. ResourceSpace, DB, registry, media frontend, IdP and public proxy are not runnable placeholders: their inputs/gates are missing. The draft uses loopback port 53842, separate volumes, UTC and bounded logs. It does not attach any production networks or existing volumes. It requires a caller-supplied immutable image reference; do not use `latest`.

## Proxy proposal

Reuse the existing approved proxy after discovery; do not select Caddy/Nginx speculatively. Initially bind only loopback; no public DNS/TLS/ACME/firewall change is included. Later, define explicit staff and public route allowlists against the installed route set. Keep staff upload/admin/API and NAS/DB unreachable to guests. Guest downloads must preserve source password, expiry and revoke enforcement.

The full installed route inventory is necessary before writing the proxy allowlist: OpenAPI does not enumerate all browser routes. File Requests include browser routes as well as `/api/uploadrequest/*`; blocking only that API prefix is insufficient. Retain Gokapi authentication; do not use authentication-disabled mode as a shortcut. Trust only the actual proxy, omit token-bearing URI/query logging and define upload timeouts/chunk sizes from measured trials.

ResourceSpace originals must never be mounted into Gokapi. A source-backed share stores protected references, not copied bytes. A future registry should have its own recovery boundary and no dependency on ResourceSpace DB availability for temporary transfers.

## Before approval

Record NAS architecture/capacity, actual proxy, version/digest, UID/storage behavior, resource/upload limits, source auth/roles, disabled guest-upload tests, health command available inside the image, backup target and rollback. No invented `/health` endpoint or blanket read-only root filesystem has been added to the draft.

Rollback after any future staging trial: stop the specific staging project through the approved operator; retain its volumes until evidence is reviewed. Never use global Docker cleanup or volume-removing commands. There is nothing to roll back on the NAS from the current discovery pass.
