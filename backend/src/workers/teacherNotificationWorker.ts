/**
 * Teacher Notification Worker (Spec v1.0, Phase T5 & AC-T10)
 *
 * Implements background scheduled jobs for:
 * 1. Attendance Cutoff Reminders: Fires at 09:30 for class teachers with unmarked attendance.
 * 2. Marks Entry Window Closing Reminders: Fires when exam window has < 24h remaining with incomplete marks.
 * 3. Quiet Hours Queue Drainage: Flushes pushes held in QUEUED_QUIET_HOURS at 07:00 AM.
 */

import { Queue, Worker, type Job } from "bullmq";
import { getBullMQRedisConnection } from "../lib/redisConnection";
import { db, withTenant } from "@/db";
import {
  sections,
  classes,
  studentAttendance,
  exams,
  subjects,
  classSubjects,
  markEntries,
  pushNotificationLogs,
  userPushSubscriptions,
  users,
} from "@/db/schema";
import { eq, and, sql, gte, lte, isNull, inArray } from "drizzle-orm";
import {
  evaluateTeacherNotificationEligibility,
  dispatchTeacherNotification,
  getTeacherTodayNotificationState,
  isInsideTeacherQuietHours,
} from "../lib/teacherEventEngine/notificationMatrixTeacher";
import { dispatchWebPush } from "../lib/webPushDispatcher";

export interface TeacherNotificationJobPayload {
  schoolId: string;
  type: "CHECK_ATTENDANCE_CUTOFF" | "CHECK_MARKS_WINDOW" | "DRAIN_QUIET_HOURS";
}

export const TEACHER_NOTIFICATION_QUEUE_NAME = "teacher-notifications";

export const teacherNotificationQueue = new Queue<TeacherNotificationJobPayload>(
  TEACHER_NOTIFICATION_QUEUE_NAME,
  {
    connection: getBullMQRedisConnection(),
  }
);

/**
 * Pure evaluation helper: checks if a section's attendance reminder is eligible based on time-of-day.
 * Triggers if within 30 minutes before cutoff (e.g. 09:30 - 10:00 for 10:00 cutoff) and attendance is unmarked.
 */
export function isCutoffReminderEligible(
  isMarked: boolean,
  now: Date,
  cutoffTime: string = "10:00"
): boolean {
  if (isMarked) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [cutoffH, cutoffM] = cutoffTime.split(":").map(Number);
  const cutoffMinutes = (cutoffH ?? 10) * 60 + (cutoffM ?? 0);

  // Eligible within 30 minutes leading up to the cutoff
  const windowStart = cutoffMinutes - 30;
  return currentMinutes >= windowStart && currentMinutes < cutoffMinutes;
}

/**
 * Pure evaluation helper: checks if marks entry window reminder is eligible (< 24h remaining and incomplete).
 */
export function isMarksWindowReminderEligible(
  windowClosesAt: Date | string,
  completedEntries: number,
  totalStudents: number,
  now: Date = new Date()
): { eligible: boolean; hoursRemaining: number } {
  if (totalStudents > 0 && completedEntries >= totalStudents) {
    return { eligible: false, hoursRemaining: 0 };
  }

  const closesAt = new Date(windowClosesAt).getTime();
  const nowMs = now.getTime();
  const msRemaining = closesAt - nowMs;

  if (msRemaining <= 0) {
    return { eligible: false, hoursRemaining: 0 };
  }

  const hoursRemaining = msRemaining / 3600000;
  // Trigger reminder when closing in less than or equal to 24 hours
  return {
    eligible: hoursRemaining <= 24,
    hoursRemaining: Math.round(hoursRemaining),
  };
}

/**
 * Scans unmarked class teacher sections and sends T1 reminders.
 */
export async function checkAttendanceCutoffReminders(
  schoolId: string,
  now: Date = new Date(),
  cutoffTime: string = "10:00"
): Promise<{ checkedSections: number; remindersDispatched: number }> {
  let remindersDispatched = 0;
  let checkedSections = 0;

  await withTenant(schoolId, async (tx: any) => {
    // 1. Fetch sections with an assigned class teacher
    const assignedSections = await tx.query.sections.findMany({
      where: and(
        eq(sections.schoolId, schoolId),
        sql`${sections.classTeacherId} IS NOT NULL`
      ),
      with: {
        class: true,
      },
    });

    checkedSections = assignedSections.length;
    if (assignedSections.length === 0) return;

    const todayStr = now.toISOString().slice(0, 10);

    for (const sec of assignedSections) {
      if (!sec.classTeacherId) continue;

      // 2. Check if attendance exists for this section today
      const existingAttendance = await tx.query.studentAttendance.findFirst({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          eq(studentAttendance.sectionId, sec.id),
          sql`DATE(${studentAttendance.attendanceDate}) = ${todayStr}`
        ),
      });

      const isMarked = !!existingAttendance;
      if (!isCutoffReminderEligible(isMarked, now, cutoffTime)) {
        continue;
      }

      // 3. Get notification state for this teacher
      const state = await getTeacherTodayNotificationState(sec.classTeacherId, schoolId, now);

      const sectionLabel = sec.class?.name ? `${sec.class.name}-${sec.name}` : sec.name;

      // 4. Dispatch T1 reminder
      const result = await dispatchTeacherNotification(
        schoolId,
        {
          teacherUserId: sec.classTeacherId,
          tier: "T1_action_required",
          eventKind: "ATTENDANCE_CUTOFF_APPROACHING",
          now,
          todayPushCountForTeacher: state.todayPushCount,
          previouslyDispatchedDedupeKeys: state.previouslyDispatchedDedupeKeys,
        },
        {
          title: "Attendance Cutoff Approaching",
          body: `Attendance for Section ${sectionLabel} is still unmarked. Cutoff is at ${cutoffTime}.`,
          data: {
            sectionId: sec.id,
            url: "/teacher/attendance",
          },
        }
      );

      if (result.decision.shouldPushNow || result.decision.isQueuedForMorning) {
        remindersDispatched++;
      }
    }
  });

  return { checkedSections, remindersDispatched };
}

/**
 * Scans open exam windows closing within 24h and sends T1 reminders for incomplete marks entry.
 */
export async function checkMarksEntryWindowClosingReminders(
  schoolId: string,
  now: Date = new Date()
): Promise<{ checkedWindows: number; remindersDispatched: number }> {
  let remindersDispatched = 0;
  let checkedWindows = 0;

  await withTenant(schoolId, async (tx: any) => {
    const nowMs = now.getTime();
    const next24h = new Date(nowMs + 24 * 3600000);

    // 1. Fetch active exams ending within 24h and not locked
    const activeExams = await tx.query.exams.findMany({
      where: and(
        eq(exams.schoolId, schoolId),
        eq(exams.isLocked, false),
        gte(exams.endDate, now),
        lte(exams.endDate, next24h)
      ),
    });

    checkedWindows = activeExams.length;
    if (activeExams.length === 0) return;

    for (const exam of activeExams) {
      // 2. Fetch class subjects with assigned teachers for this school
      const subjectsList = await tx.query.classSubjects.findMany({
        where: and(
          eq(classSubjects.schoolId, schoolId),
          sql`${classSubjects.assignedTeacherId} IS NOT NULL`
        ),
        with: {
          subject: true,
        },
      });

      for (const cs of subjectsList) {
        if (!cs.subject) continue;

        const totalMarks = await tx.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, schoolId),
            eq(markEntries.examId, exam.id),
            eq(markEntries.subjectId, cs.subjectId)
          ),
        });

        const totalEntered = totalMarks.length;
        const totalExpected = 40; // Default expected section roster count

        const check = isMarksWindowReminderEligible(
          exam.endDate,
          totalEntered,
          totalExpected,
          now
        );

        if (!check.eligible) continue;

        const teacherUserId = cs.assignedTeacherId || exam.lockedById;
        if (!teacherUserId) continue;

        const state = await getTeacherTodayNotificationState(teacherUserId, schoolId, now);

        const result = await dispatchTeacherNotification(
          schoolId,
          {
            teacherUserId,
            tier: "T1_action_required",
            eventKind: "MARKS_ENTRY_WINDOW_CLOSING",
            now,
            todayPushCountForTeacher: state.todayPushCount,
            previouslyDispatchedDedupeKeys: state.previouslyDispatchedDedupeKeys,
          },
          {
            title: "Marks Entry Closes Soon",
            body: `Marks entry for ${exam.name} (${cs.subject.name}) closes in ${check.hoursRemaining} hours. Please complete submissions.`,
            data: {
              examId: exam.id,
              subjectId: cs.subjectId,
              url: "/teacher/grading",
            },
          }
        );

        if (result.decision.shouldPushNow || result.decision.isQueuedForMorning) {
          remindersDispatched++;
        }
      }
    }
  });

  return { checkedWindows, remindersDispatched };
}

/**
 * Drains teacher push notifications held in QUEUED_QUIET_HOURS once quiet hours have ended.
 */
export async function drainTeacherQuietHoursQueue(
  schoolId?: string,
  now: Date = new Date()
): Promise<{ flushedCount: number; skippedQuietCount: number }> {
  // If still inside quiet hours (e.g. before 07:00), defer flush
  if (isInsideTeacherQuietHours(now, "21:30", "07:00")) {
    return { flushedCount: 0, skippedQuietCount: 1 };
  }

  const filter = schoolId
    ? and(
        eq(pushNotificationLogs.schoolId, schoolId),
        eq(pushNotificationLogs.status, "QUEUED_QUIET_HOURS")
      )
    : eq(pushNotificationLogs.status, "QUEUED_QUIET_HOURS");

  const queuedLogs = await db.query.pushNotificationLogs.findMany({
    where: filter,
    limit: 500,
  });

  if (queuedLogs.length === 0) {
    return { flushedCount: 0, skippedQuietCount: 0 };
  }

  let flushedCount = 0;

  for (const log of queuedLogs) {
    const payload = {
      title: log.title,
      body: log.body,
    };

    const results = await dispatchWebPush(
      log.schoolId,
      [log.recipientUserId],
      payload
    );
    const success = results[0]?.success || false;

    await db
      .update(pushNotificationLogs)
      .set({
        status: success ? "DELIVERED" : "FAILED",
      })
      .where(eq(pushNotificationLogs.id, log.id));

    if (success) {
      flushedCount++;
    }
  }

  return { flushedCount, skippedQuietCount: 0 };
}

/**
 * BullMQ Worker instance handling teacher scheduled notification events.
 */
export const teacherNotificationWorker = new Worker<TeacherNotificationJobPayload>(
  TEACHER_NOTIFICATION_QUEUE_NAME,
  async (job: Job<TeacherNotificationJobPayload>) => {
    const { schoolId, type } = job.data;

    switch (type) {
      case "CHECK_ATTENDANCE_CUTOFF":
        return await checkAttendanceCutoffReminders(schoolId);
      case "CHECK_MARKS_WINDOW":
        return await checkMarksEntryWindowClosingReminders(schoolId);
      case "DRAIN_QUIET_HOURS":
        return await drainTeacherQuietHoursQueue(schoolId);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  },
  {
    connection: getBullMQRedisConnection(),
    concurrency: 5,
  }
);
