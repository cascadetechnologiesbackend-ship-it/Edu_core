"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  timetableSubstitutions,
  timetablePeriods,
  sections,
  subjects,
  academicYears,
  staff,
} from "@/db/schema";
import { eq, and, sql, desc, inArray, ne } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";

export interface TeacherSubstitutionItem {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  date: string;
  timetablePeriodId: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  className: string;
  sectionName: string;
  sectionId: string;
  subjectName: string;
  otherTeacherName: string;
  otherTeacherId: string;
  reason: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  hasConflict?: boolean | undefined;
  conflictReason?: string | undefined;
  createdAt: string;
}

import {
  timeStringToMinutes,
  intervalsOverlap,
  getDayOfWeekEnum,
  checkSubstitutionClash,
} from "@/lib/teacherEventEngine/substitutionClash";

export {
  timeStringToMinutes,
  intervalsOverlap,
  getDayOfWeekEnum,
  checkSubstitutionClash,
};

/**
 * 1. Fetch Teacher Substitutions (Incoming & Outgoing)
 */
export async function getTeacherSubstitutions(): Promise<{
  incoming: TeacherSubstitutionItem[];
  outgoing: TeacherSubstitutionItem[];
}> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const rawSubs = await tx.query.timetableSubstitutions.findMany({
      where: and(
        eq(timetableSubstitutions.schoolId, school.id),
        sql`(${timetableSubstitutions.originalTeacherId} = ${ctx.userId} OR ${timetableSubstitutions.substituteTeacherId} = ${ctx.userId})`
      ),
      with: {
        timetablePeriod: {
          with: {
            subject: true,
            section: { with: { class: true } },
          },
        },
        section: { with: { class: true } },
        subject: true,
      },
      orderBy: [
        desc(timetableSubstitutions.date),
        desc(timetableSubstitutions.createdAt),
      ],
    });

    const userIds = new Set<string>();
    for (const s of rawSubs) {
      if (s.originalTeacherId) userIds.add(s.originalTeacherId);
      if (s.substituteTeacherId) userIds.add(s.substituteTeacherId);
    }

    const staffMembers =
      userIds.size > 0
        ? await tx.query.staff.findMany({
            where: and(
              eq(staff.schoolId, school.id),
              inArray(staff.userId, Array.from(userIds))
            ),
          })
        : [];

    const teacherNameMap = new Map<string, string>();
    for (const sm of staffMembers) {
      if (sm.userId) {
        const first = decryptData(sm.firstNameEncrypted) || "";
        const last = decryptData(sm.lastNameEncrypted) || "";
        teacherNameMap.set(
          sm.userId,
          `${first} ${last}`.trim() || "Staff Colleague"
        );
      }
    }

    const incoming: TeacherSubstitutionItem[] = [];
    const outgoing: TeacherSubstitutionItem[] = [];

    for (const s of rawSubs) {
      const isIncoming = s.substituteTeacherId === ctx.userId;
      const period = s.timetablePeriod;
      const sec = s.section || period?.section;
      const subj = s.subject || period?.subject;

      let clashInfo: { hasConflict: boolean; conflictReason?: string } = {
        hasConflict: false,
      };
      if (isIncoming && s.status === "PENDING") {
        clashInfo = await checkSubstitutionClash(
          s.id,
          ctx.userId,
          tx,
          school.id
        );
      }

      const otherTeacherId = isIncoming
        ? s.originalTeacherId
        : s.substituteTeacherId;
      const otherTeacherName = otherTeacherId
        ? teacherNameMap.get(otherTeacherId) ||
          (isIncoming ? "Staff Colleague" : "Awaiting Assignment")
        : "Awaiting Assignment";

      const item: TeacherSubstitutionItem = {
        id: s.id,
        direction: isIncoming ? "INCOMING" : "OUTGOING",
        date: s.date,
        timetablePeriodId: s.timetablePeriodId,
        periodNumber: period?.periodNumber || 1,
        startTime: period?.startTime || "09:00",
        endTime: period?.endTime || "09:45",
        className: sec?.class?.displayName || sec?.class?.name || "Class",
        sectionName: sec?.name || "Section",
        sectionId: s.sectionId,
        subjectName: subj?.name || "General",
        otherTeacherId: otherTeacherId || "",
        otherTeacherName,
        reason: s.reason,
        status: s.status as any,
        hasConflict: clashInfo.hasConflict,
        conflictReason: clashInfo.conflictReason,
        createdAt: s.createdAt.toISOString(),
      };

      if (isIncoming) {
        incoming.push(item);
      } else {
        outgoing.push(item);
      }
    }

    return { incoming, outgoing };
  });
}

/**
 * 2. Fetch Teacher Scheduled Periods for a given date
 */
export async function getTeacherTimetablePeriodsForDate(dateStr: string) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  const targetDate = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = getDayOfWeekEnum(targetDate);

  return await withTenant(school.id, async (tx: any) => {
    const periods = await tx.query.timetablePeriods.findMany({
      where: and(
        eq(timetablePeriods.schoolId, school.id),
        eq(timetablePeriods.teacherId, ctx.userId),
        eq(timetablePeriods.dayOfWeek, dayOfWeek),
        eq(timetablePeriods.isActive, true)
      ),
      with: {
        section: { with: { class: true } },
        subject: true,
      },
      orderBy: [timetablePeriods.periodNumber],
    });

    return periods.map((p: any) => ({
      id: p.id,
      periodNumber: p.periodNumber,
      startTime: p.startTime,
      endTime: p.endTime,
      className:
        p.section?.class?.displayName || p.section?.class?.name || "Class",
      sectionName: p.section?.name || "Section",
      subjectName: p.subject?.name || "Subject",
    }));
  });
}

/**
 * 3. Request Absence Coverage for Teacher's own periods
 */
export async function requestAbsenceCoverageAction(input: {
  date: string;
  timetablePeriodIds: string[];
  reason: string;
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  if (
    !input.date ||
    !input.timetablePeriodIds ||
    input.timetablePeriodIds.length === 0
  ) {
    throw new Error(
      "Please specify date and select at least one period for absence cover"
    );
  }

  return await withTenant(school.id, async (tx: any) => {
    const activeYear = await tx.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, school.id),
        eq(academicYears.isActive, true)
      ),
    });

    if (!activeYear) {
      throw new Error("No active academic year found");
    }

    const periods = await tx.query.timetablePeriods.findMany({
      where: and(
        eq(timetablePeriods.schoolId, school.id),
        inArray(timetablePeriods.id, input.timetablePeriodIds),
        eq(timetablePeriods.teacherId, ctx.userId)
      ),
    });

    if (periods.length === 0) {
      throw new Error("None of the selected periods belong to your schedule");
    }

    const createdIds: string[] = [];

    for (const p of periods) {
      const existing = await tx.query.timetableSubstitutions.findFirst({
        where: and(
          eq(timetableSubstitutions.schoolId, school.id),
          eq(timetableSubstitutions.date, input.date),
          eq(timetableSubstitutions.sectionId, p.sectionId),
          eq(timetableSubstitutions.timetablePeriodId, p.id)
        ),
      });

      if (existing) {
        if (existing.status === "CANCELLED") {
          await tx
            .update(timetableSubstitutions)
            .set({
              status: "PENDING",
              substituteTeacherId: null,
              reason: input.reason,
              updatedAt: new Date(),
            })
            .where(eq(timetableSubstitutions.id, existing.id));
          createdIds.push(existing.id);
        } else {
          createdIds.push(existing.id);
        }
      } else {
        const [inserted] = await tx
          .insert(timetableSubstitutions)
          .values({
            schoolId: school.id,
            academicYearId: activeYear.id,
            date: input.date,
            timetablePeriodId: p.id,
            sectionId: p.sectionId,
            originalTeacherId: ctx.userId,
            substituteTeacherId: null,
            subjectId: p.subjectId,
            reason: input.reason,
            status: "PENDING",
          })
          .returning({ id: timetableSubstitutions.id });

        if (inserted?.id) {
          createdIds.push(inserted.id);
        }
      }
    }

    return {
      success: true,
      createdCount: createdIds.length,
      createdIds,
    };
  });
}

/**
 * 4. Accept Incoming Substitution (AC-T8)
 * Enforces isolation: substituteTeacherId must be session user.
 * Rejects on schedule conflict.
 * Transitions status to CONFIRMED.
 */
export async function acceptSubstitutionAction(substitutionId: string) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const sub = await tx.query.timetableSubstitutions.findFirst({
      where: and(
        eq(timetableSubstitutions.schoolId, school.id),
        eq(timetableSubstitutions.id, substitutionId)
      ),
    });

    if (!sub) {
      throw new Error("Substitution request not found");
    }

    if (sub.substituteTeacherId !== ctx.userId) {
      throw new Error(
        "Unauthorized: you are not the assigned substitute teacher for this request"
      );
    }

    if (sub.status !== "PENDING") {
      throw new Error(`Cannot accept substitution in status ${sub.status}`);
    }

    // Clash detection check (AC-T8)
    const clash = await checkSubstitutionClash(
      substitutionId,
      ctx.userId,
      tx,
      school.id
    );
    if (clash.hasConflict) {
      throw new Error(
        `Cannot accept substitution: schedule conflict detected. ${clash.conflictReason}`
      );
    }

    await tx
      .update(timetableSubstitutions)
      .set({
        status: "CONFIRMED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timetableSubstitutions.schoolId, school.id),
          eq(timetableSubstitutions.id, substitutionId)
        )
      );

    return {
      success: true,
      substitutionId,
      status: "CONFIRMED",
    };
  });
}

/**
 * 5. Decline Incoming Substitution (AC-T8)
 * Returns row to unassigned (substituteTeacherId = null, status = PENDING)
 * and notifies admin owner.
 */
export async function declineSubstitutionAction(
  substitutionId: string,
  reason?: string
) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const sub = await tx.query.timetableSubstitutions.findFirst({
      where: and(
        eq(timetableSubstitutions.schoolId, school.id),
        eq(timetableSubstitutions.id, substitutionId)
      ),
    });

    if (!sub) {
      throw new Error("Substitution request not found");
    }

    if (sub.substituteTeacherId !== ctx.userId) {
      throw new Error(
        "Unauthorized: you are not the assigned substitute teacher for this request"
      );
    }

    if (sub.status !== "PENDING") {
      throw new Error(`Cannot decline substitution in status ${sub.status}`);
    }

    await tx
      .update(timetableSubstitutions)
      .set({
        substituteTeacherId: null,
        status: "PENDING",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timetableSubstitutions.schoolId, school.id),
          eq(timetableSubstitutions.id, substitutionId)
        )
      );

    // In production, notifications worker logs and delivers alert to admin
    console.log(
      `[Substitution] Substitute ${ctx.userId} declined cover for ${substitutionId}. Reason: ${reason || "No reason given"}. Returned to unassigned pool.`
    );

    return {
      success: true,
      substitutionId,
      status: "PENDING",
      unassigned: true,
      message: "Substitution declined and returned to unassigned pool.",
    };
  });
}

/**
 * 6. Cancel Teacher's own Outgoing Absence Request
 */
export async function cancelAbsenceRequestAction(substitutionId: string) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const sub = await tx.query.timetableSubstitutions.findFirst({
      where: and(
        eq(timetableSubstitutions.schoolId, school.id),
        eq(timetableSubstitutions.id, substitutionId)
      ),
    });

    if (!sub) throw new Error("Substitution not found");

    if (sub.originalTeacherId !== ctx.userId) {
      throw new Error(
        "Unauthorized: you can only cancel your own absence requests"
      );
    }

    await tx
      .update(timetableSubstitutions)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timetableSubstitutions.schoolId, school.id),
          eq(timetableSubstitutions.id, substitutionId)
        )
      );

    return { success: true, substitutionId, status: "CANCELLED" };
  });
}
