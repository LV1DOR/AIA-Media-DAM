# Frontend performance evidence

8 November 2026. Raw results: [Node transport/model](docs/frontend/evidence/synthetic-performance.json), [browser comparison](docs/frontend/evidence/browser-performance.json), [browser test execution](docs/frontend/evidence/browser-performance-tests.json). No NAS or real-photography throughput claim is made.

## Synthetic transport and client model

Reproduce with `corepack pnpm test:performance`. Windows workstation, Node 22.17.0; 20 measured requests after one warmup per dataset. Isolated loopback API and current 48-item page model, not browser rendering.

| Records | Largest page / JSON bytes | HTTP + JSON median / p95 ms | Model median / p95 ms |
|---:|---:|---:|---:|
| 100 | 48 / 13,192 | 0.633 / 1.22 | 0.698 / 0.817 |
| 1,000 | 48 / 13,290 | 0.624 / 1 | 0.66 / 0.915 |
| 10,000 | 48 / 13,309 | 0.798 / 0.995 | 0.698 / 0.843 |

## Isolated optimized-build browser comparison

The baseline is the preserved pre-redesign source, installed offline with its original lockfile and built separately. Both builds use identical native-shaped fixture records and lightweight synthetic SVGs, the production `no-store` response policy, Chromium 158 headless, 1440x1000, reduced motion and no CPU/network throttling. One Lighthouse 13.6.0 navigation per build/count; not a statistical distribution. The baseline uses `next start` against its optimized build; the redesign uses the prepared standalone output.

| Records | Gallery ready, baseline / redesign ms | Selection round trip, baseline / redesign ms | Lighthouse LCP, baseline / redesign ms | Lighthouse score, baseline / redesign |
|---:|---:|---:|---:|---:|
| 100 | 194 / 220.3 | 50.5 / 44.1 | 238.2 / 568.6 | 100 / 100 |
| 1,000 | 157.5 / 186.1 | 51.4 / 42.8 | 209.3 / 543.5 | 100 / 100 |
| 10,000 | 159.2 / 179.3 | 47.9 / 47.7 | 199.0 / 621.4 | 100 / 100 |

Gallery-ready and selection times include automation/protocol overhead, not field INP. The richer UI has a higher Lighthouse LCP in these samples; the scores alone do not mean every interaction became faster.
Lighthouse CLS ranges: baseline 0.0000-0.0519, redesign 0.0000-0.0000. Separate browser observer CLS: baseline 0.0025-0.0335, redesign 0.0000-0.0000. Different observation paths are reported separately, not averaged.
Lighthouse total blocking time: baseline 0.000-0.000 ms, redesign 0.000-0.000 ms.

All runs render 48 cards and request 48 previews. Total initial resource requests: baseline 57-57, redesign 60-60. Encoded preview bytes: baseline 18604-18604, redesign 18825-18825; transferred bytes including overhead: baseline 33004-33004, redesign 33225-33225. These tiny SVG fixtures establish request bounds, not JPEG/RAW payload savings.

After forced GC and 20 alternating page/scroll cycles, redesign V8 used heap was 9.28-9.39 MB versus baseline 6.31-6.35 MB. Growth was 1.71-1.82 MB versus baseline 1.42-1.42 MB. This measures JavaScript heap, not total browser process, decoded-image or GPU memory. Short-run warming is not proof of indefinite leak freedom. No JavaScript page errors were recorded.

Initial warning budgets for this same isolated workstation setup: exactly 48 cards per full page, at most 64 initial resources, zero unexpected JavaScript errors, redesign observer CLS below 0.05, gallery-ready below 400 ms and selection protocol round trip below 100 ms. Investigate post-GC heap above 12 MB after 20 cycles or increasing across longer repeated runs. These provide headroom over observed values and are local regression warnings, not universal production service targets.

Reproduce browser measurements by preparing `.local/frontend-qa/baseline-build/` from the retained baseline archive, installing its original lockfile offline and building with `AIA_API_INTERNAL_URL=http://127.0.0.1:4522`. Build the redesigned apps against the same fixture URL, set `AIA_BROWSER_PERFORMANCE=1` and run `corepack pnpm exec playwright test`. Rebuild the apps with normal API configuration afterward. Full Lighthouse reports are private under `.local/frontend-qa/lighthouse/`; source fingerprint is in the raw comparison JSON. Never deploy a fixture-address build.

Implemented bounds: 48-item server pages, memoized image/photo models, async image decoding and lazy loading, native `thm` gallery requests, stable preview aspect reservations, deterministic skeletons, reduced motion, current-page plus at most 100 selected metadata records, lazy viewer bundle, one adjacent full preview preload, streamed original downloads and no full-library client fetch. Server paging bounds list and album DOM, so a second virtualization layer is unnecessary at 48 items. Sorting is page-scoped.

The API retains its existing `Cache-Control: no-store` security policy. Reuse is limited to mounted image elements and adjacent viewer preloads; no persistent or cross-session image/service-worker cache is introduced. This preserves the existing privacy/revocation boundary.

Before production acceptance, repeat with representative native photographs, video/RAW previews and actual staff devices on LAN: first gallery paint, CLS, prolonged scroll/viewer/selection responsiveness, total browser memory, native preview bytes/requests and codec behavior. Include slow connections, broken previews and 390/768/desktop widths. Synthetic browser scores do not close this real-media acceptance gate.

A real native-source check on the candidate measured **5,115 bytes for `thm` versus 95,383 bytes for `scr`** on one approved asset. This confirms the size selector reaches the actual source; it is a single sample, not a library-wide savings claim. Native backend rate limits and concurrency policy remain unchanged and need representative multi-user profiling before adopting production targets.

The later live walkthrough found a native banner with no `scr` rendition. The correction adds one native availability lookup to full-image preview requests and selects existing `scr`/`pre`/`thm`/`col` in that order. Gallery thumbnail requests are unchanged. The recorded browser performance dataset predates this adapter correction; full-viewer latency with this extra native call has not been benchmarked.
