import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { admissionApplications, admissionWorkflowSteps } from "@/db/schema";
import { createAdmissionApplicationSchema } from "@schoolmitra/validators";
import { generateUploadUrl } from "@/lib/s3";
import { logAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";
import { encryptData } from "@/lib/encryption";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export const admissionsRouter = createTRPCRouter({
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.enum(ALLOWED_MIME_TYPES, {
          errorMap: () => ({ message: "Only PDF, JPEG, PNG, and WEBP files are permitted" }),
        }),
        fileSizeBytes: z.number().max(10 * 1024 * 1024, "File size must not exceed 10 MB").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userSchoolId = ctx.session?.user?.schoolId;
      const keyPrefix = userSchoolId ? `schools/${userSchoolId}/admissions` : "admissions";
      const key = `${keyPrefix}/${crypto.randomUUID()}-${input.fileName}`;
      const url = await generateUploadUrl(
        key,
        process.env.S3_BUCKET || "schoolmitra-docs",
        input.mimeType,
      );
      return { uploadUrl: url, key };
    }),

  submitApplication: protectedProcedure
    .input(createAdmissionApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const targetSchoolId = ctx.session?.user?.schoolId || input.schoolId;
      if (!targetSchoolId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "School context could not be derived from authenticated session.",
        });
      }

      // Cross-tenant protection: If user provided schoolId differs from session schoolId
      if (ctx.session?.user?.schoolId && input.schoolId && input.schoolId !== ctx.session.user.schoolId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cross-tenant admission submission attempt denied.",
        });
      }

      const admissionNum = `APP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

      const [application] = await ctx.db
        .insert(admissionApplications)
        .values({
          schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
        });
      }

      return application;
    }),
});
