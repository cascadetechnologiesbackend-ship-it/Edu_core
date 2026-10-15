// ─── Report Card BullMQ Worker ────────────────────────────────────────────────
// Processes report card generation jobs from the queue.
// Each job generates a PDF for one student and updates the DB.

import { Worker, Queue, type Job } from "bullmq";
import { getBullMQValkeyConnection, getBullMQRedisConnection } from "../lib/redisConnection";
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
import { resolveGradeRules } from "@/lib/gradeRuleResolver";
import { assertConsent } from "@/server/middleware/consent";
import { executeBulkReportCardRun } from "../lib/bulkGenerationEngine";

export interface ReportCardJobPayload {
  studentId?: string;
  classId?: string;
  examId: string;
  schoolId: string;
  jobId: string; // reportCardJobs table ID for status tracking
  batchSize?: number;
  studentIds?: string[];
}

// ─── Queue Definition ─────────────────────────────────────────────────────────
const valkeyConnection = getBullMQValkeyConnection();
const redisConnection = valkeyConnection;

// Export so API routes can enqueue jobs
export const reportCardQueue = new Queue<ReportCardJobPayload>(
  "report-card-generation",
  {
    connection: valkeyConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  },
);

import { withTenant } from "@/lib/tenant";

// ─── Worker ───────────────────────────────────────────────────────────────────
async function processReportCardJob(
  job: Job<ReportCardJobPayload>,
): Promise<void> {
  const { studentId, classId, examId, schoolId, jobId } = job.data;

  // Bulk Class Run with Chunking & Backpressure
  if (classId) {
    workerLogger.info(
      `[ReportCardWorker] Starting bulk chunked run for class=${classId}, exam=${examId}, schoolId=${schoolId}`,
    );
    await executeBulkReportCardRun({
      jobId,
      schoolId,
      examId,
      classId,
      studentIds: job.data.studentIds,
      chunkSize: job.data.batchSize || 50,
    });
    return;
  }

  if (!studentId) {
    throw new Error("Job payload must specify either classId (bulk) or studentId (single).");
  }

  return await withTenant(schoolId, async (scopedDb) => {
    workerLogger.info(
      `[ReportCardWorker] Starting single job ${job.id} for student=${studentId}, schoolId=${schoolId}`,
    );

    // Mark job as processing
    await scopedDb
      .update(reportCardJobs)
      .set({ status: "PROCESSING", startedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(reportCardJobs.id, jobId), eq(reportCardJobs.schoolId, schoolId)));

  // DPDP Consent Check
  await assertConsent(studentId, "academic_records");

  // Fetch the student with strict tenant scoping
  const student = await scopedDb.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
  });

  if (!student) {
    const errorMsg = `Security Tenant Violation / Not Found: Student ${studentId} does not belong to school ${schoolId}`;
    workerLogger.error(`[ReportCardWorker] ABORTING JOB: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Fetch the exam with strict tenant scoping
  const exam = await scopedDb.query.exams.findFirst({
    where: and(eq(exams.id, examId), eq(exams.schoolId, schoolId)),
    with: { examType: true, academicYear: true },
  });

  if (!exam) {
    const errorMsg = `Security Tenant Violation / Not Found: Exam ${examId} does not belong to school ${schoolId}`;
    workerLogger.error(`[ReportCardWorker] ABORTING JOB: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Fetch the school
  const school = await scopedDb.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) throw new Error(`School ${schoolId} not found`);

  // Fetch mark entries for this student + exam
  const marks = await scopedDb.query.markEntries.findMany({
    where: and(
      eq(markEntries.examId, examId),
      eq(markEntries.studentId, studentId),
    ),
    with: { subject: true },
  });

  // Resolve hierarchical grade rules (class override -> class group -> board defaults -> CBSE fallback)
  const engineRules: GradeRule[] = await resolveGradeRules(
    schoolId,
    student.currentClassId,
    undefined,
    scopedDb,
  );

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
  const existingCard = await scopedDb.query.reportCards.findFirst({
    where: and(
      eq(reportCards.schoolId, schoolId),
      eq(reportCards.studentId, studentId),
      eq(reportCards.examId, examId),
    ),
  });

  const cardId = existingCard?.id ?? crypto.randomUUID();
  const now = new Date();

  if (existingCard) {
    await scopedDb
      .update(reportCards)
      .set({
        gradeData,
        overallGrade: aggregate.overallGrade,
        generatedAt: now,
        updatedAt: now,
      })
      .where(and(eq(reportCards.id, existingCard.id), eq(reportCards.schoolId, schoolId)));
  } else {
    await scopedDb.insert(reportCards).values({
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
    await scopedDb
      .update(reportCardJobs)
      .set({
        processedCount: sql`${reportCardJobs.processedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(reportCardJobs.id, jobId), eq(reportCardJobs.schoolId, schoolId)));
  });
}

import { workerLogger } from "@/lib/logger";

// ─── Start Worker ─────────────────────────────────────────────────────────────
// Only start if this file is loaded directly (not in Next.js route context)
if (process.env["START_WORKERS"] === "true") {
  const worker = new Worker<ReportCardJobPayload>(
    "report-card-generation",
    processReportCardJob,
    {
      connection: redisConnection,
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
