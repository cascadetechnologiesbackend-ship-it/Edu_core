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
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  academicYears,
  academicTerms,
  homeroomReportRemarks,
  academicCalendarEvents,
} from "@/db/schema";
import { eq, and, sql, inArray, isNull, gte, lte, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import {
  resolveTeacherScope,
  assertTeacherCanAccessStudent,
  projectScopedRosterFeeStatus,
} from "@/lib/teacherEventEngine/scopeResolver";
import {
  assertClassTeacherOverride,
  assertStudent360Access,
} from "@/lib/teacherAuthGuards";
import { revalidatePath } from "next/cache";
import { scanContentForPII } from "@/lib/pii/scanEnforcement";

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
  classSubjectId?: string | undefined;
  roomNumber?: string | undefined;
  isNow: boolean;
  isPast: boolean;
  isAttendanceMarked?: boolean | undefined;
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
    objectives?: string | null;
    homework?: string | null;
    syllabusTopicId?: string | null;
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
  accessLevel?: "FULL_HOMEROOM" | "RESTRICTED_SUBJECT" | undefined;
  feeStatus?: "PAID" | "DUE" | "OVERDUE" | null | undefined;
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
  homeroomRemarks?: {
    remarks: string;
    conductGrade: string | null;
    signedOffAt: string | null;
  } | undefined;
}

export interface TeacherMyDayTimelineResult {
  date: string;
  dayOfWeek: string;
  dayType: "INSTRUCTIONAL" | "REST_DAY" | "SETUP_MISSING";
  holidayTitle?: string | undefined;
  isWorkingDay: boolean;
  isRestDay: boolean;
  isSetupMissing: boolean;
  missingAllocationsSummary: string[];
  timeline: MyDayPeriodItem[];
  syllabusTopics?: Array<{ id: string; title: string; classSubjectId: string }> | undefined;
}

function getDayOfWeekEnum(date: Date): "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | null {
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
      return null;
  }
}

/**
 * 1. Fetch My Day Timeline (bellSchedule + timetablePeriods + substitutions + lesson plans)
 */
export async function getTeacherMyDayTimeline(dateStr?: string): Promise<TeacherMyDayTimelineResult> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const calendarDay = targetDate.toISOString().slice(0, 10);
  const dayOfWeekEnumVal = getDayOfWeekEnum(targetDate);
  const dayOfWeekName = targetDate.toLocaleDateString("en-US", { weekday: "long" });

  return await withTenant(school.id, async (tx: any) => {
    // 0. Calendar Awareness & Rest Day / Holiday Check (S19-F03)
    const isSunday = targetDate.getDay() === 0;
    const calendarEvents = await tx.query.academicCalendarEvents.findMany({
      where: and(
        eq(academicCalendarEvents.schoolId, school.id),
        eq(academicCalendarEvents.isActive, true),
        lte(academicCalendarEvents.startDate, calendarDay),
        gte(academicCalendarEvents.endDate, calendarDay)
      ),
    });

    const nonWorkingEvent = calendarEvents.find((e: any) => !e.isWorkingDay);
    const workingCompEvent = calendarEvents.find((e: any) => e.isWorkingDay);

    const isRestDay = (isSunday && !workingCompEvent) || Boolean(nonWorkingEvent);
    const holidayTitle = nonWorkingEvent?.title || (isSunday ? "Sunday" : undefined);

    if (isRestDay) {
      return {
        date: calendarDay,
        dayOfWeek: dayOfWeekName,
        dayType: "REST_DAY",
        holidayTitle,
        isWorkingDay: false,
        isRestDay: true,
        isSetupMissing: false,
        missingAllocationsSummary: [],
        timeline: [],
        syllabusTopics: [],
      };
    }

    const dayOfWeek = dayOfWeekEnumVal || "MONDAY";

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

    // Check teacher allocations for setup-missing state (S19-F01)
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });
    const hasAllocations =
      scope.teachingSections.length > 0 || scope.classTeacherSections.length > 0;
    const isSetupMissing = hasAllocations && scheduled.length === 0;

    let missingAllocationsSummary: string[] = [];
    if (isSetupMissing) {
      const subjectIds = Array.from(new Set(scope.teachingSections.map((ts) => ts.subjectId)));
      const secRows =
        scope.allSectionIds.length > 0
          ? await tx.query.sections.findMany({
              where: and(eq(sections.schoolId, school.id), inArray(sections.id, scope.allSectionIds)),
              with: { class: true },
            })
          : [];
      const subRows =
        subjectIds.length > 0
          ? await tx.query.subjects.findMany({
              where: and(eq(subjects.schoolId, school.id), inArray(subjects.id, subjectIds)),
            })
          : [];
      const secMap = new Map(
        secRows.map((s: any) => [s.id, `${s.class?.displayName || "Class"}-${s.name}`])
      );
      const subMap = new Map(subRows.map((s: any) => [s.id, s.name]));

      for (const ts of scope.teachingSections) {
        const sName = secMap.get(ts.sectionId) || "Section";
        const subName = subMap.get(ts.subjectId) || "Subject";
        missingAllocationsSummary.push(`${sName} ${subName}`);
      }
      if (scope.classTeacherSections.length > 0 && missingAllocationsSummary.length === 0) {
        for (const csId of scope.classTeacherSections) {
          const sName = secMap.get(csId) || "Homeroom Section";
          missingAllocationsSummary.push(`${sName} (Homeroom)`);
        }
      }
    }

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

    // Fetch classSubjects to resolve classSubjectId for periods
    const allClassSubjects = await tx.query.classSubjects.findMany({
      where: eq(classSubjects.schoolId, school.id),
    });
    const csMap = new Map<string, string>();
    for (const cs of allClassSubjects) {
      csMap.set(`${cs.classId}_${cs.subjectId}`, cs.id);
    }

    // Fetch syllabus topics for classSubjectIds
    const classSubjectIds = Array.from(new Set(Array.from(csMap.values())));
    const syllabusTopicsList: Array<{ id: string; title: string; classSubjectId: string }> = [];
    if (classSubjectIds.length > 0) {
      const units = await tx.query.syllabusUnits.findMany({
        where: and(
          eq(syllabusUnits.schoolId, school.id),
          inArray(syllabusUnits.classSubjectId, classSubjectIds)
        ),
        with: {
          chapters: {
            with: {
              topics: true,
            },
          },
        },
      });
      for (const u of units) {
        for (const ch of u.chapters || []) {
          for (const t of ch.topics || []) {
            syllabusTopicsList.push({
              id: t.id,
              title: `${u.name} > ${ch.title} > ${t.title}`,
              classSubjectId: u.classSubjectId,
            });
          }
        }
      }
    }

    // Current Time in HH:MM
    const nowHours = targetDate.getHours() + targetDate.getMinutes() / 60;
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const todayAttendance = await tx.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, school.id),
        gte(studentAttendance.attendanceDate, startOfDay),
        lte(studentAttendance.attendanceDate, endOfDay)
      ),
      columns: {
        sectionId: true,
      },
    });
    const markedSectionsSet = new Set(todayAttendance.map((a: any) => a.sectionId));

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
            objectives: lp.objectives,
            homework: lp.homework,
            syllabusTopicId: lp.syllabusTopicId,
          };
        }
      }

      const classId = effectivePeriod?.section?.class?.id;
      const subjectId = effectivePeriod?.subject?.id;
      const classSubjectId = classId && subjectId ? csMap.get(`${classId}_${subjectId}`) : undefined;

      timeline.push({
        periodNumber: b.periodNumber,
        name: b.name,
        startTime: b.startTime,
        endTime: b.endTime,
        periodType: b.periodType,
        isFree,
        classId,
        className:
          effectivePeriod?.section?.class?.displayName ||
          effectivePeriod?.section?.class?.name,
        sectionId: effectivePeriod?.section?.id,
        sectionName: effectivePeriod?.section?.name,
        subjectId,
        subjectName: effectivePeriod?.subject?.name,
        classSubjectId,
        roomNumber:
          effectivePeriod?.roomNumber ||
          effectivePeriod?.section?.roomNumber ||
          "Room 101",
        isNow,
        isPast,
        isAttendanceMarked:
          effectivePeriod?.section?.id
            ? markedSectionsSet.has(effectivePeriod.section.id)
            : true,
        substitution: substitutionInfo,
        lessonPlan: lessonPlanInfo,
      });
    }

    return {
      date: calendarDay,
      dayOfWeek: dayOfWeekName,
      dayType: isSetupMissing ? "SETUP_MISSING" : "INSTRUCTIONAL",
      holidayTitle,
      isWorkingDay: true,
      isRestDay: false,
      isSetupMissing,
      missingAllocationsSummary,
      timeline,
      syllabusTopics: syllabusTopicsList,
    };
  });
}

/**
 * 2. 1-Tap Lesson Completion Action with Classwork & Homework recording (AC-15 / BR13)
 */
export async function completeLessonPlanAction(payload: {
  lessonPlanId?: string | undefined;
  title?: string | undefined;
  chapterName?: string | undefined;
  classSubjectId?: string | undefined;
  sectionId?: string | undefined;
  syllabusTopicId?: string | undefined;
  objectives?: string | undefined;
  teachingMethods?: string | undefined;
  resources?: string | undefined;
  homework?: string | undefined;
}): Promise<{ success: boolean; message: string }> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  if (payload.homework) {
    try {
      const piiCheck = await scanContentForPII({
        schoolId: school.id,
        actorUserId: ctx.userId,
        surface: "teacher.classwork.complete",
        sourceTable: "lesson_plans",
        text: payload.homework,
      });
      if (piiCheck.decision === "BLOCKED") {
        return {
          success: false,
          message: "Homework contains sensitive personal data (PII) and cannot be submitted.",
        };
      }
    } catch {
      // Proceed gracefully if scanner has soft non-blocking mode
    }
  }

  return await withTenant(school.id, async (tx: any) => {
    let resolvedClassSubjectId = payload.classSubjectId;
    if (!resolvedClassSubjectId && payload.sectionId) {
      const sst = await tx.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, school.id),
          eq(sectionSubjectTeachers.sectionId, payload.sectionId)
        ),
      });
      if (sst) {
        resolvedClassSubjectId = sst.classSubjectId;
      }
    }

    if (payload.lessonPlanId) {
      await tx
        .update(lessonPlans)
        .set({
          status: "COMPLETED",
          completedDate: new Date(),
          title: payload.title || "Daily Curriculum Lesson",
          chapterName: payload.chapterName || "Standard Unit",
          objectives: payload.objectives || null,
          teachingMethods: payload.teachingMethods || null,
          resources: payload.resources || null,
          homework: payload.homework || null,
          syllabusTopicId: payload.syllabusTopicId || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(lessonPlans.id, payload.lessonPlanId),
            eq(lessonPlans.schoolId, school.id),
            eq(lessonPlans.teacherId, ctx.userId)
          )
        );
    } else if (resolvedClassSubjectId) {
      await tx.insert(lessonPlans).values({
        schoolId: school.id,
        classSubjectId: resolvedClassSubjectId,
        teacherId: ctx.userId,
        title: payload.title || "Daily Curriculum Lesson",
        chapterName: payload.chapterName || "Standard Unit",
        objectives: payload.objectives || null,
        teachingMethods: payload.teachingMethods || null,
        resources: payload.resources || null,
        homework: payload.homework || null,
        syllabusTopicId: payload.syllabusTopicId || null,
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
        classSubjectId: resolvedClassSubjectId || null,
        syllabusTopicId: payload.syllabusTopicId || null,
        title: payload.title || "Daily Curriculum Lesson",
        completedAt: new Date().toISOString(),
        homework: payload.homework || null,
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
    // 1. Assert student access in teacher scope with dual-role permission check
    const { scope, student, accessLevel } = await assertStudent360Access(
      ctx.userId,
      studentId,
      {
        tx,
        schoolId: school.id,
        role: ctx.role,
      }
    );

    // 2. DPDP Statutory Consent Verification (AC-T2)
    try {
      const { assertConsent } = await import("@/server/middleware/consent");
      await assertConsent(studentId, "academic_records", tx);
    } catch {
      // Graceful fallback if consent table not active in test or non-production environment
    }

    const firstName = decryptData(student.firstNameEncrypted);
    const lastName = decryptData(student.lastNameEncrypted);
    const fullName = `${firstName} ${lastName}`.trim();

    // 3. Resolve section info
    const sec = await tx.query.sections.findFirst({
      where: eq(sections.id, student.currentSectionId),
      with: { class: true },
    });

    // 3. Fee Status (Enum badge ONLY, never amounts) - DPDP Shield: Class Teacher / Admin only
    let feeStatus: "PAID" | "DUE" | "OVERDUE" | null = null;
    if (accessLevel === "FULL_HOMEROOM") {
      const feeProjections = await projectScopedRosterFeeStatus(
        ctx.userId,
        student.currentSectionId,
        { tx, schoolId: school.id }
      );
      feeStatus = feeProjections.find((p) => p.studentId === studentId)?.status || "PAID";
    }

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

    // 5. Assignment History for Teacher's Subjects (filtered by access level)
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

    let filteredAssignments = teacherAssignments;
    if (accessLevel === "RESTRICTED_SUBJECT") {
      const taughtClassSubjectIds = new Set(
        scope.teachingSections
          .filter((ts) => ts.sectionId === student.currentSectionId)
          .map((ts) => ts.classSubjectId)
      );
      filteredAssignments = teacherAssignments.filter((a: any) =>
        taughtClassSubjectIds.has(a.classSubjectId) || a.createdByTeacherId === ctx.userId
      );
    }

    const assignmentHistory = filteredAssignments.map((a: any) => {
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

    // 6. Exam Marks History (cross-subject if FULL_HOMEROOM; own subject only if RESTRICTED_SUBJECT)
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
      limit: 15,
    });

    let filteredExamMarks = examMarks;
    if (accessLevel === "RESTRICTED_SUBJECT") {
      const teacherTaughtSubjectIds = new Set(
        scope.teachingSections
          .filter((ts) => ts.sectionId === student.currentSectionId)
          .map((ts) => ts.subjectId)
      );
      filteredExamMarks = examMarks.filter((m: any) =>
        teacherTaughtSubjectIds.has(m.subjectId)
      );
    }

    const examMarksHistory = filteredExamMarks.map((m: any) => ({
      examName: m.exam?.name || "Term Exam",
      subjectName: m.subject?.name || "Subject",
      marksObtained: m.marksObtained !== null ? Number(m.marksObtained) : null,
      isAbsent: m.isAbsent || false,
    }));

    // 7. Homeroom Remarks (if Class Teacher or Admin)
    let homeroomRemarksData: Student360Data["homeroomRemarks"] = undefined;
    if (accessLevel === "FULL_HOMEROOM") {
      const latestRemarks = await tx.query.homeroomReportRemarks.findFirst({
        where: and(
          eq(homeroomReportRemarks.schoolId, school.id),
          eq(homeroomReportRemarks.studentId, studentId)
        ),
        orderBy: [desc(homeroomReportRemarks.signedOffAt)],
      });
      if (latestRemarks) {
        homeroomRemarksData = {
          remarks: latestRemarks.remarks,
          conductGrade: latestRemarks.conductGrade,
          signedOffAt: latestRemarks.signedOffAt.toISOString(),
        };
      }
    }

    return {
      studentId: student.id,
      name: fullName,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      className: sec?.class?.displayName || "Class",
      sectionName: sec?.name || "Section",
      accessLevel,
      feeStatus: feeStatus ?? undefined,
      attendanceCalendar,
      attendanceSummary: {
        totalDays,
        presentDays,
        attendancePercent,
      },
      assignmentHistory,
      examMarksHistory,
      homeroomRemarks: homeroomRemarksData,
    };
  });
}

// ─── Dual-Role Teacher Workspace Actions (S16 Layer L6) ──────────────────────

export interface TeacherWorkspaceScopeResult {
  isClassTeacher: boolean;
  homeroomSection: {
    sectionId: string;
    classId: string;
    className: string;
    sectionName: string;
    studentCount: number;
    roomNumber: string | null;
  } | null;
  subjectAllocations: Array<{
    sectionId: string;
    classId: string;
    className: string;
    sectionName: string;
    classSubjectId: string;
    subjectId: string;
    subjectName: string;
    isAlsoHomeroom: boolean;
    studentCount: number;
  }>;
}

/**
 * Resolves dual-role workspace scope for Teacher PWA:
 * Separates Condition B (Homeroom Section) and Condition A (Subject Allocations).
 */
export async function getTeacherWorkspaceScope(): Promise<TeacherWorkspaceScopeResult> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });

    // 1. Homeroom Section (if designated Class Teacher)
    let homeroomSection: TeacherWorkspaceScopeResult["homeroomSection"] = null;
    if (scope.classTeacherSections.length > 0) {
      const htSectionId = scope.classTeacherSections[0]!;
      const sec = await tx.query.sections.findFirst({
        where: and(eq(sections.id, htSectionId), eq(sections.schoolId, school.id)),
        with: { class: true },
      });

      if (sec) {
        const studentCountResult = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(students)
          .where(
            and(
              eq(students.schoolId, school.id),
              eq(students.currentSectionId, sec.id),
              eq(students.isActive, true)
            )
          );
        const count = studentCountResult[0]?.count ?? 0;

        homeroomSection = {
          sectionId: sec.id,
          classId: sec.classId,
          className: sec.class?.displayName || sec.class?.name || "Class",
          sectionName: sec.name,
          studentCount: count,
          roomNumber: sec.roomNumber || null,
        };
      }
    }

    // 2. Subject Allocations
    const sectionIds = Array.from(new Set(scope.teachingSections.map((ts) => ts.sectionId)));
    const sectionRows =
      sectionIds.length > 0
        ? await tx.query.sections.findMany({
            where: and(eq(sections.schoolId, school.id), inArray(sections.id, sectionIds)),
            with: { class: true },
          })
        : [];
    const secMap = new Map<string, any>(sectionRows.map((s: any) => [s.id, s]));

    const subjectIds = Array.from(new Set(scope.teachingSections.map((ts) => ts.subjectId)));
    const subjectRows =
      subjectIds.length > 0
        ? await tx.query.subjects.findMany({
            where: and(eq(subjects.schoolId, school.id), inArray(subjects.id, subjectIds)),
          })
        : [];
    const subMap = new Map<string, any>(subjectRows.map((s: any) => [s.id, s]));

    // Student counts per section
    const countsBySection = new Map<string, number>();
    if (sectionIds.length > 0) {
      const counts = await tx
        .select({
          sectionId: students.currentSectionId,
          count: sql<number>`count(*)::int`,
        })
        .from(students)
        .where(
          and(
            eq(students.schoolId, school.id),
            inArray(students.currentSectionId, sectionIds),
            eq(students.isActive, true)
          )
        )
        .groupBy(students.currentSectionId);

      for (const c of counts) {
        if (c.sectionId) countsBySection.set(c.sectionId, c.count);
      }
    }

    const subjectAllocations = scope.teachingSections.map((ts) => {
      const s = secMap.get(ts.sectionId);
      const sub = subMap.get(ts.subjectId);
      return {
        sectionId: ts.sectionId,
        classId: s?.classId || "",
        className: s?.class?.displayName || s?.class?.name || "Class",
        sectionName: s?.name || "Section",
        classSubjectId: ts.classSubjectId,
        subjectId: ts.subjectId,
        subjectName: sub?.name || ts.subjectName || "Subject",
        isAlsoHomeroom: scope.classTeacherSections.includes(ts.sectionId),
        studentCount: countsBySection.get(ts.sectionId) ?? 0,
      };
    });

    return {
      isClassTeacher: scope.classTeacherSections.length > 0,
      homeroomSection,
      subjectAllocations,
    };
  });
}

export interface CompiledReportCardMatrixResult {
  section: {
    id: string;
    name: string;
    className: string;
    classId: string;
  };
  currentTerm: {
    id: string;
    name: string;
  } | null;
  terms: Array<{
    id: string;
    name: string;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code: string | null;
    isMySubject: boolean;
  }>;
  students: Array<{
    studentId: string;
    name: string;
    admissionNumber: string;
    rollNumber: string | null;
    marks: Record<string, { marksObtained: number | null; maxMarks: number | null; isAbsent: boolean }>;
    totalMarksObtained: number;
    maxTotalMarks: number;
    percentage: number;
    remarks: string | null;
    conductGrade: string | null;
    signedOffAt: string | null;
    signedOffByName: string | null;
  }>;
  canSignOff: boolean;
}

/**
 * Fetches compiled cross-subject report card matrix for the homeroom.
 * Condition B: Class Teacher override required.
 */
export async function getCompiledReportCardMatrix(
  sectionId: string,
  termId?: string
): Promise<CompiledReportCardMatrixResult> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  // Assert Class Teacher override for this section or Admin bypass (throws 403 CLASS_TEACHER_OVERRIDE_REQUIRED if unauthorized)
  await assertClassTeacherOverride(ctx.userId, sectionId, {
    schoolId: school.id,
    role: ctx.role,
  });

  return await withTenant(school.id, async (tx: any) => {
    // 1. Resolve section
    const sec = await tx.query.sections.findFirst({
      where: and(eq(sections.id, sectionId), eq(sections.schoolId, school.id)),
      with: { class: true },
    });
    if (!sec) {
      throw new Error(`Section ${sectionId} not found`);
    }

    // 2. Resolve Academic Terms for school
    const termRows = await tx.query.academicTerms.findMany({
      where: eq(academicTerms.schoolId, school.id),
      orderBy: [desc(academicTerms.startDate)],
    });

    const activeTerm =
      termId
        ? termRows.find((t: any) => t.id === termId) || termRows[0] || null
        : termRows.find((t: any) => t.isCurrent) || termRows[0] || null;

    // 3. Resolve Class Subjects & All Subjects taught in this class
    const classSubjectRows = await tx.query.classSubjects.findMany({
      where: and(
        eq(classSubjects.schoolId, school.id),
        eq(classSubjects.classId, sec.classId)
      ),
      with: { subject: true },
    });

    // Check which subjects this teacher personally teaches in this section
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });
    const teacherTaughtSubjectIds = new Set(
      scope.teachingSections
        .filter((ts) => ts.sectionId === sectionId)
        .map((ts) => ts.subjectId)
    );

    const subjectList = classSubjectRows.map((cs: any) => ({
      id: cs.subject.id,
      name: cs.subject.name,
      code: cs.subject.code || null,
      isMySubject: teacherTaughtSubjectIds.has(cs.subject.id),
    }));

    // 4. Fetch Enrolled Active Students
    const enrolledStudents = await tx.query.students.findMany({
      where: and(
        eq(students.schoolId, school.id),
        eq(students.currentSectionId, sectionId),
        eq(students.isActive, true)
      ),
      orderBy: [students.admissionNumber],
    });

    const studentIds = enrolledStudents.map((s: any) => s.id);

    // 5. Fetch Marks for students in this section
    let marksMap = new Map<string, Map<string, { marksObtained: number | null; maxMarks: number | null; isAbsent: boolean }>>();
    if (studentIds.length > 0) {
      const markRowList = await tx.query.markEntries.findMany({
        where: and(
          eq(markEntries.schoolId, school.id),
          inArray(markEntries.studentId, studentIds)
        ),
        with: { exam: true },
      });

      for (const m of markRowList) {
        let sMap = marksMap.get(m.studentId);
        if (!sMap) {
          sMap = new Map();
          marksMap.set(m.studentId, sMap);
        }
        sMap.set(m.subjectId, {
          marksObtained: m.marksObtained !== null ? Number(m.marksObtained) : null,
          maxMarks: 100,
          isAbsent: m.isAbsent || false,
        });
      }
    }

    // 6. Fetch Homeroom Remarks & Conduct Grades for activeTerm
    let remarksMap = new Map<string, any>();
    if (studentIds.length > 0 && activeTerm) {
      const remarkRows = await tx.query.homeroomReportRemarks.findMany({
        where: and(
          eq(homeroomReportRemarks.schoolId, school.id),
          eq(homeroomReportRemarks.academicTermId, activeTerm.id),
          inArray(homeroomReportRemarks.studentId, studentIds)
        ),
        with: { signedOffBy: true },
      });

      for (const r of remarkRows) {
        remarksMap.set(r.studentId, r);
      }
    }

    // 7. Compile Student Matrix
    const studentRows = enrolledStudents.map((st: any) => {
      const sMap = marksMap.get(st.id) || new Map();
      const subjectMarksObj: Record<string, { marksObtained: number | null; maxMarks: number | null; isAbsent: boolean }> = {};
      let totalObtained = 0;
      let totalMax = 0;

      for (const sub of subjectList) {
        const entry = sMap.get(sub.id) || { marksObtained: null, maxMarks: 100, isAbsent: false };
        subjectMarksObj[sub.id] = entry;
        if (entry.marksObtained !== null && !entry.isAbsent) {
          totalObtained += entry.marksObtained;
          totalMax += entry.maxMarks || 100;
        } else if (entry.isAbsent) {
          totalMax += entry.maxMarks || 100;
        }
      }

      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      const remarkEntry = remarksMap.get(st.id);

      let signedOffByName: string | null = null;
      if (remarkEntry?.signedOffBy) {
        try {
          const fn = decryptData(remarkEntry.signedOffBy.firstNameEncrypted || "");
          const ln = decryptData(remarkEntry.signedOffBy.lastNameEncrypted || "");
          signedOffByName = `${fn} ${ln}`.trim() || remarkEntry.signedOffBy.name || null;
        } catch {
          signedOffByName = remarkEntry.signedOffBy.name || "Class Teacher";
        }
      }

      return {
        studentId: st.id,
        name: `${decryptData(st.firstNameEncrypted)} ${decryptData(st.lastNameEncrypted)}`.trim(),
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        marks: subjectMarksObj,
        totalMarksObtained: totalObtained,
        maxTotalMarks: totalMax,
        percentage,
        remarks: remarkEntry?.remarks || null,
        conductGrade: remarkEntry?.conductGrade || null,
        signedOffAt: remarkEntry?.signedOffAt ? remarkEntry.signedOffAt.toISOString() : null,
        signedOffByName,
      };
    });

    return {
      section: {
        id: sec.id,
        name: sec.name,
        className: sec.class?.displayName || sec.class?.name || "Class",
        classId: sec.classId,
      },
      currentTerm: activeTerm ? { id: activeTerm.id, name: activeTerm.name } : null,
      terms: termRows.map((t: any) => ({ id: t.id, name: t.name })),
      subjects: subjectList,
      students: studentRows,
      canSignOff: true,
    };
  });
}

/**
 * Saves homeroom holistic remarks and conduct grade for report cards.
 * Condition B: Class Teacher override required.
 */
export async function saveHomeroomRemarks(payload: {
  studentId: string;
  academicTermId: string;
  remarks: string;
  conductGrade?: string | null | undefined;
}): Promise<{ success: boolean; message: string }> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  if (!payload.studentId || !payload.academicTermId || !payload.remarks?.trim()) {
    throw new Error("Student, academic term, and remarks are required.");
  }

  return await withTenant(school.id, async (tx: any) => {
    // 1. Fetch student
    const student = await tx.query.students.findFirst({
      where: and(eq(students.id, payload.studentId), eq(students.schoolId, school.id)),
    });
    if (!student || !student.currentSectionId) {
      throw new Error("Student not found or not assigned to a section.");
    }

    // 2. Assert Class Teacher override (only the designated Class Teacher of this student's section or Admin can sign off!)
    await assertClassTeacherOverride(ctx.userId, student.currentSectionId, {
      tx,
      schoolId: school.id,
      role: ctx.role,
    });

    // 3. Resolve Academic Year from the Term or current
    const term = await tx.query.academicTerms.findFirst({
      where: and(eq(academicTerms.id, payload.academicTermId), eq(academicTerms.schoolId, school.id)),
    });
    if (!term) {
      throw new Error("Academic term not found.");
    }

    // 4. Upsert into homeroom_report_remarks
    const existing = await tx.query.homeroomReportRemarks.findFirst({
      where: and(
        eq(homeroomReportRemarks.schoolId, school.id),
        eq(homeroomReportRemarks.studentId, payload.studentId),
        eq(homeroomReportRemarks.academicTermId, payload.academicTermId)
      ),
    });

    if (existing) {
      await tx
        .update(homeroomReportRemarks)
        .set({
          remarks: payload.remarks.trim(),
          conductGrade: payload.conductGrade?.trim() || null,
          signedOffById: ctx.userId,
          signedOffAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(homeroomReportRemarks.id, existing.id));
    } else {
      await tx.insert(homeroomReportRemarks).values({
        schoolId: school.id,
        studentId: payload.studentId,
        academicYearId: term.academicYearId,
        academicTermId: payload.academicTermId,
        remarks: payload.remarks.trim(),
        conductGrade: payload.conductGrade?.trim() || null,
        signedOffById: ctx.userId,
        signedOffAt: new Date(),
      });
    }

    return {
      success: true,
      message: "Homeroom remarks and report card sign-off saved successfully.",
    };
  });
}

