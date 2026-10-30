import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock React Cache & Next Cache ───────────────────────────────────────────
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

// ─── Mock Multi-Tenant Database & Session State ──────────────────────────────
const { activeSessionRef, multiTenantDb, recordedWrites } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "admin-school-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    } as any,
  };

  const recordedWrites = {
    studentCreations: [] as any[],
    staffCreations: [] as any[],
    departmentCreations: [] as any[],
    designationCreations: [] as any[],
    userCreations: [] as any[],
    personCreations: [] as any[],
    roleCreations: [] as any[],
    userRoleCreations: [] as any[],
    auditLogs: [] as any[],
  };

  const multiTenantDb = {
    schools: [
      { id: "school-A", name: "School Alpha" },
      { id: "school-B", name: "School Beta (Victim / Target)" },
    ],
    classes: [
      { id: "cls-A-1", schoolId: "school-A", name: "Class 10", displayName: "Class 10", isActive: true },
      { id: "cls-A-2", schoolId: "school-A", name: "Class 9", displayName: "Class 9", isActive: true },
      { id: "cls-B-1", schoolId: "school-B", name: "Class 10 - Beta", displayName: "Class 10 - Beta", isActive: true },
    ],
    sections: [
      { id: "sec-A-1", schoolId: "school-A", classId: "cls-A-1", name: "A", isActive: true },
      { id: "sec-A-2", schoolId: "school-A", classId: "cls-A-2", name: "B", isActive: true },
      { id: "sec-B-1", schoolId: "school-B", classId: "cls-B-1", name: "Alpha", isActive: true },
    ],
    students: [
      { id: "stu-A-1", schoolId: "school-A", admissionNumber: "ADM-SHARED-001" },
      { id: "stu-B-1", schoolId: "school-B", admissionNumber: "ADM-SHARED-002" },
    ],
    staff: [
      { id: "stf-A-1", schoolId: "school-A", employeeCode: "EMP-SHARED-101", role: "TEACHER" },
      { id: "stf-B-1", schoolId: "school-B", employeeCode: "EMP-SHARED-102", role: "TEACHER" },
    ],
    departments: [
      { id: "dept-A-1", schoolId: "school-A", name: "Academics", isActive: true },
    ],
    designations: [
      { id: "desig-A-1", schoolId: "school-A", departmentId: "dept-A-1", name: "Teacher", mappedRole: "TEACHER", isTeaching: true, isActive: true },
    ],
    users: [
      { id: "usr-A-1", schoolId: "school-A", email: "existing.teacher@school-a.edu", isActive: true },
    ],
    roles: [
      { id: "role-A-teacher", schoolId: "school-A", name: "TEACHER" },
    ],
    userRoles: [] as any[],
  };

  return { activeSessionRef, multiTenantDb, recordedWrites };
});

// ─── Mock Server Auth & Context ──────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    const role = activeSessionRef.current.role;
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new Error(`Forbidden: Role '${role}' is not authorized.`);
    }
    return {
      session: { user: activeSessionRef.current },
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
      email: activeSessionRef.current.email,
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    const school = multiTenantDb.schools.find((s) => s.id === ctx.schoolId);
    if (!school) throw new Error("School not found");
    return school;
  }),
  checkAuth: vi.fn(async () => ({ user: activeSessionRef.current })),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({
    ipAddress: "198.51.100.42",
    userAgent: "Adversarial Stress Test Agent",
  })),
}));

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

// ─── Mock Database Query & Tenant Layer ──────────────────────────────────────
vi.mock("@/db", () => {
  const createTx = (tenantSchoolId: string) => ({
    query: {
      classes: {
        findMany: vi.fn(async () => {
          return multiTenantDb.classes.filter((c) => c.schoolId === tenantSchoolId && c.isActive);
        }),
      },
      sections: {
        findMany: vi.fn(async () => {
          return multiTenantDb.sections.filter((s) => s.schoolId === tenantSchoolId && s.isActive);
        }),
      },
      staff: {
        findMany: vi.fn(async () => {
          return multiTenantDb.staff.filter((s) => s.schoolId === tenantSchoolId);
        }),
      },
      departments: {
        findMany: vi.fn(async () => {
          return multiTenantDb.departments.filter((d) => d.schoolId === tenantSchoolId);
        }),
      },
      designations: {
        findMany: vi.fn(async () => {
          return multiTenantDb.designations.filter((d) => d.schoolId === tenantSchoolId);
        }),
      },
      users: {
        findFirst: vi.fn(async ({ where }: any) => {
          return multiTenantDb.users.find((u) => u.schoolId === tenantSchoolId) || null;
        }),
      },
      roles: {
        findFirst: vi.fn(async ({ where }: any) => {
          return multiTenantDb.roles.find((r) => r.schoolId === tenantSchoolId) || null;
        }),
      },
      userRoles: {
        findFirst: vi.fn(async () => null),
      },
    },
    insert: (table: any) => ({
      values: (val: any) => {
        const inserted = { id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...val };
        if (val.employeeCode) recordedWrites.staffCreations.push(inserted);
        else if (val.name && val.mappedRole) recordedWrites.designationCreations.push(inserted);
        else if (val.name && !val.mappedRole) recordedWrites.departmentCreations.push(inserted);
        else if (val.passwordHash) recordedWrites.userCreations.push(inserted);
        else if (val.primaryType === "STAFF") recordedWrites.personCreations.push(inserted);
        else if (val.tableName === "staff") recordedWrites.auditLogs.push(inserted);
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
          findMany: vi.fn(async ({ where }: any) => {
            const sid = activeSessionRef.current.schoolId;
            return multiTenantDb.classes.filter((c) => c.schoolId === sid && c.isActive);
          }),
        },
        sections: {
          findMany: vi.fn(async ({ where }: any) => {
            const sid = activeSessionRef.current.schoolId;
            return multiTenantDb.sections.filter((s) => s.schoolId === sid && s.isActive);
          }),
        },
        students: {
          findFirst: vi.fn(async () => null),
        },
      },
    },
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      if (activeSessionRef.current && activeSessionRef.current.schoolId !== schoolId) {
        throw new Error(`Tenant Mismatch: Session school '${activeSessionRef.current.schoolId}' cannot access '${schoolId}'`);
      }
      return cb(createTx(schoolId));
    }),
  };
});

// ─── Mock S13 StudentLifecycleEngine ──────────────────────────────────────────
vi.mock("@schoolmitra/backend/lib/studentLifecycleEngine", () => ({
  StudentLifecycleEngine: {
    createImportedStudent: vi.fn(async (schoolId: string, input: any, tx: any) => {
      // Check if student already exists in this school
      const exists = multiTenantDb.students.some(
        (s) => s.schoolId === schoolId && s.admissionNumber === input.admissionNumber
      );
      if (exists) {
        return {
          success: true,
          studentId: "existing-student-id",
          admissionNumber: input.admissionNumber,
          isNew: false,
        };
      }
      const record = {
        id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        schoolId,
        ...input,
      };
      recordedWrites.studentCreations.push(record);
      multiTenantDb.students.push({
        id: record.id,
        schoolId,
        admissionNumber: input.admissionNumber,
      });
      return {
        success: true,
        studentId: record.id,
        admissionNumber: input.admissionNumber,
        isNew: true,
      };
    }),
  },
}));

// ─── Import the Real Actions Under Test ───────────────────────────────────────
import {
  commitStudentImportAction,
  commitStaffImportAction,
} from "../app/(admin)/school/import-center/actions";
import { StudentLifecycleEngine } from "@schoolmitra/backend/lib/studentLifecycleEngine";

describe("Adversarial Empirical Stress: Tenant Scope Isolation & Security Injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordedWrites.studentCreations = [];
    recordedWrites.staffCreations = [];
    recordedWrites.departmentCreations = [];
    recordedWrites.designationCreations = [];
    recordedWrites.userCreations = [];
    recordedWrites.personCreations = [];
    recordedWrites.roleCreations = [];
    recordedWrites.auditLogs = [];

    // Default authenticated session: School A admin
    activeSessionRef.current = {
      userId: "admin-school-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };
  });

  // ─── ATTACK 1: Client-Supplied schoolId Injection in Student Payload ───────
  it("ATTACK 1: Ignores client-supplied schoolId in student CSV row and binds strictly to session school", async () => {
    const maliciousPayload = [
      {
        "Admission Number": "ADM-INJECT-001",
        "First Name": "AttackerStudent",
        "Last Name": "Hacker",
        Gender: "MALE",
        "Date of Birth (YYYY-MM-DD)": "2012-05-10",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "Parent Hacker",
        "Parent Phone": "+919876543210",
        // Client-supplied school injection attempts:
        schoolId: "school-B",
        school_id: "school-B",
        targetSchoolId: "school-B",
      },
    ];

    const result = await commitStudentImportAction(maliciousPayload);

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);

    // Verify StudentLifecycleEngine was called with session school ("school-A"), NEVER "school-B"
    expect(StudentLifecycleEngine.createImportedStudent).toHaveBeenCalledWith(
      "school-A",
      expect.objectContaining({
        admissionNumber: "ADM-INJECT-001",
      }),
      expect.anything()
    );

    // Inspect created student record in database
    const created = recordedWrites.studentCreations.find(
      (s) => s.admissionNumber === "ADM-INJECT-001"
    );
    expect(created).toBeDefined();
    expect(created.schoolId).toBe("school-A"); // strictly bound to school-A!
  });

  // ─── ATTACK 2: Cross-Tenant Class / Section Spoofing ────────────────────────
  it("ATTACK 2: Rejects student import referencing a Class or Section belonging to School B", async () => {
    const crossTenantPayload = [
      {
        "Admission Number": "ADM-X-001",
        "First Name": "Cross",
        "Last Name": "Tenant",
        Gender: "FEMALE",
        "Date of Birth (YYYY-MM-DD)": "2012-08-15",
        // "Class 10 - Beta" and Section "Alpha" exist ONLY in school-B!
        "Class Name": "Class 10 - Beta",
        Section: "Alpha",
        "Parent / Guardian Name": "Parent Cross",
        "Parent Phone": "+919876543211",
      },
    ];

    const result = await commitStudentImportAction(crossTenantPayload);

    // Must abort all-or-nothing with row-level error
    expect(result.success).toBe(false);
    expect(result.createdCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Class 'Class 10 - Beta' not found in current institutional curriculum");
    expect(result.rejectedRowsCsv).toContain("ADM-X-001");
    expect(recordedWrites.studentCreations).toHaveLength(0); // Zero writes
  });

  // ─── ATTACK 3: Cross-Tenant Multi-School Admission Number Collision ─────────
  it("ATTACK 3: Permits identical admission number across School A and School B without collision or leak", async () => {
    // Both schools want to use admission number "ADM-SHARED-999"
    const studentPayload = [
      {
        "Admission Number": "ADM-SHARED-999",
        "First Name": "StudentOne",
        "Last Name": "Alpha",
        Gender: "MALE",
        "Date of Birth (YYYY-MM-DD)": "2013-01-01",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "Parent One",
        "Parent Phone": "+919876543210",
      },
    ];

    // 1. School A imports ADM-SHARED-999
    activeSessionRef.current = {
      userId: "admin-school-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };
    const resA = await commitStudentImportAction(studentPayload);
    expect(resA.success).toBe(true);
    expect(resA.createdCount).toBe(1);

    // 2. School A re-imports ADM-SHARED-999 -> Idempotent skip for School A!
    const resA2 = await commitStudentImportAction(studentPayload);
    expect(resA2.success).toBe(true);
    expect(resA2.createdCount).toBe(0);
    expect(resA2.skippedCount).toBe(1);

    // 3. School B imports identical ADM-SHARED-999 -> Should be CREATED (new) for School B!
    activeSessionRef.current = {
      userId: "admin-school-b",
      role: "SCHOOL_ADMIN",
      schoolId: "school-B",
      email: "admin@school-b.edu",
    };
    const studentPayloadB = [
      {
        "Admission Number": "ADM-SHARED-999",
        "First Name": "StudentTwo",
        "Last Name": "Beta",
        Gender: "FEMALE",
        "Date of Birth (YYYY-MM-DD)": "2013-02-02",
        "Class Name": "Class 10 - Beta",
        Section: "Alpha",
        "Parent / Guardian Name": "Parent Two",
        "Parent Phone": "+919876543212",
      },
    ];
    const resB = await commitStudentImportAction(studentPayloadB);
    expect(resB.success).toBe(true);
    expect(resB.createdCount).toBe(1); // School B gets its own student record!
    expect(resB.skippedCount).toBe(0);

    // Verify both records exist in DB under their respective schoolIds
    const records = recordedWrites.studentCreations.filter(
      (s) => s.admissionNumber === "ADM-SHARED-999"
    );
    expect(records).toHaveLength(2);
    expect(records.some((r) => r.schoolId === "school-A")).toBe(true);
    expect(records.some((r) => r.schoolId === "school-B")).toBe(true);
  });

  // ─── ATTACK 4: Staff Import Privilege Escalation & Role Clamping ────────────
  it("ATTACK 4: Rejects administrative role escalation (PRINCIPAL, ADMIN, SUPER_ADMIN) in STAFF import", async () => {
    const maliciousStaffRows = [
      {
        "Employee Code": "EMP-ATTACK-001",
        "First Name": "Evil",
        "Last Name": "Admin",
        "Official Email": "evil.admin@school-a.edu",
        "Contact Phone": "+919876543210",
        Department: "Leadership",
        Designation: "Principal",
        "System Role": "PRINCIPAL", // Forbidden role escalation
      },
      {
        "Employee Code": "EMP-VALID-002",
        "First Name": "Good",
        "Last Name": "Teacher",
        "Official Email": "good.teacher@school-a.edu",
        "Contact Phone": "+919876543211",
        Department: "Academics",
        Designation: "TGT Teacher",
        "System Role": "TEACHER",
      },
    ];

    const result = await commitStaffImportAction(maliciousStaffRows);

    // All-or-Nothing Rollback: because row 1 requested PRINCIPAL, zero rows must commit!
    expect(result.success).toBe(false);
    expect(result.createdCount).toBe(0);
    expect(result.errors.some((e) => e.includes("Role 'PRINCIPAL' is not permitted"))).toBe(true);
    expect(result.rejectedRowsCsv).toContain("EMP-ATTACK-001");
    expect(recordedWrites.staffCreations).toHaveLength(0); // Zero staff created
  });

  // ─── ATTACK 5: Staff Import Client-Supplied schoolId Injection ───────────────
  it("ATTACK 5: Staff import binds strictly to session school and ignores client schoolId injection", async () => {
    const staffRow = [
      {
        "Employee Code": "EMP-INJECT-901",
        "First Name": "Staff",
        "Last Name": "Member",
        "Official Email": "staff.inject@school-a.edu",
        "Contact Phone": "+919876543210",
        Department: "Operations",
        Designation: "Staff",
        "System Role": "STAFF",
        schoolId: "school-B", // Malicious attempt to inject staff into School B
      },
    ];

    const result = await commitStaffImportAction(staffRow);

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);

    // Verify all created records (staff, dept, desig, person, audit) strictly belong to school-A
    expect(recordedWrites.staffCreations[0].schoolId).toBe("school-A");
    expect(recordedWrites.personCreations[0].schoolId).toBe("school-A");
    expect(recordedWrites.auditLogs[0].schoolId).toBe("school-A");
  });

  // ─── ATTACK 6: 5,000-Row Denial of Service Boundary Check ──────────────────
  it("ATTACK 6: Immediately throws error on 5,001 rows before any database operations", async () => {
    const oversizedBatch: Record<string, string>[] = [];
    for (let i = 1; i <= 5001; i++) {
      oversizedBatch.push({
        "Admission Number": `ADM-${i}`,
        "First Name": `S${i}`,
        "Last Name": "Test",
        Gender: "MALE",
        "Date of Birth (YYYY-MM-DD)": "2012-01-01",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "Parent",
        "Parent Phone": "+919876543210",
      });
    }

    await expect(commitStudentImportAction(oversizedBatch)).rejects.toThrow(
      /Import file exceeds maximum allowed limit of 5000 rows/
    );

    // Zero writes
    expect(recordedWrites.studentCreations).toHaveLength(0);
  });

  // ─── ATTACK 7: Unauthorized Role Denial on Real Actions ────────────────────
  it("ATTACK 7: Rejects non-admin roles (TEACHER, PARENT, STUDENT, DRIVER) from real commit actions", async () => {
    const rolesToDeny = ["TEACHER", "PARENT", "STUDENT", "DRIVER"];
    const dummyBatch = [
      {
        "Admission Number": "ADM-DENY-01",
        "First Name": "Test",
        "Last Name": "Student",
        Gender: "MALE",
        "Date of Birth (YYYY-MM-DD)": "2012-01-01",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "Parent",
        "Parent Phone": "+919876543210",
      },
    ];

    for (const role of rolesToDeny) {
      activeSessionRef.current = {
        userId: `user-${role.toLowerCase()}`,
        role,
        schoolId: "school-A",
        email: `${role.toLowerCase()}@school-a.edu`,
      };

      await expect(commitStudentImportAction(dummyBatch)).rejects.toThrow(
        /Forbidden: Role/
      );
      await expect(commitStaffImportAction([])).rejects.toThrow(
        /Forbidden: Role/
      );
    }
  });

  // ─── ATTACK 8: Bilingual / Hindi Vernacular Names (DPDP Act Compliance) ─────
  it("ATTACK 8: Safely handles Unicode / Hindi student and parent names without corruption", async () => {
    const bilingualPayload = [
      {
        "Admission Number": "ADM-HINDI-001",
        "First Name": "राहुल",
        "Last Name": "शर्मा",
        Gender: "MALE",
        "Date of Birth (YYYY-MM-DD)": "2012-06-15",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "राजेश शर्मा",
        "Parent Phone": "+919876543210",
      },
    ];

    const result = await commitStudentImportAction(bilingualPayload);
    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);

    expect(StudentLifecycleEngine.createImportedStudent).toHaveBeenCalledWith(
      "school-A",
      expect.objectContaining({
        firstName: "राहुल",
        lastName: "शर्मा",
        parentName: "राजेश शर्मा",
      }),
      expect.anything()
    );
  });

  // ─── ATTACK 9: Prototype Pollution Injection ────────────────────────────────
  it("ATTACK 9: Neutralizes prototype pollution payload keys (__proto__, constructor)", async () => {
    const pollutionRow: Record<string, string> = {
      "Admission Number": "ADM-PROTO-001",
      "First Name": "Proto",
      "Last Name": "Test",
      Gender: "FEMALE",
      "Date of Birth (YYYY-MM-DD)": "2013-03-20",
      "Class Name": "Class 10",
      Section: "A",
      "Parent / Guardian Name": "Parent",
      "Parent Phone": "+919876543210",
      "__proto__": "polluted",
      "constructor": "polluted",
      "prototype": "polluted",
    };

    const result = await commitStudentImportAction([pollutionRow]);
    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);
    expect(({} as any).polluted).toBeUndefined();
  });

  // ─── ATTACK 10: SQL Injection Payload in CSV Fields ─────────────────────────
  it("ATTACK 10: Safely escapes SQL injection payloads in admission numbers and names", async () => {
    const sqlInjectionPayload = [
      {
        "Admission Number": "ADM'; DROP TABLE students; --",
        "First Name": "SQL'; SELECT * FROM users; --",
        "Last Name": "Injection",
        Gender: "OTHER",
        "Date of Birth (YYYY-MM-DD)": "2011-12-12",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "Parent",
        "Parent Phone": "+919876543210",
      },
    ];

    const result = await commitStudentImportAction(sqlInjectionPayload);
    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);

    // Verify it was safely passed as literal string
    expect(StudentLifecycleEngine.createImportedStudent).toHaveBeenCalledWith(
      "school-A",
      expect.objectContaining({
        admissionNumber: "ADM'; DROP TABLE students; --",
      }),
      expect.anything()
    );
  });

  // ─── ATTACK 11: 50-Row Mixed Batch All-or-Nothing Abort ────────────────────
  it("ATTACK 11: All-Or-Nothing rollback guarantees 0 database writes when 1 of 50 rows is invalid", async () => {
    const mixedBatch: Record<string, string>[] = [];
    for (let i = 1; i <= 49; i++) {
      mixedBatch.push({
        "Admission Number": `ADM-BULK-VALID-${i}`,
        "First Name": `Student${i}`,
        "Last Name": "Valid",
        Gender: "MALE",
        "Date of Birth (YYYY-MM-DD)": "2012-01-01",
        "Class Name": "Class 10",
        Section: "A",
        "Parent / Guardian Name": "Parent",
        "Parent Phone": "+919876543210",
      });
    }

    // Row 50 is invalid: non-existent class
    mixedBatch.push({
      "Admission Number": "ADM-BULK-INVALID-50",
      "First Name": "Defective",
      "Last Name": "Student",
      Gender: "MALE",
      "Date of Birth (YYYY-MM-DD)": "2012-01-01",
      "Class Name": "NonExistentClass999",
      Section: "A",
      "Parent / Guardian Name": "Parent",
      "Parent Phone": "+919876543210",
    });

    const result = await commitStudentImportAction(mixedBatch);

    expect(result.success).toBe(false);
    expect(result.createdCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rejectedRowsCsv).toContain("ADM-BULK-INVALID-50");
    // Verify none of the 49 valid students were written to database!
    expect(recordedWrites.studentCreations).toHaveLength(0);
  });
});
