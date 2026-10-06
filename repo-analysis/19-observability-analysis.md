# 19 — Observability Analysis
## SchoolMitra ERP

---

## Current State

```
Status: INSUFFICIENT FOR PRODUCTION
```

The system has excellent audit logging (DPDP-grade append-only audit trail) but lacks operational observability for production incident response.

---

## Logging

### tRPC Request Logging

```typescript
// backend/src/server/trpc.ts — timingMiddleware
if (process.env["NODE_ENV"] === "development") {
  trpcLogger.info(`[tRPC] ${path} — ${durationMs}ms`);
}
```

**Status: SUPPRESSED IN PRODUCTION.** Request timing, errors, and path information are only logged in development. A production incident affecting tRPC endpoints leaves no traces.

### Audit Logging (DPDP)

```
audit_logs table — append-only PostgreSQL table
  Fields: userId, userEmail, userRole, schoolId, action, tableName, recordId,
          purposeId, ipAddress, userAgent, metadata, legalHold, createdAt
  Trigger: enforce_append_only_audit_logs (prevents UPDATE/DELETE)
  Coverage: WRITE actions logged in admissionsRouter + auditLogger.ts calls
```

**Status: STRONG** for compliance but this is audit logging, not operational observability. Audit logs do not help diagnose latency spikes or database errors.

---

## Metrics

**Status: MISSING**

No metrics endpoint found. No integration with a metrics platform (Prometheus, DataDog, etc.) visible in the codebase.

Key metrics missing:
- Request rate per endpoint
- Request latency (p50/p95/p99)
- Error rate
- Database query count and duration
- Redis operation latency
- BullMQ queue depth
- Authentication failure rate
- Active session count

---

## Health Check

**Status: PARTIAL (implementation not reviewed)**

- `/api/health` endpoint exists (referenced in middleware bypass)
- Implementation not reviewed — depth unknown
- No evidence of dependency health checks (DB, Redis, S3)

**Minimum required health check:**
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "timestamp": "2026-10-06T00:00:00Z",
  "uptime": 12345
}
```

---

## Tracing

**Status: MISSING**

No distributed tracing (OpenTelemetry, Jaeger, etc.) configured.

For the current architecture (single process), basic request correlation IDs would suffice.

---

## Error Tracking

**Status: MISSING**

No integration with error tracking services (Sentry, Bugsnag, etc.) found.

Uncaught errors in Server Actions will appear in Render.com logs as stderr output without context.

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| P1 | Enable pino production logging for tRPC (remove NODE_ENV guard) | LOW |
| P1 | Add request correlation ID (per-request UUID) to all log entries | LOW |
| P1 | Implement detailed /api/health endpoint | LOW |
| P2 | Add Sentry error tracking | LOW |
| P2 | Add key business metrics (payment events, admission counts) | MEDIUM |
| P3 | Add OpenTelemetry tracing | HIGH |
| P3 | Dashboard for queue depth and worker health | MEDIUM |
