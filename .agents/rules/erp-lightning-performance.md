# ERP Lightning Performance & Speed of Light Guardrails

This rule enforces sub-100ms response times and ultra-responsive UI rendering across the SchoolMitra ERP.

## 1. Eliminate Database Query Waterfalls (N+1 Queries)
- **Parallelize Independent Queries**:
  - NEVER run sequential `await` calls for independent data fetches.
  - Always execute independent queries concurrently using `Promise.all([queryA, queryB, queryC])`.
- **Avoid Queries in Loops**:
  - NEVER execute queries inside `.map()`, `.forEach()`, or `for` loops.
  - Fetch related entities in bulk using `inArray(table.id, ids)` or relational joins (`with: { ... }`).

## 2. Multi-Level Caching for Master & Static Data
- **Request-Level Deduplication**:
  - Wrap tenant and master lookups (e.g. `getActiveTenant()`, `getActiveAcademicYear()`) in React `cache()` so redundant calls in the same render cycle cost 0ms.
- **Cross-Request Redis / In-Memory Caching**:
  - Frequently accessed, slow-changing master records (Fee Heads, Fee Structures, Class Lists, Subjects, Roles, System Settings) must be cached in Redis with appropriate cache keys (e.g., `feeStructures:${schoolId}:${academicYearId}`).
  - Automatically invalidate or update cache tags when master data mutations occur.

## 3. Mandatory Database Indexing
- **Index All Filtered Foreign Keys & Status Columns**:
  - Any column used in `WHERE`, `ORDER BY`, or `JOIN` conditions MUST have an index.
  - Compound indexes must match query patterns:
    - Multi-tenant lookups: `(school_id, academic_year_id, is_active)`
    - Defaulters / Invoices: `(school_id, status, due_date)`
    - Attendance: `(school_id, class_id, section_id, attendance_date)`
    - Payments: `(school_id, payment_date DESC)`

## 4. Streaming Server Components & Suspense Boundaries
- **Instant Shell Rendering (<50ms TTFB)**:
  - Do NOT block the entire page on slow queries, large tables, or aggregations.
  - Render the layout, page header, and controls immediately.
  - Wrap data-heavy sections (e.g. tables, charts, summaries) in `<Suspense fallback={<TableSkeleton />}>`.
- **Streaming over Blocking**:
  - Allow the server to stream HTML as soon as the shell is ready, streaming data blocks as queries resolve.

## 5. Bounded Queries & Pagination
- **No Unbounded `findMany()` in Production Views**:
  - Never load thousands of records directly into server memory.
  - Always apply `.limit(pageSize)` and `.offset((page - 1) * pageSize)`.
  - Default page size: 20 to 50 records.

## 6. Lean Client Bundles
- **Server Components by Default**:
  - Keep components as React Server Components (RSC) unless interactive state (`useState`, `useEffect`, event listeners) is strictly needed.
  - Push `"use client"` down to the smallest possible leaf component (e.g., `CheckoutButton.tsx`, `ExportButton.tsx`, modal toggles).
  - Avoid importing large client libraries (e.g. PDF renderers, charting engines) in root bundles; dynamic import (`next/dynamic`) when needed.

## 7. Production Environment Readiness
- **Production Build Execution**:
  - Development mode (`next dev`) compiles routes dynamically on first access, introducing 1–3 second JIT compilation delays.
  - Benchmark performance strictly against production builds (`next build && next start`) with optimized chunking, gzip/brotli compression, and precompiled route trees.

## 8. Development & Build Isolation Invariant
- **NEVER Run `next build` While `next dev` Is Running**:
  - Running `next build` concurrently in the same workspace purges and overwrites `.next/` with production chunk hashes.
  - This immediately corrupts the active development server's in-memory chunk registry, causing subsequent page requests to fail with `Cannot find module`, 404 on CSS/JS chunks, and unstyled raw HTML.
  - To verify type safety and compilation while the dev server is active, ONLY use `pnpm exec tsc --noEmit`.
