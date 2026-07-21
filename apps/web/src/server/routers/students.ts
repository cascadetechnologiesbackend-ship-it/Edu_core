import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { students, studentFamilyMembers } from "@/db/schema";
import { getSignedDownloadUrl } from "@/lib/s3";
import { eq } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { logAuditEvent } from "@/lib/auditLogger";
import { assertConsent } from "../middleware/consent";

export const studentsRouter = createTRPCRouter({
  getStudentProfile: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.id),
      });

      if (!student) {
        throw new Error("Student not found");
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
