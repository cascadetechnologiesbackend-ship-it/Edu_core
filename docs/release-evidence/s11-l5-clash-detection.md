# S11 Layer 5 Evidence: Timetable-Aware Scheduling & Clash Detection Engine

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 5 — Timetable-Aware Scheduling  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Architecture
Before S11, examination scheduling occurred in a vacuum without cross-referencing room allocations or teacher periods in the academic timetable. Double-booking exam rooms, assigning teachers during their teaching periods, or scheduling overlapping papers for the same class was possible without system warnings.

Layer 5 introduces the **Timetable Clash Detection Engine** (`backend/src/lib/timetableClashEngine.ts`):
1. **Three-Dimensional Conflict Detection (`checkScheduleConflicts`)**:
   - **Room Conflicts**:
     - Detects collisions with other scheduled examination papers in the same room on the same date with overlapping times.
     - Detects collisions with active `timetablePeriods` in that room on the matching day of week (`dayOfWeekEnum`), preventing exam booking in rooms being used for regular classes.
   - **Invigilator Conflicts**:
     - Detects if the selected invigilator is assigned to another exam paper during the same time window.
     - Detects if the invigilator is teaching a regular timetable period (accounting for `timetableSubstitutions` so teachers with confirmed proxies are not falsely flagged, while substitute teachers are accurately tracked).
   - **Class Conflicts**:
     - Detects if the same class has another examination paper scheduled with overlapping hours on the same date.
2. **Invigilator Availability Ranking (`getAvailableInvigilators`)**:
   - Classifies all active teachers in the school into 3 sorted tiers:
     1. `FULLY_AVAILABLE`: Zero exam duties and zero timetable teaching conflicts during the slot.
     2. `AVAILABLE_WITH_LATER_PERIODS`: Clear during the exam window, but scheduled to teach classes later in the day.
     3. `CONFLICTED`: Already occupied with another exam or teaching during the exam window, including specific conflict details.
3. **Fail-Closed Strict Mode with RBAC Override**:
   - `createExamSchedule` strictly blocks conflicting additions unless `overrideConflicts: true` is supplied.
   - Overriding a detected conflict requires the caller to hold `exam.schedule.conflict.override` (held by `SUPER_ADMIN`, `SCHOOL_ADMIN`, and `PRINCIPAL`), enforcing administrative accountability.
4. **Client-Side Integration (`ScheduleClient.tsx`)**:
   - Intercepts conflict errors and surfaces an interactive clash resolution dialog with conflict reasons and an administrative override option for authorized roles.

---

## 2. Test Execution Evidence

### Vitest Unit & Integration Suite (`src/lib/__tests__/timetableClashEngine.test.ts`)
```
✓ src/lib/__tests__/timetableClashEngine.test.ts (9 tests)
  ✓ 5.0: Pure unit helpers: timeStringToMinutes, intervalsOverlap, and getDayOfWeek
  ✓ 5.1: Room conflict: detects collision with another exam paper in the same room on the same date
  ✓ 5.2: Room conflict: detects collision with regular class timetable period in the same room
  ✓ 5.3: Invigilator conflict: detects invigilator assigned to another exam paper at overlapping time
  ✓ 5.4: Invigilator conflict: detects invigilator teaching regular timetable period at overlapping time
  ✓ 5.5: Class conflict: detects same class with another exam paper at overlapping time
  ✓ 5.6: Non-overlapping times: returns hasConflict=false when slot is completely clear
  ✓ 5.7: getAvailableInvigilators: ranks teachers into availability tiers
  ✓ 5.8: Tenant isolation: School A conflict check ignores School B rooms and schedules
```

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 8 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> createExamSchedule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> deleteExamSchedule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> publishDatesheet()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> unpublishDatesheet()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> setMarkDistribution()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> checkScheduleConflictsAction()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> getAvailableInvigilatorsAction()
Auditing 18 examination routes for assertRouteAccess & session checks...
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

### TypeScript Validation
```
pnpm --filter @schoolmitra/frontend exec tsc --noEmit: EXIT 0 (0 errors)
```

---

## 3. Cross-Tenant Isolation Verification
- Probed in `5.8`: When School B checks room availability for `Hall-1` (which is booked in School A on that date), School B reports `hasConflict: false`. Tenant schedules and timetable periods are isolated by `school_id`.
