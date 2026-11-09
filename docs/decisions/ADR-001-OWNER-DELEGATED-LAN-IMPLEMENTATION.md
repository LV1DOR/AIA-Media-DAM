# ADR 001 - Owner-delegated original UI and LAN implementation

Accepted 8 November 2026. The owner explicitly authorized replacing the paid template and making the remaining technical choices, stating that no domain or corporate identity information is available and granting NAS implementation permission.

- Replace the purchased Media Vault dependency with original Next.js/TypeScript interfaces and shared original components. Do not acquire or redistribute paid source.
- Deliver LAN HTTPS first using the NAS IP and Caddy's private CA. Separate Media and Transfer ports/origins; no invented domain, router forwarding, DNS change or certificate-authority account. Internet delivery remains an optional later infrastructure milestone.
- Use local staff identities, scrypt password hashing, opaque server sessions, role checks, administrator-managed onboarding and TOTP enrollment. Corporate federation is optional later; do not require an unknown tenant to implement local sign-in.
- F1-B: implement a narrow, version-pinned ResourceSpace plugin using supported plugin API bindings and native collection/share functions. Check ownership, approval, global access and native download permission at creation and each recipient download. Never write ResourceSpace private tables directly.
- F2-C: one opaque AIA landing link references independent Gokapi objects. Password/expiry/revocation/count checks apply to each object download. Source credentials and native URLs remain server-side. Stream bytes; do not build an archive or copy DAM bytes into Gokapi.
- Keep ResourceSpace as DAM authority. Separate deployable Media, Transfer and API/registry services; SQLite is owned only by the API, on a local NAS volume with one writer. No Redis/new DB server.
- Defaults: 7-day expiry, 30-day maximum, 20 GiB per file, 100 files per transfer, two concurrent uploads per staff user, no automated email. Uploads remain pending until a reviewer approves. Approved assets becoming restricted/unapproved/deleted invalidate delivery immediately on reauthorization.
- No external file requests or Transfer-to-DAM import. No general proxy to upstream APIs. No automatic acquisition of domains/paid services.

The original public-domain/IdP/template gates are replaced for the LAN delivery milestone. Runtime source authorization, expiry/revocation, recovery and full application tests remain required. Isolated implementation/prototype work may continue while remaining acceptance cases are tracked; an unproven case is not marked passed. Internet production GO and human marketing UAT remain distinct from LAN installation.

Rollback: stop only the new ecosystem services, disable the new plugin and restore its prior config copy if needed. Retain existing ResourceSpace data and tested recovery sets. No destructive reset of the NAS is authorized or necessary.
