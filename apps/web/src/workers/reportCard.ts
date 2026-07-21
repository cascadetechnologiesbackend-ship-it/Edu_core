// ─── Report Card BullMQ Worker ────────────────────────────────────────────────
// Processes report card generation jobs from the queue.
// Each job generates a PDF for one student and updates the DB.

import { Worker, Queue, type Job } from "bullmq";
import { db } from "@/db";
import {
  reportCards,
  reportCardJobs,
  markEntries,
  students,
  gradeRules,
  exams,
  schools,
  classes,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  calculateGrade,
  aggregateSubjectGrades,
  type GradeRule,
} from "@/lib/gradeEngine";
import { gradeToClassGroup } from "@/lib/pdf/ReportCardPDF";
import { assertConsent } from "@/server/middleware/consent";

export interface ReportCardJobPayload {
  studentId: string;
  examId: string;
  schoolId: string;
  jobId: string; // reportCardJobs table ID for status tracking
}

// ─── Queue Definition ─────────────────────────────────────────────────────────
// Export so API routes can enqueue jobs
export const reportCardQueue = new Queue<ReportCardJobPayload>(
  "report-card-generation",
  {
    connection: {
      host: process.env["REDIS_HOST"] ?? "127.0.0.1",
      port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
      password: process.env["REDIS_PASSWORD"] ?? undefined,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  },
);

// ─── Worker ───────────────────────────────────────────────────────────────────
async function processReportCardJob(
  job: Job<ReportCardJobPayload>,
): Promise<void> {
  const { studentId, examId, schoolId, jobId } = job.data;

  // Mark job as processing
  await db
    .update(reportCardJobs)
    .set({ status: "PROCESSING", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(reportCardJobs.id, jobId));

  // DPDP Consent Check
  await assertConsent(studentId, "academic_records");

  // Fetch the student
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) throw new Error(`Student ${studentId} not found`);

  // Fetch the exam
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: { examType: true, academicYear: true },
  });

  if (!exam) throw new Error(`Exam ${examId} not found`);

  // Fetch the school
  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) throw new Error(`School ${schoolId} not found`);

  // Fetch mark entries for this student + exam
  const marks = await db.query.markEntries.findMany({
    where: and(
      eq(markEntries.examId, examId),
      eq(markEntries.studentId, studentId),
    ),
    with: { subject: true },
  });

  // Fetch grade rules for this school and class group
  const studentClass = await db.query.classes.findFirst({
    where: eq(classes.id, student.currentClassId ?? ""),
  });

  const classGroup = studentClass
    ? gradeToClassGroup(studentClass.gradeLevel)
    : "CLASS_1_5";

  const dbRules = await db.query.gradeRules.findMany({
    where: and(
      eq(gradeRules.schoolId, schoolId),
      eq(gradeRules.classGroup, classGroup),
    ),
  });

  const engineRules: GradeRule[] = dbRules.map((r) => ({
    minPercent: parseFloat(r.minPercent),
    maxPercent: parseFloat(r.maxPercent),
    grade: r.grade,
    gradePoint: parseFloat(r.gradePoint),
    description: r.description,
  }));

  // Calculate grades for each subject
  const subjectResults = marks.map((m) => {
    const result = calculateGrade(
      {
        marksObtained:
          m.marksObtained != null ? parseFloat(m.marksObtained) : null,
        maxMarks: parseFloat(m.maxMarks),
        practicalMarks:
          m.practicalMarks != null ? parseFloat(m.practicalMarks) : null,
        practicalMaxMarks:
          m.practicalMaxMarks != null ? parseFloat(m.practicalMaxMarks) : null,
        isAbsent: m.isAbsent,
        isMedicalExempt: m.isMedicalExempt,
        isPracticalAbsent: m.isPracticalAbsent,
        passingMarks: parseFloat(m.maxMarks) * 0.33,
      },
      engineRules,
    );
    return { result, m };
  });

  const aggregateInput = subjectResults.map(({ result, m }) => ({
    result,
    maxMarks: parseFloat(m.maxMarks),
    marksObtained: m.marksObtained != null ? parseFloat(m.marksObtained) : null,
    practicalMarks:
      m.practicalMarks != null ? parseFloat(m.practicalMarks) : null,
    practicalMaxMarks:
      m.practicalMaxMarks != null ? parseFloat(m.practicalMaxMarks) : null,
  }));

  const aggregate = aggregateSubjectGrades(aggregateInput, engineRules);

  // Build PDF payload
  const gradeData = {
    subjects: subjectResults.map(({ result, m }) => ({
      subjectId: m.subjectId,
      subjectName: m.subject?.name ?? "Unknown",
      grade: result.grade,
      gradePoint: result.gradePoint,
      percent: result.percent,
      marksObtained: m.marksObtained,
      maxMarks: m.maxMarks,
    })),
    totalMarks: aggregate.totalMarks,
    totalMaxMarks: aggregate.totalMaxMarks,
    overallPercent: aggregate.overallPercent,
    overallGrade: aggregate.overallGrade,
    overallGradePoint: aggregate.overallGradePoint,
    isPassed: aggregate.isPassed,
  };

  // Upsert report card record
  const existingCard = await db.query.reportCards.findFirst({
    where: and(
      eq(reportCards.studentId, studentId),
      eq(reportCards.examId, examId),
    ),
  });

  const cardId = existingCard?.id ?? crypto.randomUUID();
  const now = new Date();

  if (existingCard) {
    await db
      .update(reportCards)
      .set({
        gradeData,
        overallGrade: aggregate.overallGrade,
        generatedAt: now,
        updatedAt: now,
      })
      .where(eq(reportCards.id, existingCard.id));
  } else {
    await db.insert(reportCards).values({
      id: cardId,
      schoolId,
      studentId,
      academicYearId: exam.academicYearId,
      examId,
      gradeData,
      overallGrade: aggregate.overallGrade,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update batch job progress counter
  await db
    .update(reportCardJobs)
    .set({
      processedCount: sql`${reportCardJobs.processedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(reportCardJobs.id, jobId));
}

import { workerLogger } from "@/lib/logger";

// ─── Start Worker ─────────────────────────────────────────────────────────────
// Only start if this file is loaded directly (not in Next.js route context)
if (process.env["START_WORKERS"] === "true") {
  const worker = new Worker<ReportCardJobPayload>(
    "report-card-generation",
    processReportCardJob,
    {
      connection: {
        host: process.env["REDIS_HOST"] ?? "127.0.0.1",
        port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
        password: process.env["REDIS_PASSWORD"] ?? undefined,
      },
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    workerLogger.info(
      `[ReportCardWorker] Job ${job.id} completed for student ${job.data.studentId}`,
    );
  });

  worker.on("failed", async (job, err) => {
    workerLogger.error(
      `[ReportCardWorker] Job ${job?.id} failed: ${err.message}`,
    );
    if (job?.data.jobId) {
      await db
        .update(reportCardJobs)
        .set({
          failedCount: sql`${reportCardJobs.failedCount} + 1`,
          status: "FAILED",
          errorLog: { error: err.message, jobId: job.id },
          updatedAt: new Date(),
        })
        .where(eq(reportCardJobs.id, job.data.jobId));
    }
  });

  workerLogger.info("[ReportCardWorker] Worker started");
}

export { processReportCardJob };
