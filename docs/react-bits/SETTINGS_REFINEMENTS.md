# Signup, MFA and public-background settings refinements

Implemented on `frontend/unified-ui-review`, for local review only. Production and NAS source media are unchanged.

## User-facing changes

- Removed the login WELCOME TO AIA MEDIA label and centered the staff-access/contact notice.
- Renamed Badge photo to **Profile photo** and made it mandatory for new invitation signups. The API also requires a valid saved photo before starting/completing enrollment. Photos are now stored privately and survive ordinary API restarts, rather than existing only in the browser.
- New passwords, own-password changes and administrator resets require **8?128 characters, an uppercase letter, a number and a symbol**. The same policy is applied by the API and form validation. Existing passwords continue to sign in; the installation bootstrap credential is unchanged.
- Centered CodeSlots in signup and sign-in. Empty/filled boxes are dark grey and typed digits are white. Rejected codes clear, refocus and remove old digit glyphs after their exit animation.
- Removed the welcome-keepsake paragraph and the small text below AIA MEDIA on the badge face. The drag/swing/flip instruction is centered and bold.
- Added **Settings ? Background photos** for administrators. Upload photos to publish them on login/signup, or remove them. The admin invitation form stays plain; the receiver background stays unchanged.

## Profile and background photos

These are separate image stores. Uploading a private profile photo never publishes it as a background. Public background uploads are an explicit admin action and are labeled public in Settings. No private NAS collection or original is exposed or copied automatically.

Profile photos: JPEG/PNG/WebP, up to 5 MiB and 24 megapixels, normalized to a 512-pixel WebP portrait. Reading the profile-photo endpoint requires the authenticated owner. New invitations require a profile photo; existing active users remain usable without being forced through signup again. An old unfinished enrollment without a photo needs a fresh invitation.

Background photos: up to 12 JPEG/PNG/WebP uploads, 8 MiB and 24 megapixels each. The API checks binary file type and decodes the image, removes metadata, and resizes to at most 1200 ? 900 WebP. Normalized background images are capped at 1 MiB. Animated formats are rejected; decoding is bounded to two concurrent operations. Private profile images are never returned by public background routes. Removing a public image makes its URL return 404; empty/unavailable custom settings use the default public photo tiles. Already downloaded public images may remain visible in an open tab until it reloads.

The existing `sharp` 0.35.5 resolution is now a direct API dependency. Its Apache-2.0 notice is retained under `services/transfer-api/licenses/sharp.txt` and native dependency notices remain installed.

## Persistence and release

The additive schema-5 migration creates `profile_photos` and `background_photos`, containing normalized image blobs in the application registry. Existing account/password, native identity, transfer and permanent-media records are preserved. Current registry backups include these new rows. The preview deliberately uses an in-memory synthetic registry, so restarting that preview clears its test uploads/accounts; file-backed registry persistence is separately tested.

This candidate requires matching API and frontend images and the schema migration. It has not been promoted. Retain the reviewed registry backup before any future release; do not blindly overwrite a newer registry with an old backup. For local rollback, revert only the files in the receipt and restore the earlier UI while retaining unrelated work. Avoid mixing the old password/photo setup UI with the new API requirement. No automatic invitation emails, native photo publishing, public hostnames or corporate sign-in were introduced.

## Validation

Frozen install, both optimized builds, workspace typecheck, Prettier, **42 API/model tests**, **26 browser workflows**, actual-API review workflows and the known-secret scan pass. Dependency audit reports zero advisories across 438 dependencies. See [verification receipt](evidence/settings-refinements.json) and [actual API browser evidence](evidence/settings-browser-real-api.json). The browser proof uses synthetic accounts, a synthetic portrait and existing approved public artwork; it performs no production writes.

The proof checks admin upload ? signed-out custom-photo display ? admin removal ? default fallback, forbidden non-admin settings access, required photo validation, an eight-character complex password, no staff session before TOTP, private stored-photo access, visible white partial digits, centered code input and bold centered lanyard instructions. File-backed registry reopen, invalid/SVG images, upload size limits, publication limits and permissions have API/model tests. Actual Safari/Firefox and deployment on the NAS are not verified by this local run.

Screenshots: [public photo settings](evidence/settings-public-photos.png), [mobile public background](evidence/login-public-photos-mobile.png), [typed signup code](evidence/signup-white-digits.png), [typed sign-in code](evidence/mfa-visible-digits.png), [updated lanyard](evidence/profile-lanyard-updated.png).

Main files: contracts password schema; shared UI/index and CSS; invitation setup, MFA, success/badge generator, sign-in background and new background-settings component; API app/store and new backgrounds image routes; API/model/browser tests and synthetic preview transport. Native smoke scripts were adapted for the required synthetic profile upload but were not executed against the NAS.
