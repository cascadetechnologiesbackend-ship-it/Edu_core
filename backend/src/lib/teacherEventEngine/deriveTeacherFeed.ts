/**
 * Pure Feed Engine for Edu_core Teacher PWA (Spec v1.0, AC-T1)
 *
 * Rules:
 * 1. Strict Zero-Clutter Invariant (AC-T1):
 *    When all sections are marked, no grading backlog, no open exam window,
 *    and no pending requests exist, returns an empty array [].
 * 2. Time-of-Day Choreography:
 *    - 07:30 - 10:00: AttendanceNowCard pinned top, NowNextCard second; approaching cutoff turns amber at 09:30.
 *    - 10:00 - 14:30: NowNextCard first; grading and marks windows midday; leave queue; substitution cards.
 *    - 14:30 - 17:30: GradingQueueCard dominant, marks entry windows, PTM slots, day-complete when queues clear.
 *    - Night: Quiet hours, empty feed unless critical alert.
 * 3. Priority-based sorting with deterministic TTL expiry.
 */

import {
  DerivedTeacherFeedCard,
  TeacherDataSnapshot,
  AttendanceSectionSummary,
  TimetablePeriodItem,
  AssignmentGradingItem,
  MarksEntryWindowItem,
  LeaveRequestItem,
  SubstitutionItem,
  PTMSlotItem,
  TeacherMessageItem,
  TeacherInsightItem,
  TeacherNoticeItem,
} from "./types";

/**
 * Helper to convert "HH:MM" or a Date into fractional hours (e.g. "09:30" -> 9.5).
 */
export function parseTimeToHours(timeStrOrDate: string | Date): number {
  if (timeStrOrDate instanceof Date) {
    return timeStrOrDate.getHours() + timeStrOrDate.getMinutes() / 60;
  }
  const [hours, minutes] = timeStrOrDate.split(":").map(Number);
  return (hours || 0) + (minutes || 0) / 60;
}

/**
 * Pure function to derive active feed cards for a teacher.
 */
export function deriveTeacherFeed(
  teacherUserId: string,
  now: Date,
  snapshot: TeacherDataSnapshot
): DerivedTeacherFeedCard[] {
  if (!teacherUserId || !teacherUserId.trim()) {
    throw new Error("teacherUserId is required to derive teacher feed");
  }

  const cards: DerivedTeacherFeedCard[] = [];
  const nowHours = parseTimeToHours(now);
  const nowMs = now.getTime();

  // Time boundaries (configurable via snapshot, default values per spec)
  const schoolDayStartHours = snapshot.schoolDayStart
    ? parseTimeToHours(snapshot.schoolDayStart)
    : 7.5; // 07:30
  const attendanceCutoffHours = snapshot.attendanceCutoffTime
    ? parseTimeToHours(snapshot.attendanceCutoffTime)
    : 10.0; // 10:00
  const schoolDayEndHours = snapshot.schoolDayEnd
    ? parseTimeToHours(snapshot.schoolDayEnd)
    : 15.5; // 15:30

  const isWorkingDay = snapshot.isWorkingDay;

  // Time-of-day phases
  const isMorning = nowHours >= schoolDayStartHours && nowHours < 10.0;
  const isMidday = nowHours >= 10.0 && nowHours < 14.5;
  const isAfternoon = nowHours >= 14.5 && nowHours <= 18.0;

  // ───────────────────────────────────────────────────────────────────────────
  // 1. AttendanceNowCard
  // ───────────────────────────────────────────────────────────────────────────
  if (isWorkingDay && snapshot.attendanceSections && snapshot.attendanceSections.length > 0) {
    const unmarkedSections = snapshot.attendanceSections.filter((s) => !s.isMarked);

    // Only render if at least one section has not been marked today
    if (unmarkedSections.length > 0) {
      const isApproachingCutoff =
        nowHours >= attendanceCutoffHours - 0.5 && nowHours < attendanceCutoffHours;
      const isCutoffPassed = nowHours >= attendanceCutoffHours;

      let priority = 95;
      if (isCutoffPassed) {
        priority = 120; // Urgent rose state
      } else if (isMorning) {
        priority = isApproachingCutoff ? 115 : 110; // Top of morning feed
      }

      const totalUnmarked = unmarkedSections.length;
      const totalSections = snapshot.attendanceSections.length;

      const title = {
        en: isCutoffPassed
          ? "Attendance Past Cutoff"
          : isApproachingCutoff
          ? "Attendance Window Closing"
          : "Morning Attendance",
        hi: isCutoffPassed
          ? "उपस्थिति का समय समाप्त"
          : isApproachingCutoff
          ? "उपस्थिति का समय समाप्त होने वाला है"
          : "सुबह की उपस्थिति",
      };

      const firstUnmarked = unmarkedSections[0];
      const summary = {
        en:
          totalUnmarked === 1 && firstUnmarked
            ? `Attendance pending for ${firstUnmarked.className}-${firstUnmarked.sectionName} (${firstUnmarked.totalStudents} students).`
            : `${totalUnmarked} of ${totalSections} sections waiting for attendance roll call.`,
        hi:
          totalUnmarked === 1 && firstUnmarked
            ? `${firstUnmarked.className}-${firstUnmarked.sectionName} (${firstUnmarked.totalStudents} छात्र) के लिए उपस्थिति दर्ज करना बाकी है।`
            : `${totalSections} में से ${totalUnmarked} कक्षाओं की उपस्थिति दर्ज करना बाकी है।`,
      };

      const expiresAt = new Date(now);
      expiresAt.setHours(23, 59, 59, 999);

      cards.push({
        id: `attendance-now-${teacherUserId}`,
        teacherUserId,
        cardType: "AttendanceNowCard",
        tier: "T1_action_required",
        priority,
        title,
        summary,
        payload: {
          sections: snapshot.attendanceSections,
          unmarkedSections,
          unmarkedCount: totalUnmarked,
          totalSections,
          isApproachingCutoff,
          isCutoffPassed,
          cutoffTime: snapshot.attendanceCutoffTime || "10:00",
        },
        activatedAt: now,
        expiresAt,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. NowNextCard
  // ───────────────────────────────────────────────────────────────────────────
  if (
    isWorkingDay &&
    snapshot.timetableToday &&
    snapshot.timetableToday.length > 0 &&
    nowHours >= schoolDayStartHours &&
    nowHours <= schoolDayEndHours
  ) {
    const sortedPeriods = [...snapshot.timetableToday].sort(
      (a, b) => parseTimeToHours(a.startTime) - parseTimeToHours(b.startTime)
    );

    // Find period running right now
    const currentPeriod =
      sortedPeriods.find((p) => {
        const start = parseTimeToHours(p.startTime);
        const end = parseTimeToHours(p.endTime);
        return nowHours >= start && nowHours < end;
      }) || null;

    // Find next upcoming period
    const nextPeriod =
      sortedPeriods.find((p) => parseTimeToHours(p.startTime) > nowHours) || null;

    // Only render NowNextCard if there is a running period or an upcoming period today
    if (currentPeriod || nextPeriod) {
      let priority = 80;
      if (isMidday) {
        priority = 100; // Top of midday feed
      } else if (isMorning) {
        priority = 80;
      } else if (isAfternoon) {
        priority = 60;
      }

      const isFreeNow = !currentPeriod || currentPeriod.isFree;
      const freeUntil = isFreeNow ? (nextPeriod ? nextPeriod.startTime : null) : null;

      let title = {
        en: currentPeriod && !currentPeriod.isFree
          ? `Period ${currentPeriod.periodNumber} · ${currentPeriod.className}-${currentPeriod.sectionName}`
          : "Free Period",
        hi: currentPeriod && !currentPeriod.isFree
          ? `पीरियड ${currentPeriod.periodNumber} · ${currentPeriod.className}-${currentPeriod.sectionName}`
          : "खाली पीरियड",
      };

      let summary = {
        en: currentPeriod && !currentPeriod.isFree
          ? `${currentPeriod.subjectName || "Lesson"} in Room ${currentPeriod.roomNumber || "TBD"}.${
              nextPeriod ? ` Next: Period ${nextPeriod.periodNumber} (${nextPeriod.startTime}).` : ""
            }`
          : `Free until ${freeUntil || "end of day"}.${
              nextPeriod
                ? ` Next: Period ${nextPeriod.periodNumber} (${nextPeriod.className}-${nextPeriod.sectionName}).`
                : ""
            }`,
        hi: currentPeriod && !currentPeriod.isFree
          ? `${currentPeriod.subjectName || "कक्षा"}, कमरा ${currentPeriod.roomNumber || "TBD"}।${
              nextPeriod ? ` अगला: पीरियड ${nextPeriod.periodNumber} (${nextPeriod.startTime})।` : ""
            }`
          : `${freeUntil || "दिन के अंत"} तक खाली।${
              nextPeriod
                ? ` अगला: पीरियड ${nextPeriod.periodNumber} (${nextPeriod.className}-${nextPeriod.sectionName})।`
                : ""
            }`,
      };

      // 1 hour expiry (or end of running period)
      const periodEndHours = currentPeriod ? parseTimeToHours(currentPeriod.endTime) : (nextPeriod ? parseTimeToHours(nextPeriod.startTime) : nowHours + 1);
      const minutesToEnd = Math.max(15, (periodEndHours - nowHours) * 60);
      const expiresAt = new Date(nowMs + minutesToEnd * 60000);

      cards.push({
        id: `now-next-${teacherUserId}`,
        teacherUserId,
        cardType: "NowNextCard",
        tier: "T2_informational",
        priority,
        title,
        summary,
        payload: {
          currentPeriod,
          nextPeriod,
          isFreeNow,
          freeUntil,
        },
        activatedAt: now,
        expiresAt,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. GradingQueueCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.gradingAssignments && snapshot.gradingAssignments.length > 0) {
    const pendingAssignments = snapshot.gradingAssignments
      .filter((a) => a.ungradedCount > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    if (pendingAssignments.length > 0) {
      const totalUngraded = pendingAssignments.reduce((acc, a) => acc + a.ungradedCount, 0);
      const topAssignment = pendingAssignments[0]!;

      let priority = 50;
      if (isAfternoon) {
        priority = 95; // Dominant in afternoon
      } else if (isMidday) {
        priority = 75;
      }

      const expiresAt = new Date(nowMs + 6 * 3600000); // 6 hours TTL

      cards.push({
        id: `grading-queue-${teacherUserId}`,
        teacherUserId,
        cardType: "GradingQueueCard",
        tier: "T2_informational",
        priority,
        title: {
          en: `Grading Queue · ${totalUngraded} to Review`,
          hi: `जांच कतार · ${totalUngraded} समीक्षा बाकी`,
        },
        summary: {
          en: `${topAssignment.title} (${topAssignment.className}-${topAssignment.sectionName}): ${topAssignment.gradedCount} of ${topAssignment.totalSubmissions} graded.${
            topAssignment.lateCount > 0 ? ` ${topAssignment.lateCount} late.` : ""
          }`,
          hi: `${topAssignment.title} (${topAssignment.className}-${topAssignment.sectionName}): ${topAssignment.gradedCount}/${topAssignment.totalSubmissions} जांचे गए।${
            topAssignment.lateCount > 0 ? ` ${topAssignment.lateCount} विलंबित।` : ""
          }`,
        },
        payload: {
          totalUngraded,
          assignments: pendingAssignments,
          topAssignment,
        },
        activatedAt: now,
        expiresAt,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MarksEntryCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.marksEntryWindows && snapshot.marksEntryWindows.length > 0) {
    const activeWindows = snapshot.marksEntryWindows.filter(
      (w) => w.isWindowOpen && !w.isLocked && w.completedEntries < w.totalStudents
    );

    if (activeWindows.length > 0) {
      // Find window closing soonest
      activeWindows.sort(
        (a, b) => new Date(a.windowClosesAt).getTime() - new Date(b.windowClosesAt).getTime()
      );
      const topWindow = activeWindows[0]!;
      const closesAtMs = new Date(topWindow.windowClosesAt).getTime();
      const hoursRemaining = Math.max(0, (closesAtMs - nowMs) / 3600000);
      const isClosingSoon = hoursRemaining <= 24;

      const priority = isClosingSoon ? 92 : 70;
      const tier = isClosingSoon ? "T1_action_required" : "T2_informational";

      cards.push({
        id: `marks-entry-${topWindow.examId}-${topWindow.sectionId}-${topWindow.subjectId}`,
        teacherUserId,
        cardType: "MarksEntryCard",
        tier,
        priority,
        title: {
          en: isClosingSoon ? "Marks Entry Closes Soon" : "Marks Entry Window Open",
          hi: isClosingSoon ? "अंक प्रविष्टि जल्द समाप्त होगी" : "अंक प्रविष्टि विंडो खुली है",
        },
        summary: {
          en: `${topWindow.examName} (${topWindow.className}-${topWindow.sectionName} ${topWindow.subjectName}): ${topWindow.completedEntries} of ${topWindow.totalStudents} entered.${
            isClosingSoon ? ` Closes in ${Math.round(hoursRemaining)} hours!` : ""
          }`,
          hi: `${topWindow.examName} (${topWindow.className}-${topWindow.sectionName}): ${topWindow.completedEntries}/${topWindow.totalStudents} प्रविष्ट।${
            isClosingSoon ? ` केवल ${Math.round(hoursRemaining)} घंटे शेष!` : ""
          }`,
        },
        payload: {
          windows: activeWindows,
          topWindow,
          isClosingSoon,
          hoursRemaining: Math.round(hoursRemaining),
        },
        activatedAt: now,
        expiresAt: new Date(topWindow.windowClosesAt),
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. LeaveQueueCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.pendingLeaveRequests && snapshot.pendingLeaveRequests.length > 0) {
    const count = snapshot.pendingLeaveRequests.length;
    // Check if any request is older than 24 hours
    const oldestRequest = [...snapshot.pendingLeaveRequests].sort(
      (a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    )[0]!;
    const oldestAgeHours = (nowMs - new Date(oldestRequest.requestedAt).getTime()) / 3600000;
    const isOverdue = oldestAgeHours >= 24;

    const priority = isOverdue ? 85 : 65;
    const tier = isOverdue ? "T1_action_required" : "T2_informational";

    cards.push({
      id: `leave-queue-${teacherUserId}`,
      teacherUserId,
      cardType: "LeaveQueueCard",
      tier,
      priority,
      title: {
        en: isOverdue ? "Leave Requests Needing Decision" : "Student Leave Requests",
        hi: isOverdue ? "अवकाश अनुरोध निर्णय की प्रतीक्षा में" : "छात्र अवकाश अनुरोध",
      },
      summary: {
        en: `${count} student leave request${count > 1 ? "s" : ""} waiting.${
          isOverdue ? ` Oldest waiting for ${Math.round(oldestAgeHours)} hours.` : ""
        }`,
        hi: `${count} छात्र अवकाश अनुरोध प्रतीक्षारत हैं।${
          isOverdue ? ` सबसे पुराना अनुरोध ${Math.round(oldestAgeHours)} घंटे से लंबित है।` : ""
        }`,
      },
      payload: {
        pendingCount: count,
        requests: snapshot.pendingLeaveRequests,
        isOverdue,
        oldestAgeHours: Math.round(oldestAgeHours),
      },
      activatedAt: now,
      expiresAt: new Date(nowMs + 4 * 3600000), // 4 hours TTL
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. SubstitutionCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.substitutions && snapshot.substitutions.length > 0) {
    const pendingSubs = snapshot.substitutions.filter((s) => s.status === "PENDING");

    if (pendingSubs.length > 0) {
      // Prioritize incoming cover requests over outgoing cover requests
      const incoming = pendingSubs.find((s) => s.direction === "INCOMING");
      const topSub = (incoming || pendingSubs[0])!;

      const isIncoming = topSub.direction === "INCOMING";
      const priority = isIncoming ? 88 : 62;
      const tier = isIncoming ? "T1_action_required" : "T2_informational";

      cards.push({
        id: `substitution-${topSub.id}`,
        teacherUserId,
        cardType: "SubstitutionCard",
        tier,
        priority,
        title: {
          en: isIncoming
            ? `Cover Period ${topSub.periodNumber} (${topSub.sectionName || ""})`
            : "Absence Coverage Pending",
          hi: isIncoming
            ? `पीरियड ${topSub.periodNumber} कवर करें (${topSub.sectionName || ""})`
            : "अनुपस्थिति कवर लंबित",
        },
        summary: {
          en: isIncoming
            ? `Cover requested for ${topSub.otherTeacherName} (${topSub.className || ""}-${topSub.sectionName || ""} ${topSub.subjectName || ""}).${
                topSub.hasConflict ? " Warning: Clash with your timetable." : ""
              }`
            : `Awaiting substitute assignment for Period ${topSub.periodNumber} (${topSub.date}).`,
          hi: isIncoming
            ? `${topSub.otherTeacherName} के लिए कक्षा लें (${topSub.className || ""}-${topSub.sectionName || ""})।${
                topSub.hasConflict ? " चेतावनी: आपके समय सारिणी के साथ टकराव।" : ""
              }`
            : `पीरियड ${topSub.periodNumber} के लिए स्थानापन्न शिक्षक की प्रतीक्षा है।`,
        },
        payload: {
          substitutions: pendingSubs,
          topSubstitution: topSub,
          isIncoming,
          hasConflict: !!topSub.hasConflict,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 8 * 3600000), // 8 hours TTL
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. PTMTodayCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.ptmBookingsToday && snapshot.ptmBookingsToday.length > 0) {
    const bookedSessions = snapshot.ptmBookingsToday.filter((b) => b.status === "BOOKED");

    if (bookedSessions.length > 0) {
      cards.push({
        id: `ptm-today-${teacherUserId}`,
        teacherUserId,
        cardType: "PTMTodayCard",
        tier: "T2_informational",
        priority: 72,
        title: {
          en: "PTM Meetings Scheduled Today",
          hi: "आज पीटीएम बैठकें निर्धारित हैं",
        },
        summary: {
          en: `${bookedSessions.length} parent meeting${bookedSessions.length > 1 ? "s" : ""} booked for today.`,
          hi: `आज ${bookedSessions.length} अभिभावक बैठकें निर्धारित हैं।`,
        },
        payload: {
          totalBooked: bookedSessions.length,
          bookings: bookedSessions,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 8 * 3600000),
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. MessagesCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.unreadMessages && snapshot.unreadMessages.length > 0) {
    const totalUnread = snapshot.unreadMessages.reduce((sum, m) => sum + m.unreadCount, 0);

    if (totalUnread > 0) {
      cards.push({
        id: `messages-unread-${teacherUserId}`,
        teacherUserId,
        cardType: "MessagesCard",
        tier: "T2_informational",
        priority: 55,
        title: {
          en: "Unread Parent Messages",
          hi: "अपठित अभिभावक संदेश",
        },
        summary: {
          en: `${totalUnread} unread message${totalUnread > 1 ? "s" : ""} from parents.`,
          hi: `अभिभावकों से ${totalUnread} नए संदेश।`,
        },
        payload: {
          unreadCount: totalUnread,
          threads: snapshot.unreadMessages,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 4 * 3600000),
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9. InsightCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.insights && snapshot.insights.length > 0) {
    for (const insight of snapshot.insights) {
      cards.push({
        id: `insight-${insight.id}`,
        teacherUserId,
        cardType: "InsightCard",
        tier: "T2_informational",
        priority: 45,
        title: insight.title,
        summary: insight.summary,
        payload: {
          model: insight.model,
          severity: insight.severity,
          ...insight.payload,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 24 * 3600000), // 24 hours TTL
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 10. NoticeCard
  // ───────────────────────────────────────────────────────────────────────────
  if (snapshot.notices && snapshot.notices.length > 0) {
    // Only notices published within 72h or pinned, not expired
    const validNotices = snapshot.notices.filter((n) => {
      if (n.expiresAt && new Date(n.expiresAt).getTime() <= nowMs) return false;
      const ageHours = (nowMs - new Date(n.publishedAt).getTime()) / 3600000;
      return n.isPinned || ageHours <= 72;
    });

    for (const notice of validNotices.slice(0, 2)) {
      cards.push({
        id: `notice-${notice.id}`,
        teacherUserId,
        cardType: "NoticeCard",
        tier: "T2_informational",
        priority: notice.isPinned ? 52 : 42,
        title: {
          en: notice.title,
          hi: notice.title,
        },
        summary: {
          en: notice.contentPreview,
          hi: notice.contentPreview,
        },
        payload: {
          noticeId: notice.id,
          isPinned: notice.isPinned,
          publishedAt: notice.publishedAt,
        },
        activatedAt: new Date(notice.publishedAt),
        expiresAt: notice.expiresAt ? new Date(notice.expiresAt) : new Date(nowMs + 72 * 3600000),
      });
    }
  }

  // Sort deterministically: highest priority first, then most recently activated
  cards.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return b.activatedAt.getTime() - a.activatedAt.getTime();
  });

  return cards;
}
