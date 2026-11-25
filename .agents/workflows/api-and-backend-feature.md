---
description: Checklist for building or modifying API routes, backend services, webhooks, and async jobs (Categories B, D, E, F, G, L).
---

# API & Backend Feature Workflow

Use this workflow whenever creating or modifying API endpoints, server actions, webhooks, or background jobs.

## 1. API Engineering & Reliability (Category B)
- [ ] **Input Validation**: Validate all request params, query strings, and bodies on the server (e.g., Zod) before processing.
- [ ] **HTTP Status Codes**: Return accurate status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`).
- [ ] **Error Handling**: Catch errors consistently; never leak stack traces, SQL errors, or internal secrets in API responses.
- [ ] **Timeouts & Retries**: Set explicit timeouts on external HTTP/service calls; use exponential backoff and circuit breakers for transient failures.
- [ ] **Rate Limiting**: Apply rate limiting on auth, public, and high-cost endpoints.
- [ ] **Idempotency**: Enforce idempotency keys or natural unique constraints on payments, webhooks, and retryable mutations.
- [ ] **Open Redirects**: Validate any `redirect` / `callbackUrl` against an allowlist or same-origin `URL` check.

## 2. Auth, RBAC & Security (Categories D & E)
- [ ] **Authentication & Authorization**: Verify session/token and check RBAC permissions on the server.
- [ ] **Tenant Isolation (RLS & IDOR)**: Execute all tenant queries inside `withTenant` / verified tenant context; never trust client-supplied `schoolId` or record IDs without ownership checks.
- [ ] **Mass Assignment**: Explicitly pick allowed fields when inserting/updating; never spread raw `req.body` into DB queries.

## 3. Concurrency, Async & Data Formatting (Categories G & L)
- [ ] **Race Conditions**: Wrap multi-step state transitions (e.g., fee allocations, seat/inventory updates) in DB transactions.
- [ ] **Background Jobs**: Offload heavy/slow tasks (emails, PDFs, bulk imports) to BullMQ / message queues with Redis fallback awareness.
- [ ] **Time Zones & Encoding**: Store timestamps in UTC (`timestamptz`), format to local time in UI, and use UTF-8 throughout.
