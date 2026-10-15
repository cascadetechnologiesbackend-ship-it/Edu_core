# S12 Layer 3 Evidence: Unified PDF Report Card Generation Engine & Bulk Capacity

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 3 — Unified PDF Report Card Generation Engine & Worker Hardening
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `98f16d6`, report card generation suffered from two critical architectural divergences and an RLS propagation vulnerability:
1. **Divergent Grade Rules Calculation**: Single student report card generation (`backend/src/workers/reportCard.ts`) and bulk batch generation (`backend/src/lib/bulkGenerationEngine.ts`) each implemented disparate, hardcoded grade rule lookups that ignored class-specific grade rule overrides.
2. **Fail-Closed RLS Transaction Context**: Under Migration 0041's fail-closed Row-Level Security, executing queries through the global `db` pool inside `withTenant(schoolId, async (tx) => ...)` failed to inherit the transaction-local `set_config('app.current_school_id', schoolId, true)`. In workers, queries without `tx` context operated under an empty tenant session and returned zero rows or failed fail-closed.
3. **Capacity & Error Isolation Verification**: Bulk generation across 1,200 students must maintain throughput >= 100 students/sec while keeping peak memory under the 1024 MB t3.micro limit, isolating individual student failures without aborting the batch run.

Layer 3 achieves complete unification and validation:
- Unified hierarchical grade rule resolution (`resolveGradeRules`) across both single and bulk pipelines (`classId` -> `classGroup` -> CBSE default).
- Strict propagation of `scopedDb` (`tx` of type `TenantTransaction`) across all worker and bulk queries, coupled with explicit multi-tenant compound filters (`eq(schoolId, schoolId)`).
- Full capacity and resilience verification passing 3/3 tests in `examBulkCapacity.test.ts` (1,200 students generated in 7,738 ms at 155 students/sec with peak RSS of 394 MB).

---

## 2. Changes Implemented

### 2.1 Grade Rule Unification
- Updated `backend/src/lib/bulkGenerationEngine.ts` and `backend/src/workers/reportCard.ts` to call:
  ```typescript
  const engineRules: GradeRule[] = await resolveGradeRules(
    schoolId,
    classId, // or student.currentClassId
    undefined,
    scopedDb,
  );
  ```
- Eliminates disparate grade cutoffs and respects class-level custom grade rules configured by schools.

### 2.2 Scoped Database Context Propagation & RLS Safety
- Refactored `withTenant` in `backend/src/lib/tenant.ts` to export:
  ```typescript
  export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
  ```
- Ensured all queries, inserts, and updates in `bulkGenerationEngine.ts` and `reportCard.ts` execute against `scopedDb` (`tx`), preventing un-scoped connections from encountering RLS policy rejections.
- Hardened all `reportCards` and `reportCardJobs` queries with compound tenant filters:
  ```typescript
  and(eq(reportCards.id, existingCard.id), eq(reportCards.schoolId, schoolId))
  ```

---

## 3. Verification & Test Evidence

### 3.1 Type-Check
```bash
pnpm --filter @schoolmitra/backend type-check
```
**Result**: Clean zero-error build (`tsc --noEmit` exited 0).

### 3.2 Bulk Capacity & Resilience Drill
Command:
```bash
pnpm --filter @schoolmitra/backend test -- examBulkCapacity
```
**Output**:
```
 ✓ src/lib/__tests__/examBulkCapacity.test.ts > S10 Layer 3: Bulk Report Card Generation Capacity & Hardening Drill > 3.1: Bulk capacity benchmark at realistic school scale (1,200 students)
   [CapacityMetrics] 1,200 Students: 7738ms total (155 students/sec)
   [CapacityMetrics] Peak RSS: 394 MB (t3.micro ceiling: 1024 MB)
 ✓ src/lib/__tests__/examBulkCapacity.test.ts > S10 Layer 3: Bulk Report Card Generation Capacity & Hardening Drill > 3.2: Partial failure tolerance (single student failure does not abort job)
 ✓ src/lib/__tests__/examBulkCapacity.test.ts > S10 Layer 3: Bulk Report Card Generation Capacity & Hardening Drill > 3.3: Total failure handling (all students fail -> marks job as FAILED)

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  12.18s
```

### 3.3 Rule Zero Integrity Metrics
- **Throughput**: 155 students/second (target: >= 100 students/sec) — **PASS**
- **Peak Memory**: 394 MB (ceiling: 1024 MB t3.micro envelope) — **PASS**
- **RLS Multi-Tenant Safety**: Fail-closed transactions enforced via `withTenant` and `scopedDb` — **PASS**
