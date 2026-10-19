/**
 * Parent Signals & Feed Derivation BullMQ Worker (Spec v1.0)
 *
 * Runs nightly (and on-demand event triggers) to evaluate predictive analytics
 * models (attendance_risk, performance_dip, fee_stress, homework_neglect),
 * derive active ParentFeedCards, and reconcile them in the parentFeedCards table.
 */

import { Worker, Queue, type Job } from "bullmq";
import { getBullMQValkeyConnection } from "../lib/redisConnection";
import { db, withTenant } from "@/db";
import {
  students,
  studentAttendance,
  feeInvoices,
  reportCards,
  assignmentSubmissions,
  studentBusPasses,
  pushNotificationLogs,
  parentNotificationPreferences,
} from "@/db/schema";
import { eq, and, desc, gte, isNotNull } from "drizzle-orm";
import { dispatchParentNotification } from "../lib/parentEventEngine/notificationMatrix";
import {
  evalAttendanceRisk,
  evalPerformanceDip,
  evalFeeStress,
  evalHomeworkNeglect,
  type AttendanceRecord,
  type ReportCardRecord,
} from "../lib/analytics/parentSignals";
import { deriveParentFeed } from "../lib/parentEventEngine/deriveParentFeed";
import { syncParentFeedCards } from "../lib/parentEventEngine/feedPersistence";
import type {
  ParentDataSnapshot,
  InsightSnapshot,
  InvoiceSnapshot,
  HomeworkSnapshot,
  AttendanceSnapshot,
  BusPassSnapshot,
} from "../lib/parentEventEngine/types";

export interface ParentSignalsJobPayload {
  schoolId: string;
  studentId?: string | undefined; // Optional: evaluate single student, or all in school
}

export const PARENT_SIGNALS_QUEUE_NAME = "parent-signals";

export const parentSignalsQueue = new Queue<ParentSignalsJobPayload>(
  PARENT_SIGNALS_QUEUE_NAME,
  {
    connection: getBullMQValkeyConnection(),
  }
);

/**
 * Evaluates analytics signals and derives the parent feed for a single student.
 */
export async function evaluateStudentSignalsAndFeed(
  schoolId: string,
  studentId: string,
  now: Date = new Date()
) {
  return await withTenant(schoolId, async (tx) => {
    // 1. Fetch student
    const student = await tx.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
      columns: { id: true, admissionNumber: true, isActive: true, primaryParentUserId: true },
    });

    if (!student) return { success: false, reason: "Student not found" };

    const studentDisplayName = `Student (${student.admissionNumber})`;

    // 2. Attendance (Last 45 days for 30d window + 10 school days)
    const cutoff45d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const attendanceRows = await tx.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.studentId, studentId),
        gte(studentAttendance.attendanceDate, cutoff45d)
      ),
      orderBy: [desc(studentAttendance.attendanceDate)],
    });

    const attendanceRecords: AttendanceRecord[] = attendanceRows.map((r) => ({
      date: r.attendanceDate,
      status: r.status as any,
    }));

    // Today's attendance
    const todayStr = now.toISOString().split("T")[0]!;
    const todayAtt = attendanceRows.find((r) => {
      const d = new Date(r.attendanceDate).toISOString().split("T")[0];
      return d === todayStr;
    });

    const attendanceToday: AttendanceSnapshot | undefined = todayAtt
      ? {
          status: todayAtt.status as any,
          markedAt: todayAtt.createdAt || now,
          remarks: todayAtt.remarks,
        }
      : undefined;

    // 3. Fee Invoices
    const invoices = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.studentId, studentId),
        eq(feeInvoices.schoolId, schoolId)
      ),
      orderBy: [desc(feeInvoices.dueDate)],
    });

    const feeTermNames: Record<string, string> = {
      MONTHLY: "Monthly Fee",
      QUARTERLY: "Quarterly Fee",
      HALF_YEARLY: "Half-Yearly Fee",
      ANNUAL: "Annual Fee",
      ONE_TIME: "One-Time Fee",
    };

    const invoiceSnapshots: InvoiceSnapshot[] = invoices.map((inv) => ({
      id: inv.id,
      termName: (inv.term && feeTermNames[inv.term]) || "School Term",
      status: inv.status as any,
      dueDate: inv.dueDate,
      balanceAmount: Number(inv.balanceAmount || 0),
      lateFeeAmount: Number(inv.lateFeeAmount || 0),
      reminderSentFlags: {
        d7: Boolean(inv.reminderSentD7),
        d15: Boolean(inv.reminderSentD15),
        d30: Boolean(inv.reminderSentD30),
      },
    }));

    // 4. Assignments & Submissions (last 21 days)
    const cutoff21d = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const submissions = await tx.query.assignmentSubmissions.findMany({
      where: and(
        eq(assignmentSubmissions.studentId, studentId),
        eq(assignmentSubmissions.schoolId, schoolId),
        gte(assignmentSubmissions.submittedAt, cutoff21d)
      ),
      with: {
        assignment: true,
      },
    });

    const homeworkSnapshots: HomeworkSnapshot[] = submissions.map((sub) => ({
      id: sub.assignmentId,
      title: sub.assignment?.title || "Homework",
      subjectName: "Academics",
      dueDate: sub.assignment?.dueDate || now,
      isSubmitted: true,
      submission: {
        submittedAt: sub.submittedAt || now,
        grade: sub.marksAwarded !== null ? `${sub.marksAwarded}` : null,
        feedback: sub.remarks,
      },
    }));

    // 5. Report Cards (Last 2 generated)
    const reportCardRows = await tx.query.reportCards.findMany({
      where: and(
        eq(reportCards.studentId, studentId),
        eq(reportCards.schoolId, schoolId),
        isNotNull(reportCards.generatedAt)
      ),
      orderBy: [desc(reportCards.generatedAt)],
      limit: 2,
    });

    const reportCardRecords: ReportCardRecord[] = reportCardRows.map((rc) => ({
      id: rc.id,
      termName: "Term Report",
      publishedAt: rc.generatedAt || rc.createdAt || now,
      subjectMarks: (rc.gradeData as any)?.subjectMarks || {},
      overallAverage: Number((rc.gradeData as any)?.percentage || 0),
    }));

    // 6. Evaluate Predictive Models
    const insights: InsightSnapshot[] = [];

    // A. Attendance Risk
    const attRisk = evalAttendanceRisk(attendanceRecords, now, studentDisplayName);
    if (attRisk.triggered && attRisk.insight) {
      insights.push(attRisk.insight);
    }

    // B. Performance Dip
    const perfDip = evalPerformanceDip(reportCardRecords, studentDisplayName);
    if (perfDip.triggered && perfDip.insight) {
      insights.push(perfDip.insight);
    }

    // C. Fee Stress (Evaluated on primary pending/overdue invoice)
    const primaryInvoice = invoiceSnapshots.find((inv) =>
      ["OVERDUE", "PARTIAL", "PENDING"].includes(inv.status)
    );
    if (primaryInvoice) {
      const feeStress = evalFeeStress(primaryInvoice, studentDisplayName);
      if (feeStress.triggered && feeStress.insight) {
        insights.push(feeStress.insight);
      }
    }

    // D. Homework Neglect
    const hwNeglect = evalHomeworkNeglect(homeworkSnapshots, now, studentDisplayName);
    if (hwNeglect.triggered && hwNeglect.insight) {
      insights.push(hwNeglect.insight);
    }

    // 7. Bus Pass Snapshot
    const busPass = await tx.query.studentBusPasses.findFirst({
      where: and(
        eq(studentBusPasses.studentId, studentId),
        eq(studentBusPasses.schoolId, schoolId),
        eq(studentBusPasses.isActive, true)
      ),
    });

    let busPassSnapshot: BusPassSnapshot | undefined;
    if (busPass) {
      busPassSnapshot = {
        isActive: true,
        routeId: busPass.routeId,
        stopId: busPass.routeStopId,
        stopOrder: 1, // Will be resolved with routeStops in phase P5
      };
    }

    // 8. Assemble Data Snapshot & Derive Feed
    const snapshot: ParentDataSnapshot = {
      studentName: studentDisplayName,
      attendanceToday,
      invoices: invoiceSnapshots,
      homework: homeworkSnapshots,
      reportCards: reportCardRows.map((rc) => ({
        id: rc.id,
        termName: "Term Report",
        publishedAt: rc.generatedAt || rc.createdAt || now,
        averageScore: Number((rc.gradeData as any)?.percentage || 0),
      })),
      busPass: busPassSnapshot,
      insights,
    };

    const derivedCards = deriveParentFeed(studentId, now, snapshot);

    // 9. Reconcile with DB
    await syncParentFeedCards(schoolId, studentId, derivedCards, tx);

    // 10. Dispatch Web Push for Action-Required (T1) cards & Report Cards (Spec Notification Matrix)
    let dispatchedPushesCount = 0;
    if (student.primaryParentUserId) {
      const parentUserId = student.primaryParentUserId;
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      // Fetch today's push logs for this parent
      const todayLogs = await tx.query.pushNotificationLogs.findMany({
        where: and(
          eq(pushNotificationLogs.schoolId, schoolId),
          eq(pushNotificationLogs.recipientUserId, parentUserId),
          gte(pushNotificationLogs.createdAt, startOfDay)
        ),
      });

      const todayPushCount = todayLogs.length;
      const previouslyDispatchedDedupeKeys = new Set<string>();
      for (const log of todayLogs) {
        if (log.title) {
          previouslyDispatchedDedupeKeys.add(log.title);
        }
      }

      // Check parent notification preferences
      const notifPrefs = await tx.query.parentNotificationPreferences.findFirst({
        where: and(
          eq(parentNotificationPreferences.schoolId, schoolId),
          eq(parentNotificationPreferences.parentUserId, parentUserId)
        ),
      });

      for (const card of derivedCards) {
        // T1 cards or ReportCard in T2 trigger push evaluation
        const isEligibleForPush =
          card.tier === "T1_action_required" ||
          (card.tier === "T2_informational" && card.cardType === "ReportCardCard");

        if (isEligibleForPush) {
          const outcome = await dispatchParentNotification(
            schoolId,
            {
              studentId,
              parentUserId,
              tier: card.tier,
              eventKind: card.cardType,
              now,
              todayPushCountForParent: todayPushCount + dispatchedPushesCount,
              previouslyDispatchedDedupeKeys,
              quietHoursStart: notifPrefs?.quietHoursStart || "21:30",
              quietHoursEnd: notifPrefs?.quietHoursEnd || "07:00",
              tierOptOuts: (notifPrefs?.tierOptOuts as string[]) || [],
            },
            {
              title: card.title.en,
              body: card.summary.en,
            },
            tx
          );

          if (outcome.decision.shouldPushNow) {
            dispatchedPushesCount++;
            previouslyDispatchedDedupeKeys.add(outcome.decision.dedupeKey);
          }
        }
      }
    }

    return {
      success: true,
      studentId,
      derivedCardsCount: derivedCards.length,
      insightsCount: insights.length,
      dispatchedPushesCount,
    };
  });
}

/**
 * Worker Processor for parent-signals queue.
 */
export function createParentSignalsWorker() {
  return new Worker<ParentSignalsJobPayload>(
    PARENT_SIGNALS_QUEUE_NAME,
    async (job: Job<ParentSignalsJobPayload>) => {
      const { schoolId, studentId } = job.data;

      if (studentId) {
        return await evaluateStudentSignalsAndFeed(schoolId, studentId);
      }

      // Batch evaluate all active students in school
      const schoolStudents = await db.query.students.findMany({
        where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
        columns: { id: true },
      });

      let evaluated = 0;
      for (const s of schoolStudents) {
        await evaluateStudentSignalsAndFeed(schoolId, s.id);
        evaluated++;
      }

      return {
        success: true,
        schoolId,
        evaluatedStudentsCount: evaluated,
      };
    },
    {
      connection: getBullMQValkeyConnection(),
      concurrency: 5,
    }
  );
}
