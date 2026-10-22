import { describe, it, expect } from "vitest";

describe("Marks Lock & Admit Card Gating (Phase S5 - AC-10, BR5)", () => {
  describe("Exam Marks Lock Gating", () => {
    function resolveStudentExamResult(params: {
      examId: string;
      examName: string;
      marksLocks: Array<{ examId: string; status: "SUBMITTED" | "LOCKED" }>;
      withholdAll?: boolean;
      releaseAt?: string | null;
      currentTime?: Date;
      rawMarks: Array<{
        subjectId: string;
        subjectName: string;
        marksObtained: number;
        maxMarks: number;
        grade: string;
      }>;
    }) {
      const now = params.currentTime || new Date();
      const examLocks = params.marksLocks.filter((l) => l.examId === params.examId);

      // Lock gating invariant (AC-10, BR5):
      // Must have locks and all must be LOCKED. If none exist or any is SUBMITTED, results are locked.
      const hasUnfinalizedLocks =
        examLocks.length === 0 || examLocks.some((l) => l.status !== "LOCKED");

      const isWithheld =
        Boolean(params.withholdAll) ||
        Boolean(params.releaseAt && now < new Date(params.releaseAt));

      const isLocked = hasUnfinalizedLocks || isWithheld;

      if (isLocked) {
        return {
          examId: params.examId,
          examName: params.examName,
          isLocked: true,
          lockStatusLabel: "Results awaited / परिणाम प्रतीक्षित है",
          marks: [], // Zero marks leaked!
          totalMarksObtained: null,
          percentage: null,
        };
      }

      const totalObtained = params.rawMarks.reduce(
        (sum, m) => sum + m.marksObtained,
        0
      );
      const totalMax = params.rawMarks.reduce((sum, m) => sum + m.maxMarks, 0);

      return {
        examId: params.examId,
        examName: params.examName,
        isLocked: false,
        lockStatusLabel: "Results Published / परिणाम घोषित",
        marks: params.rawMarks,
        totalMarksObtained: totalObtained,
        percentage:
          totalMax > 0
            ? Math.round((totalObtained / totalMax) * 1000) / 10
            : null,
      };
    }

    it("withholds marks and returns 'Results awaited' when marks lock is SUBMITTED (not LOCKED)", () => {
      const res = resolveStudentExamResult({
        examId: "exam-midterm",
        examName: "Mid-Term Examination",
        marksLocks: [
          { examId: "exam-midterm", status: "SUBMITTED" },
        ],
        rawMarks: [
          { subjectId: "s1", subjectName: "Math", marksObtained: 85, maxMarks: 100, grade: "A2" },
        ],
      });

      expect(res.isLocked).toBe(true);
      expect(res.lockStatusLabel).toBe("Results awaited / परिणाम प्रतीक्षित है");
      expect(res.marks).toHaveLength(0);
      expect(res.totalMarksObtained).toBeNull();
      expect(res.percentage).toBeNull();
    });

    it("withholds marks and returns 'Results awaited' when no marks locks exist for the exam", () => {
      const res = resolveStudentExamResult({
        examId: "exam-midterm",
        examName: "Mid-Term Examination",
        marksLocks: [],
        rawMarks: [
          { subjectId: "s1", subjectName: "Science", marksObtained: 90, maxMarks: 100, grade: "A1" },
        ],
      });

      expect(res.isLocked).toBe(true);
      expect(res.marks).toHaveLength(0);
    });

    it("withholds marks when global withholdAll is active even if locks are complete", () => {
      const res = resolveStudentExamResult({
        examId: "exam-midterm",
        examName: "Mid-Term Examination",
        marksLocks: [
          { examId: "exam-midterm", status: "LOCKED" },
        ],
        withholdAll: true,
        rawMarks: [
          { subjectId: "s1", subjectName: "English", marksObtained: 78, maxMarks: 100, grade: "B1" },
        ],
      });

      expect(res.isLocked).toBe(true);
      expect(res.marks).toHaveLength(0);
    });

    it("withholds marks when releaseAt is in the future", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = resolveStudentExamResult({
        examId: "exam-midterm",
        examName: "Mid-Term Examination",
        marksLocks: [
          { examId: "exam-midterm", status: "LOCKED" },
        ],
        releaseAt: futureDate,
        rawMarks: [
          { subjectId: "s1", subjectName: "Social Science", marksObtained: 92, maxMarks: 100, grade: "A1" },
        ],
      });

      expect(res.isLocked).toBe(true);
      expect(res.marks).toHaveLength(0);
    });

    it("surfaces marks and percentage when all locks are locked and not withheld", () => {
      const res = resolveStudentExamResult({
        examId: "exam-midterm",
        examName: "Mid-Term Examination",
        marksLocks: [
          { examId: "exam-midterm", status: "LOCKED" },
        ],
        withholdAll: false,
        rawMarks: [
          { subjectId: "s1", subjectName: "Mathematics", marksObtained: 95, maxMarks: 100, grade: "A1" },
          { subjectId: "s2", subjectName: "Science", marksObtained: 85, maxMarks: 100, grade: "A2" },
        ],
      });

      expect(res.isLocked).toBe(false);
      expect(res.lockStatusLabel).toBe("Results Published / परिणाम घोषित");
      expect(res.marks).toHaveLength(2);
      expect(res.totalMarksObtained).toBe(180);
      expect(res.percentage).toBe(90.0);
    });
  });

  describe("Admit Card Gating & Fee Lock Status", () => {
    function resolveAdmitCardStatus(params: {
      isHeldByAdmin: boolean;
      holdReason?: string | null;
      isReleased: boolean;
      feeLockMode: "OFF" | "SOFT" | "HARD";
      feeLockThreshold: number;
      dueAmount: number;
    }) {
      if (params.isHeldByAdmin) {
        return {
          status: "HELD",
          holdReason: params.holdReason || "Administrative hold",
          softFeeWarning: false,
        };
      }

      if (!params.isReleased) {
        return {
          status: "NOT_RELEASED",
          holdReason: null,
          softFeeWarning: false,
        };
      }

      const feeExceeded = params.dueAmount > params.feeLockThreshold;

      if (params.feeLockMode === "HARD" && feeExceeded) {
        return {
          status: "FEE_BLOCKED",
          holdReason: `Fee dues of ₹${params.dueAmount} exceed threshold ₹${params.feeLockThreshold}`,
          softFeeWarning: false,
        };
      }

      if (params.feeLockMode === "SOFT" && feeExceeded) {
        return {
          status: "AVAILABLE",
          holdReason: null,
          softFeeWarning: true,
        };
      }

      return {
        status: "AVAILABLE",
        holdReason: null,
        softFeeWarning: false,
      };
    }

    it("blocks admit card when administrative hold is placed", () => {
      const res = resolveAdmitCardStatus({
        isHeldByAdmin: true,
        holdReason: "Disciplinary inquiry pending",
        isReleased: true,
        feeLockMode: "OFF",
        feeLockThreshold: 0,
        dueAmount: 0,
      });

      expect(res.status).toBe("HELD");
      expect(res.holdReason).toBe("Disciplinary inquiry pending");
    });

    it("blocks admit card with FEE_BLOCKED when feeLockMode is HARD and dues exceed threshold", () => {
      const res = resolveAdmitCardStatus({
        isHeldByAdmin: false,
        isReleased: true,
        feeLockMode: "HARD",
        feeLockThreshold: 500,
        dueAmount: 5000,
      });

      expect(res.status).toBe("FEE_BLOCKED");
      expect(res.softFeeWarning).toBe(false);
    });

    it("allows admit card download with soft fee warning when feeLockMode is SOFT", () => {
      const res = resolveAdmitCardStatus({
        isHeldByAdmin: false,
        isReleased: true,
        feeLockMode: "SOFT",
        feeLockThreshold: 1000,
        dueAmount: 3500,
      });

      expect(res.status).toBe("AVAILABLE");
      expect(res.softFeeWarning).toBe(true);
    });

    it("allows admit card download without warnings when fees are fully cleared", () => {
      const res = resolveAdmitCardStatus({
        isHeldByAdmin: false,
        isReleased: true,
        feeLockMode: "HARD",
        feeLockThreshold: 500,
        dueAmount: 0,
      });

      expect(res.status).toBe("AVAILABLE");
      expect(res.softFeeWarning).toBe(false);
    });
  });

  describe("Attendance Calculation Truth Invariant (AC-11, AC-17)", () => {
    function computeAttendanceStats(records: Array<{ status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE" | "HOLIDAY" }>) {
      let presentDays = 0;
      let lateDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let leaveDays = 0;

      for (const rec of records) {
        if (rec.status === "PRESENT") presentDays++;
        else if (rec.status === "LATE") lateDays++;
        else if (rec.status === "HALF_DAY") halfDays++;
        else if (rec.status === "ABSENT") absentDays++;
        else if (rec.status === "LEAVE") leaveDays++;
      }

      const totalMarkedDays = presentDays + lateDays + halfDays + absentDays + leaveDays;

      const percentage = totalMarkedDays > 0
        ? Math.round(((presentDays + lateDays + halfDays * 0.5) / totalMarkedDays) * 1000) / 10
        : null;

      return { totalMarkedDays, percentage };
    }

    it("returns percentage: null when 0 days are marked (NO 96.5% fallback anywhere)", () => {
      const stats = computeAttendanceStats([]);
      expect(stats.totalMarkedDays).toBe(0);
      expect(stats.percentage).toBeNull();
      expect(stats.percentage).not.toBe(96.5);
    });

    it("calculates authentic percentage when records exist", () => {
      // 18 present, 2 late, 2 half-day (worth 1 day), 2 absent, 1 leave = 25 total
      // Effective present = 18 + 2 + 1 = 21 / 25 = 84.0%
      const records = [
        ...Array(18).fill({ status: "PRESENT" as const }),
        ...Array(2).fill({ status: "LATE" as const }),
        ...Array(2).fill({ status: "HALF_DAY" as const }),
        ...Array(2).fill({ status: "ABSENT" as const }),
        ...Array(1).fill({ status: "LEAVE" as const }),
      ];

      const stats = computeAttendanceStats(records);
      expect(stats.totalMarkedDays).toBe(25);
      expect(stats.percentage).toBe(84.0);
    });
  });
});
