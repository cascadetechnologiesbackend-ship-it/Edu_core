import { describe, it, expect, vi, beforeEach } from "vitest";

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
    userAgent: "Vitest Adversarial Challenger",
  })),
}));

// ─── 4. Mock Multi-Tenant Database State & Schema Enum Enforcers ──────────────
const { mockTenantDb, activeSession, dbCallSpies } = vi.hoisted(() => {
  const activeSession = {
    userId: "admin-s21-challenger",
    role: "SCHOOL_ADMIN",
    schoolId: "school-adversarial-1",
    email: "admin@school-adv.edu",
  };

  const dbCallSpies = {
    roleInsertAttempts: [] as any[],
    userRoleInsertAttempts: [] as any[],
  };

  const mockTenantDb = {
    schoolId: "school-adversarial-1",
    existingAdmissionNumbers: new Set<string>(),
    existingEmployeeCodes: new Set<string>(),
    classes: [
      { id: "cls-10", name: "Class 10", displayName: "Class 10", schoolId: "school-adversarial-1", isActive: true },
      { id: "cls-9", name: "Class 9", displayName: "Class 9", schoolId: "school-adversarial-1", isActive: true },
    ],
    sections: [
      { id: "sec-10a", classId: "cls-10", name: "A", schoolId: "school-adversarial-1", isActive: true },
      { id: "sec-9b", classId: "cls-9", name: "B", schoolId: "school-adversarial-1", isActive: true },
    ],
    departments: [
      { id: "dept-academics", name: "Academics", schoolId: "school-adversarial-1", isActive: true },
    ],
    designations: [
      { id: "desig-tgt", departmentId: "dept-academics", name: "TGT Teacher", mappedRole: "TEACHER", isTeaching: true, schoolId: "school-adversarial-1", isActive: true },
      { id: "desig-exec", departmentId: "dept-academics", name: "Executive", mappedRole: "STAFF", isTeaching: false, schoolId: "school-adversarial-1", isActive: true },
      { id: "desig-acc", departmentId: "dept-academics", name: "Accountant", mappedRole: "ACCOUNTANT", isTeaching: false, schoolId: "school-adversarial-1", isActive: true },
    ],
    users: [] as any[],
    roles: [
      { id: "role-teacher-id", schoolId: "school-adversarial-1", name: "TEACHER", displayName: "Teacher" },
      { id: "role-accountant-id", schoolId: "school-adversarial-1", name: "ACCOUNTANT", displayName: "Accountant" },
    ] as any[],
    userRoles: [] as any[],
    createdPersons: [] as any[],
    createdStudents: [] as any[],
    createdStaff: [] as any[],
    auditLogs: [] as any[],
  };

  return { mockTenantDb, activeSession, dbCallSpies };
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
  requireSchool: vi.fn(async () => ({ id: mockTenantDb.schoolId, name: "Adversarial Academy" })),
  checkAuth: vi.fn(async () => ({ user: activeSession })),
}));

// Valid role_name enum in PostgreSQL (database/src/schema/core.ts:30-42)
const VALID_ROLE_NAME_ENUMS = new Set([
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "HR_MANAGER",
  "TEACHER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "PARENT",
  "STUDENT",
  "DRIVER",
]);

// ─── 6. Mock Database Layer with Strict Schema Constraint Interceptors ───────
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
        findFirst: vi.fn(async ({ where }: any) => {
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

        // STAFF TABLE STRICT CONSTRAINT INTERCEPTOR
        if (val.employeeCode) {
          if (!val.dateOfBirthEncrypted) {
            throw new Error('error: null value in column "date_of_birth_encrypted" of relation "staff" violates not-null constraint');
          }
          if (!val.genderEncrypted) {
            throw new Error('error: null value in column "gender_encrypted" of relation "staff" violates not-null constraint');
          }
          mockTenantDb.createdStaff.push(inserted);
          mockTenantDb.existingEmployeeCodes.add(val.employeeCode.trim().toLowerCase());
        }
        // PERSONS TABLE STRICT CONSTRAINT INTERCEPTOR
        else if (val.primaryType === "STAFF") {
          if (!val.gender) {
            throw new Error('error: null value in column "gender" of relation "persons" violates not-null constraint');
          }
          mockTenantDb.createdPersons.push(inserted);
        }
        // ROLES TABLE STRICT ENUM INTERCEPTOR
        else if (val.displayName && (val.isSystemRole !== undefined || val.description?.includes("System role"))) {
          dbCallSpies.roleInsertAttempts.push(val);
          if (!VALID_ROLE_NAME_ENUMS.has(val.name)) {
            throw new Error(`error: invalid input value for enum role_name: "${val.name}"`);
          }
          mockTenantDb.roles.push(inserted);
        }
        // USER_ROLES TABLE INTERCEPTOR
        else if (val.userId && val.roleId && !val.employeeCode) {
          dbCallSpies.userRoleInsertAttempts.push(val);
          mockTenantDb.userRoles.push(inserted);
        }
        else if (val.name && val.mappedRole) {
          mockTenantDb.designations.push(inserted);
        }
        else if (val.name && !val.mappedRole) {
          mockTenantDb.departments.push(inserted);
        }
        else if (val.passwordHash) {
          mockTenantDb.users.push(inserted);
        }
        else if (val.tableName === "staff") {
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
      // Transaction snapshot to test transactional integrity
      const staffSnapshot = [...mockTenantDb.createdStaff];
      const personsSnapshot = [...mockTenantDb.createdPersons];
      const usersSnapshot = [...mockTenantDb.users];
      const rolesSnapshot = [...mockTenantDb.roles];
      const userRolesSnapshot = [...mockTenantDb.userRoles];
      const auditSnapshot = [...mockTenantDb.auditLogs];

      try {
        return await cb(createTx(schoolId));
      } catch (err) {
        // Rollback all in-memory changes on transaction failure
        mockTenantDb.createdStaff = staffSnapshot;
        mockTenantDb.createdPersons = personsSnapshot;
        mockTenantDb.users = usersSnapshot;
        mockTenantDb.roles = rolesSnapshot;
        mockTenantDb.userRoles = userRolesSnapshot;
        mockTenantDb.auditLogs = auditSnapshot;
        throw err;
      }
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

// ─── 8. Import Server Actions ────────────────────────────────────────────────
import {
  commitStaffImportAction,
  commitStudentImportAction,
} from "../app/(admin)/school/import-center/actions";

// ─── ADVERSARIAL CHALLENGER TEST SUITE ───────────────────────────────────────
describe("Adversarial Recheck: Boundary & Schema Constraints", () => {
  beforeEach(() => {
    mockTenantDb.createdStudents = [];
    mockTenantDb.createdStaff = [];
    mockTenantDb.createdPersons = [];
    mockTenantDb.users = [];
    mockTenantDb.userRoles = [];
    mockTenantDb.auditLogs = [];
    mockTenantDb.existingAdmissionNumbers.clear();
    mockTenantDb.existingEmployeeCodes.clear();
    dbCallSpies.roleInsertAttempts = [];
    dbCallSpies.userRoleInsertAttempts = [];
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL TASK 1: STAFF IMPORT WITH & WITHOUT DOB / GENDER
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 1: Staff Import With and Without DOB / Gender in CSV Rows", () => {
    it("should correctly populate dateOfBirthEncrypted, genderEncrypted, and persons.gender when DOB/gender are omitted", async () => {
      // Row with completely omitted DOB and Gender
      const rowsWithoutDobGender = [
        {
          "Employee Code": "EMP-NO-DOB-GENDER",
          "First Name": "Ramesh",
          "Last Name": "Kumar",
          "Official Email": "ramesh.kumar@school.edu",
          "Contact Phone": "+919876500001",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
      ];

      const result = await commitStaffImportAction(rowsWithoutDobGender);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);
      expect(mockTenantDb.createdStaff).toHaveLength(1);
      expect(mockTenantDb.createdPersons).toHaveLength(1);

      const staffRecord = mockTenantDb.createdStaff[0];
      const personRecord = mockTenantDb.createdPersons[0];

      // Invariants: Default values correctly populate staff.dateOfBirthEncrypted & staff.genderEncrypted
      expect(staffRecord.dateOfBirthEncrypted).toBe("enc_1990-01-01");
      expect(staffRecord.genderEncrypted).toBe("enc_OTHER");

      // Invariant: Default value correctly populates persons.gender
      expect(personRecord.gender).toBe("OTHER");
      expect(personRecord.dateOfBirth).toEqual(new Date("1990-01-01"));
    });

    it("should correctly populate dateOfBirthEncrypted, genderEncrypted, and persons.gender when explicit DOB/gender are supplied", async () => {
      // Row with explicit DOB and Gender
      const rowsWithExplicitDobGender = [
        {
          "Employee Code": "EMP-WITH-DOB-GENDER",
          "First Name": "Sunita",
          "Last Name": "Sharma",
          "Official Email": "sunita.sharma@school.edu",
          "Contact Phone": "+919876500002",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "1988-11-20",
        },
      ];

      const result = await commitStaffImportAction(rowsWithExplicitDobGender);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);
      expect(mockTenantDb.createdStaff).toHaveLength(1);
      expect(mockTenantDb.createdPersons).toHaveLength(1);

      const staffRecord = mockTenantDb.createdStaff[0];
      const personRecord = mockTenantDb.createdPersons[0];

      // Invariants: Explicit values correctly populate encrypted columns
      expect(staffRecord.dateOfBirthEncrypted).toBe("enc_1988-11-20");
      expect(staffRecord.genderEncrypted).toBe("enc_FEMALE");

      // Invariant: Explicit values correctly populate persons table
      expect(personRecord.gender).toBe("FEMALE");
      expect(personRecord.dateOfBirth).toEqual(new Date("1988-11-20"));
    });

    it("should handle lowercase gender and alternative DOB column headers gracefully with safe fallbacks", async () => {
      const rowsWithAlternativeFormats = [
        {
          "Employee Code": "EMP-LOWERCASE-GENDER",
          "First Name": "Arun",
          "Last Name": "Patel",
          "Official Email": "arun.patel@school.edu",
          "Contact Phone": "+919876500003",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
          gender: "male", // lowercase header and value
          dob: "1992-04-15", // shorthand header
        },
      ];

      const result = await commitStaffImportAction(rowsWithAlternativeFormats);

      expect(result.success).toBe(true);
      expect(mockTenantDb.createdStaff).toHaveLength(1);
      const staffRecord = mockTenantDb.createdStaff[0];
      const personRecord = mockTenantDb.createdPersons[0];

      expect(staffRecord.genderEncrypted).toBe("enc_MALE");
      expect(staffRecord.dateOfBirthEncrypted).toBe("enc_1992-04-15");
      expect(personRecord.gender).toBe("MALE");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL TASK 2: SYSTEM ROLES TEACHER, ACCOUNTANT, AND STAFF
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 2: Staff Import with System Roles TEACHER, ACCOUNTANT, and STAFF", () => {
    it("should assign roles for TEACHER and ACCOUNTANT, but NEVER insert STAFF into roles table", async () => {
      const mixedRoleBatch = [
        {
          "Employee Code": "EMP-ROLE-TEACHER",
          "First Name": "Deepa",
          "Last Name": "Nair",
          "Official Email": "deepa.nair@school.edu",
          "Contact Phone": "+919876500010",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-ROLE-ACCOUNTANT",
          "First Name": "Vikram",
          "Last Name": "Mehta",
          "Official Email": "vikram.mehta@school.edu",
          "Contact Phone": "+919876500011",
          Department: "Accounts",
          Designation: "Accountant",
          "System Role": "ACCOUNTANT",
        },
        {
          "Employee Code": "EMP-ROLE-STAFF",
          "First Name": "Mohan",
          "Last Name": "Lal",
          "Official Email": "mohan.lal@school.edu",
          "Contact Phone": "+919876500012",
          Department: "Administration",
          Designation: "Executive",
          "System Role": "STAFF",
        },
      ];

      const result = await commitStaffImportAction(mixedRoleBatch);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(3);
      expect(mockTenantDb.createdStaff).toHaveLength(3);

      // Verify that NO attempt was ever made to insert 'STAFF' into roles table
      const staffRoleInsertAttempts = dbCallSpies.roleInsertAttempts.filter((r) => r.name === "STAFF");
      expect(staffRoleInsertAttempts).toHaveLength(0);

      // Verify userRoles: TEACHER and ACCOUNTANT get userRoles, while STAFF does NOT
      expect(dbCallSpies.userRoleInsertAttempts).toHaveLength(2); // exactly 2: TEACHER and ACCOUNTANT

      // Verify STAFF employee record is still properly created in staff and persons
      const staffRecord = mockTenantDb.createdStaff.find((s) => s.employeeCode === "EMP-ROLE-STAFF");
      expect(staffRecord).toBeDefined();

      const staffPerson = mockTenantDb.createdPersons.find((p) => p.userId === staffRecord.userId);
      expect(staffPerson).toBeDefined();
      expect(staffPerson.primaryType).toBe("STAFF");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL TASK 3: ALL-OR-NOTHING ROLLBACK (0 ROWS ON ANY INVALID ROW)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Task 3: All-or-Nothing Rollback (0 Rows Committed on Any Invalid Row)", () => {
    it("should commit 0 rows in Staff Import if any row fails validation", async () => {
      const batchWithDefectiveRow = [
        {
          "Employee Code": "EMP-GOOD-1",
          "First Name": "Good",
          "Last Name": "One",
          "Official Email": "good1@school.edu",
          "Contact Phone": "+919876500021",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-BAD-2",
          "First Name": "", // Missing required!
          "Last Name": "Two",
          "Official Email": "bad2@school.edu",
          "Contact Phone": "+919876500022",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "INVALID_ROLE", // Invalid enum!
        },
        {
          "Employee Code": "EMP-GOOD-3",
          "First Name": "Good",
          "Last Name": "Three",
          "Official Email": "good3@school.edu",
          "Contact Phone": "+919876500023",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
      ];

      const result = await commitStaffImportAction(batchWithDefectiveRow);

      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(result.skippedCount).toBe(0);

      // Verify that database state remains completely pristine (0 committed rows)
      expect(mockTenantDb.createdStaff).toHaveLength(0);
      expect(mockTenantDb.createdPersons).toHaveLength(0);
      expect(mockTenantDb.users).toHaveLength(0);

      // Verify line-numbered error
      expect(result.errors.some((e) => e.includes("Line 3") && e.includes("Missing required field 'First Name'"))).toBe(true);

      // Verify rejected-rows CSV contains ONLY the defective row
      expect(result.rejectedRowsCsv).toContain("EMP-BAD-2");
      expect(result.rejectedRowsCsv).not.toContain("EMP-GOOD-1");
      expect(result.rejectedRowsCsv).not.toContain("EMP-GOOD-3");
    });

    it("should commit 0 rows in Student Import if any row fails format or class validation", async () => {
      const batchWithInvalidClass = [
        {
          "Admission Number": "ADM-ADV-01",
          "First Name": "Aditi",
          "Last Name": "Joshi",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2013-02-10",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent One",
          "Parent Phone": "+919876500031",
        },
        {
          "Admission Number": "ADM-ADV-02",
          "First Name": "Bhavin",
          "Last Name": "Shah",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2013-05-18",
          "Class Name": "Class 99 NonExistent", // Invalid class!
          Section: "A",
          "Parent / Guardian Name": "Parent Two",
          "Parent Phone": "+919876500032",
        },
        {
          "Admission Number": "ADM-ADV-03",
          "First Name": "Chirag",
          "Last Name": "Dave",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2013-08-22",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent Three",
          "Parent Phone": "+919876500033",
        },
      ];

      const result = await commitStudentImportAction(batchWithInvalidClass);

      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(result.skippedCount).toBe(0);

      // Invariant: 0 rows committed to students or persons
      expect(mockTenantDb.createdStudents).toHaveLength(0);
      expect(mockTenantDb.createdPersons).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("Class 'Class 99 NonExistent' not found"))).toBe(true);
    });

    it("should abort immediately and commit 0 rows if a row has a prohibited role (e.g. PRINCIPAL)", async () => {
      const batchWithProhibitedRole = [
        {
          "Employee Code": "EMP-HACK-01",
          "First Name": "Sneaky",
          "Last Name": "Admin",
          "Official Email": "sneaky@school.edu",
          "Contact Phone": "+919876500041",
          Department: "Leadership",
          Designation: "Principal",
          "System Role": "PRINCIPAL",
        },
      ];

      const result = await commitStaffImportAction(batchWithProhibitedRole);

      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(mockTenantDb.createdStaff).toHaveLength(0);
      expect(mockTenantDb.createdPersons).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("not permitted for bulk staff import"))).toBe(true);
    });

    it("should abort immediately and commit 0 rows if duplicate employee codes appear within the same batch", async () => {
      const batchWithDuplicates = [
        {
          "Employee Code": "EMP-DUP-01",
          "First Name": "First",
          "Last Name": "One",
          "Official Email": "first@school.edu",
          "Contact Phone": "+919876500051",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-DUP-01", // Duplicate code!
          "First Name": "Second",
          "Last Name": "Two",
          "Official Email": "second@school.edu",
          "Contact Phone": "+919876500052",
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        },
      ];

      const result = await commitStaffImportAction(batchWithDuplicates);

      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(mockTenantDb.createdStaff).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("Duplicate key 'EMP-DUP-01' found"))).toBe(true);
    });

    it("should correctly handle bulk distribution of 35 staff (20 STAFF, 10 TEACHER, 5 ACCOUNTANT) with zero STAFF role leakage", async () => {
      const bulkRows: Record<string, string>[] = [];
      for (let i = 1; i <= 20; i++) {
        bulkRows.push({
          "Employee Code": `EMP-BULK-STAFF-${i}`,
          "First Name": `Staff${i}`,
          "Last Name": "Member",
          "Official Email": `bulkstaff${i}@school.edu`,
          "Contact Phone": `+9198765${String(i).padStart(5, "0")}`,
          Department: "Administration",
          Designation: "Executive",
          "System Role": "STAFF",
        });
      }
      for (let i = 1; i <= 10; i++) {
        bulkRows.push({
          "Employee Code": `EMP-BULK-TEACHER-${i}`,
          "First Name": `Teacher${i}`,
          "Last Name": "Member",
          "Official Email": `bulkteacher${i}@school.edu`,
          "Contact Phone": `+9198766${String(i).padStart(5, "0")}`,
          Department: "Academics",
          Designation: "TGT Teacher",
          "System Role": "TEACHER",
        });
      }
      for (let i = 1; i <= 5; i++) {
        bulkRows.push({
          "Employee Code": `EMP-BULK-ACC-${i}`,
          "First Name": `Accountant${i}`,
          "Last Name": "Member",
          "Official Email": `bulkacc${i}@school.edu`,
          "Contact Phone": `+9198767${String(i).padStart(5, "0")}`,
          Department: "Accounts",
          Designation: "Accountant",
          "System Role": "ACCOUNTANT",
        });
      }

      const result = await commitStaffImportAction(bulkRows);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(35);
      expect(mockTenantDb.createdStaff).toHaveLength(35);
      expect(mockTenantDb.createdPersons).toHaveLength(35);

      // Verify zero insertions of 'STAFF' into roles
      const staffRoleAttempts = dbCallSpies.roleInsertAttempts.filter((r) => r.name === "STAFF");
      expect(staffRoleAttempts).toHaveLength(0);

      // Exactly 15 userRoles created (10 teachers + 5 accountants)
      expect(dbCallSpies.userRoleInsertAttempts).toHaveLength(15);
    });
  });
});
