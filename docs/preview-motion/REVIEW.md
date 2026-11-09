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

Deployment must preserve **both current accounts**, all stored identity/security fields and valid sessions, profile/background images, master key, source engines and permanent media hashes. No account cleanup or credential reset is authorized or needed for this follow-up. Use an encrypted recoverable registry checkpoint and isolated copy rehearsal before promotion. Roll back application images to the previous release while retaining the existing registry volume and original key; never restore an old database as routine rollback.

Final verification and immutable release details will be recorded after promotion. Local screenshots and any private/native data stay ignored under `.local`; public documentation contains no owner photos or credentials.
