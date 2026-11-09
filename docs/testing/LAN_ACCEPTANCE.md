# LAN implementation acceptance

8 November 2026. Functional owner-authorized LAN installation, using [ADR 001](../decisions/ADR-001-OWNER-DELEGATED-LAN-IMPLEMENTATION.md). This report distinguishes API/native evidence from unperformed browser/human acceptance. Internet production GO and stakeholder UAT are not declared.

Media: https://192.168.250.80:8443 · Transfer: https://192.168.250.80:8444. Private first-login credentials/CA instructions are in workstation `.local/deployment/OWNER_ACCESS.txt`. The owner login was verified and requires authenticator enrollment. Local Git and pinned GitHub Actions workflow are prepared; no remote CI execution or commit is claimed.

## Executed checks

- Workspace type checks and **17 security tests passed**. Both Next standalone builds passed inside pinned NAS images. Formatting, exact known-secret scan and 12 discovery-tool/documentation checks passed. Production npm audit: **zero reported vulnerabilities across 192 dependencies**. This is not a full OS/container vulnerability certification.
- [HTTPS/CSP proof](../discovery/evidence/nas-https.json): both interfaces and API return 200 with CA validation enabled, matching script nonces and frame protection. Native ResourceSpace binds loopback; Gokapi/DB expose no host ports. Original filestore root is now UID/GID 33:33, mode 0750; native application access was verified.
- [NAS smoke](evidence/nas-smoke.json): MFA/session rotation, roles, original delivery, encrypted multi-file Unicode/duplicate-name delivery, shared quota, revoke, offboarding and excluded-engine routes.
- [Media workflow](evidence/nas-media-proof.json): generated JPEG/PNG/TIFF/MP4 uploads, Pending state, metadata, approval, exact original hashes, image previews, MP4 byte range 206, bulk free-keyword edits, marketing Pending upload/approval denial, native offboarding and rejected disabled native API identity. Fixtures were archived and staff disabled.
- [Metadata search](evidence/nas-metadata-search.json): native year/event/ championship search, using actual existing vocabulary values for controlled fields. [Two-original share](evidence/nas-library-batch.json): one landing, both originals match authorized downloads, then revoke/410.
- [Large transfer](evidence/nas-large-transfer.json): **10,737,418,240 bytes**, confirmed client resume at 50,331,648 bytes, native encrypted finalization, exact full download SHA-256 and cached-link denial after revoke. Upload 444.209 s, native finalization 188.076 s, download 55.678 s. Synthetic repeated-block NAS traffic; not a WAN, concurrency or library-scale benchmark.
- [First large attempt](evidence/nas-large-first-attempt.json) exposed the original 180-second completion deadline. The corrected implementation uses a one-hour bounded native request, durable intent and exact unique-name/size recovery after lost response/restart. The late synthetic native object from the failed trial was removed through Gokapi's API. Unpublished transfers were never exposed.
- [Preservation](evidence/original-preservation-final.json): all permanent originals and previews match the pre-change baseline. Fifteen changed and one expired original manifest paths are temporary query-cache files; 117 baseline paths are unchanged.
- [P0 full DAM restore](../discovery/P0_RECOVERY_RESULTS.md), [registry restore](evidence/registry-restore.json), [monitoring](evidence/nas-monitoring.json) and [backend isolation](evidence/backend-isolation.json) retain exact collection dates/scope. Recovery artifacts are encrypted and independent copy/decryption is verified separately from a NAS capture.

## Master-plan acceptance cases

| Case | Actual result / boundary |
|---|---|
| AT-001 | Authenticated approved browsing and marketing Pending denial passed through API; visual presentation remains UAT |
| AT-002 | Native year/event/championship search passed; full-scale pagination performance not established |
| AT-003 | Photo previews and video range playback passed; browser codec/layout acceptance remains open |
| AT-004 | Native bulk free-keyword round trip and reviewer-only authorization passed; partial native failures are reported |
| AT-005 | Reviewer approval persisted; marketing upload remains Pending and marketing cannot approve |
| AT-006 | Native access checks and role denials tested; restricted/unapproved sharing negatives are in F1 plugin evidence |
| AT-007/008 | Single and two-original native sharing passed without uploading DAM bytes to Gokapi |
| AT-009/010/011 | Source password/date-expiry/revocation proved in native isolated tests; gateway lifecycle/denial and original preservation tested separately |
| AT-012/013/014/016 | NAS temporary single/group upload, password, encrypted delivery, quotas and source revocation passed |
| AT-015 | [NAS accelerated-deadline proof](evidence/nas-expiry.json) passed: immediate gateway denial, native temporary object deletion and native DAM share revocation; original retained |
| AT-017 | Both sources in registry history; owner isolation and administrator management tests passed |
| AT-018/019 | Controlled backend-stop results are recorded in backend-isolation evidence; only true fields are passed |
| AT-020/021 | Opaque identifiers, membership/ownership/password/expiry/replay denials and live source reauthorization tested |
| AT-022 | Confirmed-offset client interruption/resume and exact 10 GiB hash passed; a real browser network-drop walkthrough remains open |
| AT-023 | Capacity rejection/cleanup policy implemented; NAS deliberately-full disk and alert-delivery drill not performed |
| AT-024 | Data/sessions survived multiple API/image replacements; restart/health evidence retained |
| AT-025 | Full baseline DAM restore plus independent schema 3 registry integrity/quarantine restore passed; [final encrypted capture](evidence/final-backup.json) independently verified; end-to-end current-stack disaster cutover and business RTO remain open |
| AT-026 | App sessions and owned links blocked; managed native account disabled and its API key denied |
| AT-027 | Branded recipient HTML/API with no staff login implemented; responsive/keyboard/screen-reader human verification remains open |
| AT-028 | Duplicate Unicode names and exact bytes passed |
| AT-029 | Native source URL revocation proof and gateway cached-path denials passed; engine routes remain internal |
| AT-030 | No V1 file-request/import UI; engine/setup/file-request paths denied at ingress |

Final release: **lan-20261108-e45cafcc**, source archive SHA-256 **e45cafcc035f1ba66e78ccda4e340712983b21f5c8437bf64a080f17a328326d**. [Closing deployment evidence](evidence/final-deployment.json) verifies running image IDs, matching current release pointer, schema 3, one active owner account, zero enabled installation QA accounts, zero active transfers, zero pending cleanup/finalizations and zero native temporary objects. Local preview and PoC are stopped; NAS product services remain running.

No blanket completion of the original plan's human, public-network, disaster-cutover or scale gates is implied. Computer Use stopped because it could not confidently determine the browser URL for access-policy enforcement. No further app/browser inputs or automation bypass were used; no screenshots, visual pass or marketing signoff are claimed.

## Operations and handover

Daily encrypted capture at 03:30 NAS host time, five-minute health/disk/backup-age monitoring, local syslog warnings and rotated logs are installed; host cron is active. Temporary payloads are excluded from recurring backups. Restore clears sessions/grants and quarantines links. Recovery depends on the original Windows DPAPI profile; independent key escrow, business RPO/RTO, offsite retention and an external alert/on-call destination remain to be adopted.

[Staff guide](../operations/STAFF_GUIDE.md) · [IT runbook](../operations/IT_RUNBOOK.md) · [Known limitations](../KNOWN_LIMITATIONS.md) · [Support matrix](../SUPPORT_MATRIX.md). Final release pins and closing verification are recorded in dated deployment evidence, without secrets.
