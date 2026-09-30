import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { admissionApplications, admissionWorkflowSteps } from "@/db/schema";
import { createAdmissionApplicationSchema } from "@schoolmitra/validators";
import { generateUploadUrl } from "@/lib/s3";
import { logAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export const admissionsRouter = createTRPCRouter({
  getUploadUrl: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const key = `admissions/${crypto.randomUUID()}-${input.fileName}`;
      const url = await generateUploadUrl(
        key,
        process.env.S3_BUCKET || "schoolmitra-docs",
        input.mimeType,
      );
      return { uploadUrl: url, key };
    }),

  submitApplication: publicProcedure
    .input(createAdmissionApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const admissionNum = `APP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

      const [application] = await ctx.db
        .insert(admissionApplications)
        .values({
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          applicationNumber: admissionNum,
          applicantNameEncrypted: encryptData(input.applicantName),
          dateOfBirth: new Date(input.dateOfBirth),
          gender: input.gender,
          category: input.category,
          gradeAppliedFor: input.gradeAppliedFor,
          previousSchool: input.previousSchool ?? null,
          fatherNameEncrypted: encryptData(input.fatherName),
          motherNameEncrypted: encryptData(input.motherName),
          guardianNameEncrypted: input.guardianName
            ? encryptData(input.guardianName)
            : null,
          primaryContactMobileEncrypted: encryptData(
            input.primaryContactMobile,
          ),
          primaryContactEmailEncrypted: encryptData(input.primaryContactEmail),
          addressEncrypted: encryptData(input.address),
          pincode: input.pincode,
          isRteApplicant: input.isRteApplicant,
          hasSiblingInSchool: input.hasSiblingInSchool,
          siblingStudentId: input.siblingStudentId ?? null,
        })
        .returning({
          id: admissionApplications.id,
          applicationNumber: admissionApplications.applicationNumber,
        });

      if (application) {
        await ctx.db.insert(admissionWorkflowSteps).values({
          applicationId: application.id,
          schoolId: input.schoolId,
          stepNumber: 1,
          stepName: "APPLICATION_SUBMITTED",
          status: "COMPLETED",
          completedAt: new Date(),
          notes: "Application submitted successfully",
        });

        // Log the PII write
        await logAuditEvent(ctx, {
          action: "WRITE",
          tableName: "admission_applications",
          recordId: application.id,
          purposeId: "admission_data",
          schoolId: input.schoolId,
        });
      }

      return application;
    }),
});
