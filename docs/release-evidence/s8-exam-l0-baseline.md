# S8 Offline Examinations: Layer 0 Baseline & Guard Rails

> **Sprint**: S8 Offline Examinations Module Rebuild  
> **Layer**: 0 — Recon and guard rails  
> **Date**: October 2026  
> **Baseline Commit**: `69db79fb1b0272c8a80e849b58636934760e2eaf`  
> **Target Status**: Clean working tree against `origin/main`

---

## 1. Baseline Verification

### 1.1 Git Status & Commit
- Current Head: `69db79fb1b0272c8a80e849b58636934760e2eaf`
- Branch: `main` (synchronized with `origin/main`)
- Working tree: clean (untracked `frontend/Untitled-1.txt` editor buffer preserved)

### 1.2 System Manuals & Architecture Reviewed
- `docs/manuals/02_system_architecture_and_design_patterns_manual.md`: Verified tenant isolation patterns (`withTenant`, `requireSchool`), append-only audit log trigger semantics, and fail-closed security.
- `docs/manuals/03_core_modules_deep_dive_manual.md`: Examined Section 7 (Examinations & Grading Engine) and Section 6 (Fee Invoices & Defaulters).
- `SCHOOL-ERP-UIUX-SPEC.md v2.0`: Reviewed constraints including UX-R02 (teacher mobile offline), UX-R08 (2-tap navigation), UX-R14 (soft delete consequence), UX-R16 (5-item menu limit), UX-R20 (thumb-zone ergonomics), UX-R24/25 (status tokens), UX-R47 (numeric keypad), UX-R62 (zero public tracking), UX-P01/P03 (optimistic safe-queue), and UX-P09 (import validation).
- `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`: Budget requirements (no N+1 in fee batch checks, worker-based PDF generation, sub-second P95).

---

## 2. Test Suite Baseline Measurements

All test suites were executed at `69db79f` with 100% passing baseline:

| Test Suite | Result | Details |
|---|---|---|
| **Backend Unit Tests** (`vitest run`) | ✅ **PASS** | 27 test files, 192 tests passed (Duration: 10.68s) |
| **Frontend Unit Tests** (`vitest run`) | ✅ **PASS** | 19 test files, 137 tests passed (Duration: 4.61s) |
| **Turborepo Type Check** (`turbo run type-check`) | ✅ **PASS** | 6 packages passed (0 type errors) |
| **Turborepo Lint** (`turbo run lint`) | ✅ **PASS** | 2 packages passed (0 lint errors) |
| **Local PostgreSQL Database** | ✅ **HEALTHY** | Connected on port 5444 (`schoolmitra_erp`) |
| **Migration Sequence Audit** | ⚠️ **DISCOVERY** | `0034_fix_rls_policies_for_pool.sql` unjournaled in `_journal.json`; journal sync queued for Layer 1. |

---

## 3. Capability-to-Layer Implementation Map

Mapped from the authoritative *Offline Examinations Module Guide* with User Amendments:

| Guide Stage & Capability | Target Sprint Layers | Architectural Deliverables |
|---|---|---|
| **Stage 1: Setup**<br>• Reusable Exam Types as Components<br>• Per-exam Class Scope<br>• Custom Grade Rules per Class<br>• Cocurricular Areas | **Layer 1** (Data Foundation)<br>**Layer 2** (Domain & Permissions)<br>**Layer 3** (Actions)<br>**Layer 4** (Setup UI) | `exam_components`, `exam_class_scopes`, `cocurricular_areas`, `grade_rules.class_id`, Exam Setup Wizard drawer, stage-adaptive action cards. |
| **Stage 2: Schedule**<br>• Paper timetable (room, invigilator)<br>• Mark distributions per Class-Subject-Component<br>• Distribution immutability once marks exist<br>• Datesheet publish gate | **Layer 1** (Data Foundation)<br>**Layer 3** (Actions)<br>**Layer 5** (Schedule UI) | `exam_mark_distributions`, `exam_schedules.datesheet_published_at`, distribution locking guard, parent datesheet visibility gate. |
| **Stage 3: Admit Cards**<br>• Customizable template & availability window<br>• Per-student holds with reasons<br>• Fee-defaulter lock (OFF, SOFT, HARD)<br>• Parent portal download | **Layer 1** (Data Foundation)<br>**Layer 3** (Actions)<br>**Layer 6** (Admit Cards UI & Parent) | `exam_admit_card_settings`, `admit_card_templates`, `exam_admit_card_holds`, soft-lock override, `/portal/admit-cards` route. |
| **Stage 4: Marks Entry**<br>• Teacher allocated-subject scoping (no `/exams/*` routes)<br>• Dual responsive grid (spreadsheet & phone keypad)<br>• Optimistic safe-queue offline mode<br>• Teacher submit -> Admin lock/unlock<br>• Cocurricular & Remarks entry<br>• CSV import center | **Layer 1** (Data Foundation)<br>**Layer 2** (Grade Engine v2)<br>**Layer 3** (Actions & Scoping)<br>**Layer 7** (Marks Entry UI) | `exam_marks_locks`, `cocurricular_grades`, `assertTeacherTeaches`, optimistic safe-queue with localStorage sync, audited unlocks, two partial unique indexes on `mark_entries` to fix NULL hole. |
| **Stage 5: Results**<br>• Report card setups with multi-exam weightages<br>• Bulk generation worker & PDF uploads<br>• Frozen immutable snapshot v1<br>• Audited revised result versioning (v2, v3)<br>• Result settings (withhold, scheduled release, holds) | **Layer 1** (Data Foundation)<br>**Layer 2** (Grade Engine v2)<br>**Layer 3** (Actions)<br>**Layer 8** (Results & Snapshots)<br>**Layer 9** (Result Settings & Visibility) | `report_card_setups`, `result_settings`, `result_snapshots` with DB immutability trigger, `uploaded_marksheets`, release gate. |
| **Stage 6: Analytics & Public Portal**<br>• Class-wise pass %, division spread, subject averages<br>• Merit list & downloadable rank sheet PDF<br>• Topper certificate issuance<br>• School-branded 2FA Public Result Portal (Plain Route Handler)<br>• Staff REST API endpoints | **Layer 1** (Data Foundation)<br>**Layer 2** (Grade Engine v2)<br>**Layer 3** (Actions)<br>**Layer 10** (Analytics & Staff APIs)<br>**Layer 11** (Public Result Portal) | `/s/[slug]/results` 2FA lookup (Admission No + DOB), plain POST route handler, rate limiting on first-hop IP, uniform not-found, `public_result_lookups`, staff REST APIs. |
| **RBAC Finalization & Audit**<br>• Page guard audit for `/exams/*` & `/portal/admit-cards`<br>• Full role allow/deny drill (Playwright)<br>• Manuals update & 3-way match verdict | **Layer 12** (Final RBAC, CI Drills & Verdict) | Page guard checker script, Playwright test suite, manual updates, `docs/release-evidence/s8-verdict.md`. |

---

## 4. Layer 0 Sign-Off
Layer 0 recon and baseline audit are complete. All test suites are confirmed green. Guard rails and execution sequence established. Proceeding directly to **Layer 1: Data foundation**.
