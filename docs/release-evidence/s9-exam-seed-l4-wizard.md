# Layer 4 Release Evidence: Onboarding Wizard UI (Live Preview, Toggle, and Review Footprint)

**Spec**: `edu-core-s9-board-exam-blueprint-seeding@9.0.0`  
**Layer**: Layer 4 — Onboarding Wizard UI  
**Timestamp**: 2026-10-15T13:21:40+05:30  
**Git Branch**: `main`  

---

## 1. Summary of Changes

Layer 4 enhances the public and dedicated school tenant onboarding wizard (`frontend/src/app/onboard/page.tsx`) with an interactive, board-accurate examination blueprint pre-seeding experience:

1. **Live Blueprint Preview Card (Step 5)**:
   - Step 5 header updated to `"Fee heads, grading & examinations"`.
   - Displays real-time board blueprint metrics:
     - Board badge (e.g., `CBSE Examination Blueprint` with `Pre-Seeding Ready` pill).
     - Dynamically derived class category badges (e.g., `NURSERY UKG`, `CLASS 1 5`, `CLASS 6 8`, `CLASS 9 10`) computed directly from the admin's configured classes.
     - Four-column metric grid showing: Exam Types, Contiguous Grade Rules, Cocurricular Areas, and Prepared Term Shells.
     - Reactive text explaining what will be seeded based on the chosen board and grading system.
2. **Pre-Seeding Opt-In/Opt-Out Toggle (Step 5)**:
   - Stylish toggle switch (`loadExamDefaults`, default `true`).
   - If disabled (`false`), shows clear placeholder messaging that exam defaults are skipped and can be loaded later.
3. **Tenant Launch Review Footprint (Step 7)**:
   - Expanded review summary metrics from 3 to 4 cards (`grid-cols-2 sm:grid-cols-4`).
   - Fourth card explicitly highlights the Examination Footprint (e.g., `7 Exams / CBSE Blueprint` when enabled, or `None / Exam Defaults Off` when toggled off).
4. **Submission Payload Integration**:
   - Wired `loadExamDefaults` directly into `registerSchoolTenant(payload)`, invoking atomic transactional seeding.

---

## 2. Test Verification

Unit tests created in `frontend/src/app/onboard/__tests__/onboardBlueprint.test.ts` verify:
- Accurate `ClassGroup` derivation for Nursery–Class 10 (`["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10"]`).
- Full K-12 coverage including `CLASS_11_12`.
- Exact blueprint footprint calculation for CBSE with 7 exam types, 4 cocurricular areas, 3 term plan names, and 28 contiguous grade rules.
- Reactive recalculation when selecting alternate scales (`PERCENTAGE` division scales).
- Coverage across all 5 boards (`CBSE`, `ICSE`, `STATE_BOARD`, `IGCSE`, `IB`).

### Test Execution Output
```
> @schoolmitra/frontend@0.1.0 test V:\Cascade\Edu_core\Edu_core\frontend
> vitest run "src/app/onboard/__tests__/onboardBlueprint.test.ts"

 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/frontend

 ✓ src/app/onboard/__tests__/onboardBlueprint.test.ts (5 tests) 7ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

---

## 3. TypeScript & AST Safety

- `pnpm --filter @schoolmitra/frontend type-check`: Passed with 0 errors.
- `node scripts/audit-unscoped-writes.mjs`: Passed with 0 findings across 52 server actions.
