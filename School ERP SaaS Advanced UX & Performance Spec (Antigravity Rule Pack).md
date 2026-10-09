# School ERP SaaS: Advanced UX & Performance Engineering Spec

Agent rule pack for Google Antigravity · Version 1.0 · 8 October 2026

Scope: a multi-tenant school-management SaaS / ERP serving crores (tens of millions) of users in India. Most rules also apply to other multi-tenant ERPs (fees, HR, inventory). This is the advanced companion to the uploaded 'Common UI/UX and performance' document: its keyword lists are replaced by measurable rules, use cases, fallbacks and verification steps.

**Evidence tags used on every number and API claim**

- &#91;V\] verified against a source during this session (see Sources at the end)
- &#91;P\] proposed internal target: a starting point to tune with your own field data
- &#91;A\] assumption used for estimation: replace with measurements
- &#91;R\] engineering rule of thumb: widely used, not benchmarked here

## 0. Install map for Antigravity

Antigravity reads AGENTS.md and GEMINI.md as rules (GEMINI.md wins on conflict) and also loads rule files from a workspace rules folder \[V: third-party guides, IDE v1.20.x and later\]. Sources disagree on the folder name (`.agent/rules` vs `.agents/rules`), and one guide states a 12,000-character cap per rules file \[V: single third-party source\]. Confirm both in your IDE version, then split this document as below and run `wc -c` on each file. Each numbered section is written to be one file.

| Section | File | Suggested activation \[R\] |
| --- | --- | --- |
| 1 Metric contract | `01-metrics.md` + short root `AGENTS.md` | always on |
| 2 Disciplines (-logies) | `02-disciplines.md` | model decision |
| 3 Hardware and LCP | `03-hardware-lcp.md` | when editing frontend |
| 4 Caching | `04-caching.md` | when editing frontend or API |
| 5 Rendering and data loading | `05-rendering.md` | when editing frontend |
| 6 Data layer and scale | `06-data-scale.md` | when editing API or DB |
| 7 Bursts, resilience, data protection | `07-resilience.md` | model decision |
| 8 Advanced UX patterns | `08-ux-patterns.md` | when editing UI |
| 9 India, accessibility, copy | `09-india-a11y-copy.md` | when editing UI |
| 10 Observability, testing, debt, ADRs | `10-ops-quality.md` | model decision |
| 11 Agent protocol and workflows | root `AGENTS.md` + workflows folder | always on (protocol) |

Keep only sections 1 and 11 always on; the rest load on demand to save context.

## A. Audit of the uploaded document

| # | Finding in the uploaded document | Why it matters | Resolution here |
| --- | --- | --- | --- |
| 1 | Success metrics: TTFB < 100 ms, LCP < 1.2 s, CLS = 0 | Google's 'good' thresholds are LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile of real users \[V\]. 1.2 s / 0 / 100 ms as a p75 field gate for authenticated, dynamic pages on mid-tier Android over mobile networks is not a realistic pass/fail line | Tiered budgets: Google thresholds as the floor, tighter internal budgets, lab stretch goals (section 1) |
| 2 | INP is missing | INP replaced FID in March 2024 \[V\]. ERP screens are interaction-heavy (grids, forms), so INP is the primary metric for CRUD | INP is a first-class budget; handler and long-task rules (sections 1, 5) |
| 3 | The -logy terms (Typology, Ideology…) are labels without tests | An agent cannot verify 'ideology' | Each discipline now has rules, use case, fallback, verification (section 2) |
| 4 | Silent optimistic UI ('zero loading spinners') for attendance | Attendance, fees and marks are records of consequence; a silent failure is lost data | Optimistic UI plus durable outbox plus visible per-row sync state (section 8) |
| 5 | Stale-while-revalidate for rosters, applied broadly | Stale fee balances or revoked permissions are unacceptable | Freshness classes S0 to S4 (section 4) |
| 6 | Edge nodes with 'global database replication' assumed | Multi-region writes add consistency cost; users are concentrated in India | Regional primary plus replicas; edge for static and semi-static only (sections 2, 6) |
| 7 | 'Absolute avoidance of tables on mobile' | Teachers enter marks in grids; cards alone slow bulk entry | Card list on phones, pinned-column grid fallback on tablets (sections 2, 8) |
| 8 | Manual useMemo / useCallback everywhere | React Compiler is stable and supported in Next.js 16 \[V\] | Compiler first; manual memo only when a profile proves it (section 5) |
| 9 | 'Max 3 fields per step', 'no library over 50 KB' | Rigid rules get ignored | One decision per step, route-level byte budgets instead (sections 1, 8) |
| 10 | Chromium-only APIs assumed (deviceMemory, Network Information, Background Sync) | Safari and Firefox lack some of them | Every capability has a default tier and fallback (section 3) |
| 11 | Missing entirely | Multi-tenant isolation, offline use, school-day traffic bursts, Indic fonts and number formats, WCAG 2.2, observability, minors' data protection, testing, rollout | Added in sections 3 to 10 |

## 1. Metric contract (file `01-metrics.md`)

### 1.1 Field metrics

Field data at the 75th percentile, split mobile and desktop, over a rolling 28-day window, is what Google assesses \[V\]. Thresholds have not changed since the INP migration \[V\].

| Metric | Google 'good' at p75 \[V\] | Internal budget: mid-tier Android, Indian mobile networks \[P\] | Internal budget: desktop \[P\] |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 s | ≤ 1.8 s | ≤ 1.2 s |
| INP | ≤ 200 ms | ≤ 150 ms | ≤ 100 ms |
| CLS | ≤ 0.1 | ≤ 0.03 | ≤ 0.02 |
| TTFB | guidance ≈ ≤ 0.8 s \[V: secondary source\] | edge-cached shell ≤ 200 ms; dynamic authenticated ≤ 450 ms | ≤ 300 ms |

LCP = TTFB + resource load delay + resource load duration + element render delay \[V\]. Debug LCP by subpart, never as one number (section 3).

### 1.2 Operational budgets (fail the PR on a regression above 5 percent \[P\])

- Initial JavaScript per route, brotli: login and app shell ≤ 100 KB; typical route ≤ 170 KB; report and chart modules lazy-loaded, ≤ 250 KB, never on the critical path \[P\]
- LCP element: server-rendered in the first HTML response; on dashboards prefer a text heading or table over an image \[P\]
- Any image used as LCP ≤ 100 KB, with width, height and `fetchpriority=high` \[V for fetchpriority\]
- Long tasks: none above 50 ms during an interaction; synchronous handler work ≤ 50 ms \[P\]
- Server time per API request: read p95 ≤ 150 ms, write p95 ≤ 250 ms, p99 ≤ 600 ms; at most 10 DB queries per request; zero N+1 \[P\]
- DOM nodes per screen ≤ 1,200 (Lighthouse starts flagging large DOMs at roughly 800 nodes \[R\]) \[P\]
- JS heap on grid screens ≤ 50 MB on a mid-tier device \[P\]
- Third-party scripts on authenticated screens: none, except payment SDK loaded on demand on the pay screen \[P\]

### 1.3 Reference test profile

Lighthouse default mobile profile (about 4x CPU slowdown, simulated slow 4G) \[R\], plus one real low-end and one real mid-tier Android phone, plus a desktop profile. Lab numbers never replace field p75; report both.

### 1.4 Perceived-latency thresholds \[R\]

- 100 ms or less feels instant: pressed state, toggles, optimistic updates
- up to 400 ms keeps flow (Doherty threshold): navigation, filter results
- up to 1 s keeps the train of thought: show skeletons beyond 300 ms
- beyond 1 s show progress; beyond 10 s move the work to a background job with a notification

## 2. Advanced disciplines, the -logies (file `02-disciplines.md`)

Eight disciplines replace the original four. Each is testable.

### 2.1 Methodology: measure, budget, change, re-measure

- Definition: no performance claim without a number from a named tool.
- Rules: every PR touching a route attaches before and after values (bundle size, lab LCP, interaction trace, query count). Label unmeasured values \[A\].
- Use case: before optimising the Gradebook, record INP for a 40-row and a 400-row class.
- Fallback: if the sandbox cannot run a browser, state 'unmeasured' and give the exact command to measure; never present an estimate as a result.
- Verify: Lighthouse CI, bundle analyser and query-count test output in the PR.

### 2.2 Topology: where compute, data and cache live

- Definition: spatial placement of servers, databases, caches and edge nodes relative to users.
- Rules: primary region in India; second India region for disaster recovery where the cloud offers one \[R\]; app servers and database in the same region with same-zone preference; CDN with verified Indian points of presence, tested from Jio, Airtel and Vi connections \[R\]; static and public assets at the edge; authenticated HTML is private and never shared-cached without a tenant-and-user cache key.
- Use case: a parent in a tier-2 city loads the fee page: CDN serves the shell, the region serves the personal data.
- Fallback: CDN miss goes through an origin shield; region loss switches the app to read-only mode with the last replicated data.
- Verify: synthetic probes from several Indian ISPs; origin-shield hit ratio dashboard.

### 2.3 Chronology: time as a design dimension

- Definition: the order in which bytes, scripts and data are requested, plus the school calendar that predicts load.
- Rules: critical path order is HTML, critical CSS, LCP resource, then JS; everything else is deferred; non-urgent work runs when idle (`requestIdleCallback`, `scheduler.postTask` where present, `setTimeout` fallback). Pre-warm caches before known peaks (section 7).
- Use case: at 07:30 a job warms today's timetable, rosters and teacher home data for the schools whose day starts at 08:00.
- Fallback: if pre-warm fails, cold-start behaviour must still meet budgets by streaming a skeleton shell.
- Verify: waterfall in the lab run; cache hit ratio at 08:00 versus 14:00 in dashboards.

### 2.4 Pathology: finding and preventing regressions

- Definition: catalogue of known failure patterns with detection and cure.

| Anti-pattern | Symptom | Detection | Fix |
| --- | --- | --- | --- |
| N+1 queries | latency grows with list size | query counter test | join or batch loader |
| OFFSET pagination deep into a table | slow late pages | slow-query log | keyset pagination |
| Unbounded list endpoint | memory spikes, timeouts | max page size lint | enforce limit and cursor |
| PDF or report built inside the request | p99 spikes, worker starvation | trace spans over 1 s | queue job plus progress |
| Cache stampede | DB spike when a hot key expires | miss-rate spike graph | single-flight, jittered TTL, stale-while-revalidate |
| Retry storm | cascading outage | retry counters | exponential backoff with jitter, retry budget |
| Layout thrash | high INP | trace with layout reads in loops | batch reads, then writes |
| Event-listener or timer leak | memory growth, scroll jank | heap snapshot diff | cleanup in effects |
| Hot partition or hot tenant | one shard saturated | per-tenant metrics | rate limit, promote tenant to own shard |

- Verify: each anti-pattern has a lint, test or alert; CI blocks the first three.

### 2.5 Ontology: one domain vocabulary across UI, API and database

- Definition: the agreed model of school concepts and relationships.
- Entities: Tenant (trust or chain) > Institution (school or branch) > AcademicYear > Term > Class and Section > Enrollment > Student; Guardian (many-to-many with Student); Staff; Subject; Period and Timetable; AttendanceRecord; Assessment and Mark; FeeStructure > FeeInvoice > Payment; Notice.
- Rules: UI label, API resource name and table name use the same noun (never Pupil, Learner and Student mixed). Every row carries `tenant_id`; year-scoped rows carry `academic_year_id`. Records of consequence (attendance, marks, fees) are soft-deleted and audited.
- Use case: a guardian with children in two branches sees a family switcher, not two logins.
- Fallback: imported legacy data that breaks the model goes to a quarantine table with a row-level error report.
- Verify: glossary file plus a lint that rejects unknown synonyms in new routes.

### 2.6 Taxonomy: information architecture by role and task

- Definition: how navigation and screens are grouped for each persona.
- Rules: every role lands on a task-first 'Today' screen; at most 5 top-level destinations per role; mobile bottom bar holds 3 to 5 items \[R\]; labels use task verbs or user nouns, never table names.
- Use case: Teacher: Today, Attendance, Marks, Homework, Messages. Parent: Today, Child, Fees, Notices.
- Fallback: when unsure, run a card sort or tree test (section 10) before building navigation.
- Verify: tree-test success of 80 percent or more on the top five tasks \[P\].

### 2.7 Morphology: component shape adapts to device class and capability

This extends the original 'Typology'. Use container queries so a component adapts to its container, not only the viewport \[R\].

| Component | Compact (phone) | Medium (tablet) | Expanded (desktop) |
| --- | --- | --- | --- |
| Data grid | card list with expandable rows | pinned-column grid, horizontal scroll | full grid plus right drawer |
| Form | full-screen step sheet | drawer 60 percent width | drawer about 480 px |
| Navigation | bottom bar | icon rail | sidebar plus command palette |
| Detail view | pushed screen with back | master-detail split | master-detail split |

- Capability tiers: Tier A works on any browser without optional APIs; Tier B uses modern CSS and JS; Tier C adds enhancements (prerender, background sync). A feature must degrade to Tier A, never to a blank screen.
- Verify: screenshots at 360, 768 and 1280 px in CI; Tier A smoke test with JavaScript features stubbed.

### 2.8 Ergonomics: the physical interaction layer

- Rules: primary actions sit in the lower third of phone screens; touch targets 44 to 48 CSS px for primary actions (WCAG 2.2 AA minimum is 24 px) \[R\]; text contrast 4.5:1, UI contrast 3:1, because teachers use phones outdoors in glare \[R\]; every swipe or drag has a tap alternative.
- Use case: attendance screen with large Present and Absent toggles and a sticky 'Done' bar.
- Fallback: if a gesture library fails, buttons remain.
- Verify: automated contrast and target-size checks; manual one-handed test on a 6-inch phone.

## 3. Hardware and software connections (file `03-hardware-lcp.md`)

### 3.1 LCP subparts: which layer limits which part

| LCP subpart | Hardware limiter | Software levers | Fallback |
| --- | --- | --- | --- |
| TTFB | server CPU, database disk I/O, network round trip to origin | static shell at the edge (partial prerendering, section 5); regional placement; connection pooling; covering indexes; streamed responses; per-tenant caching | if dynamic data is slow, send the shell and a skeleton first, stream the rest |
| Resource load delay | client network sits idle until the browser discovers the resource | LCP element present in the initial HTML; `fetchpriority=high` on an LCP image \[V\]; preload only when discovery is late; never lazy-load the LCP image; never inject the LCP element with JavaScript | if the LCP is data-driven, render its container and a text placeholder in HTML |
| Resource load duration | bandwidth, radio, TCP or QUIC | fewer bytes (AVIF or WebP, brotli), HTTP/2 or HTTP/3, CDN edge, responsive `srcset` | honour Save-Data where available and serve lighter images |
| Element render delay | main-thread CPU, GPU | cut render-blocking CSS and JS; no client-only rendering of the LCP element; font strategy (3.4); less hydration through server components | system-font fallback with size-adjusted metrics |

HTTP/3 and 103 Early Hints support differs between CDNs and clients \[R\]: enable where verified, never depend on it.

### 3.2 Client hardware map

| Resource | Constraint on low-end devices | Rule | Fallback |
| --- | --- | --- | --- |
| CPU main thread | JS parse, compile and run dominate; only one thread | tasks under 50 ms; yield with `scheduler.yield()` (Chromium) \[V\]; heavy work (CSV or XLSX import, sorting beyond 5,000 rows, report preview) in a Web Worker; worker pool size min(4, hardwareConcurrency - 1) \[R\] | `setTimeout` or MessageChannel yield; chunked work without workers |
| GPU and compositor | weak GPUs, too many layers cause jank | animate `transform` and `opacity` only; `will-change` only transiently; `content-visibility: auto` on off-screen sections \[R\]; honour reduced motion | no animation |
| RAM | background tabs are evicted; GC pauses | persist drafts to IndexedDB on every field blur; virtualize lists; bound query-cache lifetime; heap budget 50 MB \[P\]; treat `navigator.deviceMemory` (Chromium only) as a hint, absent means assume low \[R\] | lighter tier by default |
| Storage | quotas; IndexedDB blocked in some private modes | IndexedDB for structured offline data, Cache Storage for assets; request `navigator.storage.persist()`; handle quota errors | memory-only mode with a visible 'changes not saved offline' notice |
| Network radio | high latency, handover, metered data packs | batch requests; at most 3 preconnect origins; no polling faster than 30 s; SSE or WebSocket with backoff and jitter; pause while hidden; `navigator.connection.saveData` and `effectiveType` (Chromium only) pick a lighter tier | the light tier is the default |
| Battery and thermal | CPU throttling under sustained load | no continuous animations or timers on idle screens | static state |

Cross-origin isolation (needed for SharedArrayBuffer) can break embeds such as payment pages and video. Avoid it unless a measured need exists \[R\].

### 3.3 Server hardware map

| Resource | Rule | Verify |
| --- | --- | --- |
| CPU | Node's event loop is single-threaded: no blocking work in handlers; PDFs, image resizing, report cards and imports go to a worker queue; scale out on p95 latency and queue age, not CPU alone \[R\] | event-loop delay p99 under 100 ms \[P\] |
| Memory: Postgres | `shared_buffers` about 25 percent of RAM as a start, `effective_cache_size` about 50 to 75 percent \[R\]; `work_mem` is per sort node per connection, so raise it per session for reports, never globally | buffer cache hit ratio 99 percent or more on OLTP tables \[R\] |
| Memory: Redis or Valkey | set `maxmemory`; `allkeys-lru` for pure cache; a separate instance with `noeviction` for queues and locks \[R\] | eviction graph |
| Disk | NVMe SSD for the database; hot indexes fit in RAM; WAL on a fast volume \[R\] | p95 disk latency |
| Network | app and database in the same zone, p50 database round trip near 1 ms \[P\]; keep-alive pools; precompressed brotli for static files, brotli or gzip level 4 to 5 for dynamic responses \[R\] | round-trip histogram |
| Connections | PgBouncer in transaction mode; start with active connections of 2 to 4 times cores \[R\]; session-level `SET` breaks under transaction pooling, so use `SET LOCAL` | pool wait time p95 |

### 3.4 Fonts for Indic scripts

- Self-host fonts; build per-script subsets with `unicode-range`; load only the script of the user's language; preload only the primary-script file.
- Use `font-display: swap` together with `size-adjust` and metric overrides on the fallback face so the swap does not shift layout.
- Fallback: system fonts (Noto-family fonts ship on most Android devices \[R\]).
- Verify: CLS lab run with the slowest network profile and each supported script.

### 3.5 Load shedding and degradation tiers

- Trigger \[P\]: CPU above 85 percent for 2 minutes, queue age above 60 s, or p95 latency above 2x budget.
- G1: disable non-critical widgets and analytics. G2: serve cached dashboards, reject low-priority jobs. G3: read-only mode. G4: static status page.
- Return 429 with `Retry-After` for shed traffic; clients back off with jitter.

## 4. Caching (file `04-caching.md`)

### 4.1 Freshness classes

Every resource gets a class before any cache is added. Values are starting points \[P\].

| Class | Examples | Max staleness | Allowed layers | Strategy |
| --- | --- | --- | --- | --- |
| S0 authoritative now | payment status, fee balance at payment time, permission changes, result-publish gating | 0 | none (`no-store`) | read from primary; idempotency keys |
| S1 operational live | today's attendance, live counters | 5 s | client memory, short Redis | push or short-interval revalidate |
| S2 working data | rosters, timetable, homework | 5 min, revalidate on focus | client, IndexedDB, Redis | stale-while-revalidate plus tag invalidation |
| S3 reference | subjects, class lists, fee structures, academic calendar | 1 hour to 1 day | client, IndexedDB, Redis | long TTL plus event invalidation |
| S4 public static | hashed JS and CSS, logos, fonts, public notices | immutable | CDN, browser | content-hashed names |

### 4.2 Cache ladder

| Layer | What lives here | Key and TTL | Invalidation | Fallback |
| --- | --- | --- | --- | --- |
| L0 client memory (query cache) | API data per screen | key includes tenant, user, resource, params; `staleTime` per class; bounded `gcTime` | mutation invalidates keys; refetch on focus | refetch |
| L1 HTTP cache | hashed assets; API responses with validators | assets `Cache-Control: public, max-age=31536000, immutable`; APIs `private, max-age=0, must-revalidate` with ETag; S0 and sensitive PII `no-store` \[R\] | new asset hash; conditional requests | normal fetch |
| L2 service worker and IndexedDB | app shell, last-known S2 and S3 data, outbox | per-user database name; versioned schema; max age 7 days \[P\] | schema bump; wipe on logout | memory only |
| L3 CDN edge | static assets, public pages, prerendered shells | long TTL for hashed files; short TTL with revalidation for shells | tag purge on publish | origin shield |
| L4 in-process LRU | tenant config, feature flags | 1 to 5 s | TTL only | skip layer |
| L5 Redis or Valkey | S1 to S3 query results, sessions | `t:{tenant}:v{schema}:{resource}:{id}`; TTL with 10 to 20 percent jitter; negative cache 5 to 30 s | tag sets and domain events | bypass with circuit breaker |
| L6 database | rollup tables, materialized views, read replicas | refresh on schedule or event; replica lag budget \[P\] 2 s | refresh concurrently | read primary |

### 4.3 Rules

- Invalidation: a write commits together with a domain event (outbox pattern); consumers purge tags such as `tenant:42:class:7:roster`.
- Next.js: use `use cache` with `cacheLife` and `cacheTag`, and invalidate with the tag APIs; Cache Components is opt-in and is the model that completes partial prerendering \[V\]. Check the Next.js 16 docs for `revalidateTag` versus `updateTag` semantics before use \[V that both exist\].
- Stampede defence: single-flight request coalescing; soft TTL shorter than hard TTL so one refresher runs while others get stale data; jittered TTLs; pre-warm before known peaks (section 7).
- Stale-while-revalidate is allowed only for S2 and S3. Never for S0.
- Persisted client caches hold minors' data: key per user, clear on logout (the `Clear-Site-Data` header where supported \[R\]), short max age, and do not persist marks or health notes on shared devices.

### 4.4 Multi-tenant cache safety (non-negotiable)

- The tenant id is part of every cache key; a URL alone is never a key for authenticated data.
- Responses with `Set-Cookie` or personal data are `private`; a shared cache may store them only when the key includes tenant and user or role.
- CI includes a cross-tenant poisoning test: tenant A writes, tenant B reads the same URL, expecting no A data.

### 4.5 Failure matrix

| Failure | Behaviour |
| --- | --- |
| Redis down | bypass cache; circuit breaker plus per-tenant rate limit protect the database; serve L4 stale for up to 60 s \[P\] |
| CDN degraded | fail over to a second CDN or origin with rate limits \[R\] |
| IndexedDB unavailable | memory-only mode with notice |
| Replica lag above budget | route reads to primary for affected tenants |
| Invalidation event lost | hard TTL bounds the damage; reconciliation job compares versions nightly |

## 5. Rendering and data loading (file `05-rendering.md`)

### 5.1 Strategy by screen class

This revises the rendering table in the uploaded document.

| Screen class | Strategy | Cache tier |
| --- | --- | --- |
| Marketing, login, public notices | static generation at the CDN | L3 |
| App shell and role home | prerendered static shell with personal parts streamed through Suspense (Next.js Cache Components, which makes partial prerendering the default model) \[V\] | L3 shell, L5 data |
| Read-heavy detail (student profile, report card view) | server components with streaming; client islands only where interactive | L5 |
| Data grids and editors | client island with virtualization; first page of rows streamed from the server | L0, L2 |
| Live widgets (attendance counter, bus tracking) | SSE or WebSocket island | L0 |

If the stack is not Next.js, use the same shape: server-rendered shell plus client islands. 'CSR with TTI under 1 s' in the uploaded document is not a standard metric; use INP in the field and Total Blocking Time in the lab.

### 5.2 Rules

- LCP and INP: the LCP element is in initial HTML (section 3.1); every handler gives visual feedback within 100 ms, then yields before heavy work.
- No request waterfalls: fetch in parallel at route level; prefetch on hover or viewport entry through the framework link component.
- Speculation Rules (Chromium): prerender or prefetch likely next pages with `moderate` eagerness \[V\]. A prerender costs about a full page load \[V\], so cap the list; prerender only side-effect-free GET pages (never 'mark as read' or payment pages). One published case reports a 43 percent mobile LCP improvement for a retailer \[V, single source, treat as an upper-range anecdote\]. Fallback: framework prefetch, or nothing on browsers without support.
- React Compiler: enable it (stable in Next.js 16 \[V\]); remove blanket `useMemo` and `useCallback`; add manual memoization only where a profile shows a hot path.
- Code splitting: route-level and component-level dynamic imports for drawers, charts, report builders, rich-text editors and payment SDKs.
- Transitions: use `useTransition` and `useDeferredValue` for filters and search so typing stays responsive \[R\]; debounce typeahead 150 to 250 ms \[P\].
- Keeping state across navigation: Next.js Cache Components uses React `<Activity>` to preserve component state when navigating away \[V\]; do not hold large grids in hidden routes (memory budget, section 3.2).
- Third-party scripts: none on authenticated critical paths (section 1.2).

### 5.3 CLS rules

- Reserve space with `width`, `height` or `aspect-ratio` for images, avatars, charts and ads-free banners.
- Skeleton row height equals real row height; virtualized lists use fixed or measured heights.
- Never insert content above the fold after paint; toasts and banners overlay, they do not push.
- Font swap handled as in section 3.4.

### 5.4 Images

- AVIF or WebP with JPEG fallback through `<picture>`; `srcset` and `sizes`; lazy-load below the fold only; `decoding=async`; avatars served at 48 and 96 px variants.
- Student photos and documents sit behind signed URLs with short expiry; thumbnails are generated on upload by a worker.

### 5.5 API shape

- List endpoints return list-view fields only; detail endpoints return the full record; field selection or persisted queries prevent over-fetching.
- Cursor pagination, batching through a loader, compression, ETag on reads, idempotency keys on writes.
- A batch attendance endpoint accepts a whole class in one request and is idempotent per (student, date, period).

### 5.6 Virtualization

- Render visible rows plus an overscan of 3 to 5; measure dynamic heights; keep `aria-rowcount` and `aria-rowindex` correct so assistive technology reports the true size.
- Browser find-in-page does not see unrendered rows, so provide in-app search.
- Print and export views are server-rendered in full, not virtualized.
- Fallback: cursor pagination when virtualization conflicts with an accessibility or print requirement.

### 5.7 Realtime transport ladder

| Need | Transport | Notes |
| --- | --- | --- |
| Updates every minute or slower | polling with ETag | simplest, cache-friendly |
| One-way live updates | SSE | automatic reconnect, plain HTTP |
| Two-way or high frequency | WebSocket | heartbeat, resume token |
| User not in the app | push notification, WhatsApp or SMS | consent and quiet hours (section 8) |

Fallback chain: WebSocket, SSE, long polling, short polling with backoff. Always use exponential backoff with jitter and pause while the tab is hidden.

## 6. Data layer and scale (file `06-data-scale.md`)

### 6.1 Capacity method (worked example, every input is an assumption)

The method matters, not these numbers. Replace each \[A\] with measured values.

| Step | Value |
| --- | --- |
| Registered users (1 crore) | 10,000,000 \[A\] |
| Daily active share | 30 percent, so 3,000,000 \[A\] |
| Share of daily actives inside the busiest 10 minutes (morning attendance window) | 15 percent, so 450,000 \[A\] |
| Requests per active user in that window | 20 \[A\] |
| Average rate | 450,000 x 20 = 9,000,000 requests over 600 s = 15,000 requests per second |
| Burst factor | 3, so 45,000 requests per second at peak \[A\] |
| Requests in flight (Little's law: rate x mean latency) | 45,000 x 0.1 s = 4,500 \[R\] |
| Instances | peak rate / (measured per-instance rate x 0.6 target utilisation); at a measured 800 per second that is 45,000 / 480, about 94 instances \[A\] |

Rules: size origin capacity from the cache-miss rate, not the raw request rate; report the cache hit ratio next to every capacity number; re-run the calculation each quarter with field data.

### 6.2 Tenancy models

| Model | Fits | Strength | Cost | Rule |
| --- | --- | --- | --- | --- |
| Pooled: shared schema, `tenant_id` on every row, row-level security | most small and mid schools | cheapest, simplest operations | noisy neighbours, one bad query hurts all | default |
| Schema per tenant | tenants needing custom fields | isolation, per-tenant backup | migration time grows with tenant count | use sparingly |
| Database per tenant (silo) | large chains, regulators, contractual isolation | strongest isolation, independent scaling | highest cost and ops load | promote on demand |
| Hybrid | all of the above together | right-sized per tenant | needs a tenant router | target architecture \[P\] |

- Shard key is `tenant_id` so joins stay inside one shard. A tenant router table maps tenant to shard; moving a tenant is a tested runbook.
- Row-level security is defence in depth, not the only control: every query also filters by `tenant_id`, enforced by a lint rule and an isolation test \[R\].
- Evaluate the tenant setting once per statement (wrap `current_setting` in a sub-select) so the policy is not re-evaluated per row \[R\]. Set it with `SET LOCAL` inside the transaction because PgBouncer transaction mode shares connections.

### 6.3 Schema and query rules

- Composite indexes lead with the tenant: `(tenant_id, academic_year_id, class_id, student_id)`. Partial indexes for active rows; `INCLUDE` columns for hot list queries \[R\].
- Append-only tables (attendance log, audit log, notification log): range-partition by month; BRIN indexes where the data is physically time-ordered \[R\].
- Keyset pagination (`WHERE (created_at, id) < ($1, $2)`) instead of deep OFFSET.
- No `SELECT *`; list queries select list-view columns.
- Every new hot query ships with `EXPLAIN (ANALYZE, BUFFERS)` output in the PR.
- Bulk writes use `COPY`, multi-row inserts or `UNNEST`; idempotent upserts use `ON CONFLICT`.
- Zero-downtime migrations use expand then contract: add nullable, backfill in batches, switch reads, drop later.
- Index only what queries need; each index slows writes and consumes RAM.

### 6.4 Read and write path

- Writes go to the primary. Reads go to replicas with a lag budget of 2 s \[P\].
- Read-your-writes: after a mutation, pin that user's reads to the primary for 5 s \[P\] (a short-lived cookie or a log-position token).
- Dashboards read rollup tables (daily attendance per class, fee collection per day) refreshed by async jobs, not live aggregates over raw rows.

### 6.5 Async work

- Queue everything slower than about 1 s: report-card PDFs, bulk WhatsApp, SMS and email, fee-reminder runs, imports and exports, year-end promotion.
- Each job has an idempotency key, exponential backoff with jitter, a dead-letter queue and an owner.
- Fair share: concurrency caps per tenant so one school's bulk send cannot starve others.
- The user sees 'Started, we'll notify you' within 1 s; progress arrives through SSE or a notification.
- Outbox pattern: the DB write and its event commit atomically; a relay publishes the event.

## 7. Bursts, resilience, data protection (file `07-resilience.md`)

### 7.1 School-calendar burst playbook

| Event | Pattern | Mitigation |
| --- | --- | --- |
| Morning attendance (about 08:00 to 09:30 local) | synchronized small writes from many teachers | batch endpoint, idempotent per student, date and period; optimistic UI with outbox; async rollups; pre-warm rosters at 07:30 |
| Fee due dates, month start | read spike plus payment-gateway callbacks | invoice view from cache (S3) but balance from primary (S0); signature-verified idempotent webhook handler; queue reconciliation |
| Result day | everyone reads the same keys at once | pre-generate per-student result files to object storage behind signed CDN URLs \[P\]; staggered notifications; rate-limited queue or waiting room for the dynamic part |
| Parent-teacher meeting booking | contention on scarce slots | conditional update or `SELECT ... FOR UPDATE SKIP LOCKED`; clear 'slot just taken' message |
| Exam marks upload | large bulk writes | worker import with row-level validation report; resumable |
| Academic-year rollover | huge background jobs | checkpointed batches per tenant, off-peak, with a dry-run report first |

### 7.2 Resilience rules

- Timeouts everywhere \[P\]: browser to API 10 s with retry on idempotent calls only; API to database statement timeout 2 s for OLTP and 30 s for reports on a replica.
- Circuit breakers and bulkheads per dependency, per tenant and per feature; a failing SMS provider must not slow attendance.
- Feature flags double as kill switches; every risky feature ships behind one.
- Rate limits per tenant, per user and per IP, with separate budgets for bulk and interactive traffic.
- Autoscale on request latency and queue age, add warm capacity before known peaks, drain connections gracefully on deploy \[R\].
- Deploys: canary to 1 to 5 percent of tenants, automatic rollback on error-rate or INP regression \[P\].
- Degradation tiers G1 to G4 as in section 3.5.

### 7.3 Data protection for minors (India)

The Digital Personal Data Protection Rules, 2025 were notified in November 2025 (sources differ on 13 or 14 November) with phased commencement over about 18 months \[V\]. Reported provisions relevant here \[V\]: verifiable parental consent before processing a child's data; an exemption for educational institutions where processing is limited to their educational activities and the safety of enrolled children; a ban on behavioural monitoring and targeted advertising aimed at children; breach notification within 72 hours. This is engineering guidance, not legal advice: confirm the roles (school as data fiduciary, your company as processor) and the commencement dates with counsel \[R\].

Engineering implications:

- Consent ledger table (who, for which child, which purpose, when, how verified, withdrawn or not); purposes tagged on data fields.
- Features outside core education and safety (photo sharing, marketing, third-party integrations) sit behind explicit consent flows.
- First-party, minimal analytics; no advertising or cross-site tracking SDKs in student and parent apps. This also protects LCP and INP.
- Retention jobs, export and erasure endpoints, audit logs, encryption in transit and at rest, breach runbook with a 72-hour clock.

## 8. Advanced UX patterns (file `08-ux-patterns.md`)

Each pattern has a rule, a school use case and a fallback. Each is covered by a component or end-to-end test (section 10).

| ID | Pattern | Rule | School use case | Fallback |
| --- | --- | --- | --- | --- |
| UX-01 | Optimistic UI with durable outbox and visible sync state | Update the UI at once, write the change to an IndexedDB outbox, show per-row state (pending, saved, failed) with a retry control; never swallow a failure silently | taking attendance on a weak connection | no IndexedDB: in-memory queue plus a warning before the tab closes |
| UX-02 | Idempotent writes and conflict resolution | Each mutation carries an idempotency key and the record version (ETag or `If-Match`); on conflict show who changed what and let the user keep their own version or the other one; merge per field where safe | two teachers editing one marks sheet | last write wins with an audit entry, only for low-risk fields |
| UX-03 | Offline-first for core tasks | Service worker caches the shell; attendance, marks entry and notices work offline; sync on `online`, on visibility change and, where available, Background Sync (Chromium only) \[R\] | rural schools with unstable internet | manual 'Sync now' button |
| UX-04 | Skeletons and progressive rendering | Skeleton geometry matches final layout (no CLS); stream above-the-fold first; never nest spinners | student profile load | plain text placeholder |
| UX-05 | Undo instead of confirm | Reversible actions complete at once with an 8 s Undo toast; modal confirmation only for irreversible or high-blast-radius actions (delete student, message to more than N recipients \[P\]); bulk destructive actions need typed confirmation | removing a student from a class | confirm dialog naming the consequence |
| UX-06 | Spreadsheet-grade grid | Arrow, Tab and Enter navigation; paste from Excel; fill down; inline validation; pinned name column; saved views; per-cell autosave with status; keyboard-only operable | entering marks for 40 students | phone: card list with numeric keypad per student |
| UX-07 | Command palette and shortcuts | Ctrl or Cmd+K searches entities and actions (type 'rahul 5b' to jump to the student); recent items first; plus a visible search field for touch users | admin jumping between students | header search only |
| UX-08 | Task-first Today screen and smart defaults | Home shows what is due now; preselect the current period and last-used class. For attendance, a default of present is allowed only with an explicit Done step and a summary ('36 present, 4 absent') before submit, and the record stays 'unconfirmed' until then | teacher opens the app at 08:05 | no default, explicit mark per student |
| UX-09 | Bulk operations with preview | 'N selected' counter; select across pages; dry-run preview; per-row result list; retry failed rows only | sending fee reminders to 120 parents | background job with notification |
| UX-10 | Complete states | Every list and form has designed empty, loading, error, offline and no-permission states, using the copy patterns in section 9 | new school with no classes yet | generic message plus action |
| UX-11 | Notification design | Channel per role (in-app, push, WhatsApp, SMS), quiet hours, digests, deep links to the exact record, delivery status | absence alert to a parent | SMS if push fails |
| UX-12 | Role-aware dashboards | Progressive disclosure; at most 6 to 8 cards; one primary action per card; widgets lazy-load below the fold | principal's overview | static summary table |
| UX-13 | Print and export | Server-generated PDFs for report cards, receipts and ID cards through the job queue; print stylesheet for on-screen views | term report cards for 1,200 students | CSV export |
| UX-14 | Money-state clarity | Payment states (pending, paid, failed, refunded) always visible; pay button disabled after first tap and protected by an idempotency key; receipt available at once; status polling after redirect | parent paying term fees | 'check status' button |
| UX-15 | Family and branch switching | One login for guardians with several children or branches; the switcher is always one tap away and shows the active child | guardian with two children in different schools | separate sections on Today |

### 8.1 Corrections to the original rules

- 'Max 3 fields per step' becomes one decision per step with the fewest visible fields that keep the step coherent (typically 3 to 5 on a phone) \[P\]; validate the number in usability tests.
- 'Never use a success page' stays, with one addition: payments and exports may show a dedicated confirmation because it is a document the user keeps.
- 'Modals only for destructive actions' stays; drawers and sheets handle the rest.
- 'Absolute avoidance of tables on mobile' becomes: cards on phones, pinned-column grids on tablets and above, and a horizontally scrollable grid as a documented exception for marks entry.

## 9. India, accessibility and copy (file `09-india-a11y-copy.md`)

### 9.1 Localisation

| Topic | Rule | Fallback |
| --- | --- | --- |
| Languages | Hindi plus the regional languages of your launch states \[A\]; locale chosen per user, not per device; all strings externalised with ICU message format for plurals | English plus the one regional language already translated |
| Numbers and money | `Intl.NumberFormat('en-IN')` groups digits in the lakh and crore pattern (12,34,567) \[R\]; currency with `style: 'currency', currency: 'INR'` | explicit formatter if Intl data is missing |
| Dates | day-month-year; the academic year usually runs April to March but varies by board and school, so store start and end per institution \[A\] | none: configurable per tenant |
| Text expansion | design for 30 to 40 percent longer strings \[R\]; never concatenate translated fragments; no text inside images | truncate with tooltip, never clip silently |
| Fonts | section 3.4 | system fonts |
| Names and addresses | no forced first and last name split; allow native-script names; do not assume a surname | single full-name field |
| Mobile numbers and OTP | validate +91 and 10 digits starting 6 to 9 \[R\]; `autocomplete=one-time-code` on OTP fields; WebOTP is Chromium-only \[R\] | manual entry with a resend timer |
| Input | `inputmode=numeric` for marks and phone fields; allow paste everywhere | standard text input |
| Channels | WhatsApp, SMS and push, each with consent, quiet hours and delivery status | SMS as last resort |

### 9.2 Accessibility (WCAG 2.2 level AA as the floor \[R\])

- Contrast 4.5:1 for text and 3:1 for UI components; visible focus that is not hidden behind sticky bars (2.4.11).
- Target size at least 24 by 24 CSS px (2.5.8); use 44 to 48 px for primary actions.
- No drag-only interaction (2.5.7): sortable lists and sliders have button alternatives.
- Accessible authentication (3.3.8): allow paste and password managers; do not require transcribing codes or solving puzzles; OTP by autofill or SMS retrieval.
- Reflow at 400 percent zoom without two-dimensional scrolling, except for data grids; respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Sync and save status announced through polite live regions; virtualized grids expose correct row counts (section 5.6).
- Verify: axe checks in CI, a manual TalkBack pass on Android for the top five tasks per release, keyboard-only pass on desktop.

### 9.3 UX copy standards

| Element | Pattern | School example |
| --- | --- | --- |
| Button | verb plus object, specific outcome | 'Save attendance', 'Send reminder to 12 parents' (not 'Submit') |
| Error | what happened, why, how to fix | 'Couldn't save attendance for Class 5B. You're offline. We'll send it when you reconnect; your changes are safe on this device.' |
| Empty state | what this is, why empty, how to start | 'No homework yet. Add today's homework and parents will see it in the app.' |
| Confirmation | names the consequence; buttons repeat the action | 'Delete 3 students? Their attendance and marks will be removed. This can't be undone.' Buttons: 'Delete students' and 'Keep students' |
| Loading | sets expectation | 'Preparing 1,200 report cards. You can leave this page; we'll notify you.' |
| Success | short, calm | 'Attendance saved for 5B.' |
| Permission denied | says who can do it | 'Only accountants can edit fee structures. Ask your school admin for access.' |

- Voice: plain, respectful, no jargon; one term per concept (matches the ontology in 2.5); reading level suitable for parents with limited schooling.
- Localisation notes travel with each string: character limits, placeholders, gender and plural rules, idioms to avoid.

### 9.4 Screen definition of done (self-critique before reporting a screen finished)

- First impression: is the purpose clear in 2 seconds, and does the eye land on the primary action?
- Usability: can the persona finish the core task in at most 2 taps from Today, and attendance for 40 students in 60 seconds or less \[P\]?
- Hierarchy and consistency: tokens for colour, spacing and type; same pattern for same job.
- States: empty, loading, error, offline, no-permission, partial failure all designed.
- Accessibility: section 9.2 checks pass.
- Performance: budgets in section 1 measured and recorded.
- Findings are rated critical, moderate or minor, each with a concrete fix.

## 10. Observability, testing, debt and decisions (file `10-ops-quality.md`)

### 10.1 Telemetry

- Real-user monitoring with the web-vitals library, attribution build, so INP reports carry Long Animation Frame detail on the slowest script and the input, processing and presentation phases \[V\]. Long Animation Frames are available in Chrome and Edge \[V\]; other browsers get coarse timing.
- Tag every beacon with route, role, tenant tier, device-memory bucket, effective connection type, language and app version; report p75 and p95 (privacy: no student identifiers).
- Server: OpenTelemetry traces; request rate, errors and duration per route; slow-query statistics; cache hit ratio per layer; queue depth and age; event-loop delay; replica lag.
- Alerts \[P\]: INP p75 up 20 percent in 24 hours; LCP p75 above budget for 2 consecutive hours; cache hit ratio drop of 10 points; queue age above 60 s.
- SLOs \[P\]: core flows (attendance, fee payment, result view) 99.9 percent monthly availability; when the error budget is spent, feature work pauses until reliability work lands.

### 10.2 Testing strategy

| Layer | Scope | Gate |
| --- | --- | --- |
| Unit | fee, grade and attendance-percentage logic, permission rules | fast, every commit |
| Integration | API with a real database; tenant-isolation tests; migrations expand then contract | every PR |
| Contract | OpenAPI or schema checks between web, mobile and API | every PR |
| Component | interaction, accessibility (axe), all designed states | every PR |
| End-to-end | 10 to 20 critical journeys, for example take attendance offline then sync, pay a fee, publish results, switch child | pre-merge on main, nightly full |
| Visual regression | key screens at 360, 768 and 1280 px | PR with diff review |
| Performance | Lighthouse CI budgets, bundle-size diff, interaction traces for INP, query-count tests | PR fails on regression above 5 percent \[P\] |
| Load | k6 or similar with a school-day traffic shape (section 7.1) including the morning burst | before major releases and quarterly |
| Soak and chaos | memory growth over hours; Redis down, replica lag, slow SMS provider, DB failover | scheduled game days |
| Security | tenant-isolation fuzzing, signed-URL scope, authorisation matrix | every release |

Priorities: business-critical paths (money, marks, attendance, permissions), error handling, data integrity. Skip trivial getters and framework code.

### 10.3 Performance and UX debt register

- Categories: code, architecture, test, dependency, documentation, infrastructure.
- Score each item Impact (1 to 5), Risk (1 to 5), Effort (1 to 5): priority = (Impact + Risk) x (6 - Effort).
- Typical entries: missing index, N+1 endpoint, unvirtualized table, unused heavy dependency, missing tenant-key test, untested offline path.
- Rule: a shortcut that breaks a budget needs a register entry with an owner and a date; reserve roughly 15 to 20 percent of capacity for the top items \[R\].

### 10.4 Decisions to record first (ADRs)

1. Rendering model (Next.js Cache Components versus SPA plus API versus other).
2. Tenancy model and shard router.
3. Cache layers and freshness classes.
4. Offline sync and conflict policy.
5. Realtime transport.
6. CDN, regions and disaster recovery.
7. Queue technology and fairness policy.
8. Observability stack.

Template, stored as `docs/adr/NNN-title.md`: Status (proposed, accepted, deprecated, superseded); Date; Deciders; Context; Decision; Options considered (table with complexity, cost, scalability, team familiarity); Trade-off analysis; Consequences (easier, harder, to revisit); Action items. The agent writes an ADR whenever it makes a decision of one of these types.

### 10.5 Validating the UX rules with people

Rules are hypotheses until tested with users. Personas: teacher, front-office staff, accountant, principal, parent.

| Method | Use | Sample |
| --- | --- | --- |
| Contextual interviews | watch the real morning attendance routine and fee counter | 5 to 8 per persona |
| Usability tests on the top 5 tasks | task completion, time on task, errors, SUS score | 5 to 8 per persona |
| Card sort or tree test | confirm navigation labels (2.6) | 15 to 30 for card sort |
| Diary study on low-connectivity use | find offline failures | 10 to 15 |
| Survey | quantify satisfaction after launch | 100 or more |
| A/B test | compare two designs only with enough traffic for significance | per power calculation |

In-product, track task completion time, error and retry rate, offline-queue depth and time-to-sync, and abandonment per step.

## 11. Agent protocol and workflows (root `AGENTS.md` plus workflows folder)

### 11.1 Protocol for every UI or API task

1. Classify: persona, screen class (5.1), freshness class of each data item (4.1), device tier, data sensitivity.
2. State the applicable budgets from section 1 before writing code.
3. Choose patterns from sections 4 to 8; if none fits, write an ADR.
4. Implement with a fallback for every optional or Chromium-only API, and test with that API stubbed out.
5. Verify with the tooling available (type check, tests, bundle analyser, axe, Lighthouse CI, query-count test) and record the output.
6. Report: what was measured and what was not, deviations from budgets, new dependencies with their size, ADR links.

### 11.2 Hard rules

- Never state a performance number that was not measured; label estimates \[A\].
- Never cache authenticated data without a tenant-scoped key; never skip the tenant filter on a query.
- Never swallow a failed write; always surface state and a retry.
- Ask before adding a dependency above 20 KB brotli \[P\]; prefer platform features, and prefer deleting code to optimising it.
- Precedence when rules conflict: tenant isolation and minors' data rules, then accessibility, then section 1 budgets, then the rest. An explicit developer instruction wins unless it breaks those first three; then the agent flags the conflict and asks.

### 11.3 Workflows (slash commands)

- `/new-screen`: capture persona and task; pick screen class and morphology; list data items with freshness classes; design all states; apply accessibility and copy rules; implement; measure; report with the definition of done (9.4).
- `/perf-audit`: collect field p75 by route and device class; split LCP into its four subparts; read INP attribution; diff bundles; list the top 5 queries by total time; propose ranked fixes using the debt formula (10.3).
- `/cache-review`: list every cache with layer, freshness class, key (contains tenant?), TTL, invalidation, stampede defence and failure behaviour.
- `/tenant-isolation-check`: lint for missing tenant filters; test row-level security policies; run the cross-tenant cache poisoning test; verify signed-URL scope.

### 11.4 Open decisions for the product owner

Hosting provider and regions; web framework (Next.js or other); launch languages and boards; offline scope for the first release; WhatsApp and SMS providers; payment gateway; expected tenant size distribution; whether any tenant needs a dedicated database at launch.

## Sources and verification status

| Claim area | Source used this session | Status |
| --- | --- | --- |
| Core Web Vitals thresholds and p75 assessment | https://rgb.ir/en/blog/core-web-vitals-thresholds-2026/ (states thresholds unchanged, checked 14 August 2026); https://pulsetic.com/glossary/core-web-vitals/ | \[V\] secondary sources: confirm at web.dev |
| LCP subparts, fetchpriority, INP breakdown, scheduler.yield, LoAF attribution | https://cdn.jsdelivr.net/npm/bmad-plus@0.9.0/src/bmad-plus/packs/pack-seo/ref/cwv-thresholds.md; https://debugbear.com/blog/2024-in-web-performance | \[V\] secondary |
| Speculation Rules behaviour and case data | https://www.corewebvitals.io/pagespeed/prerender-until-script-speculation-rule | \[V\] single source for the case numbers |
| Next.js 16 Cache Components, React Compiler stable, React 19.2 | https://nextjs.org/blog/next-16; https://nextjs.org/docs/app/api-reference/next-config-js/cacheComponents | \[V\] primary |
| Antigravity rules files and 12,000-character cap | https://thepromptshelf.dev/blog/google-antigravity-agents-md-rules-guide-2026/; https://zenn.dev/imkohenauser/articles/antigravity-gemini-rules-workflows-ja | \[V\] third-party; confirm in your IDE |
| DPDP Rules 2025 | https://www.ey.com/en\_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025; https://dsklegal.com/?p=26455; https://www.raysolute.com/dpdpa-compliance-guide-schools.html | \[V\] secondary; get legal review |
| Everything tagged \[P\], \[A\], \[R\] | engineering practice, not measured here | validate on your stack with section 10 |

Not verified in this session: exact Antigravity activation modes per version, CDN point-of-presence coverage per Indian ISP, browser support tables for non-Chromium APIs, and all numeric budgets marked \[P\].
