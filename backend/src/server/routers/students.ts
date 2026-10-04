import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { students, studentFamilyMembers } from "@/db/schema";
import { getSignedDownloadUrl } from "@/lib/s3";
import { eq, and } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { logAuditEvent } from "@/lib/auditLogger";
import { assertConsent } from "../middleware/consent";
import { TRPCError } from "@trpc/server";

export const studentsRouter = createTRPCRouter({
  getStudentProfile: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userRole = ctx.session.user.role;
      const userSchoolId = (ctx.session.user as any).schoolId;
      const userId = ctx.session.user.id;

      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.id),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student profile not found",
        });
      }

      // 1. Cross-tenant isolation check
      if (userRole !== "SUPER_ADMIN" && student.schoolId !== userSchoolId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to cross-tenant student records",
        });
      }

      // 2. Student role self-profile boundary check
      if (userRole === "STUDENT" && student.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Students are strictly permitted to view only their own profile",
        });
      }

      // 3. Parent role ward-link boundary check
      if (userRole === "PARENT") {
        const isWardLinked = await ctx.db.query.studentFamilyMembers.findFirst({
          where: and(
            eq(studentFamilyMembers.studentId, student.id),
            eq(studentFamilyMembers.userId, userId),
          ),
        });
        if (!isWardLinked) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied: You are not authorized to view this student profile",
          });
        }
      }

      await assertConsent(student.id, "academic_records");

      await logAuditEvent(ctx, {
        action: "READ",
        tableName: "students",
        recordId: student.id,
        purposeId: "academic_records",
        schoolId: student.schoolId,
      });

      const familyMembers = await ctx.db.query.studentFamilyMembers.findMany({
        where: eq(studentFamilyMembers.studentId, input.id),
      });

      let photoUrl = null;
      if (student.photoS3Key) {
        photoUrl = await getSignedDownloadUrl(
          student.photoS3Key,
          process.env.S3_BUCKET || "schoolmitra-docs",
        );
      }

      return {
        ...student,
        firstName: decryptData(student.firstNameEncrypted),
        middleName: decryptData(student.middleNameEncrypted),
        lastName: decryptData(student.lastNameEncrypted),
        aadhaarLast4: student.aadhaarLast4
          ? `XXXX-XXXX-${student.aadhaarLast4}`
          : null,
        photoUrl,
        family: familyMembers.map((fm) => ({
          ...fm,
          name: decryptData(fm.nameEncrypted),
          mobile: decryptData(fm.mobileEncrypted),
          email: decryptData(fm.emailEncrypted),
          occupation: decryptData(fm.occupationEncrypted),
        })),
      };
    }),
});
