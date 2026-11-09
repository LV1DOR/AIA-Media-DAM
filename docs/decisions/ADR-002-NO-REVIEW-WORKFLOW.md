# ADR 002 — Direct library publication

Owner decision, 9 November 2026: remove the Review page and manual review/approval workflow. This supersedes the review requirements in the original implementation plan. Changes remain on `frontend/unified-ui-review` for preview; this is not authorization to deploy the branch.

Completed uploads publish automatically into native state 0. The adapter creates a private processing resource, uploads the file and metadata, then publishes it using native `put_resource_data`. It accepts only an explicit successful native result; failure triggers cleanup of that newly created resource. The transient private state is an upload-processing safeguard, not a human review queue.

The application exposes only live library and archived lifecycle states. Pending/awaiting-review states cannot be listed or assigned through its API. Archive/restore, source access checks and share eligibility remain enforced. Existing pending records and their original metadata are not rewritten or mass-published. Legacy review notes remain stored natively but are hidden from application metadata and are no longer created by new setup configuration.

Existing `reviewer` role IDs and native group mappings remain compatible with stored accounts and permissions; the UI calls this role **Media editor**. No account/registry migration or permission broadening is required. Native source inspection confirms publication checks edit access on the private processing resource. Actual publication on disposable native staging records remains part of deployment acceptance; the tests in this task do not mutate production media.

Receiver copy: remove the download-only disclaimer, AIA TRANSFER status label and footer/tagline. Inactive/expired/revoked/invalid links show **This sharing link is inactive.** Password, expiry, quota, authorization and original download behavior remain unchanged.
