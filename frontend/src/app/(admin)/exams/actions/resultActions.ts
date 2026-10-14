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
  examSchedules,
  markEntries,
  classSubjects,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import {
  buildResultSnapshotPayload,
  getCBSEDefaultRules,
  rankSnapshots,
  calculateGrade,
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

  // 1. Gather all exams involved in this setup
  const examWeightages =
    (setup.examWeightages as Array<{ examId: string; weightPercent: number }>) || [];
  const examIds = examWeightages.map((ew) => ew.examId);

  // 2. Query schedules, marks, and class subjects
  const [schedulesList, entriesList, classSubs] = await Promise.all([
    db.query.examSchedules.findMany({
      where: and(
        eq(examSchedules.schoolId, school.id),
        eq(examSchedules.classId, classId),
        examIds.length > 0 ? inArray(examSchedules.examId, examIds) : undefined,
      ),
      with: { subject: true },
    }),
    classStudents.length > 0
      ? await db.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, school.id),
            examIds.length > 0 ? inArray(markEntries.examId, examIds) : undefined,
            inArray(
              markEntries.studentId,
              classStudents.map((s) => s.id),
            ),
          ),
        })
      : [],
    db.query.classSubjects.findMany({
      where: and(
        eq(classSubjects.schoolId, school.id),
        eq(classSubjects.classId, classId),
      ),
      with: { subject: true },
    }),
  ]);

  // Aggregate subjects for this class
  const classSubjectsMap = new Map<
    string,
    {
      id: string;
      name: string;
      code?: string | null;
      maxMarks: number;
      passingMarks: number;
    }
  >();
  for (const cs of classSubs) {
    if (cs.subject) {
      classSubjectsMap.set(cs.subject.id, {
        id: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        maxMarks: cs.subject.maxMarks || 100,
        passingMarks: cs.subject.passingMarks || 33,
      });
    }
  }
  for (const sc of schedulesList) {
    if (sc.subject && !classSubjectsMap.has(sc.subject.id)) {
      classSubjectsMap.set(sc.subject.id, {
        id: sc.subject.id,
        name: sc.subject.name,
        code: sc.subject.code,
        maxMarks: parseFloat(sc.maxMarks) || 100,
        passingMarks: parseFloat(sc.passingMarks) || 33,
      });
    }
  }

  // Group marks by studentId -> subjectId -> totalObtained
  const studentSubjectMarks = new Map<string, Map<string, number>>();
  for (const entry of entriesList) {
    if (!studentSubjectMarks.has(entry.studentId)) {
      studentSubjectMarks.set(entry.studentId, new Map());
    }
    const subMap = studentSubjectMarks.get(entry.studentId)!;
    const current = subMap.get(entry.subjectId) || 0;
    const num =
      entry.marksObtained !== null && entry.marksObtained !== undefined
        ? parseFloat(entry.marksObtained)
        : 0;
    subMap.set(entry.subjectId, current + num);
  }

  // Build intermediate student payload & scores
  const intermediateList: Array<{
    studentId: string;
    payload: any;
    totalMarks: number;
    percentage: number;
    isPassed: boolean;
  }> = [];

  for (const st of classStudents) {
    const firstName = decryptData(st.firstNameEncrypted) || "Student";
    const lastName = st.lastNameEncrypted
      ? decryptData(st.lastNameEncrypted) || ""
      : "";
    const fullName = `${firstName} ${lastName}`.trim();

    const subMarks = studentSubjectMarks.get(st.id) || new Map<string, number>();
    const subjectsForSnapshot = Array.from(classSubjectsMap.values()).map(
      (sub) => {
        const obtained = subMarks.get(sub.id) ?? 0;
        const pct = sub.maxMarks > 0 ? (obtained / sub.maxMarks) * 100 : 0;
        const gradeRes = calculateGrade(
          {
            marksObtained: obtained,
            maxMarks: sub.maxMarks,
            isAbsent: false,
            isMedicalExempt: false,
          },
          activeRules,
        );
        const isSubPassed = obtained >= sub.passingMarks;

        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code ?? null,
          totalObtained: obtained,
          totalMax: sub.maxMarks,
          percent: Number(pct.toFixed(2)),
          grade: isSubPassed ? gradeRes.grade : "E",
          gradePoint: isSubPassed ? gradeRes.gradePoint : 0,
          isPassed: isSubPassed,
        };
      },
    );

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
      subjects: subjectsForSnapshot,
      rules: activeRules,
    });

    intermediateList.push({
      studentId: st.id,
      payload: snapshotPayload,
      totalMarks: snapshotPayload.summary.totalMarks,
      percentage: snapshotPayload.summary.percentage,
      isPassed: snapshotPayload.summary.resultStatus === "PASSED",
    });
  }

  // Compute Ranks
  const ranks = rankSnapshots(
    intermediateList.map((i) => ({
      studentId: i.studentId,
      totalMarks: i.totalMarks,
      isPassed: i.isPassed,
      percentage: i.percentage,
    })),
  );
  const rankMap = new Map(ranks.map((r) => [r.studentId, r.rank]));

  const createdSnapshots: Array<{ studentId: string }> = [];

  for (const item of intermediateList) {
    item.payload.summary.rank = rankMap.get(item.studentId) || 1;

    // Check existing snapshot
    const existing = await db.query.resultSnapshots.findFirst({
      where: and(
        eq(resultSnapshots.schoolId, school.id),
        eq(resultSnapshots.setupId, setupId),
        eq(resultSnapshots.studentId, item.studentId),
        eq(resultSnapshots.isCurrent, true),
      ),
      orderBy: (t, { desc }) => [desc(t.version)],
    });

    const nextVersion = existing ? existing.version + 1 : 1;

    const [newSnapshot] = await db
      .insert(resultSnapshots)
      .values({
        schoolId: school.id,
        setupId,
        studentId: item.studentId,
        version: nextVersion,
        payload: item.payload,
        frozenById: ctx.userId,
        isCurrent: true,
      })
      .returning();

    if (existing && newSnapshot) {
      await db
        .update(resultSnapshots)
        .set({
          isCurrent: false,
          supersededById: newSnapshot.id,
          updatedAt: new Date(),
        })
        .where(eq(resultSnapshots.id, existing.id));
    }

    if (newSnapshot) {
      createdSnapshots.push({ studentId: item.studentId });
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
