import { describe, it, expect } from "vitest";
import {
  evaluateSectionAttendanceTrend,
  evaluateHomeworkNeglect,
  evaluatePrePublishMarksDistribution,
} from "../analyticsSignals";

describe("Phase T10: Analytics Signals & Explainable AI Rules", () => {
  describe("section_attendance_trend Signal", () => {
    it("flags section attendance trend with AMBER insight when 30-day average is below 85%", () => {
      // 30 days of data averaging ~78%
      const dailyRecords = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        rate: 75 + (i % 8), // 75 to 82, average ~78.5%
      }));

      const insight = evaluateSectionAttendanceTrend({
        sectionId: "sec-8b",
        sectionName: "B",
        className: "Class 8",
        dailyRecords,
      });

      expect(insight).not.toBeNull();
      expect(insight?.model).toBe("section_attendance_trend");
      expect(insight?.severity).toBe("AMBER");
      expect(insight?.title.en).toBe("Attendance Dip: Class 8-B");
      expect(insight?.payload.avgRate).toBeLessThan(85);
      expect(insight?.payload.sparklineData.length).toBe(30);
    });

    it("suppresses insight when 30-day attendance average meets or exceeds 85% benchmark", () => {
      // 30 days of data averaging ~92%
      const dailyRecords = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        rate: 90 + (i % 6), // 90 to 95
      }));

      const insight = evaluateSectionAttendanceTrend({
        sectionId: "sec-8a",
        sectionName: "A",
        className: "Class 8",
        dailyRecords,
      });

      expect(insight).toBeNull();
    });

    it("suppresses insight when no daily records are provided", () => {
      const insight = evaluateSectionAttendanceTrend({
        sectionId: "sec-8a",
        sectionName: "A",
        className: "Class 8",
        dailyRecords: [],
      });

      expect(insight).toBeNull();
    });
  });

  describe("homework_neglect_list Signal", () => {
    it("identifies students with 2 or more missing assignments in 14 days and triggers insight", () => {
      const studentMissingRecords = [
        { studentId: "s1", studentName: "Aarav Sharma", missingCount: 3 },
        { studentId: "s2", studentName: "Diya Patel", missingCount: 2 },
        { studentId: "s3", studentName: "Rohan Verma", missingCount: 1 }, // below threshold
        { studentId: "s4", studentName: "Ananya Iyer", missingCount: 0 },
      ];

      const insight = evaluateHomeworkNeglect({
        sectionId: "sec-8b",
        sectionName: "B",
        className: "Class 8",
        studentMissingRecords,
      });

      expect(insight).not.toBeNull();
      expect(insight?.model).toBe("homework_neglect_list");
      expect(insight?.severity).toBe("AMBER");
      expect(insight?.payload.studentCount).toBe(2);
      expect(insight?.payload.students.length).toBe(2);
      expect(insight?.payload.students[0]?.studentName).toBe("Aarav Sharma");
      expect(insight?.payload.students[1]?.studentName).toBe("Diya Patel");
    });

    it("suppresses insight when no student has 2 or more missing assignments", () => {
      const studentMissingRecords = [
        { studentId: "s1", studentName: "Rohan Verma", missingCount: 1 },
        { studentId: "s2", studentName: "Ananya Iyer", missingCount: 0 },
      ];

      const insight = evaluateHomeworkNeglect({
        sectionId: "sec-8b",
        sectionName: "B",
        className: "Class 8",
        studentMissingRecords,
      });

      expect(insight).toBeNull();
    });
  });

  describe("pre_publish_distribution Signal & Outlier Detection", () => {
    it("computes distribution histogram, mean, stdDev, and flags statistical outliers (|z| > 2)", () => {
      // 20 students with normal marks around 35/50, and 1 severe low outlier (2/50)
      const normalScores = [
        34, 35, 36, 33, 37, 35, 36, 34, 38, 35,
        34, 36, 35, 33, 37, 36, 34, 35, 38, 36,
      ];
      const outlierScore = 2; // Very far from mean ~34.8
      const scores = [...normalScores, outlierScore];

      const analysis = evaluatePrePublishMarksDistribution({
        examId: "exam-midterm",
        examName: "Midterm Mathematics",
        sectionId: "sec-8b",
        sectionName: "B",
        className: "Class 8",
        maxMarks: 50,
        scores,
      });

      expect(analysis.totalStudents).toBe(21);
      expect(analysis.mean).toBeGreaterThan(30);
      expect(analysis.outliersCount).toBeGreaterThan(0);
      expect(analysis.outliers.some((o) => o.score === 2)).toBe(true);

      expect(analysis.insight).not.toBeNull();
      expect(analysis.insight?.model).toBe("pre_publish_distribution");
      expect(analysis.insight?.severity).toBe("AMBER");

      // Verify 5 histogram buckets exist
      expect(analysis.buckets.length).toBe(5);
      expect(analysis.buckets.map((b) => b.label)).toEqual([
        "0-20%",
        "21-40%",
        "41-60%",
        "61-80%",
        "81-100%",
      ]);
    });

    it("suppresses outlier insight when all scores fall within ±2 standard deviations", () => {
      const uniformScores = [
        30, 32, 33, 34, 35, 36, 37, 38, 40,
        31, 33, 34, 35, 36, 37, 38, 39, 41,
      ];

      const analysis = evaluatePrePublishMarksDistribution({
        examId: "exam-midterm",
        examName: "Midterm Science",
        sectionId: "sec-8b",
        sectionName: "B",
        className: "Class 8",
        maxMarks: 50,
        scores: uniformScores,
      });

      expect(analysis.outliersCount).toBe(0);
      expect(analysis.insight).toBeNull();
    });
  });
});
