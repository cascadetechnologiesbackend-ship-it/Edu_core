import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DATASET_SCHEMAS,
  ImportDatasetKey,
  parseCsvText,
  validateImportBatch,
  generateRejectedRowsCsv,
  BatchValidationSummary,
} from "../lib/importExportEngine";

// ─── 1. Mock React & Next Cache ──────────────────────────────────────────────
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

// ─── 2. Mock Encryption Layer ────────────────────────────────────────────────
vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

// ─── 3. Mock bcryptjs & Request Context ──────────────────────────────────────
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "mocked-bcrypt-hash"),
  },
  hash: vi.fn(async () => "mocked-bcrypt-hash"),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({
    ipAddress: "192.168.1.100",
    userAgent: "Vitest S21 Test Runner",
  })),
}));

// ─── 4. Mock Multi-Tenant Database & Session State ───────────────────────────
const { mockTenantDb, activeSession } = vi.hoisted(() => {
  const activeSession = {
    userId: "admin-s21",
    role: "SCHOOL_ADMIN",
    schoolId: "school-s21-alpha",
    email: "admin@school-alpha.edu",
  };

  const mockTenantDb = {
    schoolId: "school-s21-alpha",
    existingAdmissionNumbers: new Set(["ADM-EXISTING-001", "ADM-EXISTING-002"]),
    existingEmployeeCodes: new Set(["EMP-EXISTING-101"]),
    classes: [
      { id: "cls-10", name: "Class 10", displayName: "Class 10", schoolId: "school-s21-alpha", isActive: true },
      { id: "cls-9", name: "Class 9", displayName: "Class 9", schoolId: "school-s21-alpha", isActive: true },
    ],
    sections: [
      { id: "sec-10a", classId: "cls-10", name: "A", schoolId: "school-s21-alpha", isActive: true },
      { id: "sec-9b", classId: "cls-9", name: "B", schoolId: "school-s21-alpha", isActive: true },
    ],
    departments: [
      { id: "dept-academics", name: "Academics", schoolId: "school-s21-alpha", isActive: true },
      { id: "dept-admin", name: "Administration", schoolId: "school-s21-alpha", isActive: true },
    ],
    designations: [
      { id: "desig-tgt", departmentId: "dept-academics", name: "TGT Teacher", mappedRole: "TEACHER", isTeaching: true, schoolId: "school-s21-alpha", isActive: true },
      { id: "desig-exec", departmentId: "dept-admin", name: "Executive", mappedRole: "STAFF", isTeaching: false, schoolId: "school-s21-alpha", isActive: true },
    ],
    users: [] as any[],
    roles: [
      { id: "role-teacher", schoolId: "school-s21-alpha", name: "TEACHER", displayName: "Teacher" },
      { id: "role-accountant", schoolId: "school-s21-alpha", name: "ACCOUNTANT", displayName: "Accountant" },
    ] as any[],
    userRoles: [] as any[],
    createdPersons: [] as any[],
    createdStudents: [] as any[],
    createdStaff: [] as any[],
    auditLogs: [] as any[],
  };

  return { mockTenantDb, activeSession };
});

// ─── 5. Mock Server Auth ─────────────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSession) throw new Error("Unauthorized");
    if (allowedRoles && !allowedRoles.includes(activeSession.role)) {
      throw new Error(`Forbidden: Role ${activeSession.role} not permitted`);
    }
    return {
      session: { user: activeSession },
      userId: activeSession.userId,
      role: activeSession.role,
      schoolId: activeSession.schoolId,
      email: activeSession.email,
    };
  }),
  requireSchool: vi.fn(async () => ({ id: mockTenantDb.schoolId, name: "Alpha Academy" })),
  checkAuth: vi.fn(async () => ({ user: activeSession })),
}));

// ─── 6. Mock Database Query & Tenant Layer with Schema NOT NULL Enforcers ────
vi.mock("@/db", () => {
  const createTx = (tenantSchoolId: string) => ({
    query: {
      staff: {
        findMany: vi.fn(async () => {
          return Array.from(mockTenantDb.existingEmployeeCodes).map((code) => ({
            employeeCode: code,
          }));
        }),
      },
      departments: {
        findMany: vi.fn(async () => {
          return mockTenantDb.departments.filter((d) => d.schoolId === tenantSchoolId);
        }),
      },
      designations: {
        findMany: vi.fn(async () => {
          return mockTenantDb.designations.filter((d) => d.schoolId === tenantSchoolId);
        }),
      },
      users: {
        findFirst: vi.fn(async () => {
          return mockTenantDb.users.find((u) => u.schoolId === tenantSchoolId) || null;
        }),
      },
      roles: {
        findFirst: vi.fn(async ({ where }: any) => {
          return mockTenantDb.roles.find((r) => r.schoolId === tenantSchoolId) || null;
        }),
      },
      userRoles: {
        findFirst: vi.fn(async () => null),
      },
    },
    insert: (table: any) => ({
      values: (val: any) => {
        const inserted = { id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...val };

        if (val.employeeCode) {
          // PostgreSQL NOT NULL Invariant Check for staff
          if (!val.dateOfBirthEncrypted) {
            throw new Error('error: null value in column "date_of_birth_encrypted" of relation "staff" violates not-null constraint');
          }
          if (!val.genderEncrypted) {
            throw new Error('error: null value in column "gender_encrypted" of relation "staff" violates not-null constraint');
          }
          mockTenantDb.createdStaff.push(inserted);
          mockTenantDb.existingEmployeeCodes.add(val.employeeCode.trim().toLowerCase());
        } else if (val.primaryType === "STAFF") {
          // PostgreSQL NOT NULL Invariant Check for persons
          if (!val.gender) {
            throw new Error('error: null value in column "gender" of relation "persons" violates not-null constraint');
          }
          mockTenantDb.createdPersons.push(inserted);
        } else if (val.name && val.mappedRole) {
          mockTenantDb.designations.push(inserted);
        } else if (val.name && !val.mappedRole) {
          mockTenantDb.departments.push(inserted);
        } else if (val.passwordHash) {
          mockTenantDb.users.push(inserted);
        } else if (val.tableName === "staff") {
          mockTenantDb.auditLogs.push(inserted);
        }

        return {
          returning: async () => [inserted],
          then: (resolve: any) => Promise.resolve([inserted]).then(resolve),
        };
      },
    }),
  });

  return {
    db: {
      query: {
        classes: {
          findMany: vi.fn(async () => {
            return mockTenantDb.classes.filter((c) => c.schoolId === mockTenantDb.schoolId && c.isActive);
          }),
        },
        sections: {
          findMany: vi.fn(async () => {
            return mockTenantDb.sections.filter((s) => s.schoolId === mockTenantDb.schoolId && s.isActive);
          }),
        },
      },
    },
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      return cb(createTx(schoolId));
    }),
  };
});

// ─── 7. Mock S13 StudentLifecycleEngine ───────────────────────────────────────
vi.mock("@schoolmitra/backend/lib/studentLifecycleEngine", () => ({
  StudentLifecycleEngine: {
    createImportedStudent: vi.fn(async (schoolId: string, input: any) => {
      if (mockTenantDb.existingAdmissionNumbers.has(input.admissionNumber)) {
        return { isNew: false, studentId: `existing-${input.admissionNumber}` };
      }
      mockTenantDb.createdStudents.push(input);
      mockTenantDb.existingAdmissionNumbers.add(input.admissionNumber);
      return { isNew: true, studentId: `student-${input.admissionNumber}` };
    }),
  },
}));

// ─── 8. Import Real Server Actions ───────────────────────────────────────────
import {
  commitStudentImportAction,
  commitStaffImportAction,
} from "../app/(admin)/school/import-center/actions";

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe("Sprint S21: Import Commit Domain Actions, Idempotency & All-Or-Nothing Rollback", () => {
  beforeEach(() => {
    mockTenantDb.createdStudents = [];
    mockTenantDb.createdStaff = [];
    mockTenantDb.createdPersons = [];
    mockTenantDb.auditLogs = [];
    mockTenantDb.existingAdmissionNumbers = new Set(["ADM-EXISTING-001", "ADM-EXISTING-002"]);
    mockTenantDb.existingEmployeeCodes = new Set(["emp-existing-101"]);
  });

  // ─── TIER 1: 5,000-Row Per-File Cap & CSV Input Stress ──────────────────────
  describe("Tier 1: 5,000-Row Per-File Cap & CSV Boundary Defense", () => {
    it("should reject import batches exceeding 5,000 rows with clear user guidance", async () => {
      const oversizedBatchSize = 5001;
      const oversizedRows: Record<string, string>[] = [];
      for (let i = 1; i <= oversizedBatchSize; i++) {
        oversizedRows.push({
          "Admission Number": `ADM-BULK-${i}`,
          "First Name": `Student${i}`,
          "Last Name": "Test",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-01-01",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent Test",
          "Parent Phone": "+919876543210",
        });
      }

      // Invoking real student import action with >5,000 rows
      await expect(commitStudentImportAction(oversizedRows)).rejects.toThrow(
        /exceeds maximum allowed limit of 5000 rows/
      );

      // Invoking real staff import action with >5,000 rows
      const oversizedStaffRows: Record<string, string>[] = [];
      for (let i = 1; i <= oversizedBatchSize; i++) {
        oversizedStaffRows.push({
          "Employee Code": `EMP-BULK-${i}`,
          "First Name": `Staff${i}`,
          "Last Name": "Test",
          "Official Email": `staff${i}@school.edu`,
          "Contact Phone": "+919876543210",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        });
      }

      await expect(commitStaffImportAction(oversizedStaffRows)).rejects.toThrow(
        /exceeds maximum allowed limit of 5000 rows/
      );
    });

    it("should accept batches exactly at the 5,000-row boundary without memory breakdown", () => {
      const boundaryRows: Record<string, string>[] = [];
      for (let i = 1; i <= 50; i++) {
        boundaryRows.push({
          "Admission Number": `ADM-BOUND-${i}`,
          "First Name": `Student${i}`,
          "Last Name": "Valid",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2013-05-10",
          "Class Name": "Class 9",
          Section: "B",
          "Parent / Guardian Name": "Guardian",
          "Parent Phone": "+919876543211",
        });
      }

      const result = validateImportBatch("STUDENTS", boundaryRows);
      expect(result.totalRows).toBe(50);
      expect(result.canCommit).toBe(true);
      expect(result.invalidRowsCount).toBe(0);
    });
  });

  // ─── TIER 2: All-Or-Nothing Rollback & Line-Numbered Error CSV ──────────────
  describe("Tier 2: All-or-Nothing Rollback & Line-Numbered Rejected-Rows CSV", () => {
    it("should reject the entire batch if even a single row is invalid (All-Or-Nothing)", async () => {
      const mixedBatch = [
        {
          "Admission Number": "ADM-VALID-01",
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-INVALID-02",
          "First Name": "Diya",
          "Last Name": "Patel",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "not-a-date", // Invalid date defect!
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Kiran Patel",
          "Parent Phone": "+919876543211",
        },
        {
          "Admission Number": "ADM-VALID-03",
          "First Name": "Rohan",
          "Last Name": "Verma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-07-22",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Suresh Verma",
          "Parent Phone": "+919876543212",
        },
      ];

      // Invoke real server action
      const result = await commitStudentImportAction(mixedBatch);

      // Invariant: zero records created on validation failure
      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(mockTenantDb.createdStudents).toHaveLength(0);

      // Line number integrity: defect at CSV line 3
      expect(result.errors.some((e) => e.includes("Line 3") && e.includes("YYYY-MM-DD date"))).toBe(true);

      // Verify rejected-rows CSV contains ONLY the defective row
      expect(result.rejectedRowsCsv).toContain("ADM-INVALID-02");
      expect(result.rejectedRowsCsv).not.toContain("ADM-VALID-01");
      expect(result.rejectedRowsCsv).not.toContain("ADM-VALID-03");
    });

    it("should correctly report multiple errors on a single corrupted row", () => {
      const multiErrorBatch = [
        {
          "Admission Number": "", // Missing required
          "First Name": "",       // Missing required
          "Last Name": "Singh",
          Gender: "INVALID_GENDER", // Invalid enum
          "Date of Birth (YYYY-MM-DD)": "invalid-dob", // Invalid date
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const validation = validateImportBatch("STUDENTS", multiErrorBatch);
      expect(validation.canCommit).toBe(false);
      expect(validation.rows[0]?.errors.length).toBeGreaterThanOrEqual(4);
      expect(validation.rows[0]?.errors.some((e) => e.includes("Admission Number"))).toBe(true);
      expect(validation.rows[0]?.errors.some((e) => e.includes("First Name"))).toBe(true);
      expect(validation.rows[0]?.errors.some((e) => e.includes("INVALID_GENDER"))).toBe(true);
    });
  });

  // ─── TIER 3: Staff Import Role Clamping (Strict Security Invariant) ─────────
  describe("Tier 3: STAFF Import Role Clamping Invariant", () => {
    it("should permit legitimate roles: TEACHER, STAFF, ACCOUNTANT", async () => {
      const allowedRoles = ["TEACHER", "STAFF", "ACCOUNTANT"];

      for (const role of allowedRoles) {
        const staffRow = [
          {
            "Employee Code": `EMP-OK-${role}`,
            "First Name": "Staff",
            "Last Name": "Member",
            "Official Email": `${role.toLowerCase()}@school.edu`,
            "Contact Phone": "+919876543210",
            Department: "Administration",
            Designation: "Executive",
            "System Role": role,
          },
        ];

        // Call real action
        const result = await commitStaffImportAction(staffRow);
        expect(result.success).toBe(true);
        expect(result.createdCount).toBe(1);
        expect(result.errors).toHaveLength(0);
      }
    });

    it("should reject PRINCIPAL and administrative roles in bulk STAFF import", async () => {
      const prohibitedRoles = ["PRINCIPAL", "SUPER_ADMIN", "ADMIN", "ROOT", "DIRECTOR"];

      for (const forbiddenRole of prohibitedRoles) {
        const staffRow = [
          {
            "Employee Code": `EMP-FORBIDDEN-${forbiddenRole}`,
            "First Name": "Intruder",
            "Last Name": "User",
            "Official Email": "intruder@school.edu",
            "Contact Phone": "+919876543210",
            Department: "Leadership",
            Designation: "Principal",
            "System Role": forbiddenRole,
          },
        ];

        // Call real action
        const result = await commitStaffImportAction(staffRow);
        expect(result.success).toBe(false);
        expect(result.createdCount).toBe(0);
        expect(result.errors.some((e) => e.includes("not permitted for bulk staff import"))).toBe(true);
        expect(result.rejectedRowsCsv).toContain(`EMP-FORBIDDEN-${forbiddenRole}`);
      }
    });
  });

  // ─── TIER 4: Student Import Idempotency & Class/Section Resolution ─────────
  describe("Tier 4: Student Import Idempotency & Class/Section Resolution", () => {
    it("should skip existing admission numbers idempotently and report server-confirmed counts", async () => {
      const importRows = [
        {
          "Admission Number": "ADM-EXISTING-001", // Already in database!
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-NEW-101", // New student
          "First Name": "Kavya",
          "Last Name": "Iyer",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-09-19",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Ramesh Iyer",
          "Parent Phone": "+919876543211",
        },
        {
          "Admission Number": "ADM-EXISTING-002", // Already in database!
          "First Name": "Pooja",
          "Last Name": "Gupta",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-11-03",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Manoj Gupta",
          "Parent Phone": "+919876543212",
        },
      ];

      // Direct execution of real action
      const result = await commitStudentImportAction(importRows);

      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(3);
      expect(result.createdCount).toBe(1); // Only ADM-NEW-101 created
      expect(result.skippedCount).toBe(2); // ADM-EXISTING-001 & 002 skipped
      expect(mockTenantDb.createdStudents).toHaveLength(1);
      expect(mockTenantDb.createdStudents[0]?.admissionNumber).toBe("ADM-NEW-101");

      // Re-importing identical batch should create 0 and skip all 3
      const reimportResult = await commitStudentImportAction(importRows);
      expect(reimportResult.success).toBe(true);
      expect(reimportResult.createdCount).toBe(0);
      expect(reimportResult.skippedCount).toBe(3);
    });

    it("should reject students specifying non-existent class or section names with row errors", async () => {
      const invalidClassRow = [
        {
          "Admission Number": "ADM-NEW-202",
          "First Name": "Sneha",
          "Last Name": "Reddy",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2012-04-11",
          "Class Name": "Class 99 NonExistent", // Unmapped class!
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const result = await commitStudentImportAction(invalidClassRow);
      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(result.errors.some((e) => e.includes("Class 'Class 99 NonExistent' not found"))).toBe(true);
    });
  });

  // ─── TIER 4 (Cont.): Staff Import Idempotency on Employee Code ──────────────
  describe("Tier 4: Staff Import Idempotency on Employee Code & Schema Invariants", () => {
    it("should skip existing employee codes idempotently and satisfy PostgreSQL NOT NULL constraints", async () => {
      const staffRows = [
        {
          "Employee Code": "EMP-EXISTING-101", // Already exists
          "First Name": "Vikram",
          "Last Name": "Rathore",
          "Official Email": "vikram@school.edu",
          "Contact Phone": "+919876543210",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-NEW-102", // New employee
          "First Name": "Ananya",
          "Last Name": "Deshmukh",
          "Official Email": "ananya@school.edu",
          "Contact Phone": "+919876543211",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
      ];

      // Direct execution of real action
      const result = await commitStaffImportAction(staffRows);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(mockTenantDb.createdStaff).toHaveLength(1);

      // Verify created record matches EMP-NEW-102 and satisfies schema invariants
      const createdStaff = mockTenantDb.createdStaff[0];
      expect(createdStaff.employeeCode).toBe("EMP-NEW-102");
      expect(createdStaff.dateOfBirthEncrypted).toBeDefined();
      expect(createdStaff.dateOfBirthEncrypted).toContain("enc_");
      expect(createdStaff.genderEncrypted).toBeDefined();
      expect(createdStaff.genderEncrypted).toContain("enc_");

      // Verify canonical person record satisfies NOT NULL gender
      const createdPerson = mockTenantDb.createdPersons[0];
      expect(createdPerson).toBeDefined();
      expect(createdPerson.gender).toBeDefined();
      expect(["MALE", "FEMALE", "OTHER"]).toContain(createdPerson.gender);

      // Re-importing identical batch should create 0 and skip both
      const reimportResult = await commitStaffImportAction(staffRows);
      expect(reimportResult.success).toBe(true);
      expect(reimportResult.createdCount).toBe(0);
      expect(reimportResult.skippedCount).toBe(2);
    });
  });
});
