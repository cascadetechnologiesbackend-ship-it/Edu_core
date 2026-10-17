import {
  CardTier,
  CardType,
  DerivedFeedCard,
  ParentDataSnapshot,
} from "./types";

/**
 * Checks if the current time falls inside a standard school commute window.
 * Weekdays:
 * - Morning: 06:30 - 08:30 (6.5 to 8.5)
 * - Afternoon: 14:00 - 17:30 (14.0 to 17.5)
 */
export function isInsideCommuteWindow(now: Date): boolean {
  const day = now.getDay();
  // 0 = Sunday, 6 = Saturday (weekends are excluded)
  if (day === 0 || day === 6) return false;

  const hours = now.getHours() + now.getMinutes() / 60;
  const isMorning = hours >= 6.5 && hours <= 8.5;
  const isAfternoon = hours >= 14.0 && hours <= 17.5;

  return isMorning || isAfternoon;
}

/**
 * Pure function to derive high-intent, active UI cards for a student's parent feed.
 *
 * Strict Zero-Clutter Invariant:
 * When all invoices are paid, attendance is present, outside commute windows, and no
 * alerts or deadlines exist, returns an empty array [].
 */
export function deriveParentFeed(
  studentId: string,
  now: Date,
  snapshot: ParentDataSnapshot
): DerivedFeedCard[] {
  const cards: DerivedFeedCard[] = [];
  const nowMs = now.getTime();
  const studentName = snapshot.studentName || "Your child";

  // ─── 1. PaymentCard ────────────────────────────────────────────────────────
  if (snapshot.invoices && snapshot.invoices.length > 0) {
    // Check for recent successful payment in the last 2 hours
    const recentPaid = snapshot.invoices.find(
      (inv) =>
        inv.lastPayment?.status === "PAID" &&
        nowMs - new Date(inv.lastPayment.paidAt).getTime() <= 2 * 3600000 &&
        nowMs >= new Date(inv.lastPayment.paidAt).getTime()
    );

    if (recentPaid && recentPaid.lastPayment) {
      const paidAtDate = new Date(recentPaid.lastPayment.paidAt);
      cards.push({
        id: `payment-success-${recentPaid.id}`,
        studentId,
        cardType: "PaymentCard",
        tier: "T3_system_state",
        priority: 70,
        title: {
          en: "Fee Payment Received",
          hi: "शुल्क भुगतान प्राप्त हुआ",
        },
        summary: {
          en: `${recentPaid.termName} fee payment confirmed. Receipt ready to download.`,
          hi: `${recentPaid.termName} शुल्क भुगतान की पुष्टि हो गई है। रसीद तैयार है।`,
        },
        payload: {
          invoiceId: recentPaid.id,
          termName: recentPaid.termName,
          status: "PAID",
          isSuccess: true,
          amountPaid: recentPaid.lastPayment.amount || recentPaid.balanceAmount,
          receiptNumber: recentPaid.lastPayment.receiptNumber || null,
        },
        activatedAt: paidAtDate,
        expiresAt: new Date(paidAtDate.getTime() + 2 * 3600000), // Disappears after 2h
      });
    }

    // Check for unpaid invoices needing parent action
    for (const inv of snapshot.invoices) {
      if (inv.status === "PAID" || inv.status === "WAIVED" || inv.status === "CANCELLED") {
        continue;
      }

      const dueDate = new Date(inv.dueDate);
      const diffMs = dueDate.getTime() - nowMs;
      const daysUntilDue = Math.ceil(diffMs / 86400000);
      const isOverdue = inv.status === "OVERDUE" || diffMs < 0;

      // Render if OVERDUE or within 7 days of due date
      if (isOverdue || daysUntilDue <= 7) {
        const isUrgent = isOverdue || daysUntilDue <= 3;
        const totalPayable = (inv.balanceAmount || 0) + (inv.lateFeeAmount || 0);

        let chipEn = `Due in ${daysUntilDue} days`;
        let chipHi = `${daysUntilDue} दिनों में देय`;
        if (daysUntilDue === 0) {
          chipEn = "Due today";
          chipHi = "आज देय";
        } else if (daysUntilDue === 1) {
          chipEn = "Due tomorrow";
          chipHi = "कल देय";
        } else if (isOverdue) {
          chipEn = inv.lateFeeAmount > 0 ? "Overdue - late fee added" : "Overdue";
          chipHi = inv.lateFeeAmount > 0 ? "अतिदेय - विलंब शुल्क जोड़ा गया" : "अतिदेय";
        }

        cards.push({
          id: `payment-${inv.id}`,
          studentId,
          cardType: "PaymentCard",
          tier: isUrgent ? "T1_action_required" : "T2_informational",
          priority: isOverdue ? 92 : 80,
          title: {
            en: isOverdue ? `Overdue Fee: ${inv.termName}` : `Pay Fee: ${inv.termName}`,
            hi: isOverdue ? `अतिदेय शुल्क: ${inv.termName}` : `शुल्क भरें: ${inv.termName}`,
          },
          summary: {
            en: `${inv.termName} fee of ₹${totalPayable.toLocaleString("en-IN")} is ${chipEn.toLowerCase()}.`,
            hi: `${inv.termName} शुल्क ₹${totalPayable.toLocaleString("en-IN")} ${chipHi.toLowerCase()} है।`,
          },
          payload: {
            invoiceId: inv.id,
            termName: inv.termName,
            status: isOverdue ? "OVERDUE" : inv.status,
            balanceAmount: inv.balanceAmount,
            lateFeeAmount: inv.lateFeeAmount || 0,
            totalPayable,
            dueDate: inv.dueDate,
            daysUntilDue,
            chip: { en: chipEn, hi: chipHi },
          },
          activatedAt: now,
          expiresAt: new Date(dueDate.getTime() + 30 * 86400000), // Expires 30d after due
        });
      }
    }
  }

  // ─── 2. AttendanceCard ─────────────────────────────────────────────────────
  if (snapshot.attendanceToday) {
    const att = snapshot.attendanceToday;
    if (att.status === "ABSENT" || att.status === "LATE" || att.status === "HALF_DAY" || att.status === "LEAVE") {
      const markedAtDate = new Date(att.markedAt);
      const hoursStr = markedAtDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // Status labels
      const statusLabels: Record<string, { en: string; hi: string; severity: "ROSE" | "AMBER" }> = {
        ABSENT: { en: "Absent", hi: "अनुपस्थित", severity: "ROSE" },
        LATE: { en: "Late", hi: "देर से", severity: "AMBER" },
        HALF_DAY: { en: "Half Day", hi: "आधा दिन", severity: "AMBER" },
        LEAVE: { en: "On Leave", hi: "अवकाश पर", severity: "AMBER" },
      };
      const meta = statusLabels[att.status] || { en: att.status, hi: att.status, severity: "AMBER" };

      // Set expiry to 20:00 (8:00 PM) on the same day
      const sameDayExpiry = new Date(markedAtDate);
      sameDayExpiry.setHours(20, 0, 0, 0);

      cards.push({
        id: `attendance-${studentId}-${markedAtDate.toISOString().slice(0, 10)}`,
        studentId,
        cardType: "AttendanceCard",
        tier: "T1_action_required",
        priority: 90,
        title: {
          en: `${studentName} marked ${meta.en}`,
          hi: `${studentName} को ${meta.hi} दर्ज किया गया`,
        },
        summary: {
          en: `${studentName} was marked ${meta.en} today at ${hoursStr}.${att.remarks ? ` Note: ${att.remarks}` : ""}`,
          hi: `आज ${hoursStr} बजे ${studentName} को ${meta.hi} दर्ज किया गया।${att.remarks ? ` टिप्पणी: ${att.remarks}` : ""}`,
        },
        payload: {
          status: att.status,
          severity: meta.severity,
          markedAt: att.markedAt,
          remarks: att.remarks || null,
        },
        activatedAt: markedAtDate,
        expiresAt: sameDayExpiry > now ? sameDayExpiry : new Date(nowMs + 3600000),
      });
    }
  }

  // ─── 3. BusLiveCard ────────────────────────────────────────────────────────
  if (snapshot.busPass?.isActive) {
    const isCommute =
      snapshot.isCommuteWindowOverride !== undefined
        ? snapshot.isCommuteWindowOverride
        : isInsideCommuteWindow(now);

    if (isCommute) {
      const busPass = snapshot.busPass;
      const latestPing = snapshot.latestBusPing;
      const routeStops = snapshot.routeStops || [];

      // Determine stops away
      let stopsAway = 1;
      let nearestStopName = busPass.stopName || "Your stop";

      if (routeStops.length > 0) {
        const studentStop = routeStops.find((s) => s.id === busPass.stopId || s.stopOrder === busPass.stopOrder);
        if (studentStop) {
          // If latest ping exists, estimate bus stop position
          const currentStopOrder = Math.max(1, (studentStop.stopOrder || 1) - 2);
          stopsAway = Math.max(0, (studentStop.stopOrder || 1) - currentStopOrder);
        }
      }

      const isApproaching = stopsAway <= 2;

      cards.push({
        id: `bus-live-${busPass.routeId}`,
        studentId,
        cardType: "BusLiveCard",
        tier: isApproaching ? "T1_action_required" : "T2_informational",
        priority: 100, // Pinned top during commute window!
        title: {
          en: isApproaching ? `School Bus is ${stopsAway} stops away` : "School Bus is En Route",
          hi: isApproaching ? `स्कूल बस ${stopsAway} स्टॉप दूर है` : "स्कूल बस रास्ते में है",
        },
        summary: {
          en: `Bus on ${busPass.routeName || "transit route"} approaching ${nearestStopName}.`,
          hi: `${nearestStopName} की ओर बढ़ रही बस रास्ते में है।`,
        },
        payload: {
          routeId: busPass.routeId,
          routeName: busPass.routeName || "Route",
          stopId: busPass.stopId,
          stopName: nearestStopName,
          stopsAway,
          isApproaching,
          vehiclePing: latestPing || null,
          stopCoords: busPass.stopCoords || null,
        },
        activatedAt: now,
        // Card expires at the end of the commute window (2 hours max)
        expiresAt: new Date(nowMs + 2 * 3600000),
      });
    }
  }

  // ─── 4. HomeworkCard ───────────────────────────────────────────────────────
  if (snapshot.homework && snapshot.homework.length > 0) {
    for (const hw of snapshot.homework) {
      const dueDate = new Date(hw.dueDate);
      const diffDueDateMs = dueDate.getTime() - nowMs;
      const hoursUntilDue = diffDueDateMs / 3600000;

      // Pending homework due within 48h
      if (!hw.isSubmitted && hoursUntilDue > 0 && hoursUntilDue <= 48) {
        const isTomorrow = hoursUntilDue <= 24;
        cards.push({
          id: `homework-due-${hw.id}`,
          studentId,
          cardType: "HomeworkCard",
          tier: "T2_informational",
          priority: isTomorrow ? 75 : 60,
          title: {
            en: isTomorrow ? `${hw.subjectName} due tomorrow` : `${hw.subjectName} due in 2 days`,
            hi: isTomorrow ? `${hw.subjectName} कल देय है` : `${hw.subjectName} 2 दिनों में देय है`,
          },
          summary: {
            en: `"${hw.title}" needs to be submitted by ${dueDate.toLocaleDateString("en-IN")}.`,
            hi: `"${hw.title}" को ${dueDate.toLocaleDateString("en-IN")} तक जमा करना होगा।`,
          },
          payload: {
            homeworkId: hw.id,
            title: hw.title,
            subjectName: hw.subjectName,
            dueDate: hw.dueDate,
            isGraded: false,
          },
          activatedAt: now,
          expiresAt: dueDate,
        });
      }

      // Recently graded homework (in last 24h)
      if (hw.submission?.grade) {
        const gradedAtDate = hw.submission.submittedAt ? new Date(hw.submission.submittedAt) : now;
        if (nowMs - gradedAtDate.getTime() <= 24 * 3600000) {
          cards.push({
            id: `homework-graded-${hw.id}`,
            studentId,
            cardType: "HomeworkCard",
            tier: "T2_informational",
            priority: 65,
            title: {
              en: `${hw.subjectName} Graded: Grade ${hw.submission.grade}`,
              hi: `${hw.subjectName} मूल्यांकित: ग्रेड ${hw.submission.grade}`,
            },
            summary: {
              en: `"${hw.title}" graded: ${hw.submission.grade}.${hw.submission.feedback ? ` "${hw.submission.feedback}"` : ""}`,
              hi: `"${hw.title}" का मूल्यांकन: ग्रेड ${hw.submission.grade} मिला।`,
            },
            payload: {
              homeworkId: hw.id,
              title: hw.title,
              subjectName: hw.subjectName,
              grade: hw.submission.grade,
              feedback: hw.submission.feedback || null,
              isGraded: true,
            },
            activatedAt: gradedAtDate,
            expiresAt: new Date(gradedAtDate.getTime() + 24 * 3600000),
          });
        }
      }
    }
  }

  // ─── 5. ReportCardCard ─────────────────────────────────────────────────────
  if (snapshot.reportCards && snapshot.reportCards.length > 0) {
    for (const rc of snapshot.reportCards) {
      // Unviewed published report cards
      if (!rc.viewedAt) {
        const pubDate = new Date(rc.publishedAt);
        const scoreDelta =
          rc.previousAverageScore !== null && rc.previousAverageScore !== undefined
            ? Math.round(rc.averageScore - rc.previousAverageScore)
            : null;

        cards.push({
          id: `report-card-${rc.id}`,
          studentId,
          cardType: "ReportCardCard",
          tier: "T2_informational",
          priority: 85, // Prominent card!
          title: {
            en: `${rc.termName} Report Card is Ready`,
            hi: `${rc.termName} का रिपोर्ट कार्ड तैयार है`,
          },
          summary: {
            en: `Class average: ${rc.averageScore}%.${scoreDelta !== null ? ` ${scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}% from last term.` : ""}`,
            hi: `औसत अंक: ${rc.averageScore}%. रिपोर्ट कार्ड देखने के लिए टैप करें।`,
          },
          payload: {
            reportCardId: rc.id,
            termName: rc.termName,
            averageScore: rc.averageScore,
            scoreDelta,
            publishedAt: rc.publishedAt,
          },
          activatedAt: pubDate,
          expiresAt: new Date(pubDate.getTime() + 7 * 86400000), // Active for 7 days until viewed
        });
      }
    }
  }

  // ─── 6. PTMCard ────────────────────────────────────────────────────────────
  if (snapshot.upcomingEvents && snapshot.upcomingEvents.length > 0) {
    for (const ev of snapshot.upcomingEvents) {
      if (ev.eventType === "PTM") {
        const startDate = new Date(ev.startDate);
        const diffMs = startDate.getTime() - nowMs;
        const daysUntil = Math.ceil(diffMs / 86400000);

        if (diffMs > 0 && daysUntil <= 7) {
          cards.push({
            id: `ptm-${ev.id}`,
            studentId,
            cardType: "PTMCard",
            tier: "T2_informational",
            priority: 70,
            title: {
              en: daysUntil === 1 ? "Parent-Teacher Meeting Tomorrow" : `PTM in ${daysUntil} Days`,
              hi: daysUntil === 1 ? "कल अभिभावक-शिक्षक बैठक है" : `${daysUntil} दिनों में पीटीएम है`,
            },
            summary: {
              en: `${ev.title} on ${startDate.toLocaleDateString("en-IN")}${ev.venue ? ` at ${ev.venue}` : ""}.`,
              hi: `${startDate.toLocaleDateString("en-IN")} को ${ev.title} आयोजित है।`,
            },
            payload: {
              eventId: ev.id,
              title: ev.title,
              startDate: ev.startDate,
              venue: ev.venue || null,
            },
            activatedAt: now,
            expiresAt: new Date(startDate.getTime() + 6 * 3600000),
          });
        }
      }
    }
  }

  // ─── 7. NoticeCard ─────────────────────────────────────────────────────────
  if (snapshot.notices && snapshot.notices.length > 0) {
    for (const notif of snapshot.notices) {
      const pubDate = new Date(notif.publishedAt);
      const isWithin72h = nowMs - pubDate.getTime() <= 72 * 3600000;
      const isNotExpired = !notif.expiresAt || new Date(notif.expiresAt).getTime() > nowMs;

      if ((notif.isPinned || isWithin72h) && isNotExpired) {
        cards.push({
          id: `notice-${notif.id}`,
          studentId,
          cardType: "NoticeCard",
          tier: "T2_informational",
          priority: notif.isPinned ? 65 : 50,
          title: {
            en: notif.title,
            hi: notif.title,
          },
          summary: {
            en: notif.contentPreview,
            hi: notif.contentPreview,
          },
          payload: {
            noticeId: notif.id,
            isPinned: notif.isPinned,
            publishedAt: notif.publishedAt,
          },
          activatedAt: pubDate,
          expiresAt: notif.expiresAt ? new Date(notif.expiresAt) : new Date(pubDate.getTime() + 72 * 3600000),
        });
      }
    }
  }

  // ─── 8. ConsentCard ────────────────────────────────────────────────────────
  if (snapshot.pendingConsents && snapshot.pendingConsents.length > 0) {
    for (const consent of snapshot.pendingConsents) {
      const deadline = consent.deadline ? new Date(consent.deadline) : null;
      const isUrgent = deadline && deadline.getTime() - nowMs <= 48 * 3600000;

      cards.push({
        id: `consent-${consent.id}`,
        studentId,
        cardType: "ConsentCard",
        tier: isUrgent ? "T1_action_required" : "T2_informational",
        priority: isUrgent ? 88 : 55,
        title: {
          en: "Data Privacy Consent Required",
          hi: "डेटा गोपनीयता सहमति आवश्यक",
        },
        summary: {
          en: `Action needed: "${consent.title}" requires your consent under DPDP.`,
          hi: `आवश्यक कार्रवाई: "${consent.title}" पर आपकी सहमति अपेक्षित है।`,
        },
        payload: {
          consentId: consent.id,
          title: consent.title,
          deadline: consent.deadline || null,
        },
        activatedAt: now,
        expiresAt: deadline || new Date(nowMs + 7 * 86400000),
      });
    }
  }

  // ─── 9. InsightCard ────────────────────────────────────────────────────────
  if (snapshot.insights && snapshot.insights.length > 0) {
    for (const insight of snapshot.insights) {
      cards.push({
        id: `insight-${insight.id}`,
        studentId,
        cardType: "InsightCard",
        tier: insight.severity === "ROSE" ? "T1_action_required" : "T2_informational",
        priority: insight.severity === "ROSE" ? 82 : 62,
        title: {
          en: insight.model === "attendance_risk" ? "Attendance Trend" : "Academic Insight",
          hi: insight.model === "attendance_risk" ? "उपस्थिति रुझान" : "शैक्षणिक अंतर्दृष्टि",
        },
        summary: insight.finding,
        payload: {
          insightId: insight.id,
          model: insight.model,
          severity: insight.severity,
          actionLink: insight.actionLink || null,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 7 * 86400000),
      });
    }
  }

  // ─── 10. MessageCard ───────────────────────────────────────────────────────
  if (snapshot.unreadMessages && snapshot.unreadMessages.length > 0) {
    for (const msg of snapshot.unreadMessages) {
      const sentDate = new Date(msg.sentAt);
      if (nowMs - sentDate.getTime() <= 7 * 86400000) {
        cards.push({
          id: `message-${msg.threadId}`,
          studentId,
          cardType: "MessageCard",
          tier: "T2_informational",
          priority: 72,
          title: {
            en: `Message from ${msg.teacherName}`,
            hi: `${msg.teacherName} का संदेश`,
          },
          summary: {
            en: msg.lastMessagePreview,
            hi: msg.lastMessagePreview,
          },
          payload: {
            threadId: msg.threadId,
            teacherName: msg.teacherName,
            teacherAvatar: msg.teacherAvatar || null,
            sentAt: msg.sentAt,
          },
          activatedAt: sentDate,
          expiresAt: new Date(sentDate.getTime() + 7 * 86400000),
        });
      }
    }
  }

  // ─── Time-of-Day Choreography & Sorting ────────────────────────────────────
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isMorning = currentHour >= 6.5 && currentHour < 9.5;
  const isEvening = currentHour >= 17.0 && currentHour < 21.5;

  return cards.sort((a, b) => {
    // 1. In the morning, BusLiveCard and AttendanceCard take top precedence
    if (isMorning) {
      if (a.cardType === "BusLiveCard" && b.cardType !== "BusLiveCard") return -1;
      if (b.cardType === "BusLiveCard" && a.cardType !== "BusLiveCard") return 1;
      if (a.cardType === "AttendanceCard" && b.cardType !== "AttendanceCard") return -1;
      if (b.cardType === "AttendanceCard" && a.cardType !== "AttendanceCard") return 1;
    }

    // 2. In the evening, Homework due tomorrow, Payment, and ReportCard take precedence
    if (isEvening) {
      const eveningFavored = (type: CardType) =>
        type === "HomeworkCard" || type === "PaymentCard" || type === "ReportCardCard";
      if (eveningFavored(a.cardType) && !eveningFavored(b.cardType)) return -1;
      if (!eveningFavored(a.cardType) && eveningFavored(b.cardType)) return 1;
    }

    // 3. Tier precedence: T1 (Action Required) > T2 (Informational) > T3 (System State)
    const tierWeight: Record<CardTier, number> = {
      T1_action_required: 3,
      T2_informational: 2,
      T3_system_state: 1,
    };
    if (tierWeight[a.tier] !== tierWeight[b.tier]) {
      return tierWeight[b.tier] - tierWeight[a.tier];
    }

    // 4. Priority number (higher first)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    // 5. Recency (newest activatedAt first)
    return b.activatedAt.getTime() - a.activatedAt.getTime();
  });
}
