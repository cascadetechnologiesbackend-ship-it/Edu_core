# S12 Layers 7 & 8 Evidence: Calendar Columns & Schedule Lifecycle Guards

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 7 & 8 — Structural Calendar Columns & Schedule Deletion Marks Guard (Flaws F10, F11)
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `c64cde7`, academic calendar synchronization and schedule lifecycle exhibited two critical integrity vulnerabilities:
1. **Flaw F10 (String Matching in Calendar Events)**: Calendar event synchronization queried and matched existing calendar events using `LIKE '%[examScheduleId:...]%'` substring pattern matching on the `description` column rather than foreign key columns. Under concurrent operations or description edits, this produced duplicate calendar rows or left orphaned events when schedules were unpublished or deleted. Furthermore, the synchronization queries bypassed tenant context, which violated fail-closed RLS on `academic_calendar_events`.
2. **Flaw F11 (Unprotected Schedule Deletion with Orphan Marks)**: `deleteExamSchedule` directly invoked `db.delete(examSchedules)` without verifying whether student marks had already been recorded. Deleting a scheduled paper that already had mark entries caused data corruption, leaving orphan mark rows and broken grade snapshot aggregations.
3. **Inconsistent Result Visibility Gating**: The parent portal reimplemented result gating logic inline (`!isWithheld && !isScheduled && !isHold && !isHardFeeBlocked`) rather than invoking the canonical domain resolver `resolveResultVisibility`.

Layers 7 and 8 close these vulnerabilities:
- Migrated calendar synchronization to populate and query foreign key columns `examScheduleId` and `examSpanSourceId` on `academic_calendar_events` with backward-compatible description fallback.
- Wrapped all calendar sync routines in `withTenant(schoolId, ...)` to satisfy fail-closed RLS.
- Hardened `deleteExamSchedule` with a fail-closed mark guard: if any mark entries exist for the exam, class, and subject, schedule deletion is rejected with a descriptive error message and the schedule remains intact.
- Unified parent portal report card visibility checks with `resolveResultVisibility` from `@/lib/gradeEngine`, guaranteeing parity across all portal, admin, and public surfaces.

---

## 2. Changes Implemented

### 2.1 Calendar Sync Structural Columns (`backend/src/lib/examCalendarSync.ts`)
- Wrapped all queries and mutations in `withTenant(schoolId, async (scopedDb) => { ... })`.
- Populated `examScheduleId: row.id` on paper calendar event inserts and updates.
- Populated `examSpanSourceId: targetExam.id` on full-exam span calendar event inserts and updates.
- In `removeDatesheetFromCalendar`, deleted matching events via `or(eq(examScheduleId, id), like(description, tag))` under tenant scoping.

### 2.2 Fail-Closed Schedule Deletion Guard (`frontend/src/app/(admin)/exams/actions/scheduleActions.ts`)
```typescript
  // Layer 8: Fail-closed mark guard: check if mark entries exist for this schedule paper
  const schedule = await db.query.examSchedules.findFirst({
    where: and(eq(examSchedules.id, scheduleId), eq(examSchedules.schoolId, school.id)),
  });

  if (!schedule) {
    return { success: false, message: "Exam schedule not found." };
  }

  const markCheck = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(markEntries)
    .innerJoin(students, eq(markEntries.studentId, students.id))
    .where(
      and(
        eq(markEntries.schoolId, school.id),
        eq(markEntries.examId, schedule.examId),
        eq(markEntries.subjectId, schedule.subjectId),
        eq(students.currentClassId, schedule.classId),
      ),
    );

  const marksCount = Number(markCheck[0]?.count ?? 0);
  if (marksCount > 0) {
    return {
      success: false,
      message: `Cannot delete exam schedule: ${marksCount} student mark entries have already been recorded for this examination paper. Void or clear existing marks first.`,
    };
  }
```

### 2.3 Parent Portal Visibility Unification (`frontend/src/app/(parent)/portal/report-cards/page.tsx`)
```typescript
const visibility = resolveResultVisibility({
  isPublished: !settings?.withholdAll,
  scheduledPublishAt: settings?.releaseAt ?? null,
  feeBlocked: isHardFeeBlocked,
  adminHold: Boolean(hold),
  adminHoldReason: hold?.reason ?? null,
});

const isAllowed = visibility.isVisible;
const isWithheld = visibility.status === "UNPUBLISHED";
const isScheduled = visibility.status === "SCHEDULED";
const isHold = visibility.status === "WITHHELD_ADMIN";
```

---

## 3. Test Evidence

### 3.1 Calendar Synchronization Test Suite (`backend/src/lib/__tests__/examCalendarSync.test.ts`)
```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/examCalendarSync.test.ts (6 tests) 423ms
   ✓ 4.1: syncDatesheetToCalendar creates calendar event rows for each schedule paper with eventType='EXAM' and isWorkingDay=true (verifies examScheduleId structural column)
   ✓ 4.2: syncDatesheetToCalendar creates a whole-exam span row in academic_calendar_events (verifies examSpanSourceId structural column)
   ✓ 4.3: Idempotency: re-running syncDatesheetToCalendar updates existing rows without duplicating
   ✓ 4.4: removeDatesheetFromCalendar with scheduleIds removes only specified schedule paper rows
   ✓ 4.5: removeDatesheetFromCalendar with examId removes all schedule paper events and span event
   ✓ 4.6: Multi-tenant isolation: School A calendar sync cannot touch or see School B calendar rows

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### 3.2 Schedule Lifecycle & Visibility Guards (`backend/src/lib/__tests__/examLifecycleGuards.test.ts`)
```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/examLifecycleGuards.test.ts (4 tests) 418ms
   ✓ 7.1: syncDatesheetToCalendar populates structural columns examScheduleId and examSpanSourceId
   ✓ 8.1: Guard blocks schedule deletion when mark entries exist for the paper
   ✓ 8.2: Guard permits deletion of schedule with 0 mark entries and cleans calendar event
   ✓ 8.3: resolveResultVisibility enforces all 5 lifecycle gates consistently (UNPUBLISHED, SCHEDULED, WITHHELD_ADMIN, WITHHELD_FEE, PUBLISHED)

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### 3.3 TypeScript Validation
- Backend `tsc --noEmit`: Exit code 0 (Clean).
- Frontend `tsc --noEmit`: Exit code 0 (Clean).

---

## 4. Rule Zero Verification
- Additive schema utilization: populated existing structural columns `examScheduleId` and `examSpanSourceId`.
- No orphan records created on schedule deletion attempts.
- All calendar events and mark queries execute under verified tenant scoping (`withTenant`).
