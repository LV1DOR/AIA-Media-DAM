# NAS application rollout

Owner-authorized rollout of the current application, including the sharing refinements, ZIP downloads, infinite gallery, shared cursor and durable account handling. The NAS starts from release `lan-20261108-16a7b99c`, registry schema 3, with 11 staff accounts.

The owner separately authorized removing all test accounts except the original `admin`. Deployment first verifies that the additive schema-6 migration preserves every existing account field and valid session. Test-account cleanup is a separate checkpointed maintenance operation after the new application is healthy. It revokes test sessions/shares, disables managed native identities through native APIs, removes the test app records and preserves the original administrator unchanged. Native user records that own media are disabled rather than deleted; permanent media is never removed by this cleanup.

## Gates

1. Package only committed source into an immutable checksummed archive. Build API, Media and Transfer candidate images without changing the live release.
2. Rehearse the registry migration against a private copy and verify administrator account creation in isolation. Verify native library previews/collections with an in-memory test registry and a disposable test collection.
3. Capture and verify an encrypted, consistent registry/config checkpoint. Keep the original master key and private recovery key outside Git.
4. Recreate only API, Media and Transfer. Preserve ResourceSpace, its database, Gokapi, Caddy, existing volumes and runtime configuration. Verify health, source file hashes, account fields, valid sessions and exact image identity; roll back the application images if a gate fails.
5. After the separate cleanup checkpoint, stop only the API for operator account cleanup and restart it afterward. Retain only `admin`; stop if the expected target inventory changes or native revocation is incomplete. Preserve the retained administrator's credential/MFA fields and test the clean final registry.
6. Verify both HTTPS entry points, assets, API authorization and native engine access. Record installed release, rollback identity and the distinction between isolated/native/HTTPS/browser checks.

The promotion helper requires an explicit expected schema for an additive migration. It compares all pre-existing account columns, including passwords and names, and preserves valid session rows. New tables/columns do not constitute an account reset. Rollback reuses the existing registry; it never deletes a volume or restores an older database automatically.

Private rollout receipts and encrypted checkpoints remain under the NAS `.private` directory and ignored local task storage. Sanitized final evidence is published after verification. The actual deployment result is recorded separately from this prepared procedure.

## Completed result

Release `lan-20261109-3a1d86a2` from application commit `14173fd` is installed and all three application containers are healthy. Registry schema is 6. The 10 test accounts and 9 retired test sharing records are removed; only `admin` remains, with its password, authenticator and native mapping unchanged. The owner confirmed they can use the current credentials. The old first-login handoff password is historical and was not used to reset the account. All 127 permanent files and source-engine identities/start times match the pre-rollout checkpoint.

Both HTTPS entry points and referenced assets passed verification with the retained private CA. Anonymous staff/library/photo access and cross-origin mutations are denied. Isolated Chromium verified hydrated sign-in forms, the public photo wall, mounted cursor and no signed-out private-library requests, with zero page errors. TLS was verified separately; the isolated browser context used its own certificate exception. Native authenticated preview/collection verification used an in-memory test registry and disposable collection; production-authenticated owner UI acceptance remains separate.

See the [final receipt](evidence/receipt.json). Private encrypted backups and full receipts remain on the NAS and under ignored local operator storage.
