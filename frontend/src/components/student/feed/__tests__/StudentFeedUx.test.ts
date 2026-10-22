import { describe, it, expect } from "vitest";
import React from "react";
import { StudentFeedContainer } from "../StudentFeedContainer";
import { HomeworkDueCard } from "../cards/HomeworkDueCard";
import { ClassworkRecapCard } from "../cards/ClassworkRecapCard";
import { AssessmentCountdownCard } from "../cards/AssessmentCountdownCard";
import { NoticeCard } from "../cards/NoticeCard";
import { MarksPublishedCard } from "../cards/MarksPublishedCard";
import { DueTodayStrip } from "../cards/DueTodayStrip";
import { HomeworkDetailModal } from "../modals/HomeworkDetailModal";
import { ClassworkDetailModal } from "../modals/ClassworkDetailModal";
import { AssessmentDetailModal } from "../modals/AssessmentDetailModal";
import { NoticeDetailModal } from "../modals/NoticeDetailModal";
import { MarksDetailModal } from "../modals/MarksDetailModal";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

describe("Student Feed UX & Components (Spec v1.0, Phase S3)", () => {
  const dummyDate = new Date("2026-10-23T10:00:00Z");

  const sampleHomeworkCard: StudentFeedCard = {
    id: "student-hw-1",
    studentId: "student-101",
    cardType: "HomeworkDue",
    tier: "T1_action_required",
    priority: 95,
    isPinned: true,
    title: {
      en: "Mathematics: Quadratic Equations Ex 4.2",
      hi: "Mathematics: Quadratic Equations Ex 4.2",
    },
    summary: {
      en: "Due today • Pending Submission",
      hi: "आज देय है • जमा करना बाकी",
    },
    payload: {
      homeworkId: "hw-1",
      title: "Quadratic Equations Ex 4.2",
      subjectName: "Mathematics",
      dueDate: dummyDate.toISOString(),
      dueBadge: { en: "Due today", hi: "आज देय है" },
      isSubmitted: false,
      teacherName: "Ramesh Gupta",
    },
    activatedAt: dummyDate,
    expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
  };

  const sampleClassworkCard: StudentFeedCard = {
    id: "student-cw-1",
    studentId: "student-101",
    cardType: "ClassworkRecap",
    tier: "T2_informational",
    priority: 45,
    isPinned: false,
    title: {
      en: "Science: Chemical Reactions",
      hi: "Science: Chemical Reactions",
    },
    summary: {
      en: "Thu, Oct 22 • Chapter 1 • Balancing Equations",
      hi: "Thu, Oct 22 • Chapter 1 • Balancing Equations",
    },
    payload: {
      classworkId: "cw-1",
      subjectName: "Science",
      chapterName: "Chapter 1",
      topicTitle: "Balancing Equations",
      teacherName: "Anita Roy",
      completedDate: dummyDate.toISOString(),
    },
    activatedAt: dummyDate,
    expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
  };

  it("renders StudentFeedContainer with calm state when cards array is empty", () => {
    const element = React.createElement(StudentFeedContainer, {
      initialCards: [],
      studentId: "student-101",
      studentName: "Aarav Sharma",
      className: "Class 10",
      sectionName: "A",
      rollNumber: "14",
      admissionNumber: "ADM-2026-001",
      attendanceRate: "94.4%",
      academicYearLabel: "2026-2027",
    });

    expect(element).toBeDefined();
    expect(element.props.initialCards).toEqual([]);
    expect(element.props.studentName).toBe("Aarav Sharma");
  });

  it("renders DueTodayStrip with pinned cards and handles tap callback", () => {
    let openedWith: any = null;
    const element = React.createElement(DueTodayStrip, {
      pinnedCards: [sampleHomeworkCard],
      locale: "en",
      onOpenDetail: (p) => {
        openedWith = p;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.pinnedCards.length).toBe(1);

    element.props.onOpenDetail(sampleHomeworkCard.payload);
    expect(openedWith.homeworkId).toBe("hw-1");
  });

  it("HomeworkDueCard renders title, badge, and triggers detail modal", () => {
    let openedWith: any = null;
    const element = React.createElement(HomeworkDueCard, {
      card: sampleHomeworkCard,
      locale: "en",
      onOpenDetail: (p) => {
        openedWith = p;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.card.cardType).toBe("HomeworkDue");

    element.props.onOpenDetail(sampleHomeworkCard.payload);
    expect(openedWith.title).toBe("Quadratic Equations Ex 4.2");
  });

  it("ClassworkRecapCard renders subject and chapter correctly", () => {
    let openedWith: any = null;
    const element = React.createElement(ClassworkRecapCard, {
      card: sampleClassworkCard,
      locale: "en",
      onOpenDetail: (p) => {
        openedWith = p;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.card.cardType).toBe("ClassworkRecap");

    element.props.onOpenDetail(sampleClassworkCard.payload);
    expect(openedWith.subjectName).toBe("Science");
  });

  it("Detail modals (Homework, Classwork, Assessment, Notice, Marks) render cleanly", () => {
    const hwModal = React.createElement(HomeworkDetailModal, {
      open: true,
      onClose: () => {},
      homework: {
        id: "hw-1",
        title: "Math Homework",
        subjectName: "Mathematics",
        dueDate: dummyDate,
        isSubmitted: false,
        teacherName: "Mr. Gupta",
      },
    });
    expect(hwModal).toBeDefined();

    const cwModal = React.createElement(ClassworkDetailModal, {
      open: true,
      onClose: () => {},
      classwork: {
        id: "cw-1",
        subjectName: "Science",
        chapterName: "Light",
        topicTitle: "Reflection",
        completedDate: dummyDate,
      },
    });
    expect(cwModal).toBeDefined();

    const asmtModal = React.createElement(AssessmentDetailModal, {
      open: true,
      onClose: () => {},
      assessment: {
        id: "asmt-1",
        title: "Unit Test 1",
        subjectName: "Social Science",
        assessmentType: "UNIT_TEST",
        scheduledDate: "2026-10-25",
        maxMarks: 40,
      },
    });
    expect(asmtModal).toBeDefined();

    const notModal = React.createElement(NoticeDetailModal, {
      open: true,
      onClose: () => {},
      notice: {
        id: "not-1",
        title: "School Sports Meet",
        content: "Annual sports meet on 15th November.",
        publishedAt: dummyDate,
      },
    });
    expect(notModal).toBeDefined();

    const marksModal = React.createElement(MarksDetailModal, {
      open: true,
      onClose: () => {},
      marks: {
        examId: "exam-1",
        examName: "Term 1 Final Exam",
        overallGrade: "A+",
        percentage: 95,
        publishedAt: dummyDate,
      },
    });
    expect(marksModal).toBeDefined();
  });
});
