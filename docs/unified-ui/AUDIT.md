# Unified UI audit ? 9 November 2026

Branch: `frontend/unified-ui-review`. Stable NAS release remains `lan-20261108-16a7b99c`. No production deployment is authorized by this task. Git is unborn: preserved source archive `.local/unified-ui/baseline/source.tar.gz`, checksum and original status provide the rollback point without staging existing work.

All four root reference PNGs were inspected as pixels. Shared UI lives in `packages/ui/src`, shadcn aliases already resolve `components/ui` there; no duplicate root component tree is needed. Next.js 16.4.5, React 19.3.1, Tailwind 4 and TypeScript are configured. Baseline typecheck, 25 API/model tests and both production builds pass. Baseline browser suite/screenshots recorded separately.

The existing employee Transfers section already operates within Media navigation, with native registry/history and Gokapi chunk flows. Its introductory card/table and modal upload need an inline two-column composition. ResourceSpace sharing uses source references; new temporary files remain Gokapi-only. Public recipient has no Download All control yet; implement separate authorized individual downloads with an honest browser-permission note, not a new ZIP/backend transport.

Native read-only audit: resource 2 exposes `keywords` field 1, type 9 (dynamic keywords). Installed `api_get_edit_access` is available. `api_update_field` checks resource edit and metadata-field permissions; `api_set_node` checks native node-creation permission. Implement a narrow authenticated add/remove/replace tag bridge using those functions and native node IDs. Preserve unrelated fields; preflight access, optimistic conflict detection, per-asset partial outcomes. No native metadata writes in this task's tests.

Storage: add an admin-only read-only filesystem stat for the configured application data mount, labelled Application data filesystem. It is whole backing-filesystem utilization, not DAM/Gokapi totals or a quota. No category breakdown or policy warning is inferred; unavailable for in-memory/unsupported fixtures unless explicitly supplied by the isolated test server.

UsageMeter upstream registry and MIT licence retrieved, including original CSS and motion tokens. Owner TSX retained and integrated separately from its demo. Aceternity published behavior and licence inspected; direct registry download currently returns HTTP 403. Retain a clear adaptation/source limitation if retrieval stays unavailable. No broad blur or shared hovered-gallery state; local CSS focus/overlay transitions fit the existing masonry structure.
