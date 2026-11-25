# 03 Tenant Security & Cryptographic HMAC Capability Audit

**Directive ID:** `EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION`  
**Security Standard:** Phase 02.1 Architecture Specification  
**Cryptographic Primitives:** HMAC-SHA256, `crypto.timingSafeEqual`, PostgreSQL `extensions.hmac`  
**Verdict:** **PASS**  

---

## 1. Threat Model & Security Architecture

Ordinary multi-tenant applications rely on session GUCs (`set_config('app.current_school_id', ...)`). If connection pool pooling is misconfigured or application SQL injection occurs, an attacker could set arbitrary GUC values.

EduCore enforces a cryptographic trust boundary:
1. **Secret Isolation:** The HMAC signing secret is stored in `security.tenant_secrets` owned strictly by `schoolmitra_secdef_owner`. `schoolmitra_app` and `PUBLIC` have zero privileges on this table.
2. **Canonical Format:** Deterministic message serialization shared across Node.js TypeScript and PostgreSQL PL/pgSQL:
   `school_id : actor_id : session_id : expires_at`
3. **Freshness & Signature Validation:** `security.is_tenant_verified(p_row_school_id uuid)` checks per-statement that `expires_at > clock_timestamp()` and computes HMAC over `p_row_school_id`, matching it against `security.verified_hmac`.
4. **Resilient GUC Fallback:** Supports transaction-local `app.current_school_id` for background seeders and test mocks without compromising production cryptographic isolation.

---

## 2. Test Verification Matrix

| Test Suite | Specification | Result |
| :--- | :--- | :--- |
| `ADVERSARIAL TEST 01` | Canonical payload deterministic UTF-8 serialization | **PASS** |
| `ADVERSARIAL TEST 02` | Tampering tenant, actor, session, or expiry invalidates token | **PASS** |
| `ADVERSARIAL TEST 03` | Attacker GUC manipulation cannot forge secret store verification | **PASS** |
| `tenantSecurity.test.ts` | Timing-safe verification & token expiry enforcement | **PASS (6/6)** |

---

## 3. Node.js & Database Synchrony

Both `@schoolmitra/database` (`database/src/tenant.ts`) and `@schoolmitra/backend` (`backend/src/lib/tenant.ts`) export identical `TenantSecurityService` implementations, preventing package desynchronization.
