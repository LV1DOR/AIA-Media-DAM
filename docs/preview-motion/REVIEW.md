# Library preview quality and NAS motion follow-up

9 November 2026. Owner authorized implementation, GitHub publication and NAS deployment. The previous live release is `lan-20261109-3a1d86a2`.

## Findings and changes

The library requested ResourceSpace `thm` renditions (typically around 180 pixels) even for large gallery cards. The enlarged viewer already requested the existing screen/standard preview. Gallery cards now use that same authorized preview endpoint with `size=scr`. The API still selects only an existing native rendition, does not generate or rewrite media, and never falls back to originals. Lazy loading, bounded infinite scrolling and untouched original downloads remain in place. A low-resolution source cannot acquire additional detail through this change.

An isolated browser against the actual old NAS build showed moving rows, visible cursor and available WebGL with `no-preference`. Switching to OS reduced motion reproduced static rows and the missing cursor; source inspection confirmed the same preference deliberately substituted a static welcome badge. This reproduces the reported combination, but the owner's actual browser preference/GPU could not be inspected because desktop browser access was unavailable.

A saved **Animations: on/off** control now controls all three components consistently. The initial setting follows the OS; an explicit browser-local choice overrides it and survives reloads. Changes also propagate across tabs on the same origin. Media and Transfer have separate origins, so each saves its own choice. The follower keeps its faster movement, idle pause, mouse-only behavior and click-through overlay. Motion preferences no longer tear down its pointer listeners during a setting change.

The actual Three.js lanyard, badge textures, drag/flip physics and resource cleanup are retained. Browser graphics failures now show guidance and a retry instead of silently leaving an unexplained card. No application can enable browser-disabled WebGL remotely; graphics acceleration must be available. Private gallery photos remain private; signed-out pages continue to use only approved public artwork/background uploads.

## Verification and deployment gate

Meaningful coverage includes gallery sharpness at 2x display density without original-download requests; saved OS-motion override, reload and stop/start behavior; an actual rendered WebGL canvas with loaded textures and drag/flip; reduced-motion restoration of the 3D badge; and no-WebGL guidance/fallback. Existing search, upload, receiver, infinite-scroll, authentication and responsive workflows remain in the browser suite.

The native NAS candidate test additionally compares gallery-preview bytes with the detail preview and the selected native rendition for every current asset, using an isolated in-memory registry. It does not authenticate as an application owner or create a live staff session. Only its uniquely named disposable native collection is changed and removed.

Deployment must preserve **all current accounts**, all stored identity/security fields and valid sessions, profile/background images, master key, source engines and permanent media hashes. No account cleanup or credential reset is authorized or needed for this follow-up. Use an encrypted recoverable registry checkpoint and isolated copy rehearsal before promotion. Roll back application images to the previous release while retaining the existing registry volume and original key; never restore an old database as routine rollback.

## Completed rollout

Live release **`lan-20261109-300a1131`**, application source **`18f97c721798ca17fa721f69bddcda6ec8a15e23`**, previous/rollback release **`lan-20261109-3a1d86a2`**. Both sites remain at https://192.168.250.80:8443 and https://192.168.250.80:8444. All application containers are healthy. **All 3 current accounts** and their existing security fields, profiles and valid sessions were retained. The inventory grew from two to three accounts during preparation; a checkpoint guard detected the change and was refreshed before proceeding. No accounts were removed or credentials reset. All 127 permanent hashes and protected engine identities/start times stayed unchanged.

Both local and NAS optimized builds/typechecking, 48 API/model tests, formatting and secret scan pass. All 40 browser workflows pass with zero skipped, flaky or failed cases. Native checks confirmed gallery/detail/native-preview byte equality for every current asset; the first asset's small thumbnail was 6,880 bytes versus its 31,703-byte screen preview. The recoverable encrypted checkpoint contains all three accounts and configuration, verified by decryption and SQLite quick_check with temporary plaintext removed. Schema stays at 6.

Live HTTPS checks verified TLS with the retained CA, all 34 static assets across both origins, API health, anonymous library/profile denial, origin enforcement and nonce CSP. An isolated Chromium browser confirmed the actual public photo wall moves, the cursor appears and the override survives reloads on both ports. The actual deployed frontend and its CSP also rendered a draggable/flippable Three.js lanyard and high-density gallery, using a throwaway loopback API fixture intercepted only in that browser context. This is a deployed-build graphics check, **not** an authenticated owner-account walkthrough. The owner's actual Windows browser/GPU remains uninspected; if it disables WebGL, enable browser graphics acceleration and use the retry.

Repeat the read-only public/deployed-component checks from the repository root with `node scripts/test/frontend-deployed-components.mjs --approved-deployed-frontend-test`. This uses only an isolated headless browser, its own local fixture, synthetic photo and no owner cookies. The browser certificate exception is restricted to that context; verify TLS independently with the retained CA. Screenshots/results remain under ignored `.local/nas-deploy`. See [sanitized receipt](evidence/receipt.json).

Local screenshots and any private/native data stay ignored under `.local`; public documentation contains no owner photos or credentials.
