# Sharing dialog polish and NAS source pull

9 November 2026 follow-up on `main`.

- Removed the originals sentence beneath the library asset count; the secondary label is now simply “From Library”.
- Made the selected-library-assets card and its icon neutral grey in light and dark themes.
- Renamed both download-limit labels to “Downloads allowed”.
- Included the preceding owner-requested cursor speed adjustment: dot 0.30, ring 0.18.

Both optimized review frontends build; workspace typechecking, formatting and secret scanning pass. A browser check against the optimized local review verified a three-asset selection, the removed sentence, editable new label, neutral light/dark card colors and zero page errors. See the [receipt](evidence/verification.json). The deployment helper is syntax-checked and its fast-forward bundle pull is exercised locally before use.

## NAS source update

The inspected NAS has no host Git executable or Git checkout. Its applications run from an older immutable release. A source pull is separate from building or promoting a running release.

`scripts/deploy/pull-source-checkout.py` accepts an explicitly authorized, checksummed Git bundle of the pushed `main` commit through the existing pinned-host SSH transport. A digest-pinned Git helper container performs a fast-forward-only pull into `/volume1/docker/aia-media-ecosystem/source`, with the GitHub URL retained as `origin`. The helper has no network access and mounts only the checkout and bundle. It refuses dirty/wrong-branch checkouts and does not copy GitHub credentials to the NAS.

The live `current` symlink, runtime configuration, identity registry, media volumes and application containers are not changed by a source pull. The helper verifies the commit and clean working tree and confirms that the live release/container identities stay unchanged. Operational receipts are private on the NAS and under the ignored local task folder.

This task updates source on the NAS; it does **not** promote new application images. A live rollout remains a separate build, backup, native-verification and promotion step through the existing deployment runbook. No production account, session, MFA, original media or encryption-key migration is performed here.

Rollback is a selective source revert followed by another authorized pull. Keep running releases and identity/media storage intact. Never use `down -v`, delete registry data or rewrite a dirty NAS checkout to undo presentation changes.
