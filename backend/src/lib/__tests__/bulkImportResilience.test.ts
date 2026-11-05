import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  classSubjects,
  students,
  studentFamilyMembers,
  studentClassHistory,
  staff,
  departments,
  designations,
  users,
  persons,
  userRoles,
  roles,
  feeInvoices,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { withTenant } from "../tenant";
import {
  normalizePhone,
  normalizeDate,
  normalizeGender,
  normalizeName,
  parseNames,
  resolveClassAndSection,
  parseRawTextToRows,
  validateStudentImportRows,
  executeStudentImportBatch,
  validateStaffImportRows,
  executeStaffImportBatch,
  validateFeeImportRows,
  executeFeeImportBatch,
  extractFeeRow,
  generateClerkRejectedRowsCsv,
} from "../bulkImportResilience";

const TEST_IDS = {
  schoolId: "c7777777-7777-4777-8777-777777777777",
  adminUserId: "c7777777-7777-4777-8777-555555555555",
  academicYearId: "c7777777-7777-4777-8777-aaaaaaaaaaaa",
  class10Id: "c7777777-7777-4777-8777-101010101010",
  class9Id: "c7777777-7777-4777-8777-090909090909",
  section10AId: "c7777777-7777-4777-8777-10a10a10a10a",
  section10BId: "c7777777-7777-4777-8777-10b10b10b10b",
  section9AId: "c7777777-7777-4777-8777-09a09a09a09a",
  deptId: "c7777777-7777-4777-8777-dddddddddddd",
  desigTeacherId: "c7777777-7777-4777-8777-eeeeeeeeeeee",
  desigStaffId: "c7777777-7777-4777-8777-ffffffffffff",
};

describe("Phase D1-L3: Bulk Import Truth & Row-Level Resilience (Charter BR4)", () => {
  const t = TEST_IDS;

  beforeAll(async () => {
    // 1. Seed School & Admin User
    await db
      .insert(schools)
      .values({
        id: t.schoolId,
        name: "Resilience Demonstration Academy",
        slug: "resilience-demo-acad",
        udiseCode: "UDRESIL000001",
        board: "CBSE",
        address: "100 Resilience Highway",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        phone: "9876543210",
        email: "admin@resilience-demo.edu",
        principalName: "Dr. Resilience Principal",
        establishedYear: 2026,
        isActive: true,
      })
      .onConflictDoNothing();

    await withTenant(t.schoolId, async (tx) => {
      await tx.delete(feeInvoices).where(eq(feeInvoices.schoolId, t.schoolId));
      await tx.delete(studentFamilyMembers).where(eq(studentFamilyMembers.schoolId, t.schoolId));
      await tx.delete(studentClassHistory).where(eq(studentClassHistory.schoolId, t.schoolId));
      await tx.delete(students).where(eq(students.schoolId, t.schoolId));
      await tx.delete(staff).where(eq(staff.schoolId, t.schoolId));
      await tx.delete(classSubjects).where(eq(classSubjects.schoolId, t.schoolId));
      await tx.delete(sections).where(eq(sections.schoolId, t.schoolId));
      await tx.delete(classes).where(eq(classes.schoolId, t.schoolId));
      await tx.delete(academicYears).where(eq(academicYears.schoolId, t.schoolId));
      await tx.delete(designations).where(eq(designations.schoolId, t.schoolId));
      await tx.delete(departments).where(eq(departments.schoolId, t.schoolId));

      await tx
        .insert(users)
        .values({
          id: t.adminUserId,
          schoolId: t.schoolId,
          email: "admin@resilience-demo.edu",
          passwordHash: "hash123",
          isActive: true,
          isEmailVerified: true,
        })
        .onConflictDoNothing();

      // 2. Active Academic Year
      await tx
        .insert(academicYears)
        .values({
          id: t.academicYearId,
          schoolId: t.schoolId,
          label: "2026-2027",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          isActive: true,
        });

      // 3. Classes (Class 10 and Class 9)
      await tx
        .insert(classes)
        .values([
          {
            id: t.class10Id,
            schoolId: t.schoolId,
            academicYearId: t.academicYearId,
            displayName: "Class 10",
            gradeLevel: "CLASS_10",
            sortOrder: 10,
            isActive: true,
          },
          {
            id: t.class9Id,
            schoolId: t.schoolId,
            academicYearId: t.academicYearId,
            displayName: "Class 9",
            gradeLevel: "CLASS_9",
            sortOrder: 9,
            isActive: true,
          },
        ])
        .onConflictDoNothing();

      // 4. Sections (10-A, 10-B, 9-A)
      await tx
        .insert(sections)
        .values([
          {
            id: t.section10AId,
            schoolId: t.schoolId,
            classId: t.class10Id,
            name: "A",
            capacity: 40,
            isActive: true,
          },
          {
            id: t.section10BId,
            schoolId: t.schoolId,
            classId: t.class10Id,
            name: "B",
            capacity: 40,
            isActive: true,
          },
          {
            id: t.section9AId,
            schoolId: t.schoolId,
            classId: t.class9Id,
            name: "A",
            capacity: 40,
            isActive: true,
          },
        ])
        .onConflictDoNothing();

      // 5. Department & Designation
      await tx
        .insert(departments)
        .values({
          id: t.deptId,
          schoolId: t.schoolId,
          name: "Academics",
          isActive: true,
        })
        .onConflictDoNothing();

      await tx
        .insert(designations)
        .values([
          {
            id: t.desigTeacherId,
            schoolId: t.schoolId,
            departmentId: t.deptId,
            name: "TGT Teacher",
            mappedRole: "TEACHER",
            isTeaching: true,
            isActive: true,
          },
          {
            id: t.desigStaffId,
            schoolId: t.schoolId,
            departmentId: t.deptId,
            name: "Clerk",
            mappedRole: "STAFF",
            isTeaching: false,
            isActive: true,
          },
        ])
        .onConflictDoNothing();
    });
  });

  beforeEach(async () => {
    // Reset tenant tables before each test
    await withTenant(t.schoolId, async (tx) => {
      await tx.delete(feeInvoices).where(eq(feeInvoices.schoolId, t.schoolId));
      await tx.delete(studentFamilyMembers).where(eq(studentFamilyMembers.schoolId, t.schoolId));
      await tx.delete(studentClassHistory).where(eq(studentClassHistory.schoolId, t.schoolId));
      await tx.delete(students).where(eq(students.schoolId, t.schoolId));
      await tx.delete(staff).where(eq(staff.schoolId, t.schoolId));
    });
  });

  // ─── SUITE 1: MESSY SCHOOL DATA NORMALIZATION PRIMITIVES ─────────────────────────────
  describe("1. Messy School Data Normalization & Parsing (BR4)", () => {
    it("normalizes phone formats (+91, 91 prefix, spaces, dashes, parentheses) to 10 digits", () => {
      expect(normalizePhone("+91 98765-43210").normalized).toBe("9876543210");
      expect(normalizePhone("919876543210").normalized).toBe("9876543210");
      expect(normalizePhone("+919876543210").normalized).toBe("9876543210");
      expect(normalizePhone("09876543210").normalized).toBe("9876543210");
      expect(normalizePhone("(987) 654-3210").normalized).toBe("9876543210");
      expect(normalizePhone("98765 43210").normalized).toBe("9876543210");
      expect(normalizePhone("9876543210").normalized).toBe("9876543210");

      // Invalid lengths return clear error
      const shortRes = normalizePhone("12345");
      expect(shortRes.normalized).toBeNull();
      expect(shortRes.error).toContain("must be a 10-digit number");
    });

    it("normalizes dates in dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, and Excel serial numbers", () => {
      expect(normalizeDate("14/05/2012").normalized).toBe("2012-05-14");
      expect(normalizeDate("14-05-2012").normalized).toBe("2012-05-14");
      expect(normalizeDate("2012-05-14").normalized).toBe("2012-05-14");
      expect(normalizeDate("5/4/2012").normalized).toBe("2012-04-05");
      expect(normalizeDate("05-04-2012").normalized).toBe("2012-04-05");

      // Excel serial date 41043 is 2012-05-14
      expect(normalizeDate(41043).normalized).toBe("2012-05-14");

      // Invalid date returns clear error
      const badDate = normalizeDate("not-a-date");
      expect(badDate.normalized).toBeNull();
      expect(badDate.error).toContain("Invalid date 'not-a-date'");
    });

    it("fuzzy normalizes section variants ('10-A', '10 A', 'x-a', 'X A', 'Class 10 - A') to configured class and section IDs", () => {
      const mockClasses = [
        { id: t.class10Id, displayName: "Class 10", gradeLevel: "CLASS_10" },
        { id: t.class9Id, displayName: "Class 9", gradeLevel: "CLASS_9" },
      ];
      const mockSections = [
        { id: t.section10AId, classId: t.class10Id, name: "A" },
        { id: t.section10BId, classId: t.class10Id, name: "B" },
        { id: t.section9AId, classId: t.class9Id, name: "A" },
      ];

      // Test variant 1: '10-A' in class column with empty section
      const res1 = resolveClassAndSection("10-A", "", mockClasses, mockSections);
      expect("classId" in res1 && res1.classId).toBe(t.class10Id);
      expect("sectionId" in res1 && res1.sectionId).toBe(t.section10AId);

      // Test variant 2: '10 A' in class column
      const res2 = resolveClassAndSection("10 A", "", mockClasses, mockSections);
      expect("classId" in res2 && res2.classId).toBe(t.class10Id);
      expect("sectionId" in res2 && res2.sectionId).toBe(t.section10AId);

      // Test variant 3: Roman numeral 'x-a'
      const res3 = resolveClassAndSection("x-a", "", mockClasses, mockSections);
      expect("classId" in res3 && res3.classId).toBe(t.class10Id);
      expect("sectionId" in res3 && res3.sectionId).toBe(t.section10AId);

      // Test variant 4: Roman numeral with space 'X A'
      const res4 = resolveClassAndSection("X A", "", mockClasses, mockSections);
      expect("classId" in res4 && res4.classId).toBe(t.class10Id);
      expect("sectionId" in res4 && res4.sectionId).toBe(t.section10AId);

      // Test variant 5: 'Class 10 - A'
      const res5 = resolveClassAndSection("Class 10 - A", "", mockClasses, mockSections);
      expect("classId" in res5 && res5.classId).toBe(t.class10Id);
      expect("sectionId" in res5 && res5.sectionId).toBe(t.section10AId);

      // Test variant 6: '10th' and 'Sec A'
      const res6 = resolveClassAndSection("10th", "Sec A", mockClasses, mockSections);
      expect("classId" in res6 && res6.classId).toBe(t.class10Id);
      expect("sectionId" in res6 && res6.sectionId).toBe(t.section10AId);

      // Test variant 7: Non-existent class returns clerk-actionable error
      const resBad = resolveClassAndSection("Class 99", "A", mockClasses, mockSections);
      expect("error" in resBad).toBe(true);
      if ("error" in resBad) {
        expect(resBad.error).toContain("Class 'Class 99' not found");
        expect(resBad.fix).toContain("Class 10, Class 9");
      }
    });

    it("cleans mixed casing and parses full names into first and last names", () => {
      expect(normalizeName("aArAv   sHaRmA")).toBe("Aarav Sharma");
      expect(normalizeName("VIKRAM MALHOTRA")).toBe("Vikram Malhotra");
      expect(normalizeName("priya verma")).toBe("Priya Verma");

      const parsed = parseNames(undefined, undefined, "Aarav Rajesh Sharma");
      expect(parsed.firstName).toBe("Aarav");
      expect(parsed.lastName).toBe("Rajesh Sharma");

      const singleName = parseNames("Aarav");
      expect(singleName.firstName).toBe("Aarav");
      expect(singleName.lastName).toBe(".");
    });

    it("parses both CSV and tab-separated (copy-paste from Excel) inputs into row objects", () => {
      // Tab-separated from Excel copy
      const tsv = "Admission Number\tFirst Name\tLast Name\tClass Name\nADM-001\tAarav\tSharma\tClass 10\nADM-002\tDiya\tPatel\tClass 10";
      const tsvRows = parseRawTextToRows(tsv);
      expect(tsvRows).toHaveLength(2);
      expect(tsvRows[0]?.["Admission Number"]).toBe("ADM-001");
      expect(tsvRows[1]?.["First Name"]).toBe("Diya");

      // Comma-separated CSV
      const csv = `Admission Number,First Name,Last Name,Class Name\n"ADM-001","Aarav","Sharma","Class 10"`;
      const csvRows = parseRawTextToRows(csv);
      expect(csvRows).toHaveLength(1);
      expect(csvRows[0]?.["Admission Number"]).toBe("ADM-001");
    });
  });

  // ─── SUITE 2: ROW-LEVEL RESILIENCE & CLERK ERROR ACCURACY (Charter BR4) ─────────────
  describe("2. Row-Level Resilience: Valid Rows Saved Despite Invalid Rows (Charter BR4)", () => {
    it("persists valid rows, skips invalid rows with reasons, and generates downloadable rejected CSV without all-or-nothing rollback", async () => {
      // Deliberately messy batch with 3 rows:
      // Row 1: Valid student with messy phone and date formats
      // Row 2: Corrupted row with non-existent class and corrupted phone
      // Row 3: Valid student with section embedded in class name ('10-A')
      const batch: Record<string, string>[] = [
        {
          "Admission Number": "ADM-RES-01",
          "First Name": "aArAv",
          "Last Name": "sHaRmA",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "14/05/2012", // DD/MM/YYYY
          Gender: "boy",                             // Messy gender enum
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "+91 98765-43210",          // Messy phone
        },
        {
          "Admission Number": "ADM-RES-02",
          "First Name": "Corrupted",
          "Last Name": "Student",
          "Class Name": "Class 99 NonExistent",       // Invalid Class
          Section: "Z",
          "Date of Birth (YYYY-MM-DD)": "not-a-date", // Invalid Date
          Gender: "MALE",
          "Parent / Guardian Name": "Guardian",
          "Parent Phone": "123",                      // Invalid Phone (3 digits)
        },
        {
          "Admission Number": "ADM-RES-03",
          "First Name": "Rohan",
          "Last Name": "Verma",
          "Class Name": "10-A",                       // Section embedded in Class
          Section: "",
          "Date of Birth (YYYY-MM-DD)": "2012-07-22",
          Gender: "MALE",
          "Parent / Guardian Name": "Suresh Verma",
          "Parent Phone": "98765 43212",
        },
      ];

      // 1. Dry Run Validation
      const dryRun = await validateStudentImportRows(t.schoolId, batch, db);
      expect(dryRun.totalRows).toBe(3);
      expect(dryRun.validRowsCount).toBe(2);
      expect(dryRun.invalidRowsCount).toBe(1);

      // Row 2 is flagged with clerk-friendly instructions
      const failedRow = dryRun.rows.find((r) => r.rowNumber === 3)!; // Header + 2nd row = line 3
      expect(failedRow.isValid).toBe(false);
      expect(failedRow.error).toContain("Class 'Class 99 NonExistent' not found");
      expect(failedRow.actionableFix).toContain("Change class name to match");

      // 2. Commit Batch with Row-Level Resilience
      const commitRes = await executeStudentImportBatch(
        t.schoolId,
        batch,
        {
          userId: t.adminUserId,
          userEmail: "admin@resilience-demo.edu",
        },
        db
      );

      // INVARIANT: Exactly 2 valid rows persisted, exactly 1 row skipped with reason
      expect(commitRes.totalProcessed).toBe(3);
      expect(commitRes.createdCount).toBe(2);
      expect(commitRes.skippedCount).toBe(1);
      expect(commitRes.duplicatesMergedCount).toBe(0);

      // Finished state message matches charter standard
      expect(commitRes.message).toBe(
        "Imported 2 students, 1 skipped with reasons, 0 duplicates merged. Next: assign fee structures."
      );
      expect(commitRes.finishedState.nextActionLabel).toBe("Assign Fee Structures");
      expect(commitRes.finishedState.nextActionHref).toBe("/school/fees");

      // Rejected rows CSV contains ONLY the defective Row 2
      expect(commitRes.rejectedRowsCsv).toContain("ADM-RES-02");
      expect(commitRes.rejectedRowsCsv).not.toContain("ADM-RES-01");
      expect(commitRes.rejectedRowsCsv).not.toContain("ADM-RES-03");
      expect(commitRes.rejectedRowsCsv).toContain("Class 'Class 99 NonExistent' not found");

      // 3. Database Truth Verification: Valid students exist in DB
      const dbStudents = await withTenant(t.schoolId, async (tx) => {
        return await tx.query.students.findMany({
          where: eq(students.schoolId, t.schoolId),
        });
      });
      expect(dbStudents).toHaveLength(2);
      const admList = dbStudents.map((s) => s.admissionNumber);
      expect(admList).toContain("ADM-RES-01");
      expect(admList).toContain("ADM-RES-03");
      expect(admList).not.toContain("ADM-RES-02");
    });
  });

  // ─── SUITE 3: IDEMPOTENCY & ZERO DUPLICATES ON RE-UPLOAD ────────────────────────────
  describe("3. Idempotency: Zero Duplicates on Re-Upload", () => {
    it("creates ZERO duplicates when re-uploading the exact same file", async () => {
      const batch: Record<string, string>[] = [
        {
          "Admission Number": "ADM-IDEM-01",
          "First Name": "Aarav",
          "Last Name": "Sharma",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          Gender: "MALE",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "9876543210",
        },
        {
          "Admission Number": "ADM-IDEM-02",
          "First Name": "Diya",
          "Last Name": "Patel",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-08-20",
          Gender: "FEMALE",
          "Parent / Guardian Name": "Kiran Patel",
          "Parent Phone": "9876543211",
        },
      ];

      // First run: 2 students created
      const run1 = await executeStudentImportBatch(
        t.schoolId,
        batch,
        { userId: t.adminUserId },
        db
      );
      expect(run1.createdCount).toBe(2);
      expect(run1.duplicatesMergedCount).toBe(0);

      const countAfterRun1 = await withTenant(t.schoolId, async (tx) => {
        const list = await tx.query.students.findMany({ where: eq(students.schoolId, t.schoolId) });
        return list.length;
      });
      expect(countAfterRun1).toBe(2);

      // Second run with EXACT SAME file
      const run2 = await executeStudentImportBatch(
        t.schoolId,
        batch,
        { userId: t.adminUserId },
        db
      );

      // INVARIANT: 0 created, 2 duplicates merged/skipped, 0 skipped with errors
      expect(run2.createdCount).toBe(0);
      expect(run2.duplicatesMergedCount).toBe(2);
      expect(run2.skippedCount).toBe(0);

      // Check DB: STILL exactly 2 students! Zero duplicates!
      const countAfterRun2 = await withTenant(t.schoolId, async (tx) => {
        const list = await tx.query.students.findMany({ where: eq(students.schoolId, t.schoolId) });
        return list.length;
      });
      expect(countAfterRun2).toBe(2);
    });

    it("detects duplicates via secondary match (name + class + guardian mobile)", async () => {
      // 1. Seed initial student
      const initialBatch = [
        {
          "Admission Number": "ADM-ORIG-01",
          "First Name": "Pooja",
          "Last Name": "Nair",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-03-15",
          Gender: "FEMALE",
          "Parent / Guardian Name": "Gopal Nair",
          "Parent Phone": "9876543230",
        },
      ];
      const r1 = await executeStudentImportBatch(t.schoolId, initialBatch, { userId: t.adminUserId }, db);
      expect(r1.createdCount).toBe(1);

      // 2. Conflicting match test: same name + class + guardian phone, but DIFFERENT admission number
      const conflictBatch = [
        {
          "Admission Number": "ADM-CONFLICT-99", // Different adm number!
          "First Name": "Pooja",
          "Last Name": "Nair",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-03-15",
          Gender: "FEMALE",
          "Parent / Guardian Name": "Gopal Nair",
          "Parent Phone": "+91 98765-43230",     // Same parent mobile
        },
      ];

      const r2 = await executeStudentImportBatch(t.schoolId, conflictBatch, { userId: t.adminUserId }, db);
      // Conflict must be skipped with actionable guidance, not auto-merged silently!
      expect(r2.createdCount).toBe(0);
      expect(r2.skippedCount).toBe(1);
      expect(r2.errors[0]).toContain("Conflicting student match");
      expect(r2.errors[0]).toContain("ADM-ORIG-01");
    });
  });

  // ─── SUITE 4: STAFF IMPORT RESILIENCE & ROLE CLAMPING ───────────────────────────────
  describe("4. Staff Import Resilience & Role Clamping", () => {
    it("persists permitted roles (TEACHER, STAFF, ACCOUNTANT) and rejects admin roles (PRINCIPAL) with row-level resilience", async () => {
      const staffBatch = [
        {
          "Employee Code": "EMP-T-101",
          "First Name": "Sunita",
          "Last Name": "Rao",
          "Official Email": "sunita.rao@resilience-demo.edu",
          "Contact Phone": "+91 98765-43280",
          Department: "Academics",
          Designation: "Senior Teacher",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-T-102",
          "First Name": "Rogue",
          "Last Name": "Principal",
          "Official Email": "rogue.principal@resilience-demo.edu",
          "Contact Phone": "9876543281",
          Department: "Administration",
          Designation: "Principal",
          "System Role": "PRINCIPAL", // Disallowed admin role!
        },
        {
          "Employee Code": "EMP-T-103",
          "First Name": "Mohan",
          "Last Name": "Kumar",
          "Official Email": "mohan.kumar@resilience-demo.edu",
          "Contact Phone": "9876543282",
          Department: "Finance",
          Designation: "Accountant",
          "System Role": "ACCOUNTANT",
        },
      ];

      const commitRes = await executeStaffImportBatch(
        t.schoolId,
        staffBatch,
        { userId: t.adminUserId },
        db
      );

      // INVARIANT: Exactly 2 valid staff created, 1 skipped with role clamping error
      expect(commitRes.totalProcessed).toBe(3);
      expect(commitRes.createdCount).toBe(2);
      expect(commitRes.skippedCount).toBe(1);
      expect(commitRes.message).toBe(
        "Imported 2 staff, 1 skipped with reasons, 0 duplicates merged. Next: review timetable."
      );
      expect(commitRes.finishedState.nextActionLabel).toBe("Review Timetable");
      expect(commitRes.finishedState.nextActionHref).toBe("/school/timetable");

      // Verify DB staff records
      const savedStaff = await withTenant(t.schoolId, async (tx) => {
        return await tx.query.staff.findMany({
          where: eq(staff.schoolId, t.schoolId),
        });
      });
      expect(savedStaff).toHaveLength(2);
      const empCodes = savedStaff.map((s) => s.employeeCode);
      expect(empCodes).toContain("EMP-T-101");
      expect(empCodes).toContain("EMP-T-103");
      expect(empCodes).not.toContain("EMP-T-102");

      // Verify re-run produces zero duplicates
      const reRun = await executeStaffImportBatch(
        t.schoolId,
        staffBatch,
        { userId: t.adminUserId },
        db
      );
      expect(reRun.createdCount).toBe(0);
      expect(reRun.duplicatesMergedCount).toBe(2);
      expect(reRun.skippedCount).toBe(1);
    });
  });

  // ─── SUITE 5: EXTENDED REAL-WORLD MESSY SCHOOL EDGE CASES (BR4) ──────────────────────
  describe("5. Extended Real-World Messy School Edge Cases", () => {
    it("handles Excel float artifacts, multi-number phone inputs, and international prefixes", () => {
      // Excel float representation
      expect(normalizePhone("9876543210.0").normalized).toBe("9876543210");
      expect(normalizePhone(9876543210).normalized).toBe("9876543210");

      // Multiple phone numbers separated by slashes or commas
      expect(normalizePhone("9876543210 / 9123456789").normalized).toBe("9876543210");
      expect(normalizePhone("9876543210, 9123456789").normalized).toBe("9876543210");

      // Leading country code variants
      expect(normalizePhone("+91 09876543210").normalized).toBe("9876543210");
      expect(normalizePhone("00919876543210").normalized).toBe("9876543210");
    });

    it("handles 3-letter month dates and spaced delimiters", () => {
      expect(normalizeDate("14-May-2012").normalized).toBe("2012-05-14");
      expect(normalizeDate("15 Aug 2012").normalized).toBe("2012-08-15");
      expect(normalizeDate("14-MAY-2012").normalized).toBe("2012-05-14");
      expect(normalizeDate("14 / 05 / 2012").normalized).toBe("2012-05-14");
      expect(normalizeDate("14 - 05 - 2012").normalized).toBe("2012-05-14");
    });

    it("matches single-name students with default '.' last name on secondary idempotency", async () => {
      const singleNameBatch = [
        {
          "Admission Number": "ADM-SINGLE-01",
          "First Name": "Aarav",
          "Last Name": "", // Single name, no surname!
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          Gender: "MALE",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "9876543210",
        },
      ];

      const res1 = await executeStudentImportBatch(t.schoolId, singleNameBatch, { userId: t.adminUserId }, db);
      expect(res1.createdCount).toBe(1);

      // Re-upload with the same single-name student
      const res2 = await executeStudentImportBatch(t.schoolId, singleNameBatch, { userId: t.adminUserId }, db);
      expect(res2.createdCount).toBe(0);
      expect(res2.duplicatesMergedCount).toBe(1);
    });

    it("flags conflicting student matches in dry-run preview as invalid with clerk-actionable fix", async () => {
      // Seed existing student
      const initialStudent = [
        {
          "Admission Number": "ADM-ORIGINAL-01",
          "First Name": "Kavya",
          "Last Name": "Menon",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-08-10",
          Gender: "FEMALE",
          "Parent / Guardian Name": "Suresh Menon",
          "Parent Phone": "9876543290",
        },
      ];
      await executeStudentImportBatch(t.schoolId, initialStudent, { userId: t.adminUserId }, db);

      // Dry-run preview with conflicting admission number for same student
      const conflictBatch = [
        {
          "Admission Number": "ADM-CONFLICT-99", // Different admission number!
          "First Name": "Kavya",
          "Last Name": "Menon",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-08-10",
          Gender: "FEMALE",
          "Parent / Guardian Name": "Suresh Menon",
          "Parent Phone": "9876543290",
        },
      ];

      const dryRun = await validateStudentImportRows(t.schoolId, conflictBatch, db);
      expect(dryRun.validRowsCount).toBe(0);
      expect(dryRun.invalidRowsCount).toBe(1);
      const conflictRow = dryRun.rows[0]!;
      expect(conflictRow.isValid).toBe(false);
      expect(conflictRow.error).toContain("Conflicting student match");
      expect(conflictRow.actionableFix).toContain("ADM-ORIGINAL-01");
    });

    it("validates and commits opening fee balances with messy column aliases (Opening Balance, Dues)", async () => {
      // First seed a student
      const studentBatch = [
        {
          "Admission Number": "ADM-FEE-01",
          "First Name": "Diya",
          "Last Name": "Patel",
          "Class Name": "Class 10",
          Section: "A",
          "Date of Birth (YYYY-MM-DD)": "2012-07-22",
          Gender: "FEMALE",
          "Parent / Guardian Name": "Kiran Patel",
          "Parent Phone": "9876543211",
        },
      ];
      await executeStudentImportBatch(t.schoolId, studentBatch, { userId: t.adminUserId }, db);

      // Fee rows with messy header aliases
      const feeBatch: Record<string, string>[] = [
        {
          "Adm No": "ADM-FEE-01",
          "Opening Balance": "₹ 7,500.00",
          "Due Date": "15/12/2026",
        },
      ];

      const dryRun = await validateFeeImportRows(t.schoolId, feeBatch, t.academicYearId, db);
      expect(dryRun.validRowsCount).toBe(1);
      expect(dryRun.rows[0]?.displayName).toBe("Diya Patel");
      expect(dryRun.rows[0]?.normalizedData?.grossAmount).toBe(7500);

      const commit = await executeFeeImportBatch(
        t.schoolId,
        t.academicYearId,
        feeBatch,
        { userId: t.adminUserId },
        db
      );
      expect(commit.createdCount).toBe(1);
      expect(commit.message).toContain("Imported 1 opening fee balances");
      expect(commit.finishedState.nextActionLabel).toBe("View Fee Dues");
    });
  });
});

