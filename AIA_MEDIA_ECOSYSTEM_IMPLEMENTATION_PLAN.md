# AIA Media Ecosystem — Complete Implementation & Delivery Plan

> **Owner-approved implementation revision, 8 November 2026:** paid Media Vault source may be replaced by an original Next.js/TypeScript interface. No public domain or corporate IdP is currently available. Deliver a LAN HTTPS installation with local staff identities first; public DNS/Internet delivery and corporate federation are optional later milestones. Use F1-B's supported narrow plugin and F2-C's secure landing-page approach. The owner delegated the technical defaults and NAS deployment. See [ADR 001](docs/decisions/ADR-001-OWNER-DELEGATED-LAN-IMPLEMENTATION.md), which supersedes conflicting template/domain/IdP prerequisites for this milestone; source security/recovery tests still apply. Historical checklists below remain unchecked until individually evidenced.

> **Document type:** Master engineering plan / agent execution specification<br>
> **Status:** LAN implementation deployed under ADR 001; current phase results and dated evidence are in [STATUS.md](STATUS.md). Historical checkboxes below are not blanket completion claims.<br>
> **Prepared:** 7 November 2026<br>
> **Target:** Autódromo Internacional do Algarve (AIA) — Marketing & Media Department<br>
> **Primary goal:** A fast, visually excellent, self-hosted media library and independent branded file-transfer service that feel like one AIA ecosystem, while reusing existing software and minimizing custom code.

---

## 0. Read this first — instructions for every implementation agent

This is the **source-of-truth implementation plan**, not a claim that the system has already been built. Agents must work in numbered phases and preserve the intended product behavior. Do **not** interpret illustrative file paths, domain names, test thresholds or configurations as existing deployed settings.

**Non-negotiable product contract:**

1. **AIA Media** is a permanent visual digital asset management (DAM) application for photographs and video; ResourceSpace remains its system of record.
2. **AIA Transfer** is independently accessible. Staff can send temporary files **without putting them in the DAM**. Gokapi is the initial temporary-transfer engine.
3. Selecting one or multiple approved assets in AIA Media and clicking **Share** creates a **transfer-style sharing experience** visible from the Transfer ecosystem, **without duplicating the original DAM files into Gokapi**.
4. AIA Media and AIA Transfer have **separate deployable frontends/services** but consistent branding, UX patterns and (where feasible) sign-in.
5. The same NAS hosts the components initially; **separate containers do not equal hardware high availability**.
6. **External photographer upload requests and import-from-Transfer-into-DAM are explicitly out of scope for V1.** Do not build a “Request files” feature, external unauthenticated upload links, inbound review workflow from Transfer, or a Transfer-to-Library import button unless scope changes formally.
7. The public recipient experience is **download-only** for V1. Uploading to AIA Transfer requires an authorized staff account.
8. Prefer **configuration, supported APIs, existing UI components and narrow adapters** over rewriting software. Do not fork ResourceSpace or Gokapi merely for styling.
9. **No direct database writes to ResourceSpace or Gokapi private schema.** Their own databases belong exclusively to those applications. Add a supported extension only after a documented feasibility decision.
10. Implement real permissions, data protection, expiry/revocation, backups, recovery and monitoring **before production release**.
11. Local Docker-to-Docker calls may be fast but not zero milliseconds. Optimize end-to-end user experience with caching, previews, fewer network round trips and instrumentation; **never promise 0 ms**.
12. **Do not invent API capabilities or endpoints.** Re-check the actual installed versions and official docs, inspect SDK/OpenAPI schemas, and run proof-of-concept tests before wiring critical actions.

### How to execute this plan

- Complete **Phase 0** first and log actual NAS/app versions, configuration, volumes and connectivity.
- Complete one phase at a time; all checkboxes begin unchecked and are only checked after evidence is supplied.
- Every implementation PR must cite its phase/task IDs, provide tests, screenshots when UI changes, a rollback note and an updated decision/issue log.
- At each **GO/NO-GO gate**, stop if an acceptance condition fails. Record the issue and proposed alternatives rather than silently substituting an architecture.
- New requirements go through **change control** (§19). Do not expand the V1 scope under the guise of a convenient adjacent feature.
- All secrets, certificates, keys, email addresses and real public domains must come from approved secure configuration. **Never commit them.**

### Decision confidence key

- **Confirmed requirement:** The requested outcome and product behavior from the owner.
- **Vendor-documented capability:** Present in the referenced upstream documentation but still requires verification in our installed version.
- **Engineering design:** The recommended architecture, not proof of implementation.
- **Open feasibility gate:** Must be tested before a corresponding feature can be committed to.

---

## 1. Executive summary

### 1.1 Selected direction

Build **two products that behave like one ecosystem**:

| Product | User-facing purpose | Frontend | System of record | Independent access |
|---|---|---|---|---|
| **AIA Media** | Permanent, searchable photography/video library; approvals; metadata; collections | Square UI **Media Vault** customized in Next.js/TypeScript | Existing **ResourceSpace** | Yes — staff only |
| **AIA Transfer** | Branded send/download experience for temporary files; active links, expiry, passwords, transfer history | **Stage 1:** lightly branded upstream Gokapi; **Stage 2:** dedicated Next.js interface only where it materially improves UX | **Gokapi** for temporary files, a small **Transfer Registry** for unified records | Yes — staff uploads, public recipients download |
| **DAM asset transfer** | Share selected permanent assets using the Transfer ecosystem | Share dialog in Media Vault; public Transfer landing or branded ResourceSpace share | **ResourceSpace native external share**, referenced by Transfer Registry | Recipient access without DAM staff login |

**Development philosophy:** keep mature software behind the scenes, write only UI integration, an API boundary, a small transfer registry and any strictly necessary share adapter. **TypeScript first**; introduce a Go connector only on measurement or an identified streaming/concurrency need. **Do not choose Rust simply to reduce microseconds**.

### 1.2 Deliverables at completion

- Secure working `media.<approved-AIA-domain>` staff application.
- Secure working `transfer.<approved-AIA-domain>` staff upload application and public download pages.
- AIA-branded experience for both products and external recipients.
- DAM search, library browse, previews, tagging, collections, upload/review/approval and secure downloads.
- DAM **Share** on single or multiple approved assets: expiry, optional password, link creation, revoke and history.
- Transfer **Send** for temporary files: upload, expiry, optional password, link creation, revoke, automatic deletion and history.
- A visible unified transfer list for staff with origin/source and status.
- Single file and multi-file transfer behavior explicitly verified against the installed versions.
- Secure authentication and role-based authorization, with external recipient access scoped to a specific link.
- Docker deployment, isolated persistent volumes, TLS/proxy, backup, restore, health/metrics, operational alerts and rollback procedures.
- Automated tests, performance measurements, UAT signoff, operational docs and production handover.

### 1.3 Explicit exclusions from V1

- **No external upload requests / “Request files”.**
- **No external photographer/agency intake to DAM through Transfer**, no import flow from temporary transfers into ResourceSpace.
- No documents office suite, document editor, task manager, chat, AI tagging, facial recognition, geo metadata, public media browsing, mobile-native application or payments.
- No new DAM backend; do not replace ResourceSpace without a documented failed feasibility gate.
- No self-written resumable-upload engine, file cipher, object storage system or general-purpose DAM metadata database.
- No destructive deduplication across the separate applications’ private storage.
- No claim of perfect fault tolerance while everything lives on one NAS.

---

## 2. Requirements and acceptance semantics

### 2.1 Primary personas

| Persona | Required capabilities | Should **not** be able to |
|---|---|---|
| **Marketing user** | Browse/search/download approved media; create collections within permissions; share permitted DAM assets; create and manage own temporary transfers | Administer infrastructure, view restricted assets or manage others’ private links arbitrarily |
| **Media reviewer/editor** | Upload media, set metadata, bulk tag, review/approve, manage approved collections | Change platform configuration or bypass audit rules |
| **DAM administrator** | Manage ResourceSpace configuration, access policies and media workflows | Access unrelated infrastructure secrets by default |
| **Transfer administrator** | Configure transfer policies, user privileges, moderation/abuse response, remove transfers | Modify ResourceSpace internals by default |
| **External recipient** | Open one permitted transfer link; authenticate with link password if set; download allowed files | Sign into staff apps, list transfers, enumerate media or upload in V1 |
| **IT operator** | Deploy, back up, restore, monitor, investigate issues | Access production media unnecessarily; access must be logged and least-privileged |

### 2.2 User journeys / MUST work

**J1 — Library browsing**

1. Marketing user opens AIA Media and authenticates.
2. The page opens with thumbnails or skeletons, a usable layout and filtering.
3. User searches by asset name, year, event, championship, tag and other configured fields.
4. User previews photos/videos and downloads an authorized original or derivative.

**J2 — DAM-to-Transfer sharing**

1. User selects one or many **authorized, approved** media assets in Media Vault.
2. User clicks **Share** and sees the Transfer-branded share form, embedded/modal or navigated with contextual state.
3. User chooses title, optional message, expiry and optional password; all values are validated.
4. The system creates a **ResourceSpace-backed share** (not an upload to Gokapi) and a registry entry.
5. User receives one shareable AIA Transfer link **if the feasibility gate for a single link is passed**.
6. Recipient opens a public link, passes the enforced password if configured, views/downloads permitted files.
7. AIA staff can find, view status and revoke the share from Transfer history (and optionally from AIA Media).
8. Revocation blocks **all** access paths, including the ResourceSpace-origin URL, not just the pretty wrapper.
9. Expiry disables access; the DAM originals **remain untouched**.

**J3 — Temporary transfer**

1. User opens AIA Transfer directly, authenticates, drags/drops files.
2. User selects expiry, optional password, a transfer title/message and permitted download count if implemented.
3. Files upload through Gokapi, with understandable progress, retry/error handling and safe limits.
4. User receives the approved sharing link(s), manages the transfer and sees it in the common history.
5. Recipient downloads without a staff login.
6. Expired/revoked files are deleted according to Gokapi’s lifecycle; audit metadata is retained according to policy.
7. **No file or record is created in ResourceSpace.**

**J4 — Failure isolation**

- If ResourceSpace is unavailable, already-created temporary Gokapi transfers and new temporary uploads still work **provided the independent Transfer frontend, transfer registry, Gokapi, NAS and networking remain healthy**.
- If Gokapi is unavailable, AIA Media can still browse, review and manage permanent assets; ResourceSpace sharing should remain usable when its share path is independent.
- Public URLs must fail securely and clearly; never leak file details or internal URLs during partial outages.

### 2.3 Quality attributes

- **Reliability:** correct expiry, proper revocation and no accidental deletion of DAM originals.
- **Security:** HTTPS, secure session/cookies, access checks at source, token secrecy, defense in depth and auditability.
- **Speed:** smooth gallery interaction, fast cached metadata, high-performance preview serving, no double-upload of DAM assets.
- **Maintainability:** upgradeable upstream apps, minimal forks, typed API boundaries, reproducible deployment and safe rollback.
- **Cost:** existing UGREEN NAS + existing ResourceSpace + open-source Gokapi + one-time licensed Media Vault UI; no obligatory SaaS file-transfer service.
- **Privacy:** minimized logs, retention rules, access control, deletion semantics and company-approved GDPR procedures.
- **Accessibility:** keyboard and screen-reader usable UI; sensible touch/mobile handling for recipient pages.

---

## 3. Existing environment: known facts vs things to verify

### 3.1 Known project background (not freshly audited)

- UGREEN **NASync DXP4800 Plus** hosts Docker on the AIA network.
- Previous private NAS endpoint: `192.168.250.80` with ResourceSpace on port `8088`. Verify current IP/port; this address is **not** intended as an internet-facing URL.
- MariaDB and ResourceSpace containers were installed and persistence volumes named `mariadb_data` and `filestore` were used previously. Actual running state and volume names require inspection.
- The ResourceSpace service is now reported as installed and running by the project owner.
- Media Vault is the preferred UI; **purchase/source acquisition has not been verified**.
- Domain ownership, DNS administrator, reverse proxy, chosen SSO, proxy firewall rules and internet uplink speed are **unknown**.

### 3.2 Verify and record before changing anything

Create `docs/discovery/ENVIRONMENT_BASELINE.md` with:

- NAS model, firmware, CPU architecture, memory, disk volume type, RAID layout, free/used space and Btrfs snapshot policy.
- Docker Engine / Compose versions; existing containers, image tags and digests, ports, internal networks, health checks and auto-start policy.
- ResourceSpace exact version, PHP configuration, `/api/` availability, configured user groups/permissions and extensions.
- MariaDB exact version, database ownership, backups, hostnames, connection security.
- Physical locations and permissions of `filestore`, ResourceSpace previews, MariaDB files and application config.
- Current network: VLAN, firewall, route to NAS, internal DNS, public DNS ownership, possible public ingress approach, TLS certificate management, internet upload/download bandwidth and ISP constraints.
- Existing NAS backup destination, offsite backup, RPO/RTO expectations and recovery-test history.
- Available AIA identity service (Microsoft Entra ID / other IdP), MFA policy, users/groups, licensed features.
- Any current ResourceSpace library assets, sample tags, metadata fields, pending review state and existing external shares.
- Operational resource baseline: CPU/RAM utilization, disk IOPS, image preview time, throughput, simultaneous user expectations.
- Approval of temporary files’ maximum size, expiry policy, maximum concurrent uploads and allowed MIME/file types.

**Mandatory safety action:** snapshot/backup ResourceSpace and its database before modifying containers, plugins, permissions or network exposure. Do not disrupt existing running applications.

---

## 4. Architectural design

### 4.1 Logical components

```text
                           EMPLOYEES
                               |
                     Corporate SSO / MFA
                               |
              +----------------+-----------------+
              |                                  |
      media.<AIA-domain>                 transfer.<AIA-domain>
      Next.js Media Vault                Independent Transfer UI
      (staff-only)                       (staff-only upload/manage)
              |                                  |
       ResourceSpace API                    Transfer Registry
       adapter (server)                  (own durable database)
              |                                  |
        ResourceSpace  <--- share refs --->  Unified Transfer API
        metadata/access                    / orchestration layer
              |                                  |
        DAM originals                        Gokapi API
        DAM previews                         Gokapi files
              |                                  |
              +----------- UGREEN NAS -----------+
                          isolated volumes

          PUBLIC LINK: transfer.<AIA-domain>/t/<opaque-token>
                      -> authorize/resolve
                      -> ResourceSpace native share OR Gokapi share
                      -> deliver without public staff login
```

> `media.<AIA-domain>` and `transfer.<AIA-domain>` are **placeholder hostnames**. DNS names, network paths, and the exact public download architecture must be approved before implementation.

### 4.2 Deployment boundaries

1. `media-web`: Next.js application; Media Vault is its UI base. Deploy independently.
2. `transfer-web` **(Stage 2)**: Next.js app or equivalent small branded frontend; deploy independently. In Stage 1, Gokapi’s own UI is acceptable to launch quickly.
3. `transfer-registry`: small SQLite or other **separate, independently backed-up data store** owned by the transfer service. Default recommendation: SQLite with WAL on **reliable local filesystem**, single active writer, volume backup and migration discipline. If NAS constraints or scale demand it, use a separate MariaDB database; **do not couple Transfer uptime to ResourceSpace’s database more than necessary**.
4. `resourcespace`: existing application and its database; no other service writes its private tables.
5. `gokapi`: dedicated service and dedicated config/data volumes; API access is server-side only.
6. `reverse-proxy`: Caddy or Nginx (choose the one already operational at AIA); TLS, routing, upload limits and security headers.
7. `monitoring/backup`: existing AIA observability and backups where available; do not add multiple monitoring stacks without a reason.

### 4.3 Storage separation

```text
<approved-nas-app-root>/
  resourcespace/
    database/              # existing; never overwrite casually
    filestore/             # permanent originals and derivatives
    config/
  gokapi/
    data/                  # temporary transfer payloads
    config/                # encryption/config/DB material
  transfer-registry/
    data/                  # shared transfer records, not file payloads
  media-web/
    runtime-cache/         # disposable only
  backups/                 # preferably on separate target, NOT sole backup
```

- No shared writable originals directory between ResourceSpace and Gokapi.
- Never use symlink/hardlink tricks to give Gokapi direct ownership of ResourceSpace originals without a security and lifecycle design review.
- DAM share expiry means **access expires**, not media deletion.
- Gokapi expiry means the **temporary payload may be deleted**; test exact cleanup behavior.
- Protect source encryption secrets/config; without them, encrypted Gokapi files may be unrecoverable.
- Define disk quotas and warning thresholds for originals, previews, temporary files and logs independently.

### 4.4 End-to-end access model

- Staff interfaces authenticate using AIA-approved identity system where supported. Prefer the corporate IdP with MFA over writing new password management.
- Gokapi has vendor-documented OIDC support; test group mapping and logout behavior.
- ResourceSpace supports SAML SSO via its Simple SAML plugin; test deployment compatibility. **Matching corporate login ≠ automatic authorization in ResourceSpace.**
- Next.js must perform its **own server-side session and authorization checks**; do not assume a hidden button is sufficient.
- ResourceSpace API calls must be signed server-side with least-privileged keys; never expose signing keys in browser bundles.
- Gokapi API keys are server-only, permission-scoped and rotated on schedule.
- Public transfer pages accept scoped, unguessable tokens, but tokens alone should not bypass optional source-level passwords or expiry.
- ResourceSpace’s underlying share must be disabled or deleted on revoke, not merely removed from our list.
- Restrict admin consoles (`/admin`, API key management, setup, internal dashboards) to authorized staff and trusted network paths.

### 4.5 System-of-record rules

| Data | Owner | Read/write pattern |
|---|---|---|
| Permanent media bytes, derivatives, metadata, review/approval state | ResourceSpace | Via supported API/ResourceSpace admin functions |
| Temporary transfer payloads, expiry/download limit | Gokapi | Via supported Gokapi interfaces/API |
| Unified transfer ID, source type, owner, title, target handle, audit events | Transfer Registry | Via transfer backend only |
| Transfer public password / expiry | Source system **must** enforce; registry mirrors status and may apply additional checks | Never rely exclusively on frontend checks |
| Identity and groups | Corporate identity provider + application role mappings | Provision/minimize privileges; no copy of passwords |
| Gallery UI preferences | Browser/client as appropriate | No sensitive access decisions |

### 4.6 API/adapter boundaries — illustrative, **not** promises about upstream APIs

Create internal typed interfaces such as:

```ts
interface MediaAdapter {
  searchAssets(query: AssetQuery, user: AuthzContext): Promise<Page<Asset>>;
  getAsset(id: string, user: AuthzContext): Promise<Asset>;
  getPreview(id: string, size: PreviewSize, user: AuthzContext): Promise<PreviewRef>;
  updateMetadata(id: string, data: MetadataPatch, user: AuthzContext): Promise<void>;
  createCollection(ids: string[], user: AuthzContext): Promise<CollectionRef>;
  createNativeShare(ids: string[], options: ShareOptions, user: AuthzContext): Promise<NativeShareRef>;
  revokeNativeShare(ref: NativeShareRef, user: AuthzContext): Promise<void>;
}

interface TemporaryTransferAdapter {
  createTransferUpload(options: TransferOptions, user: AuthzContext): Promise<UploadSession>;
  getTemporaryShare(ref: string, user: AuthzContext): Promise<TemporaryShare>;
  revokeTemporaryShare(ref: string, user: AuthzContext): Promise<void>;
}
```

**Rule:** method names above represent our adapter contract. Each one needs documented mapping to the installed upstream API, including authorization and failure semantics. If an upstream function is absent, mark the adapter operation `UNSUPPORTED` and use the approved fallback or implement a reviewed ResourceSpace plugin. Do not invent an endpoint.

### 4.7 Registry model — illustrative migration v1

```text
transfers
  id                   UUID / ULID, stable internal ID
  public_token_hash    hashed opaque public token (never raw in logs)
  owner_subject        corporate identity subject
  source_type          'resourcespace' | 'gokapi'
  source_ref           encrypted or otherwise protected native share reference
  title                sanitized display title
  note                 optional sanitized sender note
  created_at           UTC
  expires_at           UTC
  revoked_at           nullable UTC
  last_checked_at      nullable UTC
  last_known_status    active | expired | revoked | missing | degraded
  options_json         allowlisted non-secret non-authoritative preferences
  version              integer, for optimistic concurrency

transfer_items
  id                   UUID / ULID
  transfer_id          FK
  source_item_ref      protected ResourceSpace asset ID / Gokapi file ID
  display_name         sanitized, length-limited
  size_bytes           nullable, integer
  display_order        integer

transfer_events
  id                   UUID / ULID
  transfer_id          FK
  actor_subject        nullable/system
  action               created | opened | download_attempt | revoked | expired | failed
  event_at             UTC
  safe_metadata_json   no passwords, signing keys, native access secrets, or sensitive filenames in broad telemetry

idempotency_keys
  key_hash             unique
  owner_subject
  result_transfer_id
  expires_at
```

Implementation rules:

- Add unique indexes for public token hash and idempotency key, plus owner/time/status lookup indexes.
- Choose explicit deletion retention of registry metadata; Gokapi payload deletion does not automatically delete historical audit records.
- Store **no plaintext passwords** or user API secrets in the registry. Protect native share handles as secrets if they grant direct access.
- Treat source system as authoritative: a transfer must not show **Active** if the source share is already expired/revoked/missing.
- Use transactional creation with compensation on failure; orphaned native shares are cleaned safely by reconciliation.
- Never store permanent asset bytes in the registry.

---

## 5. The critical feasibility gates (must be proven early)

These risks can change the amount of code required. Resolve them with isolated test data **before** committing to the final UI implementation.

### Gate F1 — ResourceSpace can create and revoke shares programmatically

**Why:** ResourceSpace’s public API documents searching, collections and `delete_access_keys`, but the published public API list does **not clearly document a corresponding external-share creation method**. Its native UI can generate such shares. Treat automatic creation as an **open engineering question**.

**Test sequence:**

- [ ] Record ResourceSpace version and inspect API Test Tool and installed source/plugin extension points.
- [ ] Create one approved test asset, then a test collection of multiple approved assets.
- [ ] Generate an external collection share **manually** in the native UI: password, expiry, allowed downloads, restricted metadata.
- [ ] Confirm access, password, expiry and native revoke all work externally.
- [ ] Find a **supported** way to create equivalent shares server-side: public API or officially supported ResourceSpace plugin invoking existing internal functions.
- [ ] Confirm least-privileged authorization, owner attribution and share deletion from code.
- [ ] Document exact function names, parameters, upstream version and error responses.

**Outcome decision:**

- **F1-A (preferred):** supported API path exists → use typed server adapter.
- **F1-B:** no public API but supported plugin/hook exists → build **minimal internal ResourceSpace extension**, security review, regression tests and version-pinned integration.
- **F1-C (interim):** neither can be implemented safely → Media UI opens the native ResourceSpace share flow and user pastes/generated link into Transfer Registry; label the action honestly as **manual-assisted**. Do not claim one-click completion.
- **F1-D (NO-GO):** permissions/expiry/revocation cannot be reliably enforced → do not expose library share publicly until resolved.

### Gate F2 — Gokapi meets the desired multi-file “one transfer” behavior

**Why:** Official usage describes **one download link per uploaded file** in its standard upload workflow. That is not automatically equivalent to WeTransfer’s **one branded URL containing a batch of files**. Do not mistake Gokapi’s *File Requests* (inbound uploads) for outbound grouping.

**Test sequence:**

- [ ] Install pinned test version and upload **one file**; verify link, password, expiry, download and deletion.
- [ ] Upload **20 mixed files**; record whether native UI/API returns one share or links for each file.
- [ ] Test folders / zip workflows, name preservation, total sizes, CPU cost and temporary storage overhead.
- [ ] Test one **large** 10–20 GB file and a many-file group at expected concurrency.
- [ ] Inspect whether Gokapi exposes grouped share/bundle features in the installed version; document proof rather than extrapolate.

**Outcome decision:**

- **F2-A:** native one-link multi-file sharing exists → use it.
- **F2-B (low-code fallback):** package a multi-file batch into **one archive** and upload as one Gokapi object; verify acceptable CPU, disk, RAM and usability. This may require temporary archive space and may be unsuitable for huge jobs.
- **F2-C (product-grade option):** Transfer Registry creates **one AIA landing link** listing independent Gokapi objects; implement secure authorization and a tested download policy per object. Underlying links and passwords must not bypass intended group restrictions; this is **additional development**.
- **F2-D (NO-GO):** no secure/performant low-code solution meets the approved multi-file UX → reassess temporary-transfer engine rather than silently shipping a degraded workflow.

### Gate F3 — Media Vault source and licensing

- [ ] Obtain the **actual paid source bundle** and invoice/licensed account through approved AIA purchase process.
- [ ] Verify the license permits AIA employee development, deployment, distribution restrictions and use by multiple developers/agents under the relevant terms.
- [ ] Verify Next.js, TypeScript, Tailwind, shadcn and React versions, package lock, security advisories, build reproducibility.
- [ ] Inspect selected asset list, bulk-selection, detail panel, share action, gallery views, filter controls and uploads.
- [ ] Confirm that mock data can be replaced by typed API hooks; record which share/create actions are decorative placeholders.
- [ ] Preserve allowed attribution/license notices and avoid redistributing vendor template source in public repos.

### Gate F4 — Public delivery and infrastructure

- [ ] Confirm AIA's right to publish the chosen domain/subdomains.
- [ ] Confirm public ingress is approved by AIA IT/network security, including firewall, DNS, TLS, rate limiting and privacy impact.
- [ ] Measure uplink and simultaneous download performance to real offsite clients.
- [ ] Prove that a public transfer link cannot access the NAS admin console or any internal LAN endpoint.
- [ ] Verify any Cloudflare/proxy constraints on upload chunk size, body size and upload timeouts for the chosen path.
- [ ] Prove local failures cannot leak internal IPs, API keys, native access tokens or stack traces to guests.

### Gate F5 — Shared sign-in without accidental elevated access

- [ ] Determine actual IdP and MFA requirements; configure staff SSO for Gokapi and AIA Media.
- [ ] Confirm ResourceSpace mapping to per-user permission scope rather than a universal administrator API token.
- [ ] Validate staff onboarding/offboarding, logout, session expiry, role changes, external recipient non-authentication.
- [ ] If true ResourceSpace per-user delegation is not possible, define and approve a narrower server-side access model with explicit permission checks, audit and limited service account rights.

**If any feasibility gate changes the selected engine/approach, update the decision records (§18) and this plan first.**

---
## 6. Phase-by-phase implementation roadmap

### Overview and ordering

| Phase | Name | Depends on | Primary deliverable |
|---|---|---|---|
| **0** | Discovery, backup and existing-system audit | None | Verified baseline and safe restore point |
| **1** | Requirements, design and feasibility proofs | 0 | Approved choices for F1–F5 and UX contract |
| **2** | Repository, engineering standards and CI | 1 | Reproducible development foundation |
| **3** | NAS layout, network, security and ingress | 0–2 | Secure staging infrastructure |
| **4** | Standalone Gokapi Transfer MVP | 1–3 | Working send-only branded file transfer |
| **5** | ResourceSpace DAM configuration and workflows | 0–3 | Working permanent media backend |
| **6** | ResourceSpace typed adapter and media APIs | 5 | Secure media API with permission tests |
| **7** | Square UI Media Vault adaptation | 6, F3 | Functional, high-quality AIA Media |
| **8** | Unified Transfer Registry and share workflows | 4, 6, F1/F2 | DAM shares + temporary transfers in one history |
| **9** | Dedicated polished AIA Transfer interface | 4, 8 | Independent branded UX, if needed |
| **10** | UX, performance and upload resilience | 7–9 | Tested responsiveness at realistic sizes |
| **11** | Security, privacy and abuse hardening | 4–10 | Threat-model findings closed |
| **12** | Observability, backups, recovery and runbooks | 3–11 | Operable and recoverable system |
| **13** | Integrated tests, UAT and preproduction audit | 7–12 | Formal signed acceptance evidence |
| **14** | Production launch and controlled migration | 13 | Released, monitored production environment |
| **15** | Handover, maintenance and continuous improvement | 14 | Sustainable ownership and update process |

**Execution principle:** although the table is sequential, independent work (UI exploration, documentation, network research) may happen in parallel **after** the interfaces and security gates have been agreed. Never let parallel work race on the production database or firewall.

---

## Phase 0 — Discovery, inventory and preservation

**Purpose:** establish precisely what exists and make the installed DAM recoverable before touching it.<br>
**Owner:** infrastructure agent / AIA IT, with a human approval for backup/destructive operations.<br>
**Outputs:** `ENVIRONMENT_BASELINE.md`, `INVENTORY.md`, backup manifests, a test restore report, risks and integration capability matrix.

#### P0.1 — Access, permissions and change window

- [ ] Confirm authorized access methods to UGREEN NAS, Docker, ResourceSpace admin and switch/firewall management.
- [ ] Obtain a non-production/staging plan; never experiment with live media data where avoidable.
- [ ] Identify existing application owners and backup operator; confirm who may approve public internet access.
- [ ] Record a maintenance/change window for configuration changes.
- [ ] Create a private project issue tracker and location for sanitized technical notes.

#### P0.2 — Inventory commands and evidence

Run read-only commands appropriate for the NAS environment (examples; paths/containers must be discovered, not assumed):

```sh
docker version
docker compose version
docker ps -a --no-trunc
docker image ls
docker network ls
docker volume ls
df -h
free -h
```

- [ ] Inspect **only relevant** Compose configuration, secret references and volume mounts (redact credentials in saved output).
- [ ] Identify ResourceSpace container names, port mappings, restart policy and cron/preview-worker processes.
- [ ] Record app versions, Docker image digests, NAS OS version and available memory.
- [ ] Measure disk free space and baseline NAS load over a representative working period.
- [ ] Record existing ResourceSpace metadata fields, resource types, collections, user groups and asset states.

#### P0.3 — Backups and restore rehearsal

- [ ] Create consistent backup of ResourceSpace database **and** its original media/preview files and config; ensure database/file consistency.
- [ ] Record checksum manifest, size, timestamp and storage location.
- [ ] Verify backup can be read from a different machine/target.
- [ ] Restore a small non-production clone and verify login, assets, thumbnails, collection browsing and sample download.
- [ ] Keep original production volumes untouched during all staging tests.
- [ ] Establish rollback snapshot and explicit rollback owner.

#### P0.4 — Baseline functionality

- [ ] Log in to ResourceSpace with a test user.
- [ ] Upload a JPG, TIFF/RAW (if relevant), MP4 and an approved test file type.
- [ ] Measure preview creation and resource search.
- [ ] Test native share for a single asset and collection; record expiry/password/revocation behavior.
- [ ] Exercise ResourceSpace `/api/` via its API Test Tool with minimal privileges.
- [ ] Capture sanitized screenshots of actual current user experience.

**Exit gate P0:** an auditable environment inventory and **tested** ResourceSpace restore exist. No internet-facing changes were made.

---

## Phase 1 — Product definition, feasibility and technical decisions

**Purpose:** turn preferences into testable contracts and resolve unknown third-party behavior.<br>
**Outputs:** `PRODUCT_SPEC.md`, `USER_FLOWS.md`, `API_CAPABILITY_MATRIX.md`, `FEASIBILITY_RESULTS.md`, architecture decision records.

#### P1.1 — Confirm product behaviors

- [ ] Approve **AIA Media** as a photography/video DAM (not a general office-document workspace).
- [ ] Approve **AIA Transfer** as a separately accessible branded file sending service.
- [ ] Approve DAM **Share** as an action that creates a transfer-registry record referencing native ResourceSpace shares **without duplicate file upload**.
- [ ] Approve transfers consisting entirely of temporary uploads that never enter the DAM.
- [ ] Approve direct public downloads via scoped links and optional passwords; no external recipient staff login.
- [ ] Explicitly mark external upload requests / external submissions / Transfer-to-DAM import as **not in V1**.
- [ ] Define whether a **single public link for multiple temporary files** is mandatory at launch, and whether archive delivery is acceptable; run F2 proof accordingly.
- [ ] Agree transfer metadata: title, note, expiry, password, allowed download count, creator and source labels.
- [ ] Agree optional **send-by-email**: copy link is mandatory; automated email dispatch is optional and only integrated after AIA approves sender domain, deliverability and security.

#### P1.2 — Agree DAM metadata and workflow

- [ ] Set initial fields: title/filename, year, event, championship, media type, source/uploader, status, tags, rights/licensing notes and created/upload date.
- [ ] Decide which fields are mandatory at upload vs optional, and whether uploaders may bulk apply metadata.
- [ ] Define ResourceSpace state mapping for `Pending`, `Approved`, `Rejected/Returned`, `Archived` consistent with its version and permissions.
- [ ] Confirm ResourceSpace approval behavior rather than inventing parallel approval state in Next.js.
- [ ] Determine visibility: only approved assets appear to general marketing users; reviewers can see pending items.
- [ ] Define what happens if an approved asset used in a live share later becomes restricted/unapproved/deleted: **access must be re-evaluated and the existing share blocked** where policy requires.
- [ ] Record delete/restore and legal retention policy; default to soft workflows where ResourceSpace supports them.

#### P1.3 — Decide technology/ownership

- [ ] **Frontend:** Next.js + TypeScript + the licensed Media Vault source, Tailwind and shadcn components.
- [ ] **Initial connector language:** TypeScript on the server, sharing types and validation with the frontend.
- [ ] **Go:** optional small service only if measured API gateway throughput or high-concurrency streaming becomes a bottleneck.
- [ ] **Rust:** not selected; unnecessary complexity for API orchestration.
- [ ] **DAM backend:** existing ResourceSpace with MariaDB and its own file store.
- [ ] **Temporary backend:** Gokapi with separate persistent storage.
- [ ] **Transfer Registry:** standalone durable store, chosen explicitly after checking NAS filesystem and deployment semantics.
- [ ] **Reverse proxy:** reuse AIA's existing approved solution where viable.
- [ ] **Auth:** prefer AIA corporate IdP, document exact protocol and group mapping.
- [ ] Do not deploy Redis, queues, object storage or a new database server merely because those are common in other stacks.

#### P1.4 — Execute feasibility gates

- [ ] Complete **F1 ResourceSpace automatic share creation/revoke**, or choose the documented interim fallback.
- [ ] Complete **F2 Gokapi group / multi-file behavior** and performance.
- [ ] Complete **F3 Media Vault template source/license**.
- [ ] Complete **F4 public connectivity** and identify proxy limitations.
- [ ] Complete **F5 authentication and authorization** design.
- [ ] Record alternative options, accepted compromises and explicit human approval for any unimplemented capability.

#### P1.5 — UX specification

- [ ] Produce desktop and mobile wireframes for DAM home/gallery, detail panel, bulk select, share modal, upload/review screen and Transfer history.
- [ ] Produce standalone Transfer login, upload, active-transfer list, share settings and anonymous recipient page.
- [ ] Define design tokens: AIA brand colors, typography, radius, spacing, icon style, motion timings, loading and error states.
- [ ] Establish consistent terminology: **Library**, **Upload**, **Share**, **Transfers**, **Review**, **Expiry**, **Revoke**.
- [ ] Design a clear source label in history: `From Library` vs `Temporary Upload` (do not expose backend names to marketing staff).
- [ ] Accessibility review: keyboard selection, focus, dialogs, contrast, touch targets, captions/status messages.

**Exit gate P1:** requirements and all F1–F5 outcomes recorded; no critical “assumed to work” APIs remain in the chosen delivery path. A phased UI commitment is approved.

---

## Phase 2 — Repository, local development, quality gates and CI

**Purpose:** give multiple agents a predictable, low-conflict environment.<br>
**Outputs:** private Git repository, reproducible builds, staging fixture data, tests, CI, conventions and initial docs.

#### P2.1 — Establish repository layout

Recommended initial monorepo (adjust to the licensed template structure, not the other way around):

```text
aia-media-ecosystem/
  README.md
  AGENTS.md
  docs/
    architecture/
    api/
    decisions/
    deployment/
    operations/
    security/
    testing/
    discovery/
  apps/
    media-web/           # Media Vault Next.js UI
    transfer-web/        # Optional Stage 2 stand-alone Next.js UI
  packages/
    ui/                  # licensed/shared design tokens, access restricted
    contracts/           # request/response types, validation schemas
    adapters/            # ResourceSpace & Gokapi client abstractions
    auth/                # session and authorization patterns
  services/
    transfer-api/        # Independent registry/API if justified
    resourcespace-plugin/# only if F1-B approved
  infra/
    compose/
    proxy/
    monitoring/
    backup/
  scripts/
    dev/
    test/
    backup/
  tests/
    fixtures/
    e2e/
    contracts/
    load/
  .github/workflows/    # if GitHub is used
```

- [ ] Create private repository; never publish purchased template source or credentials.
- [ ] Add `AGENTS.md` with source-of-truth rules, no unsupported APIs and task/phase mapping.
- [ ] Add project README with development setup, service matrix and safe local commands.
- [ ] Choose one package manager (e.g. pnpm) and lockfile; pin Node LTS compatible with Media Vault.
- [ ] Select one formatting/linting standard and one TypeScript strict configuration.
- [ ] Add `.env.example` with placeholders only; `.gitignore` all secrets, persistent DBs, runtime files and imported real media.

#### P2.2 — Local environment

- [ ] Create sanitized demo assets and non-identifying sample metadata; never use confidential production photos in public tests.
- [ ] Make `docker compose -f ...` launch disposable ResourceSpace test backend, Gokapi test backend and fake IdP where practical.
- [ ] Provide separate `.env.development`, staging and production templates managed outside Git.
- [ ] Create one-command local start, seed, teardown and cleanup scripts.
- [ ] Confirm platform builds on the development machine and target NAS architecture.

#### P2.3 — CI/CD foundation

- [ ] Create PR workflow: install dependencies → lint → format check → typecheck → unit tests → build.
- [ ] Add dependency/SCA, secret scanning and container image scanning.
- [ ] Add SBOM generation or an equivalent dependency inventory for major releases.
- [ ] Produce versioned immutable artifacts/container images; pin upstream image digests in deployment manifest.
- [ ] Separate deployment credentials for staging and production; restrict CI permission and require approval for production jobs.
- [ ] Enforce no deployment on failing tests/secret scans without a documented waiver.
- [ ] Add PR template: purpose, scope, risks, screenshots, test evidence and rollback.

#### P2.4 — Agent collaboration conventions

- [ ] Each agent gets a scoped ticket and owns distinct modules/files to minimize merge conflict.
- [ ] The coordinating agent handles integration and keeps `STATUS.md` and `DECISIONS.md` current.
- [ ] Every adapter has contract tests using upstream version fixtures.
- [ ] Do not allow competing agents to edit secrets, firewall rules or production Compose concurrently.
- [ ] Any custom Gokapi/ResourceSpace fork requires senior review and an upstream maintenance plan.

**Exit gate P2:** clean checkout builds locally; CI green; no real keys or data in repository; agent rules committed.

---

## Phase 3 — NAS infrastructure, network and secured staging

**Purpose:** isolate applications, establish safe HTTPS paths and validate large-file behavior before putting data on the public internet.<br>
**Outputs:** staging hostnames, Docker Compose stack, hardened proxy, storage permissions, monitoring hooks, approved firewall configuration.

#### P3.1 — NAS storage and service identities

- [ ] Create dedicated application directories/volumes owned by appropriate non-root UIDs/GIDs.
- [ ] Verify ResourceSpace existing volumes; **do not rename, move or remount production media without a tested migration**.
- [ ] Create separate Gokapi config/data volumes and Transfer Registry volume.
- [ ] Reserve free-space headroom for temporary uploads, archives, thumbnails, backup snapshots and upgrades.
- [ ] Set sensible file/directory permissions; verify applications can access **only their own** writable storage.
- [ ] Use read-only containers/filesystems where feasible without breaking upgrades, thumbnail generation or upload handling.
- [ ] Document Btrfs snapshot/backup behavior and restore compatibility for SQLite/WAL and Gokapi config.

#### P3.2 — Docker/networking

- [ ] Create internal application networks; restrict MariaDB, ResourceSpace API admin endpoints and Gokapi admin/API to internal authorized paths.
- [ ] Do not publish backend container ports on all NAS interfaces unless specifically approved.
- [ ] Use service DNS names (e.g. `resourcespace`, `gokapi`) within Docker rather than routing local API calls through public DNS or Cloudflare.
- [ ] Configure `restart: unless-stopped` or approved restart policy, healthchecks, log rotation and resource limits.
- [ ] Use fixed image versions/digests; upgrade in staging first.
- [ ] Verify service-to-service DNS, routing and latency with measurements, not assumptions.

#### P3.3 — Domains, TLS and proxy

- [ ] Approve real staff/media and transfer subdomains with AIA DNS/IT.
- [ ] Configure HTTPS certificates and automatic renewals; check chain and expiry alerts.
- [ ] Apply correct `X-Forwarded-*` handling only from trusted proxies; no open redirect based on untrusted Host headers.
- [ ] Protect internal admin/API routes from anonymous requests.
- [ ] For public links, only expose explicitly needed download paths; do not open the whole NAS UI.
- [ ] Enable appropriate security headers, strict transport policy after testing, safe caching, CORS restrictions and request-id logging.
- [ ] Configure maximum body size, streaming/proxy buffering and read/write timeouts for the validated transfer size/concurrency.
- [ ] If using Cloudflare or an edge proxy, validate current file/chunk limits; do not assume large uploads can be proxied unchanged.
- [ ] Test from outside the AIA LAN using a normal external connection and a recipient browser.

#### P3.4 — Initial network security

- [ ] Firewall rule: public ingress only to approved proxy ports; no direct Gokapi/ResourceSpace admin or database ports.
- [ ] Prevent backend workloads from requesting arbitrary internal resources based on user-submitted URLs; disallow SSRF paths.
- [ ] Set brute-force/rate limits on login, password prompts, link resolution and public downloads appropriate for large media transfers.
- [ ] Add basic anomaly alerts for high failed-login rates, repeated invalid share tokens, excessive transfers and low disk space.
- [ ] Agree whether staff management UI is intranet/VPN-only vs publicly reachable behind SSO/MFA.

#### P3.5 — Staging smoke tests

- [ ] Verify both test app hostnames and proxy health.
- [ ] Verify container isolation and secret injection.
- [ ] Restart NAS/docker services in staging and confirm expected auto recovery.
- [ ] Test uploading/downloading through full proxy path, including interruptions.
- [ ] Verify internal IPs/ports are not exposed through HTTP errors, redirects or metadata.

**Exit gate P3:** staging is accessible where approved, strongly isolated, TLS-correct and capable of representative large uploads. Production remains unchanged.

---

## Phase 4 — Deliver standalone AIA Transfer MVP first

**Purpose:** get a useful WeTransfer replacement running with minimal custom code, independently of the DAM frontend.<br>
**Outputs:** Gokapi standalone deployment, branded basic UI, staff accounts, temporary sending, lifecycle and operations.

#### P4.1 — Install and configure Gokapi

- [ ] Pin a tested stable Gokapi release and record version/digest.
- [ ] Deploy with **persistent `/app/data` and `/app/config`** mounts, not ephemeral container storage.
- [ ] Run initial setup through a controlled admin path; use a strong break-glass admin credential stored securely.
- [ ] Configure correct external/public URL so generated links use approved AIA Transfer domain.
- [ ] Set timezone/UTC storage, trusted proxies and link/redirect behavior.
- [ ] Choose local NAS storage initially; do not introduce S3/MinIO just to follow a standard template.
- [ ] Configure user roles and least privilege; remove unnecessary public upload/File Request permissions.
- [ ] Disable or hide **File Requests** for V1 in the safest supported manner; don't rely only on navigation hiding if the endpoint is available to unauthorized users.
- [ ] Configure upload quotas, expiry defaults and max expiry, limits on downloads, file sizes, chunk sizes, parallelism and allowed types consistent with AIA policy.
- [ ] Verify any desired encryption mode against browser compatibility, CPU cost, key recovery and security review; **password-protected link is not the same as encrypted storage**.

#### P4.2 — Sign-in and staff authorization

- [ ] Configure corporate OIDC, or temporary approved accounts if F5 requires staged rollout.
- [ ] Map marketing staff vs administrators; enforce MFA via the IdP where approved.
- [ ] Verify new staff, offboarding, disabled accounts, forgotten credentials and user-specific share ownership.
- [ ] Protect Gokapi administrative endpoints and API keys from guest access.
- [ ] Rotate and document break-glass credentials and recovery procedure.

#### P4.3 — Basic branding without forking

- [ ] Set public product name, favicon, AIA logo, brand colors and custom CSS/JS using Gokapi supported customization.
- [ ] Build a simple landing/help page if necessary; keep upload/download form usable on mobile.
- [ ] Apply consistent terminology “AIA Transfer”, “Send files”, “Link expiry”, “Password”, “Manage transfers”.
- [ ] Test usability with a designer before investing in a complete replacement UI.

#### P4.4 — Temporary transfer functionality

- [ ] Test 1 photo, 1 video, 1 archive and one very large file against the real proxy.
- [ ] Verify actual upload progress/chunk behavior, resume after loss of connection, cancellation and restart/retry limitations.
- [ ] Verify expiry with accelerated test policy and check that files disappear from storage.
- [ ] Verify password enforcement, wrong password, maximum download count and manual revoke.
- [ ] Verify sender can copy link and external browser can open and download it without account.
- [ ] Verify safe filenames, Unicode characters, duplicate filenames and unusual content types.
- [ ] Record the exact behavior when a transfer expires **mid-download**, and approve it.
- [ ] Confirm “temporary” files never appear in the ResourceSpace catalogue or filestore.

#### P4.5 — Multi-file behavior and product decision

- [ ] Complete F2 proof and choose one **explicit** V1 behavior (native grouping, archive or custom group landing).
- [ ] If using an archive, measure temporary disk amplification and ensure the archive is automatically deleted; preserve original filenames and folder structure.
- [ ] If using independent links, do **not** call it a single multi-file transfer unless a reviewed wrapper implements one public link and consistent protections.
- [ ] Confirm that recipient handling of many files is acceptable to marketing users before launch.

#### P4.6 — Transfer MVP operations

- [ ] Verify cleanup job cadence and automatic deletions.
- [ ] Add transfer storage health, active upload count, container health and disk capacity checks.
- [ ] Back up Gokapi config and control data; define whether temporary payloads are included in backups based on business policy and retention.
- [ ] Document Gokapi upgrade/revert and restore procedure.
- [ ] Demonstrate a working standalone send/download from a non-AIA network.

**Exit gate P4:** marketing can use **AIA Transfer independently** for authorized temporary outbound transfers, with real lifecycle controls and documented multi-file limitations. DAM integration is not yet required.

---

## Phase 5 — Configure ResourceSpace as the permanent DAM backend

**Purpose:** use ResourceSpace for everything it already does well; avoid recreating DAM logic in custom code.<br>
**Outputs:** agreed metadata, permission roles, media review, previews, collections and native sharing verified.

#### P5.1 — Model media and metadata

- [ ] Define taxonomy for **Year**, **Event**, **Championship**, **Media Type**, **Tags**, **Source/Uploader** and **Rights**.
- [ ] Prefer controlled vocabulary for event/championship; prevent unbounded spelling variants.
- [ ] Choose ResourceSpace metadata fields and nodes; record exact IDs in `docs/architecture/metadata-mapping.md`.
- [ ] Define the canonical source of media names, descriptions, attribution and licensing info.
- [ ] Keep geo metadata disabled/not surfaced unless formal requirements change.
- [ ] Test bulk metadata updates through native ResourceSpace UI before implementing custom UI.

#### P5.2 — User groups and review lifecycle

- [ ] Create or validate `Marketing Viewer`, `Media Editor/Uploader`, `Media Reviewer`, `DAM Admin` and limited integration role(s).
- [ ] Restrict pending/unapproved assets from broad visibility and external shares.
- [ ] Verify reviewers can bulk approve and edit; viewers cannot approve or alter permissions.
- [ ] Ensure API service account cannot automatically view all restricted assets without business approval.
- [ ] Document exact ResourceSpace status/permission mapping in the adapter; avoid inventing parallel approval state.
- [ ] Test returned/rejected media and subsequent correction/resubmission.
- [ ] Test deletion/archiving while resources are in an active collection/share.

#### P5.3 — Previews and supported formats

- [ ] Confirm image previews for JPEG/PNG/TIFF and used camera RAW formats (e.g. CR2/NEF/ARW/DNG), noting ResourceSpace RAW preview configuration.
- [ ] Configure FFmpeg and/or available imaging tools for video poster frames/derivatives.
- [ ] Prefer ResourceSpace-managed derivatives and offline preview generation rather than rendering multi-megabyte originals in the gallery.
- [ ] Configure preview/background workers and cron where required; verify crash recovery and queue health.
- [ ] Test large video, corrupt media, unsupported codec, EXIF orientation and animated image behavior.
- [ ] Establish fallback icons/posters and explain “preview generating” state to users.

#### P5.4 — Native collections/sharing

- [ ] Verify collection creation, adding/removing permitted assets, ordering and visibility controls.
- [ ] Verify ResourceSpace's native external share flow for **single asset and multiple assets**.
- [ ] Verify external link password, expiry, view/download permission, rights/metadata exposure and revocation.
- [ ] Verify approved assets only, least-privileged share-as user group and no escalated metadata exposure.
- [ ] Record native share link format and internal source reference; treat generated access tokens as secrets.
- [ ] Check permission behavior if a resource is changed after the link was created.

#### P5.5 — Data integrity and backup

- [ ] Verify originals are stored in permanent ResourceSpace filestore, not temp transfer storage.
- [ ] Define and test backups that maintain consistency between originals, DB and configuration.
- [ ] Test recovery of one asset, one collection and one rights/permission change.

**Exit gate P5:** DAM backend is suitable for production use independently of the custom frontend, and access restrictions are demonstrated, not presumed.

---

## Phase 6 — ResourceSpace API integration and typed server adapter

**Purpose:** connect the new Media UI to existing data without exposing ResourceSpace secrets or rebuilding its business rules.<br>
**Outputs:** `MediaAdapter`, typed API schemas, authz rules, contract tests, error model and cache policy.

#### P6.1 — Confirm upstream API capabilities

- [ ] Identify installed ResourceSpace API version/config and permitted auth mode.
- [ ] Use native API Test Tool to confirm `do_search`, `search_get_previews`, asset/resource metadata, collection operations, metadata mutation, upload and status operations relevant to V1.
- [ ] Capture sanitized request/response examples for each operation, including errors, empty state, pagination and unexpected fields.
- [ ] Understand API signing, parameter encoding, ordering and transport requirements; implement signing exactly as official docs state.
- [ ] Test non-ASCII filenames, search queries, unicode tags and date filters.
- [ ] Map Media Vault’s mock-data shape to a normalized `Asset` type without leaking backend internals.

#### P6.2 — Implement server-only client

- [ ] Add shared typed schemas (e.g. Zod) for inputs and normalized responses.
- [ ] Implement ResourceSpace HTTP client with short connect/read timeouts, retry only for safe idempotent actions and structured errors.
- [ ] Sign requests **only** on the server and keep secrets out of HTML, URLs and browser network calls.
- [ ] Avoid leaking ResourceSpace private URLs or internal hostnames to browsers.
- [ ] Use correlation IDs and safe error logging; redact share keys, passwords and other credentials.
- [ ] Handle rate limits/retries, connection errors, malformed responses and missing previews.
- [ ] Limit preview and search result size and pagination to prevent accidental massive responses.

#### P6.3 — Permission enforcement

- [ ] Bind each request to authenticated session and authorized action.
- [ ] Use real user/role permissions; enforce per-asset restrictions before returning metadata/download or creating shares.
- [ ] Test a lower-privileged employee cannot fetch a restricted asset by guessing the ID.
- [ ] Test a non-reviewer cannot update approval status or tags beyond allowed scope.
- [ ] Test unauthenticated direct backend route requests are denied.
- [ ] Make approval state and public-share eligibility authoritative to ResourceSpace, not client-side flags.

#### P6.4 — Cache and preview strategy

- [ ] Establish asset-list pagination, cache keys and cache invalidation on edits/approval changes.
- [ ] Prefer correct authorized thumbnails with browser cache headers; avoid publicly caching restricted media.
- [ ] Use a permission-aware preview proxy or signed source requests; test direct asset URL expiration and headers.
- [ ] Add in-flight request deduplication to prevent duplicate search calls.
- [ ] Establish `stale-while-revalidate` or equivalent only where data staleness is acceptable.
- [ ] Never cache sensitive metadata across users/roles without a scoped key.

#### P6.5 — Tests and documentation

- [ ] Unit tests for signing/encoding/normalization, input validation, cache and error handling.
- [ ] Contract tests against actual ResourceSpace staging version, including denied access and pagination.
- [ ] Simulate slow API, 500 errors, missing asset, invalid token and rate-limit behavior.
- [ ] Update API capability matrix with exact upstream function mapping and examples.

**Exit gate P6:** server API can safely search, browse, preview, upload/update and authorize real assets, with automated permission and contract tests.

---

## Phase 7 — Adapt Square UI Media Vault into AIA Media

**Purpose:** convert Media Vault from **a single-page demo with mock Unsplash data** into a polished real DAM frontend. The vendor describes grid/list/masonry, search/filter, detail drawer, collections/tags and add-asset dialog; do not assume backend behaviour is included.<br>
**Outputs:** AIA Media staff application usable end-to-end against ResourceSpace.

#### P7.1 — Import licensed template safely

- [ ] Verify license and vendor source is legally usable by this development team/company.
- [ ] Start from the purchased template; remove mock data/providers and unused demo routes/features.
- [ ] Pin compatible dependencies and run lint/typecheck/build before modifying.
- [ ] Preserve original vendor source/tag or reference in private repo for upgrades.
- [ ] Establish AIA colors, logo, typography, favicon, page titles and component conventions.
- [ ] Remove unneeded document/3D/product/analytics features not part of the marketing DAM.

#### P7.2 — Real library and metadata

- [ ] Replace template mock asset store with typed server data access and query/cache hooks.
- [ ] Implement server-driven search/filter and cursor/page loading, avoiding downloading the whole catalogue.
- [ ] Show thumbnails, size/type, title, event/year/championship/tags and approval visibility correctly.
- [ ] Connect sidebar collections and tags to ResourceSpace.
- [ ] Implement gallery grid, list and masonry and preserve user selection/filter state when switching.
- [ ] Implement detail drawer with metadata, image dimensions, video duration where available, rights and permitted download actions.
- [ ] Implement full-screen preview/lightbox, next/previous and keyboard navigation.
- [ ] Include empty states, “no results”, preview pending, permission denied and offline states.

#### P7.3 — Selection and bulk operations

- [ ] Support single-click selection, multi-select, shift-range selection, select-all-current-results with clear scope indication.
- [ ] Show correct selected count and persistent action bar.
- [ ] Prevent bulk operations from acting on hidden/unselected assets or on results whose permissions changed.
- [ ] Support approved bulk metadata/tag and collection operations; stage destructive actions behind confirmations.
- [ ] Add **Share** in detail panel and bulk action bar; delegate to Phase 8 integration (temporary disabled or clearly marked in early iterations).
- [ ] Restore focus and selection state after modal navigation and API errors.

#### P7.4 — Media upload/review

- [ ] Connect staff upload to ResourceSpace’s supported upload mechanism (do not build a custom data sink).
- [ ] Confirm resumable/chunked upload behavior of the chosen supported path; if custom UI does not expose it, prefer a stable native uploader integration over writing chunking logic.
- [ ] Provide multi-file upload progress, per-file errors, retries and safe cancellation.
- [ ] Map default metadata and source provenance to ResourceSpace, including uploader identity.
- [ ] Route new assets into correct review state; prevent publication before approval.
- [ ] Build reviewer queue, approve/reject actions and bulk tagging if supported by installed ResourceSpace operations.
- [ ] Verify all status changes in ResourceSpace native UI to avoid UI-only state.

#### P7.5 — Authentication and UX polish

- [ ] Implement corporate staff sign-in/session, role-based pages and protected route middleware **with server checks**.
- [ ] Consistent error/toast labels, hover/focus states, keyboard shortcuts and modals.
- [ ] Show loading skeletons without jarring layout shifts.
- [ ] Handle images with landscape/portrait/very wide aspect ratios and large sets.
- [ ] Test Chrome, Edge, Firefox, modern Safari and mobile recipient layout where relevant.
- [ ] Test AIA network workstations and typical designer workflows on actual hardware.

#### P7.6 — Evidence

- [ ] Capture screenshots/videos of browse, detail, bulk select, search and review states.
- [ ] Demonstrate that data changes survive reload and are visible in ResourceSpace.
- [ ] Compare major flows to the original Media Vault demo; verify no hidden mock actions remain.

**Exit gate P7:** employees can perform complete DAM workflows in AIA Media against real ResourceSpace data without using the ResourceSpace standard UI for ordinary tasks.

---

## Phase 8 — Unified Transfer Registry and DAM sharing integration

**Purpose:** make a real **single Transfer ecosystem** across the independent applications while preserving two separate file systems.<br>
**Outputs:** transfer registry/API, public link resolver, DAM-share integration, unified history, owner-scoped revocation and status sync.

#### P8.1 — Registry and API contract

- [ ] Choose durable registry storage and migrations; record reasons and backup approach.
- [ ] Implement `transfers`, `transfer_items`, `transfer_events` and idempotency schema from §4.7 (adjust after privacy review).
- [ ] Define transfer states: `draft`, `creating`, `active`, `expiring`, `expired`, `revoking`, `revoked`, `failed`, `degraded`, with legal transitions.
- [ ] Define internal API operations: create from DAM, register from Gokapi, list mine, list admin, get detail, revoke, resolve public token and reconcile state.
- [ ] Use typed contracts, authz checks, server-side validation and idempotency keys for duplicate clicks/retries.
- [ ] Use unguessable public tokens; store a hash when possible, and keep source share secrets protected.
- [ ] Specify audit events and retention for deleted/expired transfers.

#### P8.2 — Link policies and underlying enforcement

- [ ] Normalize expiry input to UTC, display local time clearly and define max allowed expiry.
- [ ] Ensure underlying ResourceSpace native share and Gokapi file both implement expiry/password rather than relying only on registry/UI.
- [ ] Never store plaintext link passwords in the registry or email links with passwords embedded.
- [ ] For `resourceSpace` type, use F1-approved creation route; record actual native external share key and collection/asset references securely.
- [ ] For `gokapi` type, use Gokapi's official API and accepted multi-file strategy from F2.
- [ ] On revoke, disable/delete native underlying share first or transactionally mark `revoking`; only display `revoked` after confirmation.
- [ ] If registry write fails after creating a native share, compensate by revoking that native share or queue a bounded reconciliation task; avoid orphan public links.
- [ ] If source share is deleted independently, scheduled reconciliation marks registry record unavailable/expired and prevents reuse.

#### P8.3 — Media → Share → Transfer

- [ ] In AIA Media, select one approved asset, click Share, present consistent transfer options.
- [ ] Repeat for multiple approved assets, creating appropriate ResourceSpace native collection/selection without duplicating originals.
- [ ] Verify creator can share only assets authorized for external access, with correct metadata restrictions.
- [ ] Create unified registry record and return share link; handle idempotent retry.
- [ ] Display resulting transfer in common history and (optional) Media detail share list.
- [ ] When source asset is deleted/restricted/unapproved, revoke/disable according to policy, with reconciliation and warnings.
- [ ] When share expires, confirm DAM originals are still present and unchanged.

#### P8.4 — Gokapi → Registry → Transfer

- [ ] Register newly completed temporary transfers in registry; record source handles, safe titles, owners, expiry and status.
- [ ] Distinguish pending upload vs complete transfer; do not publish a public link before the payload is complete.
- [ ] Handle owner-scoped history, deletion and expiration with correct underlying Gokapi calls.
- [ ] If using multiple Gokapi file IDs in one transfer, implement tested source-item mapping and public landing behavior.
- [ ] Confirm no Gokapi data is imported into ResourceSpace accidentally.

#### P8.5 — Public branded link resolution

- [ ] Define canonical URL, e.g. `https://transfer.<AIA-domain>/t/<opaque-token>`.
- [ ] Look up token with constant-time-safe comparisons where appropriate and enforce expiry/revocation.
- [ ] Render guest-safe AIA-branded title, sender note, file listing and download buttons without exposing private fields.
- [ ] Enforce source-specific password/authorization and avoid a second inconsistent security layer.
- [ ] For ResourceSpace shares, determine whether redirect to native share, supported theming or a secure gateway is viable; **never proxy unrestricted backend functions**.
- [ ] For Gokapi shares, retain underlying expiry/password; ensure native direct URLs cannot bypass the intended group policy.
- [ ] Use noindex/no-store where appropriate, avoid referer leaks of secret tokens, and ensure URLs cannot be enumerated.
- [ ] Return clear 404/410/403 states, without telling anonymous users whether a confidential transfer existed.

#### P8.6 — History and management

- [ ] Show unified list with title, creator, created date, expiration, state and type `From Library` / `Temporary`.
- [ ] Show transfer detail page with permitted file metadata, link actions, source, recipient-access policy, revoke and status.
- [ ] Only creators or administrators may view/manage private transfer records, per configured policy.
- [ ] Search/filter by source, date, status and owner within permissions.
- [ ] Test expired/revoked/missing/backend-down records and manually imported legacy shares (if supported).
- [ ] Add source reconciliation task with bounded frequency/backoff and health metrics.

#### P8.7 — Failure-injection tests

- [ ] Disconnect ResourceSpace during Gokapi temporary upload and prove standalone transfer remains usable.
- [ ] Disconnect Gokapi during DAM browse and ResourceSpace-only sharing and prove DAM remains usable where intended.
- [ ] Fail registry DB and verify safe refusal of newly created unified links; define native fallback behaviour clearly.
- [ ] Fail midway through share creation and prove no abandoned public share persists.
- [ ] Attempt double-click create, repeated revoke, concurrent expiry and asset-permission change.
- [ ] Attempt direct access to a revoked underlying ResourceSpace/Gokapi native link and prove revocation is effective.

**Exit gate P8:** the same history and AIA link policy works for both source types; DAM assets are not copied into Gokapi; source security and deletion semantics are correct.

---
## Phase 9 — Dedicated, polished, independently deployed AIA Transfer UI

**Purpose:** deliver a visually consistent product without sacrificing the simplicity of Gokapi. This is **conditional**: if Gokapi's styled UI meets user expectations, preserve it instead of rewriting.<br>
**Outputs:** staff-friendly Transfer UX, guest download pages, common design tokens, separate deployment and improved transfer management.

#### P9.1 — Make the build-vs-style decision

- [ ] Demonstrate current branded Gokapi standalone UI to marketing and IT.
- [ ] List specific UX deficiencies that styling/configuration cannot solve (e.g. one-link grouping, transfer creation wizard, unified history, consistent guest landing).
- [ ] Estimate ongoing maintenance and security work of replacing Gokapi's interface with Next.js while keeping its backend.
- [ ] Choose **A**: retain/brand Gokapi UI + small separate registry dashboard, or **B**: create `transfer-web` in Next.js. Document decision; no UI rewrite by default.

#### P9.2 — Transfer creation UX (if B selected)

- [ ] Shared AIA design tokens and brand components with Media Vault; do not paste a second copy of the vendor template into a separate unsupported license scope.
- [ ] Build drag/drop upload, multi-file list, size totals, progress, cancellation and error states.
- [ ] Create transfer form: title, optional sender note, expiry, optional password, optional download limit.
- [ ] Establish sane defaults with ability to edit before confirming.
- [ ] Explain storage lifecycle clearly: “Temporary files will be deleted after expiry; they are not added to Media Library.”
- [ ] Implement authenticated, server-mediated Gokapi upload API flow; **do not buffer entire large files in Next.js memory**.
- [ ] Verify chunked/direct upload path with actual version; do not assume generic multipart API is resumable or E2E encrypted.
- [ ] Generate share link(s) only after confirmed file upload and registry commit.
- [ ] Add copy-link feedback and optional approved email/share UI.

#### P9.3 — Transfer history UX

- [ ] Add “My transfers”, permitted team/admin view, `Active`, `Expired`, `Revoked` and search/filter.
- [ ] Show source labels `Temporary` / `From Media Library` and accurate file count/total size when available.
- [ ] Show expiration countdown and exact expiry in local time with time zone.
- [ ] Provide revoke with confirmation and useful failure state if source backend is offline.
- [ ] Confirm a Media-origin share appears even if it was created from the Media app rather than Transfer.
- [ ] Show clearly when ResourceSpace-backed transfers are unavailable but temporary transfer tools remain online.

#### P9.4 — Recipient UX

- [ ] Responsive public AIA download page; no staff login; minimal metadata and approved sender note.
- [ ] If transfer is password protected, enforce password in the actual source backend; don't expose direct download keys before authorization.
- [ ] For a one-file transfer, one prominent download action.
- [ ] For multi-file transfer, follow F2 choice: one archive, one secure group page, or other approved native flow.
- [ ] Show expired/revoked/invalid link states with neutral text and no internal details.
- [ ] Test Safari/iOS, Android, Chrome/Edge and Firefox for upload/download behavior as applicable.

#### P9.5 — Independent deployment proof

- [ ] Deploy Transfer UI separately from Media UI, with independent release/version and health check.
- [ ] Stop the Media Next.js app and ResourceSpace staging containers; verify temporary transfer UI still works.
- [ ] Stop Transfer UI/Gokapi; verify Media gallery/search still works (DAM share entry point may be temporarily unavailable if shared registry is down; document degraded behavior).
- [ ] Test logout/login and navigation consistency between the two domains.

**Exit gate P9:** independent Transfer UI is approved by marketing, or a documented decision states that the branded upstream UI is intentionally sufficient. No unneeded rewrite is done.

---

## Phase 10 — Performance engineering, responsiveness and large-file robustness

**Purpose:** create a genuinely smooth product based on measurements rather than language-level assumptions.<br>
**Outputs:** benchmark report, profiling evidence, tuned NAS/app settings and resolved UX bottlenecks.

#### P10.1 — Define test environment and metrics

- [ ] Record desktop hardware, browser, wired/Wi-Fi connection, internet route, NAS load and test dataset at each benchmark.
- [ ] Create realistic datasets: 1k, 10k and (if expected) 50k metadata records; mixed portrait/landscape media and video previews.
- [ ] Use a **synthetic** test set; do not distribute private real media in benchmark artifacts.
- [ ] Instrument browser Web Vitals, interaction latency, API p50/p95/p99, ResourceSpace API time, gallery cache hit rate, upload throughput and I/O wait.
- [ ] Separate network latency, app CPU, DB queries, preview generation and proxy overhead in reports.

#### P10.2 — Initial measurable objectives (provisional targets, confirm with AIA)

| Measurement | Initial target / intended experience | Notes |
|---|---|---|
| Staff library first usable view | Aim **≤2.5 s** on representative wired office workstation | Test cold and warm cache; not a guarantee |
| Cached gallery filter / selection interaction | Aim **≤100 ms** perceived interaction | Local state should update immediately |
| Typical authenticated metadata request | Aim **p95 ≤250 ms** after warmup on LAN | Includes ResourceSpace/DB; adjust from baseline |
| Pure adapter overhead for trivial local call | Aim **p95 <10 ms** measured separately | Never claim zero latency |
| Gallery scroll | Aim **smooth 60 fps**, minimal layout shift | Virtualized lists / appropriately sized previews |
| Share create (not file upload) | Aim **p95 ≤500 ms** when backend healthy | Two backend writes may exceed this; measure |
| Large upload | Continuous progress, tested recovery after network drop | Throughput depends on LAN/WAN, proxy and disk |
| Disk reserve | Alert at 75–80%, critical at 90% by approved policy | Temporary storage can fill quickly |
| Guest link resolution | Fast and clear without leaking authorization state | Backend availability dependent |

These are **engineering objectives** for testing, not contractual SLA commitments. Optimize only after obtaining real baselines.

#### P10.3 — Media UI optimization

- [ ] Load thumbnails/preview derivatives, not originals, into tiles.
- [ ] Use responsive image sizes and formats supported by ResourceSpace; avoid expensive on-the-fly transformations for every request.
- [ ] Virtualize long grids or paginate server-side; limit concurrent thumbnail fetches.
- [ ] Preload adjacent preview and next/previous assets when appropriate.
- [ ] Debounce text search; cache and invalidate by query and authorization context.
- [ ] Keep selection and modal state client-local; avoid full-page navigation/re-fetch when selecting multiple assets.
- [ ] Lazy load large detail panels, video players, advanced filters and noncritical components.
- [ ] Monitor ResourceSpace worker queue and set up offline preview generation where supported.

#### P10.4 — Transfer performance and reliability

- [ ] Verify Gokapi's chunk size/parallelism against measured NAS RAM and WAN; upstream docs note chunks may be RAM-buffered.
- [ ] Avoid making Next.js upload routes buffer multi-gigabyte payloads; follow supported streaming or direct browser-to-Gokapi flow with secure authorization.
- [ ] Test uploads of 100 MB, 1 GB, 5 GB, 10 GB and an AIA-approved maximum.
- [ ] Test multiple concurrent users on LAN and WAN, with both uploads and downloads.
- [ ] Test pausing connectivity mid-upload, browser refresh, server restart and storage-full errors; document exactly what is recoverable and what must restart.
- [ ] Ensure `client_max_body_size`, timeout, chunk size and proxy buffering are correct for real sizes.
- [ ] Confirm link creation does not copy DAM bytes; monitor temporary disk spikes for any archive fallback.
- [ ] Rate-limit abusive guests without throttling normal long transfers unnecessarily.

#### P10.5 — Connector language decision

- [ ] Profile TypeScript API adapters under expected concurrency.
- [ ] If CPU, memory or throughput is poor, identify precise bottleneck (signing, JSON, DB, network, serialization, buffering).
- [ ] Prefer query optimization, caching, concurrency limits and reduced extra hops before replacing language.
- [ ] Only introduce Go if a specific isolated component benefits demonstrably (e.g. sustained download proxy/streaming under load).
- [ ] If introducing Go, establish HTTP/JSON or gRPC boundary, integration tests, deploy/observe/rollback process and proof that gains outweigh complexity.
- [ ] Do not use Rust without a new requirement warranting it; this is primarily an orchestration/UI problem.

**Exit gate P10:** realistic benchmark evidence demonstrates smooth interactions, acceptable upload/download stability and adequate headroom. Remaining bottlenecks are documented and accepted or fixed.

---

## Phase 11 — Security, data protection and abuse controls

**Purpose:** make safe external sharing and staff access a default property of the system.<br>
**Outputs:** threat model, permissions matrix, security test report, privacy/retention policy, closure of blocking findings.

#### P11.1 — Threat model

- [ ] Map trust boundaries: staff browser, public recipient, reverse proxy, Media app, Transfer app, registry, ResourceSpace, Gokapi, NAS, identity provider, backup destination.
- [ ] Analyze asset-ID guessing, direct URL bypass, expired link reuse, leaked share key, account compromise, untrusted uploads, malicious files, SSRF, XSS through filenames/tags/messages, CSRF, clickjacking, brute-force and denial-of-service.
- [ ] Analyze cross-tenant/role data leaks through caches and preview URLs.
- [ ] Analyze partial failures and race conditions between registry and underlying source share.
- [ ] Identify sensitive event photography, personal-data images, embedded metadata and contractual media rights implications.

#### P11.2 — Authentication and privilege verification

- [ ] Require MFA for admins through approved IdP.
- [ ] Use HttpOnly/Secure/SameSite cookies, appropriate session lifetime, CSRF protection, safe logout and session revocation.
- [ ] Prevent staff session/token reuse across origins improperly; configure cookies, redirects and CORS deliberately.
- [ ] Apply least-privileged Gokapi API keys; ensure ResourceSpace service accounts cannot silently bypass asset-specific authorization.
- [ ] Block endpoint access when only the UI button is hidden; exercise every permission boundary via API tests.
- [ ] Disable unused guest upload/File Requests functionality in V1.
- [ ] Test privilege removal during an active session and link creation authorization at time-of-action.

#### P11.3 — Public link security

- [ ] Generate high-entropy, non-sequential tokens; hash at rest where architecture permits.
- [ ] Ensure no secret token/password is written to general access logs, analytics, crash reports, screenshots or Referrer headers.
- [ ] Protect link password flow from guessing; add server-side attempt rate limits.
- [ ] Ensure expiry and manual revoke are enforced by the actual file owner backend.
- [ ] Test direct native ResourceSpace share URL after registry revoke; the link **must fail**.
- [ ] Test direct Gokapi file URL after revoke/expiry; the link **must fail**.
- [ ] Validate download filenames/content types and set safe `Content-Disposition` and `X-Content-Type-Options` where applicable.
- [ ] Do not allow external links to browse unrelated collections/files by editing query parameters.
- [ ] Decide whether download auditing logs IP addresses; comply with AIA privacy requirements and minimization.

#### P11.4 — Upload/file handling

- [ ] Enforce uploaded file size, concurrency and capacity limits at every required layer.
- [ ] Verify path traversal prevention, unsafe filenames, upload cancellation and disk-quota behavior.
- [ ] Confirm temporary transfer content is stored outside webroot and is not directly served by a generic NAS file server.
- [ ] Assess malware scanning for externally received files **only if that feature is introduced later**; for V1, staff-upload risks still exist and accepted antivirus/scanning policy should be defined.
- [ ] Decide which file types are forbidden by AIA policy and enforce consistently.
- [ ] Keep ResourceSpace uploads in ResourceSpace-native supported flow with review before publication.

#### P11.5 — Secret management and dependency hardening

- [ ] Store OIDC secrets, API keys, signing keys, DB passwords and encryption keys outside source control, protected at rest with restricted operator access.
- [ ] Rotate keys during personnel changes or suspected leakage; document blast radius and replacement steps.
- [ ] Enable image/dependency vulnerability alerts and patch cadence; test upgrades in staging.
- [ ] Review Media Vault template third-party dependencies and remove unused packages.
- [ ] Review Gokapi AGPL-3.0 obligations for network use and modifications with AIA’s legal/security team before deploying a modified version; upstream unmodified use still requires normal compliance assessment.
- [ ] Ensure template commercial license authorizes company/team usage and storage in private repo; no public publication of licensed source.

#### P11.6 — Privacy and retention

- [ ] Define data controller/processor responsibilities and AIA-approved policy under GDPR; do not assume a legal basis.
- [ ] Define transfer default expiry (e.g. 7 days as a **proposal**, not an approved setting), allowed maximum, deletion after expiry and retention of audit metadata.
- [ ] Decide whether temporary files need backups; if included, define how restored copies are purged in accordance with expiry policy.
- [ ] Define how sender activity/IP logs are retained and who may access them.
- [ ] Identify incident notification/escalation requirements, including data exposure or ransomware.
- [ ] Document user rights handling and legal holds if they apply to media or temporary files.

#### P11.7 — Security verification

- [ ] Run SAST/SCA, dependency and container scans.
- [ ] Run permission-negative automated tests and manual authenticated/unauthenticated abuse attempts.
- [ ] Review reverse proxy config and public ingress with AIA IT.
- [ ] Run an independent/peer review of the public-link resolver and ResourceSpace share adapter.
- [ ] Resolve all critical/high severity findings or obtain a documented human risk acceptance **before** production.

**Exit gate P11:** no known unauthorized access path to media/admin/data, link revocation tested at source, licensing/security reviewed, and retention/backup semantics approved.

---

## Phase 12 — Observability, backups, restore and operational procedures

**Purpose:** make failures detectable and recovery executable without the original developer.<br>
**Outputs:** dashboards/alerts, documented RPO/RTO, restore scripts, operator runbooks and maintenance schedule.

#### P12.1 — Health and metrics

- [ ] Create readiness/liveness checks for Media UI, Transfer UI/Gokapi, Transfer Registry, ResourceSpace, MariaDB and preview workers.
- [ ] Measure HTTP p50/p95 latency, 4xx/5xx errors, queue/thumbnail generation state, upload success/failure, active transfers, expired transfers not cleaned and failed revocations.
- [ ] Monitor NAS CPU, RAM, disk usage, IOPS, volume errors, filesystem health, container restarts, network saturation and certificate expiration.
- [ ] Use existing AIA monitoring platform if possible (e.g. Zabbix/Grafana where already deployed), not a new stack just for this product.
- [ ] Correlate logs with request IDs; redact tokens, passwords, signing keys and unnecessary personal data.
- [ ] Set alerts for failure to complete temporary cleanup and failed registry/source reconciliation.

#### P12.2 — Backup inventory

Define independent protection plans:

| Dataset | Backup expectation | Special notes |
|---|---|---|
| ResourceSpace DB | Scheduled consistent backup + offsite copy | Must align with original asset storage |
| ResourceSpace originals/previews | Snapshots/backup, independent verified copy | Originals are high-value and must survive NAS loss |
| ResourceSpace configuration/API keys | Secure versioned backup | Secrets encrypted and access restricted |
| Gokapi config/keys/metadata | Secure versioned backup | Encryption material is essential to restore encrypted files |
| Gokapi temporary payloads | **Policy-dependent** | Retention/expiry must survive restores; avoid unintended resurrection |
| Transfer Registry | Scheduled consistent backup with migrations | Test SQLite WAL-safe backup if chosen |
| Docker Compose/proxy definitions | Version-controlled and backed up | Secrets managed separately |
| UI source, pinned vendor source, build artifacts | Private repo + artifact archive | Respect paid template licensing |

#### P12.3 — Restoration test

- [ ] Human owner approves provisional **RPO** (maximum acceptable data loss) and **RTO** (recovery time objective); do not invent numerical commitments.
- [ ] Restore ResourceSpace DB + filestore into isolated host and verify sample originals, previews, metadata and shares.
- [ ] Restore Gokapi config and one temporary test file; confirm security/password/expiry semantics.
- [ ] Restore Transfer Registry and reconcile source records with actual live/expired objects.
- [ ] Confirm an expired temp file in a stale backup does **not** become publicly accessible again following restore.
- [ ] Simulate corrupted registry, unavailable database, insufficient storage and proxy certificate failure.
- [ ] Record times, steps, failure points, operator instructions and next restore rehearsal date.

#### P12.4 — Runbooks to produce

- [ ] `operations/start-stop-restart.md` — safe component start/stop order and health validation.
- [ ] `operations/backup-restore.md` — exact commands and recovery validation, no secret printing.
- [ ] `operations/gokapi-expiry-cleanup.md` — inspect orphan payloads, cleanup failures, disk reclaim.
- [ ] `operations/resourcespace-previews.md` — preview worker stuck/failure, requeue and validation.
- [ ] `operations/shares-revoke-expire.md` — revoke, orphan-share reconciliation, security response.
- [ ] `operations/access-management.md` — add/remove staff, role changes, IdP troubleshooting.
- [ ] `operations/storage-capacity.md` — capacity warnings, cleanup, NAS snapshot pressure.
- [ ] `operations/upgrade-rollback.md` — version pinning, migrations, blue/green or manual rollback.
- [ ] `operations/public-network-incident.md` — disable public ingress rapidly without damaging originals.
- [ ] `operations/lost-device-compromised-account.md` — revoke user sessions and share links.

#### P12.5 — Lifecycle automation

- [ ] Schedule backup jobs and verify success notifications.
- [ ] Schedule transfer registry state reconciliation; make it idempotent and rate-limited.
- [ ] Schedule removal of old audit records per approved retention.
- [ ] Schedule dependency review and patch window.
- [ ] Alert on missed backups, stalled expired-file cleanup and unhealthy certificate renewal.

**Exit gate P12:** IT can detect, diagnose, restore and safely roll back the ecosystem with written, tested procedures.

---

## Phase 13 — Full system validation and marketing UAT

**Purpose:** prove the ecosystem's real behavior across UI, backend, permissions, operational recovery and recipient access.<br>
**Outputs:** automated test evidence, UAT signoff, defect list, security signoff and production GO/NO-GO checklist.

#### P13.1 — Automated test pyramid

- [ ] Unit tests: time/expiry math, state transitions, authorization policy, filenames, validation and API signing.
- [ ] Contract tests: actual ResourceSpace version, Gokapi API/OpenAPI version, share/password/revoke behavior.
- [ ] Integration tests: DB persistence, linked share creation, duplicate request idempotency, cleanup and synchronization.
- [ ] E2E tests (e.g. Playwright): staff login, browse, select, share, upload/send, recipient download, revoke and expiry.
- [ ] Negative tests: wrong permissions, invalid passwords, expired links, malicious filenames, API errors and offline backend.
- [ ] Load tests: realistic image library, concurrent uploads/downloads, proxy and disk saturation behavior.
- [ ] Disaster recovery and rollback test on staging.

#### P13.2 — Acceptance test matrix

Record each test with **case ID, steps, expected result, actual result, test environment, evidence URL and pass/fail**.

| ID | Scenario | Expected result |
|---|---|---|
| AT-001 | Marketing opens Media | Authenticated approved assets displayed; no unapproved assets leaked |
| AT-002 | Search Year/Event/Championship | Correct results, pagination and real metadata |
| AT-003 | Open photo/video preview | Efficient derivative/stream; no original loaded into gallery tile |
| AT-004 | Bulk select & update tags | ResourceSpace updated; correct permissions and audit |
| AT-005 | Reviewer approves media | State persists in ResourceSpace; viewer can see only newly approved content |
| AT-006 | Viewer requests restricted asset ID | Denied through both UI and API |
| AT-007 | Share one DAM asset | Link/registry created without adding file to Gokapi |
| AT-008 | Share multiple DAM assets | One accepted transfer experience, correct files and permissions |
| AT-009 | DAM share with password | Recipient must pass real source password protection |
| AT-010 | DAM share expiry | Access blocked; DAM original unaffected |
| AT-011 | Revoke DAM share | Registry and native ResourceSpace access both blocked |
| AT-012 | Temporary upload single file | Gokapi stores; link works; ResourceSpace unchanged |
| AT-013 | Temporary upload multiple files | Meets approved F2 behavior (native group, archive or secure landing) |
| AT-014 | Temporary password | Access denied until correct password |
| AT-015 | Temporary expiry and cleanup | Link blocked, payload removed on expected lifecycle |
| AT-016 | Revoke temporary link | Gokapi native access disabled and history updated |
| AT-017 | Unified history | Both source types visible to authorized owner only |
| AT-018 | Media down | Standalone temporary send/download still works within dependency limits |
| AT-019 | Gokapi down | Media browse/search still works |
| AT-020 | Link token guessing / replay | No enumeration or expired/revoked bypass |
| AT-021 | Share changed-to-unapproved asset | Policy enforced on existing share, no unauthorized access |
| AT-022 | Browser network drops mid-upload | Tested supported recovery/retry behavior; no silent corruption |
| AT-023 | Storage nearly full | Safe rejection/alert; no partial corrupted published transfer |
| AT-024 | Service restart | Data persists and services recover according to policy |
| AT-025 | Restore from backups | DB, originals, keys/registry and permissions behave correctly |
| AT-026 | Marketing account disabled | New session denied, protected actions blocked |
| AT-027 | Public recipient view | AIA branded, responsive, no staff login, no internal metadata |
| AT-028 | Non-ASCII filenames | Correct upload, listing and download names |
| AT-029 | Direct native revoked URL | Fails, even if registry landing is bypassed |
| AT-030 | Untrusted user tries File Requests | Upload request workflow unavailable in V1 |

#### P13.3 — Real-user walkthroughs

- [ ] Recruit at least one marketing employee, one designer, one media reviewer and one IT operator for UAT.
- [ ] Give them natural tasks rather than telling them precisely which button to click.
- [ ] Record hesitation/confusion: “Find last year's MotoGP paddock photos”, “Share these 20 photos with a journalist”, “Send this temporary large video”, “Revoke that link”.
- [ ] Measure task completion, errors, number of clicks, wait states and subjective quality.
- [ ] Verify public guest download from an external machine/connection.
- [ ] Incorporate only blocking usability fixes; log cosmetic enhancements separately to protect release scope.
- [ ] Obtain documented stakeholder signoff.

#### P13.4 — Preproduction decision

- [ ] All must-pass AT cases pass or have approved documented exception; **AT-006, 010, 011, 014, 015, 016, 020, 021, 025, 029 and 030 have no acceptable insecure workaround**.
- [ ] No critical/high unmitigated security finding.
- [ ] Backup + restore validated in staging.
- [ ] Network exposure and domain approvals complete.
- [ ] Performance acceptable on intended AIA hardware and realistic media.
- [ ] Staff documentation and IT operations handover ready.
- [ ] Production rollback and emergency public-access shutoff rehearsed.

**Exit gate P13:** authorized owner approves production GO in writing with evidence. Otherwise NO-GO and return to affected phase.

---

## Phase 14 — Production launch and controlled adoption

**Purpose:** move from staging to production without risking existing ResourceSpace data or interrupting AIA operations.<br>
**Outputs:** production endpoints, migration report, monitoring, signoff and rollback-capable release.

#### P14.1 — Final change preparation

- [ ] Agree production change window, approver, incident contacts and rollback decision maker.
- [ ] Confirm DNS/TLS/firewall records and production hostname approvals.
- [ ] Capture new consistent ResourceSpace backups and snapshot just before release.
- [ ] Verify encryption/config secrets, IdP integration, production container digests and storage mounts.
- [ ] Disable development/test-only routes, demo data and verbose debug logging.
- [ ] Run final security checks and staging replay against production-equivalent config.
- [ ] Confirm backup capacity, NAS storage headroom and tested recovery path.

#### P14.2 — Deploy production services

- [ ] Deploy Gokapi and independent Transfer entry point with controlled production volumes and domain.
- [ ] Deploy Transfer Registry/API with migrations; verify `health` and internal authorization.
- [ ] Deploy ResourceSpace adapter/plugin only if F1 proved safe and backups are ready.
- [ ] Deploy Media Vault application pointing to production ResourceSpace via internal network.
- [ ] Confirm proxy is only public entry point; no direct database/admin ports.
- [ ] Confirm all required containers have healthchecks and restart policy.
- [ ] Confirm UI sources contain correct branding and no demo/mock media.

#### P14.3 — Smoke tests (with non-sensitive test assets)

- [ ] Staff sign-in to Media, search asset, preview, select, Share, external download and revoke.
- [ ] Staff sign-in to Transfer directly, upload temporary file, protect/expire/download and revoke.
- [ ] Verify transfer history contains both sources.
- [ ] Check disk usage, DB, proxy logs, latency and alert delivery.
- [ ] Verify guest links do not expose source/backend admin URLs or private metadata.
- [ ] Validate media originals before/after; sample checksums and asset counts unchanged apart from deliberate test data.

#### P14.4 — Soft launch / training

- [ ] Pilot with a small marketing group; do not immediately force all staff from WeTransfer before adoption is validated.
- [ ] Provide 1-page Marketing guide and 1-page IT support contacts.
- [ ] Demonstrate “Media Library share” vs “Temporary Transfer send” and clarify retention difference.
- [ ] Collect actual file sizes, upload/download problems and UI friction from pilot.
- [ ] Fix P0/P1 defects and re-run affected tests.
- [ ] Expand user group after approval, with staff access audited.

#### P14.5 — Rollback criteria and method

Triggers include unauthorized content exposure, broken expiry/revocation, repeated failed large uploads, corrupt DAM data, unapproved public endpoints or serious availability problems.

- [ ] Stop new share creation/upload via approved maintenance mode (avoid killing active downloads unnecessarily during planned changes).
- [ ] Disable public ingress to affected endpoints immediately for confirmed security exposure.
- [ ] Roll back new Media/Transfer frontend image to previous pinned digest where data schema allows.
- [ ] If DB migration requires rollback, use tested restore or backward-compatible migration procedure; do **not** restore stale DB blindly over ongoing legitimate changes.
- [ ] Remove/revert ResourceSpace plugin/config change without modifying original filestore.
- [ ] Preserve incident logs and audit trail; notify stakeholders and document actions.
- [ ] Revalidate ResourceSpace native UI as an emergency fallback for permanent DAM operations.

#### P14.6 — Release completion

- [ ] Record deployed image digests, schema versions, config checksums, date, operator and test evidence.
- [ ] Monitor actively during initial pilot/adoption period with explicit owners.
- [ ] Confirm no accidental temp-file buildup, queue stall or unobserved failures.
- [ ] Obtain business acceptance and declare v1.0 with changelog and known limitations.

**Exit gate P14:** live system works for both journeys, all safety rules hold, and IT is ready to operate it.

---

## Phase 15 — Handover, maintenance and future development

**Purpose:** avoid the common failure mode of a custom platform that only one developer understands.<br>
**Outputs:** final runbooks, ownership, patch schedule, developer handbook, roadmap and periodic reviews.

#### P15.1 — Documentation and handover

- [ ] Update final architecture diagram and network/data-flow diagram to reflect reality.
- [ ] Document exact backend versions, API endpoints, registry migrations, user groups and secret locations (names/locations, not secret values).
- [ ] Publish staff quick guides: finding media, reviewing, sharing, sending temporary files, revoking links and expiry expectations.
- [ ] Publish IT runbooks from Phase 12 and escalation contacts.
- [ ] Document backup status dashboard and last successful restore rehearsal.
- [ ] Hand over domain renewal, TLS automation, SSO ownership, repository ownership and commercial template license custody.
- [ ] Create final `KNOWN_LIMITATIONS.md` and `SUPPORT_MATRIX.md`.

#### P15.2 — Maintenance cadence (adjust to AIA policy)

- [ ] **Daily automated:** health alerts, backup success, disk/capacity, expired transfer cleanup and failed share reconciliation.
- [ ] **Weekly:** review alert anomalies, upload failures, capacity trend and access errors.
- [ ] **Monthly:** security patch/dependency scan, vendor version check, failed job review, restore sample and role/credential audit.
- [ ] **Quarterly:** full restore rehearsal, threat-model review, permission audit, load test against current media size, user feedback and capacity forecast.
- [ ] **Before major event:** test external transfer throughput, share lifecycle, backup headroom and support contacts.
- [ ] **When a team member leaves:** revoke sessions/keys, review owned transfers and transfer ownership according to policy.

#### P15.3 — Prioritized future backlog (NOT V1)

1. Optional Transfer **Request files** / inbound external upload links, if marketing later asks for them.
2. Optional **Import temporary files into DAM**, with provenance, review, malware and rights checks.
3. Send-by-email integration with approved SMTP/transactional email and recipient notification/audit.
4. Rich public multi-file download gallery/ZIP service if V1 used a simpler archive mechanism.
5. Detailed download activity and recipient statistics consistent with privacy requirements.
6. Optional CDN/object storage for offsite delivery if NAS uplink becomes limiting.
7. Automated metadata suggestions/AI tagging (never without a separate privacy and cost decision).
8. Disaster-recovery hosting of Transfer on a separate machine/cloud if high availability becomes necessary.
9. Content rights/consent/license review workflows as marketing needs evolve.

**Exit gate P15:** ownership transferred; upgrade and incident response do not depend on the original implementation agent.

---
## 7. Implementation rules and cross-cutting engineering standards

These rules apply in every phase, even where individual task lists do not repeat them.

### 7.1 Design rules

1. **No duplicate source of truth:** ResourceSpace owns permanent assets; Gokapi owns temporary bytes; Transfer Registry owns cross-system metadata only.
2. **Native links remain authoritative:** the registry cannot “make” an expired Gokapi or revoked ResourceSpace share active again.
3. **Separation of failures:** Media UI and Transfer UI must not require each other to boot; degraded modes should be understandable to users.
4. **Minimal custom code:** first try upstream configuration, supported API and UI components; next a narrow adapter; fork only with documented justification.
5. **No false optimization:** do not add Go, Rust, Redis, Kafka, object stores or a second analytics product without a measured requirement.
6. **Data ownership/identity:** every create/update/revoke is tied to a staff identity and an approved authorization decision.
7. **Error semantics:** API consumers receive typed codes (`UNAUTHORIZED`, `FORBIDDEN`, `EXPIRED`, `NOT_FOUND`, `SOURCE_DOWN`, `RETRYABLE`, `CONFLICT`) rather than unparsed HTML.
8. **Idempotency:** upload completion, share creation and revoke calls must be repeat-safe where possible.
9. **Source-link confidentiality:** no raw native access keys in analytics, public application logs, sentry events or screenshots.
10. **Permission and cache correctness:** authorization checked before preview/original access; cache keys include access scope.

### 7.2 API and transport conventions

- JSON for metadata/control-plane APIs, HTTPS externally and private Docker-network HTTP only where approved.
- Use a normalized envelope for custom API responses:

```json
{
  "data": {},
  "error": null,
  "requestId": "redacted-correlation-id"
}
```

- Return documented HTTP status codes; do not retry mutating actions without idempotency keys.
- Use UTC in storage and explicit timezone for display.
- Set maximum request sizes for **metadata** control plane separately from actual file-transfer traffic.
- Use streaming/direct upload where supported; reject attempts to funnel giant files through a JSON API route.
- Validate IDs, file counts, filenames, expiry dates and rights before upstream calls.
- Choose bounds on pagination, parallelism and timeouts; never permit an unbounded list endpoint.
- Use health endpoints that do not expose credentials or internal details.
- Where the registry caches status, show clear “checking”/“temporarily unavailable” rather than reporting false success.

### 7.3 Data deletion rules

- Revoking a **DAM share** must invalidate access; it must **not delete** ResourceSpace assets.
- Expiring a **temporary transfer** must invalidate access **and** remove temporary payload according to tested Gokapi cleanup behavior.
- Deleting a registry record must not be confused with revoking an underlying share; source revoke happens first or goes through an audited compensation job.
- No production cleanup command may operate on the ResourceSpace original-file mount unless explicitly part of an approved ResourceSpace-native procedure.
- Restore testing must ensure expired/deleted transfers do not become public again because of old Gokapi/registry state.

### 7.4 Compliance and licenses

- ResourceSpace is existing installed software; verify its current license, plugins and legal obligations in the deployed version.
- Gokapi source is **AGPL-3.0**. Review obligations before modifying/distributing/operating a fork.
- Media Vault belongs to the **paid Shadcn Dashboard/Square UI Pro** collection. Its vendor advertises a commercial template license; review actual invoice/license before copying source among agents or contractors.
- Do not copy internal AIA photos into public GitHub, public testing services or third-party component demos.
- All third-party packages require provenance, pinning and vulnerability review.

---

## 8. Major risks and explicit mitigations

| ID | Risk | Consequence | Mitigation / owner | Gate |
|---|---|---|---|---|
| R-01 | ResourceSpace has no supported API to create external share | Media “Share” cannot become automated | Test native API/plugin; manual-assist interim or reviewed minimal plugin | **F1** |
| R-02 | Gokapi gives a link per uploaded file | Weak multi-file WeTransfer UX | Prove actual behavior; choose archive or secure registry group landing; evaluate alternatives if unacceptable | **F2** |
| R-03 | Media Vault is visual-only mock UI | Underestimated build effort | Audit source, typed adapter and functional replacement of every mock control | **F3** |
| R-04 | Paid template license limits collaboration | Legal/compliance risk | Confirm commercial use, number of licensees and distribution restrictions before sharing source | **F3** |
| R-05 | Internet uplink is too slow | Poor external download experience | Measure real upload bandwidth and concurrency; decide CDN/offsite transfer later if needed | **F4** |
| R-06 | Public share bypasses registry password/revoke | Unauthorized media exposure | Underlying backend enforces expiry/password; test direct native links | P8/P11 |
| R-07 | User role bypass via privileged ResourceSpace API account | Confidential media leak | Least-privileged API identity, per-asset source authorization, negative permission tests | **F5** |
| R-08 | Shared NAS failure | Both services down | Tested backups, UPS/power, health alerts, offsite copy; independent hosting only if HA is later required | P12 |
| R-09 | Temporary transfer fills disk | DAM/DB outage or corruption risk | Quotas, capacity reserve, cleanup, alert thresholds, isolation where possible | P3/P4/P12 |
| R-10 | Archive-based multi-file transfer duplicates large files | Disk pressure and delays | Limit size/concurrency, staging cleanup, or use secure group landing | **F2** |
| R-11 | Lost Gokapi encryption/config secrets | Undecryptable temporary files | Encrypted secure config backup and restore rehearsal | P4/P12 |
| R-12 | Passworded share is mistaken for encrypted storage | Incorrect security assumptions | Document transport/storage encryption model; enforce acceptable policy | P11 |
| R-13 | Public upload/File Requests left available in V1 | Unexpected external intake/abuse | Remove permissions and block unused routes; negative test | P4/P11 |
| R-14 | ResourceSpace thumbnail generation blocks browsing | Sluggish gallery | Previews, offline queue, async workers, profiling and graceful placeholders | P5/P10 |
| R-15 | Custom source fork cannot be upgraded | Maintenance burden/security drift | Avoid forks; isolate any plugin; pin/test upstream upgrades | P1/P15 |
| R-16 | Revocation succeeds in registry but fails at source | Live leaked link falsely marked revoked | Correct state machine, source-first revoke, reconciliation and alerts | P8/P11 |
| R-17 | Backup restore resurrects expired transfers | Policy/privacy failure | Expiry reconciliation during restore, quarantine until verified | P12 |
| R-18 | AIA staff cannot use corporate SSO with both backends | Different logins/poor offboarding | Verify IdP/SAML/OIDC early; approved transition plan | **F5** |
| R-19 | API calls expose keys through query strings/logging | Credential compromise | Signing on server, redaction, no public logging of URL secrets, approved auth mode | P6/P11 |
| R-20 | A “single transfer hub” becomes a new DAM backend | Unnecessary rewrite and brittle ownership | Keep registry minimal; native systems are authoritative | Architecture review |

### Security stop conditions

**Stop deployment and alert the responsible human operator** if any of the following is observed:

- A recipient can access a file not included in their authorized share.
- A revoked/expired native share remains downloadable through direct URL.
- A hidden/private ResourceSpace asset is returned to an unauthorized user.
- An untrusted person can upload through a route meant only for staff in V1.
- A public endpoint leaks API secrets, internal hostnames, database contents or file paths.
- A production backup cannot be restored and no approved alternative exists.

---

## 9. Human decisions still required (record before each relevant gate)

The software agents must not silently choose these business/security values. Default proposals are allowed in **staging only**.

| ID | Decision | Provisional engineering recommendation | Must be approved by |
|---|---|---|---|
| D-01 | Actual public subdomains | One `media` and one `transfer` hostname under AIA-controlled DNS | AIA IT/domain owner |
| D-02 | Staff authentication | Corporate IdP with MFA; OIDC for Gokapi, SAML or approved mapping for ResourceSpace | AIA IT/security |
| D-03 | Gokapi expiry default and maximum | Start with a 7-day default **proposal**; define upper bound and legal exceptions | Marketing + IT |
| D-04 | Maximum transfer size and concurrency | Based on NAS capacity and measured uplink, not arbitrary numbers | Marketing + IT |
| D-05 | Mandatory one-link multi-file experience | Prefer one link; accept archive only if large-file tests pass and marketing approves | Marketing |
| D-06 | Encryption level and key custody | TLS mandatory, select Gokapi at-rest/E2E based on supported browser and security requirements | IT/security |
| D-07 | Recipient password defaults | Optional if permitted; mandatory for sensitive media categories | Marketing + security |
| D-08 | Retention of transfer audit/history | Minimize personal info; specific policy agreed for events | Legal/privacy + IT |
| D-09 | Gokapi temporary payload backup | Decide whether restorable transfers are needed vs automatic deletion guarantee | Marketing + IT |
| D-10 | RPO/RTO | Define separately for permanent DAM and temporary Transfer | Business owner + IT |
| D-11 | Public access architecture | Public share only via restricted proxy with approved firewall | Network/security |
| D-12 | Transfer UI launch style | Upstream Gokapi branding first unless marketing rejects it; Next.js app after proven need | Marketing + engineering |
| D-13 | AIA brand assets and language | Approved logo/brand guide, first language and localization needs | Marketing |
| D-14 | Share creation integration route | F1-A native API, F1-B minimal plugin, or explicit interim manual flow | Engineering lead + IT |
| D-15 | Preview/storage scale | Storage headroom and offsite delivery contingency | IT |
| D-16 | Template purchase and collaboration scope | AIA-owned licensed source in private repository | Procurement/legal |

**Recommendation:** maintain an `OPEN_DECISIONS.md` file with each decision ID, owner, deadline, evidence, outcome and whether it blocks a phase.

---

## 10. Detailed agent handoff and task format

### 10.1 Recommended agent roles (may be the same person/agent sequentially)

| Agent/role | Owns | Must not change without approval |
|---|---|---|
| **Lead/integration agent** | Architecture, dependency gates, adapters, release integration and decision log | Production security policy or unapproved scope |
| **Infrastructure agent** | NAS, Docker, proxy, backup, monitoring, staging | Destructive production volume changes or firewall public exposure |
| **ResourceSpace agent** | Metadata, permissions, ResourceSpace API mapping and minimal approved plugin | Raw ResourceSpace DB schema or privileged API bypasses |
| **Transfer agent** | Gokapi deployment/API, transfer registry, public link lifecycle | DAM originals, source security, new external upload feature |
| **Frontend agent** | Licensed Media Vault, UI data binding, selection, gallery/detail, shared design | Mock success responses, secret-bearing client calls, unlicensed redistribution |
| **QA/security agent** | Contract/E2E/load/security tests, negative tests and UAT evidence | Test waivers, production GO decisions |
| **Docs/ops agent** | Runbooks, architecture evidence and support guide | Secret disclosure, unverified claims of completed work |

### 10.2 Ticket template (copy for each deliverable)

```markdown
# TASK: P<phase>.<step> — <short title>

## Business outcome
<What marketing/IT can do after this task>

## Inputs / prerequisites
- Relevant completed phase gates:
- Installed upstream versions:
- Affected services:
- Source documentation:

## Scope
- In scope:
- Out of scope:

## Implementation instructions
1. <Atomic, verifiable action>
2. <Atomic, verifiable action>
3. <Atomic, verifiable action>

## Contract / security invariants
- <Permissions, expiry, token, no duplicate file copies>

## Tests and evidence
- Unit:
- Contract/integration:
- Negative/security:
- Screenshot or recorded result:

## Acceptance criteria
- [ ] Requirement 1 demonstrated
- [ ] Requirement 2 demonstrated
- [ ] CI green
- [ ] No data regression
- [ ] Docs updated

## Rollback and operations impact
<How to undo safely; monitoring added; new secrets/volumes>

## Result
Status: NOT STARTED / BLOCKED / IN PROGRESS / REVIEW / DONE
Commit/PR:
Evidence:
Open risks:
```

### 10.3 Handoff report after each phase

The agent completing a phase must submit:

1. **Summary:** what was actually done (not intended).
2. **Artifact paths:** files, code modules, Compose/CI changes, migrations and documentation.
3. **Verified upstream versions** and links to relevant official docs.
4. **Test commands and results** with timestamps, including negative tests.
5. **Security changes:** roles, keys, host exposure, permissions and rollback impact (no secret values).
6. **Known deficiencies and risk IDs**, including any changed upstream behavior.
7. **Deployment/rollback procedure** for that phase.
8. **GO/NO-GO recommendation** for the next phase and any explicit approvals still needed.

The next agent must read this report before changing code. No phase is “done” merely because a branch compiles.

### 10.4 Phase status tracker (initial state)

| Phase | Status | Evidence | Blocker / owner |
|---|---|---|---|
| 0 Discovery & backup | NOT STARTED | — | Environment access |
| 1 Requirements & feasibility | NOT STARTED | — | F1–F5 approvals |
| 2 Repo & CI | NOT STARTED | — | Template/license decision |
| 3 NAS & ingress | NOT STARTED | — | Network/domain approvals |
| 4 Gokapi MVP | NOT STARTED | — | F2 and staging |
| 5 ResourceSpace config | NOT STARTED | — | Baseline backup |
| 6 DAM adapter | NOT STARTED | — | API capability tests |
| 7 Media Vault | NOT STARTED | — | Licensed source and adapter |
| 8 Unified share/registry | NOT STARTED | — | F1, F2 |
| 9 Transfer UI | NOT STARTED / CONDITIONAL | — | Marketing feedback |
| 10 Performance | NOT STARTED | — | Representative datasets |
| 11 Security/privacy | NOT STARTED | — | Threat model and testing |
| 12 Operations/recovery | NOT STARTED | — | Backup target and monitoring |
| 13 UAT & final test | NOT STARTED | — | Earlier gates |
| 14 Production rollout | NOT STARTED | — | Signoffs and change window |
| 15 Handover | NOT STARTED | — | Live service |

---

## 11. Cost, maintainability and version management

### 11.1 Expected cost categories

| Component | Cost treatment |
|---|---|
| ResourceSpace | Existing self-hosted installation; validate current deployment/support obligations |
| Gokapi | Open-source software; self-hosted infrastructure/operations cost |
| Square UI Media Vault | Paid licensed source; vendor advertised a **$129 one-time Ultimate Kit** as of research date, verify price/terms at purchase |
| Next.js / TypeScript | Open-source software; development and operations cost |
| NAS | Already owned; storage expansion, power, backups and replacement parts may cost extra |
| Reverse proxy/TLS/DNS | May be covered by current AIA infrastructure; verify domain and certificate policy |
| Backup/offsite copy | Requires suitable independent destination and retention; budget explicitly |
| Public internet bandwidth | Existing AIA uplink; may be insufficient for heavy concurrent external deliveries |
| Security review and IT time | Real cost, even if agent-generated source minimizes developer time |

### 11.2 Upgrade strategy

- Pin Gokapi/ResourceSpace version compatibility and review release notes for API breaking changes.
- Validate modified Media Vault source against upstream template updates before merging.
- Maintain a capability test suite that runs before any Gokapi or ResourceSpace upgrade.
- Always test restoring config/DB/filestore with upgraded version **and** reverting to previous version.
- Document data migration compatibility; do not assume downgrades are safe.
- Prefer short, reviewed patches to custom forks.

### 11.3 Independent hosting readiness

The initial platform shares one NAS, proxy and network path. If higher availability is needed later, design for moving AIA Transfer without moving the DAM:

- AIA Transfer uses its own storage, config, registry and deployment.
- Media references Transfer using stable internal API contracts, not filesystem paths.
- Public URLs use approved DNS so they can be redirected to a new host during a planned migration.
- Avoid direct shared DB writes and nonportable NAS-specific file assumptions.
- If split, re-evaluate transfer cost, security, backups, bandwidth and secret distribution.

---

## 12. Operational and user-facing acceptance checklist — one-page release gate

**Do not mark the project production-ready until all required items are proven.**

### Product functionality

- [ ] AIA Media and AIA Transfer each have their **own direct URL** and independently deployable application.
- [ ] AIA Media has a real, attractive, fast gallery backed by ResourceSpace.
- [ ] Marketing can upload and review permanent media with the agreed metadata and permissions.
- [ ] Selecting one/multiple approved DAM assets and clicking Share creates a valid external link without copying originals to Gokapi.
- [ ] Marketing can open Transfer directly, upload unrelated temporary files and share them; no DAM record is created.
- [ ] Both source types appear in unified transfer history.
- [ ] Expiry and revoke work **at the source backend**; DAM originals survive share expiry.
- [ ] Multi-file transfer behavior is documented and signed off against actual Gokapi behavior.
- [ ] External recipient download requires no staff account and exposes no staff admin routes.
- [ ] External “Request files” and Transfer-to-DAM import are **not present in V1**.

### Engineering and operations

- [ ] All upstream version/API uncertainties resolved by tested results.
- [ ] Secrets kept server-side; SSO, MFA, least privileges and negative tests pass.
- [ ] NAS resources and public uplink benchmarked under representative usage.
- [ ] Production configuration, ingress, storage quotas and encryption reviewed.
- [ ] Monitoring, alerts, lifecycle cleanup, backup and complete restore are tested.
- [ ] No high-risk unresolved security issue and no broken direct-link revocation.
- [ ] Marketing UAT and IT production signoff obtained.
- [ ] Documentation, support plan and rollback procedure handed over.

---

## 13. Sources and official documentation (checked 7 November 2026)

The following are verification references for agents, not guarantees that a particular function exists in the version installed on the AIA NAS.

### UI and licensing

- Square UI open-source repository / Pro catalog: <https://github.com/zerostaticthemes/square-ui>
- Media Vault vendor product page and claimed features: <https://shadcndashboard.com/templates/media-vault>
- Template pricing: <https://shadcndashboard.com/pricing>
- Template commercial license: <https://shadcndashboard.com/license>
- Template live demo: <https://square-ui-media-vault.vercel.app/>

**Verified vendor caveat:** Media Vault is described as **one gallery route**, two variants, ~23 components per variant, with mock Unsplash preview data and a Zustand store. Treat its controls as UI until implemented/tested with ResourceSpace. Paid source/licensing must be acquired/verified before committing it.

### ResourceSpace

- API and signing, function list, API Test Tool: <https://www.resourcespace.com/knowledge-base/api/>
- External resource/collection sharing, expiry/password: <https://www.resourcespace.com/knowledge-base/user/sharing-resources>
- Share and collection user workflow: <https://www.resourcespace.com/knowledge-base/sharing-and-collections>
- Manage/revoke external shares: <https://www.resourcespace.com/knowledge-base/user/manage_external_shares>
- Source external access key metadata: <https://www.resourcespace.com/knowledge-base/developers/database/external_access_keys>
- User permissions: <https://www.resourcespace.com/knowledge-base/developers/all-user-permissions>
- SAML SSO plugin: <https://www.resourcespace.com/knowledge-base/plugins/simplesaml>
- Preview performance/offline job queue: <https://www.resourcespace.com/knowledge-base/troubleshooting/slow_preview_creation>
- Supported file formats and RAW preview: <https://www.resourcespace.com/knowledge-base/troubleshooting/supported_formats>

**Verified API caveat:** Official public API function list includes collection operations and `delete_access_keys`; share **creation** is not plainly listed as a public remote function. Native share creation works in the official UI. **F1 remains mandatory.**

### Gokapi

- Source, features and license: <https://github.com/Forceu/Gokapi>
- Vendor docs, stable/latest: <https://gokapi.readthedocs.io/en/latest/>
- Setup, OIDC, Docker persistence, proxy behavior: <https://gokapi.readthedocs.io/en/latest/setup.html>
- Upload/share behavior and automatic expiry: <https://gokapi.readthedocs.io/en/latest/usage.html>
- API and CLI: <https://gokapi.readthedocs.io/en/latest/advanced.html>
- Upstream OpenAPI specification (verify installed tag): <https://github.com/Forceu/Gokapi/blob/master/openapi.json>
- Release notes/breaking API changes: <https://github.com/Forceu/Gokapi/releases>

**Verified Gokapi caveats:** Standard upload documentation describes a **link per uploaded file**; generic `/api/files/add` is **not** a chunked upload and does not provide end-to-end encrypted upload semantics. Large-file transport and multi-file grouping need F2 proof. Official documentation also cautions that built-in encryption implementation has not been independently audited; do not assume it replaces a broader security design. Gokapi supports optional external File Requests, but **this capability is out of scope and should be disabled/restricted for AIA V1**.

### Context references

- The user established the following project requirements in discussion: existing ResourceSpace NAS installation; Square UI Media Vault visual direction; independent AIA Transfer; ResourceSpace-backed library share without duplicate bytes; Gokapi-backed temporary file sending; single branded ecosystem; minimal new code; no external upload request/import workflow in the current scope.

---

## 14. First tasks to hand to Codex / engineering agents

**Start here. Do not jump straight to building the frontend.**

```text
TASK 00 — DISCOVERY ONLY

Read this entire plan. Do NOT alter production config or data.

1. Inventory the existing UGREEN NAS Docker environment and actual
   ResourceSpace version, volumes, network, API state and backup strategy.
2. Verify read-only ResourceSpace access, status, user groups and API
   Test Tool availability without revealing credentials.
3. Identify whether the paid Square UI Media Vault source is present,
   and record the actual license/source folder. Do not download/share
   paid source without approval.
4. Study verified official ResourceSpace API/share docs and current
   Gokapi version/OpenAPI. Produce explicit F1/F2 capability matrices.
5. Draft staging-only Compose/proxy plan (no production deployment).
6. Produce docs/discovery/ENVIRONMENT_BASELINE.md,
   docs/discovery/FEASIBILITY_RESULTS.md,
   docs/decisions/OPEN_DECISIONS.md, and STATUS.md.
7. Report blockers, requested approvals, and the exact next commands
   before any write, container restart, public port or migration.

ACCEPTANCE: no production changes; all findings evidenced; unknowns
clearly marked; backup/restore plan documented; next gate is P0/P1.
```

### Final engineering recommendation

**Keep ResourceSpace. Use Gokapi for temporary transfers. Use the paid Media Vault UI for the DAM. Make AIA Transfer independently accessible. Integrate the two via a small, typed server-side transfer registry/API. Do not duplicate permanent media into temporary storage. Prefer TypeScript first, then profile. Use upstream built-in functions for as much as possible.**

The only architecture-changing unknowns are **automatic ResourceSpace share creation**, **Gokapi's multi-file single-link UX**, and **AIA's external infrastructure/identity policy**. Validate those early; the rest of the roadmap is designed to be executed incrementally without inventing an entire new DAM or transfer engine.

---

*End of master implementation plan.*
