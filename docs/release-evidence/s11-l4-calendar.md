# S11 Layer 4 Evidence: Academic Calendar & Events Synchronization

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 4 — Academic Calendar & Events Sync  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Data Flow
Before S11, exam schedules lived entirely isolated within `exam_schedules` and never synced to the school's central academic calendar. Students, parents, and teachers checking the school calendar could not see paper dates, subject schedules, or overall exam periods.

Layer 4 establishes bi-directional calendar event synchronization:
1. **Paper-Level Calendar Entries (`backend/src/lib/examCalendarSync.ts`)**:
   - `syncDatesheetToCalendar` runs upon datesheet publication (`publishDatesheet`).
   - For each scheduled exam paper, an event is synchronized into `academicCalendarEvents` with:
     - `eventType: 'EXAM'`
     - `isWorkingDay: true`
     - `title: '${subject.name} (${class.displayName})'`
     - `startDate` & `endDate`: set to the paper's `examDate`
     - `description`: formatted with exam title, start time, duration, and embedded correlation tags (`[examScheduleId:<id>]` and `[examId:<id>]`).
2. **Whole-Exam Span Event**:
   - Creates/updates a single overarching calendar event spanning the full examination duration (`exam.startDate` to `exam.endDate`) titled `Examination: ${exam.name}`, tagged with `[examSpanId:<id>]`.
3. **Idempotent Updates (Zero Duplication)**:
   - Successive re-publishing runs update the existing calendar entries in place rather than creating duplicate rows.
4. **Clean Removal on Unpublish / Deletion**:
   - `unpublishDatesheet` and `deleteExamSchedule` automatically purge the corresponding paper calendar entries via `removeDatesheetFromCalendar`, preserving database integrity.

---

## 2. Test Execution Evidence

### Vitest Unit & Integration Suite (`src/lib/__tests__/examCalendarSync.test.ts`)
```
✓ src/lib/__tests__/examCalendarSync.test.ts (6 tests)
  ✓ 4.1: syncDatesheetToCalendar creates calendar event rows for each schedule paper with eventType='EXAM' and isWorkingDay=true
  ✓ 4.2: syncDatesheetToCalendar creates a whole-exam span row in academic_calendar_events
  ✓ 4.3: Idempotency: re-running syncDatesheetToCalendar updates existing rows without duplicating
  ✓ 4.4: removeDatesheetFromCalendar with scheduleIds removes only specified schedule paper rows
  ✓ 4.5: removeDatesheetFromCalendar with examId removes all schedule paper events and span event
  ✓ 4.6: Multi-tenant isolation: School A calendar sync cannot touch or see School B calendar rows
```

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 8 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> createExamSchedule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> deleteExamSchedule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> publishDatesheet()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> unpublishDatesheet()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> setMarkDistribution()
Auditing 18 examination routes for assertRouteAccess & session checks...
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

### TypeScript Validation
```
pnpm --filter @schoolmitra/frontend exec tsc --noEmit: EXIT 0 (0 errors)
```

---

## 3. Cross-Tenant Isolation Verification
- Probed in `4.6`: School A removing schedules or querying calendar events with a School B schedule ID strictly returns `removedCount: 0`. School B's calendar events remain intact.
