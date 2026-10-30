import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// ─── 1. Mocks for React, Next Cache, Storage, Encryption, Auth ─────────────────
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

vi.mock("@/lib/storage", () => ({
  uploadBufferToS3: vi.fn(async () => ({ success: true })),
  getPresignedDownloadUrl: vi.fn(async () => "https://s3.example.com/logo.png"),
}));

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "mocked-bcrypt-hash"),
  },
  hash: vi.fn(async () => "mocked-bcrypt-hash"),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({
    ipAddress: "127.0.0.1",
    userAgent: "Vitest Day-One Walkthrough Runner",
  })),
}));

vi.mock("@/server/middleware/consent", () => ({
  assertConsent: vi.fn(async () => true),
}));

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache: vi.fn(async () => {}),
}));

// ─── 2. Multi-Tenant In-Memory Datastore & Session Context ───────────────────
const { activeSessionRef, mockDb } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "user-admin-1",
      role: "SCHOOL_ADMIN",
      schoolId: "school-day-one",
      email: "admin@dayone.edu",
    } as any,
  };

  const mockDb = {
    schoolId: "school-day-one",
    schools: [
      { id: "school-day-one", name: "Day-One Demonstration School" },
    ] as any[],
    academicYears: [
      { id: "ay-2026", schoolId: "school-day-one", label: "2026-27", isActive: true },
    ] as any[],
    classes: [
      { id: "cls-10", schoolId: "school-day-one", name: "Class 10", displayName: "Class 10", gradeLevel: "10", isActive: true },
    ] as any[],
    sections: [
      { id: "sec-10a", schoolId: "school-day-one", classId: "cls-10", name: "A", isActive: true },
    ] as any[],
    subjects: [
      { id: "sub-math", schoolId: "school-day-one", name: "Mathematics", code: "MATH-10", subjectType: "THEORY", isActive: true },
      { id: "sub-sci", schoolId: "school-day-one", name: "Science", code: "SCI-10", subjectType: "PRACTICAL", isActive: true },
      { id: "sub-eng", schoolId: "school-day-one", name: "English", code: "ENG-10", subjectType: "THEORY", isActive: true },
      { id: "sub-soc", schoolId: "school-day-one", name: "Social Studies", code: "SOC-10", subjectType: "THEORY", isActive: true },
      { id: "sub-hin", schoolId: "school-day-one", name: "Hindi", code: "HIN-10", subjectType: "THEORY", isActive: true },
      { id: "sub-pe", schoolId: "school-day-one", name: "Physical Education", code: "PE-10", subjectType: "PRACTICAL", isActive: true },
    ] as any[],
    classSubjects: [
      { id: "cs-math", schoolId: "school-day-one", classId: "cls-10", subjectId: "sub-math", weeklyPeriods: 6, periodsPerWeek: 6 },
      { id: "cs-sci", schoolId: "school-day-one", classId: "cls-10", subjectId: "sub-sci", weeklyPeriods: 6, periodsPerWeek: 6 },
      { id: "cs-eng", schoolId: "school-day-one", classId: "cls-10", subjectId: "sub-eng", weeklyPeriods: 6, periodsPerWeek: 6 },
      { id: "cs-soc", schoolId: "school-day-one", classId: "cls-10", subjectId: "sub-soc", weeklyPeriods: 5, periodsPerWeek: 5 },
      { id: "cs-hin", schoolId: "school-day-one", classId: "cls-10", subjectId: "sub-hin", weeklyPeriods: 5, periodsPerWeek: 5 },
      { id: "cs-pe", schoolId: "school-day-one", classId: "cls-10", subjectId: "sub-pe", weeklyPeriods: 2, periodsPerWeek: 2 },
    ] as any[],
    feeHeads: [
      { id: "fh-tuition", schoolId: "school-day-one", name: "Tuition Fee", isActive: true },
      { id: "fh-annual", schoolId: "school-day-one", name: "Annual Charges", isActive: true },
    ] as any[],
    feeStructures: [] as any[], // Initially unpriced -> operationalScore 0%
    salaryTemplates: [
      { id: "st-tgt", schoolId: "school-day-one", name: "TGT Grade", isActive: true },
    ] as any[],
    events: [
      { id: "ev-hol", schoolId: "school-day-one", title: "National Holiday", eventType: "HOLIDAY" },
    ] as any[],
    academicCalendarEvents: [] as any[],
    departments: [
      { id: "dept-acad", schoolId: "school-day-one", name: "Academics", isActive: true },
    ] as any[],
    designations: [
      { id: "desig-tgt", departmentId: "dept-acad", name: "TGT Mathematics", mappedRole: "TEACHER", isTeaching: true, schoolId: "school-day-one", isActive: true },
    ] as any[],
    roles: [
      { id: "role-teacher", schoolId: "school-day-one", name: "TEACHER", displayName: "Teacher" },
      { id: "role-accountant", schoolId: "school-day-one", name: "ACCOUNTANT", displayName: "Accountant" },
      { id: "role-staff", schoolId: "school-day-one", name: "STAFF", displayName: "Staff" },
    ] as any[],
    userRoles: [] as any[],
    schoolProvisions: [
      { id: "sp-1", schoolId: "school-day-one", blueprintVersion: "1.0.0", status: "COMPLETED", provisionedAt: new Date("2026-01-01"), entityCounts: {} },
    ] as any[],
    bellSchedule: [] as any[], // Initially empty -> operationalScore 0%
    timetablePeriods: [] as any[],
    sectionSubjectTeachers: [] as any[],
    classTeacherAssignments: [] as any[],
    students: [] as any[],
    staff: [] as any[],
    users: [
      { id: "user-admin-1", schoolId: "school-day-one", email: "admin@dayone.edu", passwordHash: "mocked" },
    ] as any[],
    persons: [] as any[],
    studentAttendance: [] as any[],
    studentLeaveRequests: [] as any[],
    timetableSubstitutions: [] as any[],
    domainEvents: [] as any[],
    auditLogs: [] as any[],
    existingAdmissionNumbers: new Set<string>(),
    existingEmployeeCodes: new Set<string>(),
  };

  return { activeSessionRef, mockDb };
});

// Helper to extract parameters from conditions
function extractParamsFromCondition(cond: any): string[] {
  if (!cond) return [];
  const results: string[] = [];
  const visited = new Set();
  function traverse(obj: any, depth = 0) {
    if (!obj || depth > 5 || visited.has(obj)) return;
    visited.add(obj);
    if (typeof obj === "string") {
      results.push(obj);
      return;
    }
    if (typeof obj === "number") {
      results.push(String(obj));
      return;
    }
    if (obj.value !== undefined && obj.value !== null) {
      results.push(String(obj.value));
    }
    if (Array.isArray(obj.queryChunks)) {
      for (const chunk of obj.queryChunks) traverse(chunk, depth + 1);
    }
    if (Array.isArray(obj)) {
      for (const item of obj) traverse(item, depth + 1);
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
    const user = activeSessionRef.current;
    if (!user) throw new Error("Unauthorized: No session");
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new Error(`Forbidden: Role '${user.role}' is not authorized`);
    }
    return {
      session: { user },
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
      email: user.email,
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    const targetSchoolId = ctx?.schoolId || activeSessionRef.current?.schoolId;
    const school = mockDb.schools.find((s) => s.id === targetSchoolId);
    if (!school) throw new Error("School not found");
    return school;
  }),
  checkAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    const user = activeSessionRef.current;
    if (!user) throw new Error("Unauthorized: No session");
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new Error(`Forbidden: Role '${user.role}' is not authorized`);
    }
    return { user };
  }),
}));

// ─── 4. Mock S13 Student Lifecycle Engine ─────────────────────────────────────
vi.mock("@schoolmitra/backend/lib/studentLifecycleEngine", () => ({
  StudentLifecycleEngine: {
    createImportedStudent: vi.fn(async (schoolId: string, input: any) => {
      if (mockDb.existingAdmissionNumbers.has(input.admissionNumber)) {
        return { isNew: false, studentId: `existing-${input.admissionNumber}`, admissionNumber: input.admissionNumber };
      }
      const newStudent = {
        id: `student-${input.admissionNumber}`,
        schoolId,
        currentSectionId: input.sectionId,
        admissionNumber: input.admissionNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        isActive: true,
      };
      mockDb.students.push(newStudent);
      mockDb.existingAdmissionNumbers.add(input.admissionNumber);
      return { isNew: true, studentId: newStudent.id, admissionNumber: input.admissionNumber };
    }),
  },
}));

// Helper to resolve table name from Drizzle table or mock
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

// ─── 5. Mock Database Layer (Queries, Transactions, Updates, Selects) ─────────
vi.mock("@/db", () => {
  const createQueryHandlers = () => {
    const explicitHandlers = {
      schools: {
        findFirst: vi.fn(async () =>
          mockDb.schools.find((s) => s.id === activeSessionRef.current?.schoolId) || null
        ),
        findMany: vi.fn(async () => mockDb.schools),
      },
      schoolProvisions: {
        findFirst: vi.fn(async () =>
          mockDb.schoolProvisions.find((p) => p.schoolId === activeSessionRef.current?.schoolId) || null
        ),
        findMany: vi.fn(async () => mockDb.schoolProvisions),
      },
      academicYears: {
        findFirst: vi.fn(async () =>
          mockDb.academicYears.find((ay) => ay.schoolId === activeSessionRef.current?.schoolId && ay.isActive) || null
        ),
        findMany: vi.fn(async () =>
          mockDb.academicYears.filter((ay) => ay.schoolId === activeSessionRef.current?.schoolId)
        ),
      },
      classes: {
        findFirst: vi.fn(async () => mockDb.classes[0] || null),
        findMany: vi.fn(async () =>
          mockDb.classes.filter((c) => c.schoolId === activeSessionRef.current?.schoolId && c.isActive)
        ),
      },
      sections: {
        findFirst: vi.fn(async ({ where }: any) => {
          const sec = mockDb.sections.find((s) => s.schoolId === activeSessionRef.current?.schoolId && s.isActive);
          if (!sec) return null;
          return {
            ...sec,
            class: mockDb.classes.find((c) => c.id === sec.classId) || null,
          };
        }),
        findMany: vi.fn(async () => {
          return mockDb.sections
            .filter((s) => s.schoolId === activeSessionRef.current?.schoolId && s.isActive)
            .map((sec) => ({
              ...sec,
              class: mockDb.classes.find((c) => c.id === sec.classId) || null,
            }));
        }),
      },
      subjects: {
        findFirst: vi.fn(async () => mockDb.subjects[0] || null),
        findMany: vi.fn(async () =>
          mockDb.subjects.filter((s) => s.schoolId === activeSessionRef.current?.schoolId && s.isActive)
        ),
      },
      classSubjects: {
        findFirst: vi.fn(async ({ where }: any) => {
          const schoolId = activeSessionRef.current?.schoolId;
          const params = extractParamsFromCondition(where);
          const cs = mockDb.classSubjects.find(
            (c) => c.schoolId === schoolId && (params.length === 0 || params.includes(c.id) || params.includes(c.subjectId))
          ) || mockDb.classSubjects[0];
          if (!cs) return null;
          return {
            ...cs,
            subject: mockDb.subjects.find((sub) => sub.id === cs.subjectId) || null,
          };
        }),
        findMany: vi.fn(async () => {
          return mockDb.classSubjects
            .filter((cs) => cs.schoolId === activeSessionRef.current?.schoolId)
            .map((cs) => ({
              ...cs,
              subject: mockDb.subjects.find((sub) => sub.id === cs.subjectId) || null,
            }));
        }),
      },
      bellSchedule: {
        findFirst: vi.fn(async () => mockDb.bellSchedule[0] || null),
        findMany: vi.fn(async () => {
          return mockDb.bellSchedule
            .filter((b) => b.schoolId === activeSessionRef.current?.schoolId && b.isActive)
            .sort((a, b) => a.periodNumber - b.periodNumber);
        }),
      },
      timetablePeriods: {
        findFirst: vi.fn(async ({ where }: any = {}) => {
          const schoolId = activeSessionRef.current?.schoolId;
          const params = extractParamsFromCondition(where);

          const dayOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].find((d) =>
            params.includes(d)
          );
          const periodNumStr = ["1", "2", "3", "4", "5", "6", "7", "8"].find((n) => params.includes(n));
          const periodNum = periodNumStr ? parseInt(periodNumStr, 10) : undefined;

          if (dayOfWeek && periodNum !== undefined) {
            if (params.includes("user-teacher-math")) {
              const conflict = mockDb.timetablePeriods.find(
                (p) =>
                  p.schoolId === schoolId &&
                  p.isActive &&
                  p.dayOfWeek === dayOfWeek &&
                  p.periodNumber === periodNum &&
                  p.teacherId === "user-teacher-math"
              );
              return conflict || null;
            }
            const existing = mockDb.timetablePeriods.find(
              (p) => p.schoolId === schoolId && p.dayOfWeek === dayOfWeek && p.periodNumber === periodNum
            );
            return existing || null;
          }

          return null;
        }),
        findMany: vi.fn(async ({ where }: any = {}) => {
          const schoolId = activeSessionRef.current?.schoolId;
          const params = extractParamsFromCondition(where);

          let matching = mockDb.timetablePeriods.filter((p) => p.schoolId === schoolId && p.isActive);

          const dayOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].find((d) =>
            params.includes(d)
          );
          if (dayOfWeek) {
            matching = matching.filter((p) => p.dayOfWeek === dayOfWeek);
          }
          if (params.includes("user-teacher-math")) {
            matching = matching.filter((p) => p.teacherId === "user-teacher-math");
          }

          return matching
            .sort((a, b) => a.periodNumber - b.periodNumber)
            .map((p) => {
              const sec = mockDb.sections.find((s) => s.id === p.sectionId);
              const cls = sec ? mockDb.classes.find((c) => c.id === sec.classId) : null;
              const sub = mockDb.subjects.find((s) => s.id === p.subjectId);
              return {
                ...p,
                section: sec ? { ...sec, class: cls } : null,
                subject: sub || null,
              };
            });
        }),
      },
      sectionSubjectTeachers: {
        findFirst: vi.fn(async () => {
          const sst = mockDb.sectionSubjectTeachers.find(
            (s) => s.schoolId === activeSessionRef.current?.schoolId && s.isActive
          );
          if (!sst) return null;
          const sec = mockDb.sections.find((s) => s.id === sst.sectionId);
          const cls = sec ? mockDb.classes.find((c) => c.id === sec.classId) : null;
          const cs = mockDb.classSubjects.find((c) => c.id === sst.classSubjectId);
          const sub = cs ? mockDb.subjects.find((s) => s.id === cs.subjectId) : null;
          return {
            ...sst,
            section: sec ? { ...sec, class: cls } : null,
            classSubject: cs ? { ...cs, subject: sub } : null,
          };
        }),
        findMany: vi.fn(async () => {
          const schoolId = activeSessionRef.current?.schoolId;
          return mockDb.sectionSubjectTeachers
            .filter((sst) => sst.schoolId === schoolId && sst.isActive)
            .map((sst) => {
              const sec = mockDb.sections.find((s) => s.id === sst.sectionId);
              const cls = sec ? mockDb.classes.find((c) => c.id === sec.classId) : null;
              const cs = mockDb.classSubjects.find((c) => c.id === sst.classSubjectId);
              const sub = cs ? mockDb.subjects.find((s) => s.id === cs.subjectId) : null;
              return {
                ...sst,
                section: sec ? { ...sec, class: cls } : null,
                classSubject: cs ? { ...cs, subject: sub } : null,
              };
            });
        }),
      },
      classTeacherAssignments: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => mockDb.classTeacherAssignments),
      },
      academicCalendarEvents: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => mockDb.academicCalendarEvents),
      },
      feeHeads: {
        findFirst: vi.fn(async () => mockDb.feeHeads[0] || null),
        findMany: vi.fn(async () =>
          mockDb.feeHeads.filter((fh) => fh.schoolId === activeSessionRef.current?.schoolId && fh.isActive)
        ),
      },
      feeStructures: {
        findFirst: vi.fn(async () => mockDb.feeStructures[0] || null),
        findMany: vi.fn(async () =>
          mockDb.feeStructures.filter((fs) => fs.schoolId === activeSessionRef.current?.schoolId && fs.isActive)
        ),
      },
      salaryTemplates: {
        findFirst: vi.fn(async () => mockDb.salaryTemplates[0] || null),
        findMany: vi.fn(async () =>
          mockDb.salaryTemplates.filter((st) => st.schoolId === activeSessionRef.current?.schoolId && st.isActive)
        ),
      },
      departments: {
        findFirst: vi.fn(async () => mockDb.departments[0] || null),
        findMany: vi.fn(async () =>
          mockDb.departments.filter((d) => d.schoolId === activeSessionRef.current?.schoolId && d.isActive)
        ),
      },
      designations: {
        findFirst: vi.fn(async () => mockDb.designations[0] || null),
        findMany: vi.fn(async () =>
          mockDb.designations.filter((d) => d.schoolId === activeSessionRef.current?.schoolId && d.isActive)
        ),
      },
      roles: {
        findFirst: vi.fn(async () => mockDb.roles[0] || null),
        findMany: vi.fn(async () => mockDb.roles),
      },
      users: {
        findFirst: vi.fn(async () => mockDb.users[0] || null),
        findMany: vi.fn(async () => mockDb.users),
      },
      staff: {
        findFirst: vi.fn(async () => mockDb.staff[0] || null),
        findMany: vi.fn(async () =>
          Array.from(mockDb.existingEmployeeCodes).map((code) => ({ employeeCode: code }))
        ),
      },
      students: {
        findFirst: vi.fn(async () => mockDb.students[0] || null),
        findMany: vi.fn(async () =>
          mockDb.students.filter((st) => st.schoolId === activeSessionRef.current?.schoolId && st.isActive)
        ),
      },
      studentAttendance: {
        findFirst: vi.fn(async () => mockDb.studentAttendance[0] || null),
        findMany: vi.fn(async () =>
          mockDb.studentAttendance.filter((sa) => sa.schoolId === activeSessionRef.current?.schoolId)
        ),
      },
      studentLeaveRequests: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => mockDb.studentLeaveRequests),
      },
      timetableSubstitutions: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => mockDb.timetableSubstitutions),
      },
      assignments: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      assignmentSubmissions: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      exams: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      markEntries: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      ptmSlots: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      ptmBookings: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    };

    return new Proxy(explicitHandlers, {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
        };
      },
    });
  };

  const dbClient = {
    query: createQueryHandlers(),
    execute: vi.fn(async () => [
      {
        current_user: "schoolmitra",
        active_role: "schoolmitra_app",
        school_id: activeSessionRef.current?.schoolId,
      },
    ]),
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        query: createQueryHandlers(),
        execute: vi.fn(async () => []),
        insert: (tbl: any) => ({
          values: (val: any) => {
            const tableName = resolveTableName(tbl);
            const items = Array.isArray(val) ? val : [val];
            const created: any[] = [];
            for (const item of items) {
              const row = { id: item.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...item };
              if (tableName.includes("bell_schedule")) {
                mockDb.bellSchedule.push({ isActive: true, ...row });
              } else if (tableName.includes("timetable_periods")) {
                const rowToInsert = {
                  ...row,
                  isActive: row.isActive !== undefined ? row.isActive : true,
                };
                const existingIdx = mockDb.timetablePeriods.findIndex(
                  (p) => p.sectionId === rowToInsert.sectionId && p.dayOfWeek === rowToInsert.dayOfWeek && p.periodNumber === rowToInsert.periodNumber
                );
                if (existingIdx >= 0) {
                  mockDb.timetablePeriods[existingIdx] = { ...mockDb.timetablePeriods[existingIdx], ...rowToInsert };
                } else {
                  mockDb.timetablePeriods.push(rowToInsert);
                }
              } else if (tableName.includes("student_attendance")) {
                mockDb.studentAttendance.push(row);
              } else if (tableName.includes("domain_events")) {
                mockDb.domainEvents.push(row);
              } else if (tableName.includes("staff")) {
                mockDb.staff.push(row);
                if (row.employeeCode) mockDb.existingEmployeeCodes.add(row.employeeCode.trim().toLowerCase());
              } else if (tableName.includes("persons")) {
                mockDb.persons.push(row);
              } else if (tableName.includes("users")) {
                mockDb.users.push(row);
              } else if (tableName.includes("audit_logs")) {
                mockDb.auditLogs.push(row);
              }
              created.push(row);
            }
            return {
              returning: async () => created,
              then: (resolve: any) => Promise.resolve(created).then(resolve),
            };
          },
        }),
        update: (tbl: any) => ({
          set: (vals: any) => ({
            where: vi.fn(async (cond: any) => {
              const tableName = resolveTableName(tbl);
              if (tableName.includes("school_provisions")) {
                if (mockDb.schoolProvisions[0]) {
                  mockDb.schoolProvisions[0].entityCounts = vals.entityCounts || {};
                }
              }
              if (tableName.includes("timetable_periods")) {
                const params = extractParamsFromCondition(cond);
                for (const p of mockDb.timetablePeriods) {
                  if (params.length === 0 || params.includes(p.id)) {
                    Object.assign(p, vals);
                  }
                }
              }
              return { rowCount: 1 };
            }),
          }),
        }),
        select: vi.fn((fields: any) => {
          let targetTable = "";
          const chain: any = {
            from: vi.fn((tbl: any) => {
              targetTable = resolveTableName(tbl);
              return chain;
            }),
            innerJoin: vi.fn(() => chain),
            where: vi.fn(() => chain),
            limit: vi.fn(() => chain),
            then: (resolve: any) => {
              if (fields && fields.count !== undefined) {
                return Promise.resolve([{ count: 1 }]).then(resolve);
              }
              if (targetTable.includes("students")) {
                return Promise.resolve(mockDb.students.map((s) => ({ id: s.id }))).then(resolve);
              }
              if (targetTable.includes("sections")) {
                return Promise.resolve([{ sectionName: "A", className: "Class 10" }]).then(resolve);
              }
              if (targetTable.includes("student_attendance")) {
                return Promise.resolve(mockDb.studentAttendance).then(resolve);
              }
              if (targetTable.includes("student_leave_requests")) {
                return Promise.resolve([]).then(resolve);
              }
              return Promise.resolve([]).then(resolve);
            },
          };
          return chain;
        }),
      };
      return cb(tx);
    }),
    insert: (tbl: any) => ({
      values: (val: any) => {
        const tableName = resolveTableName(tbl);
        const items = Array.isArray(val) ? val : [val];
        const created: any[] = [];
        for (const item of items) {
          const row = { id: item.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...item };
          if (tableName.includes("bell_schedule")) {
            mockDb.bellSchedule.push({ isActive: true, ...row });
          } else if (tableName.includes("timetable_periods")) {
            const rowToInsert = {
              ...row,
              isActive: row.isActive !== undefined ? row.isActive : true,
            };
            const existingIdx = mockDb.timetablePeriods.findIndex(
              (p) => p.sectionId === rowToInsert.sectionId && p.dayOfWeek === rowToInsert.dayOfWeek && p.periodNumber === rowToInsert.periodNumber
            );
            if (existingIdx >= 0) {
              mockDb.timetablePeriods[existingIdx] = { ...mockDb.timetablePeriods[existingIdx], ...rowToInsert };
            } else {
              mockDb.timetablePeriods.push(rowToInsert);
            }
          } else if (tableName.includes("student_attendance")) {
            mockDb.studentAttendance.push(row);
          } else if (tableName.includes("domain_events")) {
            mockDb.domainEvents.push(row);
          } else if (tableName.includes("staff")) {
            mockDb.staff.push(row);
            if (row.employeeCode) mockDb.existingEmployeeCodes.add(row.employeeCode.trim().toLowerCase());
          } else if (tableName.includes("users")) {
            mockDb.users.push(row);
          } else if (tableName.includes("persons")) {
            mockDb.persons.push(row);
          } else if (tableName.includes("fee_structures")) {
            mockDb.feeStructures.push(row);
          }
          created.push(row);
        }
        return {
          returning: async () => created,
          then: (resolve: any) => Promise.resolve(created).then(resolve),
        };
      },
    }),
    update: (tbl: any) => ({
      set: (vals: any) => ({
        where: vi.fn(async (cond: any) => {
          const tableName = resolveTableName(tbl);
          if (tableName.includes("timetable_periods")) {
            const params = extractParamsFromCondition(cond);
            for (const p of mockDb.timetablePeriods) {
              if (params.length === 0 || params.includes(p.id)) {
                Object.assign(p, vals);
              }
            }
          }
          return { rowCount: 1 };
        }),
      }),
    }),
    select: vi.fn((fields: any) => {
      let targetTable = "";
      const chain: any = {
        from: vi.fn((tbl: any) => {
          targetTable = resolveTableName(tbl);
          return chain;
        }),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (resolve: any) => {
          const schoolId = activeSessionRef.current?.schoolId;
          let count = 0;

          if (targetTable.includes("academic_years")) {
            count = mockDb.academicYears.filter((y) => y.schoolId === schoolId && y.isActive).length;
          } else if (targetTable.includes("classes")) {
            count = mockDb.classes.filter((c) => c.schoolId === schoolId && c.isActive).length;
          } else if (targetTable.includes("sections")) {
            count = mockDb.sections.filter((s) => s.schoolId === schoolId && s.isActive).length;
          } else if (targetTable.includes("subjects")) {
            count = mockDb.subjects.filter((s) => s.schoolId === schoolId && s.isActive).length;
          } else if (targetTable.includes("fee_heads")) {
            count = mockDb.feeHeads.filter((f) => f.schoolId === schoolId && f.isActive).length;
          } else if (targetTable.includes("fee_structures")) {
            const pricedHeadIds = new Set(
              mockDb.feeStructures
                .filter((fs) => fs.schoolId === schoolId && fs.isActive && Number(fs.amount) > 0)
                .map((fs) => fs.feeHeadId)
            );
            count = pricedHeadIds.size;
          } else if (targetTable.includes("salary_templates")) {
            count = mockDb.salaryTemplates.filter((s) => s.schoolId === schoolId && s.isActive).length;
          } else if (targetTable.includes("events")) {
            count = mockDb.events.filter((e) => e.schoolId === schoolId && e.eventType === "HOLIDAY").length;
          } else if (targetTable.includes("bell_schedule")) {
            count = mockDb.bellSchedule.filter((b) => b.schoolId === schoolId && b.isActive).length;
          } else if (targetTable.includes("timetable_periods")) {
            const distinctSections = new Set(
              mockDb.timetablePeriods
                .filter((t) => t.schoolId === schoolId && t.isActive)
                .map((t) => t.sectionId)
            );
            count = distinctSections.size;
          } else if (targetTable.includes("section_subject_teachers")) {
            count = mockDb.sectionSubjectTeachers.filter((sst) => sst.schoolId === schoolId && sst.isActive).length;
          } else if (targetTable.includes("students")) {
            count = mockDb.students.filter((st) => st.schoolId === schoolId && st.isActive).length;
          }

          if (fields && fields.count !== undefined) {
            return Promise.resolve([{ count }]).then(resolve);
          }

          if (targetTable.includes("students")) {
            return Promise.resolve(mockDb.students.map((s) => ({ id: s.id }))).then(resolve);
          }
          if (targetTable.includes("sections")) {
            return Promise.resolve([{ sectionName: "A", className: "Class 10" }]).then(resolve);
          }
          if (targetTable.includes("student_attendance")) {
            return Promise.resolve(mockDb.studentAttendance).then(resolve);
          }
          if (targetTable.includes("student_leave_requests")) {
            return Promise.resolve([]).then(resolve);
          }

          return Promise.resolve([{ count }]).then(resolve);
        },
      };
      return chain;
    }),
  };

  return {
    db: dbClient,
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      return cb(dbClient);
    }),
  };
});

// ─── 6. Real Server Actions & Domain Engines ──────────────────────────────────
import { topUpSchoolProvision } from "@/lib/provisioningEngine";
import {
  generateSectionTimetablePreview,
  commitSectionTimetable,
} from "@/app/(admin)/academics/actions/timetable.actions";
import {
  commitStaffImportAction,
  commitStudentImportAction,
} from "@/app/(admin)/school/import-center/actions";
import { resolveTeacherScope } from "@/lib/teacherEventEngine/scopeResolver";
import { assembleTeacherSnapshot } from "@/lib/teacherEventEngine/snapshotAssembler";
import { saveTeacherAttendanceRoster } from "@/app/(teacher)/teacher/attendance/attendanceActions";
import { deriveParentFeed } from "@schoolmitra/backend/lib/parentEventEngine/deriveParentFeed";
import { getSchoolConfigurationHealthAction } from "@/app/(admin)/settings/school-setup/actions";

// ─── Day-One Integration Suite ────────────────────────────────────────────────
describe("Sprint 21 Milestone 6: Executable Day-One Operational Walkthrough Integration Suite", () => {
  beforeEach(() => {
    activeSessionRef.current = {
      userId: "user-admin-1",
      role: "SCHOOL_ADMIN",
      schoolId: "school-day-one",
      email: "admin@dayone.edu",
    };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 & STEP 9 (Initial Baseline): Setup Hub Reports 0% Operational Readiness
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 9 (Initial Baseline): Setup Hub reports 0% operational readiness before walkthrough setup", async () => {
    const health = await getSchoolConfigurationHealthAction();

    // Configuration score has basic classes, subjects, fee heads defined (100% config)
    expect(health.configurationScore).toBe(100);

    // But operational score is strictly 0% because no bell periods, timetables, fee prices, allocations, or students exist
    expect(health.operationalScore).toBe(0);
    expect(health.isOperationallyReady).toBe(false);

    // Verify all 5 operational milestones are incomplete
    expect(health.operationalMilestones).toHaveLength(5);
    for (const milestone of health.operationalMilestones) {
      expect(milestone.isComplete).toBe(false);
    }
    // Fee pricing reflects PARTIAL clamp because fee heads exist but 0 are priced
    const feeMilestone = health.operationalMilestones.find((m) => m.key === "feePricing");
    expect(feeMilestone?.status).toBe("PARTIAL");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Bell Schedule Provisioning / Top-Up
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 1: Top-up bell schedule adds 8 blueprint periods without breaching unique lock", async () => {
    const result = await topUpSchoolProvision("school-day-one", "cbse-secondary-v1");

    expect(result.success).toBe(true);
    expect(result.addedCount).toBe(8);
    expect(mockDb.bellSchedule).toHaveLength(8);

    // Verify entityCounts in schoolProvisions was updated idempotently
    expect(mockDb.schoolProvisions[0].entityCounts.bellSchedulePeriods).toBe(8);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Bell Schedule Active Periods 1..8
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 2: Bell Schedule contains active periods 1..8 with proper start/end timings", async () => {
    expect(mockDb.bellSchedule.length).toBe(8);

    // Verify Period 1 is active with CBSE secondary timing
    const period1 = mockDb.bellSchedule.find((p) => p.periodNumber === 1);
    expect(period1).toBeDefined();
    expect(period1.periodType).toBe("REGULAR");
    expect(period1.isActive).toBe(true);
    expect(period1.startTime).toBe("08:20");

    // Verify Period 8 ends the instructional day
    const period8 = mockDb.bellSchedule.find((p) => p.periodNumber === 8);
    expect(period8).toBeDefined();
    expect(period8.name).toContain("Period 8");
    expect(period8.isActive).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Teacher Auto-Assignment Allocation (Executed before generation)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 4: Active teacher allocation establishes unique teacher for Class 10-A Mathematics", async () => {
    // Add unique teacher allocation for Mathematics in Section 10-A
    const mathAllocation = {
      id: "sst-math-1",
      schoolId: "school-day-one",
      academicYearId: "ay-2026",
      sectionId: "sec-10a",
      classSubjectId: "cs-math",
      teacherId: "user-teacher-math",
      isPrimary: true,
      isActive: true,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    };
    mockDb.sectionSubjectTeachers.push(mathAllocation);

    expect(mockDb.sectionSubjectTeachers).toHaveLength(1);
    expect(mockDb.sectionSubjectTeachers[0].teacherId).toBe("user-teacher-math");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Timetable Generation Preview & Conflict-Enforced Commit
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 3: Timetable generation preview auto-assigns teacher and commits conflict-enforced slots", async () => {
    // Generate deterministic preview for Section 10-A
    const preview = await generateSectionTimetablePreview("sec-10a");

    expect(preview.fits).toBe(true);
    expect(preview.clashes).toHaveLength(0);
    expect(preview.slots.length).toBeGreaterThan(0);

    // Verify auto-assignment of teacher for Mathematics slots (since exactly 1 allocation exists)
    const mathSlots = preview.slots.filter((s) => s.subjectId === "cs-math");
    expect(mathSlots.length).toBeGreaterThan(0);
    expect(mathSlots.every((s) => s.teacherId === "user-teacher-math")).toBe(true);

    // Verify unassigned subjects are captured in needsAssignmentReport
    const unallocatedSlots = preview.slots.filter((s) => s.subjectId !== "cs-math");
    expect(unallocatedSlots.every((s) => s.teacherId === undefined)).toBe(true);
    expect(preview.needsAssignmentReport.length).toBeGreaterThan(0);

    // Commit slots through conflict-enforced saveTimetablePeriod path
    const commitResult = await commitSectionTimetable("sec-10a", preview.slots);
    expect(commitResult.success).toBe(true);
    expect(commitResult.upsertedCount).toBe(preview.slots.length);
    expect(mockDb.timetablePeriods.length).toBe(preview.slots.length);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Real Staff and Student Import Commits (Idempotent & Domain-Guarded)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 5: Real staff and student import commits succeed with role clamping and S13 lifecycle delegation", async () => {
    // 5a. Staff Import: Clamps roles, rejects admin/principal, creates real staff
    const invalidStaffBatch = [
      {
        "Employee Code": "EMP-2026-P1",
        "First Name": "Sunita",
        "Last Name": "Verma",
        "Official Email": "sunita.verma@dayone.edu",
        "Contact Phone": "+919876543211",
        "Department": "Academics",
        "Designation": "Principal",
        "System Role": "PRINCIPAL", // Disallowed role!
      },
    ];
    const invalidStaffRes = await commitStaffImportAction(invalidStaffBatch);
    expect(invalidStaffRes.success).toBe(false);
    expect(invalidStaffRes.rejectedRowsCsv).toBeDefined();
    expect(invalidStaffRes.errors?.[0]).toContain("PRINCIPAL");

    // Valid Staff Import: Role TEACHER
    const validStaffBatch = [
      {
        "Employee Code": "EMP-2026-T1",
        "First Name": "Kavita",
        "Last Name": "Raman",
        "Official Email": "kavita.raman@dayone.edu",
        "Contact Phone": "+919876543210",
        "Department": "Academics",
        "Designation": "TGT Mathematics",
        "System Role": "TEACHER",
      },
    ];
    const staffRes = await commitStaffImportAction(validStaffBatch);
    expect(staffRes.success).toBe(true);
    expect(staffRes.createdCount).toBe(1);
    expect(staffRes.skippedCount).toBe(0);
    expect(mockDb.staff.length).toBe(1);

    // 5b. Student Import: Delegates to S13 StudentLifecycleEngine.createImportedStudent
    const validStudentBatch = [
      {
        "Admission Number": "ADM-2026-101",
        "First Name": "Aarav",
        "Last Name": "Sharma",
        "Class Name": "Class 10",
        "Section": "A",
        "Date of Birth (YYYY-MM-DD)": "2010-05-15",
        "Gender": "MALE",
        "Parent / Guardian Name": "Rajesh Sharma",
        "Parent Phone": "9876543210",
      },
    ];
    const studentRes = await commitStudentImportAction(validStudentBatch);
    expect(studentRes.success).toBe(true);
    expect(studentRes.createdCount).toBe(1);
    expect(studentRes.skippedCount).toBe(0);
    expect(mockDb.students.length).toBe(1);

    // Idempotent re-import skips existing admission number truthfully
    const reImportRes = await commitStudentImportAction(validStudentBatch);
    expect(reImportRes.success).toBe(true);
    expect(reImportRes.createdCount).toBe(0);
    expect(reImportRes.skippedCount).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Teacher My Day Resolves Period 1 on Monday Morning
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 6: Teacher My Day resolves real Period 1 (Class 10-A Mathematics) from committed timetable", async () => {
    // Switch session to Teacher Kavita Raman
    activeSessionRef.current = {
      userId: "user-teacher-math",
      role: "TEACHER",
      schoolId: "school-day-one",
      email: "kavita.raman@dayone.edu",
    };

    // Monday morning 08:35 AM (2026-11-02 is a Monday)
    const mondayMorning = new Date("2026-11-02T08:35:00Z");

    // 1. Resolve scope
    const scope = await resolveTeacherScope("user-teacher-math", { schoolId: "school-day-one" });
    expect(scope.teachingSections.some((ts) => ts.sectionId === "sec-10a")).toBe(true);

    // 2. Assemble snapshot for Monday morning
    const snapshot = await assembleTeacherSnapshot("school-day-one", "user-teacher-math", mondayMorning);
    expect(snapshot.timetableToday).toBeDefined();
    expect(snapshot.timetableToday!.length).toBeGreaterThan(0);

    // Verify Period 1 is resolved with exact subject, section, and class
    const period1 = snapshot.timetableToday!.find((p) => p.periodNumber === 1);
    expect(period1).toBeDefined();
    expect(period1?.subjectName).toBe("Mathematics");
    expect(period1?.sectionName).toBe("A");
    expect(period1?.className).toBe("Class 10");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: Period 1 Attendance Marking
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 7: Teacher marks Period 1 attendance, persisting record and emitting AttendanceMarkedEvent", async () => {
    activeSessionRef.current = {
      userId: "user-teacher-math",
      role: "TEACHER",
      schoolId: "school-day-one",
      email: "kavita.raman@dayone.edu",
    };

    const p1Slot = mockDb.timetablePeriods.find((p) => p.periodNumber === 1 && p.sectionId === "sec-10a");
    expect(p1Slot).toBeDefined();

    const student = mockDb.students[0];
    expect(student).toBeDefined();

    // Mark Period 1 attendance for student
    const attResult = await saveTeacherAttendanceRoster({
      sectionId: "sec-10a",
      dateStr: "2026-11-02",
      periodId: p1Slot.id,
      records: [{ studentId: student.id, status: "PRESENT" }],
    });

    expect(attResult.success).toBe(true);
    expect(attResult.counts.present).toBe(1);
    expect(attResult.counts.absent).toBe(0);

    // Verify attendance was written with periodId set
    expect(mockDb.studentAttendance.length).toBe(1);
    expect(mockDb.studentAttendance[0].periodId).toBe(p1Slot.id);
    expect(mockDb.studentAttendance[0].status).toBe("PRESENT");

    // Verify AttendanceMarkedEvent was emitted to outbox
    const attendanceEvent = mockDb.domainEvents.find((e) => e.eventType === "AttendanceMarkedEvent");
    expect(attendanceEvent).toBeDefined();
    expect(attendanceEvent.payload.periodId).toBe(p1Slot.id);
    expect(attendanceEvent.payload.totalPresent).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 8: Parent Feed Reflection & Zero-Clutter Invariant
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 8: Parent feed reflects attendance and honors Zero-Clutter Invariant", async () => {
    const student = mockDb.students[0];
    const now = new Date("2026-11-02T09:00:00Z");

    // Branch A: Student marked PRESENT -> Zero-Clutter Calm State (no alarm cards)
    const calmCards = deriveParentFeed(student.id, now, {
      studentName: "Aarav Sharma",
      attendanceToday: { status: "PRESENT", markedAt: now },
      invoices: [],
    });
    // In calm state with attendance present and no unpaid fees, returns empty array
    expect(calmCards).toHaveLength(0);

    // Branch B: Student marked ABSENT -> Immediate T1 Action Required Card
    const absentCards = deriveParentFeed(student.id, now, {
      studentName: "Aarav Sharma",
      attendanceToday: { status: "ABSENT", markedAt: now },
      invoices: [],
    });
    expect(absentCards).toHaveLength(1);
    const card = absentCards[0]!;
    expect(card.cardType).toBe("AttendanceCard");
    expect(card.tier).toBe("T1_action_required");
    expect(card.priority).toBe(90);
    expect(card.title.en).toBe("Aarav Sharma marked Absent");
    expect(card.title.hi).toBe("Aarav Sharma को अनुपस्थित दर्ज किया गया");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 9 (Final Target): Setup Hub Operational Score Reaches 100%
  // ─────────────────────────────────────────────────────────────────────────────
  it("Step 9 (Final Target): Setup Hub operational score reaches 100% with all 5 operational milestones green", async () => {
    // Price all active fee heads to satisfy Milestone 3
    mockDb.feeStructures = [
      { id: "fs-1", schoolId: "school-day-one", feeHeadId: "fh-tuition", amount: "5000", isActive: true },
      { id: "fs-2", schoolId: "school-day-one", feeHeadId: "fh-annual", amount: "12000", isActive: true },
    ];

    // Reset session to Admin
    activeSessionRef.current = {
      userId: "user-admin-1",
      role: "SCHOOL_ADMIN",
      schoolId: "school-day-one",
      email: "admin@dayone.edu",
    };

    const health = await getSchoolConfigurationHealthAction();

    expect(health.configurationScore).toBe(100);
    expect(health.operationalScore).toBe(100);
    expect(health.isOperationallyReady).toBe(true);

    // Verify all 5 operational milestones are now COMPLETE
    expect(health.operationalMilestones).toHaveLength(5);
    for (const milestone of health.operationalMilestones) {
      expect(milestone.isComplete).toBe(true);
      expect(milestone.status).toBe("COMPLETE");
    }

    const bellMilestone = health.operationalMilestones.find((m) => m.key === "bellSchedulePeriods");
    expect(bellMilestone?.metric).toBe("8 Periods Active");

    const timetableMilestone = health.operationalMilestones.find((m) => m.key === "sectionsWithTimetable");
    expect(timetableMilestone?.metric).toBe("1/1 Sections Scheduled");

    const feeMilestone = health.operationalMilestones.find((m) => m.key === "feePricing");
    expect(feeMilestone?.metric).toBe("2/2 Heads Priced");

    const teacherMilestone = health.operationalMilestones.find((m) => m.key === "teacherAllocations");
    expect(teacherMilestone?.metric).toBe("1 Active Allocations");

    const studentMilestone = health.operationalMilestones.find((m) => m.key === "studentEnrollment");
    expect(studentMilestone?.metric).toBe("1 Enrolled Students");
  });
});
