/**
 * Pure Student Feed Derivation Engine (Spec v1.0, Phase S3)
 *
 * Evaluates a student data snapshot into high-intent, chronological feed cards:
 * - HomeworkDue (published assignments for their section and enrolled subjects)
 * - ClassworkRecap (completed lesson plans in past 7 days)
 * - AssessmentCountdown (scheduled within 14 days)
 * - NoticeCard (notices for STUDENTS/ALL, class, or section)
 * - MarksPublished (results released and unheld)
 * - FeeHoldWarning (pinned alert if admit card is held for fee dues)
 *
 * Pinned Strip Rules (BR-S1):
 * - Homework due today (unsubmitted) is pinned at top with T1 priority.
 * - Any admit-card fee hold is pinned at top with T1 priority.
 *
 * Zero-Clutter Invariant (AC-5):
 * When no active assignments, assessments, unread notices, or events exist, returns [].
 * The UI renders a calm, dignified greeting state with the date strip.
 */

import type {
  StudentDataSnapshot,
  StudentFeedCard,
  LocalizedString,
} from "./types";

export function deriveStudentFeed(
  studentId: string,
  now: Date = new Date(),
  snapshot: StudentDataSnapshot
): StudentFeedCard[] {
  if (!studentId || !studentId.trim()) {
    throw new Error("studentId is required to derive student feed");
  }

  const cards: StudentFeedCard[] = [];
  const nowMs = now.getTime();
  const calendarDayNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // ─── 1. FeeHoldWarning (Pinned if admit card is held) ──────────────────────
  if (snapshot.admitCardFeeHold && snapshot.admitCardFeeHold.balanceDue > 0) {
    const hold = snapshot.admitCardFeeHold;
    const balanceFormatted = hold.balanceDue.toLocaleString("en-IN");

    cards.push({
      id: `fee-hold-admit-card-${studentId}`,
      studentId,
      cardType: "FeeHoldWarning",
      tier: "T1_action_required",
      priority: 98,
      isPinned: true,
      title: {
        en: "Exam Admit Card Fee Clearance Required",
        hi: "परीक्षा प्रवेश पत्र के लिए शुल्क भुगतान आवश्यक",
      },
      summary: {
        en: `Pending fee balance of ₹${balanceFormatted} must be settled to download the admit card for ${hold.examName}.`,
        hi: `${hold.examName} के प्रवेश पत्र के लिए ₹${balanceFormatted} का बकाया शुल्क भुगतान करें।`,
      },
      payload: {
        examName: hold.examName,
        balanceDue: hold.balanceDue,
        feeLockMode: hold.feeLockMode,
      },
      activatedAt: now,
      expiresAt: new Date(nowMs + 7 * 86400000),
    });
  }

  // ─── 2. HomeworkDue Cards ──────────────────────────────────────────────────
  if (snapshot.homework && snapshot.homework.length > 0) {
    for (const hw of snapshot.homework) {
      // Must be PUBLISHED, GRADED, or CLOSED
      if (hw.status !== "PUBLISHED" && hw.status !== "GRADED" && hw.status !== "CLOSED") {
        continue;
      }

      const dueDate = new Date(hw.dueDate);
      const calendarDayDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
      const daysDiff = Math.round((calendarDayDue - calendarDayNow) / 86400000);
      const diffDueDateMs = dueDate.getTime() - nowMs;
      const isPastDue = diffDueDateMs < 0;

      let dueBadgeEn = `Due ${dueDate.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}`;
      let dueBadgeHi = `${dueDate.toLocaleDateString("hi-IN", { month: "short", day: "numeric" })} तक देय`;

      let isDueToday = false;
      let isDueTomorrow = false;

      if (!isPastDue) {
        if (daysDiff === 0) {
          dueBadgeEn = "Due today";
          dueBadgeHi = "आज देय है";
          isDueToday = true;
        } else if (daysDiff === 1) {
          dueBadgeEn = "Due tomorrow";
          dueBadgeHi = "कल देय है";
          isDueTomorrow = true;
        }
      } else if (!hw.isSubmitted) {
        dueBadgeEn = "Past Due";
        dueBadgeHi = "अतिदेय";
      }

      let subStatusEn = "Pending Submission";
      let subStatusHi = "जमा करना बाकी";

      if (hw.isSubmitted) {
        if (hw.submission?.grade || (hw.submission?.marksAwarded !== null && hw.submission?.marksAwarded !== undefined)) {
          subStatusEn = `Graded: ${hw.submission.marksAwarded ?? hw.submission.grade} Marks`;
          subStatusHi = `मूल्यांकित: ${hw.submission.marksAwarded ?? hw.submission.grade} अंक`;
        } else {
          subStatusEn = "Submitted";
          subStatusHi = "जमा किया गया";
        }
      }

      // Pin if due today and not submitted
      const isPinned = isDueToday && !hw.isSubmitted;

      // Tier & priority
      let tier: "T1_action_required" | "T2_informational" = "T2_informational";
      let priority = 50;

      if (!hw.isSubmitted) {
        if (isDueToday) {
          tier = "T1_action_required";
          priority = 95;
        } else if (isDueTomorrow) {
          tier = "T1_action_required";
          priority = 85;
        } else if (isPastDue) {
          tier = "T1_action_required";
          priority = 80;
        } else {
          priority = 60;
        }
      } else if (hw.submission?.grade) {
        // Recently graded
        priority = 65;
      }

      cards.push({
        id: `student-hw-${hw.id}`,
        studentId,
        cardType: "HomeworkDue",
        tier,
        priority,
        isPinned,
        title: {
          en: `${hw.subjectName}: ${hw.title}`,
          hi: `${hw.subjectName}: ${hw.title}`,
        },
        summary: {
          en: `${dueBadgeEn} • ${subStatusEn}`,
          hi: `${dueBadgeHi} • ${subStatusHi}`,
        },
        payload: {
          homeworkId: hw.id,
          title: hw.title,
          description: hw.description || null,
          subjectName: hw.subjectName,
          dueDate: hw.dueDate,
          dueBadge: { en: dueBadgeEn, hi: dueBadgeHi },
          isSubmitted: hw.isSubmitted,
          submission: hw.submission || null,
          teacherName: hw.teacherName || "Class Teacher",
          attachmentS3Key: hw.attachmentS3Key || null,
          status: hw.status,
        },
        activatedAt: now,
        expiresAt: new Date(dueDate.getTime() + 7 * 86400000), // Visible 7 days post-due
        occurredAt: dueDate,
      });
    }
  }

  // ─── 3. ClassworkRecap Cards ───────────────────────────────────────────────
  if (snapshot.classwork && snapshot.classwork.length > 0) {
    for (const cw of snapshot.classwork) {
      const completedDate = new Date(cw.completedDate);
      const diffMs = nowMs - completedDate.getTime();
      // Drop if completed > 7 days ago
      if (diffMs > 7 * 86400000) continue;

      const dateLabelEn = completedDate.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
      const dateLabelHi = completedDate.toLocaleDateString("hi-IN", { month: "short", day: "numeric" });

      const detailsEn = [
        cw.chapterName ? `${cw.chapterName}` : "",
        cw.topicTitle || cw.objectives || "Classwork completed",
        cw.homework ? `Homework: ${cw.homework}` : "",
      ]
        .filter(Boolean)
        .join(" • ");

      const detailsHi = [
        cw.chapterName ? `${cw.chapterName}` : "",
        cw.topicTitle || cw.objectives || "कक्षा कार्य पूर्ण",
        cw.homework ? `गृहकार्य: ${cw.homework}` : "",
      ]
        .filter(Boolean)
        .join(" • ");

      cards.push({
        id: `student-cw-${cw.id}`,
        studentId,
        cardType: "ClassworkRecap",
        tier: "T2_informational",
        priority: 45,
        isPinned: false,
        title: {
          en: `${cw.subjectName}: ${cw.topicTitle || cw.chapterName || "Classwork Recap"}`,
          hi: `${cw.subjectName}: ${cw.topicTitle || cw.chapterName || "कक्षा कार्य संक्षेप"}`,
        },
        summary: {
          en: `${dateLabelEn} • ${detailsEn}`,
          hi: `${dateLabelHi} • ${detailsHi}`,
        },
        payload: {
          classworkId: cw.id,
          subjectName: cw.subjectName,
          chapterName: cw.chapterName,
          topicTitle: cw.topicTitle,
          objectives: cw.objectives,
          homework: cw.homework,
          teachingMethods: cw.teachingMethods,
          resources: cw.resources,
          completedDate: cw.completedDate,
          teacherName: cw.teacherName,
        },
        activatedAt: completedDate,
        expiresAt: new Date(completedDate.getTime() + 7 * 86400000),
        occurredAt: completedDate,
      });
    }
  }

  // ─── 4. AssessmentCountdown Cards ──────────────────────────────────────────
  if (snapshot.upcomingAssessments && snapshot.upcomingAssessments.length > 0) {
    for (const asmt of snapshot.upcomingAssessments) {
      const scheduledDate = new Date(asmt.scheduledDate);
      const calendarDayAsmt = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate()).getTime();
      const daysDiff = Math.round((calendarDayAsmt - calendarDayNow) / 86400000);

      // Skip past assessments
      if (daysDiff < 0) continue;

      let countdownEn = `In ${daysDiff} days`;
      let countdownHi = `${daysDiff} दिनों में`;
      let isUrgent = false;

      if (daysDiff === 0) {
        countdownEn = "Today's Assessment";
        countdownHi = "आज की परीक्षा";
        isUrgent = true;
      } else if (daysDiff === 1) {
        countdownEn = "Tomorrow";
        countdownHi = "कल परीक्षा";
        isUrgent = true;
      } else if (daysDiff <= 3) {
        isUrgent = true;
      }

      cards.push({
        id: `student-asmt-${asmt.id}`,
        studentId,
        cardType: "AssessmentCountdown",
        tier: isUrgent ? "T1_action_required" : "T2_informational",
        priority: isUrgent ? 75 : 55,
        isPinned: false,
        title: {
          en: `${asmt.subjectName}: ${asmt.title}`,
          hi: `${asmt.subjectName}: ${asmt.title}`,
        },
        summary: {
          en: `${countdownEn} • Max Marks: ${asmt.maxMarks}${asmt.syllabusCoverage ? ` • ${asmt.syllabusCoverage}` : ""}`,
          hi: `${countdownHi} • कुल अंक: ${asmt.maxMarks}${asmt.syllabusCoverage ? ` • ${asmt.syllabusCoverage}` : ""}`,
        },
        payload: {
          assessmentId: asmt.id,
          title: asmt.title,
          subjectName: asmt.subjectName,
          assessmentType: asmt.assessmentType,
          scheduledDate: asmt.scheduledDate,
          countdown: { en: countdownEn, hi: countdownHi },
          maxMarks: asmt.maxMarks,
          syllabusCoverage: asmt.syllabusCoverage,
        },
        activatedAt: now,
        expiresAt: new Date(scheduledDate.getTime() + 24 * 3600000),
        occurredAt: scheduledDate,
      });
    }
  }

  // ─── 5. Notice Cards ───────────────────────────────────────────────────────
  if (snapshot.notices && snapshot.notices.length > 0) {
    for (const notice of snapshot.notices) {
      const pubDate = new Date(notice.publishedAt);
      const isUrgent = notice.isPinned || (notice.requiresAcknowledgment && !notice.isAcknowledged);

      // Strip any HTML tags for clean card summary
      const cleanContent = notice.content.replace(/<[^>]*>?/gm, "").trim();
      const snippet = cleanContent.length > 90 ? `${cleanContent.slice(0, 90)}...` : cleanContent;

      cards.push({
        id: `student-notice-${notice.id}`,
        studentId,
        cardType: "NoticeCard",
        tier: isUrgent ? "T1_action_required" : "T2_informational",
        priority: isUrgent ? 72 : 40,
        isPinned: false,
        title: {
          en: notice.title,
          hi: notice.title,
        },
        summary: {
          en: `${notice.requiresAcknowledgment && !notice.isAcknowledged ? "Acknowledgment required • " : ""}${snippet}`,
          hi: `${notice.requiresAcknowledgment && !notice.isAcknowledged ? "पावती आवश्यक • " : ""}${snippet}`,
        },
        payload: {
          noticeId: notice.id,
          title: notice.title,
          content: notice.content,
          publishedAt: notice.publishedAt,
          requiresAcknowledgment: notice.requiresAcknowledgment,
          isAcknowledged: notice.isAcknowledged,
          attachmentS3Key: notice.attachmentS3Key || null,
        },
        activatedAt: pubDate,
        expiresAt: notice.expiresAt ? new Date(notice.expiresAt) : new Date(pubDate.getTime() + 14 * 86400000),
        occurredAt: pubDate,
      });
    }
  }

  // ─── 6. MarksPublished Cards ───────────────────────────────────────────────
  if (snapshot.publishedMarks && snapshot.publishedMarks.length > 0) {
    for (const m of snapshot.publishedMarks) {
      const pubDate = new Date(m.publishedAt);
      const isRecent = nowMs - pubDate.getTime() <= 48 * 3600000;

      const gradeDetails = [
        m.overallGrade ? `Grade: ${m.overallGrade}` : "",
        m.percentage !== null && m.percentage !== undefined ? `${m.percentage}%` : "",
        m.rank ? `Rank: ${m.rank}` : "",
      ]
        .filter(Boolean)
        .join(" • ");

      cards.push({
        id: `student-marks-${m.examId}`,
        studentId,
        cardType: "MarksPublished",
        tier: isRecent ? "T1_action_required" : "T2_informational",
        priority: isRecent ? 78 : 58,
        isPinned: false,
        title: {
          en: `Results Published: ${m.examName}`,
          hi: `परीक्षा परिणाम जारी: ${m.examName}`,
        },
        summary: {
          en: `${gradeDetails || "Results available"} • Tap to view score sheet`,
          hi: `${gradeDetails ? `${gradeDetails} • ` : ""}अंकतालिका देखने के लिए टैप करें`,
        },
        payload: {
          examId: m.examId,
          examName: m.examName,
          overallGrade: m.overallGrade,
          percentage: m.percentage,
          rank: m.rank,
          teacherRemarks: m.teacherRemarks,
          pdfS3Key: m.pdfS3Key,
          publishedAt: m.publishedAt,
        },
        activatedAt: pubDate,
        expiresAt: new Date(pubDate.getTime() + 14 * 86400000),
        occurredAt: pubDate,
      });
    }
  }

  // ─── 7. Sort Feed: Pinned first, then tier priority, then recency ──────────
  cards.sort((a, b) => {
    // 1. Pinned cards always on top
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // 2. Priority descending
    if (b.priority !== a.priority) return b.priority - a.priority;

    // 3. Most recent first
    const dateA = (a.occurredAt || a.activatedAt).getTime();
    const dateB = (b.occurredAt || b.activatedAt).getTime();
    return dateB - dateA;
  });

  return cards;
}
