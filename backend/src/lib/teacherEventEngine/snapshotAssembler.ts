import { db } from "@/db";
import {
  classes,
  sections,
  students,
  studentAttendance,
  assignments,
  assignmentSubmissions,
  exams,
  examMarkDistributions,
  markEntries,
  studentLeaveRequests,
  timetablePeriods,
  timetableSubstitutions,
  ptmBookings,
  ptmSlots,
  parentTeacherMessages,
  notices,
  academicCalendarEvents,
  subjects,
  classSubjects,
  lessonPlans,
} from "@/db/schema";
import { eq, and, or, inArray, isNull, isNotNull, gte, lte, desc, asc } from "drizzle-orm";
import { resolveTeacherScope } from "./scopeResolver";
import { decryptData } from "../encryption";
import {
  batchResolveStudentIdentities,
  batchResolveSectionContexts,
  batchResolveSubjectContexts,
} from "./identityResolver";
import { checkSubstitutionClash } from "./substitutionClash";
import {
  TeacherDataSnapshot,
  AttendanceSectionSummary,
  TimetablePeriodItem,
  AssignmentGradingItem,
  MarksEntryWindowItem,
  LeaveRequestItem,
  SubstitutionItem,
  PTMSlotItem,
  TeacherMessageItem,
  TeacherNoticeItem,
  TeacherHomeworkDueItem,
  TeacherPendingClassworkPeriod,
  TeacherInsightItem,
} from "./types";

const DAY_OF_WEEK_NAMES: ("MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY")[] = [
  "MONDAY",    // 0 = Sunday (will be handled by isWorkingDay=false)
  "MONDAY",    // 1 = Monday
  "TUESDAY",   // 2 = Tuesday
  "WEDNESDAY", // 3 = Wednesday
  "THURSDAY",  // 4 = Thursday
  "FRIDAY",    // 5 = Friday
  "SATURDAY",  // 6 = Saturday
];

/**
 * Assembles a comprehensive TeacherDataSnapshot inside tenant boundary.
 * Strictly respects resolveTeacherScope so teachers only see their own sections and students.
 */
export async function assembleTeacherSnapshot(
  schoolId: string,
  teacherUserId: string,
  now: Date = new Date(),
  txDb: any = db
): Promise<TeacherDataSnapshot> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const todayStr: string = now.toISOString().split("T")[0]!;
  const nowMs = now.getTime();
  const dayOfWeekNumber = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfWeekEnumVal = dayOfWeekNumber >= 1 && dayOfWeekNumber <= 6 ? DAY_OF_WEEK_NAMES[dayOfWeekNumber] : null;

  // 1. Resolve Teacher Scope (classTeacherSections, teachingSections, scheduledPeriods, allSectionIds)
  const scope = await resolveTeacherScope(teacherUserId, { tx: txDb, schoolId });

  // Check if today is a working day (exclude Sunday 0, or calendar holidays spanning today)
  let isWorkingDay = dayOfWeekNumber !== 0; // Sunday is not a working day
  let isRestDay = !isWorkingDay;
  let calendarEventTitle: string | undefined = dayOfWeekNumber === 0 ? "Sunday" : undefined;

  const calendarEvents = await txDb.query.academicCalendarEvents.findMany({
    where: and(
      eq(academicCalendarEvents.schoolId, schoolId),
      eq(academicCalendarEvents.isActive, true),
      lte(academicCalendarEvents.startDate, todayStr),
      gte(academicCalendarEvents.endDate, todayStr)
    ),
  });

  const holidayEvent = calendarEvents.find((e: any) => !e.isWorkingDay);
  const workingCompEvent = calendarEvents.find((e: any) => e.isWorkingDay);

  if (holidayEvent) {
    isWorkingDay = false;
    isRestDay = true;
    calendarEventTitle = holidayEvent.title;
  } else if (workingCompEvent) {
    isWorkingDay = true;
    isRestDay = false;
    calendarEventTitle = workingCompEvent.title;
  }

  // 2. Attendance Sections Summary (strictly for class teacher / homeroom sections - S16 Condition B)
  const attendanceSections: AttendanceSectionSummary[] = [];
  const primarySectionIds = scope.classTeacherSections;

  if (primarySectionIds.length > 0) {
    const sectionRows = await txDb.query.sections.findMany({
      where: and(
        eq(sections.schoolId, schoolId),
        inArray(sections.id, primarySectionIds)
      ),
      with: {
        class: true,
      },
    });

    for (const sec of sectionRows) {
      // Total active students in this section
      const activeStudents = await txDb.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.currentSectionId, sec.id),
          eq(students.isActive, true)
        ),
        columns: { id: true },
      });
      const totalStudents = activeStudents.length;

      // Attendance marked today for this section (day-wise, periodId is null)
      const attendanceToday = await txDb.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          eq(studentAttendance.sectionId, sec.id),
          gte(studentAttendance.attendanceDate, startOfDay),
          lte(studentAttendance.attendanceDate, endOfDay),
          isNull(studentAttendance.periodId)
        ),
      });

      const isMarked = totalStudents > 0 && attendanceToday.length >= totalStudents;
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;

      for (const att of attendanceToday) {
        if (att.status === "PRESENT") presentCount++;
        else if (att.status === "ABSENT") absentCount++;
        else if (att.status === "LEAVE") leaveCount++;
        else if (att.status === "LATE") lateCount++;
        else if (att.status === "HALF_DAY") halfDayCount++;
      }

      attendanceSections.push({
        sectionId: sec.id,
        sectionName: sec.name,
        className: sec.class?.displayName || sec.class?.gradeLevel || "Class",
        totalStudents,
        markedCount: attendanceToday.length,
        presentCount,
        absentCount,
        leaveCount,
        lateCount,
        halfDayCount,
        isMarked,
      });
    }
  }

  // 3. Timetable Today
  const timetableToday: TimetablePeriodItem[] = [];
  if (isWorkingDay && dayOfWeekEnumVal) {
    const periods = await txDb.query.timetablePeriods.findMany({
      where: and(
        eq(timetablePeriods.schoolId, schoolId),
        eq(timetablePeriods.teacherId, teacherUserId),
        eq(timetablePeriods.dayOfWeek, dayOfWeekEnumVal),
        eq(timetablePeriods.isActive, true)
      ),
      with: {
        section: {
          with: { class: true },
        },
        subject: true,
      },
      orderBy: [asc(timetablePeriods.periodNumber)],
    });

    for (const p of periods) {
      timetableToday.push({
        periodId: p.id,
        periodNumber: p.periodNumber,
        startTime: p.startTime || "08:30",
        endTime: p.endTime || "09:15",
        sectionId: p.sectionId || undefined,
        sectionName: p.section?.name,
        className: p.section?.class?.displayName || p.section?.class?.gradeLevel,
        subjectId: p.subjectId || undefined,
        subjectName: p.subject?.name,
        roomNumber: p.roomNumber || undefined,
        isFree: false,
      });
    }
  }

  // 4. Grading Assignments (assignments authored by teacher)
  const gradingAssignments: AssignmentGradingItem[] = [];
  const assignmentRows = await txDb.query.assignments.findMany({
    where: and(
      eq(assignments.schoolId, schoolId),
      eq(assignments.createdByTeacherId, teacherUserId),
      or(eq(assignments.status, "PUBLISHED"), eq(assignments.status, "CLOSED"))
    ),
    with: {
      section: {
        with: { class: true },
      },
      classSubject: {
        with: { subject: true },
      },
    },
    orderBy: [asc(assignments.dueDate)],
    limit: 10,
  });

  for (const a of assignmentRows) {
    const submissions = await txDb.query.assignmentSubmissions.findMany({
      where: and(
        eq(assignmentSubmissions.schoolId, schoolId),
        eq(assignmentSubmissions.assignmentId, a.id)
      ),
    });

    const totalSubmissions = submissions.length;
    const gradedCount = submissions.filter((s: any) => s.gradedAt !== null).length;
    const ungradedCount = totalSubmissions - gradedCount;
    const lateCount = submissions.filter((s: any) => s.isLate).length;
    const isPastDue = new Date(a.dueDate).getTime() < now.getTime();

    if (ungradedCount > 0) {
      gradingAssignments.push({
        assignmentId: a.id,
        title: a.title,
        sectionId: a.sectionId,
        sectionName: a.section?.name || "",
        className: a.section?.class?.displayName || a.section?.class?.gradeLevel || "",
        subjectName: a.classSubject?.subject?.name || "",
        dueDate: a.dueDate,
        totalSubmissions,
        gradedCount,
        ungradedCount,
        lateCount,
        isPastDue,
      });
    }
  }

  // 5. Marks Entry Windows (exams currently open for mark entries for teacher's teaching sections)
  const marksEntryWindows: MarksEntryWindowItem[] = [];
  if (scope.teachingSections.length > 0) {
    const teachingSubjectIds = Array.from(new Set<string>(scope.teachingSections.map((ts) => ts.subjectId)));
    const teachingSectionIds = Array.from(new Set<string>(scope.teachingSections.map((ts) => ts.sectionId)));
    const subjectContextMap = await batchResolveSubjectContexts(schoolId, teachingSubjectIds, txDb);
    const sectionContextMap = await batchResolveSectionContexts(schoolId, teachingSectionIds, txDb);

    const openExams = await txDb.query.exams.findMany({
      where: and(
        eq(exams.schoolId, schoolId),
        eq(exams.isLocked, false),
        lte(exams.startDate, now),
        gte(exams.endDate, now)
      ),
    });

    for (const exam of openExams) {
      // Fetch any configured mark distributions for this exam across teaching subjects
      const markDistRows = await txDb.query.examMarkDistributions.findMany({
        where: and(
          eq(examMarkDistributions.schoolId, schoolId),
          eq(examMarkDistributions.examId, exam.id),
          inArray(examMarkDistributions.subjectId, teachingSubjectIds)
        ),
      });
      const distMap = new Map<string, number>();
      for (const d of markDistRows) {
        const val = Number(d.maxMarks);
        if (!isNaN(val)) {
          distMap.set(`${d.subjectId}:${d.classId}`, val);
          distMap.set(d.subjectId, val);
        }
      }

      for (const ts of scope.teachingSections) {
        // Total students in this section
        const sectionStudents = await txDb.query.students.findMany({
          where: and(
            eq(students.schoolId, schoolId),
            eq(students.currentSectionId, ts.sectionId),
            eq(students.isActive, true)
          ),
          columns: { id: true },
        });

        if (sectionStudents.length === 0) continue;

        const studentIds = sectionStudents.map((s: { id: string }) => s.id);
        const entries = await txDb.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, schoolId),
            eq(markEntries.examId, exam.id),
            eq(markEntries.subjectId, ts.subjectId),
            inArray(markEntries.studentId, studentIds)
          ),
        });

        if (entries.length < sectionStudents.length) {
          const sec = sectionContextMap.get(ts.sectionId);
          const sub = subjectContextMap.get(ts.subjectId);

          const configuredMax = distMap.get(ts.subjectId);
          const resolvedMaxMarks = typeof configuredMax === "number"
            ? configuredMax
            : (sub?.maxMarks ?? 100);

          marksEntryWindows.push({
            examId: exam.id,
            examName: exam.name,
            sectionId: ts.sectionId,
            sectionName: sec?.sectionName || "",
            className: sec?.className || "",
            subjectId: ts.subjectId,
            subjectName: sub?.subjectName || "",
            maxMarks: resolvedMaxMarks,
            windowOpensAt: exam.startDate,
            windowClosesAt: exam.endDate,
            totalStudents: sectionStudents.length,
            completedEntries: entries.length,
            isWindowOpen: true,
            isLocked: exam.isLocked,
          });
        }
      }
    }
  }

  // 6. Pending Student Leave Requests (for class teacher sections)
  const pendingLeaveRequests: LeaveRequestItem[] = [];
  if (scope.classTeacherSections.length > 0) {
    const sectionStudents = await txDb.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        inArray(students.currentSectionId, scope.classTeacherSections),
        eq(students.isActive, true)
      ),
      columns: { id: true, currentSectionId: true },
    });

    if (sectionStudents.length > 0) {
      const studentIds = sectionStudents.map((s: { id: string }) => s.id);
      const studentMap = new Map<string, { id: string; currentSectionId: string | null }>();
      for (const s of sectionStudents) {
        studentMap.set(s.id, s);
      }

      const leaveSections = await txDb.query.sections.findMany({
        where: inArray(sections.id, scope.classTeacherSections),
        with: { class: true },
      });
      const leaveSectionMap = new Map<string, any>();
      for (const sec of leaveSections) {
        leaveSectionMap.set(sec.id, sec);
      }

      const leaveRows = await txDb.query.studentLeaveRequests.findMany({
        where: and(
          eq(studentLeaveRequests.schoolId, schoolId),
          inArray(studentLeaveRequests.studentId, studentIds),
          eq(studentLeaveRequests.status, "PENDING")
        ),
        orderBy: [asc(studentLeaveRequests.createdAt)],
      });

      if (leaveRows.length > 0) {
        const leaveStudentIds = Array.from(new Set<string>(leaveRows.map((l: any) => l.studentId)));
        const resolvedStudents = await batchResolveStudentIdentities(schoolId, leaveStudentIds, txDb);

        for (const l of leaveRows) {
          const stud = studentMap.get(l.studentId);
          const sec = stud?.currentSectionId ? leaveSectionMap.get(stud.currentSectionId) : null;
          const resolved = resolvedStudents.get(l.studentId);
          pendingLeaveRequests.push({
            id: l.id,
            studentId: l.studentId,
            studentName: resolved?.fullName || "",
            rollNumber: resolved?.rollNumber || null,
            sectionId: stud?.currentSectionId || resolved?.sectionId || "",
            sectionName: sec?.name || resolved?.sectionName || "",
            className: sec?.class?.displayName || sec?.class?.gradeLevel || resolved?.className || "",
            leaveType: l.leaveType as any,
            startDate: l.startDate,
            endDate: l.endDate,
            reason: l.reason,
            requestedAt: l.createdAt,
          });
        }
      }
    }
  }

  // 7. Substitutions
  const substitutions: SubstitutionItem[] = [];
  const subRows = await txDb.query.timetableSubstitutions.findMany({
    where: and(
      eq(timetableSubstitutions.schoolId, schoolId),
      or(
        eq(timetableSubstitutions.substituteTeacherId, teacherUserId),
        eq(timetableSubstitutions.originalTeacherId, teacherUserId)
      ),
      eq(timetableSubstitutions.status, "PENDING")
    ),
    with: {
      originalTeacher: true,
      substituteTeacher: true,
      section: { with: { class: true } },
      subject: true,
      timetablePeriod: {
        with: {
          section: { with: { class: true } },
          subject: true,
        },
      },
    },
    orderBy: [asc(timetableSubstitutions.date)],
  });

  for (const s of subRows) {
    const isIncoming = s.substituteTeacherId === teacherUserId;
    const p = s.timetablePeriod;
    const periodNumber = p?.periodNumber ?? s.periodNumber ?? 1;
    const startTime = p?.startTime ?? s.startTime ?? "09:00";
    const endTime = p?.endTime ?? s.endTime ?? "09:45";

    const sec = s.section || p?.section;
    const sub = s.subject || p?.subject;

    const sectionName = sec?.name || "";
    const className = sec?.class?.displayName || sec?.class?.gradeLevel || "";
    const subjectName = sub?.name || "";

    let hasConflict = false;
    let conflictReason: string | undefined = undefined;

    if (isIncoming) {
      try {
        const clash = await checkSubstitutionClash(s.id, teacherUserId, txDb, schoolId);
        hasConflict = clash.hasConflict;
        conflictReason = clash.conflictReason;
      } catch {
        hasConflict = false;
      }
    }

    substitutions.push({
      id: s.id,
      direction: isIncoming ? "INCOMING" : "OUTGOING",
      date: s.date,
      periodNumber,
      startTime,
      endTime,
      otherTeacherName: isIncoming
        ? s.originalTeacher?.fullName || ""
        : s.substituteTeacher?.fullName || "Unassigned",
      status: s.status as any,
      ...(sectionName ? { sectionName } : {}),
      ...(className ? { className } : {}),
      ...(subjectName ? { subjectName } : {}),
      ...(s.reason ? { reason: s.reason } : {}),
      ...(hasConflict !== undefined ? { hasConflict } : {}),
      ...(conflictReason ? { conflictReason } : {}),
    });
  }

  // 8. PTM Bookings Today
  const ptmBookingsToday: PTMSlotItem[] = [];
  const ptmSlotsRows = await txDb.query.ptmSlots.findMany({
    where: and(
      eq(ptmSlots.schoolId, schoolId),
      eq(ptmSlots.teacherUserId, teacherUserId),
      gte(ptmSlots.startAt, startOfDay),
      lte(ptmSlots.startAt, endOfDay)
    ),
  });

  if (ptmSlotsRows.length > 0) {
    const slotIds = ptmSlotsRows.map((s: any) => s.id);
    const bookings = await txDb.query.ptmBookings.findMany({
      where: and(
        eq(ptmBookings.schoolId, schoolId),
        inArray(ptmBookings.slotId, slotIds),
        eq(ptmBookings.status, "BOOKED")
      ),
      with: {
        parentUser: true,
      },
    });

    if (bookings.length > 0) {
      const studentIds = Array.from(
        new Set<string>(
          bookings
            .map((b: any) => b.studentId)
            .filter((id: string | null): id is string => Boolean(id))
        )
      );
      const studentMap = await batchResolveStudentIdentities(schoolId, studentIds, txDb);

      for (const b of bookings) {
        if (!b.studentId) {
          // Per OD3: If booking genuinely has no studentId, omit row entirely
          continue;
        }

        const student = studentMap.get(b.studentId);
        if (!student || !student.fullName) {
          // Unresolvable student record: omit row per OD3
          continue;
        }

        const slot = ptmSlotsRows.find((s: any) => s.id === b.slotId);
        ptmBookingsToday.push({
          bookingId: b.id,
          slotId: b.slotId,
          startTime: slot?.startAt || now,
          endTime: slot?.endAt || now,
          parentName: b.parentUser?.fullName || "",
          studentName: student.fullName,
          sectionName: student.classSectionDisplayName || student.sectionName,
          status: b.status as any,
          teacherNote: b.teacherNote,
        });
      }
    }
  }

  // 9. Unread Messages
  const unreadMessages: TeacherMessageItem[] = [];
  const unreadMsgRows = await txDb.query.parentTeacherMessages.findMany({
    where: and(
      eq(parentTeacherMessages.schoolId, schoolId),
      eq(parentTeacherMessages.recipientUserId, teacherUserId),
      eq(parentTeacherMessages.isRead, false)
    ),
    with: {
      senderUser: true,
    },
    orderBy: [desc(parentTeacherMessages.createdAt)],
    limit: 10,
  });

  const unreadStudentIds: string[] = Array.from(
    new Set(
      unreadMsgRows
        .map((m: any) => m.studentId)
        .filter((id: any): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const unreadStudentRows =
    unreadStudentIds.length > 0
      ? await txDb.query.students.findMany({
          where: and(
            eq(students.schoolId, schoolId),
            inArray(students.id, unreadStudentIds)
          ),
          with: {
            currentSection: true,
          },
        })
      : [];

  const unreadStudentMap = new Map<string, (typeof unreadStudentRows)[number]>();
  for (const s of unreadStudentRows) {
    unreadStudentMap.set(s.id, s);
  }

  for (const m of unreadMsgRows) {
    const student = m.studentId ? unreadStudentMap.get(m.studentId) : undefined;
    let sName = "";
    if (student) {
      try {
        const fn = decryptData(student.firstNameEncrypted) || "";
        const ln = student.lastNameEncrypted ? decryptData(student.lastNameEncrypted) || "" : "";
        sName = `${fn} ${ln}`.trim();
      } catch {
        sName = "";
      }
    }
    const secName = student?.currentSection?.name || "";

    unreadMessages.push({
      threadId: m.parentMessageId || m.id,
      parentName: m.senderUser?.fullName || "",
      studentName: sName,
      sectionName: secName,
      lastMessagePreview: m.content ? m.content.substring(0, 80) : "",
      sentAt: m.createdAt,
      unreadCount: 1,
    });
  }

  // 10. Notices for teachers
  const noticesList: TeacherNoticeItem[] = [];
  const noticeRows = await txDb.query.notices.findMany({
    where: and(
      eq(notices.schoolId, schoolId),
      or(eq(notices.audienceType, "TEACHERS"), eq(notices.audienceType, "ALL"))
    ),
    orderBy: [desc(notices.isPinned), desc(notices.publishedAt)],
    limit: 5,
  });

  for (const n of noticeRows) {
    noticesList.push({
      id: n.id,
      title: n.title,
      contentPreview: n.content ? n.content.substring(0, 100) : "",
      publishedAt: n.publishedAt || now,
      isPinned: n.isPinned,
      audience: n.audienceType,
      expiresAt: n.expiresAt,
    });
  }

  // 11. Upcoming Homework Due (assignments in teacher's sections or authored by teacher due within -24h to +24h)
  const upcomingHomeworkDue: TeacherHomeworkDueItem[] = [];
  const oneDayAgo = new Date(nowMs - 24 * 3600000);
  const oneDayHence = new Date(nowMs + 24 * 3600000);

  const relevantSectionIds = scope.allSectionIds.length > 0 ? scope.allSectionIds : [];
  if (relevantSectionIds.length > 0 || scope.teachingSections.length > 0) {
    const hwRows = await txDb.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, schoolId),
        eq(assignments.status, "PUBLISHED"),
        gte(assignments.dueDate, oneDayAgo),
        lte(assignments.dueDate, oneDayHence),
        or(
          relevantSectionIds.length > 0 ? inArray(assignments.sectionId, relevantSectionIds) : undefined,
          eq(assignments.createdByTeacherId, teacherUserId)
        )
      ),
      with: {
        section: { with: { class: true } },
        classSubject: { with: { subject: true } },
      },
      orderBy: [asc(assignments.dueDate)],
    });

    for (const hw of hwRows) {
      const submissions = await txDb.query.assignmentSubmissions.findMany({
        where: and(
          eq(assignmentSubmissions.schoolId, schoolId),
          eq(assignmentSubmissions.assignmentId, hw.id)
        ),
      });

      const sectionStudents = await txDb.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.currentSectionId, hw.sectionId),
          eq(students.isActive, true)
        ),
        columns: { id: true },
      });

      upcomingHomeworkDue.push({
        id: hw.id,
        title: hw.title,
        subjectName: hw.classSubject?.subject?.name || "",
        sectionName: hw.section?.name || "",
        className: hw.section?.class?.displayName || hw.section?.class?.gradeLevel || "",
        dueDate: hw.dueDate,
        submissionCount: submissions.length,
        totalStudents: sectionStudents.length,
      });
    }
  }

  // 12. Pending Classwork Periods (today's ended timetable periods with >=30m grace lacking COMPLETED lesson_plans)
  const pendingClassworkPeriods: TeacherPendingClassworkPeriod[] = [];
  if (isWorkingDay && timetableToday.length > 0) {
    const csRows = await txDb.query.classSubjects.findMany({
      where: eq(classSubjects.schoolId, schoolId),
    });
    const csMap = new Map<string, string>();
    for (const cs of csRows) {
      csMap.set(`${cs.classId}:${cs.subjectId}`, cs.id);
    }

    const todayPlans = await txDb.query.lessonPlans.findMany({
      where: and(
        eq(lessonPlans.schoolId, schoolId),
        eq(lessonPlans.teacherId, teacherUserId),
        eq(lessonPlans.status, "COMPLETED")
      ),
    });
    const completedClassSubjectIds = new Set<string>(
      todayPlans.map((lp: any) => lp.classSubjectId)
    );

    const sectionList = scope.allSectionIds.length > 0
      ? await txDb.query.sections.findMany({
          where: and(eq(sections.schoolId, schoolId), inArray(sections.id, scope.allSectionIds)),
          columns: { id: true, classId: true },
        })
      : [];
    const secClassMap = new Map<string, string>(sectionList.map((s: any) => [s.id, s.classId]));

    for (const period of timetableToday) {
      if (period.isFree || !period.sectionId || !period.subjectId) continue;

      // OD1 Grace Check: Period endTime passed >= 30 minutes ago today
      const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
      const parts = (period.endTime || "00:00").split(":");
      const endH = Number(parts[0]);
      const endM = Number(parts[1]);
      const periodEndTotalMinutes = (isNaN(endH) ? 0 : endH) * 60 + (isNaN(endM) ? 0 : endM);
      const minutesSinceEnd = nowTotalMinutes - periodEndTotalMinutes;

      // Only periods ended >= 30 minutes ago today
      if (minutesSinceEnd < 30) continue;

      const classId = secClassMap.get(period.sectionId);
      const classSubId = classId ? csMap.get(`${classId}:${period.subjectId}`) : undefined;

      // If classwork / lesson plan already completed for this classSubject, skip
      if (classSubId && completedClassSubjectIds.has(classSubId)) {
        continue;
      }

      pendingClassworkPeriods.push({
        periodNumber: period.periodNumber,
        subjectName: period.subjectName || "",
        sectionName: period.sectionName || "",
        className: period.className || "",
        startTime: period.startTime,
        endTime: period.endTime,
        sectionId: period.sectionId,
        ...(classSubId ? { classSubjectId: classSubId } : {}),
      });

      // OD1: Cap at maximum 3 oldest pending periods per feed derivation
      if (pendingClassworkPeriods.length >= 3) break;
    }
  }

  // 13. Honest Teacher Insights (3 models behind strict data-sufficiency gates)
  const insights: TeacherInsightItem[] = [];

  // Model 1: section_attendance_trend (OD2: >=5 days history, today dip >= 15%)
  if (scope.classTeacherSections.length > 0) {
    for (const secId of scope.classTeacherSections) {
      const fourteenDaysAgo = new Date(nowMs - 14 * 86400000);
      const attHistory = await txDb.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          eq(studentAttendance.sectionId, secId),
          gte(studentAttendance.attendanceDate, fourteenDaysAgo)
        ),
      });

      const dateMap = new Map<string, { present: number; total: number }>();
      for (const rec of attHistory) {
        const d = typeof rec.attendanceDate === "string" ? rec.attendanceDate : rec.attendanceDate.toISOString().split("T")[0]!;
        const curr = dateMap.get(d) || { present: 0, total: 0 };
        curr.total += 1;
        if (rec.status === "PRESENT" || rec.status === "LATE") {
          curr.present += 1;
        }
        dateMap.set(d, curr);
      }

      const dates = Array.from(dateMap.keys()).sort();
      const pastDates = dates.filter((d) => d < todayStr);

      if (pastDates.length >= 5) {
        const trailing5 = pastDates.slice(-5);
        const sparklineData: number[] = [];
        let trailingSum = 0;
        for (const d of trailing5) {
          const stats = dateMap.get(d)!;
          const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 100;
          sparklineData.push(rate);
          trailingSum += rate;
        }
        const avgRate = Math.round(trailingSum / trailing5.length);

        const todayStats = dateMap.get(todayStr);
        if (todayStats && todayStats.total > 0) {
          const todayRate = Math.round((todayStats.present / todayStats.total) * 100);
          sparklineData.push(todayRate);

          if (avgRate - todayRate >= 15) {
            insights.push({
              id: `att-trend-${secId}`,
              model: "section_attendance_trend",
              severity: "AMBER",
              title: {
                en: "Attendance Alert: Significant Dip Today",
                hi: "उपस्थिति चेतावनी: आज उपस्थिति में गिरावट",
              },
              summary: {
                en: `Section attendance dropped to ${todayRate}% today (trailing 5-day average: ${avgRate}%).`,
                hi: `कक्षा उपस्थिति आज गिरकर ${todayRate}% हो गई (पिछले 5 दिनों का औसत: ${avgRate}%)।`,
              },
              payload: {
                sectionId: secId,
                todayRate,
                avgRate,
                sparklineData,
              },
            });
          }
        }
      }
    }
  }

  // Model 2: homework_neglect_list (students with >=3 unsubmitted homework in last 14 days)
  if (relevantSectionIds.length > 0) {
    const fourteenDaysAgo = new Date(nowMs - 14 * 86400000);
    const recentHw = await txDb.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, schoolId),
        eq(assignments.status, "PUBLISHED"),
        gte(assignments.dueDate, fourteenDaysAgo),
        lte(assignments.dueDate, now),
        inArray(assignments.sectionId, relevantSectionIds)
      ),
      columns: { id: true, sectionId: true },
    });

    if (recentHw.length >= 3) {
      const hwIds = recentHw.map((h: any) => h.id);
      const subs = await txDb.query.assignmentSubmissions.findMany({
        where: and(
          eq(assignmentSubmissions.schoolId, schoolId),
          inArray(assignmentSubmissions.assignmentId, hwIds)
        ),
        columns: { assignmentId: true, studentId: true },
      });

      const submittedPair = new Set<string>(subs.map((s: any) => `${s.assignmentId}:${s.studentId}`));

      const secStudents = await txDb.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          inArray(students.currentSectionId, relevantSectionIds),
          eq(students.isActive, true)
        ),
        columns: { id: true, currentSectionId: true },
      });

      const neglectedStudentMap = new Map<string, number>();
      for (const st of secStudents) {
        const studentHw = recentHw.filter((h: any) => h.sectionId === st.currentSectionId);
        if (studentHw.length < 3) continue;

        let missing = 0;
        for (const h of studentHw) {
          if (!submittedPair.has(`${h.id}:${st.id}`)) {
            missing += 1;
          }
        }
        if (missing >= 3) {
          neglectedStudentMap.set(st.id, missing);
        }
      }

      if (neglectedStudentMap.size > 0) {
        const neglectStudentIds = Array.from(neglectedStudentMap.keys());
        const resolvedNeglect = await batchResolveStudentIdentities(schoolId, neglectStudentIds, txDb);

        const neglectedList: Array<{ studentId: string; studentName: string; missingCount: number }> = [];
        for (const [stId, count] of neglectedStudentMap.entries()) {
          const res = resolvedNeglect.get(stId);
          if (res?.fullName) {
            neglectedList.push({
              studentId: stId,
              studentName: res.fullName,
              missingCount: count,
            });
          }
        }

        if (neglectedList.length > 0) {
          insights.push({
            id: `hw-neglect-${teacherUserId}`,
            model: "homework_neglect_list",
            severity: "AMBER",
            title: {
              en: "Homework Support Needed",
              hi: "गृहकार्य में सहायता आवश्यक",
            },
            summary: {
              en: `${neglectedList.length} student${neglectedList.length > 1 ? "s have" : " has"} missed 3 or more homework assignments in the last 14 days.`,
              hi: `${neglectedList.length} विद्यार्थियों ने पिछले 14 दिनों में 3 या अधिक गृहकार्य जमा नहीं किए हैं।`,
            },
            payload: {
              students: neglectedList,
            },
          });
        }
      }
    }
  }

  // Model 3: pre_publish_distribution (closing marks window with >=60% completion)
  if (marksEntryWindows.length > 0) {
    for (const w of marksEntryWindows) {
      const windowClosesMs = new Date(w.windowClosesAt).getTime();
      const hoursToClose = (windowClosesMs - nowMs) / 3600000;

      const completionRate = w.totalStudents > 0 ? w.completedEntries / w.totalStudents : 0;
      if (hoursToClose >= 0 && hoursToClose <= 48 && completionRate >= 0.60 && w.completedEntries >= 3) {
        const entries = await txDb.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, schoolId),
            eq(markEntries.examId, w.examId),
            eq(markEntries.subjectId, w.subjectId),
            isNotNull(markEntries.marksObtained)
          ),
          columns: { marksObtained: true },
        });

        const scores = entries
          .map((e: any) => Number(e.marksObtained))
          .filter((n: number) => !isNaN(n));

        if (scores.length >= 3) {
          const sum = scores.reduce((acc: number, val: number) => acc + val, 0);
          const mean = Math.round(sum / scores.length);
          const max = w.maxMarks || 100;

          const outliersCount = scores.filter((s: number) => s <= max * 0.2 || s >= max * 0.95).length;

          insights.push({
            id: `marks-dist-${w.examId}-${w.subjectId}`,
            model: "pre_publish_distribution",
            severity: "INFO",
            title: {
              en: `Marks Overview: ${w.subjectName} (${w.className}-${w.sectionName})`,
              hi: `अंक विश्लेषण: ${w.subjectName} (${w.className}-${w.sectionName})`,
            },
            summary: {
              en: `Class average is ${mean}/${max} with ${outliersCount} potential outliers across ${scores.length} entries.`,
              hi: `कक्षा औसत ${mean}/${max} है और ${scores.length} प्रविष्टियों में ${outliersCount} असामान्य प्राप्तांक हैं।`,
            },
            payload: {
              examId: w.examId,
              subjectId: w.subjectId,
              mean,
              maxMarks: max,
              outliersCount,
            },
          });
        }
      }
    }
  }

  const baseResult = {
    teacherUserId,
    isWorkingDay,
    attendanceCutoffTime: "10:00",
    schoolDayStart: "07:30",
    schoolDayEnd: "15:30",
    attendanceSections,
    timetableToday,
    gradingAssignments,
    marksEntryWindows,
    pendingLeaveRequests,
    substitutions,
    ptmBookingsToday,
    unreadMessages,
    notices: noticesList,
    insights,
    upcomingHomeworkDue,
    pendingClassworkPeriods,
  };

  const hasAllocations =
    scope.teachingSections.length > 0 || scope.classTeacherSections.length > 0;
  const isSetupMissing =
    isWorkingDay && hasAllocations && (!timetableToday || timetableToday.length === 0);
  const missingAllocationsSummary: string[] = [];

  if (isSetupMissing) {
    const subjectIds = Array.from(new Set(scope.teachingSections.map((ts) => ts.subjectId)));
    const secRows =
      scope.allSectionIds.length > 0
        ? await txDb.query.sections.findMany({
            where: and(eq(sections.schoolId, schoolId), inArray(sections.id, scope.allSectionIds)),
            with: { class: true },
          })
        : [];
    const subRows =
      subjectIds.length > 0
        ? await txDb.query.subjects.findMany({
            where: and(eq(subjects.schoolId, schoolId), inArray(subjects.id, subjectIds)),
          })
        : [];
    const secMap = new Map(
      secRows.map((s: any) => [s.id, `${s.class?.displayName || "Class"}-${s.name}`])
    );
    const subMap = new Map(subRows.map((s: any) => [s.id, s.name]));

    for (const ts of scope.teachingSections) {
      const sName = secMap.get(ts.sectionId) || "";
      const subName = subMap.get(ts.subjectId) || "";
      const label = [sName, subName].filter(Boolean).join(" ");
      if (label) missingAllocationsSummary.push(label);
    }
    if (scope.classTeacherSections.length > 0 && missingAllocationsSummary.length === 0) {
      for (const csId of scope.classTeacherSections) {
        const sName = secMap.get(csId) || "";
        missingAllocationsSummary.push(sName ? `${sName} (Homeroom)` : "(Homeroom)");
      }
    }
  }

  return {
    ...baseResult,
    isRestDay,
    calendarEventTitle,
    isSetupMissing,
    missingAllocationsSummary,
  };
}
