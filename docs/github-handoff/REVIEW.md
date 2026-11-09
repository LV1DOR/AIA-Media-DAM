# Search fix and GitHub handoff

Prepared 9 November 2026 on `frontend/unified-ui-review` for `https://github.com/LV1DOR/AIA-Media-DAM.git`.

## Search behavior

The application used to wrap every multi-word pill in double quotes before sending it to ResourceSpace. That silently changed a pill into an exact-phrase search. `motogp 2026` therefore behaved differently from `motogp` plus `2026`.

The shared search builder now accepts the list of pills directly, combines their words and applies case/year normalization once. Pill boundaries have no search meaning. Names, tags and event words can match different searchable fields, while all entered terms must match. A standalone year still becomes an explicit year constraint. Existing metadata filters and collection scopes remain intact. Explicit quote marks typed by a user retain the existing phrase-search syntax; the application no longer inserts them around a pill.

Model coverage compares whole queries, individual words and mixed pill groupings for event/year, tags and multi-word names. Browser coverage checks `motogp 2026`, `Racing Circuit` and `Track day 2026` as single pills with actual filtered results. The optimized review preview independently returns 3,333 matches for a single `motogp 2026` pill in its 10,000-item synthetic dataset.

## Repository preparation

The remote was checked and contains no refs. This checkout also has no previous commits, so the requested commit is the initial application snapshot, including the existing Media/Transfer implementation and prior review changes. The development branch remains separate from any future production branch. The configured author uses the existing GitHub noreply identity.

The README explains the product, shows three screenshots, provides a working synthetic quickstart, describes the architecture and links operating/licensing documents. Its screenshots come from the local synthetic preview and public artwork. Historical evidence screenshots, including authenticator enrollment captures, remain local and are ignored by Git. Production keys, private configuration, database files, media and build output are excluded too.

No broad open-source licence is applied to owner branding or third-party components. Existing component notices and source provenance remain included.

## Verification and boundaries

- 47 API/model tests and 31 optimized Chromium browser workflows pass.
- Both application builds, typechecking, Prettier, secret scan and dependency audit pass.
- The refreshed preview passes a separate one-pill search check; the README screenshots were visually inspected.
- [Verification receipt](evidence/verification.json) records the local results.

No production deployment or current native NAS search verification is claimed. The previous read-only NAS attempt was unreachable. Preview gallery results are synthetic; production search continues through ResourceSpace's native indexed metadata and permissions. GitHub Actions has not run yet.

## Push when ready

```sh
git status --short
git log -1 --oneline
git push -u origin frontend/unified-ui-review
```

The commit is prepared locally; pushing is a separate action. No force push is needed. Neither committing nor pushing runs a production deployment workflow.

## Rollback

No schema or production data change is involved. For a later selective rollback, restore the previous string-based call in the workspace and its automatic pill quoting, along with the previous builder signature. That restores the old phrase behavior and its known limitation. Preserve the earlier ZIP, profile-photo and theme features. Do not reset the entire repository or production registry to undo this small search change.
