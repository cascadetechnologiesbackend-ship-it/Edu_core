/**
 * Parent Signals & Explainable Analytics (Spec v1.0)
 *
 * Implements pure, explainable, rule-based analytics signals for the Parent PWA.
 * Strictly server-side, no ML dependencies, and no shame language (no "defaulter",
 * "risk score", or "churn"). Every number a parent sees is traceable to simple,
 * defendable rules.
 */

import type { InsightSnapshot, InvoiceSnapshot, HomeworkSnapshot } from "../parentEventEngine/types";

export interface AttendanceRecord {
  date: Date | string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
}

export interface AttendanceTrend30dResult {
  rate: number; // 0.0 to 1.0
  percentage: number; // 0 to 100
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  totalSchoolDays: number;
  sparkline: Array<{
    date: string;
    status: string;
    isAttended: boolean;
  }>;
}

export interface FeePaymentRecord {
  id: string;
  invoiceId: string;
  termName?: string | undefined;
  amount: number;
  paidAt: Date | string;
  paymentMethod: string;
  receiptNumber?: string | null | undefined;
  status: "PAID" | "ATTEMPTED" | "FAILED" | "REFUNDED";
}

export interface ReportCardRecord {
  id: string;
  termName: string;
  publishedAt: Date | string;
  subjectMarks: Record<string, number>; // e.g. { Mathematics: 78, Science: 85 }
  overallAverage?: number | undefined;
}

export interface SubjectMarksTrend {
  subject: string;
  previousScore: number;
  currentScore: number;
  delta: number; // current - previous
  trend: "up" | "down" | "neutral";
}

export interface MarksTrendResult {
  termName: string;
  previousTermName?: string | undefined;
  subjectTrends: SubjectMarksTrend[];
  overallAverageDelta?: number | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DESCRIPTIVE ANALYTICS (Pure Functions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descriptive Signal: attendance_trend_30d
 * Formula: (present + late days) / total school days in the last 30 days.
 * Excludes HOLIDAY from total school days.
 */
export function computeAttendanceTrend30d(
  records: AttendanceRecord[],
  referenceDate: Date = new Date()
): AttendanceTrend30dResult {
  const cutoff = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const relevant = records
    .filter((r) => {
      const d = new Date(r.date);
      return d >= cutoff && d <= referenceDate;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let totalSchoolDays = 0;

  const sparkline: AttendanceTrend30dResult["sparkline"] = [];

  for (const r of relevant) {
    if (r.status === "HOLIDAY") continue;

    totalSchoolDays++;
    const isAttended = r.status === "PRESENT" || r.status === "LATE";

    if (r.status === "PRESENT") presentDays++;
    else if (r.status === "LATE") lateDays++;
    else if (r.status === "ABSENT") absentDays++;
    else if (r.status === "LEAVE") leaveDays++;

    sparkline.push({
      date: new Date(r.date).toISOString().split("T")[0]!,
      status: r.status,
      isAttended,
    });
  }

  const attendedDays = presentDays + lateDays;
  const rate = totalSchoolDays > 0 ? attendedDays / totalSchoolDays : 1.0;
  const percentage = Math.round(rate * 100);

  return {
    rate,
    percentage,
    presentDays,
    lateDays,
    absentDays,
    leaveDays,
    totalSchoolDays,
    sparkline,
  };
}

/**
 * Descriptive Signal: fee_payment_history
 * Formats payments chronologically with status chips and clean labels.
 */
export function computeFeePaymentHistory(payments: FeePaymentRecord[]) {
  return [...payments]
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      termName: p.termName || "School Term",
      amountFormatted: `₹${p.amount.toLocaleString("en-IN")}`,
      amount: p.amount,
      paidAtFormatted: new Date(p.paidAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      paidAt: p.paidAt,
      paymentMethod: p.paymentMethod,
      receiptNumber: p.receiptNumber || null,
      status: p.status,
    }));
}

/**
 * Descriptive Signal: marks_trend
 * Compares subject scores between the latest 2 published report cards.
 */
export function computeMarksTrend(reports: ReportCardRecord[]): MarksTrendResult | null {
  if (reports.length === 0) return null;

  const sorted = [...reports].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const current = sorted[0]!;
  const previous = sorted[1];

  if (!previous) {
    // Only one report card published so far
    const subjectTrends: SubjectMarksTrend[] = Object.entries(current.subjectMarks).map(
      ([subject, score]) => ({
        subject,
        previousScore: score,
        currentScore: score,
        delta: 0,
        trend: "neutral",
      })
    );

    return {
      termName: current.termName,
      subjectTrends,
    };
  }

  const subjectTrends: SubjectMarksTrend[] = [];

  for (const [subject, currScore] of Object.entries(current.subjectMarks)) {
    const prevScore = previous.subjectMarks[subject] ?? currScore;
    const delta = currScore - prevScore;
    let trend: "up" | "down" | "neutral" = "neutral";
    if (delta > 0) trend = "up";
    else if (delta < 0) trend = "down";

    subjectTrends.push({
      subject,
      previousScore: prevScore,
      currentScore: currScore,
      delta,
      trend,
    });
  }

  let overallAverageDelta: number | undefined;
  if (current.overallAverage !== undefined && previous.overallAverage !== undefined) {
    overallAverageDelta = current.overallAverage - previous.overallAverage;
  }

  return {
    termName: current.termName,
    previousTermName: previous.termName,
    subjectTrends,
    overallAverageDelta,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PREDICTIVE ANALYTICS (Pure Rule-Based Functions)
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceRiskResult {
  triggered: boolean;
  metrics: {
    absentOrLeaveCount10d: number;
    rolling30dRate: number;
  };
  insight?: InsightSnapshot | undefined;
}

/**
 * Predictive Model: attendance_risk
 * Rule: absent/leave on 3+ of the last 10 school days OR rolling 30-day attendance below 85% (0.85).
 */
export function evalAttendanceRisk(
  records: AttendanceRecord[],
  referenceDate: Date = new Date(),
  studentName: string = "Child"
): AttendanceRiskResult {
  // Sort descending by date
  const schoolDays = records
    .filter((r) => r.status !== "HOLIDAY")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Last 10 school days
  const last10 = schoolDays.slice(0, 10);
  const absentOrLeaveCount10d = last10.filter(
    (r) => r.status === "ABSENT" || r.status === "LEAVE"
  ).length;

  // Rolling 30d trend
  const trend30d = computeAttendanceTrend30d(records, referenceDate);
  const rolling30dRate = trend30d.rate;

  const triggered = absentOrLeaveCount10d >= 3 || rolling30dRate < 0.85;

  if (!triggered) {
    return {
      triggered: false,
      metrics: {
        absentOrLeaveCount10d,
        rolling30dRate,
      },
    };
  }

  const findingEn =
    absentOrLeaveCount10d >= 3
      ? `${studentName} was absent or on leave for ${absentOrLeaveCount10d} of the last 10 school days`
      : `${studentName}'s attendance is at ${Math.round(rolling30dRate * 100)}% over the last 30 days (target: 85%)`;

  const findingHi =
    absentOrLeaveCount10d >= 3
      ? `${studentName} पिछले 10 स्कूल दिनों में से ${absentOrLeaveCount10d} दिन अनुपस्थित या अवकाश पर रहे`
      : `पिछले 30 दिनों में ${studentName} की उपस्थिति ${Math.round(rolling30dRate * 100)}% है (लक्ष्य: 85%)`;

  const insight: InsightSnapshot = {
    id: `insight-attendance-risk-${Date.now()}`,
    model: "attendance_risk",
    severity: "AMBER",
    finding: {
      en: findingEn,
      hi: findingHi,
    },
    actionLink: "/parent/attendance",
  };

  return {
    triggered: true,
    metrics: {
      absentOrLeaveCount10d,
      rolling30dRate,
    },
    insight,
  };
}

export interface PerformanceDipResult {
  triggered: boolean;
  dips: Array<{
    subject: string;
    previousScore: number;
    currentScore: number;
    drop: number;
  }>;
  insight?: InsightSnapshot | undefined;
}

/**
 * Predictive Model: performance_dip
 * Rule: latest published report card average or subject dropped more than 10 points vs the previous one.
 */
export function evalPerformanceDip(
  reports: ReportCardRecord[],
  studentName: string = "Child"
): PerformanceDipResult {
  if (reports.length < 2) {
    return { triggered: false, dips: [] };
  }

  const sorted = [...reports].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const current = sorted[0]!;
  const previous = sorted[1]!;

  const dips: PerformanceDipResult["dips"] = [];

  for (const [subject, currScore] of Object.entries(current.subjectMarks)) {
    const prevScore = previous.subjectMarks[subject];
    if (prevScore !== undefined) {
      const drop = prevScore - currScore;
      if (drop > 10) {
        dips.push({
          subject,
          previousScore: prevScore,
          currentScore: currScore,
          drop,
        });
      }
    }
  }

  if (dips.length === 0) {
    return { triggered: false, dips: [] };
  }

  // Sort by biggest drop
  dips.sort((a, b) => b.drop - a.drop);
  const primary = dips[0]!;

  const findingEn = `${primary.subject} dropped from ${primary.previousScore} to ${primary.currentScore} in ${current.termName}`;
  const findingHi = `${current.termName} में ${primary.subject} के अंक ${primary.previousScore} से गिरकर ${primary.currentScore} हो गए`;

  const insight: InsightSnapshot = {
    id: `insight-performance-dip-${Date.now()}`,
    model: "performance_dip",
    severity: "AMBER",
    finding: {
      en: findingEn,
      hi: findingHi,
    },
    actionLink: "/parent/documents",
  };

  return {
    triggered: true,
    dips,
    insight,
  };
}

export interface FeeStressResult {
  triggered: boolean;
  isOverdue: boolean;
  reminderCount: number;
  balanceAmount: number;
  lateFeeAmount: number;
  insight?: InsightSnapshot | undefined;
}

/**
 * Predictive Model: fee_stress
 * Rule: invoice OVERDUE, OR two or more reminderSent flags set on the current invoice.
 * Calm, dignified copy; no shame language.
 */
export function evalFeeStress(
  invoice?: InvoiceSnapshot | null,
  studentName: string = "Child"
): FeeStressResult {
  if (!invoice || invoice.status === "PAID" || invoice.status === "WAIVED" || invoice.status === "CANCELLED") {
    return {
      triggered: false,
      isOverdue: false,
      reminderCount: 0,
      balanceAmount: 0,
      lateFeeAmount: 0,
    };
  }

  const isOverdue = invoice.status === "OVERDUE";
  let reminderCount = 0;
  if (invoice.reminderSentFlags?.d7) reminderCount++;
  if (invoice.reminderSentFlags?.d15) reminderCount++;
  if (invoice.reminderSentFlags?.d30) reminderCount++;

  const triggered = isOverdue || reminderCount >= 2;

  if (!triggered) {
    return {
      triggered: false,
      isOverdue,
      reminderCount,
      balanceAmount: invoice.balanceAmount,
      lateFeeAmount: invoice.lateFeeAmount,
    };
  }

  const amountFmt = `₹${invoice.balanceAmount.toLocaleString("en-IN")}`;
  const lateFmt = invoice.lateFeeAmount > 0 ? ` (₹${invoice.lateFeeAmount.toLocaleString("en-IN")} late fee applied)` : "";
  const lateFmtHi = invoice.lateFeeAmount > 0 ? ` (₹${invoice.lateFeeAmount.toLocaleString("en-IN")} विलंब शुल्क लागू)` : "";

  const findingEn = isOverdue
    ? `${invoice.termName} fee of ${amountFmt} is overdue${lateFmt}`
    : `Reminder: ${invoice.termName} fee of ${amountFmt} is pending payment`;

  const findingHi = isOverdue
    ? `${invoice.termName} का शुल्क ${amountFmt} देय तिथि पार कर चुका है${lateFmtHi}`
    : `अनुस्मारक: ${invoice.termName} का शुल्क ${amountFmt} भुगतान हेतु लंबित है`;

  const insight: InsightSnapshot = {
    id: `insight-fee-stress-${Date.now()}`,
    model: "fee_stress",
    severity: isOverdue ? "ROSE" : "AMBER",
    finding: {
      en: findingEn,
      hi: findingHi,
    },
    actionLink: "/parent/fees",
  };

  return {
    triggered: true,
    isOverdue,
    reminderCount,
    balanceAmount: invoice.balanceAmount,
    lateFeeAmount: invoice.lateFeeAmount,
    insight,
  };
}

export interface HomeworkNeglectResult {
  triggered: boolean;
  missingCount: number;
  missingAssignments: Array<{
    id: string;
    title: string;
    dueDate: Date | string;
  }>;
  insight?: InsightSnapshot | undefined;
}

/**
 * Predictive Model: homework_neglect
 * Rule: 2+ assignmentSubmissions missing past due date in the last 14 days.
 */
export function evalHomeworkNeglect(
  homeworkList: HomeworkSnapshot[],
  referenceDate: Date = new Date(),
  studentName: string = "Child"
): HomeworkNeglectResult {
  const cutoff14d = new Date(referenceDate.getTime() - 14 * 24 * 60 * 60 * 1000);

  const missingAssignments = homeworkList
    .filter((hw) => {
      const due = new Date(hw.dueDate);
      return !hw.isSubmitted && due < referenceDate && due >= cutoff14d;
    })
    .map((hw) => ({
      id: hw.id,
      title: hw.title,
      dueDate: hw.dueDate,
    }));

  const missingCount = missingAssignments.length;
  const triggered = missingCount >= 2;

  if (!triggered) {
    return {
      triggered: false,
      missingCount,
      missingAssignments,
    };
  }

  const findingEn = `${missingCount} homework assignments for ${studentName} were not submitted past their due dates in the last 14 days`;
  const findingHi = `${studentName} के ${missingCount} गृहकार्य पिछले 14 दिनों में देय तिथि बीतने के बाद भी जमा नहीं हुए हैं`;

  const insight: InsightSnapshot = {
    id: `insight-homework-neglect-${Date.now()}`,
    model: "homework_neglect",
    severity: "AMBER",
    finding: {
      en: findingEn,
      hi: findingHi,
    },
    actionLink: "/parent/documents",
  };

  return {
    triggered: true,
    missingCount,
    missingAssignments,
    insight,
  };
}
