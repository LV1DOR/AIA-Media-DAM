# Infinite gallery and persistent review accounts

Prepared 9 November 2026 on `feat/infinite-gallery-persistent-accounts`. No production deployment or NAS data change was performed.

## Why accounts disappeared

The previous local review authentication service used `new Store(":memory:")` and generated a fresh encryption key at every startup. Stopping the preview destroyed those accounts. The next start found an empty registry and created only its bootstrap administrator. This was a property of the synthetic review launcher, not a frontend requirement. Earlier in-memory records are not recoverable after their process has exited. Before replacing the currently running old service, a read-only administrator listing confirmed that it contained only the original administrator and no pending accounts.

The production Compose configuration already mounts the registry at `/data` in the persistent `registry` volume. UI rebuilds do not delete that volume. This task does not claim a current NAS inspection or move production accounts into the local review environment.

## Account lifetime now

The review authentication API uses a durable SQLite registry and a stable 32-byte encryption key, separate from the media fixtures and outside the source checkout. The default Windows directory is `%LOCALAPPDATA%\AIA-Media\review-identity`; other platforms use `$XDG_DATA_HOME/AIA-Media/review-identity`, or `~/.local/share/AIA-Media/review-identity`. `AIA_REVIEW_IDENTITY_DIR` may explicitly override this for isolated tests or an approved operator location. It never reads NAS credentials. The binding remains loopback-only.

Accounts, password hashes, profile photos, invitations, in-progress invitation enrollment, MFA secrets and sessions persist across service restarts. Valid sessions retain their original expiry; persistence does not make sessions permanent. The bootstrap creates the administrator only for an empty registry. A changed bootstrap password does not overwrite an existing account.

Keep both `registry.sqlite` and the original `master-key`. Never delete or regenerate the key as routine troubleshooting. Missing keys for existing databases cause startup to fail. The API also verifies an authenticated encrypted key marker, including checks of legacy ciphertext before establishing the marker, and rejects mismatched keys. It does not reset users on failure. Schema 6 adds only the key marker and per-user consumed-TOTP-step tables.

The gallery/collection/transfer fixtures still reset on preview restart. They contain synthetic data, not staff identity records. The shared frontends call the dedicated authentication API; identities do not live in frontend builds or browser storage. The local bootstrap remains an explicitly documented demo account, with the existing admin-MFA exemption limited to this loopback synthetic preview. Production requires its private bootstrap configuration, HTTPS cookies and administrator MFA. Do not publish the review service or treat its demo password as a production credential.

## Login security review

Existing controls were retained and exercised: salted scrypt password hashes, constant-time password comparison, opaque hashed server sessions, expiry/session-version checks, HttpOnly SameSite cookies, Secure cookies in production, allowed-origin checks on mutations, request-rate limits, generic sign-in errors, invitation expiry/single use, required photo/password policy, MFA before access, and disabled-user/session rejection. Sensitive credential bodies and cookies are redacted from configured API logging. Client code receives no native service keys.

Accepted authenticator time steps are now consumed atomically in SQLite. A code cannot be reused to obtain another login, including after an API restart. After using a code for enrollment or sign-in, wait for the authenticator's next code before signing in again. A short-lived password-first MFA challenge can expire on a service restart; start sign-in again in that case. This does not delete the account or its authenticator setup.

This is a source-and-test review, not a penetration-test certification. It does not claim protection against a compromised server, an administrator deleting the identity directory/volume, lost keys, storage failure or every external attack. Durable storage still needs a recoverable backup.

## Infinite gallery

The API retains bounded 48-item native pages; the UI removes page navigation and loads the next group near the bottom. Grid, masonry and list rendering reuse the existing gallery. Users can turn off automatic loading and use Load more; errors provide an explicit retry without discarding the preceding results. A short or empty group ends automatic loading even if an older total is stale.

Each visited group has a measured height placeholder. Groups outside the viewport/overscan release their image DOM and asset metadata and refetch on return; the first seed group remains available. Only small height records and ID ownership for duplicate suppression accumulate with browsing. Selected asset details are retained separately under the existing 100-item selection limit. This is windowing by group, not keeping every thumbnail mounted. Keyboard focus pins its group until focus leaves. Requests are aborted when a window leaves, the query changes or the component unmounts. Appending has an in-flight guard to avoid duplicate observer/button advances.

Search/filter changes reset the feed and stale first-page responses are ignored/aborted. Selection and fullscreen navigation use the currently rendered groups; selection survives scrolling away and back. Sort controls explicitly sort within each group, matching the native paging contract. The native library can change while someone scrolls; this is not a frozen database snapshot, and refreshing reruns the query.

## Verification

Both optimized builds, typecheck, Prettier, dependency audit and secret scan pass. **48 API/model tests and 34 browser workflows pass**, with no failed or flaky browser checks. The [receipt](evidence/verification.json) records final checks. Browser coverage includes repeated automatic scrolling, bounded mounted cards with 10,000 synthetic assets, offscreen release, restoring selected cards on return, search reset, result end and failed-batch retry, alongside existing upload, share, tag, responsive and authentication flows. The new persistent-identity test uses the actual API and file-backed registry across multiple restarts to check accounts, pending/enrolling invitations, private photos, sessions, stable bootstrap credentials, wrong/missing keys and TOTP replay rejection. An additional [process restart proof](evidence/auth-process-restart.json) starts and stops the actual review authentication entry point against an isolated directory.

## Backup, deployment and rollback

For a local review identity backup, stop the preview/authentication service cleanly and copy its entire identity directory to a private protected destination. Include the original key and any SQLite WAL/SHM files; copying a live SQLite file alone is not a consistent backup. Restore the stopped directory as a unit. Do not upload it to Git or mix it with a different environment. Production uses the existing registry backup/restore runbook and its original private master key; never remove the registry volume as part of a frontend update.

The running local preview uses the durable store after this change. Production is unchanged. Deployment must retain the existing volume and key and capture a consistent registry backup before applying the additive schema update. A code rollback must preserve this durable local authentication launcher; restarting the old in-memory launcher would show a separate empty demo store again, rather than the saved accounts. Do not delete the persistent directory to roll back gallery behavior. Restore the previous gallery/navigation code selectively if needed; retain private identity storage and the existing encryption key.
