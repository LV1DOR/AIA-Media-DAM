# Frontend verification and human UAT

8 November 2026. Redesign branch `frontend/square-ui-redesign`; release `lan-20261108-16a7b99c` is installed at the existing NAS URLs. Synthetic tests exercise the real optimized Next.js UI with an isolated API double; they do not prove native storage, source permission configuration or physical media fidelity.

## Reproduce local browser checks

Use Node 22 and pnpm 10.14. Run `corepack pnpm install --frozen-lockfile`, then `corepack pnpm exec playwright install chromium` once. Run `corepack pnpm test:browser`. This builds both apps against loopback fixture port 4522, launches separate production-mode servers at 3210/3211, runs the tests in a clean headless Chromium profile, stops its servers and rebuilds with the normal API default afterward. It never loads staff credentials or connects to the NAS. Do not run competing fixture jobs on the reserved ports.

Workflow source: `tests/browser/workflows.spec.ts`. Structured result: [browser-results.json](docs/frontend/evidence/browser-results.json). Test screenshots are under `docs/frontend/evidence/`; Windows Chrome walkthrough screenshots are private under `.local/frontend-qa/`. Fixtures require `--synthetic-only`; they have deliberately simplified auth, upload and recipient state. Server security assertions remain in the separate API tests.

| Coverage | What is checked |
|---|---|
| Library | Rows/grid, masonry and list; 48-item paging; cross-page and Shift selection; native scoped year filter and text search; details, visible membership/Escape |
| Viewer | Keyboard next-image, captions, zoom beyond a fitted preview, thumbnails, Escape |
| Collections | Create from selection, rename, add existing members, remove membership without removing source asset, approved-member share dialog |
| Review | Pending queue, approval removes the item, metadata form and visible collection membership remain available |
| Roles | Marketer has no review/edit controls; transfer-only account gets library denial and can open standalone Transfer |
| Failure states | Empty search/library, source error, delayed loading skeleton and broken-preview fallback |
| Responsive | 1440x1000, 768x1024 and 390x844; no document horizontal overflow; mobile Sheet navigation; keyboard focus returns on dialog dismissal |
| Theme | Persisted light/dark setting and readable gallery/share surfaces |
| Sharing | Create a protected library share, wrong/correct recipient password UI, file link, confirmation/revoke, ended-link page and history |
| Temporary transfers | Standalone upload, abort/pause and resume through the saved native-shaped offset; no DAM upload request |

The browser tests exposed and fixed two timing issues: unchanged initial search debounce resetting a fast Next click, and the Pause button's browser default action resubmitting the reused form button after state changed. Pause now prevents that default and checks the abort signal before finalization. Large-preview zoom is allowed up to 3x preview pixels; it does not imply original-image resolution. All 25 API/model tests and 12 optimized-build browser workflows pass locally. Existing API tests still cover true ownership, CSRF, TOTP, password envelopes, expiry, quota concurrency, cleanup, offboarding and native upload semantics.

## Human acceptance after the staged LAN rollout

Use named marketer, reviewer and administrator test accounts, plus a transfer-only account, on the owner-authorized LAN deployment or an approved preview connected to the real services. Keep test media clearly identified. Do not declare production acceptance from the fixture suite.

1. Open the library with representative native JPEG/PNG, portrait/landscape photos, video and supported RAW previews. Check aspect ratios, broken-preview states, captions, keyboard focus, mobile sidebar and reduced motion. Compare gallery density and navigation with the cited Square UI Files reference. The premium Media Vault is inspiration only.
2. Search by title/keywords, year, event and championship; combine kind and metadata filters. Confirm native matches and page-scoped sort labels. Select across pages, Shift-select a displayed range, and verify the selected count and 100-item action limit.
3. Open details, edit permitted metadata/tags, upload a small authorized library sample for review, approve it, return it to pending and archive it using the existing workflow. Marketer and transfer-only attempts must be denied server-side as well as hidden in UI.
4. Create/rename a normal collection; add/remove selected membership; verify native write-denial feedback and reserved transfer collections. Confirm removing membership preserves the original. Share approved members, and manually select up to 100 when the collection is larger.
5. Share one approved asset and a selection with password, expiry and quota. Verify the recipient UI, streaming original download, wrong password, expired/revoked state and ownership in history. Native source private access must remain denied without the share's controls.
6. In standalone Transfer, upload permitted temporary test files, interrupt/resume in original order, finalize, download and revoke. Verify these temporary files did not enter ResourceSpace. Recheck duplicate Unicode filenames and the previously documented large-transfer behavior.
7. Check admin account creation/disable/reset and MFA setup with approved test accounts. No source keys or private native URLs should appear in page source, requests or UI.
8. Complete the production-build performance procedure in FRONTEND_PERFORMANCE.md with realistic media, actual device/browser and LAN conditions. Record console errors, browser memory and video codec limitations.
9. Review the recorded rollout and rollback images in FRONTEND_DEPLOYMENT.md. Complete stakeholder signoff before declaring production acceptance; public Internet launch remains separately deferred. Never replace retained volumes to roll back UI.

Record tester, role, date, browser/device, result and evidence for each item. Human marketing/reviewer/IT signoff and real-service redesign acceptance are still open; there is no blanket production-ready claim.


Native verification passed with the deployed owner's existing source identity in an isolated in-memory BFF: real thumbnail/full previews, dimensions, visible membership and collection create/rename/add/remove. Its uniquely named test collection was removed. The production registry was not mounted into that test. Post-deployment native engine reads and CA-verified HTTPS/anonymous-denial checks passed. Real-user marketing/reviewer/admin UAT is still required.

The owner unlocked Windows and signed in manually. Live Chrome verified the four-asset native library, banner full preview/details, viewer keyboard navigation/Escape, Transfer history and new-transfer composer. The discovered missing native screen rendition was corrected and verified after deployment. No new share/upload or metadata mutation was submitted during this final UI walkthrough. This is a limited live smoke check, not stakeholder signoff on all nine acceptance items above. See [live browser scope](docs/frontend/evidence/live-browser-verification.json).
