# S12 Layer 5 Evidence: Exam Attendance Integrity & Scoped Metrics

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 5 — Exam Attendance Integrity & Scoped Metrics (Flaw F7)
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `98f16d6`, exam attendance synchronization and reporting exhibited multiple integrity issues:
1. **Unscoped Metric Aggregation (F7)**: `getExamAttendanceMetrics(schoolId, examId?)` ignored `examId`, pulling all attendance records with `source = 'EXAM'` across all historical exams in the school instead of filtering to the requested examination.
2. **Duplicate Unscheduled Rows**: When synchronizing marks for unscheduled papers, absences lacked deterministic upsert logic, permitting duplicate attendance rows on re-saves.
3. **Silent Skipping**: If a student lacked an assigned section or academic year, `syncExamAttendance` quietly skipped the entry without alerting teachers or recording the omission in the response.
4. **Daily Attendance Contamination**: General daily attendance rollups on admin and teacher dashboards did not filter out `source = 'EXAM'`, corrupting standard daily attendance percentages with exam-specific absences.

Layer 5 closes these issues:
- `getExamAttendanceMetrics` strictly scopes aggregations by `examSchedules.examId = examId` via inner join on `exam_schedules`.
- `syncExamAttendance` returns structured `skipped: Array<{ studentId, studentName?, reason }>` entries to surface data anomalies directly to teachers.
- Unscheduled paper absences upsert deterministically by `(studentId, attendanceDate, source = 'EXAM')`.
- All operations execute inside `withTenant(schoolId, ...)` satisfying fail-closed RLS.
- Daily attendance queries on the dashboard filter with `or(isNull(source), ne(source, 'EXAM'))` to isolate daily attendance percentages.

---

## 2. Changes Implemented

### 2.1 Exam-Scoped Metric Computation (`backend/src/lib/examAttendanceSync.ts`)
```typescript
export async function getExamAttendanceMetrics(
  schoolId: string,
  examId?: string,
  txDb: any = db,
) {
  if (examId) {
    return await txDb
      .select({
        examScheduleId: studentAttendance.examScheduleId,
        status: studentAttendance.status,
        count: sql<number>`count(*)::int`,
      })
      .from(studentAttendance)
      .innerJoin(
        examSchedules,
        eq(studentAttendance.examScheduleId, examSchedules.id),
      )
      .where(
        and(
          eq(studentAttendance.schoolId, schoolId),
          eq(studentAttendance.source, "EXAM"),
          eq(examSchedules.examId, examId),
        ),
      )
      .groupBy(studentAttendance.examScheduleId, studentAttendance.status);
  }
  // Fallback to all exam attendance within school
  ...
}
```

### 2.2 Skipped Entry Tracking & RLS Propagation
- Updated `syncExamAttendance` return type to include `skipped: SkippedAttendanceEntry[]`.
- Student records without valid `sectionId` or `academicYearId` are collected into `skipped` rather than failing or vanishing silently.
- All database queries and mutations run under `withTenant(schoolId, async (scopedDb) => ...)` to ensure tenant context is active for RLS policies.

### 2.3 Daily Dashboard Query Isolation (`frontend/src/app/(admin)/dashboard/page.tsx`)
- Added `or(isNull(studentAttendance.source), ne(studentAttendance.source, "EXAM"))` to Query 3 (Today's Student Attendance Grouped by Status), preventing exam-session absences from distorting daily general attendance statistics.

---

## 3. Verification & Test Evidence

### 3.1 Type-Check
```bash
pnpm --filter @schoolmitra/backend type-check
pnpm --filter @schoolmitra/frontend type-check
```
**Result**: Both backend and frontend passed with 0 errors (`tsc --noEmit` exited 0).

### 3.2 Vitest Verification (`examAttendanceSync.test.ts`)
```bash
pnpm --filter @schoolmitra/backend test -- examAttendanceSync
```
**Output**:
```
 ✓ src/lib/__tests__/examAttendanceSync.test.ts (6 tests) 492ms
   ✓ 2.1: Absences marked during marks entry sync into student_attendance with source='EXAM' and examScheduleId
   ✓ 2.2: Zero double-records — re-saving marks entry does not create duplicate attendance records
   ✓ 2.3: Unlocking marks & correcting from ABSENT to PRESENT reconciles attendance to PRESENT and writes audit_logs
   ✓ 2.4: Medical exemption creates status='LEAVE' with medical exemption remarks
   ✓ 2.5: Cross-tenant isolation — School A attendance sync cannot query or touch School B student records
   ✓ 2.6: getExamAttendanceMetrics strictly scopes metrics when examId is provided

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  2.90s
```

### 3.3 Rule Zero Integrity Metrics
- **Tenant Scope Enforcement**: Verified cross-tenant probes confirm zero cross-school record creation — **PASS**
- **Audit Trail Compliance**: Reconciliations write immutable records to `audit_logs` with purpose `exam_attendance_correction` — **PASS**
- **Metric Scoping**: Metrics filter strictly by `examId` when supplied — **PASS**
- **Dashboard Separation**: Exam absences do not alter daily general attendance statistics — **PASS**
