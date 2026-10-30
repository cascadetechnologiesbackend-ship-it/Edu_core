import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// ─── 1. Core Framework Mocks ─────────────────────────────────────────────────
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
    userAgent: "Vitest M6 Challenger Runner",
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
      schoolId: "school-adv-1",
      email: "admin@adv1.edu",
    } as any,
  };

  const mockDb = {
    schools: [
      { id: "school-adv-1", name: "School Alpha (Primary Tenant)" },
      { id: "school-adv-2", name: "School Beta (Foreign Tenant)" },
    ] as any[],
    academicYears: [
      { id: "ay-adv-1", schoolId: "school-adv-1", label: "2026-27", isActive: true },
      { id: "ay-adv-2", schoolId: "school-adv-2", label: "2026-27", isActive: true },
    ] as any[],
    classes: [
      { id: "cls-10", schoolId: "school-adv-1", name: "Class 10", displayName: "Class 10", gradeLevel: "10", isActive: true },
      { id: "cls-beta-10", schoolId: "school-adv-2", name: "Class 10", displayName: "Class 10", gradeLevel: "10", isActive: true },
    ] as any[],
    sections: [
      { id: "sec-10a", schoolId: "school-adv-1", classId: "cls-10", name: "A", classTeacherId: "user-teacher-1", isActive: true },
      { id: "sec-10b", schoolId: "school-adv-1", classId: "cls-10", name: "B", classTeacherId: "user-teacher-other", isActive: true },
      { id: "sec-beta-10a", schoolId: "school-adv-2", classId: "cls-beta-10", name: "A", classTeacherId: "user-beta-teacher", isActive: true },
    ] as any[],
    subjects: [
      { id: "sub-math", schoolId: "school-adv-1", name: "Mathematics", code: "MATH-10", subjectType: "THEORY", isActive: true },
      { id: "sub-sci", schoolId: "school-adv-1", name: "Science", code: "SCI-10", subjectType: "PRACTICAL", isActive: true },
    ] as any[],
    classSubjects: [
      { id: "cs-math", schoolId: "school-adv-1", classId: "cls-10", subjectId: "sub-math", weeklyPeriods: 6, periodsPerWeek: 6 },
      { id: "cs-sci", schoolId: "school-adv-1", classId: "cls-10", subjectId: "sub-sci", weeklyPeriods: 6, periodsPerWeek: 6 },
    ] as any[],
    feeHeads: [
      { id: "fh-tuition", schoolId: "school-adv-1", name: "Tuition Fee", isActive: true },
      { id: "fh-lab", schoolId: "school-adv-1", name: "Laboratory Fee", isActive: true },
    ] as any[],
    feeStructures: [] as any[],
    salaryTemplates: [
      { id: "st-1", schoolId: "school-adv-1", name: "Standard TGT", isActive: true },
    ] as any[],
    events: [
      { id: "ev-hol", schoolId: "school-adv-1", title: "Festival", eventType: "HOLIDAY" },
    ] as any[],
    academicCalendarEvents: [] as any[],
    departments: [
      { id: "dept-math", schoolId: "school-adv-1", name: "Mathematics", isActive: true },
    ] as any[],
    designations: [
      { id: "desig-tgt", departmentId: "dept-math", name: "TGT Mathematics", mappedRole: "TEACHER", isTeaching: true, schoolId: "school-adv-1", isActive: true },
    ] as any[],
    roles: [
      { id: "role-teacher", schoolId: "school-adv-1", name: "TEACHER", displayName: "Teacher" },
      { id: "role-staff", schoolId: "school-adv-1", name: "STAFF", displayName: "Staff" },
      { id: "role-accountant", schoolId: "school-adv-1", name: "ACCOUNTANT", displayName: "Accountant" },
    ] as any[],
    userRoles: [] as any[],
    schoolProvisions: [
      { id: "sp-1", schoolId: "school-adv-1", blueprintVersion: "1.0.0", status: "COMPLETED", provisionedAt: new Date("2026-01-01"), entityCounts: {} },
    ] as any[],
    bellSchedule: [] as any[],
    timetablePeriods: [] as any[],
    sectionSubjectTeachers: [] as any[],
    classTeacherAssignments: [] as any[],
    students: [] as any[],
    studentClassHistory: [] as any[],
    staff: [] as any[],
    users: [
      { id: "user-admin-1", schoolId: "school-adv-1", email: "admin@adv1.edu" },
      { id: "user-teacher-1", schoolId: "school-adv-1", email: "teacher1@adv1.edu" },
      { id: "user-teacher-2", schoolId: "school-adv-1", email: "teacher2@adv1.edu" },
      { id: "user-beta-teacher", schoolId: "school-adv-2", email: "teacher@adv2.edu" },
    ] as any[],
    persons: [] as any[],
    studentAttendance: [] as any[],
    studentLeaveRequests: [] as any[],
    assignments: [] as any[],
    assignmentSubmissions: [] as any[],
    domainEvents: [] as any[],
    auditLogs: [] as any[],
    existingAdmissionNumbers: new Set<string>(),
    existingEmployeeCodes: new Set<string>(),
    reset() {
      this.bellSchedule = [];
      this.timetablePeriods = [];
      this.sectionSubjectTeachers = [];
      this.classTeacherAssignments = [];
      this.students = [];
      this.studentClassHistory = [];
      this.staff = [];
      this.studentAttendance = [];
      this.studentLeaveRequests = [];
      this.feeStructures = [];
      this.domainEvents = [];
      this.auditLogs = [];
      this.existingAdmissionNumbers.clear();
      this.existingEmployeeCodes.clear();
    },
  };

  return { activeSessionRef, mockDb };
});

// Helper to extract parameters from condition expressions
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

// ─── 3. Server Auth Mocks ─────────────────────────────────────────────────────
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
        firstNameEncrypted: `enc_${input.firstName}`,
        lastNameEncrypted: `enc_${input.lastName}`,
        isActive: true,
      };
      mockDb.students.push(newStudent);
      mockDb.studentClassHistory.push({
        id: `sch-${input.admissionNumber}`,
        schoolId,
        studentId: newStudent.id,
        sectionId: input.sectionId,
        academicYearId: "ay-adv-1",
        rollNumber: "1",
        student: newStudent,
      });
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

// ─── 5. Database Layer Mock ──────────────────────────────────────────────────
vi.mock("@/db", () => {
  const createQueryHandlers = () => ({
    schools: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const targetId = activeSessionRef.current?.schoolId;
        return mockDb.schools.find((s) => s.id === targetId) || mockDb.schools[0];
      }),
      findMany: vi.fn(async () => mockDb.schools),
    },
    schoolProvisions: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const schoolId = params.find((p) => p.startsWith("school-")) || activeSessionRef.current?.schoolId;
        return mockDb.schoolProvisions.find((sp) => sp.schoolId === schoolId) || null;
      }),
      findMany: vi.fn(async () => mockDb.schoolProvisions),
    },
    academicYears: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const schoolId = params.find((p) => p.startsWith("school-")) || activeSessionRef.current?.schoolId;
        return mockDb.academicYears.find((ay) => ay.schoolId === schoolId && ay.isActive) || null;
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const schoolId = params.find((p) => p.startsWith("school-")) || activeSessionRef.current?.schoolId;
        return mockDb.academicYears.filter((ay) => ay.schoolId === schoolId);
      }),
    },
    classes: {
      findFirst: vi.fn(async () => mockDb.classes[0] || null),
      findMany: vi.fn(async () => {
        const schoolId = activeSessionRef.current?.schoolId;
        return mockDb.classes.filter((c) => c.schoolId === schoolId && c.isActive);
      }),
    },
    sections: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const schoolId = params.find((p) => p.startsWith("school-")) || activeSessionRef.current?.schoolId;
        const secId = params.find((p) => p.startsWith("sec-"));
        const sec = mockDb.sections.find((s) => s.id === secId && s.schoolId === schoolId) || mockDb.sections.find((s) => s.schoolId === schoolId);
        if (!sec) return null;
        return {
          ...sec,
          class: mockDb.classes.find((c) => c.id === sec.classId) || null,
        };
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const schoolId = activeSessionRef.current?.schoolId;
        const params = extractParamsFromCondition(where);
        return mockDb.sections
          .filter((s) => {
            if (s.schoolId !== schoolId || !s.isActive) return false;
            // Check classTeacherId condition
            if (params.includes("user-teacher-1") && s.classTeacherId !== "user-teacher-1") return false;
            if (params.includes("user-teacher-2") && s.classTeacherId !== "user-teacher-2") return false;
            if (params.includes("user-beta-teacher") && s.classTeacherId !== "user-beta-teacher") return false;
            return true;
          })
          .map((sec) => ({
            ...sec,
            class: mockDb.classes.find((c) => c.id === sec.classId) || null,
          }));
      }),
    },
    subjects: {
      findFirst: vi.fn(async () => mockDb.subjects[0] || null),
      findMany: vi.fn(async () => {
        const schoolId = activeSessionRef.current?.schoolId;
        return mockDb.subjects.filter((s) => s.schoolId === schoolId && s.isActive);
      }),
    },
    classSubjects: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const cs = mockDb.classSubjects.find((c) => params.includes(c.id) || params.includes(c.subjectId)) || mockDb.classSubjects[0];
        if (!cs) return null;
        return {
          ...cs,
          subject: mockDb.subjects.find((s) => s.id === cs.subjectId) || null,
        };
      }),
      findMany: vi.fn(async () => {
        const schoolId = activeSessionRef.current?.schoolId;
        return mockDb.classSubjects
          .filter((cs) => cs.schoolId === schoolId)
          .map((cs) => ({
            ...cs,
            subject: mockDb.subjects.find((s) => s.id === cs.subjectId) || null,
          }));
      }),
    },
    bellSchedule: {
      findFirst: vi.fn(async () => mockDb.bellSchedule[0] || null),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const schoolId = params.find((p) => p.startsWith("school-")) || activeSessionRef.current?.schoolId;
        return mockDb.bellSchedule
          .filter((b) => b.schoolId === schoolId && b.isActive)
          .sort((a, b) => a.periodNumber - b.periodNumber);
      }),
    },
    timetablePeriods: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const schoolId = activeSessionRef.current?.schoolId;
        const periodId = params.find((p) => p.startsWith("tp-") || p.startsWith("slot-"));
        if (periodId) {
          return mockDb.timetablePeriods.find((p) => p.id === periodId && p.schoolId === schoolId) || null;
        }
        return mockDb.timetablePeriods.find((p) => p.schoolId === schoolId && p.isActive) || null;
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const schoolId = activeSessionRef.current?.schoolId;
        const params = extractParamsFromCondition(where);
        return mockDb.timetablePeriods
          .filter((p) => {
            if (p.schoolId !== schoolId || !p.isActive) return false;
            if (params.includes("user-teacher-1") && p.teacherId !== "user-teacher-1") return false;
            return true;
          })
          .map((p) => ({
            ...p,
            section: mockDb.sections.find((s) => s.id === p.sectionId),
            subject: mockDb.subjects.find((s) => s.id === p.subjectId),
          }));
      }),
    },
    sectionSubjectTeachers: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        return mockDb.sectionSubjectTeachers.find((sst) => {
          if (params.includes("sec-10a") && sst.sectionId !== "sec-10a") return false;
          if (params.includes("cs-math") && sst.classSubjectId !== "cs-math") return false;
          return true;
        }) || mockDb.sectionSubjectTeachers[0] || null;
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const teacherId = params.find((p) => p.startsWith("user-teacher-"));
        return mockDb.sectionSubjectTeachers
          .filter((sst) => {
            if (teacherId && sst.teacherId !== teacherId) return false;
            return sst.isActive;
          })
          .map((sst) => {
            const sec = mockDb.sections.find((s) => s.id === sst.sectionId);
            const cs = mockDb.classSubjects.find((c) => c.id === sst.classSubjectId);
            const sub = cs ? mockDb.subjects.find((s) => s.id === cs.subjectId) : null;
            return {
              ...sst,
              section: sec ? { ...sec, class: mockDb.classes.find((c) => c.id === sec.classId) } : null,
              classSubject: cs ? { ...cs, subject: sub } : null,
            };
          });
      }),
    },
    classTeacherAssignments: {
      findFirst: vi.fn(async () => mockDb.classTeacherAssignments[0] || null),
      findMany: vi.fn(async () => mockDb.classTeacherAssignments),
    },
    studentClassHistory: {
      findMany: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const secId = params.find((p) => p.startsWith("sec-"));
        return mockDb.studentClassHistory.filter((sch) => !secId || sch.sectionId === secId);
      }),
    },
    studentAttendance: {
      findMany: vi.fn(async () => mockDb.studentAttendance),
    },
    studentLeaveRequests: {
      findMany: vi.fn(async () => mockDb.studentLeaveRequests),
    },
    students: {
      findMany: vi.fn(async () => mockDb.students),
    },
    exams: {
      findMany: vi.fn(async () => []),
    },
    markEntries: {
      findMany: vi.fn(async () => []),
    },
    timetableSubstitutions: {
      findMany: vi.fn(async () => []),
    },
    ptmSlots: {
      findMany: vi.fn(async () => []),
    },
    ptmBookings: {
      findMany: vi.fn(async () => []),
    },
    parentTeacherMessages: {
      findMany: vi.fn(async () => []),
    },
    notices: {
      findMany: vi.fn(async () => []),
    },
    staff: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const uid = params.find((p) => p.startsWith("user-"));
        return mockDb.staff.find((s) => !uid || s.userId === uid) || mockDb.staff[0] || null;
      }),
      findMany: vi.fn(async () => mockDb.staff),
    },
    departments: {
      findMany: vi.fn(async () => mockDb.departments),
    },
    designations: {
      findMany: vi.fn(async () => mockDb.designations),
    },
    roles: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        return mockDb.roles.find((r) => params.includes(r.name)) || null;
      }),
    },
    users: {
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const params = extractParamsFromCondition(where);
        const uid = params.find((p) => p.startsWith("user-"));
        return mockDb.users.find((u) => !uid || u.id === uid) || mockDb.users[0] || null;
      }),
    },
    userRoles: {
      findFirst: vi.fn(async () => null),
    },
    academicCalendarEvents: {
      findMany: vi.fn(async () => mockDb.academicCalendarEvents),
    },
    assignments: {
      findMany: vi.fn(async () => mockDb.assignments),
    },
    assignmentSubmissions: {
      findMany: vi.fn(async () => mockDb.assignmentSubmissions),
    },
  });

  const queryApi = createQueryHandlers();

  const mockDbClient: any = {
    query: queryApi,
    select: vi.fn((fields?: any) => ({
      from: vi.fn((table: any) => ({
        where: vi.fn((whereClause: any) => {
          const tableName = resolveTableName(table);
          const schoolId = activeSessionRef.current?.schoolId;

          if (tableName === "bell_schedule" || tableName === "bellSchedule") {
            const count = mockDb.bellSchedule.filter((b) => b.schoolId === schoolId && b.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "classes") {
            const count = mockDb.classes.filter((c) => c.schoolId === schoolId && c.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "sections") {
            const count = mockDb.sections.filter((s) => s.schoolId === schoolId && s.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "subjects") {
            const count = mockDb.subjects.filter((s) => s.schoolId === schoolId && s.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "fee_heads" || tableName === "feeHeads") {
            const count = mockDb.feeHeads.filter((f) => f.schoolId === schoolId && f.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "academic_years" || tableName === "academicYears") {
            const count = mockDb.academicYears.filter((ay) => ay.schoolId === schoolId && ay.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "salary_templates" || tableName === "salaryTemplates") {
            const count = mockDb.salaryTemplates.filter((st) => st.schoolId === schoolId).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "events") {
            const count = mockDb.events.filter((e) => e.schoolId === schoolId).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "section_subject_teachers" || tableName === "sectionSubjectTeachers") {
            const count = mockDb.sectionSubjectTeachers.filter((sst) => sst.schoolId === schoolId && sst.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "students") {
            const count = mockDb.students.filter((st) => st.schoolId === schoolId && st.isActive).length;
            return Promise.resolve([{ count }]);
          }
          if (tableName === "student_attendance" || tableName === "studentAttendance") {
            return Promise.resolve(mockDb.studentAttendance);
          }
          if (tableName === "student_leave_requests" || tableName === "studentLeaveRequests") {
            return Promise.resolve(mockDb.studentLeaveRequests);
          }
          return Promise.resolve([{ count: 0 }]);
        }),
        innerJoin: vi.fn(() => ({
          where: vi.fn((whereClause: any) => {
            const tableName = resolveTableName(table);
            const schoolId = activeSessionRef.current?.schoolId;

            if (tableName === "timetable_periods" || tableName === "timetablePeriods") {
              const scheduledSections = new Set(
                mockDb.timetablePeriods.filter((p) => p.schoolId === schoolId && p.isActive).map((p) => p.sectionId)
              );
              return Promise.resolve([{ count: scheduledSections.size }]);
            }
            if (tableName === "fee_structures" || tableName === "feeStructures") {
              const pricedHeads = new Set(
                mockDb.feeStructures
                  .filter((f) => f.schoolId === schoolId && f.isActive && Number(f.amount) > 0)
                  .map((f) => f.feeHeadId)
              );
              return Promise.resolve([{ count: pricedHeads.size }]);
            }
            if (tableName === "sections") {
              return {
                limit: vi.fn(async () => [
                  { sectionName: "A", className: "Class 10" },
                ]),
              };
            }
            return Promise.resolve([{ count: 0 }]);
          }),
        })),
      })),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((values: any) => {
        const valArray = Array.isArray(values) ? values : [values];
        const tableName = resolveTableName(table);

        const records = valArray.map((v, i) => {
          const id = v.id || `auto-${tableName}-${Date.now()}-${i}`;
          const record = { ...v, id };
          if (tableName === "bell_schedule" || tableName === "bellSchedule") mockDb.bellSchedule.push(record);
          if (tableName === "timetable_periods" || tableName === "timetablePeriods") mockDb.timetablePeriods.push(record);
          if (tableName === "staff") mockDb.staff.push(record);
          if (tableName === "students") mockDb.students.push(record);
          if (tableName === "student_attendance" || tableName === "studentAttendance") mockDb.studentAttendance.push(record);
          if (tableName === "domain_events" || tableName === "domainEvents") mockDb.domainEvents.push(record);
          if (tableName === "audit_logs" || tableName === "auditLogs") mockDb.auditLogs.push(record);
          return record;
        });

        return {
          returning: vi.fn(async () => records),
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => records),
          })),
        };
      }),
    })),
    update: vi.fn((table: any) => ({
      set: vi.fn((setValues: any) => ({
        where: vi.fn(async () => {
          return [setValues];
        }),
      })),
    })),
    transaction: vi.fn(async (callback: any) => {
      const txMock = {
        ...mockDbClient,
        execute: vi.fn(async () => []),
      };
      return await callback(txMock);
    }),
    execute: vi.fn(async () => []),
  };

  return {
    db: mockDbClient,
    withTenant: vi.fn(async (_schoolId: string, cb: any) => cb(mockDbClient)),
  };
});

// ─── 6. Real Action Imports ──────────────────────────────────────────────────
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

// ─── 7. Adversarial Challenge Test Matrix ────────────────────────────────────
describe("Sprint 21 Milestone 6: Adversarial Empirical Challenge Suite", () => {
  beforeEach(() => {
    mockDb.reset();
    activeSessionRef.current = {
      userId: "user-admin-1",
      role: "SCHOOL_ADMIN",
      schoolId: "school-adv-1",
      email: "admin@adv1.edu",
    };
  });

  // ===========================================================================
  // CHALLENGE 1: Non-Contiguous & Edge Case Bell Schedule Top-Up
  // ===========================================================================
  describe("Challenge 1: Bell Schedule Top-Up & Non-Contiguous Periods", () => {
    it("1.1 Successfully backfills missing periods when schedule has non-contiguous numbers [1, 3, 5, 8]", async () => {
      // Pre-seed non-contiguous periods
      mockDb.bellSchedule = [
        { id: "b1", schoolId: "school-adv-1", periodNumber: 1, name: "Period 1", startTime: "08:20", endTime: "09:00", periodType: "REGULAR", isActive: true },
        { id: "b3", schoolId: "school-adv-1", periodNumber: 3, name: "Period 3", startTime: "09:40", endTime: "10:20", periodType: "REGULAR", isActive: true },
        { id: "b5", schoolId: "school-adv-1", periodNumber: 5, name: "Period 5", startTime: "11:20", endTime: "12:00", periodType: "REGULAR", isActive: true },
        { id: "b8", schoolId: "school-adv-1", periodNumber: 8, name: "Period 8", startTime: "13:20", endTime: "14:00", periodType: "REGULAR", isActive: true },
      ];

      const res = await topUpSchoolProvision("school-adv-1", "cbse-secondary-v1");
      expect(res.success).toBe(true);
      // Added periods 2, 4, 6, 7 (4 missing periods)
      expect(res.addedCount).toBe(4);

      // Now all 8 periods 1..8 exist
      const periodNumbers = mockDb.bellSchedule.map((b) => b.periodNumber).sort((a, b) => a - b);
      expect(periodNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("1.2 Top-up call on completely saturated schedule adds 0 periods idempotently", async () => {
      // Seed all 8 periods
      for (let p = 1; p <= 8; p++) {
        mockDb.bellSchedule.push({
          id: `b-${p}`,
          schoolId: "school-adv-1",
          periodNumber: p,
          name: `Period ${p}`,
          startTime: "08:00",
          endTime: "08:40",
          periodType: "REGULAR",
          isActive: true,
        });
      }

      const res = await topUpSchoolProvision("school-adv-1", "cbse-secondary-v1");
      expect(res.success).toBe(true);
      expect(res.addedCount).toBe(0);
      expect(mockDb.bellSchedule.length).toBe(8);
    });

    it("1.3 Timetable generation fails closed with clear error if 0 bell schedule periods exist", async () => {
      mockDb.bellSchedule = [];
      await expect(generateSectionTimetablePreview("sec-10a")).rejects.toThrow(
        /No active bell schedule configured for this school/
      );
    });
  });

  // ===========================================================================
  // CHALLENGE 2: Staff Import Role Clamping & Privilege Escalation Resistance
  // ===========================================================================
  describe("Challenge 2: Staff Import Role Clamping & Defense", () => {
    it("2.1 Rejects administrative escalation attempts (SUPER_ADMIN, PRINCIPAL, ROOT, ADMIN) with line-numbered CSV", async () => {
      const maliciousRoles = ["SUPER_ADMIN", "PRINCIPAL", "ADMIN", "ROOT", "DIRECTOR", "CHAIRPERSON"];

      for (const role of maliciousRoles) {
        const batch = [
          {
            "Employee Code": `EMP-${role}`,
            "First Name": "Hacker",
            "Last Name": "Attempt",
            "Official Email": `hacker-${role.toLowerCase()}@school.edu`,
            "Contact Phone": "9876543210",
            "Department": "Academics",
            "Designation": role,
            "System Role": role,
          },
        ];

        const res = await commitStaffImportAction(batch);
        expect(res.success).toBe(false);
        expect(res.createdCount).toBe(0);
        expect(res.errors[0]).toContain(role);
        expect(res.rejectedRowsCsv).toContain(role);
        expect(mockDb.staff.length).toBe(0);
      }
    });

    it("2.2 Rejects arbitrary or script injection strings in System Role", async () => {
      const injectionRoles = ["<script>alert(1)</script>", "DROP TABLE staff;--", "COORDINATOR", "INTERN"];

      for (const role of injectionRoles) {
        const batch = [
          {
            "Employee Code": "EMP-INJ",
            "First Name": "Test",
            "Last Name": "User",
            "Official Email": "test@school.edu",
            "Contact Phone": "9876543210",
            "Department": "Academics",
            "Designation": "Staff",
            "System Role": role,
          },
        ];

        const res = await commitStaffImportAction(batch);
        expect(res.success).toBe(false);
        expect(res.createdCount).toBe(0);
        expect(res.rejectedRowsCsv).toBeDefined();
      }
    });

    it("2.3 Enforces all-or-nothing rollback: single invalid row aborts entire batch of valid staff", async () => {
      const mixedBatch = [
        {
          "Employee Code": "EMP-T1",
          "First Name": "Kavita",
          "Last Name": "Raman",
          "Official Email": "kavita@adv1.edu",
          "Contact Phone": "9876543210",
          "Department": "Academics",
          "Designation": "TGT Math",
          "System Role": "TEACHER",
        },
        {
          "Employee Code": "EMP-P1",
          "First Name": "Evil",
          "Last Name": "Escalation",
          "Official Email": "evil@adv1.edu",
          "Contact Phone": "9876543211",
          "Department": "Admin",
          "Designation": "Principal",
          "System Role": "PRINCIPAL", // INVALID!
        },
        {
          "Employee Code": "EMP-A1",
          "First Name": "Ramesh",
          "Last Name": "Kumar",
          "Official Email": "ramesh@adv1.edu",
          "Contact Phone": "9876543212",
          "Department": "Accounts",
          "Designation": "Accountant",
          "System Role": "ACCOUNTANT",
        },
      ];

      const res = await commitStaffImportAction(mixedBatch);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.skippedCount).toBe(0);
      // Zero rows written
      expect(mockDb.staff.length).toBe(0);
      expect(res.errors.some((e) => e.includes("PRINCIPAL"))).toBe(true);
    });

    it("2.4 Rejects intra-batch duplicate employee codes with line error, while re-import across batches skips idempotently", async () => {
      // Intra-batch duplicate triggers all-or-nothing validation failure
      const duplicateBatch = [
        {
          "Employee Code": "EMP-DUPLICATE",
          "First Name": "First",
          "Last Name": "Instance",
          "Official Email": "first@adv1.edu",
          "Contact Phone": "9876543210",
          "Department": "Academics",
          "Designation": "Staff",
          "System Role": "STAFF",
        },
        {
          "Employee Code": "EMP-DUPLICATE", // Duplicate in same file!
          "First Name": "Second",
          "Last Name": "Instance",
          "Official Email": "second@adv1.edu",
          "Contact Phone": "9876543211",
          "Department": "Academics",
          "Designation": "Staff",
          "System Role": "STAFF",
        },
      ];

      const res = await commitStaffImportAction(duplicateBatch);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors.some((e) => e.toLowerCase().includes("duplicate key"))).toBe(true);

      // Distinct valid row
      const validBatch = [
        {
          "Employee Code": "EMP-UNIQUE-1",
          "First Name": "First",
          "Last Name": "Instance",
          "Official Email": "first@adv1.edu",
          "Contact Phone": "9876543210",
          "Department": "Academics",
          "Designation": "Staff",
          "System Role": "STAFF",
        },
      ];

      const run1 = await commitStaffImportAction(validBatch);
      expect(run1.success).toBe(true);
      expect(run1.createdCount).toBe(1);

      // Re-importing same batch across runs skips existing employee code idempotently
      const run2 = await commitStaffImportAction(validBatch);
      expect(run2.success).toBe(true);
      expect(run2.createdCount).toBe(0);
      expect(run2.skippedCount).toBe(1);
    });
  });

  // ===========================================================================
  // CHALLENGE 3: Student Import Idempotency & Batch Resilience
  // ===========================================================================
  describe("Challenge 3: Student Import Idempotency & Batch Resilience", () => {
    it("3.1 Intra-batch duplicate admission number triggers all-or-nothing rollback, while across-batch re-import skips idempotently", async () => {
      // Intra-batch duplicate is rejected by validateImportBatch
      const batchWithDups = [
        {
          "Admission Number": "ADM-DUP-01",
          "First Name": "Student",
          "Last Name": "One",
          "Class Name": "Class 10",
          "Section": "A",
          "Date of Birth (YYYY-MM-DD)": "2010-01-01",
          "Gender": "MALE",
          "Parent / Guardian Name": "Parent One",
          "Parent Phone": "9876543210",
        },
        {
          "Admission Number": "ADM-DUP-01", // Duplicate admission number in same file
          "First Name": "Student",
          "Last Name": "One Duplicate",
          "Class Name": "Class 10",
          "Section": "A",
          "Date of Birth (YYYY-MM-DD)": "2010-01-01",
          "Gender": "MALE",
          "Parent / Guardian Name": "Parent One",
          "Parent Phone": "9876543210",
        },
      ];

      const res = await commitStudentImportAction(batchWithDups);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors.some((e) => e.toLowerCase().includes("duplicate key"))).toBe(true);
    });

    it("3.2 Re-import of existing student batch truthfully skips 100% of records", async () => {
      const batch = [
        {
          "Admission Number": "ADM-NEW-101",
          "First Name": "Rohan",
          "Last Name": "Mehta",
          "Class Name": "Class 10",
          "Section": "A",
          "Date of Birth (YYYY-MM-DD)": "2010-03-20",
          "Gender": "MALE",
          "Parent / Guardian Name": "Anil Mehta",
          "Parent Phone": "9876543210",
        },
      ];

      const firstRes = await commitStudentImportAction(batch);
      expect(firstRes.success).toBe(true);
      expect(firstRes.createdCount).toBe(1);
      expect(firstRes.skippedCount).toBe(0);

      const secondRes = await commitStudentImportAction(batch);
      expect(secondRes.success).toBe(true);
      expect(secondRes.createdCount).toBe(0);
      expect(secondRes.skippedCount).toBe(1);
      expect(mockDb.students.length).toBe(1);
    });

    it("3.3 Rejects unknown class or section name with row error before any database write", async () => {
      const invalidClassBatch = [
        {
          "Admission Number": "ADM-INVALID-CLASS",
          "First Name": "No",
          "Last Name": "Class",
          "Class Name": "Class 13 NonExistent", // Unknown class
          "Section": "A",
          "Date of Birth (YYYY-MM-DD)": "2010-01-01",
          "Gender": "MALE",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "9876543210",
        },
      ];

      const res = await commitStudentImportAction(invalidClassBatch);
      expect(res.success).toBe(false);
      expect(res.createdCount).toBe(0);
      expect(res.errors[0]).toContain("Class 13 NonExistent");
      expect(mockDb.students.length).toBe(0);
    });
  });

  // ===========================================================================
  // CHALLENGE 4: Teacher My Day Tenant & User Boundary Enforcement
  // ===========================================================================
  describe("Challenge 4: Teacher My Day Tenant & Isolation", () => {
    it("4.1 Teacher My Day strictly filters timetable periods by authenticated user and school", async () => {
      // Seed timetable period for Teacher 1 in School Alpha (Section 10-A)
      mockDb.timetablePeriods.push({
        id: "tp-t1",
        schoolId: "school-adv-1",
        academicYearId: "ay-adv-1",
        sectionId: "sec-10a",
        subjectId: "sub-math",
        teacherId: "user-teacher-1",
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        startTime: "08:20",
        endTime: "09:00",
        isActive: true,
      });

      // Seed another timetable period for Teacher 2 in same section 10-A
      mockDb.timetablePeriods.push({
        id: "tp-t2",
        schoolId: "school-adv-1",
        academicYearId: "ay-adv-1",
        sectionId: "sec-10a",
        subjectId: "sub-sci",
        teacherId: "user-teacher-2",
        dayOfWeek: "MONDAY",
        periodNumber: 2,
        startTime: "09:00",
        endTime: "09:40",
        isActive: true,
      });

      // Teacher 1 allocation
      mockDb.sectionSubjectTeachers.push({
        id: "sst-1",
        schoolId: "school-adv-1",
        academicYearId: "ay-adv-1",
        sectionId: "sec-10a",
        classSubjectId: "cs-math",
        teacherId: "user-teacher-1",
        isActive: true,
      });

      const monday = new Date("2026-11-02T08:35:00Z");

      // Snapshot for Teacher 1
      const snapshotT1 = await assembleTeacherSnapshot("school-adv-1", "user-teacher-1", monday);
      expect(snapshotT1.timetableToday).toBeDefined();
      expect(snapshotT1.timetableToday?.length).toBe(1);
      expect(snapshotT1.timetableToday?.[0]?.subjectName).toBe("Mathematics");

      // Verify Teacher 2's period (Science) is NOT in Teacher 1's timetableToday
      const hasScience = snapshotT1.timetableToday?.some((p) => p.subjectName === "Science");
      expect(hasScience).toBe(false);
    });

    it("4.2 Sunday or non-working days yield empty timetableToday", async () => {
      // 2026-11-01 is Sunday
      const sunday = new Date("2026-11-01T10:00:00Z");
      const snapshot = await assembleTeacherSnapshot("school-adv-1", "user-teacher-1", sunday);
      expect(snapshot.timetableToday).toEqual([]);
    });

    it("4.3 Teacher from School Beta has no sections in School Alpha scope", async () => {
      const scope = await resolveTeacherScope("user-beta-teacher", { schoolId: "school-adv-1" });
      expect(scope.classTeacherSections).toEqual([]);
      expect(scope.teachingSections).toEqual([]);
      expect(scope.allSectionIds).toEqual([]);
    });
  });

  // ===========================================================================
  // CHALLENGE 5: Attendance Marking Security & Boundary Invariants
  // ===========================================================================
  describe("Challenge 5: Attendance Marking Security & Boundary Invariants", () => {
    it("5.1 Teacher outside section scope is denied attendance marking (403 TeacherScopeError)", async () => {
      activeSessionRef.current = {
        userId: "user-teacher-2",
        role: "TEACHER",
        schoolId: "school-adv-1",
        email: "teacher2@adv1.edu",
      };

      // Teacher 2 has NO allocation and is NOT class teacher for Section 10-A
      await expect(
        saveTeacherAttendanceRoster({
          sectionId: "sec-10a",
          dateStr: "2026-11-02",
          records: [{ studentId: "student-1", status: "PRESENT" }],
        })
      ).rejects.toThrow(/not authorized|Class Teacher override required/i);
    });

    it("5.2 Rejects attendance save with empty records roster", async () => {
      activeSessionRef.current = {
        userId: "user-admin-1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-adv-1",
        email: "admin@adv1.edu",
      };

      await expect(
        saveTeacherAttendanceRoster({
          sectionId: "sec-10a",
          dateStr: "2026-11-02",
          records: [],
        })
      ).rejects.toThrow(/Cannot save empty attendance roster/);
    });

    it("5.3 Period 1 attendance marking persists periodId and increments counts", async () => {
      activeSessionRef.current = {
        userId: "user-teacher-1",
        role: "TEACHER",
        schoolId: "school-adv-1",
        email: "teacher1@adv1.edu",
      };

      // Set up allocation for Teacher 1 in Section 10-A
      mockDb.sectionSubjectTeachers = [
        {
          id: "sst-1",
          schoolId: "school-adv-1",
          academicYearId: "ay-adv-1",
          sectionId: "sec-10a",
          classSubjectId: "cs-math",
          teacherId: "user-teacher-1",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          isActive: true,
        },
      ];

      // Add student
      mockDb.students = [
        { id: "stu-1", schoolId: "school-adv-1", admissionNumber: "ADM-1", currentSectionId: "sec-10a", isActive: true },
      ];
      mockDb.studentClassHistory = [
        { id: "sch-1", schoolId: "school-adv-1", studentId: "stu-1", sectionId: "sec-10a", academicYearId: "ay-adv-1", rollNumber: "1", student: mockDb.students[0] },
      ];

      // Existing period
      mockDb.timetablePeriods = [
        { id: "tp-p1", schoolId: "school-adv-1", sectionId: "sec-10a", subjectId: "sub-math", periodNumber: 1, dayOfWeek: "MONDAY", teacherId: "user-teacher-1", isActive: true },
      ];

      const res = await saveTeacherAttendanceRoster({
        sectionId: "sec-10a",
        dateStr: "2026-11-02",
        periodId: "tp-p1",
        records: [{ studentId: "stu-1", status: "PRESENT" }],
      });

      expect(res.success).toBe(true);
      expect(res.counts.present).toBe(1);
      expect(res.counts.absent).toBe(0);
      expect(mockDb.studentAttendance[0].periodId).toBe("tp-p1");
    });
  });

  // ===========================================================================
  // CHALLENGE 6: Parent Feed Zero-Clutter Invariant Across Complex Scenarios
  // ===========================================================================
  describe("Challenge 6: Parent Feed Zero-Clutter Invariant", () => {
    const now = new Date("2026-11-02T10:00:00Z");

    it("6.1 Multi-child household: Child 1 (PRESENT, paid) is Calm; Child 2 (ABSENT) gets 1 T1 Action Card", () => {
      // Child 1: Perfect status -> Calm state
      const child1Cards = deriveParentFeed("child-1", now, {
        studentName: "Aarav",
        attendanceToday: { status: "PRESENT", markedAt: now },
        invoices: [],
      });
      expect(child1Cards).toHaveLength(0);

      // Child 2: Marked ABSENT -> Immediate T1 Action Card
      const child2Cards = deriveParentFeed("child-2", now, {
        studentName: "Ananya",
        attendanceToday: { status: "ABSENT", markedAt: now },
        invoices: [],
      });
      expect(child2Cards).toHaveLength(1);
      expect(child2Cards[0]!.cardType).toBe("AttendanceCard");
      expect(child2Cards[0]!.tier).toBe("T1_action_required");
      expect(child2Cards[0]!.title.en).toBe("Ananya marked Absent");
    });

    it("6.2 Approved planned leave suppresses ABSENT alarm into Calm State (AC-P16)", () => {
      const leaveCards = deriveParentFeed("child-leave", now, {
        studentName: "Kabir",
        attendanceToday: { status: "ABSENT", markedAt: now },
        activeLeaveApproved: true,
        invoices: [],
      });
      // Suppressed due to pre-approved planned leave!
      expect(leaveCards).toHaveLength(0);
    });

    it("6.3 Overdue fee invoice surfaces T1 Action Required Card with bilingual dignity", () => {
      const overdueCards = deriveParentFeed("child-fee", now, {
        studentName: "Isha",
        attendanceToday: { status: "PRESENT", markedAt: now },
        invoices: [
          {
            id: "inv-overdue",
            termName: "Term 1 Tuition",
            status: "OVERDUE",
            balanceAmount: 5000,
            lateFeeAmount: 200,
            dueDate: "2026-10-15T00:00:00Z",
          } as any,
        ],
      });

      expect(overdueCards).toHaveLength(1);
      const card = overdueCards[0]!;
      expect(card.cardType).toBe("PaymentCard");
      expect(card.tier).toBe("T1_action_required");
      expect(card.title.en).toContain("Overdue Fee");
      expect(card.title.hi).toContain("अतिदेय शुल्क");
    });

    it("6.4 Invoice with due date > 7 days in future does NOT render any card (Calm State)", () => {
      const futureDueDate = new Date(now.getTime() + 14 * 86400000).toISOString();
      const futureInvoiceCards = deriveParentFeed("child-future", now, {
        studentName: "Rohan",
        attendanceToday: { status: "PRESENT", markedAt: now },
        invoices: [
          {
            id: "inv-future",
            termName: "Term 2",
            status: "PENDING",
            balanceAmount: 6000,
            lateFeeAmount: 0,
            dueDate: futureDueDate,
          } as any,
        ],
      });
      expect(futureInvoiceCards).toHaveLength(0);
    });
  });

  // ===========================================================================
  // CHALLENGE 7: Operational Readiness Health Score Telemetry & Monotonicity
  // ===========================================================================
  describe("Challenge 7: Operational Readiness Score Telemetry & Step-by-Step Monotonicity", () => {
    it("7.1 Baseline: 0 of 5 milestones met returns operationalScore = 0 and isOperationallyReady = false", async () => {
      const health = await getSchoolConfigurationHealthAction();
      expect(health.operationalScore).toBe(0);
      expect(health.isOperationallyReady).toBe(false);
      expect(health.operationalMilestones.filter((m) => m.isComplete)).toHaveLength(0);
    });

    it("7.2 Exactly 1 milestone met (bell schedule > 0): operationalScore = 20, isOperationallyReady = false", async () => {
      mockDb.bellSchedule = [
        { id: "b1", schoolId: "school-adv-1", periodNumber: 1, name: "P1", startTime: "08:00", endTime: "08:40", periodType: "REGULAR", isActive: true },
      ];

      const health = await getSchoolConfigurationHealthAction();
      expect(health.operationalScore).toBe(20);
      expect(health.isOperationallyReady).toBe(false);

      const bellM = health.operationalMilestones.find((m) => m.key === "bellSchedulePeriods");
      expect(bellM?.isComplete).toBe(true);
      expect(bellM?.status).toBe("COMPLETE");
    });

    it("7.3 Exactly 2 milestones met (bell schedule + timetable): operationalScore = 40, isOperationallyReady = false", async () => {
      mockDb.bellSchedule = [
        { id: "b1", schoolId: "school-adv-1", periodNumber: 1, name: "P1", startTime: "08:00", endTime: "08:40", periodType: "REGULAR", isActive: true },
      ];
      // Schedule periods for both active sections (sec-10a and sec-10b)
      mockDb.timetablePeriods = [
        { id: "tp-1", schoolId: "school-adv-1", sectionId: "sec-10a", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
        { id: "tp-2", schoolId: "school-adv-1", sectionId: "sec-10b", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
      ];

      const health = await getSchoolConfigurationHealthAction();
      expect(health.operationalScore).toBe(40);
      expect(health.isOperationallyReady).toBe(false);
    });

    it("7.4 Partial fee structure pricing leaves feePricing milestone as PARTIAL and blocks 100%", async () => {
      mockDb.bellSchedule = [{ id: "b1", schoolId: "school-adv-1", periodNumber: 1, name: "P1", startTime: "08:00", endTime: "08:40", periodType: "REGULAR", isActive: true }];
      mockDb.timetablePeriods = [
        { id: "tp-1", schoolId: "school-adv-1", sectionId: "sec-10a", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
        { id: "tp-2", schoolId: "school-adv-1", sectionId: "sec-10b", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
      ];
      mockDb.sectionSubjectTeachers = [{ id: "sst-1", schoolId: "school-adv-1", isActive: true }];
      mockDb.students = [{ id: "stu-1", schoolId: "school-adv-1", isActive: true }];

      // Price ONLY 1 of 2 fee heads (Tuition priced, Lab unpriced)
      mockDb.feeStructures = [
        { id: "fs-1", schoolId: "school-adv-1", feeHeadId: "fh-tuition", amount: "5000", isActive: true },
      ];

      const health = await getSchoolConfigurationHealthAction();
      // 4 out of 5 milestones complete (bell, timetable, teacherAllocations, studentEnrollment)
      expect(health.operationalScore).toBe(80);
      expect(health.isOperationallyReady).toBe(false);

      const feeM = health.operationalMilestones.find((m) => m.key === "feePricing");
      expect(feeM?.isComplete).toBe(false);
      expect(feeM?.status).toBe("PARTIAL");
      expect(feeM?.metric).toBe("1/2 Heads Priced");
    });

    it("7.5 100% operational readiness achieved strictly when all 5 milestones are COMPLETE", async () => {
      mockDb.bellSchedule = [{ id: "b1", schoolId: "school-adv-1", periodNumber: 1, name: "P1", startTime: "08:00", endTime: "08:40", periodType: "REGULAR", isActive: true }];
      mockDb.timetablePeriods = [
        { id: "tp-1", schoolId: "school-adv-1", sectionId: "sec-10a", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
        { id: "tp-2", schoolId: "school-adv-1", sectionId: "sec-10b", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
      ];
      mockDb.sectionSubjectTeachers = [{ id: "sst-1", schoolId: "school-adv-1", isActive: true }];
      mockDb.students = [{ id: "stu-1", schoolId: "school-adv-1", isActive: true }];
      mockDb.feeStructures = [
        { id: "fs-1", schoolId: "school-adv-1", feeHeadId: "fh-tuition", amount: "5000", isActive: true },
        { id: "fs-2", schoolId: "school-adv-1", feeHeadId: "fh-lab", amount: "2000", isActive: true },
      ];

      const health = await getSchoolConfigurationHealthAction();
      expect(health.operationalScore).toBe(100);
      expect(health.isOperationallyReady).toBe(true);

      for (const m of health.operationalMilestones) {
        expect(m.isComplete).toBe(true);
        expect(m.status).toBe("COMPLETE");
      }
    });
  });
});
