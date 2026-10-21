"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  classes,
  sections,
  subjects,
  classSubjects,
  sectionSubjectTeachers,
  timetablePeriods,
  bellSchedule,
  timetableSubstitutions,
  lessonPlans,
  students,
  studentAttendance,
  assignments,
  assignmentSubmissions,
  markEntries,
  exams,
  domainEvents,
  dayOfWeekEnum,
} from "@/db/schema";
import { eq, and, sql, inArray, isNull, gte, lte, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import {
  resolveTeacherScope,
  assertTeacherCanAccessStudent,
  projectScopedRosterFeeStatus,
} from "@/lib/teacherEventEngine/scopeResolver";
import { revalidatePath } from "next/cache";

export interface MyDayPeriodItem {
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  periodType: string;
  isFree: boolean;
  classId?: string | undefined;
  className?: string | undefined;
  sectionId?: string | undefined;
  sectionName?: string | undefined;
  subjectId?: string | undefined;
  subjectName?: string | undefined;
  roomNumber?: string | undefined;
  isNow: boolean;
  isPast: boolean;
  substitution?: {
    type: "INCOMING_COVER" | "OUTGOING_COVER";
    partnerTeacherName: string;
    status: string;
  } | undefined;
  lessonPlan?: {
    id: string;
    title: string;
    chapterName: string;
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  } | undefined;
}

export interface TeacherSectionSummary {
  id: string;
  name: string;
  className: string;
  classId: string;
  roomNumber: string | null;
  capacity: number;
  isClassTeacher: boolean;
  studentCount: number;
}

export interface StudentRosterRow {
  studentId: string;
  name: string;
  admissionNumber: string;
  rollNumber: string | null;
  attendanceRate30d: number; // 0 - 100
  attendanceStatusChip: "EXCELLENT" | "AVERAGE" | "AT_RISK";
  feeStatus: "PAID" | "DUE" | "OVERDUE"; // Status badge ONLY (AC-T2)
  latestSubmission?: {
    assignmentTitle: string;
    status: "GRADED" | "SUBMITTED" | "LATE" | "MISSING";
    marksAwarded: number | null;
    maxMarks: number;
  } | undefined;
}

export interface Student360Data {
  studentId: string;
  name: string;
  admissionNumber: string;
  rollNumber: string | null;
  className: string;
  sectionName: string;
  feeStatus: "PAID" | "DUE" | "OVERDUE";
  attendanceCalendar: Array<{
    date: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
  }>;
  attendanceSummary: {
    totalDays: number;
    presentDays: number;
    attendancePercent: number;
  };
  assignmentHistory: Array<{
    assignmentId: string;
    title: string;
    dueDate: string;
    marksAwarded: number | null;
    maxMarks: number;
    isLate: boolean;
    remarks: string | null;
  }>;
  examMarksHistory: Array<{
    examName: string;
    subjectName: string;
    marksObtained: number | null;
    isAbsent: boolean;
  }>;
}

function getDayOfWeekEnum(date: Date): "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" {
  const day = date.getDay();
  switch (day) {
    case 1:
      return "MONDAY";
    case 2:
      return "TUESDAY";
    case 3:
      return "WEDNESDAY";
    case 4:
      return "THURSDAY";
    case 5:
      return "FRIDAY";
    case 6:
      return "SATURDAY";
    default:
      return "MONDAY";
  }
}

/**
 * 1. Fetch My Day Timeline (bellSchedule + timetablePeriods + substitutions + lesson plans)
 */
export async function getTeacherMyDayTimeline(dateStr?: string): Promise<{
  date: string;
  dayOfWeek: string;
  timeline: MyDayPeriodItem[];
}> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const calendarDay = targetDate.toISOString().slice(0, 10);
  const dayOfWeek = getDayOfWeekEnum(targetDate);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Fetch School Bell Schedule
    const bells = await tx.query.bellSchedule.findMany({
      where: and(eq(bellSchedule.schoolId, school.id), eq(bellSchedule.isActive, true)),
      orderBy: [bellSchedule.periodNumber],
    });

    // 2. Fetch Teacher Scheduled Timetable Periods for this day
    const scheduled = await tx.query.timetablePeriods.findMany({
      where: and(
        eq(timetablePeriods.schoolId, school.id),
        eq(timetablePeriods.teacherId, ctx.userId),
        eq(timetablePeriods.dayOfWeek, dayOfWeek),
        eq(timetablePeriods.isActive, true)
      ),
      with: {
        section: {
          with: { class: true },
        },
        subject: true,
      },
    });

    const scheduledMap = new Map<number, any>(scheduled.map((p: any) => [p.periodNumber, p]));

    // 3. Fetch Substitutions for today
    const subs = await tx.query.timetableSubstitutions.findMany({
      where: and(
        eq(timetableSubstitutions.schoolId, school.id),
        eq(timetableSubstitutions.date, calendarDay),
        sql`(${timetableSubstitutions.originalTeacherId} = ${ctx.userId} OR ${timetableSubstitutions.substituteTeacherId} = ${ctx.userId})`
      ),
      with: {
        timetablePeriod: {
          with: {
            section: { with: { class: true } },
            subject: true,
          },
        },
        section: {
          with: { class: true },
        },
        subject: true,
      },
    });

    // 4. Fetch Lesson Plans for this teacher
    const plans = await tx.query.lessonPlans.findMany({
      where: and(
        eq(lessonPlans.schoolId, school.id),
        eq(lessonPlans.teacherId, ctx.userId),
        isNull(lessonPlans.deletedAt)
      ),
    });

    const plansBySubject = new Map<string, any>(
      plans.map((lp: any) => [lp.classSubjectId, lp])
    );

    // Current Time in HH:MM
    const nowHours = targetDate.getHours() + targetDate.getMinutes() / 60;

    const timeline: MyDayPeriodItem[] = [];

    // If bell schedule is empty, fall back to periods 1 through 8
    const bellList =
      bells.length > 0
        ? bells
        : Array.from({ length: 8 }, (_, i) => ({
            periodNumber: i + 1,
            name: `Period ${i + 1}`,
            startTime: `${String(8 + i).padStart(2, "0")}:00`,
            endTime: `${String(8 + i).padStart(2, "0")}:45`,
            periodType: "REGULAR" as const,
          }));

    for (const b of bellList) {
      const scheduledPeriod = scheduledMap.get(b.periodNumber);
      const incomingCover = subs.find(
        (s: any) =>
          s.substituteTeacherId === ctx.userId &&
          s.timetablePeriod?.periodNumber === b.periodNumber &&
          s.status === "CONFIRMED"
      );
      const outgoingSub = scheduledPeriod
        ? subs.find(
            (s: any) =>
              s.timetablePeriodId === scheduledPeriod.id &&
              s.originalTeacherId === ctx.userId
          )
        : null;

      const [startH, startM] = b.startTime.split(":").map(Number);
      const [endH, endM] = b.endTime.split(":").map(Number);
      const startDec = (startH ?? 8) + (startM ?? 0) / 60;
      const endDec = (endH ?? 9) + (endM ?? 0) / 60;

      const isNow = nowHours >= startDec && nowHours < endDec;
      const isPast = nowHours >= endDec;

      let substitutionInfo: MyDayPeriodItem["substitution"] = undefined;
      let effectivePeriod = scheduledPeriod;

      if (incomingCover) {
        effectivePeriod = incomingCover.timetablePeriod;
        substitutionInfo = {
          type: "INCOMING_COVER",
          partnerTeacherName: "Staff Colleague",
          status: "CONFIRMED",
        };
      } else if (outgoingSub) {
        substitutionInfo = {
          type: "OUTGOING_COVER",
          partnerTeacherName:
            outgoingSub.status === "CONFIRMED"
              ? "Cover Assigned"
              : "Awaiting Cover",
          status: outgoingSub.status,
        };
      }

      const isFree =
        !effectivePeriod ||
        b.periodType === "BREAK" ||
        b.periodType === "LUNCH" ||
        b.periodType === "FREE";

      let lessonPlanInfo: MyDayPeriodItem["lessonPlan"] = undefined;
      if (effectivePeriod?.subjectId) {
        const lp = plans.find((p: any) => p.status !== "COMPLETED") || plans[0];
        if (lp) {
          lessonPlanInfo = {
            id: lp.id,
            title: lp.title,
            chapterName: lp.chapterName,
            status: lp.status as any,
          };
        }
      }

      timeline.push({
        periodNumber: b.periodNumber,
        name: b.name,
        startTime: b.startTime,
        endTime: b.endTime,
        periodType: b.periodType,
        isFree,
        classId: effectivePeriod?.section?.class?.id,
        className:
          effectivePeriod?.section?.class?.displayName ||
          effectivePeriod?.section?.class?.name,
        sectionId: effectivePeriod?.section?.id,
        sectionName: effectivePeriod?.section?.name,
        subjectId: effectivePeriod?.subject?.id,
        subjectName: effectivePeriod?.subject?.name,
        roomNumber:
          effectivePeriod?.roomNumber ||
          effectivePeriod?.section?.roomNumber ||
          "Room 101",
        isNow,
        isPast,
        substitution: substitutionInfo,
        lessonPlan: lessonPlanInfo,
      });
    }

    return {
      date: calendarDay,
      dayOfWeek,
      timeline,
    };
  });
}

/**
 * 2. 1-Tap Lesson Completion Action (Click Budget: 1 Tap)
 */
export async function completeLessonPlanAction(payload: {
  lessonPlanId?: string | undefined;
  title?: string | undefined;
  chapterName?: string | undefined;
  classSubjectId?: string | undefined;
}): Promise<{ success: boolean; message: string }> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    if (payload.lessonPlanId) {
      await tx
        .update(lessonPlans)
        .set({
          status: "COMPLETED",
          completedDate: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(lessonPlans.id, payload.lessonPlanId),
            eq(lessonPlans.schoolId, school.id),
            eq(lessonPlans.teacherId, ctx.userId)
          )
        );
    } else if (payload.classSubjectId) {
      await tx.insert(lessonPlans).values({
        schoolId: school.id,
        classSubjectId: payload.classSubjectId,
        teacherId: ctx.userId,
        title: payload.title || "Daily Curriculum Lesson",
        chapterName: payload.chapterName || "Standard Unit",
        status: "COMPLETED",
        plannedDate: new Date(),
        completedDate: new Date(),
      });
    }

    // Emit LessonPlanCompletedEvent into domainEvents for admin syllabus dashboard
    await tx.insert(domainEvents).values({
      schoolId: school.id,
      aggregateId: ctx.userId,
      eventType: "LessonPlanCompletedEvent",
      payload: {
        teacherUserId: ctx.userId,
        lessonPlanId: payload.lessonPlanId || null,
        title: payload.title || "Daily Curriculum Lesson",
        completedAt: new Date().toISOString(),
      },
      status: "PENDING",
    });

    revalidatePath("/teacher/classes");
    revalidatePath("/teacher/dashboard");

    return {
      success: true,
      message: "Lesson marked complete. Curriculum coverage updated.",
    };
  });
}

/**
 * 3. Fetch Section Rosters with fee status badge ONLY (AC-T2 DPDP Privacy Contract)
 */
export async function getTeacherSectionRosters(sectionIdParam?: string): Promise<{
  sections: TeacherSectionSummary[];
  selectedSectionId: string;
  students: StudentRosterRow[];
}> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Resolve Teacher Scope
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });

    if (scope.allSectionIds.length === 0) {
      return {
        sections: [],
        selectedSectionId: "",
        students: [],
      };
    }

    // 2. Fetch Section Summaries
    const sectionRows = await tx.query.sections.findMany({
      where: and(
        eq(sections.schoolId, school.id),
        inArray(sections.id, scope.allSectionIds),
        eq(sections.isActive, true)
      ),
      with: { class: true },
    });

    const sectionSummaries: TeacherSectionSummary[] = sectionRows.map((sec: any) => ({
      id: sec.id,
      name: sec.name,
      className: sec.class?.displayName || sec.class?.name || "Class",
      classId: sec.classId,
      roomNumber: sec.roomNumber,
      capacity: sec.capacity || 40,
      isClassTeacher: sec.classTeacherId === ctx.userId,
      studentCount: 0,
    }));

    const activeSectionId =
      sectionIdParam && scope.allSectionIds.includes(sectionIdParam)
        ? sectionIdParam
        : scope.allSectionIds[0]!;

    // 3. Fetch Enrolled Active Students
    const enrolled = await tx.query.students.findMany({
      where: and(
        eq(students.schoolId, school.id),
        eq(students.currentSectionId, activeSectionId),
        eq(students.isActive, true)
      ),
      orderBy: [students.admissionNumber],
    });

    const studentIds = enrolled.map((s: any) => s.id);

    // 4. Fetch Fee Status Badges via Strict Projection Endpoint (AC-T2)
    // NEVER returns fee amounts, invoices, or ledger lines to teachers!
    const feeProjections = await projectScopedRosterFeeStatus(
      ctx.userId,
      activeSectionId,
      { tx, schoolId: school.id }
    );
    const feeStatusMap = new Map(feeProjections.map((p) => [p.studentId, p.status]));

    // 5. Compute 30-day Attendance Rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceRecords =
      studentIds.length > 0
        ? await tx.query.studentAttendance.findMany({
            where: and(
              eq(studentAttendance.schoolId, school.id),
              eq(studentAttendance.sectionId, activeSectionId),
              gte(studentAttendance.attendanceDate, thirtyDaysAgo),
              inArray(studentAttendance.studentId, studentIds)
            ),
          })
        : [];

    const attendanceByStudent = new Map<string, { present: number; total: number }>();
    for (const rec of attendanceRecords) {
      const cur = attendanceByStudent.get(rec.studentId) || { present: 0, total: 0 };
      cur.total++;
      if (rec.status === "PRESENT" || rec.status === "LATE" || rec.status === "HALF_DAY") {
        cur.present++;
      }
      attendanceByStudent.set(rec.studentId, cur);
    }

    // 6. Fetch Latest Assignment Submission
    const latestAssignment = await tx.query.assignments.findFirst({
      where: and(
        eq(assignments.schoolId, school.id),
        eq(assignments.sectionId, activeSectionId)
      ),
      orderBy: [desc(assignments.dueDate)],
      with: { submissions: true },
    });

    const submissionMap = new Map<string, any>();
    if (latestAssignment?.submissions) {
      for (const sub of latestAssignment.submissions) {
        submissionMap.set(sub.studentId, sub);
      }
    }

    const rosterRows: StudentRosterRow[] = enrolled.map((st: any) => {
      const att = attendanceByStudent.get(st.id);
      const rate =
        att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 100;

      const chip: StudentRosterRow["attendanceStatusChip"] =
        rate >= 85 ? "EXCELLENT" : rate >= 75 ? "AVERAGE" : "AT_RISK";

      const sub = submissionMap.get(st.id);
      let submissionInfo: StudentRosterRow["latestSubmission"] = undefined;
      if (latestAssignment) {
        let subStatus: "GRADED" | "SUBMITTED" | "LATE" | "MISSING" = "MISSING";
        if (sub) {
          if (sub.marksAwarded !== null && sub.marksAwarded !== undefined) {
            subStatus = "GRADED";
          } else if (sub.isLate) {
            subStatus = "LATE";
          } else {
            subStatus = "SUBMITTED";
          }
        }
        submissionInfo = {
          assignmentTitle: latestAssignment.title,
          status: subStatus,
          marksAwarded: sub?.marksAwarded || null,
          maxMarks: latestAssignment.maxMarks || 100,
        };
      }

      return {
        studentId: st.id,
        name: `${decryptData(st.firstNameEncrypted)} ${decryptData(st.lastNameEncrypted)}`.trim(),
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        attendanceRate30d: rate,
        attendanceStatusChip: chip,
        feeStatus: feeStatusMap.get(st.id) || "PAID",
        latestSubmission: submissionInfo,
      };
    });

    return {
      sections: sectionSummaries,
      selectedSectionId: activeSectionId,
      students: rosterRows,
    };
  });
}

/**
 * 4. Fetch Student 360 Drawer Profile (Teacher-Scoped View, AC-T2)
 */
export async function getTeacherStudent360Drawer(
  studentId: string
): Promise<Student360Data> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Assert student access in teacher scope (AC-T2)
    const { student } = await assertTeacherCanAccessStudent(ctx.userId, studentId, {
      tx,
      schoolId: school.id,
    });

    const firstName = decryptData(student.firstNameEncrypted);
    const lastName = decryptData(student.lastNameEncrypted);
    const fullName = `${firstName} ${lastName}`.trim();

    // 2. Resolve section info
    const sec = await tx.query.sections.findFirst({
      where: eq(sections.id, student.currentSectionId),
      with: { class: true },
    });

    // 3. Fee Status (Enum badge ONLY, never amounts)
    const feeProjections = await projectScopedRosterFeeStatus(
      ctx.userId,
      student.currentSectionId,
      { tx, schoolId: school.id }
    );
    const feeStatus = feeProjections.find((p) => p.studentId === studentId)?.status || "PAID";

    // 4. Attendance Calendar History (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attRows = await tx.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, school.id),
        eq(studentAttendance.studentId, studentId),
        gte(studentAttendance.attendanceDate, thirtyDaysAgo)
      ),
      orderBy: [desc(studentAttendance.attendanceDate)],
    });

    const attendanceCalendar = attRows.map((r: any) => ({
      date: r.attendanceDate.toISOString().slice(0, 10),
      status: r.status as any,
    }));

    const presentDays = attRows.filter(
      (r: any) => r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY"
    ).length;
    const totalDays = attRows.length;
    const attendancePercent =
      totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    // 5. Assignment History for Teacher's Subjects
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });
    const teacherAssignments = await tx.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, school.id),
        sql`(${assignments.createdByTeacherId} = ${ctx.userId} OR ${assignments.sectionId} IN (${
          scope.allSectionIds.length > 0
            ? sql.join(scope.allSectionIds.map((id) => sql`${id}`), sql`, `)
            : sql`'00000000-0000-0000-0000-000000000000'`
        }))`
      ),
      orderBy: [desc(assignments.dueDate)],
      limit: 10,
      with: {
        submissions: {
          where: eq(assignmentSubmissions.studentId, studentId),
        },
      },
    });

    const assignmentHistory = teacherAssignments.map((a: any) => {
      const sub = a.submissions?.[0];
      return {
        assignmentId: a.id,
        title: a.title,
        dueDate: a.dueDate.toISOString().slice(0, 10),
        marksAwarded: sub?.marksAwarded ?? null,
        maxMarks: a.maxMarks || 100,
        isLate: sub?.isLate || false,
        remarks: sub?.remarks || null,
      };
    });

    // 6. Exam Marks History
    const examMarks = await tx.query.markEntries.findMany({
      where: and(
        eq(markEntries.schoolId, school.id),
        eq(markEntries.studentId, studentId)
      ),
      with: {
        exam: true,
        subject: true,
      },
      orderBy: [desc(markEntries.enteredAt)],
      limit: 10,
    });

    const examMarksHistory = examMarks.map((m: any) => ({
      examName: m.exam?.name || "Term Exam",
      subjectName: m.subject?.name || "Subject",
      marksObtained: m.marksObtained !== null ? Number(m.marksObtained) : null,
      isAbsent: m.isAbsent || false,
    }));

    return {
      studentId: student.id,
      name: fullName,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      className: sec?.class?.displayName || "Class",
      sectionName: sec?.name || "Section",
      feeStatus,
      attendanceCalendar,
      attendanceSummary: {
        totalDays,
        presentDays,
        attendancePercent,
      },
      assignmentHistory,
      examMarksHistory,
    };
  });
}
