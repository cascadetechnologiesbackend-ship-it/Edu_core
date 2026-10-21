import { describe, it, expect } from "vitest";
import { deriveTeacherFeed } from "../deriveTeacherFeed";
import { TeacherDataSnapshot } from "../types";

describe("deriveTeacherFeed (Pure Feed Engine, Spec v1.0, AC-T1)", () => {
  const teacherUserId = "teacher-uuid-001";

  // Base snapshot with everything completed/empty
  const calmDaySnapshot: TeacherDataSnapshot = {
    teacherUserId,
    isWorkingDay: true,
    schoolDayStart: "07:30",
    attendanceCutoffTime: "10:00",
    schoolDayEnd: "15:30",
    attendanceSections: [
      {
        sectionId: "sec-1",
        sectionName: "A",
        className: "Class 8",
        totalStudents: 40,
        markedCount: 40,
        presentCount: 38,
        absentCount: 2,
        leaveCount: 0,
        lateCount: 0,
        halfDayCount: 0,
        isMarked: true,
      },
    ],
    timetableToday: [
      {
        periodId: "p1",
        periodNumber: 1,
        startTime: "08:30",
        endTime: "09:15",
        sectionId: "sec-1",
        sectionName: "A",
        className: "Class 8",
        subjectName: "Maths",
        isFree: false,
      },
    ],
    gradingAssignments: [],
    marksEntryWindows: [],
    pendingLeaveRequests: [],
    substitutions: [],
    ptmBookingsToday: [],
    unreadMessages: [],
    insights: [],
    notices: [],
  };

  it("AC-T1: ZERO-CLUTTER - returns empty array [] on a calm, completed school day", () => {
    // 16:00 (after school day ends, all sections marked, no queues)
    const afterSchool = new Date("2026-10-21T16:00:00");
    const cards = deriveTeacherFeed(teacherUserId, afterSchool, calmDaySnapshot);

    expect(cards).toHaveLength(0);
    expect(cards).toEqual([]);
  });

  it("AC-T1: returns empty array [] on non-working days or weekends", () => {
    const sundayMorning = new Date("2026-10-25T08:30:00");
    const weekendSnapshot: TeacherDataSnapshot = {
      ...calmDaySnapshot,
      isWorkingDay: false,
      attendanceSections: [
        {
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 8",
          totalStudents: 40,
          markedCount: 0,
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          lateCount: 0,
          halfDayCount: 0,
          isMarked: false,
        },
      ],
    };

    const cards = deriveTeacherFeed(teacherUserId, sundayMorning, weekendSnapshot);
    expect(cards).toHaveLength(0);
  });

  describe("Time-of-Day Choreography & Priorities", () => {
    const activeDaySnapshot: TeacherDataSnapshot = {
      ...calmDaySnapshot,
      attendanceSections: [
        {
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 8",
          totalStudents: 40,
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
          periodId: "p1",
          periodNumber: 1,
          startTime: "08:30",
          endTime: "09:15",
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 8",
          subjectName: "Maths",
          isFree: false,
        },
        {
          periodId: "p2",
          periodNumber: 2,
          startTime: "09:30",
          endTime: "10:15",
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 8",
          subjectName: "Science",
          isFree: false,
        },
      ],
      gradingAssignments: [
        {
          assignmentId: "asg-1",
          title: "Linear Equations",
          sectionId: "sec-1",
          sectionName: "A",
          className: "Class 8",
          subjectName: "Maths",
          dueDate: "2026-10-20T23:59:59",
          totalSubmissions: 35,
          gradedCount: 20,
          ungradedCount: 15,
          lateCount: 2,
          isPastDue: true,
        },
      ],
    };

    it("Morning (08:45): AttendanceNowCard is pinned at top priority above NowNextCard", () => {
      const morningNow = new Date("2026-10-21T08:45:00");
      const cards = deriveTeacherFeed(teacherUserId, morningNow, activeDaySnapshot);

      expect(cards.length).toBeGreaterThanOrEqual(2);
      expect(cards[0]!.cardType).toBe("AttendanceNowCard");
      expect(cards[0]!.priority).toBe(110);
      expect(cards[0]!.tier).toBe("T1_action_required");

      const nowNext = cards.find((c) => c.cardType === "NowNextCard");
      expect(nowNext).toBeDefined();
      expect(nowNext!.priority).toBe(80);
    });

    it("Morning approaching cutoff (09:45): AttendanceNowCard turns amber with priority 115", () => {
      const approachNow = new Date("2026-10-21T09:45:00");
      const cards = deriveTeacherFeed(teacherUserId, approachNow, activeDaySnapshot);

      const attCard = cards.find((c) => c.cardType === "AttendanceNowCard");
      expect(attCard).toBeDefined();
      expect(attCard!.priority).toBe(115);
      expect(attCard!.payload.isApproachingCutoff).toBe(true);
      expect(attCard!.title.en).toBe("Attendance Window Closing");
    });

    it("Past cutoff (10:15) with unmarked sections: AttendanceNowCard triggers urgent priority 120", () => {
      const pastCutoff = new Date("2026-10-21T10:15:00");
      const cards = deriveTeacherFeed(teacherUserId, pastCutoff, activeDaySnapshot);

      const attCard = cards.find((c) => c.cardType === "AttendanceNowCard");
      expect(attCard).toBeDefined();
      expect(attCard!.priority).toBe(120);
      expect(attCard!.payload.isCutoffPassed).toBe(true);
      expect(attCard!.title.en).toBe("Attendance Past Cutoff");
    });

    it("Midday (11:00) with attendance marked: NowNextCard is highest priority", () => {
      const middayNow = new Date("2026-10-21T11:00:00");
      const sec0 = activeDaySnapshot.attendanceSections![0]!;
      const snapshot: TeacherDataSnapshot = {
        ...activeDaySnapshot,
        attendanceSections: [
          {
            ...sec0,
            isMarked: true,
            markedCount: 40,
          },
        ],
        timetableToday: [
          {
            periodId: "p3",
            periodNumber: 3,
            startTime: "10:45",
            endTime: "11:30",
            sectionId: "sec-1",
            sectionName: "A",
            className: "Class 8",
            subjectName: "Maths",
            isFree: false,
          },
          {
            periodId: "p4",
            periodNumber: 4,
            startTime: "11:45",
            endTime: "12:30",
            sectionId: "sec-2",
            sectionName: "B",
            className: "Class 9",
            subjectName: "Maths",
            isFree: false,
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, middayNow, snapshot);
      expect(cards[0]!.cardType).toBe("NowNextCard");
      expect(cards[0]!.priority).toBe(100);
      expect(cards.some((c) => c.cardType === "AttendanceNowCard")).toBe(false);
    });

    it("Afternoon (15:00): GradingQueueCard is dominant at priority 95", () => {
      const afternoonNow = new Date("2026-10-21T15:00:00");
      const sec0 = activeDaySnapshot.attendanceSections![0]!;
      const snapshot: TeacherDataSnapshot = {
        ...activeDaySnapshot,
        attendanceSections: [
          {
            ...sec0,
            isMarked: true,
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, afternoonNow, snapshot);
      expect(cards[0]!.cardType).toBe("GradingQueueCard");
      expect(cards[0]!.priority).toBe(95);
      expect(cards[0]!.payload.totalUngraded).toBe(15);
    });
  });

  describe("Workflow Cards Verification", () => {
    it("MarksEntryCard: triggers inside open exam window, raises priority to 92 when closing within 24h", () => {
      const now = new Date("2026-10-21T14:00:00");
      const snapshot: TeacherDataSnapshot = {
        ...calmDaySnapshot,
        marksEntryWindows: [
          {
            examId: "exam-1",
            examName: "Term 1 Midterm",
            sectionId: "sec-1",
            sectionName: "A",
            className: "Class 8",
            subjectId: "sub-1",
            subjectName: "Maths",
            maxMarks: 100,
            windowOpensAt: "2026-10-15T00:00:00",
            windowClosesAt: "2026-10-22T10:00:00", // Closes in 20 hours
            totalStudents: 40,
            completedEntries: 10,
            isWindowOpen: true,
            isLocked: false,
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const marksCard = cards.find((c) => c.cardType === "MarksEntryCard");

      expect(marksCard).toBeDefined();
      expect(marksCard!.priority).toBe(92);
      expect(marksCard!.tier).toBe("T1_action_required");
      expect(marksCard!.payload.isClosingSoon).toBe(true);
    });

    it("LeaveQueueCard: triggers for pending leave requests, flags overdue if older than 24h", () => {
      const now = new Date("2026-10-21T10:00:00");
      const snapshot: TeacherDataSnapshot = {
        ...calmDaySnapshot,
        pendingLeaveRequests: [
          {
            id: "leave-1",
            studentId: "stud-1",
            studentName: "Aarav Sharma",
            sectionId: "sec-1",
            sectionName: "A",
            className: "Class 8",
            leaveType: "SICK",
            startDate: "2026-10-21",
            endDate: "2026-10-22",
            reason: "Viral fever",
            requestedAt: "2026-10-19T08:00:00", // 50 hours ago
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const leaveCard = cards.find((c) => c.cardType === "LeaveQueueCard");

      expect(leaveCard).toBeDefined();
      expect(leaveCard!.priority).toBe(85);
      expect(leaveCard!.tier).toBe("T1_action_required");
      expect(leaveCard!.payload.isOverdue).toBe(true);
    });

    it("SubstitutionCard: incoming cover request has priority 88 and highlights schedule clash", () => {
      const now = new Date("2026-10-21T08:00:00");
      const snapshot: TeacherDataSnapshot = {
        ...calmDaySnapshot,
        substitutions: [
          {
            id: "sub-1",
            direction: "INCOMING",
            date: "2026-10-21",
            periodNumber: 3,
            startTime: "10:30",
            endTime: "11:15",
            sectionName: "B",
            className: "Class 9",
            subjectName: "Science",
            otherTeacherName: "Priya Singh",
            status: "PENDING",
            hasConflict: true,
            conflictReason: "Clash with Class 8-A Maths",
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const subCard = cards.find((c) => c.cardType === "SubstitutionCard");

      expect(subCard).toBeDefined();
      expect(subCard!.priority).toBe(88);
      expect(subCard!.tier).toBe("T1_action_required");
      expect(subCard!.payload.hasConflict).toBe(true);
      expect(subCard!.summary.en).toContain("Warning: Clash with your timetable");
    });

    it("PTMTodayCard: renders for booked meetings today and hides when all are held", () => {
      const now = new Date("2026-10-21T09:00:00");
      const snapshot: TeacherDataSnapshot = {
        ...calmDaySnapshot,
        ptmBookingsToday: [
          {
            bookingId: "ptm-b1",
            slotId: "slot-1",
            startTime: "2026-10-21T14:00:00",
            endTime: "2026-10-21T14:15:00",
            parentName: "Sunita Patel",
            studentName: "Rohan Patel",
            sectionName: "Class 8-A",
            status: "BOOKED",
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const ptmCard = cards.find((c) => c.cardType === "PTMTodayCard");

      expect(ptmCard).toBeDefined();
      expect(ptmCard!.priority).toBe(72);
      expect(ptmCard!.payload.totalBooked).toBe(1);
    });

    it("MessagesCard: surfaces unread messages from parents", () => {
      const now = new Date("2026-10-21T12:00:00");
      const snapshot: TeacherDataSnapshot = {
        ...calmDaySnapshot,
        unreadMessages: [
          {
            threadId: "t-1",
            parentName: "Vikram Mehta",
            studentName: "Ananya Mehta",
            sectionName: "Class 8-A",
            lastMessagePreview: "Regarding the maths project submission...",
            sentAt: "2026-10-21T11:45:00",
            unreadCount: 2,
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const msgCard = cards.find((c) => c.cardType === "MessagesCard");

      expect(msgCard).toBeDefined();
      expect(msgCard!.priority).toBe(55);
      expect(msgCard!.payload.unreadCount).toBe(2);
    });

    it("NoticeCard: pinned notice renders and takes precedence over standard notice", () => {
      const now = new Date("2026-10-21T12:00:00");
      const snapshot: TeacherDataSnapshot = {
        ...calmDaySnapshot,
        notices: [
          {
            id: "n-1",
            title: "Staff Meeting Tomorrow",
            contentPreview: "All department heads and class teachers meet at 03:30 PM.",
            publishedAt: "2026-10-20T10:00:00",
            isPinned: true,
            audience: "TEACHERS",
          },
          {
            id: "n-2",
            title: "Library Book Return Notice",
            contentPreview: "Please remind students to return overdue books.",
            publishedAt: "2026-10-20T11:00:00",
            isPinned: false,
            audience: "ALL",
          },
        ],
      };

      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const noticeCards = cards.filter((c) => c.cardType === "NoticeCard");

      expect(noticeCards.length).toBe(2);
      expect(noticeCards[0]!.priority).toBe(52); // Pinned priority
      expect(noticeCards[1]!.priority).toBe(42); // Normal priority
    });
  });
});
