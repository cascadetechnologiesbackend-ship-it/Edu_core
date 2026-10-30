import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// ─── 1. Mocks for React, Next Cache & Storage Utilities ──────────────────────
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

// ─── 2. Multi-Tenant In-Memory Datastore & Session Context ───────────────────
const { activeSessionRef, mockOperationalDb } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "user-admin-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    } as any,
  };

  const mockOperationalDb = {
    schools: [
      { id: "school-A", name: "Delhi Public School (School A)" },
      { id: "school-B", name: "St. Xavier Academy (School B)" },
    ],
    academicYears: [
      { id: "ay-A-1", schoolId: "school-A", label: "2024-25", isActive: true },
      { id: "ay-B-1", schoolId: "school-B", label: "2024-25", isActive: true },
    ] as any[],
    classes: [
      { id: "cls-1", schoolId: "school-A", name: "Class 10", isActive: true },
      { id: "cls-2", schoolId: "school-A", name: "Class 9", isActive: true },
    ],
    sections: [
      { id: "sec-10a", schoolId: "school-A", classId: "cls-1", name: "A", isActive: true },
      { id: "sec-10b", schoolId: "school-A", classId: "cls-1", name: "B", isActive: true },
      { id: "sec-9a", schoolId: "school-A", classId: "cls-2", name: "A", isActive: true },
      { id: "sec-9b", schoolId: "school-A", classId: "cls-2", name: "B", isActive: true },
    ] as any[],
    subjects: [
      { id: "sub-1", schoolId: "school-A", name: "Mathematics", isActive: true },
      { id: "sub-2", schoolId: "school-A", name: "Science", isActive: true },
    ],
    bellSchedule: [] as any[],
    timetablePeriods: [] as any[],
    feeHeads: [
      { id: "fh-1", schoolId: "school-A", name: "Tuition Fee", isActive: true },
      { id: "fh-2", schoolId: "school-A", name: "Transport Fee", isActive: true },
      { id: "fh-3", schoolId: "school-A", name: "Annual Charges", isActive: true },
    ] as any[],
    feeStructures: [] as any[],
    salaryTemplates: [
      { id: "st-1", schoolId: "school-A", name: "TGT Grade", isActive: true },
    ],
    events: [
      { id: "ev-1", schoolId: "school-A", title: "Independence Day", eventType: "HOLIDAY" },
    ],
    sectionSubjectTeachers: [] as any[],
    students: [] as any[],
    schoolProvisions: [
      { id: "sp-A", schoolId: "school-A", blueprintVersion: "1.0.0", provisionedAt: new Date("2026-01-01") },
    ],
  };

  return { activeSessionRef, mockOperationalDb };
});

// ─── 3. Mock Server Auth ─────────────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current) {
      throw new Error("Unauthorized: No active session found.");
    }
    const role = activeSessionRef.current.role;
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new Error(`Forbidden: Role '${role}' is not authorized to perform this operation.`);
    }
    return {
      session: { user: activeSessionRef.current },
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    const school = mockOperationalDb.schools.find((s) => s.id === ctx.schoolId);
    if (!school) throw new Error("School not found");
    return school;
  }),
}));

// Helper to reliably resolve table name from Drizzle table or mock
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

// ─── 4. Mock Database Layer ──────────────────────────────────────────────────
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        schools: {
          findFirst: vi.fn(async () =>
            mockOperationalDb.schools.find((s) => s.id === activeSessionRef.current?.schoolId) || null
          ),
        },
        schoolProvisions: {
          findFirst: vi.fn(async () =>
            mockOperationalDb.schoolProvisions.find((p) => p.schoolId === activeSessionRef.current?.schoolId) || null
          ),
        },
        academicYears: {
          findFirst: vi.fn(async ({ where }: any) => {
            const schoolId = activeSessionRef.current?.schoolId;
            return mockOperationalDb.academicYears.find((ay) => ay.schoolId === schoolId && ay.isActive) || null;
          }),
        },
      },
      update: vi.fn((table: any) => ({
        set: vi.fn((values: any) => ({
          where: vi.fn(async (condition: any) => {
            const schoolId = activeSessionRef.current?.schoolId;
            if (values.isActive === false) {
              // Deactivate existing active academic years for this school
              for (const ay of mockOperationalDb.academicYears) {
                if (ay.schoolId === schoolId && ay.isActive) {
                  ay.isActive = false;
                }
              }
            } else if (values.isActive === true && values.label) {
              for (const ay of mockOperationalDb.academicYears) {
                if (ay.schoolId === schoolId && ay.label === values.label) {
                  ay.isActive = true;
                }
              }
            }
            return { rowCount: 1 };
          }),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn(async (values: any) => {
          const item = {
            id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...values,
          };
          mockOperationalDb.academicYears.push(item);
          return [item];
        }),
      })),
      select: vi.fn((fields: any) => {
        let targetTable: string = "";

        const chain: any = {
          from: vi.fn((tbl: any): any => {
            targetTable = resolveTableName(tbl);
            return chain;
          }),
          innerJoin: vi.fn((): any => chain),
          where: vi.fn((cond: any): any => chain),
          then: (resolve: any) => {
            const schoolId = activeSessionRef.current?.schoolId;
            let count = 0;

            if (targetTable.includes("academic_years")) {
              count = mockOperationalDb.academicYears.filter((y) => y.schoolId === schoolId && y.isActive).length;
            } else if (targetTable.includes("classes")) {
              count = mockOperationalDb.classes.filter((c) => c.schoolId === schoolId && c.isActive).length;
            } else if (targetTable.includes("sections")) {
              count = mockOperationalDb.sections.filter((s) => s.schoolId === schoolId && s.isActive).length;
            } else if (targetTable.includes("subjects")) {
              count = mockOperationalDb.subjects.filter((s) => s.schoolId === schoolId && s.isActive).length;
            } else if (targetTable.includes("fee_heads")) {
              count = mockOperationalDb.feeHeads.filter((f) => f.schoolId === schoolId && f.isActive).length;
            } else if (targetTable.includes("fee_structures")) {
              const pricedHeadIds = new Set(
                mockOperationalDb.feeStructures
                  .filter((fs) => fs.schoolId === schoolId && fs.isActive && Number(fs.amount) > 0)
                  .map((fs) => fs.feeHeadId)
              );
              count = pricedHeadIds.size;
            } else if (targetTable.includes("salary_templates")) {
              count = mockOperationalDb.salaryTemplates.filter((s) => s.schoolId === schoolId && s.isActive).length;
            } else if (targetTable.includes("events")) {
              count = mockOperationalDb.events.filter((e) => e.schoolId === schoolId && e.eventType === "HOLIDAY").length;
            } else if (targetTable.includes("bell_schedule")) {
              count = mockOperationalDb.bellSchedule.filter((b) => b.schoolId === schoolId && b.isActive).length;
            } else if (targetTable.includes("timetable_periods")) {
              const distinctSections = new Set(
                mockOperationalDb.timetablePeriods
                  .filter((t) => t.schoolId === schoolId && t.isActive)
                  .map((t) => t.sectionId)
              );
              count = distinctSections.size;
            } else if (targetTable.includes("section_subject_teachers")) {
              count = mockOperationalDb.sectionSubjectTeachers.filter((sst) => sst.schoolId === schoolId && sst.isActive).length;
            } else if (targetTable.includes("students")) {
              count = mockOperationalDb.students.filter((st) => st.schoolId === schoolId && st.isActive).length;
            }

            return Promise.resolve([{ count }]).then(resolve);
          },
        };
        return chain;
      }),
    },
  };
});

describe("Sprint S21 Layer L4: Operational Readiness Health Score & Honest Setup Truth", () => {
  beforeEach(() => {
    // Reset to School A admin
    activeSessionRef.current = {
      userId: "user-admin-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };

    // Reset operational entities to baseline (unprovisioned operational state)
    mockOperationalDb.bellSchedule = [];
    mockOperationalDb.timetablePeriods = [];
    mockOperationalDb.feeStructures = [];
    mockOperationalDb.sectionSubjectTeachers = [];
    mockOperationalDb.students = [];
    mockOperationalDb.academicYears = [
      { id: "ay-A-1", schoolId: "school-A", label: "2024-25", isActive: true },
      { id: "ay-B-1", schoolId: "school-B", label: "2024-25", isActive: true },
    ];
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SUITE 1: RBAC GUARD MATRIX (Admin Only Enforcement)
  // ═════════════════════════════════════════════════════════════════════════════
  describe("1. RBAC Guard Matrix: Operational Health & Setup Access", () => {
    const forbiddenRoles = ["TEACHER", "PARENT", "STUDENT", "DRIVER"];

    it.each(forbiddenRoles)(
      "should deny role '%s' from calling getSchoolConfigurationHealthAction",
      async (role) => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const { getSchoolConfigurationHealthAction } = await import(
          "@/app/(admin)/settings/school-setup/actions"
        );

        await expect(getSchoolConfigurationHealthAction()).rejects.toThrow(/Forbidden: Role/);
      }
    );

    it.each(forbiddenRoles)(
      "should deny role '%s' from calling setupSchool",
      async (role) => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const { setupSchool } = await import(
          "@/app/(admin)/settings/school-setup/actions"
        );

        const sampleSetupData = {
          name: "Test School",
          address: "Sector 4, RK Puram, New Delhi",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          phone: "9876543210",
          email: "school@test.edu",
          principalName: "Dr. Principal",
          establishedYear: 2005,
          board: "CBSE" as const,
          udiseCode: "07010100101",
          academicYearLabel: "2025-26",
          academicYearStart: "2025-04-01",
          academicYearEnd: "2026-03-31",
        };

        await expect(setupSchool(sampleSetupData)).rejects.toThrow(/Forbidden: Role/);
      }
    );

    it("should deny PRINCIPAL role from calling setupSchool (restricted strictly to SUPER_ADMIN and SCHOOL_ADMIN)", async () => {
      activeSessionRef.current = {
        userId: "user-principal",
        role: "PRINCIPAL",
        schoolId: "school-A",
        email: "principal@school-a.edu",
      };

      const { setupSchool } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      const sampleSetupData = {
        name: "Test School",
        address: "Sector 4, RK Puram, New Delhi",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        phone: "9876543210",
        email: "school@test.edu",
        principalName: "Dr. Principal",
        establishedYear: 2005,
        board: "CBSE" as const,
        udiseCode: "07010100101",
        academicYearLabel: "2025-26",
        academicYearStart: "2025-04-01",
        academicYearEnd: "2026-03-31",
      };

      await expect(setupSchool(sampleSetupData)).rejects.toThrow(/Forbidden: Role 'PRINCIPAL'/);
    });

    it("should reject unauthenticated caller (null session) across health action and setupSchool", async () => {
      activeSessionRef.current = null;

      const { getSchoolConfigurationHealthAction, setupSchool } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      await expect(getSchoolConfigurationHealthAction()).rejects.toThrow(/Unauthorized/);
      await expect(setupSchool({} as any)).rejects.toThrow(/Unauthorized/);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SUITE 2: ACADEMIC YEAR SINGULARITY GUARD (F17)
  // ═════════════════════════════════════════════════════════════════════════════
  describe("2. setupSchool Academic Year Singularity Guard", () => {
    it("deactivates existing active academic year when creating a new active year", async () => {
      const activeYearsBefore = mockOperationalDb.academicYears.filter(
        (ay) => ay.schoolId === "school-A" && ay.isActive
      );
      expect(activeYearsBefore).toHaveLength(1);
      expect(activeYearsBefore[0].label).toBe("2024-25");

      const { setupSchool } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      const sampleSetupData = {
        name: "Delhi Public School",
        address: "Sector 4, RK Puram, New Delhi",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110022",
        phone: "9811123456",
        email: "dps@school-a.edu",
        principalName: "Dr. V. Sharma",
        establishedYear: 1972,
        board: "CBSE" as const,
        udiseCode: "07010100101",
        academicYearLabel: "2025-26",
        academicYearStart: "2025-04-01",
        academicYearEnd: "2026-03-31",
      };

      const result = await setupSchool(sampleSetupData);
      expect(result.success).toBe(true);

      const activeYearsAfter = mockOperationalDb.academicYears.filter(
        (ay) => ay.schoolId === "school-A" && ay.isActive
      );
      expect(activeYearsAfter).toHaveLength(1);
      expect(activeYearsAfter[0].label).toBe("2025-26");

      // Verify old year is deactivated
      const oldYear = mockOperationalDb.academicYears.find(
        (ay) => ay.label === "2024-25" && ay.schoolId === "school-A"
      );
      expect(oldYear?.isActive).toBe(false);
    });

    it("maintains strict tenant isolation: School A setup does not deactivate School B's active academic year", async () => {
      const schoolBActiveBefore = mockOperationalDb.academicYears.find(
        (ay) => ay.schoolId === "school-B" && ay.isActive
      );
      expect(schoolBActiveBefore).toBeDefined();
      expect(schoolBActiveBefore?.isActive).toBe(true);

      activeSessionRef.current = {
        userId: "user-admin-a",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      const { setupSchool } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      await setupSchool({
        name: "School A Updated",
        address: "Sector 4, RK Puram, New Delhi",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        phone: "9876543210",
        email: "admin@school-a.edu",
        principalName: "Principal A",
        establishedYear: 2010,
        board: "CBSE",
        udiseCode: "07010100101",
        academicYearLabel: "2026-27",
        academicYearStart: "2026-04-01",
        academicYearEnd: "2027-03-31",
      });

      // School B active year remains untouched
      const schoolBActiveAfter = mockOperationalDb.academicYears.find(
        (ay) => ay.schoolId === "school-B" && ay.isActive
      );
      expect(schoolBActiveAfter?.isActive).toBe(true);
      expect(schoolBActiveAfter?.label).toBe("2024-25");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SUITE 3: DUAL-SCORE CALCULATION & OPERATIONAL MILESTONES (F14, F15, F16)
  // ═════════════════════════════════════════════════════════════════════════════
  describe("3. Dual-Score Telemetry & Honest Operational Health Scoring", () => {
    it("verifies dual-score independence: blueprint-provisioned twin has 100% configurationScore but 0% operationalScore", async () => {
      const { getSchoolConfigurationHealthAction } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      const health = await getSchoolConfigurationHealthAction();

      expect(health.configurationScore).toBe(100);
      expect(health.overallScore).toBe(100);
      expect(health.operationalScore).toBe(0);
      expect(health.isOperationallyReady).toBe(false);

      // Category Cards Checks
      const feeCategory = health.categories.find((c) => c.key === "fee-structures");
      expect(feeCategory?.status).toBe("PARTIAL"); // Zero prices show PARTIAL
      expect(health.unpricedFeeHeadsCount).toBe(3);
      expect(feeCategory?.nextBestAction?.href).toBe("/finance/fees");

      const timetableCategory = health.categories.find((c) => c.key === "timetable-bell-schedule");
      expect(timetableCategory).toBeDefined();
      expect(timetableCategory?.status).toBe("NOT_STARTED");

      const enrollmentCategory = health.categories.find((c) => c.key === "enrollment-allocations");
      expect(enrollmentCategory).toBeDefined();
      expect(enrollmentCategory?.status).toBe("NOT_STARTED");
    });

    it("evaluates fee pricing milestone: zero-price heads clamp to PARTIAL, never COMPLETE", async () => {
      const { getSchoolConfigurationHealthAction } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      // Provision bell schedule (8 periods)
      mockOperationalDb.bellSchedule = Array.from({ length: 8 }, (_, i) => ({
        id: `bell-${i + 1}`,
        schoolId: "school-A",
        periodNumber: i + 1,
        isActive: true,
      }));

      // Timetable for all 4 sections
      mockOperationalDb.timetablePeriods = [
        { id: "tt-1", schoolId: "school-A", sectionId: "sec-10a", isActive: true },
        { id: "tt-2", schoolId: "school-A", sectionId: "sec-10b", isActive: true },
        { id: "tt-3", schoolId: "school-A", sectionId: "sec-9a", isActive: true },
        { id: "tt-4", schoolId: "school-A", sectionId: "sec-9b", isActive: true },
      ];

      // Allocations & Students
      mockOperationalDb.sectionSubjectTeachers = [
        { id: "sst-1", schoolId: "school-A", isActive: true },
      ];
      mockOperationalDb.students = [
        { id: "stu-1", schoolId: "school-A", isActive: true },
      ];

      // 2 of 3 fee heads priced -> 1 unpriced head
      mockOperationalDb.feeStructures = [
        { id: "fs-1", schoolId: "school-A", feeHeadId: "fh-1", amount: "5000", isActive: true },
        { id: "fs-2", schoolId: "school-A", feeHeadId: "fh-2", amount: "2000", isActive: true },
      ];

      const partialPricedHealth = await getSchoolConfigurationHealthAction();
      expect(partialPricedHealth.pricedFeeHeadsCount).toBe(2);
      expect(partialPricedHealth.unpricedFeeHeadsCount).toBe(1);

      const feeCategory = partialPricedHealth.categories.find((c) => c.key === "fee-structures");
      expect(feeCategory?.status).toBe("PARTIAL");
      expect(feeCategory?.nextBestAction?.href).toBe("/finance/fees");

      // 4 of 5 milestones green -> 80% operationalScore, NOT ready
      expect(partialPricedHealth.operationalScore).toBe(80);
      expect(partialPricedHealth.isOperationallyReady).toBe(false);

      // Price the 3rd fee head
      mockOperationalDb.feeStructures.push({
        id: "fs-3",
        schoolId: "school-A",
        feeHeadId: "fh-3",
        amount: "1500",
        isActive: true,
      });

      const fullyPricedHealth = await getSchoolConfigurationHealthAction();
      expect(fullyPricedHealth.pricedFeeHeadsCount).toBe(3);
      expect(fullyPricedHealth.unpricedFeeHeadsCount).toBe(0);

      const feeCatFullyPriced = fullyPricedHealth.categories.find((c) => c.key === "fee-structures");
      expect(feeCatFullyPriced?.status).toBe("COMPLETE");

      // All 5 milestones green -> 100% operationalScore, isOperationallyReady === true
      expect(fullyPricedHealth.operationalScore).toBe(100);
      expect(fullyPricedHealth.isOperationallyReady).toBe(true);
    });

    it("requires ALL 5 operational milestones green for 100% operational score and isOperationallyReady", async () => {
      const { getSchoolConfigurationHealthAction } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      // Set up all 5 milestones
      mockOperationalDb.bellSchedule = [{ id: "bell-1", schoolId: "school-A", periodNumber: 1, isActive: true }];
      mockOperationalDb.timetablePeriods = [
        { id: "tt-1", schoolId: "school-A", sectionId: "sec-10a", isActive: true },
        { id: "tt-2", schoolId: "school-A", sectionId: "sec-10b", isActive: true },
        { id: "tt-3", schoolId: "school-A", sectionId: "sec-9a", isActive: true },
        { id: "tt-4", schoolId: "school-A", sectionId: "sec-9b", isActive: true },
      ];
      mockOperationalDb.feeStructures = [
        { id: "fs-1", schoolId: "school-A", feeHeadId: "fh-1", amount: "5000", isActive: true },
        { id: "fs-2", schoolId: "school-A", feeHeadId: "fh-2", amount: "2000", isActive: true },
        { id: "fs-3", schoolId: "school-A", feeHeadId: "fh-3", amount: "1000", isActive: true },
      ];
      mockOperationalDb.sectionSubjectTeachers = [{ id: "sst-1", schoolId: "school-A", isActive: true }];
      mockOperationalDb.students = [{ id: "stu-1", schoolId: "school-A", isActive: true }];

      // Case A: Perfect 5/5
      const allGreen = await getSchoolConfigurationHealthAction();
      expect(allGreen.operationalScore).toBe(100);
      expect(allGreen.isOperationallyReady).toBe(true);

      // Case B: Defect in Bell Schedule (0 periods)
      mockOperationalDb.bellSchedule = [];
      const missingBell = await getSchoolConfigurationHealthAction();
      expect(missingBell.operationalScore).toBe(80);
      expect(missingBell.isOperationallyReady).toBe(false);
      mockOperationalDb.bellSchedule = [{ id: "bell-1", schoolId: "school-A", periodNumber: 1, isActive: true }];

      // Case C: Defect in Timetable Coverage (only 3 of 4 sections scheduled)
      mockOperationalDb.timetablePeriods = [
        { id: "tt-1", schoolId: "school-A", sectionId: "sec-10a", isActive: true },
        { id: "tt-2", schoolId: "school-A", sectionId: "sec-10b", isActive: true },
        { id: "tt-3", schoolId: "school-A", sectionId: "sec-9a", isActive: true },
      ];
      const partialTimetable = await getSchoolConfigurationHealthAction();
      expect(partialTimetable.operationalScore).toBe(80);
      expect(partialTimetable.isOperationallyReady).toBe(false);
      mockOperationalDb.timetablePeriods.push({ id: "tt-4", schoolId: "school-A", sectionId: "sec-9b", isActive: true });

      // Case D: Defect in Teacher Allocations (0 allocations)
      mockOperationalDb.sectionSubjectTeachers = [];
      const missingAlloc = await getSchoolConfigurationHealthAction();
      expect(missingAlloc.operationalScore).toBe(80);
      expect(missingAlloc.isOperationallyReady).toBe(false);
      mockOperationalDb.sectionSubjectTeachers = [{ id: "sst-1", schoolId: "school-A", isActive: true }];

      // Case E: Defect in Student Enrollment (0 students)
      mockOperationalDb.students = [];
      const missingStudents = await getSchoolConfigurationHealthAction();
      expect(missingStudents.operationalScore).toBe(80);
      expect(missingStudents.isOperationallyReady).toBe(false);
    });

    it("verifies Setup Hub returns exactly 8 category cards including new Timetable & Enrollment cards", async () => {
      const { getSchoolConfigurationHealthAction } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );

      const health = await getSchoolConfigurationHealthAction();
      expect(health.categories).toHaveLength(8);

      const categoryKeys = health.categories.map((c) => c.key);
      expect(categoryKeys).toEqual([
        "academic-calendar",
        "classes-sections",
        "curriculum-subjects",
        "fee-structures",
        "timetable-bell-schedule",
        "enrollment-allocations",
        "hr-payroll",
        "calendar-holidays",
      ]);

      const ttCard = health.categories.find((c) => c.key === "timetable-bell-schedule");
      expect(ttCard?.href).toBe("/academics/timetable");

      const enrollCard = health.categories.find((c) => c.key === "enrollment-allocations");
      expect(enrollCard?.href).toBe("/students");
      expect(enrollCard?.secondaryHref).toBe("/academics");
    });
  });
});
