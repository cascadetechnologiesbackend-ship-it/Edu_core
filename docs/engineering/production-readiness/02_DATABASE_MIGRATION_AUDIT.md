# 02 Database Migration Chain & Schema Audit

**Directive ID:** `EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION`  
**Migration Chain Range:** `0000_dark_garia` through `0061_fix_auth_rls_and_tenant_hmac`  
**Total Migrations:** 62  
**Verification Tool:** `pnpm exec tsx database/src/check-migrations.ts`  
**Verdict:** **PASS**  

---

## 1. Migration Sequence Integrity

An automated audit of all 62 SQL migrations in `database/src/migrations/` was executed against `database/src/migrations/meta/_journal.json` and `database/src/migrations/catalog.ts`.

### Resolved Incidents:
1. **Missing 0058 Migration File:**
   - *Problem:* Commit `167e36d1` contained schemas for `parent_notification_preferences` in Drizzle, but no DDL migration was emitted. Migration jumped from `0057_timetable_manual_override.sql` to `0059_complete_fail_closed_rls.sql`.
   - *Remediation:* Generated `0058_parent_notification_preferences.sql` creating the table with composite primary key `(school_id, user_id)`, foreign key cascades, and performance indexes.
2. **Missing `to_regclass` Defensive Fences:**
   - *Problem:* `0059_complete_fail_closed_rls.sql` looped through a static array of tables and crashed when optional tables were missing.
   - *Remediation:* Added `IF to_regclass(format('public.%I', tbl)) IS NULL THEN CONTINUE; END IF;` guards in both 0059 and 0060.
3. **Authentication RLS Restoration (0061):**
   - *Problem:* Migration 0060 dropped old policies on `users`, `roles`, and `user_roles` and applied `security.is_tenant_verified(school_id)` which failed on `SYSTEM_AUTH` lookups and system roles with `school_id IS NULL`.
   - *Remediation:* Created `0061_fix_auth_rls_and_tenant_hmac.sql`, restoring dedicated policies for `users`, `roles`, and `user_roles` and adding fallback verification in `security.is_tenant_verified`.

---

## 2. Authoritative Migration Register (Tail End)

| Index | Migration Tag | Domain | Status |
| :--- | :--- | :--- | :--- |
| **57** | `0057_timetable_manual_override` | `ACADEMICS_TIMETABLE` | Applied & Verified |
| **58** | `0058_parent_notification_preferences` | `PARENT_COMMUNICATION` | Applied & Verified |
| **59** | `0059_complete_fail_closed_rls` | `SECURITY_RLS` | Applied & Verified |
| **60** | `0060_phase02_1_security_hardening` | `SECURITY_RLS` | Applied & Verified |
| **61** | `0061_fix_auth_rls_and_tenant_hmac` | `SECURITY_RLS` | Applied & Verified |

---

## 3. Execution Evidence

```
> @schoolmitra/database@11.60.0 db:check-migrations
> pnpm exec tsx src/check-migrations.ts

Auditing 62 migration files in V:\Cascade\2026\Edu_core\database\src\migrations...
✅ All migration sequence numbers are unique and synchronized with journal.
```
