import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AttendanceDomainService,
  MarkBulkAttendanceInput,
} from "../../../server/services/AttendanceDomainService";
import {
  assertTeacherCanMarkAttendance,
  clearTeacherScopeCache,
} from "../scopeResolver";

// Mock DB and Drizzle
const mockInsertedRows: any[] = [];
const mockUpdatedRows: any[] = [];
const mockDomainEvents: any[] = [];
const mockExistingRows: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      execute: vi.fn().mockResolvedValue([{ school_id: "sch-101" }]),
      query: {
        academicYears: {
          findFirst: vi.fn().mockResolvedValue({ id: "ay-2026" }),
        },
        sections: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
        },
        sectionSubjectTeachers: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
        },
        classSubjects: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
        },
        timetablePeriods: {
          findMany: vi.fn(async () => []),
        },
      },
      transaction: vi.fn(async (cb: any) => {
        const tx = {
          execute: vi.fn().mockResolvedValue([{ school_id: "sch-101" }]),
          query: {
            studentAttendance: {
              findFirst: vi.fn(async () => {
                return mockExistingRows[0] || null;
              }),
            },
          },
          insert: vi.fn((table: any) => ({
            values: vi.fn(async (val: any) => {
              if (val.eventType === "AttendanceMarkedEvent") {
                mockDomainEvents.push(val);
              } else {
                mockInsertedRows.push(val);
              }
              return [val];
            }),
          })),
          update: vi.fn((table: any) => ({
            set: vi.fn((updateVals: any) => ({
              where: vi.fn(async (cond: any) => {
                mockUpdatedRows.push(updateVals);
                return [updateVals];
              }),
            })),
          })),
        };
        return await cb(tx);
      }),
    },
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue([{ school_id: schoolId }]),
        query: {
          academicYears: {
            findFirst: vi.fn().mockResolvedValue({ id: "ay-2026" }),
          },
          sections: {
            findFirst: vi.fn(async () => null),
            findMany: vi.fn(async () => []),
          },
          sectionSubjectTeachers: {
            findFirst: vi.fn(async () => null),
            findMany: vi.fn(async () => []),
          },
          classSubjects: {
            findFirst: vi.fn(async () => null),
            findMany: vi.fn(async () => []),
          },
          timetablePeriods: {
            findMany: vi.fn(async () => []),
          },
        },
      };
      return await cb(mockTx);
    }),
  };
});

describe("Phase T4: Attendance Domain & Outbox Event Emission (AC-T3, AC-T5)", () => {
  const schoolId = "sch-101";
  const sectionId = "sec-8b";
  const academicYearId = "ay-2026";
  const teacherUserId = "teacher-usr-01";
  const today = new Date("2026-10-21T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertedRows.length = 0;
    mockUpdatedRows.length = 0;
    mockDomainEvents.length = 0;
    mockExistingRows.length = 0;
    clearTeacherScopeCache();
  });

  describe("AC-T3: Bulk Attendance Saving & Idempotency", () => {
    it("writes full-section attendance records with markedById attribution", async () => {
      const input: MarkBulkAttendanceInput = {
        schoolId,
        sectionId,
        academicYearId,
        date: today,
        markedByUserId: teacherUserId,
        records: [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s2", status: "ABSENT" },
          { studentId: "s3", status: "LATE" },
          { studentId: "s4", status: "LEAVE" },
        ],
      };

      const result = await AttendanceDomainService.markBulkAttendance(input);

      expect(result.totalPresent).toBe(1);
      expect(result.totalAbsent).toBe(1);
      expect(result.totalRecords).toBe(4);

      // Verify rows inserted with correct markedById attribution
      expect(mockInsertedRows.length).toBe(4);
      mockInsertedRows.forEach((row) => {
        expect(row.schoolId).toBe(schoolId);
        expect(row.sectionId).toBe(sectionId);
        expect(row.academicYearId).toBe(academicYearId);
        expect(row.markedById).toBe(teacherUserId);
      });
    });

    it("updates existing records rather than duplicating (idempotent replay)", async () => {
      // Pre-seed an existing row in DB
      mockExistingRows.push({
        id: "att-rec-existing",
        studentId: "student-existing",
        status: "PRESENT",
      });

      const input: MarkBulkAttendanceInput = {
        schoolId,
        sectionId,
        academicYearId,
        date: today,
        markedByUserId: teacherUserId,
        records: [
          { studentId: "student-existing", status: "ABSENT" },
        ],
      };

      await AttendanceDomainService.markBulkAttendance(input);

      // Should have called update on the existing record
      expect(mockUpdatedRows.length).toBe(1);
      expect(mockUpdatedRows[0].status).toBe("ABSENT");
      expect(mockUpdatedRows[0].markedById).toBe(teacherUserId);
    });
  });

  describe("AC-T5: Cross-Role Event Emission via Durable Outbox", () => {
    it("emits AttendanceMarkedEvent into domain_events outbox table with sectionId, date, and counts", async () => {
      const input: MarkBulkAttendanceInput = {
        schoolId,
        sectionId,
        academicYearId,
        date: today,
        markedByUserId: teacherUserId,
        records: [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s2", status: "PRESENT" },
          { studentId: "s3", status: "ABSENT" },
        ],
      };

      await AttendanceDomainService.markBulkAttendance(input);

      // Verify outbox insertion
      expect(mockDomainEvents.length).toBe(1);
      const event = mockDomainEvents[0];
      expect(event.eventType).toBe("AttendanceMarkedEvent");
      expect(event.schoolId).toBe(schoolId);
      expect(event.aggregateId).toBe(sectionId);
      expect(event.status).toBe("PENDING");
      expect(event.payload).toEqual({
        sectionId,
        date: "2026-10-21",
        totalPresent: 2,
        totalAbsent: 1,
        markedByUserId: teacherUserId,
      });
    });
  });

  describe("AC-T2 / AC-T3 Guard Suite: Teacher Scope Assertion", () => {
    it("throws 403 TeacherScopeError when teacher is not assigned to the section", async () => {
      await expect(
        assertTeacherCanMarkAttendance("unauthorized-teacher", "sec-unauthorized")
      ).rejects.toThrow(/not authorized to mark attendance for section/);
    });
  });
});
