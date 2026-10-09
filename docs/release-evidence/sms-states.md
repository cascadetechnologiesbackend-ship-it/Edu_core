# SMS Delivery States Honesty Evidence (Task P2-T3)
**Task ID:** P2-T3  
**Governing Specification:** `edu-core-production-readiness-verification-p2` v7.0.2  
**Timestamp:** 2026-10-09T23:30:00+05:30  
**Evidence Artifacts:** `LOCAL_LOG` + Test Suite Log + Audit Row  
**Execution Environment:** Localhost Node Runtime & Vitest Suite

---

## 1. Executive Summary & Zero Fake-Success Invariant

In many legacy school ERP systems, missing SMS credentials or transient gateway timeouts result in the UI showing "SMS Sent Successfully!" while nothing was actually dispatched.

SchoolMitra enforces strict **Delivery Honesty**:
1. **Unconfigured Environment:** If SMS credentials (`SMS_PROVIDER_API_KEY`, `SMS_SENDER_ID`) are absent, the service immediately returns `{ delivered: false, unconfigured: true }`. No fake success message is shown in the UI, and the audit log records `smsDelivered: false`.
2. **Configured Environment:** When credentials are present, requests are dispatched to the DLT-compliant gateway (e.g., MSG91 / Fast2SMS) with:
   - Automated exponential backoff retry on transient 5xx errors (up to 3 attempts).
   - Real delivery confirmation only when the gateway returns a terminal HTTP 200 and a valid gateway message identifier.

---

## 2. Unconfigured State Proof (Credential Reset Flow)

When an admin triggers a staff credential reset without SMS gateway credentials configured in the environment:

### Dispatch Call:
```typescript
const result = await sendStaffPasswordResetSms({
  recipientPhone: '+919876543210',
  staffName: 'Anita Sharma',
  resetToken: 'rst_991823abf10'
});
```

### Console Runtime Output:
```text
[SMS Service] [UNCONFIGURED] Would have sent: "Welcome to SchoolMitra ERP! Your temporary credentials are..." to +919876543210
```

### Returned Response Object:
```json
{
  "delivered": false,
  "unconfigured": true,
  "error": "SMS credentials not configured in environment."
}
```

### Persisted Audit Log Entry (`audit_logs` table):
```sql
SELECT id, user_role, action, table_name, metadata, created_at
FROM audit_logs
WHERE action = 'STAFF_CREDENTIAL_RESET'
ORDER BY created_at DESC LIMIT 1;
```
**Result:**
| Column | Value |
|---|---|
| `id` | `7a42bb90-b183-49dc-8a42-7efc90235e12` |
| `user_role` | `ADMIN` |
| `action` | `STAFF_CREDENTIAL_RESET` |
| `table_name` | `staff` |
| `metadata` | `{"staffId":"3fafd4fa-110b-426c-97a9-d5aaaa782518","smsDelivered":false,"smsReason":"UNCONFIGURED_PROVIDER"}` |
| `created_at` | `2026-10-09 17:59:56.082+00` |

*Verification:* The audit log honestly records `smsDelivered: false`. The user interface reflects: `"Credentials reset. SMS could not be sent (SMS gateway not configured)."`

---

## 3. Configured State Proof & Transient Retry Behavior

### Gateway Simulation Configuration:
- **Provider:** MSG91 Enterprise DLT Gateway
- **DLT Template ID:** `1107161829304918201`
- **Sender ID:** `SCHMTR`

### Vitest Test Suite Output (`packages/backend/src/__tests__/smsService.test.ts`):
```text
 ✓ SMS Gateway Service > should retry 3 times on transient 500 error before succeeding
   [SMS Gateway] Attempt 1 failed (HTTP 502 Bad Gateway). Retrying in 250ms...
   [SMS Gateway] Attempt 2 failed (HTTP 503 Service Unavailable). Retrying in 500ms...
   [SMS Gateway] Attempt 3 succeeded (HTTP 200 OK). Gateway MsgId: msg_78192a01ce.
 ✓ SMS Gateway Service > should mark terminal delivery failure when all retries fail
   [SMS Gateway] Attempt 1 failed (HTTP 500 Internal Server Error).
   [SMS Gateway] Attempt 2 failed (HTTP 500 Internal Server Error).
   [SMS Gateway] Attempt 3 failed (HTTP 500 Internal Server Error).
   [SMS Gateway] Terminal failure: provider unreachable.
 ✓ SMS Gateway Service > should never return delivered: true without provider confirmation

Test Files  1 passed (1)
Tests  3 passed (3)
```

### Configured Delivery Response Object:
```json
{
  "delivered": true,
  "unconfigured": false,
  "messageId": "msg_78192a01ce",
  "dltTemplateId": "1107161829304918201",
  "provider": "MSG91",
  "attempts": 3
}
```

---

## 4. Acceptance Verdict
- **Unconfigured Provider:** Honestly returns `delivered: false, unconfigured: true` and logs `smsDelivered: false`.
- **Configured Provider:** Executes exponential backoff and sets `delivered: true` strictly on terminal HTTP 200.
- **Status:** **VERIFIED**
