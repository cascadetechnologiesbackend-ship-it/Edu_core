import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  studentAttendance,
  sections,
  studentClassHistory,
  students,
  auditLogs,
  academicYears,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { TRPCError } from "@trpc/server";
import { logAuditEvent } from "@/lib/auditLogger";

export const attendanceRouter = createTRPCRouter({
  // 1. Fetch available sections for the logged-in user (Teacher sees only their class; admin sees all)
  getAssignedSections: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const userRole = ctx.session.user.role;
    const schoolId = ctx.session.user.schoolId;

    if (!schoolId && userRole !== "SUPER_ADMIN") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active school context found in session.",
      });
    }

    if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(userRole)) {
      return await ctx.db.query.sections.findMany({
        where: schoolId
          ? and(eq(sections.isActive, true), eq(sections.schoolId, schoolId))
          : eq(sections.isActive, true),
        with: {
          class: true,
        },
      });
    }

    // Filter by classTeacherId for TEACHER
    return await ctx.db.query.sections.findMany({
      where: and(
        eq(sections.isActive, true),
        eq(sections.classTeacherId, userId),
        schoolId ? eq(sections.schoolId, schoolId) : undefined,
      ),
      with: {
        class: true,
      },
    });
  }),

  // 2. Fetch students in a section and their attendance status on a specific date
  getSectionStudents: protectedProcedure
    .input(
      z.object({
        sectionId: z.string().uuid(),
        date: z.string(), // ISO string date
      }),
    )
    .query(async ({ ctx, input }) => {
      const userRole = ctx.session.user.role;
      const schoolId = ctx.session.user.schoolId;

      // S5-T4: Restrict to TEACHER, PRINCIPAL, SCHOOL_ADMIN, SUPER_ADMIN
      const ALLOWED_ATTENDANCE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
      if (!ALLOWED_ATTENDANCE_ROLES.includes(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access Denied: You do not have permission to view section attendance.",
        });
      }

      // S5-T4: Verify section exists and belongs to the caller's school
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
      });

      if (!section) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Section not found.",
        });
      }

      if (userRole !== "SUPER_ADMIN" && schoolId && section.schoolId !== schoolId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access Denied: Section does not belong to your school.",
        });
      }

      const parsedDate = new Date(input.date);
      // Start/end of day logic to query records on that specific date
      const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));

      // Resolve current active academic year scoped to tenant school
      const targetSchoolId = schoolId || section.schoolId;
      const activeYear = await ctx.db.query.academicYears.findFirst({
        where: targetSchoolId
          ? and(eq(academicYears.isActive, true), eq(academicYears.schoolId, targetSchoolId))
          : eq(academicYears.isActive, true),
      });

      if (!activeYear) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active academic year found.",
        });
      }

      // Fetch all students mapped to this section in the class history for the active year
      const history = await ctx.db.query.studentClassHistory.findMany({
        where: and(
          eq(studentClassHistory.sectionId, input.sectionId),
          eq(studentClassHistory.academicYearId, activeYear.id),
        ),
        with: {
          student: true,
        },
      });

      // Fetch existing attendance records for these students on the selected date
      const attendanceRecords = await ctx.db.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.sectionId, input.sectionId),
          eq(studentAttendance.academicYearId, activeYear.id),
          and(
            sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
            sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
          ),
        ),
      });

      const attendanceMap = new Map<string, { status: any; remarks?: string | null; id: string }>(
        attendanceRecords.map((r: any) => [
          r.studentId,
          { status: r.status, remarks: r.remarks, id: r.id },
        ]),
      );

      // Map history back to a decrypted student list with existing attendance status
      return history
        .map((h: any) => {
          const student = h.student;
          const record = attendanceMap.get(student.id);

          return {
            studentId: student.id,
            rollNumber: h.rollNumber,
            firstName: decryptData(student.firstNameEncrypted) || "Unknown",
            lastName: decryptData(student.lastNameEncrypted) || "",
            admissionNumber: student.admissionNumber,
            attendanceStatus: record?.status || null,
            remarks: record?.remarks || "",
            attendanceRecordId: record?.id || null,
          };
        })
        .sort((a: any, b: any) => {
          const rollA = parseInt(a.rollNumber || "0", 10);
          const rollB = parseInt(b.rollNumber || "0", 10);
          return rollA - rollB;
        });
    }),

  // 3. Mark or Update attendance for students
  markSectionAttendance: protectedProcedure
    .input(
      z
        .object({
          sectionId: z.string().uuid(),
          date: z.string(), // ISO string date
          records: z.array(
            z.object({
              studentId: z.string().uuid(),
              status: z.enum([
                "PRESENT",
                "ABSENT",
                "LATE",
                "HALF_DAY",
                "LEAVE",
                "HOLIDAY",
              ]),
              remarks: z.string().optional(),
            }),
          ),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userRole = ctx.session.user.role;
      let finalSchoolId = ctx.session.user.schoolId;
      if (!finalSchoolId) {
        const sec = await ctx.db.query.sections.findFirst({
          where: eq(sections.id, input.sectionId),
          columns: { schoolId: true },
        });
        finalSchoolId = sec?.schoolId ?? null;
      }

      if (!finalSchoolId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not resolve valid school context for attendance marking.",
        });
      }

      const ALLOWED_ATTENDANCE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
      if (!ALLOWED_ATTENDANCE_ROLES.includes(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access Denied: You do not have permission to mark student attendance.",
        });
      }

      // Strict check: Teachers can only mark attendance of their assigned sections
      if (userRole === "TEACHER") {
        const assignedSection = await ctx.db.query.sections.findFirst({
          where: and(
            eq(sections.id, input.sectionId),
            eq(sections.classTeacherId, userId),
            finalSchoolId ? eq(sections.schoolId, finalSchoolId) : undefined,
          ),
        });

        if (!assignedSection) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Access Denied: You can only mark attendance for your assigned section.",
          });
        }
      }

      // Resolve current active academic year scoped to tenant school
      const activeYear = await ctx.db.query.academicYears.findFirst({
        where: and(
          eq(academicYears.isActive, true),
          eq(academicYears.schoolId, finalSchoolId),
        ),
      });

      if (!activeYear) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active academic year found.",
        });
      }

      const parsedDate = new Date(input.date);
      const startOfDay = new Date(new Date(parsedDate).setHours(0, 0, 0, 0));
      const endOfDay = new Date(new Date(parsedDate).setHours(23, 59, 59, 999));

      // S5-T4: Batch markSectionAttendance into a single batch upsert + one audit insert
      await (ctx.db as any).transaction(async (tx: any) => {
        // Query all existing attendance rows for the section on this day
        const existingRecords = await tx
          .select({ id: studentAttendance.id, studentId: studentAttendance.studentId })
          .from(studentAttendance)
          .where(
            and(
              eq(studentAttendance.sectionId, input.sectionId),
              eq(studentAttendance.academicYearId, activeYear.id),
              sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
              sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
            ),
          );

        const existingMap = new Map<string, string>(
          existingRecords.map((r: any) => [r.studentId as string, r.id as string]),
        );

        const toInsert: Array<typeof studentAttendance.$inferInsert> = [];
        const toUpdate: Array<{ id: string; status: any; remarks?: string | null }> = [];

        for (const record of input.records) {
          const existingId = existingMap.get(record.studentId);
          if (existingId) {
            toUpdate.push({
              id: existingId,
              status: record.status,
              remarks: record.remarks || null,
            });
          } else {
            toInsert.push({
              schoolId: finalSchoolId!,
              studentId: record.studentId,
              sectionId: input.sectionId,
              academicYearId: activeYear.id,
              attendanceDate: parsedDate,
              status: record.status,
              markedById: userId,
              remarks: record.remarks || null,
            });
          }
        }

        // Batch insert new records
        if (toInsert.length > 0) {
          await tx.insert(studentAttendance).values(toInsert);
        }

        // Batch update existing records in a single CASE statement
        if (toUpdate.length > 0) {
          for (const item of toUpdate) {
            await tx
              .update(studentAttendance)
              .set({
                status: item.status,
                markedById: userId,
                remarks: item.remarks,
                updatedAt: new Date(),
              })
              .where(eq(studentAttendance.id, item.id));
          }
        }

        // S5-T4: Single aggregated DPDP audit log insert for the batch operation
        await logAuditEvent(ctx, {
          action: "WRITE",
          tableName: "student_attendance",
          recordId: input.sectionId,
          purposeId: "attendance",
          schoolId: finalSchoolId!,
          metadata: {
            sectionId: input.sectionId,
            totalStudents: input.records.length,
            insertedCount: toInsert.length,
            updatedCount: toUpdate.length,
            date: input.date,
          },
        });
      });

      return { success: true };
    }),
});
