import {
  CardTier,
  CardType,
  DerivedFeedCard,
  ParentDataSnapshot,
} from "./types";
import { computeBusTracking } from "./busEta";
import { checkAbsentButBoarded, checkMissedBoarding } from "./busBoardingEngine";
import {
  aggregatePendingConsents,
  evaluateDocumentExpiry,
  formatProfileChangeSummary,
} from "./documentProfileEngine";

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
  snapshot: ParentDataSnapshot,
  options?: { wardName?: string | undefined }
): DerivedFeedCard[] {
  if (!studentId || !studentId.trim()) {
    throw new Error("studentId is required to derive parent feed");
  }

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
    const hasApprovedLeaveToday =
      Boolean(snapshot.activeLeaveApproved) ||
      Boolean(
        snapshot.leaveRequests?.some(
          (lr) =>
            lr.status === "APPROVED" &&
            new Date(lr.startDate).getTime() <= nowMs &&
            new Date(lr.endDate).getTime() + 86400000 >= nowMs
        )
      );

    // AC-P16: Leave approval suppresses the day-of absence T1 alert
    if (att.status === "ABSENT" && hasApprovedLeaveToday) {
      // Suppressed: student has approved planned leave for today
    } else if (att.status === "ABSENT" || att.status === "LATE" || att.status === "HALF_DAY" || att.status === "LEAVE") {
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

      // Derive tracking using pure ETA engine
      const tracking = computeBusTracking(
        latestPing || null,
        routeStops,
        busPass.stopId,
        now
      );

      const isApproaching = tracking.isApproaching;
      const stopsAway = tracking.stopsAway;
      const nearestStopName = tracking.studentStop?.name || busPass.stopName || "Your stop";

      let cardTitleEn = "School Bus is En Route";
      let cardTitleHi = "स्कूल बस रास्ते में है";

      if (tracking.lifecycleState === "ARRIVED") {
        cardTitleEn = `School Bus arrived at ${nearestStopName}`;
        cardTitleHi = `स्कूल बस ${nearestStopName} पर पहुँच गई है`;
      } else if (tracking.lifecycleState === "APPROACHING" && stopsAway > 0) {
        cardTitleEn = `School Bus is ${stopsAway} stop${stopsAway > 1 ? "s" : ""} away`;
        cardTitleHi = `स्कूल बस ${stopsAway} स्टॉप दूर है`;
      }

      cards.push({
        id: `bus-live-${busPass.routeId}`,
        studentId,
        cardType: "BusLiveCard",
        tier: isApproaching ? "T1_action_required" : "T2_informational",
        priority: 100, // Pinned top during commute window!
        title: {
          en: cardTitleEn,
          hi: cardTitleHi,
        },
        summary: tracking.summaryText,
        payload: {
          routeId: busPass.routeId,
          routeName: busPass.routeName || "Route",
          stopId: busPass.stopId,
          stopName: nearestStopName,
          stopsAway,
          isApproaching,
          lifecycleState: tracking.lifecycleState,
          etaMinutes: tracking.etaMinutes,
          estimatedArrival: tracking.estimatedArrivalFormatted,
          vehiclePing: latestPing || null,
          stopCoords: busPass.stopCoords || (tracking.studentStop ? { lat: tracking.studentStop.lat, lng: tracking.studentStop.lng } : null),
          routeStops,
          distanceMeters: tracking.distanceToStudentStopMeters,
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
          const hasActiveBooking = ev.booking && ev.booking.status === "BOOKED";
          const slotStart = hasActiveBooking ? new Date(ev.booking!.startAt) : null;
          const diffSlotMs = slotStart ? slotStart.getTime() - nowMs : null;
          const isWithin2h = diffSlotMs !== null && diffSlotMs > 0 && diffSlotMs <= 2 * 3600000;

          let tier: CardTier = "T2_informational";
          let priority = 70;
          let titleEn = daysUntil === 1 ? "Parent-Teacher Meeting Tomorrow" : `PTM in ${daysUntil} Days`;
          let titleHi = daysUntil === 1 ? "कल अभिभावक-शिक्षक बैठक है" : `${daysUntil} दिनों में पीटीएम है`;
          let summaryEn = `${ev.title} on ${startDate.toLocaleDateString("en-IN")}${ev.venue ? ` at ${ev.venue}` : ""}.`;
          let summaryHi = `${startDate.toLocaleDateString("en-IN")} को ${ev.title} आयोजित है।`;

          if (hasActiveBooking && slotStart) {
            const timeStr = slotStart.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
            const teacherName = ev.booking!.teacherName || "Class Teacher";

            if (isWithin2h) {
              tier = "T1_action_required"; // PTM_IN_2H notification matrix tier!
              priority = 90;
              const mins = Math.max(1, Math.round(diffSlotMs! / 60000));
              titleEn = `PTM Meeting in ${mins} Minutes`;
              titleHi = `पीटीएम बैठक ${mins} मिनट में शुरू होगी`;
              summaryEn = `Your slot is confirmed with ${teacherName} at ${timeStr}${ev.venue ? ` at ${ev.venue}` : ""}.`;
              summaryHi = `${teacherName} के साथ आपका समय ${timeStr} बजे तय है${ev.venue ? ` (${ev.venue})` : ""}।`;
            } else if (daysUntil === 1) {
              priority = 75; // PTM_TOMORROW
              titleEn = `PTM Tomorrow at ${timeStr}`;
              titleHi = `कल ${timeStr} बजे पीटीएम बैठक है`;
              summaryEn = `Slot booked with ${teacherName}${ev.venue ? ` at ${ev.venue}` : ""}.`;
              summaryHi = `${teacherName} के साथ स्लॉट बुक है${ev.venue ? ` (${ev.venue})` : ""}।`;
            } else {
              priority = 70;
              titleEn = `PTM Slot Booked: ${timeStr}`;
              titleHi = `पीटीएम स्लॉट बुक: ${timeStr}`;
              summaryEn = `Slot confirmed with ${teacherName} on ${startDate.toLocaleDateString("en-IN")}${ev.venue ? ` at ${ev.venue}` : ""}.`;
              summaryHi = `${teacherName} के साथ ${startDate.toLocaleDateString("en-IN")} को समय तय है${ev.venue ? ` (${ev.venue})` : ""}।`;
            }
          } else if (ev.bookingWindow?.isOpen && ev.ptmEventId) {
            titleEn = daysUntil === 1 ? "PTM Tomorrow — Book Your Slot" : `PTM in ${daysUntil} Days — Book Your Slot`;
            titleHi = daysUntil === 1 ? "कल पीटीएम है — अपना स्लॉट बुक करें" : `${daysUntil} दिनों में पीटीएम — अपना स्लॉट बुक करें`;
            summaryEn = `Slot booking is now open for ${ev.title}${ev.venue ? ` at ${ev.venue}` : ""}. Select a 10-minute slot.`;
            summaryHi = `${ev.title} के लिए स्लॉट बुकिंग खुली है। अपना 10 मिनट का स्लॉट चुनें।`;
          }

          cards.push({
            id: `ptm-${ev.id}`,
            studentId,
            cardType: "PTMCard",
            tier,
            priority,
            title: {
              en: titleEn,
              hi: titleHi,
            },
            summary: {
              en: summaryEn,
              hi: summaryHi,
            },
            payload: {
              eventId: ev.id,
              ptmEventId: ev.ptmEventId || null,
              title: ev.title,
              startDate: ev.startDate,
              endDate: ev.endDate || null,
              venue: ev.venue || null,
              daysUntil,
              booking: ev.booking || null,
              canBook: Boolean(ev.ptmEventId && ev.bookingWindow?.isOpen && !hasActiveBooking),
              bookingWindow: ev.bookingWindow || null,
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
        // Elevated priority for unacknowledged mandatory notices
        const isPendingAck = notif.requiresAcknowledgment && !notif.acknowledgedAt;
        const priority = notif.isPinned ? 70 : isPendingAck ? 60 : 50;

        cards.push({
          id: `notice-${notif.id}`,
          studentId,
          cardType: "NoticeCard",
          tier: "T2_informational",
          priority,
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
            requiresAcknowledgment: Boolean(notif.requiresAcknowledgment),
            acknowledgedAt: notif.acknowledgedAt || null,
          },
          activatedAt: pubDate,
          expiresAt: notif.expiresAt ? new Date(notif.expiresAt) : new Date(pubDate.getTime() + 72 * 3600000),
        });
      }
    }
  }

  // ─── 8. ConsentCard (Aggregated DPDP Checklist, OP11) ───────────────────────
  if (snapshot.pendingConsents && snapshot.pendingConsents.length > 0) {
    const agg = aggregatePendingConsents(snapshot.pendingConsents, now);
    if (agg.totalPending > 0) {
      const earliestDeadline = agg.items
        .map((i) => (i.deadline ? new Date(i.deadline).getTime() : Infinity))
        .reduce((min, d) => Math.min(min, d), Infinity);

      const expiresAt =
        earliestDeadline !== Infinity
          ? new Date(earliestDeadline)
          : new Date(nowMs + 7 * 86400000);

      cards.push({
        id: `consent-checklist-${studentId}`,
        studentId,
        cardType: "ConsentCard",
        tier: agg.feedTier,
        priority: agg.priority,
        title: {
          en: agg.hasUrgent
            ? "Action Required: Privacy Consents Pending"
            : "Data Privacy Consents",
          hi: agg.hasUrgent
            ? "आवश्यक कार्रवाई: डेटा गोपनीयता सहमति लंबित"
            : "डेटा गोपनीयता सहमति",
        },
        summary: {
          en: `${agg.totalPending} consent request${agg.totalPending > 1 ? "s" : ""} awaiting your review under DPDP.`,
          hi: `डीपीडीपी के तहत ${agg.totalPending} सहमति अनुरोध आपकी समीक्षा हेतु लंबित हैं।`,
        },
        payload: {
          items: agg.items,
          totalPending: agg.totalPending,
          hasUrgent: agg.hasUrgent,
        },
        activatedAt: now,
        expiresAt,
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

  // ─── 11. Leave Request Cards (LeaveApprovedCard / LeaveRejectedCard) ─────────
  if (snapshot.leaveRequests && snapshot.leaveRequests.length > 0) {
    for (const lr of snapshot.leaveRequests) {
      const startD = new Date(lr.startDate);
      const endD = new Date(lr.endDate);
      const decidedD = lr.decidedAt ? new Date(lr.decidedAt) : null;
      const startMs = startD.getTime();
      const endMs = endD.getTime();
      const decidedMs = decidedD ? decidedD.getTime() : null;

      const dateRangeStr =
        startD.toISOString().slice(0, 10) === endD.toISOString().slice(0, 10)
          ? startD.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
          : `${startD.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${endD.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

      if (lr.status === "APPROVED") {
        // Active if approved in last 24h, active today, or upcoming in next 48h
        const isRecentApproval = decidedMs !== null && nowMs - decidedMs <= 24 * 3600000 && nowMs >= decidedMs;
        const isActiveToday = nowMs >= startMs - 86400000 && nowMs <= endMs + 86400000;
        const isUpcomingNear = startMs > nowMs && startMs - nowMs <= 48 * 3600000;

        if (isRecentApproval || isActiveToday || isUpcomingNear) {
          const endOfDay = new Date(endD);
          endOfDay.setHours(23, 59, 59, 999);
          const expiryDate = new Date(Math.max(endOfDay.getTime(), (decidedMs || nowMs) + 24 * 3600000));

          cards.push({
            id: `leave-approved-${lr.id}`,
            studentId,
            cardType: "LeaveApprovedCard",
            tier: "T2_informational",
            priority: 65,
            title: {
              en: `Leave Approved: ${dateRangeStr}`,
              hi: `अवकाश स्वीकृत: ${dateRangeStr}`,
            },
            summary: {
              en: `Leave request for ${studentName} was approved.${lr.decisionNote ? ` Note: "${lr.decisionNote}"` : " Attendance is marked as planned leave."}`,
              hi: `${studentName} का अवकाश अनुरोध स्वीकृत हो गया है।${lr.decisionNote ? ` टिप्पणी: "${lr.decisionNote}"` : " उपस्थिति को नियोजित अवकाश के रूप में दर्ज किया गया है।"}`,
            },
            payload: {
              leaveRequestId: lr.id,
              leaveType: lr.leaveType,
              startDate: lr.startDate,
              endDate: lr.endDate,
              reason: lr.reason,
              decisionNote: lr.decisionNote || null,
              teacherName: lr.teacherName || null,
              dateRangeStr,
            },
            activatedAt: decidedD || startD,
            expiresAt: expiryDate,
          });
        }
      } else if (lr.status === "REJECTED") {
        // Show rejected notice for 48h after decision
        const isRecentRejection = decidedMs !== null && nowMs - decidedMs <= 48 * 3600000 && nowMs >= decidedMs;

        if (isRecentRejection) {
          cards.push({
            id: `leave-rejected-${lr.id}`,
            studentId,
            cardType: "LeaveRejectedCard",
            tier: "T2_informational",
            priority: 70,
            title: {
              en: `Leave Request Declined: ${dateRangeStr}`,
              hi: `अवकाश अनुरोध अस्वीकृत: ${dateRangeStr}`,
            },
            summary: {
              en: `Leave for ${studentName} was declined.${lr.decisionNote ? ` Reason: "${lr.decisionNote}"` : ""}`,
              hi: `${studentName} का अवकाश अनुरोध अस्वीकृत कर दिया गया।${lr.decisionNote ? ` कारण: "${lr.decisionNote}"` : ""}`,
            },
            payload: {
              leaveRequestId: lr.id,
              leaveType: lr.leaveType,
              startDate: lr.startDate,
              endDate: lr.endDate,
              reason: lr.reason,
              decisionNote: lr.decisionNote || null,
              teacherName: lr.teacherName || null,
              dateRangeStr,
            },
            activatedAt: decidedD || now,
            expiresAt: new Date((decidedMs || nowMs) + 48 * 3600000),
          });
        }
      }
    }
  }

  // ─── 13. FeeQueryCard (Workflow OP2 & Phase P12) ───────────────────────────
  if (snapshot.feeQueries && snapshot.feeQueries.length > 0) {
    for (const fq of snapshot.feeQueries) {
      const createdDate = new Date(fq.createdAt);
      const createdMs = createdDate.getTime();
      const termName = fq.termName || "School Fee";

      if (fq.status === "ANSWERED") {
        const answeredDate = fq.answeredAt ? new Date(fq.answeredAt) : now;
        const answeredMs = answeredDate.getTime();
        // Show answered query for up to 72 hours if not resolved
        if (nowMs - answeredMs <= 72 * 3600000 && nowMs >= answeredMs) {
          const answerSnippet = fq.answer
            ? fq.answer.length > 90
              ? `${fq.answer.slice(0, 90)}...`
              : fq.answer
            : "The school has responded to your fee inquiry.";

          cards.push({
            id: `fee-query-answered-${fq.id}`,
            studentId,
            cardType: "FeeQueryCard",
            tier: "T2_informational",
            priority: 75,
            title: {
              en: `Fee Query Answered: ${termName}`,
              hi: `शुल्क प्रश्न का उत्तर दिया गया: ${termName}`,
            },
            summary: {
              en: `${answerSnippet} Tap to confirm resolution or escalate.`,
              hi: `${answerSnippet} समाधान की पुष्टि करने या आगे बढ़ाने के लिए टैप करें।`,
            },
            payload: {
              queryId: fq.id,
              invoiceId: fq.invoiceId,
              category: fq.category,
              status: fq.status,
              message: fq.message,
              answer: fq.answer,
              answeredAt: fq.answeredAt,
              answeredByName: fq.answeredByName,
              termName,
            },
            activatedAt: answeredDate,
            expiresAt: new Date(answeredMs + 72 * 3600000),
          });
        }
      } else if (fq.status === "OPEN") {
        // Query is under active review (48h SLA)
        // Show card while open (up to 7 days before auto-escalation)
        if (nowMs - createdMs <= 7 * 86400000 && nowMs >= createdMs) {
          const hoursElapsed = Math.floor((nowMs - createdMs) / 3600000);
          cards.push({
            id: `fee-query-open-${fq.id}`,
            studentId,
            cardType: "FeeQueryCard",
            tier: "T2_informational",
            priority: 40,
            title: {
              en: `Fee Query Under Review: ${termName}`,
              hi: `शुल्क प्रश्न समीक्षाधीन: ${termName}`,
            },
            summary: {
              en: `Your query regarding ${termName} is being reviewed. Typical response: 2 days.`,
              hi: `${termName} से संबंधित आपका प्रश्न विचाराधीन है। सामान्य प्रतिक्रिया: 2 दिन।`,
            },
            payload: {
              queryId: fq.id,
              invoiceId: fq.invoiceId,
              category: fq.category,
              status: fq.status,
              message: fq.message,
              hoursElapsed,
              termName,
            },
            activatedAt: createdDate,
            expiresAt: new Date(createdMs + 7 * 86400000),
          });
        }
      } else if (fq.status === "ESCALATED") {
        const escalatedDate = fq.escalatedAt ? new Date(fq.escalatedAt) : now;
        const escalatedMs = escalatedDate.getTime();
        if (nowMs - escalatedMs <= 72 * 3600000 && nowMs >= escalatedMs) {
          cards.push({
            id: `fee-query-escalated-${fq.id}`,
            studentId,
            cardType: "FeeQueryCard",
            tier: "T2_informational",
            priority: 70,
            title: {
              en: `Fee Query Escalated: ${termName}`,
              hi: `शुल्क प्रश्न प्रधानाचार्य को भेजा गया: ${termName}`,
            },
            summary: {
              en: `Your fee query has been escalated to the Principal for resolution.`,
              hi: `आपका शुल्क प्रश्न समाधान के लिए प्रधानाचार्य को भेज दिया गया है।`,
            },
            payload: {
              queryId: fq.id,
              invoiceId: fq.invoiceId,
              category: fq.category,
              status: fq.status,
              message: fq.message,
              escalatedAt: fq.escalatedAt,
              termName,
            },
            activatedAt: escalatedDate,
            expiresAt: new Date(escalatedMs + 72 * 3600000),
          });
        }
      }
    }
  }

  // ─── 13. WeeklyDigestCard (Spec v1.2 Phase P13, AC-P23, OP12) ─────────────────
  if (snapshot.weeklyDigest) {
    const digest = snapshot.weeklyDigest;
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ...
    const hour = now.getHours();
    // Active window: Monday 08:00 local time through Tuesday 23:59 (approx 40-hour TTL)
    const isMondayFrom8am = dayOfWeek === 1 && hour >= 8;
    const isTuesday = dayOfWeek === 2;

    if (isMondayFrom8am || isTuesday) {
      // Calculate Tuesday 23:59:59 expiration date
      const expiresAt = new Date(now);
      if (dayOfWeek === 1) {
        expiresAt.setDate(expiresAt.getDate() + 1);
      }
      expiresAt.setHours(23, 59, 59, 999);

      // Activated at Monday 08:00
      const activatedAt = new Date(now);
      if (dayOfWeek === 2) {
        activatedAt.setDate(activatedAt.getDate() - 1);
      }
      activatedAt.setHours(8, 0, 0, 0);

      const feeStatusTextEn =
        digest.feesStatus === "UP_TO_DATE"
          ? "All dues clear"
          : digest.feesStatus === "DUE_SOON"
          ? `Fees due soon${digest.balanceAmount ? ` (₹${digest.balanceAmount.toLocaleString("en-IN")})` : ""}`
          : `Fees overdue${digest.balanceAmount ? ` (₹${digest.balanceAmount.toLocaleString("en-IN")})` : ""}`;

      const feeStatusTextHi =
        digest.feesStatus === "UP_TO_DATE"
          ? "सभी शुल्क चुकता"
          : digest.feesStatus === "DUE_SOON"
          ? `शुल्क जल्द देय${digest.balanceAmount ? ` (₹${digest.balanceAmount.toLocaleString("en-IN")})` : ""}`
          : `शुल्क अतिदेय${digest.balanceAmount ? ` (₹${digest.balanceAmount.toLocaleString("en-IN")})` : ""}`;

      cards.push({
        id: `weekly-digest-${studentId}`,
        studentId,
        cardType: "WeeklyDigestCard",
        tier: "T2_informational",
        priority: 55,
        title: {
          en: `Weekly Snapshot: ${digest.weekLabel}`,
          hi: `साप्ताहिक सारांश: ${digest.weekLabel}`,
        },
        summary: {
          en: `${digest.attendanceDays}/${digest.totalSchoolDays} school days present • ${digest.homeworkGradedCount} assignments graded • ${feeStatusTextEn}`,
          hi: `${digest.attendanceDays}/${digest.totalSchoolDays} दिन उपस्थिति • ${digest.homeworkGradedCount} कार्य जांचे गए • ${feeStatusTextHi}`,
        },
        payload: {
          weekLabel: digest.weekLabel,
          attendanceDays: digest.attendanceDays,
          totalSchoolDays: digest.totalSchoolDays,
          homeworkGradedCount: digest.homeworkGradedCount,
          feesStatus: digest.feesStatus,
          balanceAmount: digest.balanceAmount,
          upcomingEventsCount: digest.upcomingEventsCount,
          upcomingEventSummary: digest.upcomingEventSummary,
        },
        activatedAt,
        expiresAt,
      });
    }
  }

  // ─── 14. BusBoardingCard (OP9) ─────────────────────────────────────────────
  if (snapshot.busBoardingEvents && snapshot.busBoardingEvents.length > 0) {
    for (const evt of snapshot.busBoardingEvents) {
      const scanDate = typeof evt.scannedAt === "string" ? new Date(evt.scannedAt) : evt.scannedAt;
      const ageHours = (nowMs - scanDate.getTime()) / 3600000;
      // Active for 2 hours post-scan
      if (ageHours >= 0 && ageHours <= 2) {
        const timeStr = scanDate.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        const isBoarding = evt.direction === "BOARDING";
        const studentName = snapshot.studentName || "Your child";

        cards.push({
          id: `bus-boarding-${evt.id}`,
          studentId,
          cardType: "BusBoardingCard",
          tier: "T2_informational",
          priority: 80,
          title: {
            en: isBoarding ? `${studentName} Boarded the Bus` : `${studentName} Alighted from Bus`,
            hi: isBoarding ? `${studentName} बस में सवार हुए` : `${studentName} बस से उतर गए`,
          },
          summary: {
            en: isBoarding
              ? `Safely boarded at ${timeStr}${evt.stopName ? ` (${evt.stopName})` : ""}`
              : `Safely alighted at ${timeStr}${evt.stopName ? ` (${evt.stopName})` : ""}`,
            hi: isBoarding
              ? `${timeStr} पर सुरक्षित सवार हुए${evt.stopName ? ` (${evt.stopName})` : ""}`
              : `${timeStr} पर सुरक्षित पहुंचे${evt.stopName ? ` (${evt.stopName})` : ""}`,
          },
          payload: {
            id: evt.id,
            direction: evt.direction,
            scannedAt: scanDate.toISOString(),
            stopName: evt.stopName,
            routeName: evt.routeName,
            vehicleNumber: evt.vehicleNumber,
          },
          activatedAt: scanDate,
          expiresAt: new Date(scanDate.getTime() + 2 * 3600000),
        });
      }
    }
  }

  // ─── 15. BusAlertCard: Cross-Check Alerts (OP9, AC-P19) ─────────────────────
  // 15A. Absent-But-Boarded: Student marked ABSENT in attendance, but has a BOARDING event today
  if (snapshot.attendanceToday?.status === "ABSENT" && snapshot.busBoardingEvents) {
    const abbResult = checkAbsentButBoarded(
      studentId,
      snapshot.studentName || "Your child",
      snapshot.attendanceToday.status,
      snapshot.busBoardingEvents
    );

    if (abbResult.triggered) {
      cards.push({
        id: `bus-alert-absent-boarded-${studentId}`,
        studentId,
        cardType: "BusAlertCard",
        tier: "T1_action_required",
        priority: 95,
        title: {
          en: "Attendance & Commute Mismatch",
          hi: "उपस्थिति और बस यात्रा में विसंगति",
        },
        summary: {
          en: abbResult.body || "Boarded the school bus today but marked absent in classroom.",
          hi: "आज बस में सवार हुए किंतु कक्षा में अनुपस्थित दर्ज हैं।",
        },
        payload: {
          alertKind: "ABSENT_BUT_BOARDED",
          boardingTime: abbResult.boardingTime,
          attendanceStatus: "ABSENT",
        },
        activatedAt: now,
        expiresAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0),
      });
    }
  }

  // 15B. Missed-Boarding: Active pass, morning commute, past stop ETA + 15m, no boarding scan
  if (snapshot.busPass?.isActive && snapshot.scheduledStopMinutes !== undefined) {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isMorningWindow = currentMins >= 6 * 60 + 30 && currentMins <= 9 * 60; // 06:30 - 09:00

    if (isMorningWindow) {
      const mbResult = checkMissedBoarding(
        studentId,
        snapshot.studentName || "Your child",
        snapshot.busPass.isActive,
        snapshot.scheduledStopMinutes,
        currentMins,
        snapshot.busBoardingEvents || []
      );

      if (mbResult.triggered) {
        cards.push({
          id: `bus-alert-missed-boarding-${studentId}`,
          studentId,
          cardType: "BusAlertCard",
          tier: "T1_action_required",
          priority: 85,
          title: {
            en: "Bus Boarding Notice",
            hi: "बस बोर्डिंग सूचना",
          },
          summary: {
            en: mbResult.body || "Morning bus passed stop with no scan recorded.",
            hi: "बस निर्धारित स्टॉप से आगे निकल चुकी है किंतु बोर्डिंग स्कैन दर्ज नहीं हुआ।",
          },
          payload: {
            alertKind: "MISSED_BOARDING",
            scheduledStopMinutes: snapshot.scheduledStopMinutes,
          },
          activatedAt: now,
          expiresAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
        });
      }
    }
  }

  // ─── 16. StopChangeCard (OP5) ──────────────────────────────────────────────
  if (snapshot.stopChangeRequests && snapshot.stopChangeRequests.length > 0) {
    for (const req of snapshot.stopChangeRequests) {
      const effectiveDate = req.effectiveDate ? new Date(req.effectiveDate) : null;
      const isApproved = req.status === "APPROVED";
      const isRejected = req.status === "REJECTED";

      const priority = isApproved ? 60 : isRejected ? 50 : 40;

      cards.push({
        id: `stop-change-${req.id}`,
        studentId,
        cardType: "StopChangeCard",
        tier: "T2_informational",
        priority,
        title: {
          en: isApproved
            ? "Bus Stop Change Approved"
            : isRejected
            ? "Stop Change Request Update"
            : "Bus Stop Change Requested",
          hi: isApproved
            ? "बस स्टॉप परिवर्तन स्वीकृत"
            : isRejected
            ? "स्टॉप परिवर्तन अनुरोध अपडेट"
            : "बस स्टॉप परिवर्तन अनुरोधित",
        },
        summary: {
          en: isApproved
            ? `New stop: ${req.requestedStopName}${effectiveDate ? ` (Effective: ${effectiveDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })})` : ""}`
            : isRejected
            ? `Request not approved${req.decisionNote ? `: ${req.decisionNote}` : ""}`
            : `Requested shift to ${req.requestedStopName}`,
          hi: isApproved
            ? `नया स्टॉप: ${req.requestedStopName}${effectiveDate ? ` (प्रभावी: ${effectiveDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })})` : ""}`
            : isRejected
            ? `अनुरोध स्वीकृत नहीं हुआ${req.decisionNote ? `: ${req.decisionNote}` : ""}`
            : `${req.requestedStopName} पर स्थानांतरण का अनुरोध`,
        },
        payload: {
          requestId: req.id,
          requestedStopName: req.requestedStopName,
          status: req.status,
          effectiveDate: req.effectiveDate,
          decisionNote: req.decisionNote,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 72 * 3600000),
      });
    }
  }

  // ─── 17. DocumentRequestCard (Workflow OP6, AC-P24) ───────────────────────
  if (snapshot.documentRequests && snapshot.documentRequests.length > 0) {
    for (const doc of snapshot.documentRequests) {
      // Zero-Clutter (AC-P1): Verified documents do NOT render on the home feed
      if (doc.status === "VERIFIED") continue;

      const expiryEval = evaluateDocumentExpiry(doc, now);
      const dueDate = doc.dueAt ? new Date(doc.dueAt) : null;
      const isDueSoon = dueDate !== null && dueDate.getTime() - nowMs <= 48 * 3600000;
      const isUrgent = isDueSoon || expiryEval.isExpired || doc.status === "REJECTED";

      const tier: CardTier = isUrgent ? "T1_action_required" : "T2_informational";
      const priority = isUrgent ? 85 : 58;

      let titleEn = `Document Requested: ${doc.title}`;
      let titleHi = `दस्तावेज़ आवश्यक: ${doc.title}`;
      let summaryEn = `Please upload the requested document${dueDate ? ` by ${dueDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}` : ""}.`;
      let summaryHi = `कृपया अनुरोधित दस्तावेज़ अपलोड करें${dueDate ? ` (${dueDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} तक)` : ""}।`;

      if (doc.status === "REJECTED") {
        titleEn = `Document Resubmission Required: ${doc.title}`;
        titleHi = `दस्तावेज़ पुनः अपलोड आवश्यक: ${doc.title}`;
        summaryEn = `Previous submission was not approved: ${doc.rejectionReason || "Please upload a clearer copy."}`;
        summaryHi = `पिछला दस्तावेज़ स्वीकृत नहीं हुआ: ${doc.rejectionReason || "कृपया स्पष्ट प्रति पुनः अपलोड करें।"}`;
      } else if (doc.status === "SUBMITTED") {
        titleEn = `Document Under Verification: ${doc.title}`;
        titleHi = `दस्तावेज़ सत्यापन प्रक्रिया में: ${doc.title}`;
        summaryEn = `Uploaded copy submitted for school review.`;
        summaryHi = `विद्यालय प्रशासन द्वारा सत्यापन प्रक्रिया में है।`;
      } else if (expiryEval.isExpired) {
        titleEn = `Document Expired: ${doc.title}`;
        titleHi = `दस्तावेज़ की वैधता समाप्त: ${doc.title}`;
        summaryEn = `Previous document has expired. Please submit a renewed copy.`;
        summaryHi = `दस्तावेज़ की अवधि समाप्त हो चुकी है। कृपया नवीनीकृत प्रति जमा करें।`;
      }

      cards.push({
        id: `doc-${doc.id}`,
        studentId,
        cardType: "DocumentRequestCard",
        tier,
        priority,
        title: {
          en: titleEn,
          hi: titleHi,
        },
        summary: {
          en: summaryEn,
          hi: summaryHi,
        },
        payload: {
          requestId: doc.id,
          title: doc.title,
          documentType: doc.documentType,
          status: doc.status,
          dueAt: doc.dueAt || null,
          expiresAt: doc.expiresAt || null,
          rejectionReason: doc.rejectionReason || null,
          fileName: doc.fileName || null,
          uploadedAt: doc.uploadedAt || null,
          isExpired: expiryEval.isExpired,
        },
        activatedAt: now,
        expiresAt: dueDate || new Date(nowMs + 7 * 86400000),
      });
    }
  }

  // ─── 18. ProfileChangeCard (Workflow OP10) ──────────────────────────────────
  if (snapshot.profileChanges && snapshot.profileChanges.length > 0) {
    for (const change of snapshot.profileChanges) {
      const summary = formatProfileChangeSummary(change, now);

      // Zero-Clutter (AC-P1): Once decided, only show for 48 hours
      if (change.status !== "PENDING" && !summary.isRecentDecision) {
        continue;
      }

      const isPending = change.status === "PENDING";
      const isApplied = change.status === "APPLIED";

      let titleEn = `Profile Change Pending: ${summary.fieldDisplay}`;
      let titleHi = `प्रोफ़ाइल परिवर्तन समीक्षाधीन: ${summary.fieldDisplay}`;

      if (isApplied) {
        titleEn = `Profile Update Approved: ${summary.fieldDisplay}`;
        titleHi = `प्रोफ़ाइल विवरण अपडेट स्वीकृत: ${summary.fieldDisplay}`;
      } else if (change.status === "REJECTED") {
        titleEn = `Profile Request Reviewed: ${summary.fieldDisplay}`;
        titleHi = `प्रोफ़ाइल अनुरोध की समीक्षा पूर्ण: ${summary.fieldDisplay}`;
      }

      cards.push({
        id: `profile-${change.id}`,
        studentId,
        cardType: "ProfileChangeCard",
        tier: "T2_informational",
        priority: isPending ? 52 : 40,
        title: {
          en: titleEn,
          hi: titleHi,
        },
        summary: {
          en: summary.summaryText,
          hi: summary.summaryText,
        },
        payload: {
          requestId: change.id,
          field: change.field,
          fieldDisplay: summary.fieldDisplay,
          status: change.status,
          diffItems: summary.diffItems,
          decisionReason: change.decisionReason || null,
          decidedAt: change.decidedAt || null,
        },
        activatedAt: now,
        expiresAt: new Date(nowMs + 48 * 3600000),
      });
    }
  }

  // ─── Time-of-Day Choreography & Sorting ────────────────────────────────────
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isMorning = currentHour >= 6.5 && currentHour < 9.5;
  const isEvening = currentHour >= 17.0 && currentHour < 21.5;

  const sorted = cards.sort((a, b) => {
    // 1. In the morning, BusAlertCard, BusLiveCard, and AttendanceCard take top precedence
    if (isMorning) {
      if (a.cardType === "BusAlertCard" && b.cardType !== "BusAlertCard") return -1;
      if (b.cardType === "BusAlertCard" && a.cardType !== "BusAlertCard") return 1;
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

  if (options?.wardName) {
    return sorted.map((c) => ({
      ...c,
      wardName: options.wardName,
    }));
  }

  return sorted;
}

/**
 * Merges feed cards across multiple wards (siblings) for multi-ward parent companion feed (AC-P21).
 *
 * Rules:
 * 1. Cards retain their ward identification via `wardName`.
 * 2. If the same card type fires for multiple wards (e.g. fees due or homework), both render with their ward chips.
 * 3. School-wide identical notices are consolidated into one card with multi-ward attribution.
 * 4. Cards are sorted respecting time-of-day choreography and tier priority (T1 > T2 > T3).
 */
export function mergeMultiWardFeeds(
  wardFeeds: Array<
    | {
        studentId?: string | undefined;
        wardName?: string | undefined;
        cards: DerivedFeedCard[];
      }
    | DerivedFeedCard[]
  >,
  now: Date = new Date()
): DerivedFeedCard[] {
  const merged: DerivedFeedCard[] = [];
  const seenNoticeIds = new Map<string, DerivedFeedCard>();

  for (const ward of wardFeeds) {
    const wardCards = Array.isArray(ward) ? ward : ward.cards;
    const fallbackWardName = Array.isArray(ward) ? "" : ward.wardName;

    for (const card of wardCards) {
      const wardName = card.wardName || fallbackWardName;
      const taggedCard: DerivedFeedCard = {
        ...card,
        wardName,
      };

      // Consolidate school-wide notices if identical across wards
      if (card.cardType === "NoticeCard" && (card.payload?.noticeId || card.id)) {
        const noticeKey = card.payload?.noticeId || card.id;
        const existing = seenNoticeIds.get(noticeKey);
        if (existing) {
          if (wardName && !existing.wardName?.includes(wardName)) {
            existing.wardName = existing.wardName ? `${existing.wardName}, ${wardName}` : wardName;
          }
          continue;
        }
        seenNoticeIds.set(noticeKey, taggedCard);
      }

      merged.push(taggedCard);
    }
  }

  // Reuse time-of-day sorting rules
  const hour = now.getHours();
  const isMorning = hour >= 6 && hour < 11;
  const isEvening = hour >= 16 && hour < 21;

  return merged.sort((a, b) => {
    // Top invariant: T1 Action Required comes first
    const tierWeight: Record<CardTier, number> = {
      T1_action_required: 3,
      T2_informational: 2,
      T3_system_state: 1,
    };
    if (tierWeight[a.tier] !== tierWeight[b.tier]) {
      return tierWeight[b.tier] - tierWeight[a.tier];
    }

    if (isMorning) {
      if (a.cardType === "BusAlertCard" && b.cardType !== "BusAlertCard") return -1;
      if (b.cardType === "BusAlertCard" && a.cardType !== "BusAlertCard") return 1;
      if (a.cardType === "BusLiveCard" && b.cardType !== "BusLiveCard") return -1;
      if (b.cardType === "BusLiveCard" && a.cardType !== "BusLiveCard") return 1;
      if (a.cardType === "AttendanceCard" && b.cardType !== "AttendanceCard") return -1;
      if (b.cardType === "AttendanceCard" && a.cardType !== "AttendanceCard") return 1;
    }

    if (isEvening) {
      const eveningFavored = (type: CardType) =>
        type === "HomeworkCard" || type === "PaymentCard" || type === "ReportCardCard";
      if (eveningFavored(a.cardType) && !eveningFavored(b.cardType)) return -1;
      if (!eveningFavored(a.cardType) && eveningFavored(b.cardType)) return 1;
    }

    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    return new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime();
  });
}
