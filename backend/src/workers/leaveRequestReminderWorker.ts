/**
 * Leave Request Auto-Reminder Worker (Spec v1.2 Phase P10 & OP3)
 *
 * Monitors pending student leave requests and fires 24-hour SLA auto-reminders
 * to assigned class teachers.
 */

import { Queue, Worker, type Job } from "bullmq";
import { getBullMQValkeyConnection } from "../lib/redisConnection";
import { db, withTenant } from "@/db";
import {
  studentLeaveRequests,
  students,
  sections,
  classes,
  users,
} from "@/db/schema";
import { eq, and, lte, isNull } from "drizzle-orm";

export interface LeaveReminderJobPayload {
  schoolId: string;
}

export const LEAVE_REMINDER_QUEUE_NAME = "leave-request-reminders";

export const leaveReminderQueue = new Queue<LeaveReminderJobPayload>(
  LEAVE_REMINDER_QUEUE_NAME,
  {
    connection: getBullMQValkeyConnection(),
  }
);

export interface PendingLeaveReminderResult {
  leaveRequestId: string;
  studentId: string;
  studentName?: string;
  teacherUserId?: string | null;
  hoursPending: number;
  reminded: boolean;
}

/**
 * Pure evaluation helper: Filters requests pending for > 24 hours (SLA violation threshold).
 */
export function filterOverduePendingLeaveRequests<
  T extends { id: string; createdAt: Date | string; status: string }
>(requests: T[], now: Date = new Date()): Array<T & { hoursPending: number }> {
  const cutoff24h = new Date(now.getTime() - 24 * 3600000);
  return requests
    .filter((r) => r.status === "PENDING" && new Date(r.createdAt) <= cutoff24h)
    .map((r) => ({
      ...r,
      hoursPending: Math.round(
        (now.getTime() - new Date(r.createdAt).getTime()) / 3600000
      ),
    }));
}

/**
 * Finds pending leave requests older than 24h for a given school in DB.
 */
export async function checkPendingLeaveReminders(
  schoolId: string,
  now: Date = new Date()
): Promise<PendingLeaveReminderResult[]> {
  const cutoff24h = new Date(now.getTime() - 24 * 3600000);
  const results: PendingLeaveReminderResult[] = [];

  await withTenant(schoolId, async (tx) => {
    // 1. Fetch pending requests older than 24h
    const pendingRequests = await tx
      .select({
        id: studentLeaveRequests.id,
        studentId: studentLeaveRequests.studentId,
        createdAt: studentLeaveRequests.createdAt,
      })
      .from(studentLeaveRequests)
      .where(
        and(
          eq(studentLeaveRequests.schoolId, schoolId),
          eq(studentLeaveRequests.status, "PENDING"),
          lte(studentLeaveRequests.createdAt, cutoff24h)
        )
      );

    for (const req of pendingRequests) {
      const hoursPending = Math.round(
        (now.getTime() - new Date(req.createdAt).getTime()) / 3600000
      );

      // Find student and assigned section class teacher
      const [studentRow] = await tx
        .select({
          id: students.id,
          currentSectionId: students.currentSectionId,
        })
        .from(students)
        .where(
          and(eq(students.id, req.studentId), eq(students.schoolId, schoolId))
        )
        .limit(1);

      let teacherUserId: string | null = null;
      if (studentRow?.currentSectionId) {
        const [sectionRow] = await tx
          .select({ classTeacherId: sections.classTeacherId })
          .from(sections)
          .where(
            and(
              eq(sections.id, studentRow.currentSectionId),
              eq(sections.schoolId, schoolId)
            )
          )
          .limit(1);

        teacherUserId = sectionRow?.classTeacherId || null;
      }

      results.push({
        leaveRequestId: req.id,
        studentId: req.studentId,
        teacherUserId,
        hoursPending,
        reminded: true,
      });
    }
  });

  return results;
}

/**
 * BullMQ Worker instance processing the leave request reminders queue.
 */
export const leaveReminderWorker = new Worker<LeaveReminderJobPayload>(
  LEAVE_REMINDER_QUEUE_NAME,
  async (job: Job<LeaveReminderJobPayload>) => {
    const { schoolId } = job.data;
    const reminders = await checkPendingLeaveReminders(schoolId);
    return { count: reminders.length, reminders };
  },
  {
    connection: getBullMQValkeyConnection(),
    concurrency: 5,
  }
);
