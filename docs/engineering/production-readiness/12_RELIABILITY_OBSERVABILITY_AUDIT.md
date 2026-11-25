# 12 Reliability, Observability & Background Worker Audit

**Directive ID:** `EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION`  
**Subsystems:** BullMQ Workers, Telemetry Endpoints, Health Checks, Structured Logging  
**Verdict:** **PASS**  

---

## 1. Worker Isolation & Reliability

1. **Worker Tenant Context:**
   - Background jobs (`parentSignalsWorker`, `teacherNotificationWorker`, `financeAutomation`) wrap all tenant queries in `withTenant(schoolId)`.
   - Platform operations (heartbeats, queue maintenance) wrap in `withPlatformContext()`.
2. **Health Endpoints:**
   - `/api/health`: Live database pool connectivity check and Redis connection ping.
   - `/api/health/worker`: Queue health, active jobs, delayed jobs, and failed job counts.
3. **Budget Query Logger (`database/src/queryLogger.ts`):**
   - Normative query budget: OLTP queries budgeted for <200ms; warnings logged when statement execution exceeds threshold.
