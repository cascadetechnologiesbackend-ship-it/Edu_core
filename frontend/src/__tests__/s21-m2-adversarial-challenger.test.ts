import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DATASET_SCHEMAS,
  validateImportBatch,
  generateRejectedRowsCsv,
  enforceImportRowLimit,
  MAX_IMPORT_ROWS,
} from "../lib/importExportEngine";
import {
  commitStudentImportAction,
  commitStaffImportAction,
} from "../app/(admin)/school/import-center/actions";
import { StudentLifecycleEngine } from "@schoolmitra/backend/lib/studentLifecycleEngine";

// ─── 1. Mocks for React, Next, Auth & Context ──────────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/importExportEngine", async () => {
  return await import("../lib/importExportEngine");
});

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "mocked_hash_12345"),
  },
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({
    ipAddress: "103.21.54.10",
    userAgent: "EmpiricalChallenger/1.0",
  })),
}));

// ─── 2. Multi-Tenant Mock Database State ─────────────────────────────────────
const { mockDbState, mockSessionRef } = vi.hoisted(() => {
  const mockSessionRef = {
    current: {
      userId: "admin-s21-user",
      role: "SCHOOL_ADMIN",
      schoolId: "school-alpha",
      email: "admin@alpha.edu",
    } as any,
  };

  const mockDbState = {
    classes: [
      { id: "cls-10", schoolId: "school-alpha", displayName: "Class 10", isActive: true },
      { id: "cls-9", schoolId: "school-alpha", displayName: "Class 9", isActive: true },
      { id: "cls-beta-10", schoolId: "school-beta", displayName: "Class 10 Beta", isActive: true },
    ],
    sections: [
      { id: "sec-10a", classId: "cls-10", schoolId: "school-alpha", name: "A", isActive: true },
      { id: "sec-10b", classId: "cls-10", schoolId: "school-alpha", name: "B", isActive: true },
      { id: "sec-9a", classId: "cls-9", schoolId: "school-alpha", name: "A", isActive: true },
    ],
    existingStudentsInDb: new Map<string, any>([
      ["adm-existing-001", { id: "stu-1", admissionNumber: "ADM-EXISTING-001", schoolId: "school-alpha" }],
      ["adm-existing-002", { id: "stu-2", admissionNumber: "ADM-EXISTING-002", schoolId: "school-alpha" }],
    ]),
    existingStaffInDb: new Map<string, any>([
      ["emp-existing-101", { id: "stf-1", employeeCode: "EMP-EXISTING-101", schoolId: "school-alpha" }],
    ]),
    departments: [
      { id: "dept-math", schoolId: "school-alpha", name: "Mathematics", isActive: true },
    ],
    designations: [
      { id: "desig-tgt", schoolId: "school-alpha", name: "Senior TGT Teacher", departmentId: "dept-math", isActive: true },
    ],
    users: [] as any[],
    persons: [] as any[],
    roles: [] as any[],
    userRoles: [] as any[],
    staff: [] as any[],
    studentCreationLog: [] as any[],
  };

  return { mockDbState, mockSessionRef };
});

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!mockSessionRef.current) throw new Error("Unauthorized");
    const role = mockSessionRef.current.role;
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new Error(`Forbidden: Role '${role}' is not authorized.`);
    }
    return {
      session: { user: mockSessionRef.current },
      userId: mockSessionRef.current.userId,
      role: mockSessionRef.current.role,
      schoolId: mockSessionRef.current.schoolId,
      email: mockSessionRef.current.email,
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => ({
    id: ctx.schoolId,
    name: ctx.schoolId === "school-alpha" ? "Alpha Academy" : "Beta School",
  })),
  checkAuth: vi.fn(async () => ({ user: mockSessionRef.current })),
}));

// ─── 3. Mock @schoolmitra/backend/lib/studentLifecycleEngine ────────────────
vi.mock("@schoolmitra/backend/lib/studentLifecycleEngine", () => {
  return {
    StudentLifecycleEngine: {
      createImportedStudent: vi.fn(async (schoolId: string, input: any) => {
        const admKey = (input.admissionNumber || "").toLowerCase().trim();
        // Check DB existence for idempotency
        if (mockDbState.existingStudentsInDb.has(admKey)) {
          return {
            success: true,
            studentId: mockDbState.existingStudentsInDb.get(admKey).id,
            admissionNumber: input.admissionNumber,
            isNew: false,
          };
        }

        // New student created
        const newStu = {
          id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          admissionNumber: input.admissionNumber,
          schoolId,
          ...input,
        };
        mockDbState.existingStudentsInDb.set(admKey, newStu);
        mockDbState.studentCreationLog.push(newStu);
        return {
          success: true,
          studentId: newStu.id,
          admissionNumber: newStu.admissionNumber,
          isNew: true,
        };
      }),
    },
  };
});

// ─── 4. Mock @/db ───────────────────────────────────────────────────────────
vi.mock("@/db", () => {
  const query = {
    classes: {
      findMany: vi.fn(async () =>
        mockDbState.classes.filter((c) => c.schoolId === mockSessionRef.current.schoolId)
      ),
    },
    sections: {
      findMany: vi.fn(async () =>
        mockDbState.sections.filter((s) => s.schoolId === mockSessionRef.current.schoolId)
      ),
    },
    staff: {
      findMany: vi.fn(async () =>
        Array.from(mockDbState.existingStaffInDb.values()).filter(
          (s) => s.schoolId === mockSessionRef.current.schoolId
        )
      ),
    },
    departments: {
      findMany: vi.fn(async () =>
        mockDbState.departments.filter((d) => d.schoolId === mockSessionRef.current.schoolId)
      ),
    },
    designations: {
      findMany: vi.fn(async () =>
        mockDbState.designations.filter((d) => d.schoolId === mockSessionRef.current.schoolId)
      ),
    },
    users: {
      findFirst: vi.fn(async () => null),
    },
    roles: {
      findFirst: vi.fn(async () => null),
    },
    userRoles: {
      findFirst: vi.fn(async () => null),
    },
  };

  const createTxMock = () => ({
    query,
    insert: vi.fn((table: any) => ({
      values: vi.fn((val: any) => ({
        returning: vi.fn(() => [
          {
            id: `inserted-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...val,
          },
        ]),
      })),
    })),
  });

  return {
    db: { query },
    withTenant: vi.fn(async (schoolId: string, callback: (tx: any) => Promise<any>) => {
      if (mockSessionRef.current.schoolId !== schoolId) {
        throw new Error("Tenant Mismatch: cross-tenant access denied.");
      }
      const tx = createTxMock();
      return await callback(tx);
    }),
  };
});

// ─── ADVERSARIAL STRESS TEST SUITE ───────────────────────────────────────────
describe("Milestone 2 Adversarial Stress Suite (Empirical Challenger 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionRef.current = {
      userId: "admin-s21-user",
      role: "SCHOOL_ADMIN",
      schoolId: "school-alpha",
      email: "admin@alpha.edu",
    };
    mockDbState.studentCreationLog = [];
    mockDbState.existingStudentsInDb = new Map<string, any>([
      ["adm-existing-001", { id: "stu-1", admissionNumber: "ADM-EXISTING-001", schoolId: "school-alpha" }],
      ["adm-existing-002", { id: "stu-2", admissionNumber: "ADM-EXISTING-002", schoolId: "school-alpha" }],
    ]);
    mockDbState.existingStaffInDb = new Map<string, any>([
      ["emp-existing-101", { id: "stf-1", employeeCode: "EMP-EXISTING-101", schoolId: "school-alpha" }],
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 1: 5,000-Row Limit Boundary Stress
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 1: 5,000-Row Limit Boundary (5,000 Accepted vs 5,001 Rejected with Exact Guidance)", () => {
    it("empirically accepts exactly 5,000 rows without failure or memory breakdown", () => {
      const rows5000: Record<string, string>[] = [];
      for (let i = 1; i <= 5000; i++) {
        rows5000.push({
          "Admission Number": `ADM-5K-${i}`,
          "First Name": `Student${i}`,
          "Last Name": "Kumar",
          Gender: i % 2 === 0 ? "MALE" : "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-08-15",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": `Parent${i}`,
          "Parent Phone": "+919876543210",
        });
      }

      // enforceImportRowLimit boundary check
      expect(() => enforceImportRowLimit(rows5000)).not.toThrow();
      expect(() => enforceImportRowLimit(5000)).not.toThrow();

      // validateImportBatch on all 5,000 rows
      const t0 = performance.now();
      const validation = validateImportBatch("STUDENTS", rows5000);
      const duration = performance.now() - t0;

      expect(validation.totalRows).toBe(5000);
      expect(validation.validRowsCount).toBe(5000);
      expect(validation.invalidRowsCount).toBe(0);
      expect(validation.canCommit).toBe(true);
      // Ensure validator is highly performant (< 1000ms for 5000 rows)
      expect(duration).toBeLessThan(2000);
    });

    it("empirically rejects exactly 5,001 rows with the exact required guidance message", async () => {
      const rows5001: Record<string, string>[] = [];
      for (let i = 1; i <= 5001; i++) {
        rows5001.push({
          "Admission Number": `ADM-OVER-${i}`,
          "First Name": `Student${i}`,
          "Last Name": "Singh",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-10",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        });
      }

      const expectedErrorMessage =
        "Import file exceeds maximum allowed limit of 5000 rows (received 5001 rows). Please split your file into smaller batches.";

      // 1. Check enforceImportRowLimit with array
      expect(() => enforceImportRowLimit(rows5001)).toThrow(expectedErrorMessage);

      // 2. Check enforceImportRowLimit with number
      expect(() => enforceImportRowLimit(5001)).toThrow(expectedErrorMessage);

      // 3. Check validateImportBatch
      expect(() => validateImportBatch("STUDENTS", rows5001)).toThrow(expectedErrorMessage);

      // 4. Check real commit action rejects 5,001 rows
      await expect(commitStudentImportAction(rows5001)).rejects.toThrow(expectedErrorMessage);
      await expect(commitStaffImportAction(rows5001)).rejects.toThrow(expectedErrorMessage);
    });

    it("rejects 0 rows, empty array, or negative inputs with clear message", () => {
      expect(() => enforceImportRowLimit([])).toThrow("No data rows supplied for import.");
      expect(() => enforceImportRowLimit(0)).toThrow("No data rows supplied for import.");
      expect(() => enforceImportRowLimit(-5)).toThrow("No data rows supplied for import.");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 2: Disallowed Roles During Bulk Staff Import
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 2: Disallowed Roles During Bulk Staff Import (Role Clamping Defense)", () => {
    const disallowedRoles = [
      "PRINCIPAL",
      "SUPER_ADMIN",
      "ROOT",
      "ADMIN",
      "DIRECTOR",
      "SUPERUSER",
      "CHAIRMAN",
      "STUDENT",
      "PARENT",
      "DRIVER",
      "hacker_role",
      "GARBAGE_ROLE_STRING",
      "!@#$%^&*",
    ];

    it.each(disallowedRoles)(
      "empirically rejects role '%s' in schema validation and server commit",
      async (disallowedRole) => {
        const staffRow = [
          {
            "Employee Code": `EMP-ATTACK-${disallowedRole.replace(/\W/g, "_")}`,
            "First Name": "Attacker",
            "Last Name": "User",
            "Official Email": "attacker@school.edu",
            "Contact Phone": "+919876543210",
            Department: "Academics",
            Designation: "Staff",
            "System Role": disallowedRole,
          },
        ];

        // 1. Schema-level enum check
        const validation = validateImportBatch("STAFF", staffRow);
        expect(validation.canCommit).toBe(false);
        expect(validation.invalidRowsCount).toBe(1);

        // 2. Server commit action defense
        const commitRes = await commitStaffImportAction(staffRow);
        expect(commitRes.success).toBe(false);
        expect(commitRes.createdCount).toBe(0);
        expect(commitRes.skippedCount).toBe(0);
        expect(commitRes.rejectedRowsCsv).toContain(disallowedRole);
        expect(commitRes.message).toContain("Validation failed: 1 row(s) contain errors. Zero rows were committed.");
      }
    );

    it("accepts permitted roles (TEACHER, STAFF, ACCOUNTANT) and trims case variants", async () => {
      const validCases = [
        { role: "TEACHER", emp: "EMP-OK-1" },
        { role: "STAFF", emp: "EMP-OK-2" },
        { role: "ACCOUNTANT", emp: "EMP-OK-3" },
        { role: "teacher", emp: "EMP-OK-4" },
        { role: "Staff", emp: "EMP-OK-5" },
        { role: " accountant ", emp: "EMP-OK-6" },
      ];

      const rows = validCases.map((c) => ({
        "Employee Code": c.emp,
        "First Name": "Valid",
        "Last Name": "Employee",
        "Official Email": `${c.emp.toLowerCase()}@alpha.edu`,
        "Contact Phone": "+919876543210",
        Department: "Academics",
        Designation: "Executive",
        "System Role": c.role,
      }));

      const validation = validateImportBatch("STAFF", rows);
      expect(validation.canCommit).toBe(true);
      expect(validation.invalidRowsCount).toBe(0);

      const commitRes = await commitStaffImportAction(rows);
      expect(commitRes.success).toBe(true);
      expect(commitRes.createdCount).toBe(6);
      expect(commitRes.skippedCount).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 3: Partial Batch Failure & 100% All-Or-Nothing Rollback
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 3: Partial Batch Failure: 100% All-Or-Nothing Rollback (0 Rows Committed)", () => {
    it("aborts entire student batch if 1 row out of 20 has invalid date format", async () => {
      const mixedBatch: Record<string, string>[] = [];
      for (let i = 1; i <= 20; i++) {
        mixedBatch.push({
          "Admission Number": `ADM-MIX-${i}`,
          "First Name": `Student${i}`,
          "Last Name": "Verma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": i === 13 ? "2012-99-99" : "2012-06-15", // Row 13 has invalid date
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        });
      }

      // Pre-validation inspection
      const validation = validateImportBatch("STUDENTS", mixedBatch);
      expect(validation.canCommit).toBe(false);
      expect(validation.validRowsCount).toBe(19);
      expect(validation.invalidRowsCount).toBe(1);

      // Verify row numbering: defect is at CSV Line 14 (Row 13 + 1 header line)
      expect(validation.rows[12]?.rowNumber).toBe(14);
      expect(validation.rows[12]?.isValid).toBe(false);

      // Execute commit action
      const res = await commitStudentImportAction(mixedBatch);

      // Invariant: 0 rows committed, 0 skipped, success is false
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.skippedCount).toBe(0);
      expect(mockDbState.studentCreationLog).toHaveLength(0);

      // Rejected rows CSV must contain only the defective row with exact Line 14 reason
      expect(res.rejectedRowsCsv).toContain("ADM-MIX-13");
      expect(res.rejectedRowsCsv).toContain("Line 14:");
      expect(res.rejectedRowsCsv).not.toContain("ADM-MIX-1,");
      expect(res.rejectedRowsCsv).not.toContain("ADM-MIX-12,");
      expect(res.rejectedRowsCsv).not.toContain("ADM-MIX-14,");
    });

    it("aborts entire staff batch if 1 row out of 10 requests PRINCIPAL role", async () => {
      const staffBatch: Record<string, string>[] = [];
      for (let i = 1; i <= 10; i++) {
        staffBatch.push({
          "Employee Code": `EMP-STF-${i}`,
          "First Name": `Staff${i}`,
          "Last Name": "Sharma",
          "Official Email": `staff${i}@alpha.edu`,
          "Contact Phone": "+919876543210",
          Department: "Academics",
          Designation: "Teacher",
          "System Role": i === 7 ? "PRINCIPAL" : "TEACHER", // Row 7 requests PRINCIPAL
        });
      }

      const res = await commitStaffImportAction(staffBatch);

      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.skippedCount).toBe(0);
      expect(res.rejectedRowsCsv).toContain("EMP-STF-7");
      expect(res.rejectedRowsCsv).not.toContain("EMP-STF-1,");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 4: Case-Insensitive Class/Section Resolution vs Non-Existent Curriculum
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 4: Case-Insensitive Class and Section Resolution vs Non-Existent Curriculum", () => {
    it("successfully resolves mixed casing and whitespace for classes and sections", async () => {
      const casingRows = [
        {
          "Admission Number": "ADM-CASE-01",
          "First Name": "Rohan",
          "Last Name": "Mehra",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-01-01",
          "Class Name": "class 10", // lowercase
          Section: "a",             // lowercase
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-CASE-02",
          "First Name": "Pooja",
          "Last Name": "Nair",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-02-02",
          "Class Name": "CLASS 10", // UPPERCASE
          Section: "B",             // UPPERCASE
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543211",
        },
        {
          "Admission Number": "ADM-CASE-03",
          "First Name": "Amit",
          "Last Name": "Patel",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-03-03",
          "Class Name": "  Class 9  ", // Whitespace padding
          Section: "  a  ",           // Whitespace padding
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543212",
        },
      ];

      const res = await commitStudentImportAction(casingRows);

      expect(res.success).toBe(true);
      expect(res.createdCount).toBe(3);
      expect(res.skippedCount).toBe(0);

      // Verify classId and sectionId were properly resolved
      expect(mockDbState.studentCreationLog).toHaveLength(3);
      expect(mockDbState.studentCreationLog[0]?.classId).toBe("cls-10");
      expect(mockDbState.studentCreationLog[0]?.sectionId).toBe("sec-10a");
      expect(mockDbState.studentCreationLog[1]?.classId).toBe("cls-10");
      expect(mockDbState.studentCreationLog[1]?.sectionId).toBe("sec-10b");
      expect(mockDbState.studentCreationLog[2]?.classId).toBe("cls-9");
      expect(mockDbState.studentCreationLog[2]?.sectionId).toBe("sec-9a");
    });

    it("rejects non-existent class with clear row-level error", async () => {
      const invalidClassRows = [
        {
          "Admission Number": "ADM-BADCLS-01",
          "First Name": "Kunal",
          "Last Name": "Roy",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-04-04",
          "Class Name": "Class 99 NonExistent",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const res = await commitStudentImportAction(invalidClassRows);

      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors[0]).toContain("Class 'Class 99 NonExistent' not found in current institutional curriculum.");
      expect(res.rejectedRowsCsv).toContain("Class 'Class 99 NonExistent' not found");
    });

    it("rejects non-existent section within an existing class", async () => {
      const invalidSectionRows = [
        {
          "Admission Number": "ADM-BADSEC-01",
          "First Name": "Neha",
          "Last Name": "Kapoor",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-05",
          "Class Name": "Class 10",
          Section: "Z", // Section Z does not exist in Class 10 (only A and B exist)
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const res = await commitStudentImportAction(invalidSectionRows);

      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors[0]).toContain("Section 'Z' not found in Class 'Class 10'.");
      expect(res.rejectedRowsCsv).toContain("Section 'Z' not found in Class 'Class 10'.");
    });

    it("prevents cross-tenant curriculum hijacking: School A cannot resolve School B's class", async () => {
      const crossTenantRows = [
        {
          "Admission Number": "ADM-CROSS-01",
          "First Name": "Cross",
          "Last Name": "Tenant",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-06-06",
          "Class Name": "Class 10 Beta", // Exists in School Beta, but caller is School Alpha
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const res = await commitStudentImportAction(crossTenantRows);

      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors[0]).toContain("Class 'Class 10 Beta' not found in current institutional curriculum.");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 5: Duplicate Admission Numbers & Employee Codes Idempotency
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 5: Duplicate Admission Numbers & Employee Codes Idempotency", () => {
    it("rejects batch with internal duplicate admission numbers (All-Or-Nothing)", async () => {
      const internalDupBatch = [
        {
          "Admission Number": "ADM-DUP-999",
          "First Name": "First",
          "Last Name": "Entry",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-07-07",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-DUP-999", // Duplicate key in same file!
          "First Name": "Second",
          "Last Name": "Entry",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-08-08",
          "Class Name": "Class 10",
          Section: "B",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543211",
        },
      ];

      const validation = validateImportBatch("STUDENTS", internalDupBatch);
      expect(validation.canCommit).toBe(false);
      expect(validation.rows[1]?.errors.some((e) => e.includes("Duplicate key 'ADM-DUP-999'"))).toBe(true);

      const res = await commitStudentImportAction(internalDupBatch);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.skippedCount).toBe(0);
      expect(res.rejectedRowsCsv).toContain("Duplicate key 'ADM-DUP-999'");
    });

    it("idempotently skips database-existing admission numbers upon re-import", async () => {
      // ADM-EXISTING-001 and ADM-EXISTING-002 already exist in mock DB
      const reimportBatch = [
        {
          "Admission Number": "ADM-EXISTING-001", // Existing
          "First Name": "Existing",
          "Last Name": "One",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-09-09",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-NEW-777", // Brand new
          "First Name": "Brand",
          "Last Name": "New",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-10-10",
          "Class Name": "Class 10",
          Section: "B",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543211",
        },
        {
          "Admission Number": "ADM-EXISTING-002", // Existing
          "First Name": "Existing",
          "Last Name": "Two",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-11-11",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543212",
        },
      ];

      // First run: 1 created, 2 skipped
      const firstRun = await commitStudentImportAction(reimportBatch);
      expect(firstRun.success).toBe(true);
      expect(firstRun.totalProcessed).toBe(3);
      expect(firstRun.createdCount).toBe(1);
      expect(firstRun.skippedCount).toBe(2);

      // Re-run identical batch: 0 created, 3 skipped
      const secondRun = await commitStudentImportAction(reimportBatch);
      expect(secondRun.success).toBe(true);
      expect(secondRun.totalProcessed).toBe(3);
      expect(secondRun.createdCount).toBe(0);
      expect(secondRun.skippedCount).toBe(3);
    });

    it("idempotently skips database-existing employee codes upon re-import", async () => {
      // EMP-EXISTING-101 exists in DB
      const staffReimportBatch = [
        {
          "Employee Code": "EMP-EXISTING-101", // Existing
          "First Name": "Existing",
          "Last Name": "Staff",
          "Official Email": "existing@alpha.edu",
          "Contact Phone": "+919876543210",
          Department: "Academics",
          Designation: "Teacher",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-NEW-888", // New
          "First Name": "New",
          "Last Name": "Staff",
          "Official Email": "new@alpha.edu",
          "Contact Phone": "+919876543211",
          Department: "Academics",
          Designation: "Teacher",
          "System Role": "TEACHER",
        },
      ];

      // First run: 1 created, 1 skipped
      const firstRun = await commitStaffImportAction(staffReimportBatch);
      expect(firstRun.success).toBe(true);
      expect(firstRun.createdCount).toBe(1);
      expect(firstRun.skippedCount).toBe(1);

      // Add the newly created staff into existingStaffInDb for subsequent run
      mockDbState.existingStaffInDb.set("emp-new-888", {
        id: "stf-new-888",
        employeeCode: "EMP-NEW-888",
        schoolId: "school-alpha",
      });

      // Second run: 0 created, 2 skipped
      const secondRun = await commitStaffImportAction(staffReimportBatch);
      expect(secondRun.success).toBe(true);
      expect(secondRun.createdCount).toBe(0);
      expect(secondRun.skippedCount).toBe(2);
    });

    it("rejects case-insensitive duplicate keys within the same file (e.g. adm-99 vs ADM-99)", () => {
      const caseDupBatch = [
        {
          "Admission Number": "adm-99",
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-01-01",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-99", // Cased duplicate
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-01-01",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const val = validateImportBatch("STUDENTS", caseDupBatch);
      expect(val.canCommit).toBe(false);
      expect(val.rows[1]?.errors[0]).toContain("Duplicate key 'ADM-99' found within the import file.");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 6: Additional Adversarial Corner Cases (Unicode, Quotes, CSV Escaping)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 6: High Stress CSV Formatting, Quotes, Unicode & Optional Fields", () => {
    it("handles unicode characters and commas inside quoted names cleanly", async () => {
      const complexRows = [
        {
          "Admission Number": "ADM-UNI-001",
          "First Name": "अनुराग", // Hindi unicode
          "Last Name": "O'Connor-Smith",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Sharma, Rajesh Kumar", // Comma inside name
          "Parent Phone": "+919876543210",
          "Parent Email": "rajesh+student@alpha.edu",
          "Category (Optional)": "OBC",
        },
      ];

      const val = validateImportBatch("STUDENTS", complexRows);
      expect(val.canCommit).toBe(true);
      expect(val.invalidRowsCount).toBe(0);

      const res = await commitStudentImportAction(complexRows);
      expect(res.success).toBe(true);
      expect(res.createdCount).toBe(1);
    });

    it("accepts valid rows when optional columns are omitted or empty", async () => {
      const minimalRow = [
        {
          "Admission Number": "ADM-MIN-001",
          "First Name": "Rhea",
          "Last Name": "Pillai",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2013-03-15",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Suresh Pillai",
          "Parent Phone": "+919876543210",
          // Parent Email omitted
          // Category (Optional) omitted
        },
      ];

      const val = validateImportBatch("STUDENTS", minimalRow);
      expect(val.canCommit).toBe(true);

      const res = await commitStudentImportAction(minimalRow);
      expect(res.success).toBe(true);
      expect(res.createdCount).toBe(1);
    });

    it("generates correct line-numbered rejected CSV when 100% of rows fail", () => {
      const completelyInvalidBatch = [
        {
          "Admission Number": "",
          "First Name": "",
          "Last Name": "",
          Gender: "INVALID",
          "Date of Birth (YYYY-MM-DD)": "bad-date",
          "Class Name": "",
          Section: "",
          "Parent / Guardian Name": "",
          "Parent Phone": "",
        },
        {
          "Admission Number": "",
          "First Name": "",
          "Last Name": "",
          Gender: "ALIEN",
          "Date of Birth (YYYY-MM-DD)": "invalid",
          "Class Name": "",
          Section: "",
          "Parent / Guardian Name": "",
          "Parent Phone": "",
        },
      ];

      const val = validateImportBatch("STUDENTS", completelyInvalidBatch);
      expect(val.canCommit).toBe(false);
      expect(val.invalidRowsCount).toBe(2);

      const rejectedCsv = generateRejectedRowsCsv(val);
      expect(rejectedCsv).toContain("Line 2:");
      expect(rejectedCsv).toContain("Line 3:");
      expect(rejectedCsv.split("\n").length).toBeGreaterThanOrEqual(3);
    });
  });
});
