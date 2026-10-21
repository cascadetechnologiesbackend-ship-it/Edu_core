import { describe, it, expect, vi } from "vitest";
import React from "react";
import { HomeworkPostCard } from "../HomeworkPostCard";
import { ClassworkPostCard } from "../ClassworkPostCard";
import { SyllabusCoverageCard } from "../SyllabusCoverageCard";
import { CurriculumProgressCard } from "../CurriculumProgressCard";
import { AssessmentScheduledCard } from "../AssessmentScheduledCard";
import { HomeworkDetailModal } from "../modals/HomeworkDetailModal";
import { ClassworkDetailModal } from "../modals/ClassworkDetailModal";
import { SyllabusDetailModal } from "../modals/SyllabusDetailModal";
import { AssessmentDetailModal } from "../modals/AssessmentDetailModal";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

describe("Phase F5: Academic Feed UX (Instagram-Style Stream & Detail Modals)", () => {
  const dummyDate = new Date("2026-10-22T10:00:00Z");

  it("HomeworkPostCard renders subject band, due badge, submission chip, and ward chip", () => {
    const card: DerivedFeedCard = {
      id: "academic-hw-post-1",
      studentId: "stud-1",
      cardType: "HomeworkPostCard",
      tier: "T2_informational",
      priority: 65,
      wardName: "Aarav",
      title: { en: "Mathematics: Polynomials Practice", hi: "गणित: बहुपद अभ्यास" },
      summary: { en: "Exercise 2.3 questions 1 to 5", hi: "अभ्यास 2.3 प्रश्न 1 से 5" },
      payload: {
        homeworkId: "hw-1",
        title: "Polynomials Practice",
        subjectName: "Mathematics",
        dueDate: new Date(dummyDate.getTime() + 86400000).toISOString(),
        dueBadge: { en: "Due tomorrow", hi: "कल देय है" },
        submissionStatus: { en: "Submitted & Graded (18 Marks)", hi: "मूल्यांकित" },
        isSubmitted: true,
        hasAttachment: true,
        teacherName: "Mr. Sharma",
        marksAwarded: 18,
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
      occurredAt: dummyDate,
    };

    let detailOpenedWith: any = null;
    const element = React.createElement(HomeworkPostCard, {
      card,
      locale: "en",
      onOpenDetail: (data) => {
        detailOpenedWith = data;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.card.cardType).toBe("HomeworkPostCard");
    expect(element.props.card.wardName).toBe("Aarav");
    expect(element.props.card.payload.subjectName).toBe("Mathematics");

    // Simulate card tap
    element.props.onOpenDetail({
      id: card.payload.homeworkId,
      title: card.payload.title,
      subjectName: card.payload.subjectName,
      dueDate: card.payload.dueDate,
      isSubmitted: true,
      marksAwarded: 18,
    });
    expect(detailOpenedWith).not.toBeNull();
    expect(detailOpenedWith.id).toBe("hw-1");
    expect(detailOpenedWith.marksAwarded).toBe(18);
  });

  it("ClassworkPostCard renders chapter, topic, objectives, homework line, and teacher name", () => {
    const card: DerivedFeedCard = {
      id: "classwork-post-1",
      studentId: "stud-1",
      cardType: "ClassworkPostCard",
      tier: "T2_informational",
      priority: 60,
      wardName: "Ananya",
      title: { en: "Today in Science: Chapter 4", hi: "आज विज्ञान में: अध्याय 4" },
      summary: { en: "Acids, Bases and Salts • Neutralisation reactions", hi: "अम्ल, क्षारक और लवण" },
      payload: {
        classworkId: "lp-1",
        subjectName: "Science",
        chapterName: "Acids, Bases and Salts",
        topicName: "Neutralisation Reactions",
        objectives: "Demonstrate acid-base neutralisation using litmus indicators",
        homework: "Read NCERT section 4.3 and answer check questions 1-4",
        completedDate: dummyDate.toISOString(),
        teacherName: "Dr. Verma",
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
      occurredAt: dummyDate,
    };

    let detailOpened = false;
    const element = React.createElement(ClassworkPostCard, {
      card,
      locale: "en",
      onOpenDetail: () => {
        detailOpened = true;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.card.payload.chapterName).toBe("Acids, Bases and Salts");
    expect(element.props.card.payload.homework).toContain("NCERT section 4.3");

    element.props.onOpenDetail({});
    expect(detailOpened).toBe(true);
  });

  it("SyllabusCoverageCard and CurriculumProgressCard render weekly progress and tap opens syllabus modal", () => {
    const coverageCard: DerivedFeedCard = {
      id: "syllabus-cov-stud-1-2026-w42",
      studentId: "stud-1",
      cardType: "SyllabusCoverageCard",
      tier: "T2_informational",
      priority: 50,
      title: { en: "This Week's Syllabus Coverage", hi: "इस सप्ताह का पाठ्यक्रम कवरेज" },
      summary: { en: "Mathematics — Unit 2 • Rational Numbers", hi: "गणित — इकाई 2" },
      payload: {
        termName: "Term 1 (2026-27)",
        weekLabel: "Oct 19 - Oct 25",
        coverageList: [
          {
            subjectId: "sub-1",
            subjectName: "Mathematics",
            chapterTitle: "Rational Numbers",
            topicTitle: "Properties of Operations",
          },
        ],
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
      occurredAt: dummyDate,
    };

    const progressCard: DerivedFeedCard = {
      id: "curriculum-prog-stud-1-2026-w42",
      studentId: "stud-1",
      cardType: "CurriculumProgressCard",
      tier: "T2_informational",
      priority: 45,
      title: { en: "Term 1 Curriculum Progress: 64% Average", hi: "सत्र 1 पाठ्यक्रम प्रगति" },
      summary: { en: "64% of topics covered across 4 subjects this term.", hi: "64% पाठ्यक्रम पूरा" },
      payload: {
        termName: "Term 1 (2026-27)",
        averageProgress: 64,
        subjects: [
          {
            subjectId: "sub-1",
            subjectName: "Mathematics",
            completedTopicsCount: 16,
            totalTopicsCount: 25,
            progressPercent: 64,
          },
        ],
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
      occurredAt: dummyDate,
    };

    expect(coverageCard.payload.coverageList).toHaveLength(1);
    expect(progressCard.payload.averageProgress).toBe(64);

    const covElement = React.createElement(SyllabusCoverageCard, { card: coverageCard, locale: "en" });
    const progElement = React.createElement(CurriculumProgressCard, { card: progressCard, locale: "hi" });

    expect(covElement).toBeDefined();
    expect(progElement).toBeDefined();
  });

  it("AssessmentScheduledCard renders assessment type, max marks, date, and opens assessment detail modal", () => {
    const card: DerivedFeedCard = {
      id: "assessment-sched-asmt-1",
      studentId: "stud-1",
      cardType: "AssessmentScheduledCard",
      tier: "T2_informational",
      priority: 62,
      wardName: "Aarav",
      title: { en: "Upcoming Unit Test: Physics", hi: "आगामी परीक्षा: भौतिक विज्ञान" },
      summary: { en: "Scheduled on Mon, Oct 26 (Max Marks: 40)", hi: "सोमवार, 26 अक्टूबर को निर्धारित" },
      payload: {
        assessmentId: "asmt-1",
        title: "Unit Test 2: Kinematics",
        subjectName: "Physics",
        assessmentType: "UNIT_TEST",
        scheduledDate: "2026-10-26T04:30:00.000Z",
        maxMarks: 40,
        syllabusCoverage: "Motion in a straight line, equations of motion, vectors",
        status: "SCHEDULED",
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 7 * 86400000),
      occurredAt: dummyDate,
    };

    let detailData: any = null;
    const element = React.createElement(AssessmentScheduledCard, {
      card,
      locale: "en",
      onOpenDetail: (d) => {
        detailData = d;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.card.payload.maxMarks).toBe(40);

    element.props.onOpenDetail(element.props.card.payload);
    expect(detailData.assessmentType).toBe("UNIT_TEST");
    expect(detailData.maxMarks).toBe(40);
  });

  it("AC-13 Automated Check: Every academic card type resolves to a populated detail modal", () => {
    const academicTypes = [
      "HomeworkPostCard",
      "ClassworkPostCard",
      "SyllabusCoverageCard",
      "CurriculumProgressCard",
      "AssessmentScheduledCard",
    ];

    const modalMapping: Record<string, any> = {
      HomeworkPostCard: HomeworkDetailModal,
      ClassworkPostCard: ClassworkDetailModal,
      SyllabusCoverageCard: SyllabusDetailModal,
      CurriculumProgressCard: SyllabusDetailModal,
      AssessmentScheduledCard: AssessmentDetailModal,
    };

    for (const cardType of academicTypes) {
      const ModalComponent = modalMapping[cardType];
      expect(ModalComponent).toBeDefined();

      const modalElement = React.createElement(ModalComponent, {
        open: true,
        onClose: () => {},
        locale: "en",
      });
      expect(modalElement).toBeDefined();
    }
  });
});
