import { describe, it, expect } from "vitest";
import { deriveTeacherFeed } from "../deriveTeacherFeed";
import type { TeacherDataSnapshot, TeacherCardType } from "../types";

describe("Sprint S24 Layer 9: Teacher Card Type Coverage (12/12 Cards)", () => {
  it("derives all 12 TeacherCardType variants when data is present in snapshot", () => {
    // 08:45 AM (morning instructional hours)
    const now = new Date(2026, 9, 31, 8, 45, 0);

    const fullSnapshot: TeacherDataSnapshot = {
      teacherUserId: "teacher-1",
      isWorkingDay: true,
      isRestDay: false,
      isSetupMissing: false,
      schoolDayStart: "08:00",
      attendanceCutoffTime: "10:00",
      schoolDayEnd: "15:00",
      attendanceSections: [
        {
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 6",
          totalStudents: 30,
          markedCount: 0,
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          lateCount: 0,
          halfDayCount: 0,
          isMarked: false,
        },
      ],
      timetableToday: [
        {
          periodId: "p-1",
          periodNumber: 1,
          startTime: "08:30",
          endTime: "09:15",
          isFree: false,
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 6",
          subjectName: "Mathematics",
        },
      ],
      gradingAssignments: [
        {
          assignmentId: "asg-1",
          title: "Algebra Quiz",
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 6",
          subjectName: "Mathematics",
          dueDate: new Date(now.getTime() - 86400000),
          totalSubmissions: 25,
          gradedCount: 10,
          ungradedCount: 15,
          lateCount: 0,
          isPastDue: true,
        },
      ],
      marksEntryWindows: [
        {
          examId: "exam-1",
          examName: "Midterm",
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 6",
          subjectId: "sub-1",
          subjectName: "Mathematics",
          maxMarks: 80,
          completedEntries: 10,
          totalStudents: 30,
          isWindowOpen: true,
          isLocked: false,
          windowOpensAt: new Date(now.getTime() - 86400000),
          windowClosesAt: new Date(now.getTime() + 12 * 3600000),
        },
      ],
      pendingLeaveRequests: [
        {
          id: "leave-1",
          studentId: "stu-1",
          studentName: "Rohan Verma",
          sectionId: "sec-1",
          className: "Class 6",
          sectionName: "A",
          leaveType: "SICK",
          startDate: "2026-10-31",
          endDate: "2026-11-01",
          reason: "Fever",
          requestedAt: now,
        },
      ],
      substitutions: [
        {
          id: "sub-1",
          direction: "INCOMING",
          periodNumber: 2,
          date: "2026-10-31",
          otherTeacherName: "Rajesh Kumar",
          startTime: "09:15",
          endTime: "10:00",
          status: "PENDING",
          sectionName: "Class 7-B",
          className: "Class 7",
          subjectName: "Science",
          hasConflict: false,
        },
      ],
      ptmBookingsToday: [
        {
          bookingId: "ptm-1",
          slotId: "slot-1",
          parentName: "Vikram Sharma",
          studentName: "Aarav Sharma",
          sectionName: "Class 6-A",
          startTime: new Date(now.getTime() + 1800000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
          status: "BOOKED",
        },
      ],
      unreadMessages: [
        {
          threadId: "th-1",
          parentName: "Vikram Sharma",
          studentName: "Aarav Sharma",
          sectionName: "Class 6-A",
          lastMessagePreview: "Hello teacher",
          sentAt: now,
          unreadCount: 3,
        },
      ],
      notices: [
        {
          id: "notice-1",
          title: "Annual Sports Day Meeting",
          contentPreview: "All staff report to auditorium at 3pm.",
          audience: "TEACHERS",
          publishedAt: now,
          isPinned: true,
        },
      ],
      upcomingHomeworkDue: [
        {
          id: "hw-1",
          title: "Geometry Exercises",
          sectionName: "A",
          className: "Class 6",
          subjectName: "Mathematics",
          dueDate: new Date(now.getTime() + 7200000),
          submissionCount: 20,
          totalStudents: 30,
        },
      ],
      pendingClassworkPeriods: [
        {
          periodNumber: 1,
          startTime: "07:30",
          endTime: "08:15",
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 6",
          subjectName: "Mathematics",
        },
      ],
      insights: [
        {
          id: "ins-1",
          model: "section_attendance_trend",
          severity: "AMBER",
          title: { en: "Attendance Trend", hi: "उपस्थिति प्रवृत्ति" },
          summary: { en: "Class 6-A is at 95%", hi: "कक्षा 6-ए 95% पर है" },
          payload: { percentage: 95 },
        },
      ],
    };

    const cards = deriveTeacherFeed("teacher-1", now, fullSnapshot);
    const derivedCardTypes = new Set(cards.map((c) => c.cardType));

    const expected12CardTypes: TeacherCardType[] = [
      "AttendanceNowCard",
      "NowNextCard",
      "GradingQueueCard",
      "MarksEntryCard",
      "LeaveQueueCard",
      "SubstitutionCard",
      "PTMTodayCard",
      "MessagesCard",
      "InsightCard",
      "NoticeCard",
      "HomeworkDueCard",
      "ClassworkPendingCard",
    ];

    expect(expected12CardTypes.length).toBe(12);

    for (const cardType of expected12CardTypes) {
      expect(derivedCardTypes.has(cardType), `Expected card ${cardType} to be derived in feed`).toBe(true);
    }
  });
});
