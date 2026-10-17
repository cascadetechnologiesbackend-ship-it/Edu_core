import { describe, it, expect } from "vitest";
import {
  computeAttendanceTrend30d,
  computeFeePaymentHistory,
  computeMarksTrend,
  evalAttendanceRisk,
  evalPerformanceDip,
  evalFeeStress,
  evalHomeworkNeglect,
  type AttendanceRecord,
  type FeePaymentRecord,
  type ReportCardRecord,
} from "../parentSignals";
import type { HomeworkSnapshot, InvoiceSnapshot } from "../../parentEventEngine/types";

describe("Parent Signals & Explainable Analytics (AC-P9)", () => {
  const refDate = new Date("2026-10-15T12:00:00.000Z");

  describe("Descriptive: computeAttendanceTrend30d", () => {
    it("calculates 30-day attendance rate excluding holidays", () => {
      const records: AttendanceRecord[] = [
        { date: "2026-10-14", status: "PRESENT" },
        { date: "2026-10-13", status: "PRESENT" },
        { date: "2026-10-12", status: "LATE" },
        { date: "2026-10-11", status: "HOLIDAY" },
        { date: "2026-10-10", status: "ABSENT" },
      ];

      const res = computeAttendanceTrend30d(records, refDate);
      expect(res.totalSchoolDays).toBe(4); // holiday excluded
      expect(res.presentDays).toBe(2);
      expect(res.lateDays).toBe(1);
      expect(res.absentDays).toBe(1);
      expect(res.rate).toBe(3 / 4); // 75%
      expect(res.percentage).toBe(75);
      expect(res.sparkline).toHaveLength(4);
    });

    it("returns 100% when no records exist in the 30-day window", () => {
      const res = computeAttendanceTrend30d([], refDate);
      expect(res.rate).toBe(1.0);
      expect(res.percentage).toBe(100);
      expect(res.sparkline).toHaveLength(0);
    });
  });

  describe("Descriptive: computeFeePaymentHistory", () => {
    it("formats and sorts payments chronologically descending", () => {
      const payments: FeePaymentRecord[] = [
        {
          id: "p1",
          invoiceId: "inv1",
          termName: "Term 1",
          amount: 5000,
          paidAt: "2026-07-10T10:00:00Z",
          paymentMethod: "UPI",
          receiptNumber: "REC-001",
          status: "PAID",
        },
        {
          id: "p2",
          invoiceId: "inv2",
          termName: "Term 2",
          amount: 8500,
          paidAt: "2026-10-01T15:30:00Z",
          paymentMethod: "NET_BANKING",
          receiptNumber: "REC-002",
          status: "PAID",
        },
      ];

      const res = computeFeePaymentHistory(payments);
      expect(res[0]?.id).toBe("p2");
      expect(res[0]?.amountFormatted).toBe("₹8,500");
      expect(res[1]?.id).toBe("p1");
    });
  });

  describe("Descriptive: computeMarksTrend", () => {
    it("computes per-subject deltas and trend direction between two terms", () => {
      const reports: ReportCardRecord[] = [
        {
          id: "rc2",
          termName: "Term 2",
          publishedAt: "2026-10-10T00:00:00Z",
          subjectMarks: {
            Mathematics: 88,
            Science: 72,
            English: 80,
          },
          overallAverage: 80,
        },
        {
          id: "rc1",
          termName: "Term 1",
          publishedAt: "2026-06-15T00:00:00Z",
          subjectMarks: {
            Mathematics: 80,
            Science: 85,
            English: 80,
          },
          overallAverage: 81.6,
        },
      ];

      const res = computeMarksTrend(reports);
      expect(res).not.toBeNull();
      expect(res?.termName).toBe("Term 2");
      expect(res?.previousTermName).toBe("Term 1");

      const math = res?.subjectTrends.find((s) => s.subject === "Mathematics");
      expect(math?.delta).toBe(8);
      expect(math?.trend).toBe("up");

      const science = res?.subjectTrends.find((s) => s.subject === "Science");
      expect(science?.delta).toBe(-13);
      expect(science?.trend).toBe("down");

      const english = res?.subjectTrends.find((s) => s.subject === "English");
      expect(english?.delta).toBe(0);
      expect(english?.trend).toBe("neutral");
    });
  });

  describe("Predictive: evalAttendanceRisk", () => {
    it("triggers when student has 3+ absences or leaves in the last 10 school days", () => {
      const records: AttendanceRecord[] = [
        { date: "2026-10-14", status: "ABSENT" },
        { date: "2026-10-13", status: "PRESENT" },
        { date: "2026-10-12", status: "LEAVE" },
        { date: "2026-10-10", status: "ABSENT" },
        { date: "2026-10-09", status: "PRESENT" },
        { date: "2026-10-08", status: "PRESENT" },
        { date: "2026-10-07", status: "PRESENT" },
        { date: "2026-10-06", status: "PRESENT" },
        { date: "2026-10-05", status: "PRESENT" },
        { date: "2026-10-04", status: "PRESENT" },
      ];

      const res = evalAttendanceRisk(records, refDate, "Aarav");
      expect(res.triggered).toBe(true);
      expect(res.metrics.absentOrLeaveCount10d).toBe(3);
      expect(res.insight).toBeDefined();
      expect(res.insight?.severity).toBe("AMBER");
      expect(res.insight?.finding.en).toContain("Aarav was absent or on leave for 3 of the last 10 school days");
      expect(res.insight?.finding.hi).toContain("Aarav पिछले 10 स्कूल दिनों में से 3 दिन अनुपस्थित या अवकाश पर रहे");
      expect(res.insight?.finding.en).not.toMatch(/defaulter|risk score|churn/i);
    });

    it("triggers when rolling 30-day attendance is below 85%", () => {
      // 20 school days: 16 attended (80%), 4 absent
      const records: AttendanceRecord[] = [];
      for (let i = 1; i <= 20; i++) {
        const dayStr = i < 10 ? `0${i}` : `${i}`;
        records.push({
          date: `2026-10-${dayStr}`,
          status: i <= 4 ? "ABSENT" : "PRESENT",
        });
      }

      const res = evalAttendanceRisk(records, new Date("2026-10-21T00:00:00Z"), "Ananya");
      expect(res.triggered).toBe(true);
      expect(res.metrics.rolling30dRate).toBeLessThan(0.85);
    });

    it("does not trigger when attendance is good (e.g. 95%) and few absences", () => {
      const records: AttendanceRecord[] = [
        { date: "2026-10-14", status: "PRESENT" },
        { date: "2026-10-13", status: "PRESENT" },
        { date: "2026-10-12", status: "LATE" },
        { date: "2026-10-11", status: "PRESENT" },
        { date: "2026-10-10", status: "PRESENT" },
        { date: "2026-10-09", status: "ABSENT" },
        { date: "2026-10-08", status: "PRESENT" },
        { date: "2026-10-07", status: "PRESENT" },
        { date: "2026-10-06", status: "PRESENT" },
        { date: "2026-10-05", status: "PRESENT" },
      ];

      const res = evalAttendanceRisk(records, refDate, "Aarav");
      expect(res.triggered).toBe(false);
      expect(res.insight).toBeUndefined();
    });
  });

  describe("Predictive: evalPerformanceDip", () => {
    it("triggers when a subject dropped more than 10 points between latest 2 reports", () => {
      const reports: ReportCardRecord[] = [
        {
          id: "rc2",
          termName: "Term 2",
          publishedAt: "2026-10-10T00:00:00Z",
          subjectMarks: {
            Mathematics: 64, // dropped from 78 (14 points drop > 10)
            Science: 82,
          },
        },
        {
          id: "rc1",
          termName: "Term 1",
          publishedAt: "2026-06-15T00:00:00Z",
          subjectMarks: {
            Mathematics: 78,
            Science: 80,
          },
        },
      ];

      const res = evalPerformanceDip(reports, "Aarav");
      expect(res.triggered).toBe(true);
      expect(res.dips).toHaveLength(1);
      expect(res.dips[0]?.subject).toBe("Mathematics");
      expect(res.dips[0]?.drop).toBe(14);
      expect(res.insight?.finding.en).toContain("Mathematics dropped from 78 to 64 in Term 2");
      expect(res.insight?.finding.hi).toContain("Term 2 में Mathematics के अंक 78 से गिरकर 64 हो गए");
      expect(res.insight?.finding.en).not.toMatch(/defaulter|risk score|churn/i);
    });

    it("does not trigger when drop is 10 points or less", () => {
      const reports: ReportCardRecord[] = [
        {
          id: "rc2",
          termName: "Term 2",
          publishedAt: "2026-10-10T00:00:00Z",
          subjectMarks: {
            Mathematics: 70, // dropped 8 points
          },
        },
        {
          id: "rc1",
          termName: "Term 1",
          publishedAt: "2026-06-15T00:00:00Z",
          subjectMarks: {
            Mathematics: 78,
          },
        },
      ];

      const res = evalPerformanceDip(reports, "Aarav");
      expect(res.triggered).toBe(false);
      expect(res.dips).toHaveLength(0);
    });
  });

  describe("Predictive: evalFeeStress", () => {
    it("triggers with ROSE severity when invoice is OVERDUE, mentioning late fee if present", () => {
      const invoice: InvoiceSnapshot = {
        id: "inv-1",
        termName: "Term 2",
        status: "OVERDUE",
        dueDate: "2026-10-01",
        balanceAmount: 12500,
        lateFeeAmount: 500,
      };

      const res = evalFeeStress(invoice, "Aarav");
      expect(res.triggered).toBe(true);
      expect(res.isOverdue).toBe(true);
      expect(res.insight?.severity).toBe("ROSE");
      expect(res.insight?.finding.en).toContain("Term 2 fee of ₹12,500 is overdue (₹500 late fee applied)");
      expect(res.insight?.finding.hi).toContain("Term 2 का शुल्क ₹12,500 देय तिथि पार कर चुका है");
      expect(res.insight?.finding.en).not.toMatch(/defaulter|risk score|churn/i);
    });

    it("triggers with AMBER severity when 2 or more reminder flags are set even if not yet overdue", () => {
      const invoice: InvoiceSnapshot = {
        id: "inv-2",
        termName: "Term 3",
        status: "PENDING",
        dueDate: "2026-10-20",
        balanceAmount: 9000,
        lateFeeAmount: 0,
        reminderSentFlags: {
          d7: true,
          d15: true,
        },
      };

      const res = evalFeeStress(invoice, "Aarav");
      expect(res.triggered).toBe(true);
      expect(res.isOverdue).toBe(false);
      expect(res.insight?.severity).toBe("AMBER");
      expect(res.insight?.finding.en).toContain("Reminder: Term 3 fee of ₹9,000 is pending payment");
      expect(res.insight?.finding.en).not.toMatch(/defaulter|risk score|churn/i);
    });

    it("does not trigger when invoice is in good standing or only 1 reminder sent", () => {
      const invoice: InvoiceSnapshot = {
        id: "inv-3",
        termName: "Term 1",
        status: "PAID",
        dueDate: "2026-09-01",
        balanceAmount: 0,
        lateFeeAmount: 0,
      };

      const res = evalFeeStress(invoice, "Aarav");
      expect(res.triggered).toBe(false);
    });
  });

  describe("Predictive: evalHomeworkNeglect", () => {
    it("triggers when 2 or more assignments are missing past due date within last 14 days", () => {
      const homework: HomeworkSnapshot[] = [
        {
          id: "hw-1",
          title: "Trigonometry Exercise 4.2",
          subjectName: "Mathematics",
          dueDate: "2026-10-12T10:00:00Z", // 3 days ago, missing
          isSubmitted: false,
        },
        {
          id: "hw-2",
          title: "Photosynthesis Lab Report",
          subjectName: "Science",
          dueDate: "2026-10-08T10:00:00Z", // 7 days ago, missing
          isSubmitted: false,
        },
        {
          id: "hw-3",
          title: "Hindi Essay",
          subjectName: "Hindi",
          dueDate: "2026-09-20T10:00:00Z", // 25 days ago (> 14d, outside window)
          isSubmitted: false,
        },
        {
          id: "hw-4",
          title: "History Timeline",
          subjectName: "Social Science",
          dueDate: "2026-10-10T10:00:00Z",
          isSubmitted: true, // submitted
        },
      ];

      const res = evalHomeworkNeglect(homework, refDate, "Aarav");
      expect(res.triggered).toBe(true);
      expect(res.missingCount).toBe(2);
      expect(res.insight?.severity).toBe("AMBER");
      expect(res.insight?.finding.en).toContain("2 homework assignments for Aarav were not submitted past their due dates in the last 14 days");
      expect(res.insight?.finding.hi).toContain("Aarav के 2 गृहकार्य पिछले 14 दिनों में देय तिथि बीतने के बाद भी जमा नहीं हुए हैं");
      expect(res.insight?.finding.en).not.toMatch(/defaulter|risk score|churn/i);
    });

    it("does not trigger when only 1 assignment is missing", () => {
      const homework: HomeworkSnapshot[] = [
        {
          id: "hw-1",
          title: "Math Worksheet",
          subjectName: "Mathematics",
          dueDate: "2026-10-14T10:00:00Z",
          isSubmitted: false,
        },
      ];

      const res = evalHomeworkNeglect(homework, refDate, "Aarav");
      expect(res.triggered).toBe(false);
      expect(res.missingCount).toBe(1);
    });
  });
});
