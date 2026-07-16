import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { students, studentFamilyMembers } from "@/db/schema";
import { getSignedDownloadUrl } from "@/lib/s3";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return encryptedText;
    const ivHex = parts[0];
    const encryptedHex = parts[1];
    if (!ivHex || !encryptedHex) return encryptedText;
    
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return encryptedText;
  }
}

import { logAuditEvent } from "@/lib/auditLogger";

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
        photoUrl = await getSignedDownloadUrl(student.photoS3Key, process.env.S3_BUCKET || "schoolmitra-docs");
      }

      return {
        ...student,
        firstName: decryptData(student.firstNameEncrypted),
        middleName: decryptData(student.middleNameEncrypted),
        lastName: decryptData(student.lastNameEncrypted),
        aadhaarLast4: student.aadhaarLast4 ? `XXXX-XXXX-${student.aadhaarLast4}` : null,
        photoUrl,
        family: familyMembers.map(fm => ({
          ...fm,
          name: decryptData(fm.nameEncrypted),
          mobile: decryptData(fm.mobileEncrypted),
          email: decryptData(fm.emailEncrypted),
          occupation: decryptData(fm.occupationEncrypted),
        }))
      };
    }),

});
