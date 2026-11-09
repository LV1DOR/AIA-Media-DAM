# Component and navigation review

Prepared 9 November 2026 on `frontend/unified-ui-review`. These changes are local and have not been deployed to the NAS. The checkout has no initial commit; existing staged and untracked work is preserved.

Open **http://127.0.0.1:3310** for Media or **http://127.0.0.1:3311** for Transfer on this computer. Local synthetic administrator: `admin` / `synthetic-review-admin-only`. These credentials belong only to the ephemeral review environment. Restart with `corepack pnpm preview:review`; restarting resets synthetic accounts and data. Use Settings > Staff to create an invitation and test password/photo/authenticator enrollment.

## Changes

- Settings keeps the same centered position and height across tabs. Its content scrolls inside the dialog.
- Saved private profile photos appear in the sidebar, account settings and administrator staff list. Accounts without a photo retain initials. A new authenticated photo endpoint permits only the owner or an administrator; anonymous access and other staff are denied. Responses use `no-store`.
- Actual beUI AttachmentUpload replaces the green upload surface in both library uploads and temporary transfers. Selection, raster previews, removal and retry are connected to existing upload APIs. Progress reflects actual requests; temporary uploads reach completion only after server confirmation. Retries skip completed library files and preserve transfer chunk resume offsets. There are no simulated completion timers or fake audio playback. Other attachment types use file tiles.
- Actual beUI MorphingSearchChips drives library queries through the existing native search/filter adapter. Suggestions use assets already available to the user; recent terms are stored under a per-user browser key. Chips can be removed and cleared. Existing filters, paging and selection remain connected.
- Actual UI Arc PasswordStrength is used when choosing or resetting account passwords. Its four rules match the existing server policy: 8-128 characters, uppercase letter, number and symbol. Existing sign-in credentials are unaffected.
- The desktop sidebar begins collapsed, with centered icons and a legible circuit mark. Hover opens it; leaving closes it. Account/storage popups keep it open while used. Keyboard focus opens it too; the mobile navigation trigger remains available. Expansion overlays the workspace without shifting the gallery.
- Actual React Bits VariableProximity animates the Download All label using a locally hosted Roboto Flex variable font. Download authorization and request behavior are unchanged.

The plain administrator invitation form, private gallery boundary, admin-managed public background photos and prior login/signup refinements are preserved. Public background management accepts separate deliberate uploads; it never exports private library media.

## Verification

- Both optimized frontends build. Workspace typechecking, Prettier, secret scan and dependency audit pass (zero reported vulnerabilities in the captured audit).
- **42 API/model tests pass**, including own/admin photo access, anonymous denial and denial to another non-administrator.
- **30 optimized browser workflows pass**, with no asserted runtime errors. Coverage includes fixed settings bounds across tabs, hover/collapsed sidebar geometry, search chips affecting results, idle selection without fake progress, nested preview focus restoration, partial upload failure/retry without duplicate completed files, temporary pause/resume, authorized downloads, 10,000 synthetic assets and responsive views at 1440, 768 and 390 pixels.
- A separate optimized-browser run uses the **actual API authentication, invitation, photo and background handlers** with an ephemeral synthetic registry. It verifies all three profile-photo locations, the password meter's four satisfied rules, mandatory photo, TOTP before session creation, private photo access and administrator public-background upload/removal. [Receipt](evidence/settings-browser-real-api.json).
- Screenshots were inspected for the collapsed rail, upload retry, morphing search, receiver label and real profile-photo settings. [Evidence](evidence/verification.json), [component provenance](evidence/component-provenance.json), [browser results](evidence/browser-results.json).

This is local Chromium and synthetic media verification. No current-task native ResourceSpace/Gokapi upload, NAS deployment, Internet delivery, other browser engine or human acceptance is claimed. The local review delegates authentication to real API handlers but substitutes synthetic gallery and native provisioning data. Private production data and backend engines were not modified. Schema remains 5.

## Sources and rollback

The supplied search/password source files and official registry supporting files are retained as adapted components. Licenses and SHA-256 hashes are recorded in [provenance](evidence/component-provenance.json), [component sources](../../COMPONENT_SOURCES_AND_LICENSES.md) and [third-party notices](../THIRD_PARTY_NOTICES.md). The only new npm dependency is `@floating-ui/dom` 1.7.6. React Bits retains its MIT + Commons Clause terms; the font uses OFL-1.1.

The source snapshot immediately before this task is `.local/components-polish/baseline/source.tar.gz`. To abandon these changes, stop the local preview, compare that snapshot and selectively restore this task's changes while preserving unrelated work. Do not reset the entire uncommitted checkout. No production rollback is required because there was no deployment; the new photo endpoint requires no schema migration. Stop the preview with Ctrl+C or `stop` on its console.
