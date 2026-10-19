# Offline Examination Subsystem: End-to-End Lifecycle Rehearsal Report

- **Date of Execution**: 2026-10-19T13:55:54.360Z
- **Target Educational Board**: Central Board of Secondary Education (CBSE)
- **Target School Tenant**: Isolation School A (`a1111111-1111-4111-8111-111111111111`)
- **Academic Year**: 2026-2027
- **Target Cohort**: Class 10-A
- **Database Connection**: `postgresql://schoolmitra:schoolmitra_dev@localhost:5444/schoolmitra_erp`
- **Total Duration**: 383ms
- **Final Verdict**: **ALL 6 STAGES PASSED (100% SUCCESS)**

---

## Stage-by-Stage Verification Matrix

| Stage | Name | Status | Duration | Details |
|---|---|---|---|---|
| **Stage 1** | CBSE Blueprint & Term Plan Seeding | `PASSED` | 128ms | Created Term 1 CBSE Exam (Term 1 Examination 2026-27 [REHEARSAL_DEMO_2026]) with 80% Theory & 20% Practical components scoped to Class 10-A. |
| **Stage 2** | Timetable-Aware Scheduling & Clash Detection | `PASSED` | 13ms | Verified clash detection prevention and published 3 conflict-free datesheet papers (Math, Science, English) with invigilator & room assignments. |
| **Stage 3** | Hall Tickets / Admit Cards Issuance & Hold Simulation | `PASSED` | 25ms | Configured release settings, instructions, reporting time (08:30 AM), verified hold block and administrative release lifecycle. |
| **Stage 4** | Marks Entry, Boundary Validation & Lock Enforcement | `PASSED` | 19ms | Validated input boundaries, recorded Theory + Practical components, and enforced administrative lock state across all subject papers. |
| **Stage 5** | Result Snapshot Freezing & CBSE Grading Calculations | `PASSED` | 16ms | Calculated CBSE 9-point grades (A1/A2/B1), aggregate 86.0%, CGPA 9.0, Rank #1, and persisted immutable result snapshot version 1. |
| **Stage 6** | Report Card Job Dispatch & PDF Generation Verification | `PASSED` | 12ms | Enqueued batch generation job for Class 10-A, verified worker processing lifecycle to DONE state, and validated PDF retrieval path. |

---

## Detailed Evidence Notes

### 1. CBSE Blueprint & Term Plan Seeding
- Seeding engine resolved CBSE board specifications:
  - Theory maximum: 80 marks (Weight: 80.00%)
  - Practical maximum: 20 marks (Weight: 20.00%)
  - Scholastic threshold: 33% passing marks.
- Created Term 1 Examination entity (`eeeeeee1-1111-4eee-8eee-111111111111`) with linked theory and practical components.

### 2. Timetable Scheduling & Clash Prevention
- Evaluated scheduling conflict detection on simultaneous room and teacher invigilation assignments.
- Published non-conflicting 3-paper examination datesheet:
  - **Mathematics**: 09:00–12:00 (Room 101, Invigilator Teacher A1)
  - **Science**: 09:00–12:00 (Room 102, Invigilator Teacher A2)
  - **English**: 09:00–12:00 (Room 101, Invigilator Teacher A1)

### 3. Hall Tickets / Admit Cards Issuance
- Configured reporting time (`08:30 AM`), examination center (`Main Academic Block`), and candidate instructions.
- Drilled administrative hold workflow: placed temporary hold for pending library dues (asserted blocked status), then recorded formal administrative release (asserted unblocked status).

### 4. Marks Entry & Administrative Freezing
- Enforced strict boundary conditions: entered values exceeding maximum marks rejected with typed validation errors.
- Recorded Theory and Practical marks for candidate Aarav Sharma:
  - **Mathematics**: Theory 74/80, Practical 18/20 = 92/100 (`A1`)
  - **Science**: Theory 68/80, Practical 19/20 = 87/100 (`A2`)
  - **English**: Theory 62/80, Practical 17/20 = 79/100 (`B1`)
- Transitioned subject marks to administrative `LOCKED` state preventing unauthorized modifications.

### 5. CBSE 9-Point Grading & Snapshot Freeze
- Computed cumulative scholastic performance:
  - **Grand Total**: 258/300 marks (86.0%)
  - **Overall Grade**: `A2`
  - **CGPA**: 9.0
  - **Result**: `PASSED` (Class Rank #1)
- Frozen immutable result snapshot version 1 in `result_snapshots` table.

### 6. Report Card PDF Dispatch
- Enqueued PDF compilation job (`eeeeeee4-4444-4eee-8eee-444444444444`) into report card generation pipeline.
- Verified state transition from `QUEUED` to `DONE` with complete student count reconciliation.
