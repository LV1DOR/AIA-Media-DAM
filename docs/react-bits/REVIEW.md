# React Bits integration review ? 9 November 2026

Implemented on `frontend/unified-ui-review`. **Not deployed.** Existing ResourceSpace originals, production registry, infrastructure and stable release were not modified. All five requested components are integrated into application flows.

## Current signup and settings refinements

The latest candidate requires a private saved Profile photo and an 8-character-minimum password with uppercase, number and symbol. MFA digits are visible white on centered dark-grey boxes. Requested login/lanyard text has been removed or aligned. Administrators can upload/remove explicitly public photos under **Settings ? Background photos**, without exposing the private gallery. See [current refinements and validation](SETTINGS_REFINEMENTS.md); this supersedes earlier optional/browser-only photo behavior and schema-4 notes.

## Current background placement ? owner correction

- **Admin invitation:** plain form inside Settings. No photo wall, backdrop image, decorative card shadow or gallery fetching.
- **Login and recipient signup:** shared GridMotion public photo tiles behind the centered card. The full-page fixed golden-hour image has been removed; the spaces around the tiles use a solid neutral background.
- The owner explicitly chose **keep gallery photos private; use existing public photo tiles**. Only the existing approved public artwork appears in the tiles; no NAS thumbnails were published or requested by these public screens. The Transfer receiver background remains unchanged.

Both optimized builds, workspace typecheck, Prettier, all **26 browser workflows**, three viewport layout checks and the actual-API invitation/TOTP/sign-in browser flow pass after this correction. [Plain admin form](evidence/admin-invitation-plain.png), [recipient signup](evidence/recipient-signup-grid.png), [login](evidence/sign-in-1440.png). [Verification receipt](evidence/background-placement.json).

The following sections retain implementation history; this placement supersedes the earlier administrator photo-wall design.

## Sign-in layout follow-up ? 9 November 2026

The split green artwork panel has been removed. Both Media and Transfer sign-in now use one centered card over the same React Bits GridMotion treatment as the invitation form. The password-first MFA step stays inside that card. Public sign-in tiles use varied crops of the existing approved circuit artwork; private NAS thumbnails are not requested before authentication.

Both optimized review builds, typecheck and formatting pass. Browser inspection at 1440, 768 and 390 px confirms horizontal/vertical centering, no horizontal overflow, no runtime errors and zero private library requests. Reduced motion remains static. Administrator sign-in on Transfer and the full actual-API invitation/TOTP/subsequent-MFA flow pass after the layout change. The 38-test/26-workflow suite below records the preceding integration baseline; it was not rerun for this presentation-only follow-up. See [layout evidence](evidence/sign-in-layout.json), [desktop](evidence/sign-in-1440.png), [tablet](evidence/sign-in-768.png), [mobile](evidence/sign-in-390.png), and [follow-up receipt](evidence/sign-in-followup.json).

Modified: shared `index.tsx`, scoped `unified.css`, and new `components/sign-in-background.tsx`. No backend, dependencies or production changes. To undo this follow-up selectively, restore the previous Login layout and remove its dedicated CSS/component; keep the invitation and MFA implementation intact.

## Review locally

Open **http://127.0.0.1:3310**. Synthetic administrator: `admin` / `synthetic-review-admin-only`. These credentials belong only to the loopback, in-memory review service.

- Receiver: http://127.0.0.1:3311/t/ssssssssssssssssssssssssssssssssssssssssss1
- In Media, choose **Settings ? Staff ? Add staff**. Create an invitation and copy its link. Open it in a separate/incognito browser to follow the recipient flow.
- The recipient sets a password, optionally chooses a badge photo, scans the QR code in an authenticator and enters its actual six-digit code. The preview uses the **real application password, invitation and TOTP handlers**, with an ephemeral synthetic registry and synthetic native provisioning/gallery. It never connects to the NAS. The browser regression fixture uses `123456`; that fixed code is **not** used by the real-auth review service.
- The success badge appears only after server-confirmed activation. Continue enters the recipient's workspace. Subsequent sign-in verifies the password before showing CodeSlots.
- Restart with `corepack pnpm preview:review`. All synthetic accounts and invitations disappear on restart. Stop the preview with `stop` on its terminal input or Ctrl+C.

## Delivered behavior

| Area | Implementation |
| --- | --- |
| Transfer receiver | Actual React Bits GlassSurface wraps all card content. Existing artwork, layout and authorized file controls remain. Subtle SVG refraction and a frosted CSS fallback are receiver-scoped. |
| Expiry | Four Counter instances derive days/hours/minutes/seconds from actual `expiresAt`. Clock differences, refresh, visibility changes and durations beyond seven days work; values never go negative. At zero the receiver replaces downloads with Transfer expired. Exact expiry is accessible without per-second announcements. Server download expiry remains authoritative. |
| Administrator | Creates a pending account and a private invitation, with no initial password to share. An enabled pending row can create a replacement invitation; disabling it invalidates setup. |
| Recipient | Single-use 48-hour invitation ? required private profile photo and chosen 8?128-character complex password ? 15-minute authenticator enrollment ? six-digit server verification ? activation/session ? welcome badge. Setup can resume in the same browser after refresh. No staff session is created before MFA confirmation. |
| Badge | Reusable Canvas layer generates front/back/strap from the real name, private saved profile photo (initials only for legacy/fallback use), and existing AIA logo. Names wrap by words and shrink as needed, with character wrapping for unusually long tokens. Lazy Three.js Lanyard supports drag/swing/click flip. Reduced motion, missing WebGL, texture/rendering failures use a static badge or textual confirmation. Object URLs, observers, timers, listeners and GPU resources are cleaned up. |
| Sign-in | Password-first, server-issued five-minute HttpOnly MFA challenge. CodeSlots accepts keyboard/paste/mobile OTP, prevents concurrent verification, animates success only after server confirmation and clears/refocuses after rejection. Six attempts, route rate limits, single use and security-state binding prevent replay or offboarding bypass. Existing administrator enrollment and operator recovery remain. |
| Photo wall | GridMotion is shared by login and recipient signup, using existing approved public photo tiles over a solid neutral base. Private gallery photos remain private by explicit owner choice. The administrator invitation form is plain and does not fetch gallery media. Hidden-tab pause and reduced motion remain supported. |

## Files and dependencies

- `packages/ui/src/components/react-bits/`: five official TS/CSS components and scoped adaptations.
- `packages/ui/src/components/{account-creation,invitation-setup,account-success,mfa-challenge,expiry-countdown}.tsx`, `lib/{api,badge-images,expiry}.ts`, shared `index.tsx` and `unified.css`.
- Both applications add `/join`.
- `services/transfer-api/src/{app,store,mfa-challenges}.ts` and shared staff contract add invitations and staged MFA.
- `tests/react-bits.test.ts`, `tests/security.test.ts`, `tests/browser/react-bits.spec.ts`, fixtures and review launcher cover the flows. Native smoke tools understand both the old creation response and the new invitation response; their native writes were not run.
- Added **three 0.180.0** and development-only **@types/three 0.180.0**. Existing motion and Lucide supply CodeSlots animation/check icon; no Hugeicons packages or alternative UI framework were added.
- Official registry downloads are pinned by SHA-256 in [provenance](evidence/component-provenance.json). React Bits uses **MIT + Commons Clause**, not plain MIT; its full notice is retained under `packages/ui/licenses/react-bits.txt`. Three.js retains its installed MIT notice.

## Verification

- Frozen-lockfile install; both optimized builds; workspace typecheck; Prettier format check; **38 API/model tests**; **26 optimized-browser workflows** passed.
- A further browser run exercised the actual Fastify authentication handlers through the optimized review frontends, including real TOTP generation/verification and subsequent sign-in: [receipt](evidence/real-api-browser.json).
- Browser checks cover desktop/mobile receiver, refresh/expiry/downloads, creation failure, protected thumbnail requests, optional chosen-photo pixels on generated badge, incorrect-code retry, paste, WebGL drag/flip, disabled-WebGL and reduced-motion fallbacks, unavailable gallery and inactive invitations. Existing library, upload, tags, selection, storage, transfers, revoke, theme, 10k assets and responsive regressions pass. Browser runtime-error assertions are enabled.
- [Native read-only evidence](evidence/native-gallery.json): no visible collection named Preset Gallery; three suitable photos were returned. Their JPEG thumbnails fetched successfully at 5,577?8,553 bytes. No native media, identity or metadata write occurred.
- Dependency audit reports zero advisories across 438 dependencies. Secret scan checks the known private values without emitting them. See [verification receipt](evidence/verification.json).
- Visuals inspected: [receiver desktop](evidence/receiver-desktop.png), [mobile](evidence/receiver-mobile.png), [invitation](evidence/admin-invitation.png), [MFA](evidence/mfa-step.png), [photo badge](evidence/welcome-badge-static.png), [interactive badge](evidence/welcome-badge-webgl.png), [mobile fallback](evidence/welcome-mobile-fallback.png), [real API success](evidence/real-api-success.png).

## Limits and release boundary

The latest refinement adds privately stored, required profile photos and explicitly public administrator background uploads. See SETTINGS_REFINEMENTS.md for limits and tests. No public NAS gallery was exposed. Native image fetching was verified read-only, while browser library tests use synthetic assets. The invitation-native-provisioning flow has not been exercised with NAS writes. Actual Safari/Firefox engines and human acceptance remain unverified.

The admin copies and sends the link; there is no automated invitation email. Link recipients still need the existing approved AIA LAN/VPN connectivity. No public hostnames, Internet delivery, corporate federation or new recovery-code service were configured.

This is a coordinated **API + both frontends** candidate, not a CSS-only deployment. The additive registry migration creates `invitations`, adds `users.invitation_pending` (default zero for existing accounts), and advances schema version to 5 (including profile/background photo tables). Existing account credentials, native mappings, roles, transfer authorization and media data remain intact. MFA challenges are memory-only and must be retried after an API restart; invitation/setup state survives a normal API restart in the registry. Passwords are hashed and setup secrets encrypted. Pending accounts cannot authenticate.

No production promotion was performed. Before any future release, review this candidate and the schema change together, retain the pre-release registry backup and promote matching API/frontend images. The previous frontend-only promotion path must not mix old account-creation UI with the new invitation API. A source snapshot from before this task is kept under ignored `.local/react-bits/baseline/source.tar.gz`; it is not a production-data backup. For local rollback, stop the preview and restore only task-modified paths selectively from that snapshot, preserving unrelated work. Do not reset the entire worktree or restore a historical registry over subsequent user data.
