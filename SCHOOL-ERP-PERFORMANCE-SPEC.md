# School ERP: Performance, Scale and Safety Spec (v2.0)

**What this file is:** the rulebook for speed, caching, servers, data, busy-hour traffic and keeping the system safe and up.
**Who reads it:** the AI coding agent (Antigravity or similar) and the human team.
**Its partner file:** `SCHOOL-ERP-UIUX-SPEC.md` (what the user sees and does).
**Based on:** the winning document ("Advanced UX & Performance Spec, Antigravity Rule Pack"), split, rewritten and extended.

---

## 0. How to read and use this file

### 0.1 Tags on facts and numbers

| Tag | Meaning |
|---|---|
| [V] | Checked against a source by the earlier document. Re-check at the official site before you depend on it. |
| [P] | A target we chose. Start here, then tune with real data. |
| [A] | A guess used for planning. Replace with real measurement. |
| [R] | A common rule of thumb. Not tested here. |

**PF-R00 Never say a speed number that was not measured.** Label guesses [A]. If you cannot run a tool, write "unmeasured" and give the exact command to measure.

### 0.2 Rule format

Every rule has an ID such as `PF-R12`. The agent names the rule ID it followed, or says which it broke and why. Each rule has: **Rule**, **Why**, **Test**, **Fallback**. Every speed trick must ship with its fallback in the same change, plus a test that forces the fallback to run.

### 0.3 Boundaries (Always / Ask first / Never)

**Always**
- Put the school (tenant) id in every cache key, every database query and every queue topic.
- Give every cache a freshness class (section 4.1) before adding it.
- Put slow work (over about 1 second) in a background queue.
- Surface the real state of every save (waiting, saved, failed). Never drop a write silently.

**Ask first**
- Adding a library over 20 KB (compressed).
- Adding a new layer (cache, queue, shard, service). Show measured evidence first.
- Anything that changes how money, marks or attendance are saved.

**Never**
- Cache logged-in data without a school-scoped key.
- Run a database query without the school filter.
- Share a cached page with personal data between users.
- Use "stale data allowed" caching for money, permissions or results gating.
- Put third-party scripts on logged-in screens (payment tool on the pay screen only, loaded on demand).

### 0.4 Priority when rules clash

1. School isolation and children's data safety
2. Access for all people (see UI/UX Spec)
3. The budgets in section 1
4. Everything else

### 0.5 Context pack (what to load for each job)

| Job | Load these sections |
|---|---|
| Any frontend change | 0, 1, 2, 3, 5 |
| Add or change a cache | 0, 4, 8 |
| Add or change an API or database query | 0, 6, 7 |
| Busy-hour or reliability work | 0, 7, 8 |
| Speed audit | 0, 1, 3, 9 |

---

## 1. Speed budgets (the contract)

### 1.1 Real-user numbers (field data)

Google judges the 75th percentile (p75): 3 out of 4 real visits must be at or better than the line. It looks at mobile and desktop separately over a rolling 28 days. [V]

| Measure | What it means | Google "good" at p75 [V] | Our budget: mid-range Android on Indian mobile networks [P] | Our budget: desktop [P] |
|---|---|---|---|---|
| LCP | Time until the biggest thing on screen appears | 2.5 s or less | 1.8 s or less | 1.2 s or less |
| INP | How fast the screen reacts after a tap or key | 200 ms or less | 150 ms or less | 100 ms or less |
| CLS | How much the page jumps while loading | 0.1 or less | 0.03 or less | 0.02 or less |
| TTFB | Time until the first byte arrives | About 0.8 s or less [V, secondary] | Cached shell 200 ms or less. Logged-in dynamic page 450 ms or less | 300 ms or less |

- INP replaced the older FID measure in March 2024. [V] Use INP, never FID.
- LCP is the sum of four parts: TTFB, resource load delay, resource load time, and element render delay. [V] Always fix LCP by part, never as one number (section 3.1).
- The earlier idea "LCP under 1.2 s and CLS exactly 0 for every user" is **not** a realistic pass/fail line for logged-in pages on mid-range phones. Treat 1.2 s as a lab goal, and use the table above as the pass/fail line.

### 1.2 Build budgets (fail the change if worse by more than 5%) [P]

| Item | Budget |
|---|---|
| JavaScript at start (compressed with brotli): login and app shell | 100 KB or less |
| JavaScript for a normal route | 170 KB or less |
| Report and chart code | Load later. 250 KB or less. Never on the first path |
| LCP element | Present in the first HTML from the server. On dashboards, prefer a heading or table over an image |
| Image used as LCP | 100 KB or less, with width, height and `fetchpriority="high"` [V for fetchpriority] |
| Long tasks during a tap | None over 50 ms |
| API read, p95 | 150 ms or less |
| API write, p95 | 250 ms or less (p99 600 ms or less) |
| Database queries per request | 10 or fewer. No N+1 |
| Page parts (DOM nodes) per screen | 1,200 or fewer. Large-page warnings start near 800 [R] |
| Memory on grid screens | 50 MB or less on a mid-range phone |
| Third-party scripts on logged-in screens | None (payment tool on the pay screen only, loaded on demand) |

### 1.3 Test profile

Use Lighthouse mobile default (about 4x slower CPU, simulated slow 4G) [R], plus one real low-end and one real mid-range Android phone, plus a desktop. Lab numbers never replace field p75. Report both.

### 1.4 Rule list for budgets

- **PF-R01** Every change that touches a route attaches before and after numbers: bundle size, lab LCP, a tap trace, and query count.
- **PF-R02** Budgets are checked in the build. A failed budget fails the build. [P]
- **PF-R03** Track speed by route, device level, school size and language, never as one average.

---

## 2. The -logies (thinking tools) for performance

### 2.1 Methodology: measure, set a budget, change, measure again

- **Plain meaning:** no speed claim without a number from a named tool.
- **Rules:** PF-R00, PF-R01.
- **Example:** before tuning the Gradebook, record INP for a 40-row class and a 400-row class.
- **Fallback:** if no browser can run here, write "unmeasured" and give the command.
- **Test:** Lighthouse CI, bundle report and query-count test output are attached.

### 2.2 Topology: where servers, data and caches sit

- **Plain meaning:** distance is time. Put things close to users.
- **Rules:**
  - **PF-R04** Main region in India. A second India region for disaster recovery where the cloud offers one. [R]
  - **PF-R05** App servers and database in the same region, same zone if possible.
  - **PF-R06** Use a CDN (a network of servers near users that keeps copies) with Indian points of presence, tested from Jio, Airtel and Vi. [R]
  - **PF-R07** Static and public files go to the CDN edge. Logged-in pages are private and never shared between users unless the key holds school and user.
- **Example:** a parent in a small city opens the fee page. The CDN gives the shell. The main region gives the personal data.
- **Fallback:** CDN miss goes through an origin shield. Region loss moves the app to read-only with the last copied data.
- **Test:** test pings from several Indian networks. Watch the shield hit rate.

### 2.3 Chronology: the order of loading, and the school calendar

- **Plain meaning:** what loads first matters. And school life has busy hours that we can predict.
- **Rules:**
  - **PF-R08** Load order: HTML, then critical CSS, then the LCP item, then JavaScript. Everything else waits.
  - **PF-R09** Non-urgent work runs when the device is idle (`requestIdleCallback`, `scheduler.postTask` where present, `setTimeout` fallback).
  - **PF-R10** Warm caches before known busy hours (section 7).
- **Example:** at 07:30 a job loads today's timetable, rosters and teacher home data for schools that start at 08:00.
- **Fallback:** if warming fails, a cold start still meets budgets by streaming a placeholder shell.
- **Test:** compare cache hit rate at 08:00 and at 14:00 on the dashboard.

### 2.4 Pathology: known bad patterns, how to spot them, how to fix them

| Bad pattern | Sign | How to detect | Fix |
|---|---|---|---|
| N+1 queries | Slower as lists grow | Query counter test | Join or batch loader |
| Deep OFFSET paging | Late pages are slow | Slow-query log | Keyset paging |
| List endpoint with no limit | Memory spikes, timeouts | Lint for max page size | Enforce limit and cursor |
| PDF or report built inside the request | p99 spikes | Trace spans over 1 s | Queue job plus progress |
| Cache stampede (many requests hit the database when a hot key expires) | Database spike | Miss-rate graph | Single-flight, jittered TTL, stale-while-revalidate |
| Retry storm | Chain failure | Retry counters | Backoff with jitter and a retry budget |
| Layout thrash (reading and writing layout in a loop) | High INP | Trace | Batch reads, then writes |
| Listener or timer leak | Memory growth, jank | Heap snapshot compare | Clean up in effects |
| Hot school (one tenant uses too much) | One shard saturated | Per-tenant metrics | Rate limit, move to own shard |

- **PF-R11** Each bad pattern has a lint, test or alert. The first three block the build.

### 2.5 Phenomenology: how fast it FEELS (shared with UI/UX Spec)

- Show feedback in 100 ms. Use placeholders after 300 ms. Show progress after 1 s. Move work to the background after 10 s.
- **PF-R12** Slow work shows "Started, we'll notify you" within 1 second.

### 2.6 Ontology: one vocabulary across screen, API and database (shared with UI/UX Spec)

- **PF-R13** Cache keys, queue topics, shard keys and permission scopes follow the school hierarchy: `tenant : institution : academic_year : entity : id`. No ad-hoc keys.
- **PF-R14** Every row has `tenant_id`. Rows tied to a year have `academic_year_id`.

### 2.7 Etiology: find the real cause of slowness

- **Plain meaning:** trace a slow screen back to its root (code, data or network), not only treat the sign.
- **Rules:**
  - **PF-R15** Every key route sends speed events with route, role, school size, memory bucket, connection type, language and app version. No student identifiers.
  - **PF-R16** Every slow-alert links to a runbook that names the suspect layer, the check to run, and the way to roll back.

### 2.8 Hardware-software contract

Speed is how software uses real hardware. Section 3 lists each part and what the software must do.

---

## 3. Hardware and software connection

### 3.1 LCP by part: what limits each part

| LCP part | Hardware limit | What software can do | Fallback |
|---|---|---|---|
| TTFB | Server CPU, database disk, network trip to origin | Static shell at the edge; main region in India; connection pooling; covering indexes; streamed responses; per-school caching | Send shell and placeholder first, stream the rest |
| Resource load delay | Client waits idle until the browser finds the item | LCP item in the first HTML; `fetchpriority="high"` for an LCP image [V]; preload only if discovery is late; never lazy-load the LCP image; never add the LCP item with JavaScript | If LCP is data-driven, render its box and a text placeholder in HTML |
| Resource load time | Bandwidth, radio, TCP or QUIC | Fewer bytes (AVIF or WebP, brotli); HTTP/2 or HTTP/3; CDN; `srcset` | Honor Save-Data and send lighter images |
| Element render delay | Main-thread CPU, GPU | Less blocking CSS and JS; no client-only LCP item; font plan (3.4); less hydration with server components | System font with matched sizes |

HTTP/3 and 103 Early Hints support differs by CDN and client. [R] Turn them on where verified. Never depend on them.

### 3.2 Client (phone and browser) map

| Resource | Limit on low-end devices | Rule | Fallback |
|---|---|---|---|
| Main thread (CPU) | Only one thread; JS parse and run dominate | **PF-R20** Keep tasks under 50 ms. Use `scheduler.yield()` (Chrome-family only) [V]. Heavy work (CSV or XLSX import, sorting over 5,000 rows, report preview) goes in a Web Worker. Worker count: min(4, cores minus 1) [R] | `setTimeout` or MessageChannel yield; chunked work with no worker |
| GPU and compositor | Weak GPU; too many layers cause jank | **PF-R21** Animate only `transform` and `opacity`. Use `will-change` briefly. Use `content-visibility: auto` for off-screen parts [R]. Respect reduce-motion | No animation |
| Memory (RAM) | Background tabs are dropped; GC pauses | **PF-R22** Save drafts to IndexedDB at every field blur. Virtualize lists (draw only visible rows). Limit query cache lifetime. Heap budget 50 MB [P]. Treat `navigator.deviceMemory` (Chrome only) as a hint. If missing, assume low [R] | Lighter tier by default |
| Storage | Quotas; IndexedDB blocked in some private modes | **PF-R23** IndexedDB for data, Cache Storage for files. Ask for `navigator.storage.persist()`. Handle quota errors | Memory-only mode with a notice "changes not saved offline" |
| Network radio | High delay; data packs cost money | **PF-R24** Batch requests. Max 3 preconnect hosts. No polling faster than every 30 s. SSE or WebSocket with backoff and jitter. Pause when hidden. Use `saveData` and `effectiveType` (Chrome only) to pick a lighter tier | The light tier is the default |
| Battery and heat | CPU slows under steady load | **PF-R25** No endless animation or timers on idle screens | Static state |

Avoid cross-origin isolation (needed for SharedArrayBuffer) unless a measured need exists. It can break payment pages and video embeds. [R]

### 3.3 Device tiers

- **PF-R26** At start, sort the device into LOW, MID or HIGH using the signals above (memory, cores, saveData, connection, screen). If a signal is missing, use MID. If saveData is on, treat as LOW. If everything fails, use the minimal mobile mode.
- Tier controls: placeholders vs images, early page loading on or off, worker use, list buffer size, animation level, image size, first page size.
- Send the tier with every speed event so problems can be sliced by tier.
- **Example:** HIGH tier gets prerendered next pages and dense grids. LOW tier gets a static shell, 25-row pages and opacity-only changes, and still aims for LCP under 2.0 s on 3G.

### 3.4 Fonts for Indian scripts

- **PF-R27** Host fonts yourself. Make a separate subset per script (`unicode-range`). Load only the user's script. Preload only the main file.
- **PF-R28** Use `font-display: swap` with `size-adjust` and metric overrides on the fallback so the swap does not move text.
- Fallback: system fonts (Noto-family fonts ship on most Android phones [R]).
- Test: CLS in a lab run on the slowest network with each script.

### 3.5 Server hardware map

| Resource | Rule | Check |
|---|---|---|
| CPU | **PF-R30** Node's event loop has one thread: no blocking work in handlers. PDFs, image resizing, report cards and imports go to a worker queue. Scale on p95 delay and queue age, not CPU only [R] | Event-loop delay p99 under 100 ms [P] |
| Postgres memory | `shared_buffers` about 25% of RAM to start; `effective_cache_size` about 50 to 75% [R]. `work_mem` is per sort step per connection: raise it per session for reports, never globally | Buffer cache hit 99% or more on busy tables [R] |
| Redis or Valkey | Set `maxmemory`. `allkeys-lru` for pure cache. A separate instance with `noeviction` for queues and locks [R] | Eviction graph |
| Disk | NVMe SSD for the database. Hot indexes fit in RAM. Write-ahead log on a fast volume [R] | p95 disk delay |
| Network | App and database in the same zone; database round trip near 1 ms [P]. Keep-alive pools. Static files pre-compressed with brotli. Dynamic responses brotli or gzip at level 4 to 5 [R] | Round-trip histogram |
| Connections | PgBouncer in transaction mode. Start with active connections at 2 to 4 times the cores [R]. Session-level `SET` breaks under transaction pooling, so use `SET LOCAL` | Pool wait p95 |

### 3.6 Load shedding (drop the least important work when stressed)

- Trigger [P]: CPU over 85% for 2 minutes, or queue age over 60 s, or p95 over 2x budget.
- **G1:** turn off non-critical widgets and analytics. **G2:** serve cached dashboards, reject low-priority jobs. **G3:** read-only mode. **G4:** static status page.
- **PF-R31** Send `429` with `Retry-After` to shed traffic. Clients back off with jitter. Never shed attendance or fee writes before analytics, exports and non-critical reads.

---

## 4. Caching

### 4.1 Freshness classes (pick one before adding any cache)

| Class | Examples | Max staleness [P] | Allowed layers | Method |
|---|---|---|---|---|
| S0: must be exact now | Payment status, fee balance when paying, permission changes, result-publish gating | 0 | None (`no-store`) | Read from the main database. Use idempotency keys |
| S1: live | Today's attendance, live counters | 5 s | Client memory, short Redis | Push or short revalidate |
| S2: working data | Rosters, timetable, homework | 5 min, refresh on focus | Client, IndexedDB, Redis | Stale-while-revalidate plus tag invalidation |
| S3: reference | Subjects, class lists, fee structures, calendar | 1 hour to 1 day | Client, IndexedDB, Redis | Long TTL plus event invalidation |
| S4: public static | Hashed JS and CSS, logos, fonts, public notices | Forever (new name on change) | CDN, browser | Content-hashed file names |

- **PF-R40** Stale-while-revalidate is allowed only for S2 and S3. Never for S0.

### 4.2 The cache ladder (closest to the user first)

| Layer | What lives here | Key and TTL | Invalidation | Fallback |
|---|---|---|---|---|
| L0 Client memory | Data for the current screen | Key has tenant, user, resource, params. `staleTime` by class. Limited `gcTime` | A save marks keys stale. Refetch on focus | Refetch |
| L1 Browser HTTP cache | Hashed files; API responses with validators | Files: `public, max-age=31536000, immutable`. APIs: `private, max-age=0, must-revalidate` with ETag. S0 and personal data: `no-store` [R] | New hash; conditional requests | Normal fetch |
| L2 Service worker and IndexedDB | App shell, last-known S2 and S3 data, outbox | Per-user database name. Versioned schema. Max age 7 days [P] | Schema bump; wipe on logout | Memory only |
| L3 CDN edge | Static files, public pages, prerendered shells | Long TTL for hashed files. Short TTL with revalidation for shells | Purge by tag on publish | Origin shield |
| L4 In-process LRU | School config, feature flags | 1 to 5 s | TTL only | Skip layer |
| L5 Redis or Valkey | S1 to S3 query results, sessions | `t:{tenant}:v{schema}:{resource}:{id}`. TTL with 10 to 20% jitter. Negative cache 5 to 30 s | Tag sets and events | Bypass with circuit breaker |
| L6 Database | Rollup tables, materialized views, read replicas | Refresh by schedule or event. Replica lag budget 2 s [P] | Refresh concurrently | Read the main database |

### 4.3 Rules

- **PF-R41** Writes commit together with an event (outbox pattern). Consumers purge tags like `tenant:42:class:7:roster`. Do not purge everything.
- **PF-R42** Stampede defense: single-flight (one fetch shared by all waiters), soft TTL shorter than hard TTL, jittered TTL, warm before busy hours.
- **PF-R43** Next.js: use `use cache` with `cacheLife` and `cacheTag`. Cache Components is opt-in and completes partial prerendering. [V] Check the Next.js 16 docs for `revalidateTag` versus `updateTag`. [V that both exist]
- **PF-R44** Client caches hold children's data: key per user, clear on logout (the `Clear-Site-Data` header where supported [R]), short max age. Do not persist marks or health notes on shared devices.

### 4.4 School-safe caching (non-negotiable)

- **PF-R45** The tenant id is part of every cache key. A URL alone is never a key for logged-in data.
- **PF-R46** Responses with `Set-Cookie` or personal data are `private`. A shared cache may keep them only if the key includes school and user (or role).
- **PF-R47** The build includes a cross-tenant poisoning test: school A writes, school B reads the same URL, and must see none of A's data.

### 4.5 Failure table

| Failure | What happens |
|---|---|
| Redis down | Bypass the cache. A circuit breaker and per-school rate limit protect the database. Serve L4 stale for up to 60 s [P] |
| CDN degraded | Fail over to a second CDN or to the origin with rate limits [R] |
| IndexedDB unavailable | Memory-only mode with a notice |
| Replica lag over budget | Send reads for affected schools to the main database |
| Invalidation event lost | Hard TTL limits the damage. A nightly job compares versions |

---

## 5. Rendering and data loading

### 5.1 Strategy by screen type

| Screen type | Strategy | Cache |
|---|---|---|
| Marketing, login, public notices | Static pages at the CDN | L3 |
| App shell and role home | Prerendered static shell, with personal parts streamed in (Next.js Cache Components) [V] | L3 shell, L5 data |
| Read-heavy detail (student profile, report card) | Server components with streaming. Client code only where interactive | L5 |
| Grids and editors | Client part with virtualization. First rows streamed from the server | L0, L2 |
| Live widgets (attendance counter) | SSE or WebSocket part | L0 |
| Money (fee payment) | Server rendering, strong consistency, no read model on the ledger | Lookups only in L5. Ledger always from the main database |

If not on Next.js, use the same shape: server-rendered shell plus small client parts. "CSR with TTI under 1 s" is not a standard measure. Use INP in the field and Total Blocking Time in the lab.

### 5.2 Rules

- **PF-R50** The LCP item is in the first HTML. Every tap handler gives feedback in 100 ms, then yields before heavy work.
- **PF-R51** No request waterfalls. Fetch in parallel at route level. Prefetch on hover or when visible through the framework link.
- **PF-R52** Speculation Rules & Dynamic Route Prefetch (Superseded & Refined): Blanket `<script type="speculationrules">` prerendering is SUPERSEDED for `force-dynamic` authenticated ERP routes. Because every admin module requires database auth verification and tenant queries, speculative prefetching of 10+ pages concurrently triggers a database connection storm (7–10s load latency). Production posture enforces: intentional hover-based prefetch (`onMouseEnter` with debounce) or viewport prefetch scoped strictly to static/cached pages. Never speculatively prefetch dynamic authenticated SSR pages or payment endpoints.
- **PF-R53** Enable the React Compiler (stable in Next.js 16 [V]). Remove blanket `useMemo` and `useCallback`. Add manual memo only where a profile shows a hot path.
- **PF-R54** Split code by route and by part for drawers, charts, report builders, rich text editors and payment tools.
- **PF-R55** Use `useTransition` and `useDeferredValue` for filters and search [R]. Debounce typeahead 150 to 250 ms [P].
- **PF-R56** Cache Components keeps state with React `<Activity>` when users navigate away [V]. Do not hold large grids in hidden routes.

### 5.3 CLS rules (no jumping)

- **PF-R57** Reserve space with width, height or `aspect-ratio` for images, avatars and charts.
- **PF-R58** Placeholder row height equals real row height. Virtual lists use fixed or measured heights.
- **PF-R59** Never insert content above the visible area after paint. Toasts and banners float, they do not push.

### 5.4 Images

- **PF-R60** AVIF or WebP with JPEG fallback through `<picture>`. Use `srcset` and `sizes`. Lazy-load only below the fold. Use `decoding="async"`. Make avatars in 48 and 96 px sizes.
- **PF-R61** Student photos and documents are behind signed URLs with short expiry. A worker makes thumbnails at upload.

### 5.5 API shape

- **PF-R62** List endpoints return only list fields. Detail endpoints return the full record. Use field selection or saved queries to avoid over-fetching.
- **PF-R63** Cursor paging, batching through a loader, compression, ETag on reads, idempotency keys on writes.
- **PF-R64** A batch attendance endpoint takes a whole class in one request and is safe to repeat per (student, date, period).
- **PF-R65** Compression: brotli at build time for static files. Brotli or zstd for dynamic data where supported. Fall back to gzip.
- **PF-R66** Delta loading: an endpoint can return only what changed since a cursor, so a parent's home opens with a few KB. If the cursor is old, fetch page 1.

### 5.6 Virtualization (draw only visible rows)

- **PF-R67** Never map a list longer than 50 items straight to page elements. Use virtualization with an overscan of 3 to 5 rows. [P]
- **PF-R68** Keep `aria-rowcount` and `aria-rowindex` correct. Browser find-in-page cannot see unrendered rows, so give in-app search.
- **PF-R69** Print and export views render in full on the server.
- Fallback: cursor paging when virtualization conflicts with access or print needs.

### 5.7 Live updates ladder

| Need | Method | Notes |
|---|---|---|
| Every minute or slower | Polling with ETag | Simple, cache-friendly |
| One-way live | SSE | Auto reconnect |
| Two-way or fast | WebSocket | Heartbeat and resume token |
| User not in the app | Push, WhatsApp or SMS | Consent and quiet hours |

Fallback chain: WebSocket, then SSE, then long polling, then short polling with backoff. Always use backoff with jitter. Pause when the tab is hidden. If live updates fail, quietly remove the live signs and show a "last updated" time.

---

## 6. Data layer and scale

### 6.1 Capacity method (a worked example where every input is a guess)

The method matters, not the numbers. Replace each [A] with measured values.

| Step | Value |
|---|---|
| Registered users (1 crore) | 10,000,000 [A] |
| Daily active share | 30%, so 3,000,000 [A] |
| Share of daily actives in the busiest 10 minutes | 15%, so 450,000 [A] |
| Requests per active user in that window | 20 [A] |
| Average rate | 450,000 x 20 = 9,000,000 requests in 600 s = 15,000 per second |
| Burst factor | 3, so 45,000 per second at peak [A] |
| Requests in flight (rate x average time) | 45,000 x 0.1 s = 4,500 [R] |
| Server count | Peak rate divided by (measured rate per server x 0.6). At 800 per second: 45,000 / 480, about 94 servers [A] |

- **PF-R70** Size origin servers from the cache-miss rate, not from the raw request rate. Show the cache hit ratio next to every capacity number.
- **PF-R71** Re-run this calculation every quarter with real data.
- **PF-R72** Do not "microservice" on day one. Start with one well-organized main app (a modular monolith) plus Redis, a CDN and a queue. Split out a service only when measured evidence shows the need. Architecture follows measurement.

### 6.2 What to copy from huge social apps, and what not to copy

**Copy**
- Small cache keys (IDs, not fat objects).
- A cache in front of nearly all reads. The database is the exception path.
- Files via object storage plus CDN, never through app servers.
- Stateless app servers with sessions in Redis, so any server can serve any school.
- Replicas with frequent backups.
- Compute once, serve many: pre-make results (push once) and pull live analytics when asked.

**Do not copy**
- Eventually-consistent data for money or "who is present today". Fees, receipts and attendance must be exact.
- Read models for the fee ledger. Use them only for dashboards.
- Infinite scroll. Schools need pages and search.
- Equating "crores of users" with crores of users at once. What keeps speed steady is fairness per school (rate limits, cache quotas, pool shares).

### 6.3 Tenancy models

| Model | Fits | Strength | Cost | Rule |
|---|---|---|---|---|
| Pooled: shared tables, `tenant_id` on every row, row-level security | Most small and mid schools | Cheapest and simplest | Noisy neighbors; one bad query hurts all | Default |
| Schema per tenant | Schools needing custom fields | Isolation, per-school backup | Migration time grows with school count | Use sparingly |
| Database per tenant (silo or "cell") | Big chains, public bodies, contracts demanding isolation | Strongest isolation, independent scale. A problem stays inside its cell | Highest cost and work | Promote on demand |
| Hybrid | All of the above together | Right size per school | Needs a router | Target [P] |

- **PF-R73** The shard key is `tenant_id` so joins stay inside one shard. A tenant router table maps school to shard. Moving a school is a tested runbook.
- **PF-R74** Row-level security is a second lock, not the only lock. Every query also filters by `tenant_id`, enforced by a lint rule and an isolation test. [R]
- **PF-R75** Evaluate the tenant setting once per statement (wrap `current_setting` in a sub-select). Set it with `SET LOCAL` in the transaction because PgBouncer transaction mode shares connections.
- **PF-R76** Every new costly action ships with its per-school limit (rate, cache share, queue priority, pool share).
- **PF-R77** Large schools can get their own worker pools when their calendar shows heavy peaks. Small schools stay packed together. School settings and feature flags are data, not releases.

### 6.4 Schema and query rules

- **PF-R80** Composite indexes start with the school: `(tenant_id, academic_year_id, class_id, student_id)`. Use partial indexes for active rows and `INCLUDE` columns for hot lists. [R]
- **PF-R81** Append-only tables (attendance log, audit log, notification log) are range-partitioned by month. Use BRIN indexes when data is stored in time order. [R]
- **PF-R82** Keyset paging (`WHERE (created_at, id) < ($1, $2)`) instead of deep OFFSET.
- **PF-R83** No `SELECT *`. List queries select list fields.
- **PF-R84** Every new hot query ships with `EXPLAIN (ANALYZE, BUFFERS)` output in the change.
- **PF-R85** Bulk writes use `COPY`, multi-row inserts or `UNNEST`. Repeat-safe writes use `ON CONFLICT`.
- **PF-R86** Zero-downtime changes use expand then contract: add a nullable column, fill in batches, switch reads, drop later.
- **PF-R87** Index only what queries need. Each index slows writes and takes RAM.
- **PF-R88** Never open raw, unpooled database connections inside serverless endpoints. Always use a pool (PgBouncer or RDS Proxy) and parameterized queries.

### 6.5 Read and write path

- **PF-R89** Writes go to the main database. Reads go to replicas with a lag budget of 2 s [P]. If lag is over 2 s, show "data as of X seconds ago". If lag is over 5 minutes, show a snapshot with a time stamp.
- **PF-R90** After a user saves, pin that user's reads to the main database for 5 s [P] (short cookie or a log-position token), so they never see old data after their own save.
- **PF-R91** Dashboards read pre-made rollup tables (daily attendance per class, fee collection per day), refreshed by background jobs. Not live totals over raw rows.
- **PF-R92** For burst writes (morning attendance, fee day, marks), put the write in a durable queue after a repeat check. Reply "received" fast (p95 under 30 ms [P]). Workers write in batches (for example 500 rows per transaction). Plan queue size for observed peak times 3. If the queue is full, show an honest "queued, will sync" state. Never drop a write. If the queue is down, write straight to the database with an upsert.
- **PF-R93** Money exception: payments and the fee ledger are written in one strong database transaction. Only notifications go to the queue.

### 6.6 Background work

- **PF-R94** Queue everything slower than about 1 s: report-card PDFs, bulk WhatsApp, SMS and email, reminder runs, imports and exports, year-end promotion.
- **PF-R95** Each job has an idempotency key, backoff with jitter, a dead-letter queue (a holding place for jobs that keep failing, with an admin tool) and an owner.
- **PF-R96** Fair share: concurrency limits per school so one school's bulk send cannot starve others.
- **PF-R97** The user sees "Started, we'll notify you" within 1 s. Progress arrives by SSE or notification.

---

## 7. Busy hours, resilience and keeping safe

### 7.1 School calendar playbook

| Event | Pattern | What to do |
|---|---|---|
| Morning attendance (about 08:00 to 09:30) | Many teachers write small records at once | Batch endpoint, repeat-safe per student, date and period. Optimistic UI with outbox. Rollups in the background. Warm rosters at 07:30 |
| Fee due dates, month start | Read spike plus payment callbacks | Invoice from cache (S3) but balance from the main database (S0). Verified, repeat-safe webhook handler. Queue the reconciliation |
| Result day | Everyone reads the same keys at once | Pre-make a file per student before the release time (for example at 3:40 for a 4:00 release [P]). Store behind signed CDN links. Stagger notifications. Rate-limited queue or waiting room for any live part |
| Parent-teacher booking | Fight over scarce slots | Conditional update or `SELECT ... FOR UPDATE SKIP LOCKED`. Clear "slot just taken" message |
| Marks upload | Big bulk writes | Worker import with a row-by-row report. Can resume |
| Year rollover | Huge background jobs | Checkpointed batches per school, off-peak, dry-run report first |

If the result files were not pre-made: fill lazily with single-flight (one origin miss per key, others wait). If autoscaling lags: show "checking your result…" with retry in 15 s, not a 502. If the publish job failed: use the live path on replicas and release in batches.

### 7.2 Resilience rules

- **PF-R100** Timeouts everywhere [P]. Browser to API: 10 s, retry only repeat-safe calls. API to database: statement timeout 2 s for normal work, 30 s for reports on a replica.
- **PF-R101** Circuit breakers and separate pools (bulkheads) per dependency, per school and per feature. A failing SMS provider must not slow attendance.
- **PF-R102** Feature flags double as kill switches. Every risky feature ships behind one.
- **PF-R103** Rate limits per school, per user and per IP. Separate budgets for bulk and interactive traffic. Writes are limited tighter than reads. If the limiter store is down, fail open with local approximate limits. Never lock a whole school out.
- **PF-R104** Retries: maximum 3, backoff with full jitter, only on repeat-safe calls. When retries run out, show a visible pending state. Never drop silently.
- **PF-R105** Autoscale on request delay and queue age. Add warm capacity before known peaks. Drain connections gracefully on deploy. [R]
- **PF-R106** Deploys go to 1 to 5% of schools first (canary), with automatic rollback on error rate or INP regression. [P]
- **PF-R107** Load shedding tiers G1 to G4 as in 3.6.

### 7.3 Degradation ladder (the fallback plan for every part)

| Level | State | What the user sees | Example |
|---|---|---|---|
| L0 | Full | Everything live | Normal school day |
| L1 | Fresh enough | Data with "as of HH:MM" | Replica lag over 2 s |
| L2 | Stale-serve | Cached snapshot with a banner; writes queued | Database slow |
| L3 | Offline-first | Local queue and "N changes pending" banner | Phone lost network mid-attendance |
| L4 | Read-only | Views work; changes blocked with a reason | Main database down |
| L5 | Shell survival | App shell, cached essentials, retry buttons | Total backend outage |

- **PF-R108** Every part must implement this ladder. The fallback code ships in the same change as the main mechanism. A blank error page is a spec violation.
- **PF-R109** Conflict rules for offline sync: repeat-keys prevent duplicates. Per-field last-write-wins with server version and `updated_at`. Hard conflicts open a side-by-side merge view. **Money fields never auto-merge**. They queue for server reconciliation.
- A regional outage: serve reads from the replica region in read-only mode with a banner. Never allow writes in two regions at once (split-brain).

### 7.4 Children's data and safety (engineering side)

- **PF-R110** Encrypt in transit and at rest. Keep an audit log. Keep retention jobs, export and erase endpoints, and a breach runbook with a 72-hour clock. [V, secondary; get legal review]
- **PF-R111** Speed events and logs carry no student names or IDs.
- **PF-R112** Photos and documents use signed URLs with short expiry. Signed-URL scope is tested every release.

---

## 8. Watching, testing and keeping the system healthy

### 8.1 Telemetry (what to measure in production)

- **PF-R120** Use the `web-vitals` library (attribution build) so INP reports include Long Animation Frame details. [V] Long Animation Frames exist in Chrome and Edge only. [V] Others get rough timing.
- **PF-R121** Tag each report with route, role, school size, memory bucket, connection type, language and app version. Report p75 and p95.
- **PF-R122** Server: OpenTelemetry traces. Rate, errors and duration per route. Slow-query stats. Cache hit ratio per layer. Queue depth and age. Event-loop delay. Replica lag.
- **PF-R123** Alerts [P]: INP p75 up 20% in 24 hours; LCP p75 over budget 2 hours in a row; cache hit ratio down 10 points; queue age over 60 s.
- **PF-R124** Targets [P]: core jobs (attendance, fee payment, result view) 99.9% monthly availability. Error budget under 0.1% failed requests per school. When the error budget is spent, feature work pauses until reliability work lands.
- **PF-R125** Synthetic tests: scheduled Lighthouse or WebPageTest runs on the 5 key journeys (login, attendance, marks entry, fee payment, result view) at 3 device profiles.

### 8.2 Testing strategy

| Layer | Scope | When |
|---|---|---|
| Unit | Fee, grade, attendance-percent logic, permission rules | Every commit |
| Integration | API with a real database. School-isolation tests. Migrations (expand then contract) | Every change |
| Contract | API schema checks between web, mobile and server | Every change |
| Component | Interaction, access checks, all states | Every change |
| End-to-end | 10 to 20 key journeys: attendance offline then sync, pay a fee, publish results, switch child | Before merge to main. Nightly full |
| Visual | Key screens at 360, 768 and 1280 px | Each change, with diff review |
| Performance | Lighthouse CI budgets, bundle-size diff, tap traces for INP, query-count tests | Change fails if worse by more than 5% [P] |
| Load | k6 or similar with a school-day traffic shape, including the morning burst | Before big releases and every quarter |
| Soak and chaos | Memory over hours. Redis down, replica lag, slow SMS provider, database failover, region loss | Scheduled game days (each quarter) |
| Security | School-isolation fuzzing, signed-URL scope, permission matrix | Every release |

- **PF-R126** Use real-looking data in tests: long names, big numbers, empty fields, native scripts.
- **PF-R127** Focus tests on money, marks, attendance, permissions, error handling and data integrity. Skip trivial getters and framework code.
- **PF-R128** Every degraded path has a test that forces it (kill Redis in the test setup, throttle the network, disable the worker).

### 8.3 Debt register

- Categories: code, architecture, test, dependency, documentation, infrastructure.
- Score each item Impact (1 to 5), Risk (1 to 5), Effort (1 to 5). **Priority = (Impact + Risk) x (6 minus Effort).**
- Typical items: missing index, N+1 endpoint, unvirtualized table, unused heavy dependency, missing school-key test, untested offline path.
- **PF-R129** A shortcut that breaks a budget needs a register entry with an owner and a date. Keep about 15 to 20% of capacity for the top items. [R]

### 8.4 Decisions to record first (decision records)

1. Rendering model (Next.js Cache Components, SPA plus API, or other).
2. Tenancy model and shard router.
3. Cache layers and freshness classes.
4. Offline sync and conflict policy.
5. Live update method.
6. CDN, regions and disaster recovery.
7. Queue technology and fairness policy.
8. Monitoring tools.

Template (saved as `docs/adr/NNN-title.md`): Status; Date; Deciders; Context; Decision; Options (complexity, cost, scale, team skill); Trade-offs; Effects (easier, harder, to revisit); Action items. The agent writes one whenever it makes a decision of one of these types.

---

## 9. Agent workflow for performance work

### 9.1 Steps for every feature or API task

1. **Classify:** persona, screen type, freshness class of each piece of data, device tier, how sensitive the data is.
2. **Journey and cache map first:** write the user's steps and the data needed at each step, and which cache layer holds each piece (with TTL and invalidation).
3. **Name the budgets** from section 1 that the change touches, before writing code.
4. **Pick patterns** from sections 3 to 7. If none fits, write a decision record.
5. **Build** with the fallback and its forcing test in the same change (PF-R128).
6. **Verify** at the 3 device profiles with the tools available. Attach the numbers. If not measured, write "unmeasured" and give the command.
7. **Report:** what was measured and what was not, budget breaks, new libraries with size, wire-size change on a mid-tier phone on 3G, per-school limits added, decision record links.

### 9.2 Hard rules

- **PF-R130** Never state a number that was not measured. Label guesses [A].
- **PF-R131** Never cache logged-in data without a school-scoped key. Never skip the school filter on a query.
- **PF-R132** Never swallow a failed write.
- **PF-R133** Ask before adding a library over 20 KB. Prefer platform features. Prefer deleting code to tuning it.
- **PF-R134** No new cache, queue or shard without measured evidence of the bottleneck.
- **PF-R135** Every change to a data contract states its size change on a mid-tier phone and on 3G.
- **PF-R136** Rule clashes follow the priority in 0.4. An explicit developer instruction wins unless it breaks priorities 1 to 3. Then flag the conflict and ask.

### 9.3 Commands

- `/perf-audit`: collect field p75 by route and device class; split LCP into its four parts; read INP details; compare bundles; list the top 5 queries by total time; propose ranked fixes using the debt formula (8.3).
- `/cache-review`: list every cache with layer, freshness class, key (does it contain the school?), TTL, invalidation, stampede defense and failure behavior.
- `/tenant-isolation-check`: lint for missing school filters; test row-level security; run the cross-tenant poisoning test; check signed-URL scope.
- `/burst-review`: for a feature, check it against the calendar in 7.1 and the capacity method in 6.1.
- `/chaos-drill`: plan a failure drill (Redis, queue, replica, region) and prove the ladder in 7.3 works before it is needed.

### 9.4 Open decisions for the product owner

Hosting provider and regions. Web framework (Next.js or other). Expected school size mix. Whether any school needs its own database at launch. Queue technology. Payment gateway. WhatsApp and SMS providers.

---

## 10. What was changed from the source document

| Source item | Problem | Fix here |
|---|---|---|
| Rule-pack split not tied to rule IDs | Hard to cite and test | Every rule has a PF- ID, a test and a fallback |
| One long file | Uses too much of the agent's memory | Context pack (0.5) and a UI/UX file kept apart |
| Capacity example looked like fact | Could mislead | Marked [A], method shown (6.1) |
| "Copy social apps" mixed advice | Money needs exact data | Copy and do-not-copy lists (6.2) |
| Cell idea only light | Big clients need strong isolation | Silo or cell model in 6.3 |
| Gaps in reads after writes | Users see old data | Read-after-write pinning (PF-R90) |
| Missing chaos plan | Fallbacks untested | PF-R128 and `/chaos-drill` |

**What was NOT verified:** exact Antigravity rule-file names and the 12,000-character file limit (check in your tool version), CDN coverage by Indian network, browser support for non-Chrome features, the exact DPDP start dates, and every [P] number. Confirm each on your own system.
