/**
 * Pure Analytics Signals Engine for Teacher PWA
 *
 * Implements server-side, explainable, pure statistical algorithms (no ML, no third-party libraries):
 * 1. section_attendance_trend: Flags sections where 30-day average attendance < 85% with sparkline data.
 * 2. homework_neglect_list: Identifies students with 2+ missing assignments in a 14-day rolling window.
 * 3. pre_publish_distribution: Computes marks distribution histogram, class mean, standard deviation,
 *    and flags statistical outliers (|z-score| > 2) before report card publishing.
 */

import type { TeacherInsightItem } from "./types";

export interface AttendanceDayRecord {
  date: string;
  rate: number; // 0 to 100
}

export interface SectionAttendanceTrendInput {
  sectionId: string;
  sectionName: string;
  className: string;
  dailyRecords: AttendanceDayRecord[];
}

export interface StudentMissingAssignment {
  studentId: string;
  studentName: string;
  missingCount: number;
}

export interface HomeworkNeglectInput {
  sectionId: string;
  sectionName: string;
  className: string;
  studentMissingRecords: StudentMissingAssignment[];
}

export interface PrePublishMarksInput {
  examId: string;
  examName: string;
  sectionId: string;
  sectionName: string;
  className: string;
  maxMarks: number;
  scores: number[];
}

export interface PrePublishMarksAnalysis {
  examId: string;
  examName: string;
  sectionId: string;
  totalStudents: number;
  mean: number;
  stdDev: number;
  highest: number;
  lowest: number;
  outliersCount: number;
  outliers: Array<{ score: number; zScore: number }>;
  buckets: Array<{ label: string; min: number; max: number; count: number; percentage: number }>;
  insight: TeacherInsightItem | null;
}

/**
 * Evaluates 30-day section attendance trend.
 * Generates an AMBER InsightCard if the average attendance rate is below 85%.
 */
export function evaluateSectionAttendanceTrend(
  input: SectionAttendanceTrendInput
): TeacherInsightItem | null {
  const { sectionId, sectionName, className, dailyRecords } = input;
  if (!dailyRecords || dailyRecords.length === 0) return null;

  const totalRateSum = dailyRecords.reduce((sum, r) => sum + r.rate, 0);
  const avgRate = totalRateSum / dailyRecords.length;

  // Threshold: below 85% triggers amber insight
  if (avgRate >= 85) {
    return null;
  }

  const roundedAvg = Math.round(avgRate * 10) / 10;
  const sparklineData = dailyRecords.map((r) => Math.round(r.rate));

  return {
    id: `attn-trend-${sectionId}`,
    model: "section_attendance_trend",
    severity: "AMBER",
    title: {
      en: `Attendance Dip: ${className}-${sectionName}`,
      hi: `उपस्थिति में गिरावट: ${className}-${sectionName}`,
    },
    summary: {
      en: `30-day average attendance is ${roundedAvg}% (below 85% benchmark).`,
      hi: `30 दिनों की औसत उपस्थिति ${roundedAvg}% है (85% बेंचमार्क से कम)।`,
    },
    payload: {
      sectionId,
      className,
      sectionName,
      avgRate: roundedAvg,
      daysSampled: dailyRecords.length,
      sparklineData,
    },
  };
}

/**
 * Evaluates homework submission neglect over a 14-day rolling window.
 * Generates an AMBER InsightCard if any student has missed 2 or more assignments.
 */
export function evaluateHomeworkNeglect(
  input: HomeworkNeglectInput
): TeacherInsightItem | null {
  const { sectionId, sectionName, className, studentMissingRecords } = input;
  if (!studentMissingRecords || studentMissingRecords.length === 0) return null;

  // Rule: 2+ missing assignments per student in 14 days
  const neglectedStudents = studentMissingRecords.filter(
    (s) => s.missingCount >= 2
  );

  if (neglectedStudents.length === 0) {
    return null;
  }

  const count = neglectedStudents.length;

  return {
    id: `hw-neglect-${sectionId}`,
    model: "homework_neglect_list",
    severity: "AMBER",
    title: {
      en: `Homework Attention: ${className}-${sectionName}`,
      hi: `गृहकार्य ध्यान: ${className}-${sectionName}`,
    },
    summary: {
      en: `${count} student${count > 1 ? "s have" : " has"} missed 2 or more assignments in the last 14 days.`,
      hi: `${count} विद्यार्थियों ने पिछले 14 दिनों में 2 या अधिक असाइनमेंट नहीं किए।`,
    },
    payload: {
      sectionId,
      className,
      sectionName,
      studentCount: count,
      students: neglectedStudents,
    },
  };
}

/**
 * Computes marks distribution histogram and detects statistical outliers (z-score beyond ±2).
 * Provides sanity check before report card publishing.
 */
export function evaluatePrePublishMarksDistribution(
  input: PrePublishMarksInput
): PrePublishMarksAnalysis {
  const { examId, examName, sectionId, sectionName, className, maxMarks, scores } = input;

  if (scores.length === 0) {
    return {
      examId,
      examName,
      sectionId,
      totalStudents: 0,
      mean: 0,
      stdDev: 0,
      highest: 0,
      lowest: 0,
      outliersCount: 0,
      outliers: [],
      buckets: [],
      insight: null,
    };
  }

  const n = scores.length;
  const sum = scores.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / n) * 10) / 10;

  // Standard deviation
  const variance = scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);

  // Outliers: |z| > 2
  const outliers: Array<{ score: number; zScore: number }> = [];
  if (stdDev > 0) {
    for (const score of scores) {
      const z = (score - mean) / stdDev;
      if (Math.abs(z) > 2) {
        outliers.push({
          score,
          zScore: Math.round(z * 100) / 100,
        });
      }
    }
  }

  // 5 Distribution Buckets (0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  const bucketDefs = [
    { label: "0-20%", min: 0, max: maxMarks * 0.2 },
    { label: "21-40%", min: maxMarks * 0.2, max: maxMarks * 0.4 },
    { label: "41-60%", min: maxMarks * 0.4, max: maxMarks * 0.6 },
    { label: "61-80%", min: maxMarks * 0.6, max: maxMarks * 0.8 },
    { label: "81-100%", min: maxMarks * 0.8, max: maxMarks },
  ];

  const buckets = bucketDefs.map((b) => {
    const inBucket = scores.filter((s) => {
      if (b.min === 0) {
        return s >= b.min && s <= b.max;
      }
      return s > b.min && s <= b.max;
    });
    return {
      label: b.label,
      min: Math.round(b.min),
      max: Math.round(b.max),
      count: inBucket.length,
      percentage: Math.round((inBucket.length / n) * 100),
    };
  });

  let insight: TeacherInsightItem | null = null;
  if (outliers.length > 0) {
    insight = {
      id: `marks-outliers-${examId}-${sectionId}`,
      model: "pre_publish_distribution",
      severity: "AMBER",
      title: {
        en: `Marks Sanity Check: ${examName} (${className}-${sectionName})`,
        hi: `अंक सत्यापन: ${examName} (${className}-${sectionName})`,
      },
      summary: {
        en: `${outliers.length} score outlier${outliers.length > 1 ? "s" : ""} detected (>2σ from class average ${mean}/${maxMarks}). Review before signing off.`,
        hi: `${outliers.length} असामान्य प्राप्तांक पाए गए (कक्षा औसत ${mean}/${maxMarks} से >2σ भिन्न)।`,
      },
      payload: {
        examId,
        sectionId,
        mean,
        maxMarks,
        outliersCount: outliers.length,
        outliers,
      },
    };
  }

  return {
    examId,
    examName,
    sectionId,
    totalStudents: n,
    mean,
    stdDev,
    highest,
    lowest,
    outliersCount: outliers.length,
    outliers,
    buckets,
    insight,
  };
}
