# Unified UI review — 9 November 2026

Prepared on `frontend/unified-ui-review`. The stable NAS release remains `lan-20261108-16a7b99c`; this change has **not** been deployed. Owner visual review and disposable native-write acceptance are required before promotion.

Run `corepack pnpm preview:review`. Open http://127.0.0.1:3310 and choose **Transfers** in Media navigation. The launcher prints the standalone receiver link and also serves the independent Transfer compatibility app at http://127.0.0.1:3311. This is an optimized, loopback-only staging preview with explicit synthetic data and no NAS connection. Tag/upload/share changes affect only the in-memory fixture. Stop with Ctrl+C (or send `stop` to the launcher's stdin). Restarting resets fixture changes. Separate `.next-review` output preserves normal builds.

## Owner refinements - 9 November 2026

The receiver no longer shows the download-only disclaimer, AIA TRANSFER label or footer/tagline. Inactive links say **This sharing link is inactive.** All download access controls remain enforced. The dashboard Transfers design is deferred for later references and was not redesigned again.

The Review page and manual approval controls are removed. Completed library uploads publish automatically after native file processing and metadata finish. Legacy pending records and review notes are not rewritten or deleted; old notes are hidden in app metadata. Only live/archived lifecycle states remain exposed. Existing `reviewer` account IDs remain compatible, displayed as Media editor. See [ADR 002](../decisions/ADR-002-NO-REVIEW-WORKFLOW.md). Native automatic-publication acceptance on disposable source records remains a deployment gate; no production upload or metadata mutation was performed in this refinement.

## Delivered behavior

- A checkbox enters selection mode; card/image clicks toggle selection until Done/Escape or the last deselection. Nested tag/viewer/menu actions stay independent. Shift ranges follow current ordering, selection is capped at 100, and Select page states its loaded scope. Collection cards retain normal navigation and subtle local focus/hover emphasis; no unsupported bulk collection actions were invented.
- Media editor/admin tag icons open a searchable Radix Popover, with a mobile Dialog Sheet fallback. Existing tags are removable chips; cmdk searches canonical options. New nodes go through native `set_node` permission checks. Bulk Add/Remove preserves unrelated tags and metadata, resolves per asset, shows progress/failures and retries only failed assets. Single replacement requires matching original tags. Native `update_field` receives node IDs and retains its resource/field permission checks. Writes through this service are serialized; other native clients remain outside this lock and native updates are not atomic/CAS.
- Championship is absent from the UI filter menu. Its stored field, details and backend search support remain intact.
- Complete owner UsageMeter TSX, actual Arc CSS module and motion tokens are integrated in the existing shared component directory, with separate synthetic demo. The sidebar opens a detailed meter above Settings. An admin-only, read-only `/api/storage` measures the filesystem backing the configured application data directory: used/reserved and available space, including other files on that filesystem. It is not a DAM/Gokapi sum or quota. No category breakdown or owner warning policy is invented. Unsupported measurements show Usage unavailable; there is no polling loop.
- Media Transfers uses the same shell and navigation, with inline upload/expiry/password controls, retained pause/resume, real recent history, known registry byte totals and source icons. Unknown source size is omitted rather than guessed. View all stays in the same section. The independent Transfer service remains compatible under the hood.
- Public receiver uses the exact supplied background, a mostly opaque frosted card and in-card identity. Public access remains share-scoped, with individual downloads, password/expiry/revoke behavior and Download All issuing the same authorized individual requests. Browsers may require multiple-download permission; this is not a ZIP or a bypass of per-file download-start limits.

## Verification and evidence

Actual final results: **30 API/model tests passed; 20 browser workflows passed, zero failed/skipped/flaky; both normal production builds and both isolated review builds passed.** Typecheck, format check and secret scan passed; dependency audit reports zero vulnerabilities across 429 dependencies. The existing secret scan checked ten retained private values without printing them. The isolated review preview was also opened in fresh Chromium: Library, integrated Transfers and the receiver rendered without JavaScript errors, with requests only to `127.0.0.1`.

The final verification receipt is [verification.json](evidence/verification.json); browser results are copied into this evidence folder. The suite covers the existing security/transport contracts plus automatic upload publication/cleanup, rejection of legacy review states, retained native review-note data, tag authorization/canonicalization/conflict/concurrent-addition/partial failure and real local `statfs` behavior. Browser tests cover card mode/nested actions/Escape, tagging and retry, storage refresh/unavailable, upload pause/resume, share password/revoke, invalid/expired/slow receiver, all three Download All requests, and 10,000 assets with a bounded 48-card page. Every browser case asserts no JavaScript page errors. Prettier is the repository's existing style check; there is no separate ESLint configuration or remote CI claim.

Screenshots use synthetic data at 1440, 768 and 390 pixels. Examples:

| State | Desktop | Tablet | Mobile |
|---|---|---|---|
| Selection | [1440](evidence/selection-1440.png) | [768](evidence/selection-768.png) | [390](evidence/selection-390.png) |
| Tag editor | [1440](evidence/tag-popover-1440.png) | [768](evidence/tag-popover-768.png) | [390](evidence/tag-popover-390.png) |
| Bulk tags | [1440](evidence/bulk-tags-1440.png) | [768](evidence/bulk-tags-768.png) | [390](evidence/bulk-tags-390.png) |
| Storage | [1440](evidence/storage-1440.png) | [768](evidence/storage-768.png) | [390](evidence/storage-390.png) |
| Transfers light | [1440](evidence/transfers-light-1440.png) | [768](evidence/transfers-light-768.png) | [390](evidence/transfers-light-390.png) |
| Transfers dark | [1440](evidence/transfers-dark-1440.png) | [768](evidence/transfers-dark-768.png) | [390](evidence/transfers-dark-390.png) |
| Receiver | [1440](evidence/receiver-1440.png) | [768](evidence/receiver-768.png) | [390](evidence/receiver-390.png) |

The same folder includes Library, Collection hover, revoked receiver and password screenshots at all three widths. Contrast of the selection bar is asserted at least 4.5:1; storage popover bounds and page overflow are checked. Visual inspection caught and corrected low-contrast selected actions, a clipped mobile storage popover and a wrapping Select files affordance. The 10k short-run JS heap evidence is [large-gallery.json](evidence/large-gallery.json); this is not a real photography throughput, total browser/GPU-memory or indefinite leak claim. Keyboard and accessible roles/focus were checked; no physical screen-reader user acceptance is claimed.

## Sources and remaining gates

Arc UsageMeter is MIT, with the full notice at `packages/ui/licenses/ARC-USAGE-METER-MIT.txt`. The supplied TSX remains intact as an original reference; runtime changes are relative imports, filesystem capacity wording and scoped theme mapping. Added exact dependencies are motion 14.10.1, cmdk 1.1.1 and Radix Popover 1.3.1 (MIT notices retained). See [provenance](evidence/component-provenance.json) and the root component-source inventory.

[Aceternity Focus Cards](https://ui.aceternity.com/components/focus-cards) behavior and [licence](https://ui.aceternity.com/licence) were inspected. Direct registry retrieval returned HTTP 403. No unavailable source code, demo photos or MIT claim is fabricated. The original local CSS adaptation keeps masonry and collection cards, uses small local shadow/scale/overlay emphasis, leaves siblings sharp and suppresses scale during selection/reduced motion. Genuine Focus Cards source import remains an explicit upstream limitation, permitted by the specification's unavailable/incompatible-source fallback.

Native read-only inspection verified Keywords field 1/type 9 and installed `get_edit_access`, `set_node` and `update_field` behavior. No production tagging write was performed to make tests pass. Before deployment, validate tags against disposable records in an approved isolated native staging environment, including restricted fields/new-node denial/concurrent external edits. Repeat upload/resume/share/download acceptance with representative real media and named roles. Owner design signoff, physical screen-reader testing, realistic multi-user performance and human UAT remain open. No production-readiness claim is made from fixtures.

The real read contract was exercised against the installed source: canonical node options resolve current values and native edit access is true for the existing owner source identity. See [native read contract](evidence/native-tag-read-contract.json). This does not claim a native tag write or node-creation test.

Read-only NAS checks show the same three healthy application image IDs and stable release. All 121 files from the previous checkpoint still match, with no removed or changed baseline files; six additional JPG/PNG files now exist since that older checkpoint. They were not attributed to this task or removed. See [preservation](evidence/production-preservation.json) and [delta classification](evidence/production-file-delta.json).

## Rollback and deployment boundary

Primary changed files are the shared Workspace/upload/receiver in `packages/ui/src/index.tsx`, gallery and sidebar components, new `tag-editor.tsx`, `storage-meter.tsx`, complete `components/ui/usage-meter.tsx` and its utilities/demo, and scoped `unified.css`. Narrow API changes are in `services/transfer-api/src/tags.ts` and `app.ts`, with an optional known byte total in the Transfer contract. Preview build isolation, a loopback launcher, regression fixtures/tests and notices accompany them. [Exact file inventory](evidence/changed-files.json) compares against the preserved pre-change archive; it records no removed source files.

The stable installation was untouched, so rollback of this preview is to stop the launcher; no NAS restore, volume replacement or data rollback is needed. The entire pre-change source and original Git status are preserved in `.local/unified-ui/baseline/source.tar.gz`, `sha256.txt` and `git-status.txt`. Git has no initial commit, so a branch name alone is not a reliable rollback. Preserve any later work before restoring.

For an out-of-tree baseline inspection, from the project root run:

```powershell
New-Item -ItemType Directory -Path .local/unified-ui/rollback-inspection
tar -xzf .local/unified-ui/baseline/source.tar.gz -C .local/unified-ui/rollback-inspection
```

Compare the archive SHA256 with `.local/unified-ui/baseline/sha256.txt` first. Use a new empty destination; do not overlay the worktree or run reset/clean. The archive excludes runtime secrets, dependencies and generated builds. Install frozen dependencies in an isolated checkout when running the baseline.

Production promotion is a separate owner-approved step after the native-write and human review gates. It would require immutable API/Media/Transfer images because the new tag/storage routes and byte-total projection are additive API changes, with no database migration or source-plugin change. Retain the current `lan-20261108-16a7b99c` release/images and private runtime configuration. If promoted later, use the existing guarded application-only rollback workflow; never replace native/registry volumes to roll back UI.
