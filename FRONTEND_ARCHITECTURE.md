# Frontend architecture

8 November 2026. The two independent Next.js services continue to share `@aia/ui`; API rewrites, staff sessions, TOTP, role enforcement, recipient delivery and native storage ownership stay in the existing services.

| Layer | Implementation and responsibility |
|---|---|
| Application shell | Pinned MIT Square UI Files sidebar/header adapted to AIA navigation; actual shadcn SidebarProvider, responsive Sheet, DropdownMenu, Tooltip, Button and Input primitives |
| Gallery | Supplied 21st.dev AnimatedImage adapted inside React Photo Album Rows/Masonry render hooks; list uses the same asset model and thumbnail renderer |
| State | Existing Workspace fetches native pages of 48; 300 ms search debounce; stale responses ignored; current page plus up to 100 selected metadata records retained |
| Viewing | Lazy React import of Yet Another React Lightbox, zoom/fullscreen/captions/thumbnails/video/download plugins; adjacent preload 1, no original/RAW preload |
| Details/forms | Existing metadata, lifecycle, sharing, upload/resume, history and settings business components retained; shared Modal now uses Radix focus handling and a side panel for details |
| Styling | Tailwind 4/PostCSS with explicit source scanning of shared components; upstream utility styles plus AIA neutral light/dark tokens and responsive overrides |

All asset URLs are authenticated same-origin `/api/library/:id/...` routes. No native source hostname, signing key or staff secret enters client code. Gallery uses `preview?size=thm`; full viewer asks the default preview route for an existing native `scr` rendition, falling back to `pre`, `thm`, then `col` using `get_resource_all_image_sizes`. It never selects the original as a preview fallback. ResourceSpace can omit `scr` for smaller images and return a generic icon with HTTP 200, so HTTP success alone is insufficient. Streaming original downloads use the existing permission-checked endpoint. Missing previews render a local unavailable state without a retry loop. Native thumb dimensions preserve preview aspect ratio; a deterministic 4:3 fallback is used only when unavailable. Original dimensions are not inferred. Unknown/RAW formats still depend on native preview generation and codec support.

Search builds the existing ResourceSpace query with quoted native scopes `year`, `event89`, `championship`; text plus filters must fit the existing 200-character limit. Kind and review state use existing API fields. Oldest/name sorting is explicitly on the current page; source newest ordering and server paging remain authoritative. Selection spans fetched pages, Shift selects the displayed range, and changing search/kind/section/state resets selection. It never means all results across an entire search.

Collections use existing list/create and narrow new authenticated rename/membership routes. The bridge calls installed native `save_collection`, `add_resource_to_collection` and `remove_resource_from_collection`. Full selected resource access is checked before membership writes. Only literal native `true` is success; native language error strings are failures. Transfer-managed collection prefixes are protected. Membership removal retains DAM originals. Collection sharing resolves approved assets through the existing transfer flow and requires manual selection above 100 assets.

The compatible API additions and preview contract projection are documented in FRONTEND_AUDIT.md. They require an API image rollout with the two frontends, but no registry migration, ResourceSpace plugin update, source engine restart or storage change. Transfer uploads continue to Gokapi; library sharing remains native references, and temporary files never enter ResourceSpace. Password, expiry, quotas, revoke, cleanup and ownership remain server-side.

Local browser fixtures live only in `scripts/test/frontend-fixtures.mjs`, require `--synthetic-only`, bind loopback and are never imported by runtime code. Do not configure a deployment with the fixture API URL. The fixture is a UI contract aid, not a substitute for native integration acceptance.

Detail collection membership uses the installed native `get_resource_collections` binding only after resource authorization, intersects results with the caller-visible collection list and hides transfer-managed names. Source lookup failure degrades that section without blocking asset metadata. Fullscreen image sizing uses the actual full-preview natural dimensions; thumbnail metadata is used only by the gallery. API responses keep the original `no-store` security policy rather than adding persistent authenticated image caching.
