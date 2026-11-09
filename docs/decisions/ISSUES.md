# Issues and plan clarifications

| ID | Finding | Effect / linked risk | Required resolution | Status |
|---|---|---|---|---|
| I-001 | Corrected SSH credential succeeds; NAS/sudo read-only inventory and recovery preflight completed | Transport/authentication blocker resolved; recovery gate remains | Continue approved recovery preparation | RESOLVED for access |
| I-002 | Independent encrypted preservation and isolated restore now passed | Core P0 exit satisfied | Retain evidence; finish production escrow/RPO/RTO | RESOLVED for P0 core |
| I-003 | Owner reports no licensed Media Vault source | F3/P7 blocked; R-03/R-04 | Approved purchase/source and invoice/license scope | OPEN |
| I-004 | Native share password/expiry/revoke passed for clone preview; automatic creation and complete paths unproven | F1 still open | Supported plugin/manual route, ownership, originals/cache/restriction tests | PARTIAL |
| I-005 | Standard 20-file Gokapi trial returned 20 separate links | F2-A not established | Decide and test F2-B archive or F2-C secure landing | OPEN |
| I-006 | NAS Btrfs/RAID1 inventoried; public proxy/IdP undefined | F4/F5 blocked | Approved hostnames/ingress and corporate identity configuration | PARTIAL |
| I-007 | Plan refers to sections 18/19 for decisions/change control, but ends at section 14 | Change-control references are broken | Use OPEN_DECISIONS + this issue log pending owner-approved plan correction | OPEN; master plan unchanged |
| I-008 | Workspace is not a Git repository | No commit/PR/CI can be claimed | Private repository setup in P2 after P1 | DEFERRED to P2 |
| I-009 | DEV has v/u/c/edit permissions despite a=false | R-07: privileged identity cannot prove viewer restrictions | Approved least-privilege mapping/test identities; do not elevate DEV to bypass 403 | OPEN |
| I-010 | Browser automation access host unavailable | Native UI/API Test Tool/screenshots unverified | Restore browser integration or operator UI evidence | OPEN |
| I-011 | r29907 accepted signed userkey revoke despite native-only upstream wording | Version-specific contract discrepancy | Pin tested behavior; least-privilege and upgrade regression tests | PARTIAL |
| I-012 | No Docker healthchecks; compose lacks explicit limits/log rotation; app binds 8088 on all interfaces | Operational/ingress readiness incomplete | P3/P11 review after backup; do not alter running stack during discovery | OPEN |
| I-013 | Daily ResourceSpace cron only copies hitcounts; complete maintenance/preview schedule not proven | R-14 and cleanup/worker readiness | Verify supported maintenance jobs and schedule after preservation | OPEN |
| I-014 | Tested independent data/source recovery exists; exact images remain NAS-only | Complete NAS-loss image recovery unproven | Finish off-NAS image export and key escrow before production | PARTIAL |

Change-control rule pending clarification: record requested scope change, reason, affected requirements/gates, risk/rollback and owner approval before implementing it. No architecture or V1 scope change has been made.
