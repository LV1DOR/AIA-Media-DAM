# Decisions and remaining adoption work

Updated 8 November 2026. The owner approved NAS maintenance, authorized template replacement and delegated missing engineering choices. These authorizations persist; do not request them again. [ADR 001](ADR-001-OWNER-DELEGATED-LAN-IMPLEMENTATION.md) records the resulting LAN milestone.

| Decision | Selected implementation |
|---|---|
| UI/template | Original Next.js interfaces; no purchased source |
| Entry points | NAS IP HTTPS 8443 Media / 8444 Transfer, private Caddy CA, LAN/VPN |
| Identity | Local staff, opaque sessions, required admin TOTP, per-user native DAM accounts |
| Native sharing | F1-B narrow native-function plugin; no backend-private business DB writes |
| Temporary groups | F2-C landing link, independent files, no ZIP or DAM duplication |
| Lifetime/limits | 7-day default, 30-day max; 20 GiB/file; 100 files/group; two in-flight chunks per user |
| Protection | Optional recipient password, shared download-start quota, source passwords kept internal; server-managed Gokapi storage encryption |
| Workflow | Native Pending -1, Approved 0, Returned 1, Archived 2; no destructive permanent-media delete workflow |
| Metadata | Native title/filename, year/event, added championship/rights/review notes, existing tags/types/uploader/date |
| Audit | 180-day application audit retention; separate native log policies |
| Backup | Daily encrypted permanent-media/config/registry capture; exclude disposable temporary payloads; quarantine restored links |
| Monitoring | Five-minute local health/disk/backup-age checks and syslog warnings; no external recipient configured |

Remaining adoption decisions do not block building or installing the LAN product: approve human pilot/UAT, assign stable IT/recovery/on-call ownership, adopt business RPO/RTO and offsite retention/key escrow, choose an external alert channel. Corporate federation and public Internet delivery are later infrastructure work requiring real domain/tenant/network information. No domain purchase, public DNS change or external message was made.

Engineering defaults are implemented under the owner's delegation, not represented as a legal/privacy assessment or stakeholder UAT signoff. No commercial template license is missing from the revised scope. Original ResourceSpace assets were preserved; current status and limitations are [here](../../STATUS.md).
