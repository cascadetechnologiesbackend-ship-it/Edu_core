# Reliability Drill 6: Migration 0025 Journal Integrity & Web Push Persistence (Phase P5)
**Task ID:** P5-T6 (Drill 6 / closes OPEN-9)  
**Governing Specification:** `edu-core-production-readiness-verification-p4-p5` v7.0.5  
**Timestamp:** 2026-10-10T21:30:00+05:30  
**Status:** **VERIFIED (PASS)**

---

## 1. Executive Summary & Defect Remediation (OPEN-9)

In Phase P1, a critical migration defect was uncovered: migration `0014` existed as a `.sql` file on disk but was missing from `meta/_journal.json`, causing clean database setups to silently skip it.
To prevent recurrence of this exact defect with the new Web Push Notification schema:
1. **Journal Registration:** Migration `0025_push_subscriptions.sql` was formally registered in `database/src/migrations/meta/_journal.json` with monotonic timestamp `1792100000000`, index `25`, and tag `0025_push_subscriptions`.
2. **Scratch DB Migration Execution & Proof:** Migrations were applied to an isolated scratch database (`schoolmitra_scratch_p5`), proving that all 26 migrations apply sequentially and commit to the database tracking table.
3. **Multi-Tenant & SUPER_ADMIN Compatibility:** `user_push_subscriptions.schoolId` was designed as **nullable** (`school_id: uuid("school_id")`). Because global `SUPER_ADMIN` accounts have no `schoolId`, a non-null constraint would have broken subscription creation for platform-level alerts.
4. **API Persistence:** Implemented real PostgreSQL upsert in `/api/push/subscribe` supporting both tenant users and super administrators.

---

## 2. Migration Journal Registration

`database/src/migrations/meta/_journal.json` entry:
```json
{
  "idx": 25,
  "version": "7",
  "when": 1792100000000,
  "tag": "0025_push_subscriptions",
  "breakpoints": true
}
```

### Journal Consistency Verification:
```bash
pnpm --filter @schoolmitra/database db:check-migrations
```
**Output:**
```text
> @schoolmitra/database@0.1.0 db:check-migrations V:\Cascade\Edu_core\Edu_core\database
> tsx scripts/check-migrations.ts

Checking migration files integrity...
Found 26 migration files on disk.
Found 26 migration entries in _journal.json.
All migrations are synchronized between disk and journal!
```

---

## 3. Scratch Database Migration Proof (`DB_PROOF`)

Executed against isolated database `schoolmitra_scratch_p5`:

```bash
docker exec schoolmitra_postgres psql -U postgres -d schoolmitra_scratch_p5 -c "SELECT count(*) FROM __drizzle_migrations;"
```

```text
================================================================================
                                 DB_PROOF START
================================================================================
SELECT count(*) FROM __drizzle_migrations;

 count 
-------
    26
(1 row)

================================================================================
                                  DB_PROOF END
================================================================================
```

All 26 migrations (0000 through 0025) applied sequentially and cleanly.

---

## 4. Nullable `schoolId` & Multi-Role Schema Specification

`database/src/schema/communication.ts`:
```typescript
export const userPushSubscriptions = pgTable(
  "user_push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }), // Nullable for SUPER_ADMIN
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userEndpointIdx: uniqueIndex("user_endpoint_idx").on(table.userId, table.endpoint),
    schoolIdx: index("push_sub_school_idx").on(table.schoolId),
  })
);
```

---

## 5. Automated Route Test Verification (`subscribe.test.ts`)

Test file: `frontend/src/app/api/push/__tests__/subscribe.test.ts`
All 4 test cases pass:

```text
 ✓ src/app/api/push/__tests__/subscribe.test.ts (4 tests) 58ms
   ✓ Push Subscription API (/api/push/subscribe) > returns 401 when user is not authenticated
   ✓ Push Subscription API (/api/push/subscribe) > returns 400 when payload is invalid
   ✓ Push Subscription API (/api/push/subscribe) > persists subscription for authenticated tenant user with schoolId
   ✓ Push Subscription API (/api/push/subscribe) > persists subscription for SUPER_ADMIN with null schoolId
```

---

## 6. Drill Verdict

- **Journal Registered:** Index 25, tag `0025_push_subscriptions`, timestamp `1792100000000`.
- **Database Proof:** `SELECT count(*) FROM __drizzle_migrations ===> 26`.
- **SUPER_ADMIN Persistence:** Nullable `schoolId` verified with automated test coverage.
- **Drill 6 Verdict:** **PASS (OPEN-9 CLOSED)**
