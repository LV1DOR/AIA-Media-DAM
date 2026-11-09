# Support matrix

| Component | Pinned implementation | Support boundary |
|---|---|---|
| AIA Media / Transfer | Next.js 16.4.5, React 19.3.1, TypeScript 7.0.2 | Separate standalone applications, shared original UI |
| API / registry | Node 22.23.4, Fastify 5.12.8, SQLite schema 3 | One writer on local NAS volume; durable native finalization intent; no NFS/multi-replica SQLite |
| DAM | ResourceSpace 11.0 SVN r29907, PHP 8.3.6 | Native API/plugin bindings pinned to installed source; test before upgrading |
| DAM database | MariaDB 11.4.13 | Native transactions/dumps, original volume retained |
| Temporary engine | Gokapi 2.2.4 | Supported chunk/API routes; unchanged upstream binary; no file requests |
| Ingress | Caddy 2.11.9 | Private CA/IP HTTPS, NAS LAN ports 8443/8444 |
| Package manager | pnpm 10.14.0, frozen lockfile | Node 22.17+ below 23 for development; exact image pin for NAS |
| NAS | UGREEN DXP4800 Plus, Btrfs, Docker 29.6.2 | Reflink backup requires Btrfs; verify schedules after NAS upgrades |

Photos: JPEG/PNG/WebP/TIFF and allowed camera RAW extensions where ResourceSpace's installed tools support them. Video: MP4/MOV/M4V/WebM upload, with browser-compatible native preview needed for playback. Listed extensions are not proof that every codec/camera variant was tested. Transfer accepts arbitrary file types but serves originals as attachments with filename sanitization, never active inline HTML/SVG.

Modern browsers with HTTPS, File/Blob, fetch streaming, clipboard and TOTP authenticator support are intended. Actual visual/browser compatibility remains a human acceptance task. No Safari/mobile/assistive-technology pass is claimed.

Version/image evidence is in the release report and Compose pins. Application source is private AIA work; no paid template source is included. See [third-party notices](THIRD_PARTY_NOTICES.md).
