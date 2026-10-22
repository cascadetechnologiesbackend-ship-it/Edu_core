import { describe, it, expect } from "vitest";
import { deriveStudentFeed } from "../deriveStudentFeed";
import type { StudentDataSnapshot } from "../types";

describe("deriveStudentFeed (Spec v1.0, Phase S3)", () => {
  const baseSnapshot: StudentDataSnapshot = {
    studentId: "student-101",
    studentName: "Aarav Sharma",
    classId: "class-10",
    className: "Class 10",
    sectionId: "section-a",
    sectionName: "A",
    enrolledSubjectIds: ["subj-math", "subj-sci"],
    homework: [],
    classwork: [],
    upcomingAssessments: [],
    notices: [],
    publishedMarks: [],
    admitCardFeeHold: null,
    attendanceSummary: {
      presentDays: 85,
      totalDays: 90,
      ratePercent: 94.4,
    },
  };

  it("enforces Zero-Clutter Invariant: returns empty array [] on calm snapshot", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const feed = deriveStudentFeed("student-101", now, baseSnapshot);
    expect(feed).toEqual([]);
  });

  it("pins unsubmitted homework due today in Tier 1 with priority 95", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      homework: [
        {
          id: "hw-1",
          title: "Quadratic Equations Exercise 4.2",
          description: "Solve problems 1 through 10",
          classSubjectId: "cs-math",
          subjectName: "Mathematics",
          dueDate: new Date("2026-10-23T17:00:00Z"), // Due today
          status: "PUBLISHED",
          attachmentS3Key: null,
          teacherName: "Ramesh Gupta",
          isSubmitted: false,
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);

    const card = feed[0]!;
    expect(card.cardType).toBe("HomeworkDue");
    expect(card.tier).toBe("T1_action_required");
    expect(card.priority).toBe(95);
    expect(card.isPinned).toBe(true);
    expect(card.title.en).toBe("Mathematics: Quadratic Equations Exercise 4.2");
    expect(card.title.hi).toBe("Mathematics: Quadratic Equations Exercise 4.2");
    expect(card.summary.en).toContain("Due today");
    expect(card.summary.en).toContain("Pending Submission");
    expect(card.summary.hi).toContain("आज देय है");
  });

  it("prioritizes homework due tomorrow as T1 without pinning", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      homework: [
        {
          id: "hw-2",
          title: "Light Reflection Lab Report",
          description: "Write conclusions on concave mirrors",
          classSubjectId: "cs-sci",
          subjectName: "Science",
          dueDate: new Date("2026-10-24T12:00:00Z"), // Due tomorrow
          status: "PUBLISHED",
          attachmentS3Key: null,
          teacherName: "Anita Roy",
          isSubmitted: false,
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);

    const card = feed[0]!;
    expect(card.cardType).toBe("HomeworkDue");
    expect(card.tier).toBe("T1_action_required");
    expect(card.priority).toBe(85);
    expect(card.isPinned).toBe(false);
    expect(card.summary.en).toContain("Due tomorrow");
    expect(card.summary.hi).toContain("कल देय है");
  });

  it("reflects submitted and graded homework status truthfully", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      homework: [
        {
          id: "hw-3",
          title: "English Essay",
          description: "Essay on Environmental Conservation",
          classSubjectId: "cs-eng",
          subjectName: "English",
          dueDate: new Date("2026-10-22T10:00:00Z"),
          status: "GRADED",
          attachmentS3Key: null,
          teacherName: "Sarah Thomas",
          isSubmitted: true,
          submission: {
            id: "sub-3",
            submittedAt: new Date("2026-10-22T08:00:00Z"),
            isLate: false,
            marksAwarded: 18,
            grade: "A",
            remarks: "Well structured!",
          },
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);

    const card = feed[0]!;
    expect(card.cardType).toBe("HomeworkDue");
    expect(card.isPinned).toBe(false);
    expect(card.summary.en).toContain("Graded: 18 Marks");
    expect(card.summary.hi).toContain("मूल्यांकित: 18 अंक");
  });

  it("derives ClassworkRecap for completed lesson plans in past 7 days, dropping older ones", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      classwork: [
        {
          id: "cw-recent",
          classSubjectId: "cs-math",
          subjectName: "Mathematics",
          chapterName: "Chapter 4: Quadratic Equations",
          topicTitle: "Roots of Quadratic Equations",
          objectives: "Factorization method",
          homework: "Exercise 4.2 Q1-5",
          teachingMethods: null,
          resources: null,
          completedDate: new Date("2026-10-22T09:30:00Z"), // 1 day ago
          teacherName: "Ramesh Gupta",
        },
        {
          id: "cw-stale",
          classSubjectId: "cs-sci",
          subjectName: "Science",
          chapterName: "Chapter 1",
          topicTitle: "Chemical Reactions",
          objectives: null,
          homework: null,
          teachingMethods: null,
          resources: null,
          completedDate: new Date("2026-10-10T09:30:00Z"), // 13 days ago (stale > 7d)
          teacherName: "Anita Roy",
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);
    expect(feed[0]!.cardType).toBe("ClassworkRecap");
    expect(feed[0]!.payload.classworkId).toBe("cw-recent");
    expect(feed[0]!.summary.en).toContain("Chapter 4: Quadratic Equations");
    expect(feed[0]!.summary.en).toContain("Homework: Exercise 4.2 Q1-5");
  });

  it("derives AssessmentCountdown for scheduled assessments within 14 days", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      upcomingAssessments: [
        {
          id: "asmt-1",
          title: "Periodic Test 2",
          classSubjectId: "cs-math",
          subjectName: "Mathematics",
          assessmentType: "PERIODIC_TEST",
          scheduledDate: "2026-10-25", // 2 days ahead -> urgent
          maxMarks: 40,
          syllabusCoverage: "Chapters 3, 4, 5",
          status: "SCHEDULED",
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);

    const card = feed[0]!;
    expect(card.cardType).toBe("AssessmentCountdown");
    expect(card.tier).toBe("T1_action_required");
    expect(card.summary.en).toContain("In 2 days");
    expect(card.summary.en).toContain("Max Marks: 40");
    expect(card.summary.en).toContain("Chapters 3, 4, 5");
  });

  it("derives NoticeCards with urgent priority for unacknowledged required notices", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      notices: [
        {
          id: "not-1",
          title: "Science Exhibition Registration",
          content: "Please register your projects by Friday.",
          audienceType: "STUDENTS",
          publishedAt: new Date("2026-10-22T08:00:00Z"),
          isPinned: false,
          requiresAcknowledgment: true,
          isAcknowledged: false, // unacknowledged -> T1
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);

    const card = feed[0]!;
    expect(card.cardType).toBe("NoticeCard");
    expect(card.tier).toBe("T1_action_required");
    expect(card.summary.en).toContain("Acknowledgment required");
    expect(card.summary.hi).toContain("पावती आवश्यक");
  });

  it("derives MarksPublished cards when exam results are released", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      publishedMarks: [
        {
          examId: "exam-midterm",
          examName: "Mid-Term Examination 2026",
          overallGrade: "A+",
          percentage: 92.5,
          rank: 2,
          teacherRemarks: "Outstanding analytical work",
          publishedAt: new Date("2026-10-22T14:00:00Z"),
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(1);

    const card = feed[0]!;
    expect(card.cardType).toBe("MarksPublished");
    expect(card.title.en).toBe("Results Published: Mid-Term Examination 2026");
    expect(card.title.hi).toBe("परीक्षा परिणाम जारी: Mid-Term Examination 2026");
    expect(card.summary.en).toContain("Grade: A+");
    expect(card.summary.en).toContain("92.5%");
    expect(card.summary.en).toContain("Rank: 2");
  });

  it("pins FeeHoldWarning at very top (priority 98) when admit card is blocked", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snapshot: StudentDataSnapshot = {
      ...baseSnapshot,
      admitCardFeeHold: {
        examName: "Mid-Term Examination 2026",
        balanceDue: 4500,
        feeLockMode: "HARD",
      },
      homework: [
        {
          id: "hw-due-today",
          title: "Math homework",
          description: null,
          classSubjectId: "cs-math",
          subjectName: "Math",
          dueDate: new Date("2026-10-23T16:00:00Z"),
          status: "PUBLISHED",
          attachmentS3Key: null,
          teacherName: "Teacher",
          isSubmitted: false,
        },
      ],
    };

    const feed = deriveStudentFeed("student-101", now, snapshot);
    expect(feed.length).toBe(2);

    // First card must be the FeeHoldWarning pinned with priority 98
    expect(feed[0]!.cardType).toBe("FeeHoldWarning");
    expect(feed[0]!.isPinned).toBe(true);
    expect(feed[0]!.priority).toBe(98);
    expect(feed[0]!.title.en).toContain("Admit Card Fee Clearance");
    expect(feed[0]!.summary.en).toContain("₹4,500");

    // Second card is the Homework due today pinned with priority 95
    expect(feed[1]!.cardType).toBe("HomeworkDue");
    expect(feed[1]!.isPinned).toBe(true);
    expect(feed[1]!.priority).toBe(95);
  });
});
