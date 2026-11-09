# Background, cursor and lanyard behavior

9 November 2026. This owner-requested correction supersedes the motion defaults in the preceding preview/motion rollout.

- Background motion defaults on, including when the OS requests reduced motion. The user's explicit on/off choice remains saved per browser and site.
- The animation toggle affects only the photo wall and custom mouse follower.
- The cursor component mounts inside the fully authenticated workspace, after password/MFA completion. Login, signup, welcome badge, recipient and loading/enrollment pages have no custom cursor. Logout unmounts the follower and its listeners immediately. Touch devices retain their normal interaction.
- The real Three.js lanyard always starts with full physics and interaction, independently of the toggle and OS preference. Toggling animations does not replace or remount its canvas. The renderer requests high-performance graphics; there is no lanyard-off control.

Browser WebGL support remains necessary. A website cannot enable a GPU disabled by browser/driver policy. Genuine renderer failures retain clear recovery guidance and Retry 3D badge, rather than trapping the recipient or claiming a static picture is 3D. Accounts and welcome completion remain usable if graphics fail.

Browser coverage verifies default moving rows, saved off/reload/on behavior, no public cursor, real password/MFA-to-workspace cursor transition, toggle disable/enable, logout removal, and the same live 3D canvas remaining mounted while animations toggle. Genuine no-WebGL fallback and chosen-photo texture coverage are retained. The deployed-component verification script exercises the same behaviors against actual deployed HTML/CSP/JS, with a separate synthetic API overlay for authenticated flows; no real staff sessions or account writes are used.

No identity, backend or original-media changes are included. Deployment must preserve all current accounts, security/profile records, valid sessions, configuration/key and permanent file hashes. Use an encrypted recoverable checkpoint and isolated registry-copy rehearsal; image rollback retains the live registry. Baseline before this correction: `lan-20261109-300a1131`.

## Verified deployment

Live release **`lan-20261109-e3791678`**, application source **`9ab34be839c8911dd9e2f0f88ce447b3a0fa55d6`**, rollback **`lan-20261109-300a1131`**. Deployed on the existing HTTPS origins. Both optimized builds and typechecking, formatting, secret scan, 48 NAS API/model tests and all 40 browser workflows pass, with zero skipped or flaky cases.

Actual deployed public pages on both ports were checked under OS reduced motion: background moves by default, explicit off is saved across reloads, and no custom cursor is mounted. The deployed frontend/CSP was also checked with an isolated synthetic API overlay: cursor appears only in the authenticated workspace, off hides it, and the real draggable/flippable 3D canvas remains mounted while the background/cursor setting switches. No production staff account or session was created. This is not an owner-browser/GPU walkthrough. Browser WebGL/graphics acceleration must be available.

All 3 current accounts, complete existing security/profile fields, valid sessions, original configuration/key and 127 permanent file hashes are preserved; native source engines were not restarted. Schema remains 6. An isolated registry copy and independently decrypted/SQLite-checked encrypted checkpoint verified recovery. No account cleanup or credential reset. [Sanitized receipt](evidence/receipt.json).

Repeat deployed-component verification with `node scripts/test/frontend-deployed-components.mjs --approved-deployed-frontend-test`; it uses a private ephemeral browser and loopback synthetic API overlay, no owner cookies. Verify TLS separately with the retained LAN CA. Screenshots and private test outputs stay in ignored `.local`.
