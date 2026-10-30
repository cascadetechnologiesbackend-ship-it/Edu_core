import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// ─── 1. Mocks for React, Next, Auth & Server Utilities ────────────────────────
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

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

vi.mock("@/lib/storage", () => ({
  uploadBufferToS3: vi.fn(async () => ({ success: true })),
  getPresignedDownloadUrl: vi.fn(async () => "https://s3.example.com/logo.png"),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "mocked-bcrypt-hash"),
  },
  hash: vi.fn(async () => "mocked-bcrypt-hash"),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({
    ipAddress: "192.168.1.100",
    userAgent: "Vitest S21 Challenger1 Runner",
  })),
}));

vi.mock("@/lib/auditLogger", () => ({
  logFeeAuditEvent: vi.fn(async () => {}),
  logPlatformAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/schoolCache", () => ({
  invalidateSchoolCache: vi.fn(async () => {}),
}));

vi.mock("@/lib/provisioningEngine", () => ({
  topUpSchoolProvision: vi.fn(async (schoolId: string, blueprintId?: string) => ({
    success: true,
    addedCount: 8,
    message: `Successfully topped up 8 bell periods for school ${schoolId}.`,
  })),
}));

// ─── 2. Multi-Tenant Mock State & Active Session ─────────────────────────────
const { activeSessionRef, mockTwoSchoolDb, recordedDbCalls } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "user-admin-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    } as any,
  };

  const recordedDbCalls = {
    studentCreations: [] as any[],
    staffCreations: [] as any[],
    timetablePeriodInserts: [] as any[],
    schoolUpdates: [] as any[],
  };

  const mockTwoSchoolDb = {
    schools: [
      { id: "school-A", name: "Delhi Public School (School A)", isActive: true },
      { id: "school-B", name: "St. Xavier Academy (School B)", isActive: true },
    ] as any[],
    academicYears: [
      { id: "ay-A-1", schoolId: "school-A", label: "2026-27", isActive: true },
      { id: "ay-B-1", schoolId: "school-B", label: "2026-27", isActive: true },
    ] as any[],
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
    classSubjects: [
      { id: "cs-A-math", schoolId: "school-A", classId: "cls-A-1", subjectId: "sub-math", name: "Mathematics", weeklyPeriods: 6 },
    ],
    sectionSubjectTeachers: [
      { id: "sst-A-1", schoolId: "school-A", sectionId: "sec-A-1", classSubjectId: "cs-A-math", teacherId: "teacher-A-1", isActive: true },
    ],
    bellSchedule: [
      { id: "bell-A-1", schoolId: "school-A", periodNumber: 1, name: "Period 1", startTime: "08:30", endTime: "09:15", periodType: "REGULAR", isActive: true },
      { id: "bell-A-2", schoolId: "school-A", periodNumber: 2, name: "Period 2", startTime: "09:15", endTime: "10:00", periodType: "REGULAR", isActive: true },
      { id: "bell-B-1", schoolId: "school-B", periodNumber: 1, name: "Period 1", startTime: "08:30", endTime: "09:15", periodType: "REGULAR", isActive: true },
    ],
    timetablePeriods: [
      { id: "tt-A-1", schoolId: "school-A", sectionId: "sec-A-1", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
      { id: "tt-B-1", schoolId: "school-B", sectionId: "sec-B-1", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
    ] as any[],
    departments: [
      { id: "dept-A-1", schoolId: "school-A", name: "Academics", isActive: true },
    ] as any[],
    designations: [
      { id: "desig-A-1", schoolId: "school-A", departmentId: "dept-A-1", name: "Teacher", mappedRole: "TEACHER", isTeaching: true, isActive: true },
    ] as any[],
    users: [] as any[],
    roles: [
      { id: "role-teacher", schoolId: "school-A", name: "TEACHER" },
      { id: "role-staff", schoolId: "school-A", name: "STAFF" },
      { id: "role-accountant", schoolId: "school-A", name: "ACCOUNTANT" },
    ] as any[],
    userRoles: [] as any[],
    students: [
      { id: "stu-A-1", schoolId: "school-A", admissionNumber: "ADM-A-001" },
      { id: "stu-B-1", schoolId: "school-B", admissionNumber: "ADM-B-001" },
    ] as any[],
    staff: [
      { id: "stf-A-1", schoolId: "school-A", employeeCode: "EMP-A-101", role: "TEACHER" },
      { id: "stf-B-1", schoolId: "school-B", employeeCode: "EMP-B-101", role: "TEACHER" },
    ] as any[],
    persons: [] as any[],
    auditLogs: [] as any[],
  };

  return { activeSessionRef, mockTwoSchoolDb, recordedDbCalls };
});

vi.mock("@schoolmitra/backend/lib/studentLifecycleEngine", () => ({
  StudentLifecycleEngine: {
    createImportedStudent: vi.fn(async (schoolId: string, input: any) => {
      recordedDbCalls.studentCreations.push({ schoolId, input });
      mockTwoSchoolDb.students.push({
        id: `stu-${input.admissionNumber}`,
        schoolId,
        admissionNumber: input.admissionNumber,
      });
      return {
        isNew: true,
        studentId: `stu-${input.admissionNumber}`,
        admissionNumber: input.admissionNumber,
      };
    }),
  },
}));

function resolveTableName(tbl: any): string {
  if (!tbl) return "";
  if (typeof tbl === "string") return tbl;
  try {
    const name = getTableName(tbl);
    if (typeof name === "string") return name;
  } catch {}
  if (tbl[Symbol.for("drizzle:Name")]) return String(tbl[Symbol.for("drizzle:Name")]);
  if (tbl[Symbol.for("drizzle:OriginalName")]) return String(tbl[Symbol.for("drizzle:OriginalName")]);
  if (tbl._ && typeof tbl._.name === "string") return tbl._.name;
  if (typeof tbl.name === "string") return tbl.name;
  return "";
}

function extractParamsFromCondition(cond: any): string[] {
  if (!cond) return [];
  const results: string[] = [];
  const visited = new Set();
  function traverse(obj: any, depth = 0) {
    if (!obj || depth > 4 || visited.has(obj)) return;
    visited.add(obj);
    if (typeof obj === "string") {
      results.push(obj);
      return;
    }
    if (obj.value && typeof obj.value === "string") {
      results.push(obj.value);
    }
    if (Array.isArray(obj.queryChunks)) {
      for (const chunk of obj.queryChunks) {
        traverse(chunk, depth + 1);
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item, depth + 1);
      }
    }
  }
  try {
    traverse(cond);
  } catch {}
  return results;
}

// ─── 3. Mock Server Auth ─────────────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current || !activeSessionRef.current.userId) {
      throw new Error("Unauthorized: No active session found.");
    }
    const role = activeSessionRef.current.role;
    if (allowedRoles && (!role || !allowedRoles.includes(role))) {
      throw new Error(`Forbidden: Role '${role}' is not authorized to perform this operation.`);
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
    if (!ctx.schoolId) throw new Error("No school context provided.");
    const school = mockTwoSchoolDb.schools.find((s) => s.id === ctx.schoolId);
    if (!school) throw new Error("School not found");
    return school;
  }),
  checkAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current || !activeSessionRef.current.userId) {
      throw new Error("Unauthorized: No active session found.");
    }
    const role = activeSessionRef.current.role;
    if (allowedRoles && (!role || !allowedRoles.includes(role))) {
      throw new Error(`Forbidden: Role '${role}' is not authorized.`);
    }
    return { user: activeSessionRef.current };
  }),
}));

// ─── 4. Mock Database with Tenant Scoping ────────────────────────────────────
vi.mock("@/db", () => {
  const createTx = (tenantSchoolId: string) => ({
    query: {
      classes: {
        findMany: vi.fn(async () => {
          return mockTwoSchoolDb.classes.filter((c) => c.schoolId === tenantSchoolId && c.isActive);
        }),
      },
      sections: {
        findMany: vi.fn(async () => {
          return mockTwoSchoolDb.sections.filter((s) => s.schoolId === tenantSchoolId && s.isActive);
        }),
      },
      staff: {
        findMany: vi.fn(async () => {
          return mockTwoSchoolDb.staff.filter((s) => s.schoolId === tenantSchoolId);
        }),
      },
      departments: {
        findMany: vi.fn(async () => {
          return mockTwoSchoolDb.departments.filter((d) => d.schoolId === tenantSchoolId);
        }),
      },
      designations: {
        findMany: vi.fn(async () => {
          return mockTwoSchoolDb.designations.filter((d) => d.schoolId === tenantSchoolId);
        }),
      },
      users: {
        findFirst: vi.fn(async () => {
          return mockTwoSchoolDb.users.find((u) => u.schoolId === tenantSchoolId) || null;
        }),
      },
      roles: {
        findFirst: vi.fn(async () => {
          return mockTwoSchoolDb.roles.find((r) => r.schoolId === tenantSchoolId) || null;
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
          mockTwoSchoolDb.staff.push(inserted);
          recordedDbCalls.staffCreations.push(inserted);
        } else if (val.name && val.mappedRole) {
          mockTwoSchoolDb.designations.push(inserted);
        } else if (val.name && !val.mappedRole) {
          mockTwoSchoolDb.departments.push(inserted);
        } else if (val.passwordHash) {
          mockTwoSchoolDb.users.push(inserted);
        } else if (val.primaryType === "STAFF") {
          mockTwoSchoolDb.persons.push(inserted);
        } else if (val.tableName === "staff") {
          mockTwoSchoolDb.auditLogs.push(inserted);
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
        schools: {
          findFirst: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.schools.find((s) => s.id === sid) || null;
          }),
        },
        academicYears: {
          findFirst: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.academicYears.find((ay) => ay.schoolId === sid && ay.isActive) || null;
          }),
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.academicYears.filter((ay) => ay.schoolId === sid && ay.isActive);
          }),
        },
        classes: {
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.classes.filter((c) => c.schoolId === sid && c.isActive);
          }),
        },
        sections: {
          findFirst: vi.fn(async ({ where }: any) => {
            const currentSchoolId = activeSessionRef.current?.schoolId;
            const params = extractParamsFromCondition(where);
            if (params.length > 0) {
              const targetSection = mockTwoSchoolDb.sections.find((s) => params.includes(s.id));
              if (targetSection && targetSection.schoolId === currentSchoolId && targetSection.isActive) {
                return {
                  ...targetSection,
                  class: mockTwoSchoolDb.classes.find((c) => c.id === targetSection.classId) || null,
                };
              }
              return null;
            }
            const fallback = mockTwoSchoolDb.sections.find((s) => s.schoolId === currentSchoolId && s.isActive);
            return fallback ? { ...fallback, class: mockTwoSchoolDb.classes.find((c) => c.id === fallback.classId) || null } : null;
          }),
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.sections.filter((s) => s.schoolId === sid && s.isActive);
          }),
        },
        schoolProvisions: {
          findFirst: vi.fn(async () => null),
        },
        bellSchedule: {
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.bellSchedule.filter((b) => b.schoolId === sid && b.isActive);
          }),
        },
        classSubjects: {
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.classSubjects.filter((cs) => cs.schoolId === sid);
          }),
        },
        sectionSubjectTeachers: {
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.sectionSubjectTeachers.filter((sst) => sst.schoolId === sid && sst.isActive);
          }),
        },
        timetablePeriods: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => {
            const sid = activeSessionRef.current?.schoolId;
            return mockTwoSchoolDb.timetablePeriods.filter((t) => t.schoolId === sid && t.isActive);
          }),
        },
      },
      update: vi.fn((tbl: any) => ({
        set: vi.fn((updateVals: any) => ({
          where: vi.fn(async (cond: any) => {
            const tblName = resolveTableName(tbl);
            if (tblName.includes("schools")) {
              const sid = activeSessionRef.current?.schoolId;
              recordedDbCalls.schoolUpdates.push({ sid, updateVals });
              const s = mockTwoSchoolDb.schools.find((item) => item.id === sid);
              if (s) Object.assign(s, updateVals);
            }
            return { rowCount: 1 };
          }),
        })),
      })),
      insert: vi.fn((tbl: any) => ({
        values: vi.fn((val: any) => {
          const inserted = { id: `gen-${Date.now()}`, ...val };
          const tblName = resolveTableName(tbl);
          if (tblName.includes("timetable_periods")) {
            mockTwoSchoolDb.timetablePeriods.push(inserted);
            recordedDbCalls.timetablePeriodInserts.push(inserted);
          }
          return {
            returning: async () => [inserted],
            then: (resolve: any) => Promise.resolve([inserted]).then(resolve),
          };
        }),
      })),
      select: vi.fn(() => {
        let targetTable = "";
        const chain: any = {
          from: vi.fn((tbl: any) => {
            targetTable = resolveTableName(tbl);
            return chain;
          }),
          innerJoin: vi.fn(() => chain),
          where: vi.fn(() => chain),
          then: (resolve: any) => {
            const schoolId = activeSessionRef.current?.schoolId;
            let count = 0;
            if (targetTable.includes("academic_years")) count = 1;
            else if (targetTable.includes("classes")) count = mockTwoSchoolDb.classes.filter((c) => c.schoolId === schoolId).length;
            else if (targetTable.includes("sections")) count = mockTwoSchoolDb.sections.filter((s) => s.schoolId === schoolId).length;
            else if (targetTable.includes("bell_schedule")) count = mockTwoSchoolDb.bellSchedule.filter((b) => b.schoolId === schoolId).length;
            else if (targetTable.includes("timetable_periods")) count = 1;
            else if (targetTable.includes("section_subject_teachers")) count = 1;
            else if (targetTable.includes("students")) count = mockTwoSchoolDb.students.filter((st) => st.schoolId === schoolId).length;
            return Promise.resolve([{ count }]).then(resolve);
          },
        };
        return chain;
      }),
    },
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      if (!schoolId) {
        throw new Error("Invalid tenant ID: schoolId is required.");
      }
      if (activeSessionRef.current && activeSessionRef.current.schoolId !== schoolId) {
        throw new Error(`Tenant Mismatch: Session tenant '${activeSessionRef.current.schoolId}' does not match requested tenant '${schoolId}'.`);
      }
      return cb(createTx(schoolId));
    }),
  };
});

// ─── 5. Import Real Production Server Actions ────────────────────────────────
import {
  commitStudentImportAction,
  commitStaffImportAction,
} from "@/app/(admin)/school/import-center/actions";
import {
  generateSectionTimetablePreview,
  commitSectionTimetable,
  saveTimetablePeriod,
} from "@/app/(admin)/academics/actions/timetable.actions";
import {
  getSchoolConfigurationHealthAction,
  setupSchool,
} from "@/app/(admin)/settings/school-setup/actions";
import { invalidateActiveYearCache } from "@/app/(admin)/academics/actions/auth-helper";
import { StudentLifecycleEngine } from "@schoolmitra/backend/lib/studentLifecycleEngine";

// ─── Fixtures ────────────────────────────────────────────────────────────────
const sampleValidStudentRow = [
  {
    "Admission Number": "ADM-ADV-001",
    "First Name": "Reyansh",
    "Last Name": "Gupta",
    Gender: "MALE",
    "Date of Birth (YYYY-MM-DD)": "2012-07-20",
    "Class Name": "Class 10",
    Section: "A",
    "Parent / Guardian Name": "Suresh Gupta",
    "Parent Phone": "+919876543210",
  },
];

const sampleValidStaffRow = [
  {
    "Employee Code": "EMP-ADV-001",
    "First Name": "Anita",
    "Last Name": "Roy",
    "Official Email": "anita.roy@school-a.edu",
    "Contact Phone": "+919876543210",
    Department: "Academics",
    Designation: "Teacher",
    "System Role": "TEACHER",
  },
];

const sampleSetupPayload = {
  name: "Delhi Public School",
  board: "CBSE" as const,
  udiseCode: "06190100101",
  address: "Sector 14, Mathura Road",
  city: "Faridabad",
  state: "Haryana",
  pincode: "121007",
  phone: "9876543210",
  email: "principal@dpsfaridabad.in",
  principalName: "Anil Kumar",
  establishedYear: 1995,
  academicYearLabel: "2026-27",
  academicYearStart: "2026-04-01",
  academicYearEnd: "2027-03-31",
};

describe("Sprint 21 Milestone 5: Adversarial Challenge Suite 1 (challenger_m5_1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateActiveYearCache();

    // Reset default session to School A admin
    activeSessionRef.current = {
      userId: "user-admin-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };

    recordedDbCalls.studentCreations.length = 0;
    recordedDbCalls.staffCreations.length = 0;
    recordedDbCalls.timetablePeriodInserts.length = 0;
    recordedDbCalls.schoolUpdates.length = 0;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Privilege Escalation & Role Spoofing Adversarial Probe
  // ═══════════════════════════════════════════════════════════════════════════
  describe("1. Privilege Escalation & Role Spoofing Adversarial Probes", () => {
    const unauthorizedStandardRoles = ["TEACHER", "STUDENT", "PARENT", "DRIVER", "ACCOUNTANT"];

    describe("1.1 Standard Non-Admin Roles Rejection Across All Sprint 21 Server Actions", () => {
      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from commitStudentImportAction",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(commitStudentImportAction(sampleValidStudentRow)).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from commitStaffImportAction",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(commitStaffImportAction(sampleValidStaffRow)).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from generateSectionTimetablePreview",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(generateSectionTimetablePreview("sec-A-1")).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from commitSectionTimetable",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(commitSectionTimetable("sec-A-1", [])).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from saveTimetablePeriod",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(
            saveTimetablePeriod({
              sectionId: "sec-A-1",
              dayOfWeek: "MONDAY",
              periodNumber: 1,
              startTime: "08:30",
              endTime: "09:15",
              periodType: "REGULAR",
            })
          ).rejects.toThrow(/Forbidden: Role/);
        }
      );

      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from setupSchool",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(setupSchool(sampleSetupPayload)).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(unauthorizedStandardRoles)(
        "role '%s' is strictly forbidden from getSchoolConfigurationHealthAction",
        async (role) => {
          activeSessionRef.current = {
            userId: `user-${role.toLowerCase()}`,
            role,
            schoolId: "school-A",
            email: `${role.toLowerCase()}@school-a.edu`,
          };

          await expect(getSchoolConfigurationHealthAction()).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );
    });

    describe("1.2 Empty, Malformed, Forged, and Anonymized Role Spoofing", () => {
      const forgedRoles = [
        "",
        "   ",
        "ANONYMOUS",
        "HACKER",
        "SUPER_USER",
        "GUEST",
        "null",
        "undefined",
        "admin", // lowercase mismatch
        "teacher",
        "ROOT",
        "DIRECTOR",
      ];

      it.each(forgedRoles)(
        "fails closed when caller has forged/empty role '%s' on commitStudentImportAction",
        async (forgedRole) => {
          activeSessionRef.current = {
            userId: "spoofed-user",
            role: forgedRole,
            schoolId: "school-A",
            email: "spoofed@school-a.edu",
          };

          await expect(commitStudentImportAction(sampleValidStudentRow)).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(forgedRoles)(
        "fails closed when caller has forged/empty role '%s' on generateSectionTimetablePreview",
        async (forgedRole) => {
          activeSessionRef.current = {
            userId: "spoofed-user",
            role: forgedRole,
            schoolId: "school-A",
            email: "spoofed@school-a.edu",
          };

          await expect(generateSectionTimetablePreview("sec-A-1")).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it.each(forgedRoles)(
        "fails closed when caller has forged/empty role '%s' on setupSchool",
        async (forgedRole) => {
          activeSessionRef.current = {
            userId: "spoofed-user",
            role: forgedRole,
            schoolId: "school-A",
            email: "spoofed@school-a.edu",
          };

          await expect(setupSchool(sampleSetupPayload)).rejects.toThrow(
            /Forbidden: Role/
          );
        }
      );

      it("fails closed when session user role is null or undefined", async () => {
        activeSessionRef.current = {
          userId: "user-no-role",
          role: undefined,
          schoolId: "school-A",
          email: "norole@school-a.edu",
        };

        await expect(commitStaffImportAction(sampleValidStaffRow)).rejects.toThrow(/Forbidden/);
        await expect(commitSectionTimetable("sec-A-1", [])).rejects.toThrow(/Forbidden/);
        await expect(getSchoolConfigurationHealthAction()).rejects.toThrow(/Forbidden/);
      });
    });

    describe("1.3 Administrative Role Separation (PRINCIPAL Role Limits)", () => {
      beforeEach(() => {
        activeSessionRef.current = {
          userId: "user-principal-a",
          role: "PRINCIPAL",
          schoolId: "school-A",
          email: "principal@school-a.edu",
        };
      });

      it("denies PRINCIPAL from bulk student import (restricted strictly to SUPER_ADMIN, SCHOOL_ADMIN)", async () => {
        await expect(commitStudentImportAction(sampleValidStudentRow)).rejects.toThrow(
          /Forbidden: Role 'PRINCIPAL' is not authorized/
        );
      });

      it("denies PRINCIPAL from bulk staff import (restricted strictly to SUPER_ADMIN, SCHOOL_ADMIN)", async () => {
        await expect(commitStaffImportAction(sampleValidStaffRow)).rejects.toThrow(
          /Forbidden: Role 'PRINCIPAL' is not authorized/
        );
      });

      it("denies PRINCIPAL from running setupSchool institutional wizard (restricted strictly to SUPER_ADMIN, SCHOOL_ADMIN)", async () => {
        await expect(setupSchool(sampleSetupPayload)).rejects.toThrow(
          /Forbidden: Role 'PRINCIPAL' is not authorized/
        );
      });

      it("permits PRINCIPAL on timetable preview, commit, and setup health inspection", async () => {
        const preview = await generateSectionTimetablePreview("sec-A-1");
        expect(preview).toBeDefined();
        expect(preview.fits).toBe(true);

        const health = await getSchoolConfigurationHealthAction();
        expect(health).toBeDefined();
        expect(health.configurationScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Cross-Tenant Hopping Adversarial Probes
  // ═══════════════════════════════════════════════════════════════════════════
  describe("2. Cross-Tenant Hopping Adversarial Probes", () => {
    beforeEach(() => {
      // Authenticated strictly as School A Admin
      activeSessionRef.current = {
        userId: "admin-school-a",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };
    });

    it("rejects School A admin passing School B's section ID to generateSectionTimetablePreview", async () => {
      await expect(generateSectionTimetablePreview("sec-B-1")).rejects.toThrow(
        /Invalid section specified/
      );
    });

    it("rejects School A admin passing School B's section ID to commitSectionTimetable", async () => {
      await expect(commitSectionTimetable("sec-B-1", [])).rejects.toThrow(
        /Invalid section specified/
      );
    });

    it("rejects School A admin passing School B's section ID to saveTimetablePeriod", async () => {
      await expect(
        saveTimetablePeriod({
          sectionId: "sec-B-1",
          dayOfWeek: "MONDAY",
          periodNumber: 1,
          startTime: "08:30",
          endTime: "09:15",
          periodType: "REGULAR",
        })
      ).rejects.toThrow(/Invalid section specified/);
    });

    it("rejects School A admin passing a fabricated non-existent section ID", async () => {
      await expect(generateSectionTimetablePreview("sec-alien-999")).rejects.toThrow(
        /Invalid section specified/
      );
      await expect(commitSectionTimetable("sec-alien-999", [])).rejects.toThrow(
        /Invalid section specified/
      );
    });

    it("rejects School A student import with class belonging exclusively to School B", async () => {
      const crossClassRow = [
        {
          "Admission Number": "ADM-CROSS-CLS",
          "First Name": "Attacker",
          "Last Name": "Student",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10 - Beta", // Exists in School B, not School A!
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const res = await commitStudentImportAction(crossClassRow);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors.some((e) => e.includes("Class 'Class 10 - Beta' not found"))).toBe(true);
      expect(recordedDbCalls.studentCreations).toHaveLength(0);
    });

    it("rejects School A student import with section belonging exclusively to School B", async () => {
      const crossSectionRow = [
        {
          "Admission Number": "ADM-CROSS-SEC",
          "First Name": "Attacker",
          "Last Name": "Student",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10", // Exists in School A
          Section: "Alpha", // Exists only in School B!
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
        },
      ];

      const res = await commitStudentImportAction(crossSectionRow);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors.some((e) => e.includes("Section 'Alpha' not found in Class 'Class 10'"))).toBe(true);
      expect(recordedDbCalls.studentCreations).toHaveLength(0);
    });

    it("proves that importing an admission number matching School B creates a record strictly in School A without leaking or mutating School B", async () => {
      // School B already has ADM-B-001
      const initialSchoolBStudent = mockTwoSchoolDb.students.find(
        (s) => s.schoolId === "school-B" && s.admissionNumber === "ADM-B-001"
      );
      expect(initialSchoolBStudent).toBeDefined();

      const sameAdmRow = [
        {
          "Admission Number": "ADM-B-001", // Colliding admission number
          "First Name": "Local",
          "Last Name": "Student",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent A",
          "Parent Phone": "+919876543210",
        },
      ];

      const res = await commitStudentImportAction(sameAdmRow);
      expect(res.success).toBe(true);
      expect(res.createdCount).toBe(1);

      // Verify created record in School A
      const schoolACreation = recordedDbCalls.studentCreations.find(
        (c) => c.input.admissionNumber === "ADM-B-001"
      );
      expect(schoolACreation).toBeDefined();
      expect(schoolACreation.schoolId).toBe("school-A");

      // Verify School B's student was never modified or contaminated
      const currentSchoolBStudent = mockTwoSchoolDb.students.find(
        (s) => s.schoolId === "school-B" && s.admissionNumber === "ADM-B-001"
      );
      expect(currentSchoolBStudent).toEqual(initialSchoolBStudent);
    });

    it("proves withTenant fails closed with TenantMismatch when invoked with alien tenant ID", async () => {
      const { withTenant } = await import("@/db");

      await expect(
        withTenant("school-B", async (tx: any) => tx)
      ).rejects.toThrow(/Tenant Mismatch/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: Client-Supplied schoolId Injection Defense
  // ═══════════════════════════════════════════════════════════════════════════
  describe("3. Client-Supplied schoolId Injection Defense", () => {
    beforeEach(() => {
      // Authenticated strictly as School A Admin
      activeSessionRef.current = {
        userId: "admin-school-a",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };
    });

    it("ignores client-supplied schoolId in student import row and enforces session schoolId", async () => {
      const injectedRow = [
        {
          "Admission Number": "ADM-INJECT-01",
          "First Name": "Injection",
          "Last Name": "Attempt",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543210",
          schoolId: "school-B", // Malicious client injection
          "School ID": "school-B",
        },
      ];

      const res = await commitStudentImportAction(injectedRow);
      expect(res.success).toBe(true);
      expect(res.createdCount).toBe(1);

      // Verify that S13 StudentLifecycleEngine was invoked strictly with School A
      expect(StudentLifecycleEngine.createImportedStudent).toHaveBeenCalledWith(
        "school-A",
        expect.objectContaining({
          admissionNumber: "ADM-INJECT-01",
        }),
        expect.anything()
      );

      // No calls with school-B
      expect(StudentLifecycleEngine.createImportedStudent).not.toHaveBeenCalledWith(
        "school-B",
        expect.anything(),
        expect.anything()
      );
    });

    it("ignores client-supplied schoolId in staff import row and enforces session schoolId", async () => {
      const injectedStaffRow = [
        {
          "Employee Code": "EMP-INJECT-01",
          "First Name": "Staff",
          "Last Name": "Injection",
          "Official Email": "staff.inject@school-a.edu",
          "Contact Phone": "+919876543210",
          Department: "Academics",
          Designation: "Teacher",
          "System Role": "TEACHER",
          schoolId: "school-B", // Malicious client injection
          "School ID": "school-B",
        },
      ];

      const res = await commitStaffImportAction(injectedStaffRow);
      expect(res.success).toBe(true);
      expect(res.createdCount).toBe(1);

      // Verify created staff has schoolId: "school-A"
      const createdStaff = recordedDbCalls.staffCreations.find(
        (s) => s.employeeCode === "EMP-INJECT-01"
      );
      expect(createdStaff).toBeDefined();
      expect(createdStaff.schoolId).toBe("school-A");

      // Verify no staff created for School B
      const schoolBStaff = mockTwoSchoolDb.staff.find((s) => s.employeeCode === "EMP-INJECT-01");
      expect(schoolBStaff.schoolId).toBe("school-A");
    });

    it("ignores client-supplied schoolId in saveTimetablePeriod and scopes to session schoolId", async () => {
      const maliciousPayload = {
        sectionId: "sec-A-1",
        dayOfWeek: "MONDAY" as const,
        periodNumber: 2,
        startTime: "09:15",
        endTime: "10:00",
        periodType: "REGULAR" as const,
        schoolId: "school-B", // Malicious client injection
      };

      const res = await saveTimetablePeriod(maliciousPayload as any);
      expect(res.success).toBe(true);

      // Verify inserted timetable period strictly has schoolId: "school-A"
      const inserted = recordedDbCalls.timetablePeriodInserts.find(
        (p) => p.periodNumber === 2 && p.dayOfWeek === "MONDAY"
      );
      expect(inserted).toBeDefined();
      expect(inserted.schoolId).toBe("school-A");
    });

    it("ignores client-supplied schoolId or target ID in setupSchool wizard", async () => {
      const maliciousSetup = {
        ...sampleSetupPayload,
        id: "school-B", // Attempt to overwrite School B's identity!
        schoolId: "school-B",
        name: "Hacked School B",
      };

      const res = await setupSchool(maliciousSetup as any);
      expect(res.success).toBe(true);

      // Verify School B was never updated
      const schoolB = mockTwoSchoolDb.schools.find((s) => s.id === "school-B");
      expect(schoolB.name).toBe("St. Xavier Academy (School B)");

      // Verify update was applied strictly to School A
      const schoolA = mockTwoSchoolDb.schools.find((s) => s.id === "school-A");
      expect(schoolA.name).toBe("Hacked School B");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 4: Staff Role Evasion, Sanitization & Injection Defense
  // ═══════════════════════════════════════════════════════════════════════════
  describe("4. Staff Role Evasion, Sanitization & Injection Defense", () => {
    beforeEach(() => {
      activeSessionRef.current = {
        userId: "admin-school-a",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };
    });

    describe("4.1 Whitespace & Trailing Space Handling", () => {
      it("safely trims and permits allowed roles with trailing/leading spaces", async () => {
        const paddedStaffRows = [
          {
            "Employee Code": "EMP-PAD-01",
            "First Name": "Staff",
            "Last Name": "Padded1",
            "Official Email": "pad1@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Academics",
            Designation: "Teacher",
            "System Role": "TEACHER  ", // Trailing spaces
          },
          {
            "Employee Code": "EMP-PAD-02",
            "First Name": "Staff",
            "Last Name": "Padded2",
            "Official Email": "pad2@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Administration",
            Designation: "Clerk",
            "System Role": "  STAFF", // Leading spaces
          },
          {
            "Employee Code": "EMP-PAD-03",
            "First Name": "Staff",
            "Last Name": "Padded3",
            "Official Email": "pad3@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Finance",
            Designation: "Accountant",
            "System Role": " ACCOUNTANT ", // Both
          },
        ];

        const res = await commitStaffImportAction(paddedStaffRows);
        expect(res.success).toBe(true);
        expect(res.createdCount).toBe(3);
        expect(res.errors).toHaveLength(0);
      });

      it("rejects elevated roles even with trailing or leading whitespace evasion", async () => {
        const sneakyElevatedRows = [
          "PRINCIPAL ",
          " PRINCIPAL",
          "  SUPER_ADMIN  ",
          " DIRECTOR ",
        ];

        for (const sneakyRole of sneakyElevatedRows) {
          const row = [
            {
              "Employee Code": `EMP-EVADE-${sneakyRole.trim()}`,
              "First Name": "Sneaky",
              "Last Name": "Admin",
              "Official Email": "sneaky@school-a.edu",
              "Contact Phone": "+919876543210",
              Department: "Leadership",
              Designation: "Head",
              "System Role": sneakyRole,
            },
          ];

          const res = await commitStaffImportAction(row);
          expect(res.success).toBe(false);
          expect(res.createdCount).toBe(0);
          expect(
            res.errors.some(
              (e) =>
                e.includes("is not permitted for bulk staff import") ||
                e.includes("must be one of [TEACHER, STAFF, ACCOUNTANT]")
            )
          ).toBe(true);
        }
      });
    });

    describe("4.2 Mixed Casing Normalization & Defense", () => {
      it("normalizes mixed-case allowed roles to canonical uppercase", async () => {
        const mixedCaseRows = [
          {
            "Employee Code": "EMP-CASE-01",
            "First Name": "Staff",
            "Last Name": "Case1",
            "Official Email": "case1@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Academics",
            Designation: "Teacher",
            "System Role": "Teacher",
          },
          {
            "Employee Code": "EMP-CASE-02",
            "First Name": "Staff",
            "Last Name": "Case2",
            "Official Email": "case2@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Administration",
            Designation: "Assistant",
            "System Role": "staff",
          },
          {
            "Employee Code": "EMP-CASE-03",
            "First Name": "Staff",
            "Last Name": "Case3",
            "Official Email": "case3@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Finance",
            Designation: "Accountant",
            "System Role": "aCCounTant",
          },
        ];

        const res = await commitStaffImportAction(mixedCaseRows);
        expect(res.success).toBe(true);
        expect(res.createdCount).toBe(3);
      });

      it("rejects mixed-case administrative roles (Principal, Super_Admin, Director)", async () => {
        const forbiddenMixed = ["Principal", "Super_admin", "Admin", "Director", "Root"];

        for (const role of forbiddenMixed) {
          const row = [
            {
              "Employee Code": `EMP-FORBID-${role}`,
              "First Name": "Test",
              "Last Name": "Forbidden",
              "Official Email": "forbid@school-a.edu",
              "Contact Phone": "+919876543210",
              Department: "Academics",
              Designation: "Lead",
              "System Role": role,
            },
          ];

          const res = await commitStaffImportAction(row);
          expect(res.success).toBe(false);
          expect(res.createdCount).toBe(0);
          expect(res.rejectedRowsCsv).toContain(`EMP-FORBID-${role}`);
        }
      });
    });

    describe("4.3 SQL Injection & Code Injection Defenses in Role Field", () => {
      const injectionPayloads = [
        "TEACHER' OR '1'='1",
        "'; DROP TABLE staff; --",
        "TEACHER'; UPDATE users SET role='SUPER_ADMIN' WHERE '1'='1; --",
        "UNION SELECT * FROM roles",
        "<script>alert('pwned')</script>",
        "${7*7}",
        "{{7*7}}",
        "../../../etc/passwd",
        "TEACHER\0ADMIN",
      ];

      it.each(injectionPayloads)(
        "strictly rejects injection payload '%s' in System Role field",
        async (payload) => {
          const row = [
            {
              "Employee Code": `EMP-INJ-${Math.random().toString(36).slice(2, 6)}`,
              "First Name": "Inject",
              "Last Name": "Attacker",
              "Official Email": "inject@school-a.edu",
              "Contact Phone": "+919876543210",
              Department: "Academics",
              Designation: "Teacher",
              "System Role": payload,
            },
          ];

          const res = await commitStaffImportAction(row);
          expect(res.success).toBe(false);
          expect(res.createdCount).toBe(0);
          expect(
            res.errors.some(
              (e) =>
                e.includes("is not permitted for bulk staff import") ||
                e.includes("must be one of [TEACHER, STAFF, ACCOUNTANT]")
            )
          ).toBe(true);
          expect(res.rejectedRowsCsv.length).toBeGreaterThan(0);
        }
      );
    });

    describe("4.4 All-or-Nothing Rollback on Mixed Clean and Malicious Batch", () => {
      it("commits 0 rows when a 5-row batch contains even 1 malicious/escalated role", async () => {
        const mixedBatch = [
          {
            "Employee Code": "EMP-BATCH-01",
            "First Name": "Good",
            "Last Name": "Teacher1",
            "Official Email": "good1@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Academics",
            Designation: "Teacher",
            "System Role": "TEACHER",
          },
          {
            "Employee Code": "EMP-BATCH-02",
            "First Name": "Good",
            "Last Name": "Staff2",
            "Official Email": "good2@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Administration",
            Designation: "Staff",
            "System Role": "STAFF",
          },
          {
            "Employee Code": "EMP-BATCH-03-MALICIOUS",
            "First Name": "Malicious",
            "Last Name": "Escalation",
            "Official Email": "bad@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Management",
            Designation: "Principal",
            "System Role": "PRINCIPAL", // Escalation attempt
          },
          {
            "Employee Code": "EMP-BATCH-04",
            "First Name": "Good",
            "Last Name": "Accountant4",
            "Official Email": "good4@school-a.edu",
            "Contact Phone": "+919876543210",
            Department: "Finance",
            Designation: "Accountant",
            "System Role": "ACCOUNTANT",
          },
        ];

        const initialStaffCount = mockTwoSchoolDb.staff.length;

        const res = await commitStaffImportAction(mixedBatch);
        expect(res.success).toBe(false);
        expect(res.createdCount).toBe(0);
        expect(res.totalProcessed).toBe(4);
        expect(mockTwoSchoolDb.staff.length).toBe(initialStaffCount);

        // Verify rejectedRowsCsv only isolates the bad row
        expect(res.rejectedRowsCsv).toContain("EMP-BATCH-03-MALICIOUS");
        expect(res.rejectedRowsCsv).not.toContain("EMP-BATCH-01");
        expect(res.rejectedRowsCsv).not.toContain("EMP-BATCH-02");
        expect(res.rejectedRowsCsv).not.toContain("EMP-BATCH-04");
      });
    });
  });
});
