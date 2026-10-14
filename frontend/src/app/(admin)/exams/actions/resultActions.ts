"use server";

import { db } from "@/db";
import {
  reportCardSetups,
  resultSettings,
  resultSnapshots,
  resultHolds,
  certificates,
  students,
  gradeRules,
  classes,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import {
  buildResultSnapshotPayload,
  getCBSEDefaultRules,
} from "@/lib/gradeEngine";
import { decryptData } from "@/lib/encryption";

const RESULT_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export async function createReportCardSetup(input: {
  academicYearId: string;
  name: string;
  examWeightages: Array<{ examId: string; weightPercent: number }>;
  layout?: Record<string, unknown>;
}) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const [setup] = await db
    .insert(reportCardSetups)
    .values({
      schoolId: school.id,
      academicYearId: input.academicYearId,
      name: input.name,
      examWeightages: input.examWeightages,
      layout: input.layout ?? {},
      isActive: true,
      createdById: ctx.userId,
    })
    .returning();

  revalidatePath("/exams/results");
  return { success: true, setup };
}

export async function publishResults(setupId: string) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const settings = await db.query.resultSettings.findFirst({
    where: and(
      eq(resultSettings.schoolId, school.id),
      eq(resultSettings.setupId, setupId),
    ),
  });

  if (settings) {
    await db
      .update(resultSettings)
      .set({
        withholdAll: false,
        releaseAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(resultSettings.id, settings.id));
  } else {
    await db.insert(resultSettings).values({
      schoolId: school.id,
      setupId,
      withholdAll: false,
      releaseAt: new Date(),
      feeLockMode: "OFF",
      feeLockThresholdAmount: "0.00",
      publicLookupEnabled: true,
      publicToppersEnabled: true,
    });
  }

  revalidatePath("/exams/results");
  revalidatePath("/portal/results");
  return { success: true };
}

export async function configureResultSettings(input: {
  setupId: string;
  withholdAll?: boolean;
  releaseAt?: string | null;
  feeLockMode: "OFF" | "SOFT" | "HARD" | "SOFT_WARNING" | "HARD_LOCK";
  feeLockThresholdAmount: number;
  publicLookupEnabled?: boolean;
  publicToppersEnabled?: boolean;
}) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const normalizedFeeLockMode: "OFF" | "SOFT" | "HARD" =
    input.feeLockMode === "SOFT_WARNING"
      ? "SOFT"
      : input.feeLockMode === "HARD_LOCK"
      ? "HARD"
      : input.feeLockMode;

  const existing = await db.query.resultSettings.findFirst({
    where: and(
      eq(resultSettings.schoolId, school.id),
      eq(resultSettings.setupId, input.setupId),
    ),
  });

  const releaseAtVal = input.releaseAt ? new Date(input.releaseAt) : null;

  if (existing) {
    await db
      .update(resultSettings)
      .set({
        withholdAll: input.withholdAll ?? existing.withholdAll,
        releaseAt: releaseAtVal,
        feeLockMode: normalizedFeeLockMode,
        feeLockThresholdAmount: input.feeLockThresholdAmount.toFixed(2),
        publicLookupEnabled: input.publicLookupEnabled ?? existing.publicLookupEnabled,
        publicToppersEnabled: input.publicToppersEnabled ?? existing.publicToppersEnabled,
        updatedAt: new Date(),
      })
      .where(eq(resultSettings.id, existing.id));
  } else {
    await db.insert(resultSettings).values({
      schoolId: school.id,
      setupId: input.setupId,
      withholdAll: input.withholdAll ?? false,
      releaseAt: releaseAtVal,
      feeLockMode: normalizedFeeLockMode,
      feeLockThresholdAmount: input.feeLockThresholdAmount.toFixed(2),
      publicLookupEnabled: input.publicLookupEnabled ?? false,
      publicToppersEnabled: input.publicToppersEnabled ?? false,
    });
  }

  revalidatePath("/exams/results");
  revalidatePath("/portal/results");
  return { success: true };
}

export async function setResultHold(input: {
  setupId: string;
  studentId: string;
  isHeld: boolean;
  reason?: string;
}) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const existing = await db.query.resultHolds.findFirst({
    where: and(
      eq(resultHolds.schoolId, school.id),
      eq(resultHolds.setupId, input.setupId),
      eq(resultHolds.studentId, input.studentId),
    ),
  });

  if (input.isHeld) {
    if (existing) {
      await db
        .update(resultHolds)
        .set({
          reason: input.reason ?? existing.reason,
          updatedAt: new Date(),
        })
        .where(eq(resultHolds.id, existing.id));
    } else {
      await db.insert(resultHolds).values({
        schoolId: school.id,
        setupId: input.setupId,
        studentId: input.studentId,
        reason: input.reason ?? "Result withheld by administration",
        placedById: ctx.userId,
      });
    }
  } else {
    if (existing) {
      await db.delete(resultHolds).where(eq(resultHolds.id, existing.id));
    }
  }

  revalidatePath("/exams/results");
  revalidatePath("/portal/results");
  return { success: true };
}

export async function generateResultSnapshots(
  setupId: string,
  classId: string,
) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const setup = await db.query.reportCardSetups.findFirst({
    where: and(
      eq(reportCardSetups.id, setupId),
      eq(reportCardSetups.schoolId, school.id),
    ),
  });

  if (!setup) return { success: false, message: "Report card setup not found" };

  const classRecord = await db.query.classes.findFirst({
    where: and(eq(classes.id, classId), eq(classes.schoolId, school.id)),
  });

  if (!classRecord) return { success: false, message: "Class not found" };

  const classStudents = await db.query.students.findMany({
    where: and(
      eq(students.currentClassId, classId),
      eq(students.schoolId, school.id),
      eq(students.isActive, true),
    ),
  });

  const rules = await db.query.gradeRules.findMany({
    where: and(
      eq(gradeRules.schoolId, school.id),
      eq(gradeRules.classId, classId),
    ),
  });

  const activeRules = rules.length > 0
    ? rules.map((r) => ({
        minPercent: parseFloat(r.minPercent),
        maxPercent: parseFloat(r.maxPercent),
        grade: r.grade,
        gradePoint: parseFloat(r.gradePoint),
        description: r.description,
      }))
    : getCBSEDefaultRules();

  const createdSnapshots: Array<{ studentId: string }> = [];

  for (const st of classStudents) {
    const firstName = decryptData(st.firstNameEncrypted) || "Student";
    const lastName = st.lastNameEncrypted ? decryptData(st.lastNameEncrypted) || "" : "";
    const fullName = `${firstName} ${lastName}`.trim();

    const snapshotPayload = buildResultSnapshotPayload({
      schoolId: school.id,
      setupId,
      student: {
        id: st.id,
        name: fullName,
        rollNumber: st.rollNumber,
        admissionNumber: st.admissionNumber,
        classId: classRecord.id,
        className: classRecord.displayName,
      },
      subjects: [],
      rules: activeRules,
    });

    const [snapshot] = await db
      .insert(resultSnapshots)
      .values({
        schoolId: school.id,
        setupId,
        studentId: st.id,
        version: 1,
        payload: snapshotPayload,
        frozenById: ctx.userId,
      })
      .returning();

    if (snapshot) {
      createdSnapshots.push({ studentId: st.id });
    }
  }

  revalidatePath("/exams/results");
  return { success: true, count: createdSnapshots.length };
}

export async function issueTopperCertificate(
  studentId: string,
  examId: string,
  rank: number,
  title?: string,
) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const yearStr = new Date().getFullYear();
  const certNum = `CERT/${yearStr}/TOPPER/${Date.now().toString().slice(-6)}`;

  const [cert] = await db
    .insert(certificates)
    .values({
      schoolId: school.id,
      studentId,
      certificateType: "TOPPER",
      certificateNumber: certNum,
      issuedDate: new Date(),
      issuedById: ctx.userId,
      remarks: `Issued to Topper with Class Rank ${rank}${title ? ` - ${title}` : ""}`,
    })
    .returning();

  return {
    success: true,
    certificate: cert,
    message: `Successfully issued certificate ${certNum}`,
  };
}
