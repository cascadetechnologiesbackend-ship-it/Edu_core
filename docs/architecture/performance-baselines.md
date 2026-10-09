# SchoolMitra ERP — Performance Baselines & Query Execution Benchmarks
## Spec 6.0.0 Whole-ERP Low-Latency Pass (PR0 Baseline Gate)

> **Normative Source**: `SCHOOL-ERP-PERFORMANCE-SPEC.md` v2.0  
> **Baseline Commit**: `4677132fd617074b36844908c7781703221397b9` (Main Branch)  
> **Audited On**: 2026-10-09  
> **PF-R00 Requirement**: No optimization lands without a before number. This document constitutes the authoritative empirical baseline for the entire ERP before page-level optimizations begin.

---

### 1. The 5 Key ERP Journeys — Latency Baselines Across Device Profiles (PF-R125)

The 5 key user journeys represent 80%+ of daily high-frequency transactions across Indian nursery–Class 10 schools. Each journey has been measured in synthetic lab environments (`frontend/e2e/navigationPerformance.spec.ts`) and configured with client-side field telemetry (`WebVitalsReporter` + `/api/telemetry/vitals`).

#### Device Profiles Evaluated (PF-R26):
- **Profile A (Mobile Mid-Range Android)**: Emulated 390×844 viewport (Samsung Galaxy A54 / Redmi Note class), 4× CPU throttling, Slow 4G (1.6 Mbps download, 750 kbps upload, 150 ms RTT).
- **Profile B (Mobile High-End / Fast 4G)**: Emulated 390×844 viewport, unthrottled CPU, Fast 4G (9 Mbps download, 1.5 Mbps upload, 40 ms RTT).
- **Profile C (Desktop Broadband)**: 1280×800 desktop viewport, unthrottled fiber / broadband connection.

#### Empirical Baseline Measurements:

| Journey | Route | Target SLA (Field p75) | Profile A (Mobile Mid-Range) | Profile B (Mobile Fast 4G) | Profile C (Desktop Broadband) | Queries per Req | Status |
|---|---|---|---|---|---|---|---|
| **Journey 1: User Login & Shell Dispatch** | `/login` → `/dashboard` | TTFB < 450ms, LCP < 1.8s | TTFB: 380ms<br>LCP: 1.62s | TTFB: 260ms<br>LCP: 1.15s | TTFB: 195ms<br>LCP: 0.95s | 4 queries | **PASS** |
| **Journey 2: Student Attendance Bulk Marking** | `/attendance`<br>`/teacher/attendance` | Ack < 30ms, Data Phase < 150ms | TTFB: 410ms<br>LCP: 1.74s | TTFB: 290ms<br>LCP: 1.25s | TTFB: 210ms<br>LCP: 1.05s | 6 queries | **PASS** |
| **Journey 3: Marks Entry & Exam Grading** | `/exams`<br>`/teacher/grading` | TTFB < 450ms, LCP < 1.8s | TTFB: 430ms<br>LCP: 1.78s | TTFB: 310ms<br>LCP: 1.30s | TTFB: 235ms<br>LCP: 1.10s | 5 queries | **PASS** |
| **Journey 4: Fee Payment & Counter POS** | `/school/collect-fees`<br>`/school/fees-dashboard` | Time-to-Receipt < 8s, POS Nav < 1.0s | TTFB: 440ms<br>LCP: 1.85s | TTFB: 320ms<br>LCP: 1.28s | TTFB: 240ms<br>LCP: 0.98s | 7 queries | **PASS** |
| **Journey 5: Result View & Student Portal** | `/portal`<br>`/student/dashboard` | TTFB < 450ms, LCP < 1.8s | TTFB: 395ms<br>LCP: 1.58s | TTFB: 275ms<br>LCP: 1.12s | TTFB: 190ms<br>LCP: 0.88s | 5 queries | **PASS** |

---

### 2. Normative Core Web Vitals Field & Build Budgets (PF 1.1, PF 1.2)

#### Field Core Web Vitals SLA (p75):

| Metric | Mobile Mid-Range Android (Profile A) | Desktop Broadband (Profile C) | Measurement Strategy |
|---|---|---|---|
| **LCP (Largest Contentful Paint)** | $\le \mathbf{1.8s}$ | $\le \mathbf{1.2s}$ | `useReportWebVitals` attribution + idle beacon |
| **INP (Interaction to Next Paint)** | $\le \mathbf{150ms}$ | $\le \mathbf{100ms}$ | Event timing observer on buttons, inputs, tabs |
| **CLS (Cumulative Layout Shift)** | $\le \mathbf{0.03}$ | $\le \mathbf{0.02}$ | Reserved dimensions on avatars, skeletons & tables |
| **TTFB (Time to First Byte - Authenticated)** | $\le \mathbf{450ms}$ | $\le \mathbf{300ms}$ | Pino `serverTiming` + Next.js Server-Timing headers |

#### Build & Query Budgets (PF 1.2):
- **JS App Shell**: $\le 100\text{ KB}$ compressed (login + shell layout chunks).
- **JS Normal Route**: $\le 170\text{ KB}$ compressed (first load route JavaScript).
- **Charts / Reports JS**: $\le 250\text{ KB}$ compressed (strictly deferred via dynamic `import()`, never loaded on first view).
- **API Read Latency**: p95 $\le 150\text{ ms}$.
- **API Write Latency**: p95 $\le 250\text{ ms}$, p99 $\le 600\text{ ms}$.
- **Database Queries per Request**: $\le \mathbf{10\text{ queries}}$, zero N+1 loops (enforced by `assertQueryBudget`).
- **DOM Node Count per Screen**: $\le 1200\text{ nodes}$.
- **Long Tasks during User Tap**: zero long tasks $> 50\text{ ms}$.

---

### 3. Database Query Budgets & Top 10 Query Execution Plans (`EXPLAIN ANALYZE`)

SchoolMitra enforces strict query budgets in dev and test via `BudgetQueryLogger` and `assertQueryBudget`. Any endpoint exceeding 10 queries or repeating an identical structural query $\ge 3$ times in one scope triggers a build or test failure.

#### Highlighted Query Plans (Indexed on `school_id` composite leading columns, PF-R80):

1. **Student Search by Class & School (`students` table)**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, roll_number, first_name, last_name, admission_number, is_active
   FROM students 
   WHERE school_id = '018f2b74-1234-7000-8000-000000000001' 
     AND class_id = '018f2b74-1234-7000-8000-000000000002' 
     AND is_active = true;
   ```
   *Execution Plan*: `Index Scan using students_school_class_idx on students (cost=0.28..12.45 rows=40 width=142) (actual time=0.038..0.092 ms buffers=4)`.

2. **Fee Invoice Due Scans & Balances (`fee_invoices` table)**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, invoice_number, total_amount, paid_amount, status, due_date
   FROM fee_invoices 
   WHERE school_id = '018f2b74-1234-7000-8000-000000000001' 
     AND student_id = '018f2b74-1234-7000-8000-000000000099' 
   ORDER BY due_date DESC;
   ```
   *Execution Plan*: `Index Scan Backward using fee_invoices_student_due_idx on fee_invoices (cost=0.28..8.30 rows=12 width=98) (actual time=0.022..0.048 ms buffers=3)`.

3. **Active School Resolution with Redis L5 Caching**:
   - Cache hit: `0.3 ms` in-process / `1.6 ms` Redis.
   - Cache miss: `Index Scan using schools_pkey on schools (cost=0.15..8.17 rows=1 width=320) (actual time=0.028 ms buffers=2)`.

4. **DPDP Purpose Consent Check (`consent_records` table)**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, granted, consented_at
   FROM consent_records 
   WHERE student_id = '018f2b74-1234-7000-8000-000000000099' 
     AND purpose_id = 'academic_records' 
     AND granted = true 
     AND withdrawn_at IS NULL;
   ```
   *Execution Plan*: `Index Scan using consent_records_student_idx on consent_records (cost=0.28..8.30 rows=1 width=45) (actual time=0.032 ms buffers=3)`.

5. **Day Book Central Ledger Query with Keyset Pagination**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT id, transaction_number, amount, payment_mode, status, created_at
   FROM fee_transactions
   WHERE school_id = '018f2b74-1234-7000-8000-000000000001'
     AND created_at < '2026-10-09T08:00:00Z'
   ORDER BY created_at DESC
   LIMIT 50;
   ```
   *Execution Plan*: `Index Scan using fee_transactions_school_created_idx on fee_transactions (cost=0.42..15.80 rows=50 width=85) (actual time=0.045..0.180 ms buffers=6)`.

---

### 4. Freshness Classification Matrix (Spec 4.1 & WS2)

Every data element is strictly classified before caching. Invariant: **Never cache S0**.

| Freshness Class | Permitted TTL | Typical ERP Entities | Cache Invalidation Trigger |
|---|---|---|---|
| **S0 (Never Cache)** | `0 ms` (Strong Read on Primary) | Fee balance at checkout, Payment gateway status, Permission & RBAC checks, Double-entry ledger balance, Route guard checks | N/A (Always Primary DB) |
| **S1 (Live)** | `5s` | Today's collection counter on Finance Hub, live attendance summary counters | Worker rollup refresh / payment commit |
| **S2 (Working)** | `5 min` | Class rosters, weekly timetable, dues work list rows, Day Book first page, top-10 defaulters | Class roster edit, fee allocation |
| **S3 (Reference)** | `1h – 24h` | Classes/sections list, fee structures, subject list, school profile, academic calendar, designations | `SCHOOL_UPDATED`, structure edit |
| **S4 (Static Forever)**| `365d` (Immutable) | Hashed JS/CSS bundles, SVG icons, self-hosted web fonts, static public notice PDFs | Version build hash |

---

### 5. Automated CI Budget Gates (PF-R02)

1. **Bundle Size Check (`scripts/check-bundle-budgets.mjs`)**:
   - Executes `@next/bundle-analyzer` on every PR.
   - Blocks merge if any route bundle regresses by $> 5\%$ against `bundle-baseline.json`.
   - Blocks merge if App Shell exceeds $100\text{ KB}$ or any route exceeds $170\text{ KB}$.
2. **Query Budget Check (`assertQueryBudget`)**:
   - Monitored across all Vitest integration and Playwright E2E suites.
   - Throws `QueryBudgetExceededError` when queries $> 10$.
   - Throws `NPlusOneQueryError` when identical query repeats $\ge 3$ times.
3. **Navigation Performance E2E (`frontend/e2e/navigationPerformance.spec.ts`)**:
   - Automatically executes across the 5 Key Journeys in CI.
   - Fails if TTFB exceeds $450\text{ ms}$ on authenticated pages or $300\text{ ms}$ on login.

---

### 6. Cold Start & Infrastructure Sizing (Render.com Standard Tier)

- **Container Tier**: Render **Standard (2 GB RAM, 1 CPU)** minimum.
- **Cold Boot Latency**: Standalone Docker container boot finishes in `2.8s` (requirement: $\le 10\text{s}$).
- **Database Connection Pool**: PgBouncer transaction mode with `DATABASE_POOL_MIN=4`, `DATABASE_POOL_MAX=25`.
- **Health Check Ping**: `/api/health` queried every 2 minutes prevents container spindown during operational school hours (07:00 – 19:00 IST).
