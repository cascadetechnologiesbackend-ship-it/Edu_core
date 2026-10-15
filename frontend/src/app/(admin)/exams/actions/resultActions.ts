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
  reportCards,
  studentSubjectEnrollments,
  examMarkDistributions,
  examComponents,
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
  calculateRanks,
  calculateComponentMarks,
  UNENROLLED_SENTINEL,
  ABSENT_GRADE,
  MEDICAL_EXEMPT_GRADE,
  FAIL_GRADE,
} from "@/lib/gradeEngine";
import { resolveGradeRules, gradeToClassGroup } from "@/lib/gradeRuleResolver";
import { decryptData } from "@/lib/encryption";
import { notifyResultReleased } from "@/lib/examNotifications";

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

import {
  verifySetupOwnership,
  verifyStudentOwnership,
  verifyClassOwnership,
  verifyExamOwnership,
} from "@/lib/examIsolation";

export async function publishResults(setupId: string) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const setupVerification = await verifySetupOwnership(school.id, setupId, ctx, "publishResults");
  if (!setupVerification.success) {
    return { success: false, error: setupVerification.error, message: setupVerification.message };
  }

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
      smsNotificationsEnabled: false,
    });
  }

  // S11 Layer 3: Dispatch Result Released Notification (fail-safe without blocking mutation)
  try {
    await notifyResultReleased({
      schoolId: school.id,
      setupId,
      triggeredById: ctx.userId,
    });
  } catch (notifErr) {
    console.error("[publishResults] Notification dispatch error:", notifErr);
  }

  revalidatePath("/exams/results");
  revalidatePath("/exams/report-cards");
  revalidatePath("/exams/report-cards/settings");
  revalidatePath("/portal/results");
  revalidatePath("/portal/report-cards");
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
  smsNotificationsEnabled?: boolean;
}) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const setupVerification = await verifySetupOwnership(school.id, input.setupId, ctx, "configureResultSettings");
  if (!setupVerification.success) {
    return { success: false, error: setupVerification.error, message: setupVerification.message };
  }

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
        smsNotificationsEnabled: input.smsNotificationsEnabled ?? existing.smsNotificationsEnabled,
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
      smsNotificationsEnabled: input.smsNotificationsEnabled ?? false,
    });
  }

  revalidatePath("/exams/results");
  revalidatePath("/exams/report-cards");
  revalidatePath("/exams/report-cards/settings");
  revalidatePath("/portal/results");
  revalidatePath("/portal/report-cards");
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

  const setupVerification = await verifySetupOwnership(school.id, input.setupId, ctx, "setResultHold");
  if (!setupVerification.success) {
    return { success: false, error: setupVerification.error, message: setupVerification.message };
  }

  const studentVerification = await verifyStudentOwnership(school.id, input.studentId, ctx, "setResultHold");
  if (!studentVerification.success) {
    return { success: false, error: studentVerification.error, message: studentVerification.message };
  }

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
  revalidatePath("/exams/report-cards");
  revalidatePath("/exams/report-cards/settings");
  revalidatePath("/portal/results");
  revalidatePath("/portal/report-cards");
  return { success: true };
}

export async function generateResultSnapshots(
  setupId: string,
  classId: string,
) {
  const ctx = await requireAuth(RESULT_ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.result.publish");
  const school = await requireSchool(ctx);

  const setupVerification = await verifySetupOwnership(school.id, setupId, ctx, "generateResultSnapshots");
  if (!setupVerification.success) {
    return { success: false, error: setupVerification.error, message: setupVerification.message };
  }
  const setup = setupVerification.data!;

  const classVerification = await verifyClassOwnership(school.id, classId, ctx, "generateResultSnapshots");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }
  const classRecord = classVerification.data!;

  const classStudents = await db.query.students.findMany({
    where: and(
      eq(students.currentClassId, classId),
      eq(students.schoolId, school.id),
      eq(students.isActive, true),
    ),
  });

  const studentIds = classStudents.map((s) => s.id);

  // 1. Unified Grade Rules Resolution (Class -> ClassGroup -> CBSE Default)
  const activeRules = await resolveGradeRules(
    school.id,
    classId,
    gradeToClassGroup(classRecord.gradeLevel),
  );

  // 2. Gather all exams involved in this setup
  const examWeightages =
    (setup.examWeightages as Array<{ examId: string; weightPercent: number }>) || [];
  const examIds = examWeightages.map((ew) => ew.examId);

  // 3. Query schedules, marks, class subjects, student subject enrollments, distributions, components in parallel
  const [
    schedulesList,
    entriesList,
    classSubs,
    enrollmentsList,
    distributionsList,
    componentsList,
    existingSnapshots,
  ] = await Promise.all([
    db.query.examSchedules.findMany({
      where: and(
        eq(examSchedules.schoolId, school.id),
        eq(examSchedules.classId, classId),
        examIds.length > 0 ? inArray(examSchedules.examId, examIds) : undefined,
      ),
      with: { subject: true },
    }),
    studentIds.length > 0
      ? await db.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, school.id),
            examIds.length > 0 ? inArray(markEntries.examId, examIds) : undefined,
            inArray(markEntries.studentId, studentIds),
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
    studentIds.length > 0
      ? await db.query.studentSubjectEnrollments.findMany({
          where: and(
            eq(studentSubjectEnrollments.schoolId, school.id),
            inArray(studentSubjectEnrollments.studentId, studentIds),
            eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE"),
            eq(studentSubjectEnrollments.isElectiveTaken, true),
          ),
        })
      : [],
    examIds.length > 0
      ? await db.query.examMarkDistributions.findMany({
          where: and(
            eq(examMarkDistributions.schoolId, school.id),
            eq(examMarkDistributions.classId, classId),
            inArray(examMarkDistributions.examId, examIds),
          ),
        })
      : [],
    examIds.length > 0
      ? await db.query.examComponents.findMany({
          where: and(
            eq(examComponents.schoolId, school.id),
            inArray(examComponents.examId, examIds),
          ),
        })
      : [],
    studentIds.length > 0
      ? await db.query.resultSnapshots.findMany({
          where: and(
            eq(resultSnapshots.schoolId, school.id),
            eq(resultSnapshots.setupId, setupId),
            eq(resultSnapshots.isCurrent, true),
            inArray(resultSnapshots.studentId, studentIds),
          ),
        })
      : [],
  ]);

  // Component ID -> Name Map
  const componentNamesMap = new Map<string, string>();
  for (const comp of componentsList) {
    componentNamesMap.set(comp.id, comp.displayName);
  }

  // Distribution Map by Component ID
  const distributionMapByComponent = new Map<
    string,
    { maxMarks: number; passingMarks: number }
  >();
  for (const dist of distributionsList) {
    if (dist.componentId) {
      distributionMapByComponent.set(dist.componentId, {
        maxMarks: parseFloat(dist.maxMarks) || 100,
        passingMarks:
          parseFloat(dist.passingMarks) ||
          (parseFloat(dist.maxMarks) || 100) * 0.33,
      });
    }
  }

  // Distribution Subject Ceilings: subjectId -> { maxMarks, passingMarks, hasComponents }
  const distributionSubjectMap = new Map<
    string,
    { maxMarks: number; passingMarks: number; hasComponents: boolean }
  >();
  for (const dist of distributionsList) {
    const current = distributionSubjectMap.get(dist.subjectId);
    const distMax = parseFloat(dist.maxMarks) || 100;
    const distPass = parseFloat(dist.passingMarks) || distMax * 0.33;
    if (dist.componentId) {
      if (!current) {
        distributionSubjectMap.set(dist.subjectId, {
          maxMarks: distMax,
          passingMarks: distPass,
          hasComponents: true,
        });
      } else {
        current.maxMarks += distMax;
        current.passingMarks += distPass;
        current.hasComponents = true;
      }
    } else if (!current) {
      distributionSubjectMap.set(dist.subjectId, {
        maxMarks: distMax,
        passingMarks: distPass,
        hasComponents: false,
      });
    }
  }

  // Aggregate subjects for this class
  const classSubjectsMap = new Map<
    string,
    {
      id: string;
      name: string;
      code?: string | null;
      maxMarks: number;
      passingMarks: number;
      isElective: boolean;
      classSubjectId: string;
    }
  >();
  for (const cs of classSubs) {
    if (cs.subject) {
      const dist = distributionSubjectMap.get(cs.subject.id);
      const subMax = dist ? dist.maxMarks : cs.subject.maxMarks || 100;
      const subPass = dist ? dist.passingMarks : cs.subject.passingMarks || 33;
      classSubjectsMap.set(cs.subject.id, {
        id: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        maxMarks: subMax,
        passingMarks: subPass,
        isElective: cs.isElective ?? false,
        classSubjectId: cs.id,
      });
    }
  }
  for (const sc of schedulesList) {
    if (sc.subject && !classSubjectsMap.has(sc.subject.id)) {
      const dist = distributionSubjectMap.get(sc.subject.id);
      const scMax = dist ? dist.maxMarks : parseFloat(sc.maxMarks) || 100;
      const scPass = dist ? dist.passingMarks : parseFloat(sc.passingMarks) || 33;
      classSubjectsMap.set(sc.subject.id, {
        id: sc.subject.id,
        name: sc.subject.name,
        code: sc.subject.code,
        maxMarks: scMax,
        passingMarks: scPass,
        isElective: false,
        classSubjectId: "",
      });
    }
  }

  // Active Elective Enrollments: studentId -> Set of classSubjectId
  const studentEnrollmentSet = new Map<string, Set<string>>();
  for (const enr of enrollmentsList) {
    if (!studentEnrollmentSet.has(enr.studentId)) {
      studentEnrollmentSet.set(enr.studentId, new Set());
    }
    studentEnrollmentSet.get(enr.studentId)!.add(enr.classSubjectId);
  }

  // Group mark entries: studentId -> subjectId -> entry[]
  const studentSubjectEntries = new Map<string, Map<string, typeof entriesList>>();
  for (const entry of entriesList) {
    if (!studentSubjectEntries.has(entry.studentId)) {
      studentSubjectEntries.set(entry.studentId, new Map());
    }
    const subMap = studentSubjectEntries.get(entry.studentId)!;
    if (!subMap.has(entry.subjectId)) {
      subMap.set(entry.subjectId, []);
    }
    subMap.get(entry.subjectId)!.push(entry);
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

    const subjectsForSnapshot = Array.from(classSubjectsMap.values()).map(
      (sub) => {
        // Elective enrollment check (F2 closure)
        if (sub.isElective) {
          const enrolledClassSubIds = studentEnrollmentSet.get(st.id);
          const isEnrolled = enrolledClassSubIds
            ? enrolledClassSubIds.has(sub.classSubjectId)
            : false;
          if (!isEnrolled) {
            return {
              subjectId: sub.id,
              subjectName: sub.name,
              subjectCode: sub.code ?? null,
              totalObtained: 0,
              totalMax: 0,
              percent: 0,
              grade: UNENROLLED_SENTINEL,
              gradePoint: 0,
              isPassed: true,
            };
          }
        }

        const entries = studentSubjectEntries.get(st.id)?.get(sub.id) ?? [];
        const compEntries = entries.filter((e) => e.componentId !== null);

        // Component marks aggregation (F5 / D1 closure)
        if (compEntries.length > 0) {
          const compInputs = compEntries.map((ce) => {
            const compDist = ce.componentId
              ? distributionMapByComponent.get(ce.componentId)
              : undefined;
            const compMax =
              parseFloat(ce.maxMarks) || compDist?.maxMarks || 100;
            const compPass =
              compDist?.passingMarks || compMax * 0.33;
            return {
              componentId: ce.componentId!,
              componentName:
                (ce.componentId
                  ? componentNamesMap.get(ce.componentId)
                  : undefined) ?? "Component",
              marksObtained:
                ce.marksObtained !== null ? parseFloat(ce.marksObtained) : null,
              maxMarks: compMax,
              passingMarks: compPass,
              isAbsent: ce.isAbsent ?? false,
              isExempt: ce.isMedicalExempt ?? false,
            };
          });

          const compResult = calculateComponentMarks(compInputs, 33);
          const gradeRes = calculateGrade(
            {
              marksObtained: compResult.totalObtained,
              maxMarks: compResult.totalMax > 0 ? compResult.totalMax : sub.maxMarks,
              isAbsent: compResult.isAbsent,
              isMedicalExempt: compResult.isExempt,
            },
            activeRules,
          );

          return {
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code ?? null,
            components: compResult.components.map((c) => ({
              name: c.componentName ?? "Component",
              obtained: c.marksObtained,
              maxMarks: c.maxMarks,
            })),
            totalObtained: compResult.totalObtained,
            totalMax: compResult.totalMax > 0 ? compResult.totalMax : sub.maxMarks,
            percent: Number((compResult.percent ?? 0).toFixed(2)),
            grade: compResult.isPassed
              ? gradeRes.grade
              : compResult.isAbsent
              ? ABSENT_GRADE
              : compResult.isExempt
              ? MEDICAL_EXEMPT_GRADE
              : FAIL_GRADE,
            gradePoint: compResult.isPassed ? gradeRes.gradePoint : 0,
            isPassed: compResult.isPassed,
          };
        }

        // Single paper entry (F3 closure: flow isAbsent & isMedicalExempt)
        const singleEntry =
          entries.find((e) => e.componentId === null) ?? entries[0];
        const isAbsent = singleEntry ? singleEntry.isAbsent ?? false : false;
        const isMedicalExempt = singleEntry
          ? singleEntry.isMedicalExempt ?? false
          : false;
        const isPracticalAbsent = singleEntry
          ? singleEntry.isPracticalAbsent ?? false
          : false;

        const obtained =
          singleEntry &&
          singleEntry.marksObtained !== null &&
          singleEntry.marksObtained !== undefined
            ? parseFloat(singleEntry.marksObtained)
            : isAbsent || isMedicalExempt
            ? null
            : 0;
        const maxM = singleEntry
          ? parseFloat(singleEntry.maxMarks) || sub.maxMarks
          : sub.maxMarks;
        const passM = sub.passingMarks;

        const gradeRes = calculateGrade(
          {
            marksObtained: obtained,
            maxMarks: maxM > 0 ? maxM : 100,
            isAbsent,
            isMedicalExempt,
            isPracticalAbsent,
          },
          activeRules,
        );

        const isSubPassed =
          isMedicalExempt ||
          (!isAbsent &&
            !isPracticalAbsent &&
            obtained !== null &&
            obtained >= passM);
        const pct = maxM > 0 && obtained !== null ? (obtained / maxM) * 100 : 0;

        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code ?? null,
          totalObtained: obtained ?? 0,
          totalMax: maxM,
          percent: Number(pct.toFixed(2)),
          grade: isSubPassed
            ? gradeRes.grade
            : isAbsent
            ? ABSENT_GRADE
            : isMedicalExempt
            ? MEDICAL_EXEMPT_GRADE
            : FAIL_GRADE,
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

  // Batch Snapshot Upsert (O(1) lookups instead of N+1 sequential DB queries)
  const existingSnapshotMap = new Map(
    existingSnapshots.map((s) => [s.studentId, s]),
  );
  const createdSnapshots: Array<{ studentId: string }> = [];

  for (const item of intermediateList) {
    item.payload.summary.rank = rankMap.get(item.studentId) || 1;

    const existing = existingSnapshotMap.get(item.studentId);
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
  revalidatePath("/exams/report-cards");
  revalidatePath("/portal/results");
  revalidatePath("/portal/report-cards");
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

export async function generateMeritList(examId: string, classId: string) {
  try {
    const ctx = await requireAuth(RESULT_ADMIN_ROLES);
    requireExamPermission(ctx.role, "exam.result.publish");
    const school = await requireSchool(ctx);

    const classStudents = await db.query.students.findMany({
      where: and(
        eq(students.currentClassId, classId),
        eq(students.schoolId, school.id),
      ),
    });

    if (classStudents.length === 0) {
      return { success: false, message: "No students in this class" };
    }

    const studentIds = classStudents.map((s) => s.id);

    const cards = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.examId, examId),
        inArray(reportCards.studentId, studentIds),
      ),
    });

    if (cards.length === 0) {
      return {
        success: false,
        message: "No report cards generated yet for this class",
      };
    }

    const rankingInput = cards.map((c) => {
      const gData = c.gradeData as Record<string, any>;
      return {
        studentId: c.studentId,
        totalMarks: gData?.["totalMarks"] || 0,
        isPassed: gData?.["isPassed"] !== false,
      };
    });

    const ranked = calculateRanks(rankingInput);

    for (const item of ranked) {
      const card = cards.find((c) => c.studentId === item.studentId);
      if (card) {
        await db
          .update(reportCards)
          .set({ rank: item.rank, updatedAt: new Date() })
          .where(
            and(
              eq(reportCards.id, card.id),
              eq(reportCards.schoolId, school.id),
            ),
          );
      }
    }

    revalidatePath("/exams/results");
    revalidatePath("/exams/report-cards");
    return {
      success: true,
      message: `Successfully ranked ${ranked.length} students`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

import {
  requeueFailedRows,
  getJobPresignedZipUrl,
  detectAndRecoverStuckJobs,
} from "@/lib/bulkGenerationEngine";

export async function retryFailedReportCardJob(jobId: string) {
  try {
    const ctx = await requireAuth(RESULT_ADMIN_ROLES);
    requireExamPermission(ctx.role, "exam.result.publish");
    const school = await requireSchool(ctx);

    const result = await requeueFailedRows(jobId, school.id);
    revalidatePath("/exams/report-cards");
    return { success: true, result };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getReportCardJobDownloadUrl(jobId: string) {
  try {
    const ctx = await requireAuth(RESULT_ADMIN_ROLES);
    requireExamPermission(ctx.role, "exam.result.publish");
    const school = await requireSchool(ctx);

    const downloadUrl = await getJobPresignedZipUrl(jobId, school.id, 3600);
    return { success: true, downloadUrl };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function recoverStuckReportCardJobs() {
  try {
    const ctx = await requireAuth(RESULT_ADMIN_ROLES);
    requireExamPermission(ctx.role, "exam.result.publish");
    const school = await requireSchool(ctx);

    const recoveredCount = await detectAndRecoverStuckJobs({ schoolId: school.id });
    revalidatePath("/exams/report-cards");
    return { success: true, recoveredCount };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

