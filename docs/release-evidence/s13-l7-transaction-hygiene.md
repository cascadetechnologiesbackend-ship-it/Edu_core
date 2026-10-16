# S13 Layer 7 Evidence: Transaction Hygiene, Pre-Computed Sibling Detection, Batched Document Linkage, Validation Guards, and Zero Loopback Audit IPs

**Sprint:** S13 Student Lifecycle Convergence & Durable Event Backbone  
**Layer:** Layer 7  
**Timestamp:** 2026-10-16T11:55:00+05:30  
**Status:** Certified & Verified  

---

## 1. Executive Summary

Layer 7 addresses Flaws **F8** (*Sibling detection decrypts every family member row of the school inside the transaction*), **F9** (*Hardcoded 127.0.0.1 audit and consent IPs*), and **F10** (*No capacity or active-year validation on enrollment*).

Prior to Layer 7:
1. Sibling detection decrypted every family contact row for the entire school sequentially inside the open write transaction, scaling $O(N)$ with student population and holding write locks while running crypto operations.
2. Admission document copying executed single-row `insert` statements inside a loop.
3. Enrollment lacked an active academic year guard and section capacity guard.
4. Numerous audit logs and consent records hardcoded `"127.0.0.1"`, corrupting forensic audit trails.

Under Layer 7:
1. **Pre-Computed Sibling Detection**: Sibling detection is evaluated *prior to opening the write transaction* via deterministic search-hash matching (`mobileSearchHash` and `emailSearchHash`) against indexed columns. The transaction only records the outcome.
2. **Batched Document Copying**: All application documents are copied to `studentDocuments` in a single batched multi-row `insert` operation.
3. **Validation Guards**:
   - `InactiveAcademicYearError`: Typed error raised when attempting to enroll an applicant whose application is bound to an inactive academic year.
   - `SectionCapacityExceededError`: Typed error raised when `blockOnCapacity: true` and the target section is full (enrolled active student count $\ge$ capacity). When `blockOnCapacity` is falsy (default per open decision), it logs a structured warning and allows enrollment.
4. **Truthful Request IPs & Zero 127.0.0.1 Guard**: All server actions and API routes resolve real client IPs via `getClientRequestContext()`, and background tasks attribute `"0.0.0.0"`. Static hygiene guard Check 4 enforces zero occurrences of `ipAddress: "127.0.0.1"`.

---

## 2. Implementation Details

### 2.1 Pre-Transaction Sibling Detection (`backend/src/lib/studentLifecycleEngine.ts`)
- Pre-reads the application and computes SHA-256 search hashes for primary mobile and email.
- Executes an indexed lookup on `studentFamilyMembers` using `mobileSearchHash` / `emailSearchHash` before the transaction begins.
- Zero per-row decrypts; zero search scans inside the write transaction.

### 2.2 Batched Document Copying
- Application documents are mapped into a single array and inserted into `studentDocuments` via a single `tx.insert(studentDocuments).values(mappedDocs)` call.

### 2.3 Validation Guards
- **Active Academic Year Guard**:
  ```ts
  const activeYear = await tx.query.academicYears.findFirst({
    where: and(
      eq(academicYears.schoolId, schoolId),
      eq(academicYears.id, application.academicYearId),
      eq(academicYears.isActive, true),
    ),
  });
  if (!activeYear) {
    throw new InactiveAcademicYearError(application.academicYearId, schoolId);
  }
  ```
- **Section Capacity Guard**:
  ```ts
  const activeStudentCount = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(students.currentSectionId, sectionId),
        eq(students.isActive, true),
      ),
    );
  if (targetSection.capacity && currentCount >= targetSection.capacity) {
    if (input.blockOnCapacity) {
      throw new SectionCapacityExceededError(sectionId, targetSection.capacity, currentCount);
    }
  }
  ```

### 2.4 Removal of Hardcoded 127.0.0.1 IPs
- Audit and consent writes across 14 frontend actions, server actions, and API routes now extract truthful IP headers (`x-forwarded-for`, `x-real-ip`) via `getClientRequestContext()`.
- Static hygiene guard Check 4 scans the codebase to forbid `"127.0.0.1"` in audit/consent payload assignments.

---

## 3. Empirical Verification Results

### 3.1 Unit & Integration Test Suite (`backend/src/lib/__tests__/transactionHygiene.test.ts`)
```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/transactionHygiene.test.ts (4 tests) 1074ms
   ✓ 7.1: Pre-transaction sibling detection matches family search hashes and assigns 10% concession
   ✓ 7.2: Inactive academic year throws InactiveAcademicYearError with typed forensics
   ✓ 7.3: Section capacity overflow throws SectionCapacityExceededError when blockOnCapacity is true
   ✓ 7.4: Documents are batch-copied to student_documents and audit records persist truthful IP

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### 3.2 Static Lifecycle Hygiene Guard
```bash
$ node scripts/audit-lifecycle-hygiene.mjs
Running S13 Lifecycle Hygiene Static Analysis...
✅ S13 Lifecycle Hygiene Guard PASSED: student creation is strictly engine-scoped, zero ghost references, zero dead in-memory event publisher references, zero hardcoded 127.0.0.1 audit/consent IPs.
```

### 3.3 Monorepo Typecheck
```bash
$ pnpm type-check
 Tasks:    6 successful, 6 total
 Cached:   5 cached, 6 total
 Time:     1m9.147s
```
