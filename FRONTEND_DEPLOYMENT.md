# Frontend deployment and rollback review

## 9 November - animation scope correction

Current live release **`lan-20261109-e3791678`**, application source **`9ab34be839c8911dd9e2f0f88ce447b3a0fa55d6`**, on GitHub `main`. Background motion defaults on and remembers manual off. The custom cursor exists only inside the fully signed-in workspace, with animations on; it is absent from login, signup/welcome and recipient pages. The real 3D lanyard is always enabled independently of that setting and OS motion preference; browser WebGL remains required.

48 NAS API/model tests, 40 browser workflows, optimized builds/typechecks, native verification, encrypted recovery and live HTTPS/component checks pass. All 3 accounts and credentials/MFA, valid sessions, profiles/config and 127 permanent file hashes remain unchanged. No account cleanup or reset. [Evidence](docs/motion-scope/evidence/receipt.json), [review](docs/motion-scope/REVIEW.md). Roll back images to **`lan-20261109-300a1131`** while retaining the current registry volume and master key.

The following entries describe earlier releases and their behavior at the time.


## 9 November - preview quality and motion fix

Previous live release: **`lan-20261109-300a1131`**, application source **`18f97c721798ca17fa721f69bddcda6ec8a15e23`** on GitHub `main`. Both existing HTTPS origins are healthy. Gallery cards now receive the same existing native preview bytes as the detail viewer, instead of enlarged thumbnails. Use **Animations: on** at the bottom right to explicitly enable the photo wall, mouse follower and 3D welcome badge when the OS requests reduced motion. Each origin saves its own browser preference. WebGL remains necessary for 3D.

Validation: 48 API/model tests and 40 optimized browser workflows pass; native comparison covers all five assets; deployed public API/photo-wall/cursor checks pass on both ports; actual NAS frontend/CSP/3D rendering and 2x gallery resolution pass using an isolated synthetic API overlay. This did not create a real account or live staff session. TLS was independently verified with the retained CA. All 3 existing accounts, credentials/MFA, profile/security records, valid sessions, runtime config and 127 permanent file hashes were preserved. An encrypted checkpoint was decrypted and SQLite-checked, and a private isolated rehearsal retained all accounts.

Rollback application images to **`lan-20261109-3a1d86a2`**, retaining the registry volume and master key. Do not restore an older registry or run account cleanup for this release. [Detailed evidence](docs/preview-motion/evidence/receipt.json), [review and operating limits](docs/preview-motion/REVIEW.md).

The following entries describe earlier deployments.


Previous rollout, 9 November 2026: **lan-20261109-3a1d86a2**, application commit `14173fd`, is deployed and healthy at the existing Media/Transfer HTTPS addresses. Registry migrated additively from schema 3 to 6. All 11 account records and valid sessions were preserved during promotion; the separate owner-authorized cleanup then removed 10 test accounts and 9 retired test sharing records, retaining only `admin` with its existing credentials and authenticator unchanged. All 127 permanent files, private runtime configuration and protected source-engine containers were preserved.

NAS build/typecheck and 48 API/model tests passed. An isolated registry-copy rehearsal, native preview/collection checks, independent encrypted-checkpoint decryption/SQLite validation, CA-verified HTTPS/static-asset/security checks and Chromium sign-in hydration passed. No authenticated owner browser walkthrough is claimed by the agent in this rollout. See [sanitized receipt](docs/nas-deployment/evidence/receipt.json) and [procedure and scope](docs/nas-deployment/REVIEW.md).

The immediate rollback image release is `lan-20261108-16a7b99c`. Image rollback must retain the current registry; restoring the account checkpoint would resurrect intentionally removed test accounts and requires a separate explicit recovery decision. Encrypted pre-rollout and pre-cleanup checkpoints and their private recovery configuration remain retained. No volume removal or automatic older-database restore is part of rollback.

The following dated entries describe the earlier 8 November deployments and their historical verification. Their Git/schema statements do not describe the current checkout or schema.

Status: **deployed on the owner-authorized LAN**, release `lan-20261108-16a7b99c`, source SHA256 `16a7b99cb6b6bcd1aaec6f72d6b8d16cb8a361e719fe07b5364a437a1bce6829`. API, Media and Transfer are healthy. Relevant automated/visual checks and isolated native verification passed before rollout. Human production acceptance remains open.

Post-deployment HTTPS checks used the retained private CA and verified both pages, all referenced static assets, the AIA logo, API health, anonymous staff/preview denial, cross-origin mutation denial and nonce CSP without unsafe-eval. Native ResourceSpace and authenticated Gokapi reads passed. All 121 permanent media/preview files matched; ResourceSpace, its DB, Gokapi and Caddy kept their container identities/start times. Registry schema is 3, staff role/session/MFA/native-identity records and private runtime configuration are unchanged. See [deployment receipt](docs/frontend/evidence/nas-deployment.json), [native verification](docs/frontend/evidence/native-verification.json), [HTTPS checks](docs/frontend/evidence/post-deployment-http.json) and [engine reads](docs/frontend/evidence/post-deployment-engines.json).

The verified source archive is immutable. Post-rollout evidence and handoff documents in this workspace were updated afterward; they do not change the installed application images.

Review `FRONTEND_UAT.md`, architecture, source notices and current test/build evidence before promotion. Re-run frozen install, typecheck, tests, build, format and secret scan against the exact release archive. Preserve private runtime configuration and registry encryption identity. Never archive `.local`, `.git`, `node_modules`, `.next`, native media or secrets.

The baseline rollback release identified during this task is `lan-20261108-e45cafcc`, source SHA256 `e45cafcc035f1ba66e78ccda4e340712983b21f5c8437bf64a080f17a328326d`. The pre-redesign local source archive is `.local/redesign-baseline/pre-redesign-source.tar.gz`. Verify the NAS current symlink, running image tags/digests and retained images again immediately before any rollout; this document is not live runtime identity proof. Git has no initial commit, so it cannot supply a reliable baseline checkout; existing uncommitted implementation files are preserved.

After automated/visual checks and isolated native verification, within the owner-authorized staged deployment scope:

1. Produce an immutable checksummed release using the existing release receiver, without changing private `app.env` or encryption keys. Record archive SHA256 and dependency lock hash.
2. Build only API, Media and Transfer images for that release with the existing Dockerfile/Compose. API is included for the compatible thumbnail/dimension and native collection bridges; no database migration is added. Record image IDs.
3. On the NAS, save the exact current release/environment references. With the existing private compose environment and ingress override, apply `docker compose ... up -d --no-deps api media transfer` from the reviewed release. Do not restart ResourceSpace, its DB, Gokapi or Caddy. Keep their volumes untouched.
4. Verify health plus real authenticated pages on both HTTPS origins, collection permissions, one approved share, recipient password/expiry/revoke, and a small temporary upload/resume using explicit test media. Confirm original checksums and transfer isolation. Health alone is insufficient. Inspect logs without exposing secrets.
5. Record the installed release/source checksum and UAT outcome. Keep previous images and release directory until acceptance and the normal retention window.

If any auth, preview, upload, share or role regression occurs, restore the **saved pre-rollout** compose release reference and redeploy only `api media transfer` with `--no-deps`, then restore the previous `current` symlink using the existing operator workflow. Do not roll back or delete registry/media volumes; endpoints are additive and no schema changes are introduced. Verify old authenticated pages and recipient delivery again. Do not run `down -v`, prune volumes, or use stale helper closures to select a release.

Rollback validation: the baseline local archive exists, the previous running image identities were recorded and all three previous image tags remain available. No schema/storage change was introduced; the encrypted online registry checkpoint was captured before promotion. A redesigned-production-to-baseline container rollback has **not** been executed. The rollback execution path has not been exercised by deliberately interrupting the working installation; no executed rollback pass is claimed.

The staged path is implemented by `scripts/deploy/stage-frontend-release.py`, `build-frontend-candidate.py`, `verify-frontend-native.py` and `promote-frontend-release.py`. All use framed operator input and immutable checksum references. Staging does not switch the live compose environment. The native test mounts no deployed registry, opens no listener, reads the existing owner's source identity through a read-only registry connection, and creates/removes only its uniquely named test collection through native APIs. Promotion requires that native/preservation receipt and matching image IDs, takes a private CMS-encrypted online registry checkpoint, changes only API/Media/Transfer and automatically restores the old application release on health/identity/preservation failure. It preserves staff security records, runtime config, source engines and permanent media checksums. These checkpoints are not an offsite backup claim or a reason to restore data during an ordinary UI rollback.

The first staged build was rejected by clean Linux typechecking because local generated Next.js declarations had masked plain CSS imports. Explicit app-level CSS declarations now make that dependency visible in source. The rejected candidate was never promoted. The immutable rebuilt candidate must pass all gates; no in-place edits or image-tag overwrite are used.

The owner unlocked Windows and signed in manually. The final live Chrome walkthrough verified the deployed four-asset library, native full-image previews, keyboard viewer navigation/dismissal, asset details/membership, Transfer history and the new-transfer composer. Private screenshots remain under `.local/frontend-qa/live-deployed/`; no new transfer or media mutation was submitted through this walkthrough. Wider stakeholder UAT remains open.

The walkthrough found that ResourceSpace has no `scr` rendition for the banner and returns a generic PNG file icon with HTTP 200. The corrected adapter selects an existing native rendition through `get_resource_all_image_sizes`, preferring `scr`, `pre`, `thm`, then `col`; it never falls back to the original. The banner now displays its actual `pre` image in both fullscreen and details. All four native previews were compared byte-for-byte against their selected rendition. The correction passed 25 API/model tests, all 12 optimized-build browser workflows and fresh NAS build/native/preservation gates before installation.

The immediate rollback release for this correction is `lan-20261108-0caea00d`; the earlier baseline `lan-20261108-e45cafcc` also remains retained. Correction receipts: [build](docs/frontend/evidence/preview-fix-build.json), [native verification](docs/frontend/evidence/preview-fix-native.json), [deployment](docs/frontend/evidence/preview-fix-deployment.json), [live browser scope](docs/frontend/evidence/live-browser-verification.json). All application containers are healthy; staff security/config and protected source engines were unchanged, and all 121 permanent files retained identical checksums. The generic file icon was source preview behavior, not an original-media change.
