import { db } from "@/db";
import { students, studentFamilyMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { getSignedDownloadUrl } from "@/lib/s3";
import { logAuditEvent } from "@/lib/auditLogger";
import { assertConsent } from "../middleware/consent";

export interface GetStudentProfileInput {
  studentId: string;
  ctx: any;
}

export class StudentsDomainService {
  /**
   * Retrieves a student's full profile, validating DPDP consent and logging PII audit events.
   */
  public static async getStudentProfile(input: GetStudentProfileInput) {
    const { studentId, ctx } = input;

    // 1. Query student record
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
    });

    if (!student) {
      throw new Error("Student profile not found");
    }

    // 2. Assert DPDP parental consent for academic records
    await assertConsent(student.id, "academic_records");

    // 3. Log audit event for PII READ operation
    await logAuditEvent(ctx, {
      action: "READ",
      tableName: "students",
      recordId: student.id,
      purposeId: "academic_records",
      schoolId: student.schoolId,
    });

    // 4. Fetch linked family members
    const familyMembers = await db.query.studentFamilyMembers.findMany({
      where: eq(studentFamilyMembers.studentId, studentId),
    });

    // 5. Generate signed S3 photo URL if present
    let photoUrl = null;
    if (student.photoS3Key) {
      photoUrl = await getSignedDownloadUrl(
        student.photoS3Key,
        process.env.S3_BUCKET_PHOTOS || "schoolmitra-photos",
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
  }
}
