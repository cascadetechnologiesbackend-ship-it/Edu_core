# Incident Response Runbook
## SchoolMitra ERP

### 1. Incident Severity Definitions

| Severity | Definition | Target Response (MTTA) | Target Resolution (MTTR) | Examples |
|---|---|---|---|---|
| **SEV-1 (Critical)** | Core service down for all schools; payment processing outage; active security compromise. | < 15 minutes | < 2 hours | Database unreachable; Razorpay webhooks failing completely; unauthorized data exfiltration. |
| **SEV-2 (High)** | Major functional degradation for multiple schools; background workers stalled. | < 30 minutes | < 4 hours | Fee generation failing; report card PDF generator crashed; Redis failure causing rate-limit degradation. |
| **SEV-3 (Medium)** | Minor feature failure or single tenant impacted. | < 2 hours | < 24 hours | Excel export bug; single school configuration issue; non-critical UI styling defect. |
| **SEV-4 (Low)** | Cosmetic issues, documentation typos, or non-blocking defects. | < 24 hours | Next sprint | Typo in email template; layout glitch on rare viewport. |

---

### 2. Immediate Diagnostic Steps

#### Step 1: Query Health Check
Run immediate health inspection:
```bash
curl -i https://app.schoolmitra.in/api/health
```
- If HTTP 503: Database connection or pool exhaustion.
- If HTTP 200 with `status: "degraded"`: Redis is offline; verify Redis service.

#### Step 2: Render.com Logs Analysis
1. Open Render Dashboard -> `schoolmitra-erp` -> **Logs**.
2. Filter by `[ERROR]` or `UNHANDLED_EXCEPTION`.
3. Check memory & CPU metrics on the service dashboard for OOM killed processes.

#### Step 3: Database Diagnostics
1. Connect via `psql` to production database:
   ```sql
   -- Check active connection count vs max_connections
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;

   -- Identify blocking locks
   SELECT pid, query_start, age(clock_timestamp(), query_start), query 
   FROM pg_stat_activity 
   WHERE state != 'idle' ORDER BY query_start ASC LIMIT 5;
   ```
2. Terminate rogue query blocking transactions:
   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```

#### Step 4: Redis & BullMQ Worker Status
1. Check Redis memory usage and ping response:
   ```bash
   redis-cli -u $REDIS_URL PING
   redis-cli -u $REDIS_URL INFO memory
   ```
2. Verify queue backlog in BullMQ:
   ```bash
   redis-cli -u $REDIS_URL LLEN "bull:report-card:wait"
   ```

---

### 3. Incident Communication Templates

#### Template: Initial Stakeholder Alert (SEV-1 / SEV-2)
```text
[INCIDENT ALERT - SEV-X] <Issue Brief Description>
Status: INVESTIGATING
Impact: <School tenants affected / Features impacted>
Lead Responder: <Name>
Bridge / War Room: <Link>
Next Update: Within 30 minutes
```

#### Template: Customer Status Page Notice
```text
We are currently investigating degraded performance impacting the SchoolMitra ERP portal. 
Our engineering team has identified the issue and is actively implementing a fix. 
Student data and records remain safe. We apologize for the inconvenience and will provide updates shortly.
```

---

### 4. Post-Incident Review (PIR)
Within 48 hours of resolving any SEV-1 or SEV-2 incident:
1. Conduct a blameless post-mortem with responders.
2. Produce a PIR document detailing:
   - Incident timeline (detection, response, mitigation).
   - Root cause analysis (5 Whys).
   - Corrective actions and Jira remediation tickets.
