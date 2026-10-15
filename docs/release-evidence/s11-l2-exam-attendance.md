# S11 Layer 2 Evidence: Exam Attendance Synchronization & Reconciliation

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 2 — Exam Attendance Sync  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Data Flow
Prior to S11, exam-day attendance was captured as an absent flag on `mark_entries` but never flowed into the `student_attendance` table. Consequently, parents never saw exam absences in their daily attendance history, and the Exam Dashboard lacked real attendance data to render the guide's specified attendance/absentee trend chart.

Layer 2 establishes seamless bi-directional synchronization between examinations and student attendance:
1. **Attendance Capture with Schedule Linkage (`backend/src/lib/examAttendanceSync.ts`)**:
   - `syncExamAttendance` executes directly within the marks entry flow in `saveMarkEntries`.
   - When a student is flagged absent or medically exempt, a record is upserted into `student_attendance` with `source: 'EXAM'`, `exam_schedule_id` linked to the paper's `examSchedules` row, and status `ABSENT` (or `LEAVE` for medical exemptions).
   - The partial unique index `student_attendance_exam_schedule_unique` on `(student_id, exam_schedule_id) WHERE exam_schedule_id IS NOT NULL` prevents double-records even if marks are saved repeatedly.
2. **Unlock & Correction Reconciliation (Zero Silent Deletions)**:
   - When marks are unlocked for administrative correction and a previously absent student is marked present with marks:
     - The existing `student_attendance` row is NOT deleted.
     - It is updated to `status: 'PRESENT'` with remarks `EXAM_RECONCILED: Corrected to PRESENT by <role> from <previous_status>`.
     - An immutable audit trail entry is appended to `audit_logs` (`action: 'WRITE'`, `tableName: 'student_attendance'`, `purposeId: 'exam_attendance_correction'`) adhering to DPDP compliance.
3. **Parent Portal Visibility (UX-R08 & Status Tokens)**:
   - In `frontend/src/app/(parent)/parent/dashboard/page.tsx`:
     - Today's Status card shows distinct status tokens: `Exam Absent` (rose badge + icon) or `Exam Exemption` (purple badge + icon), with remarks.
     - Attendance history tab renders `Exam Absent` / `Exam Exemption` / `Exam Present` with icon and text (never color alone).
4. **Exam Dashboard Attendance Chart**:
   - In `frontend/src/app/(admin)/exams/dashboard/ExamAttendanceTrendCard.tsx` and `page.tsx`:
     - Summarizes total exam absences, medical exemptions, and total paper turnout percentage.
     - Renders a per-exam, per-class absentee trend table with visual progress indicators and turnout ratios.

---

## 2. Test Execution Evidence

### Vitest Unit & Integration Suite (`src/lib/__tests__/examAttendanceSync.test.ts`)
```
✓ src/lib/__tests__/examAttendanceSync.test.ts (5 tests)
  ✓ 2.1: Absences marked during marks entry sync into student_attendance with source='EXAM' and examScheduleId
  ✓ 2.2: Zero double-records — re-saving marks entry does not create duplicate attendance records
  ✓ 2.3: Unlocking marks & correcting from ABSENT to PRESENT reconciles attendance to PRESENT and writes audit_logs
  ✓ 2.4: Medical exemption creates status='LEAVE' with medical exemption remarks
  ✓ 2.5: Cross-tenant isolation — School A attendance sync cannot query or touch School B student records
```

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 8 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/marksActions.ts -> saveMarkEntries()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/marksActions.ts -> lockMarks()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/marksActions.ts -> unlockMarks()
Auditing 18 examination routes for assertRouteAccess & session checks...
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/dashboard/page.tsx
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

---

## 3. Cross-Tenant Isolation Verification
- Probed in `2.5`: School A calling `syncExamAttendance` with a student ID belonging to School B is completely filtered out (`syncedAbsencesCount: 0`). School B's attendance table remains pristine.
- All database queries and upserts enforce tenant boundary `eq(studentAttendance.schoolId, schoolId)`.

---

## 4. Conclusion
Layer 2 is complete, verified, and adheres to all architectural constraints.
Ready for Layer 3: Communication Wiring.
