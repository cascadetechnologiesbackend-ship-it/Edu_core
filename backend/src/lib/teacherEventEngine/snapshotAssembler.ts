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
} from "@/db/schema";
import { eq, and, or, inArray, isNull, gte, lte, desc, asc } from "drizzle-orm";
import { resolveTeacherScope } from "./scopeResolver";
import { decryptData } from "../encryption";
import {
  batchResolveStudentIdentities,
  batchResolveSectionContexts,
  batchResolveSubjectContexts,
} from "./identityResolver";
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
        subjectName: a.classSubject?.subject?.name || "Subject",
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
    const teachingSubjectIds = Array.from(new Set(scope.teachingSections.map((ts) => ts.subjectId)));
    const openExams = await txDb.query.exams.findMany({
      where: and(
        eq(exams.schoolId, schoolId),
        eq(exams.isLocked, false),
        lte(exams.startDate, now),
        gte(exams.endDate, now)
      ),
    });

    for (const exam of openExams) {
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
          const sec = await txDb.query.sections.findFirst({
            where: eq(sections.id, ts.sectionId),
            with: { class: true },
          });

          marksEntryWindows.push({
            examId: exam.id,
            examName: exam.name,
            sectionId: ts.sectionId,
            sectionName: sec?.name || "",
            className: sec?.class?.displayName || sec?.class?.gradeLevel || "",
            subjectId: ts.subjectId,
            subjectName: "Subject",
            maxMarks: 100,
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
    },
    orderBy: [asc(timetableSubstitutions.date)],
  });

  for (const s of subRows) {
    const isIncoming = s.substituteTeacherId === teacherUserId;
    substitutions.push({
      id: s.id,
      direction: isIncoming ? "INCOMING" : "OUTGOING",
      date: s.date,
      periodNumber: s.periodNumber || 1,
      startTime: s.startTime || "09:00",
      endTime: s.endTime || "09:45",
      otherTeacherName: isIncoming
        ? s.originalTeacher?.fullName || "Teacher"
        : s.substituteTeacher?.fullName || "Unassigned",
      reason: s.reason || undefined,
      status: s.status as any,
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
    let sName = "Student";
    if (student) {
      try {
        const fn = decryptData(student.firstNameEncrypted) || "";
        const ln = student.lastNameEncrypted ? decryptData(student.lastNameEncrypted) || "" : "";
        sName = `${fn} ${ln}`.trim() || "Student";
      } catch {
        sName = "Student";
      }
    }
    const secName = student?.currentSection?.name || "Class";

    unreadMessages.push({
      threadId: m.parentMessageId || m.id,
      parentName: m.senderUser?.fullName || "Parent",
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

  return {
    ...baseResult,
    isRestDay,
    calendarEventTitle,
    isSetupMissing,
    missingAllocationsSummary,
  };
}
