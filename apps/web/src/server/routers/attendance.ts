import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { studentAttendance, sections, studentClassHistory, students, auditLogs, academicYears } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { TRPCError } from "@trpc/server";
import { logAuditEvent } from "@/lib/auditLogger";

export const attendanceRouter = createTRPCRouter({

  // 1. Fetch available sections for the logged-in user (Teacher sees only their class; admin sees all)
  getAssignedSections: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const userRole = ctx.session.user.role;

    if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(userRole)) {
      return await ctx.db.query.sections.findMany({
        where: eq(sections.isActive, true),
        with: {
          class: true,
        }
      });
    }

    // Filter by classTeacherId for TEACHER
    return await ctx.db.query.sections.findMany({
      where: and(
        eq(sections.isActive, true),
        eq(sections.classTeacherId, userId)
      ),
      with: {
        class: true,
      }
    });
  }),

  // 2. Fetch students in a section and their attendance status on a specific date
  getSectionStudents: protectedProcedure
    .input(z.object({
      sectionId: z.string().uuid(),
      date: z.string(), // ISO string date
    }))
    .query(async ({ ctx, input }) => {
      const parsedDate = new Date(input.date);
      // Start/end of day logic to query records on that specific date
      const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));

      // Resolve current active academic year
      const activeYear = await ctx.db.query.academicYears.findFirst({
        where: eq(academicYears.isActive, true),
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
          eq(studentClassHistory.academicYearId, activeYear.id)
        ),
        with: {
          student: true,
        }
      });

      // Fetch existing attendance records for these students on the selected date
      const attendanceRecords = await ctx.db.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.sectionId, input.sectionId),
          eq(studentAttendance.academicYearId, activeYear.id),
          and(
            sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
            sql`${studentAttendance.attendanceDate} <= ${endOfDay}`
          )
        ),
      });

      const attendanceMap = new Map(
        attendanceRecords.map(r => [r.studentId, { status: r.status, remarks: r.remarks, id: r.id }])
      );

      // Map history back to a decrypted student list with existing attendance status
      return history.map((h) => {
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
      }).sort((a, b) => {
        const rollA = parseInt(a.rollNumber || "0", 10);
        const rollB = parseInt(b.rollNumber || "0", 10);
        return rollA - rollB;
      });
    }),

  // 3. Mark or Update attendance for students
  markSectionAttendance: protectedProcedure
    .input(z.object({
      sectionId: z.string().uuid(),
      date: z.string(), // ISO string date
      records: z.array(z.object({
        studentId: z.string().uuid(),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE", "HOLIDAY"]),
        remarks: z.string().optional(),
      })),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userRole = ctx.session.user.role;
      const schoolId = ctx.session.user.schoolId;

      if (!schoolId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User session does not specify schoolId.",
        });
      }

      // Strict check: Teachers can only mark attendance of their assigned sections
      if (userRole === "TEACHER") {
        const assignedSection = await ctx.db.query.sections.findFirst({
          where: and(
            eq(sections.id, input.sectionId),
            eq(sections.classTeacherId, userId)
          )
        });

        if (!assignedSection) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access Denied: You can only mark attendance for your assigned section.",
          });
        }
      }

      // Resolve current active academic year
      const activeYear = await ctx.db.query.academicYears.findFirst({
        where: eq(academicYears.isActive, true),
      });

      if (!activeYear) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active academic year found.",
        });
      }

      const parsedDate = new Date(input.date);
      const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));

      // Execute bulk insert/update in a transaction
      await ctx.db.transaction(async (tx) => {
        for (const record of input.records) {
          // Look for existing attendance record on this date
          const [existingRecord] = await tx
            .select()
            .from(studentAttendance)
            .where(and(
              eq(studentAttendance.studentId, record.studentId),
              eq(studentAttendance.academicYearId, activeYear.id),
              and(
                sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
                sql`${studentAttendance.attendanceDate} <= ${endOfDay}`
              )
            ))
            .limit(1);

          let markedRecordId = "";

          if (existingRecord) {
            markedRecordId = existingRecord.id;
            await tx
              .update(studentAttendance)
              .set({
                status: record.status,
                markedById: userId,
                remarks: record.remarks || null,
                updatedAt: new Date(),
              })
              .where(eq(studentAttendance.id, existingRecord.id));
          } else {
            const [newRecord] = await tx
              .insert(studentAttendance)
              .values({
                schoolId,
                studentId: record.studentId,
                sectionId: input.sectionId,
                academicYearId: activeYear.id,
                attendanceDate: parsedDate,
                status: record.status,
                markedById: userId,
                remarks: record.remarks || null,
              })
              .returning({ id: studentAttendance.id });
            markedRecordId = newRecord?.id || "";
          }

          // DPDP compliance: write to audit log
          await logAuditEvent(ctx, {
            action: existingRecord ? "WRITE" : "WRITE", // BOTH are writes (update vs insert)
            tableName: "student_attendance",
            recordId: markedRecordId,
            purposeId: "attendance",
            schoolId,
            metadata: { studentId: record.studentId, status: record.status }
          });
        }
      });

      return { success: true };
    }),

});
