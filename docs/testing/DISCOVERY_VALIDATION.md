# Discovery and recovery validation

> Historical discovery results below are superseded by [LAN acceptance](LAN_ACCEPTANCE.md) and [current status](../../STATUS.md). The owner approved the original UI/LAN/local-identity revision; P1 no longer blocks application implementation. The earlier master-plan hash describes the historical document before that approved revision.

## Executed recovery and feasibility validation - 8 November 2026

- node scripts/discovery/validate.mjs: **12 local checks passed**. Includes both ResourceSpace security fixture tests, shell syntax/execution-mode refusal for backup/restore, large-trial refusal before credentials/upload, and prior read-only/Compose checks.
- Three Python probes parsed successfully with NAS Python 3 ast.parse, without imports/network requests or bytecode writes. The workstation python alias is unavailable; no local Python success is claimed.
- Direct in-memory authenticated CMS decryption matched the recorded plaintext archive SHA-256. Updated upload helper was not used for a second full restore.
- Actual recovery, login/download/share proofs are in [P0 runtime evidence](../discovery/evidence/p0-recovery-2026-11-08.json). Actual native Gokapi single/20-file/10 GiB resume/hash/lifecycle proofs are in [Gokapi runtime evidence](../discovery/evidence/gokapi-runtime-2026-11-08.json). These are distinct from local fixture checks.
- Cleanup stopped clone/PoC containers, retained isolated volumes/encrypted sets, removed temporary recovery plaintext and invalid partial image copies; original NAS services running/unpaused. [NAS cleanup evidence](../discovery/evidence/p0-cleanup-2026-11-08.json). Twenty tiny synthetic Gokapi objects were deleted through its supported API; the large object was deleted by the proof runner. Physical secure erase/expiry cleanup timing was not established.
- Exact supplied-credential scan of 46 project files outside .local/.git/node_modules found zero matches. Private recovery artifacts are intentionally excluded and access-controlled. This is not a claim about historical chat or server logs.
- Master-plan SHA-256 unchanged: A5FE2DC21EA2727BA8D3745ABEEB66616F5F3BAB5C2095E4F07AAE00EC06B18B.

P0 core exit passed; P1 remains NO-GO. Browser screenshots, production deployment, low-privilege identities, full-source-share path coverage, public ingress and full-system acceptance remain unproven. Earlier dated results below are historical.

# Discovery validation — 7 November 2026

The initial pass below is historical. See the live follow-up section at the end for restored connectivity, authenticated API results and the expanded validation suite.

Scope: local discovery tooling and public vendor documentation/schema only. These checks cannot prove installed ResourceSpace/Gokapi behavior, a NAS backup or restore, production safety, UI quality or any AT-001–AT-030 acceptance case.

| Command / observation | Result | Evidence |
|---|---|---|
| Workspace listing, `rg --files`, `git status --short` | Initially only master plan; no Git repository | Local inspection, 7 Nov |
| Ancestor/workspace AGENTS.md checks | None found | Explicit expected paths checked |
| `node --version`, `git --version` | v22.17.0; 2.50.1.windows.1 | Local CLI output |
| `docker context show`, Docker/Compose versions | desktop-linux; client/server 29.8.2; Compose v5.5.1 | Workstation only |
| Initial bounded NAS TCP check | Timeout after four seconds | No authenticated session established |
| `node scripts/discovery/probe.mjs 192.168.250.80 8088` | Exit 1; timeout, 4002 ms | 2026-11-07T17:41:11.830Z |
| `node scripts/discovery/inspect-gokapi.mjs v2.2.4` | Exit 0; release/commit/schema inspected | 2026-11-07T17:41:22.138Z; public provenance report |
| `node scripts/discovery/validate.mjs` | Exit 0; 8 checks passed | Recorded 2026-11-07 17:44:38 UTC; details below |

An initial schema-inspector assertion looked for the login restriction in the ZIP operation's description. The pinned schema puts the explicit wording in the `presignUrl` parameter description. The assertion was corrected to inspect that parameter and then passed; no upstream behavior was changed or inferred from that correction.

The validator uses an all-zero **synthetic** image digest only to parse the draft. It never pulls/starts an image. A parse pass does not establish that an image exists, works on the NAS, supports health checks or satisfies any security gate. Missing-image validation is a required failure.

NAS collector execution, actual native password/expiry/revoke tests, backup consistency and restore rehearsal: **NOT RUN**. No UI tests/screenshots or production release tests were possible.

## Final local validation result

Eight checks passed: JavaScript syntax; local Markdown links; private raw schema checksum versus recorded provenance; explicit unproven-runtime gate flags; invalid-input rejection; live versus closed loopback TCP listener; collector shell syntax/identifier guard/sensitive-field exclusions; and positive/negative Compose configuration parsing.

Collector sensitive-field checking is a static check, not a security certification or a NAS execution test. The original master plan was left unchanged; its recorded SHA-256 is `A5FE2DC21EA2727BA8D3745ABEEB66616F5F3BAB5C2095E4F07AAE00EC06B18B`.

## Live follow-up

- TCP at 18:02:04.068 UTC: connected, 41 ms.
- Signed native POST: ResourceSpace 11.0/r29907, status OK; one-row search/pagination and visible field definitions work. Metadata administration denied with 403. Unsigned status denied with 401. No asset/share/configuration mutations executed.
- Reproducible live pass at 18:05:15.346 UTC: 17 allowlisted reads; sanitized report in `docs/discovery/evidence/resourcespace-2026-11-07.json`.
- `node --test scripts/discovery/inspect-resourcespace.test.mjs`: two fixture tests passed, covering destination/URL restrictions, signing/encoding, read-only POST requests, search bounds and report minimization. These fixtures do not prove source sharing, lower-role authorization or recovery.
- Browser host unavailable; UI sign-in/API Test Tool/screenshots remain unverified. Supplied account password not used.

The application identity has confidential-visibility and user-management permissions. Success with this account cannot prove marketing-viewer access restrictions. Host Docker inventory, backup/restore and F1 lifecycle remain NOT RUN.

Final follow-up validation, recorded at 2026-11-07 18:09:22 UTC: **9 local checks passed**, including the two ResourceSpace security fixtures. An exact in-memory scan of all 26 workspace files, including ignored local evidence, found no occurrence of the supplied API key. The password was never used or written. Authenticated runtime bindings were then cleared. This does not change the gate status or attest to server-side access-log configuration.

## Authenticated NAS inspection, 8 November

Corrected SSH authentication and authorized sudo access succeeded. Read-only host/Docker/storage/version/schema/source inspection is recorded in [NAS inventory](../discovery/P0_NAS_INVENTORY_2026-11-08.md). Passwords were supplied only to SSH/sudo prompts and were not saved to project files. Existing injected DB credentials were consumed inside the DB container without printing values. The initial alternate environment-variable lookup failed to authenticate without a password; the verified MYSQL-named variables then worked.

- `nas-recovery-preflight.sh --read-only`, streamed over SSH without a remote script file: **passed**. It reconfirmed mounts/images, 66 InnoDB tables, event scheduler OFF, disk space and required tools.
- Installed source confirms default signed API authmode is `userkey`; `native` is browser-session mode. The discovery tool's output label and prior report terminology were corrected. This is not an auth behavior change or share-mutation test.
- `node scripts/discovery/validate.mjs`: **10 checks passed**, including the two security fixtures and new recovery-preflight syntax/mandatory-mode/mutation-exclusion checks. This suite checks local artifacts; the separate live preflight is the NAS evidence.
- Master-plan SHA-256 remains `A5FE2DC21EA2727BA8D3745ABEEB66616F5F3BAB5C2095E4F07AAE00EC06B18B`.
- Before closing SSH, both app and DB were confirmed `running`, `paused=false`. Both SSH sessions were closed cleanly.

No dump, archive, image export, container pause/restart/stop, backup directory, snapshot, restore clone, source data/configuration edit or firewall change was executed. Backup/restore acceptance remains unproven pending the [owner-reviewed change](../operations/P0_BACKUP_APPROVAL.md).
