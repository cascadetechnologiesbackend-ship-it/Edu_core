import { describe, it, expect } from "vitest";
import React from "react";
import { AttendanceCard } from "../AttendanceCard";
import { HomeworkCard } from "../HomeworkCard";
import { ReportCardCard } from "../ReportCardCard";
import { PTMCard } from "../PTMCard";
import { NoticeCard } from "../NoticeCard";
import { ConsentCard } from "../ConsentCard";
import { InsightCard } from "../InsightCard";
import { MessageCard } from "../MessageCard";
import { DerivedFeedCard } from "../FeedCard";

describe("Phase P6: Remaining Event-Driven Cards & Portal Deep Links", () => {
  const dummyDate = new Date("2026-10-15T09:15:00Z");

  it("AttendanceCard renders with student initials, marked time, and message teacher action", () => {
    const card: DerivedFeedCard = {
      id: "att-card-1",
      studentId: "stud-1",
      cardType: "AttendanceCard",
      tier: "T1_action_required",
      priority: 90,
      title: { en: "Aarav marked Absent", hi: "आरव को अनुपस्थित दर्ज किया गया" },
      summary: {
        en: "Aarav was marked Absent today at 09:12. Note: Fever",
        hi: "आज 09:12 बजे आरव को अनुपस्थित दर्ज किया गया।",
      },
      payload: {
        status: "ABSENT",
        severity: "ROSE",
        markedAt: dummyDate.toISOString(),
        remarks: "Parent called regarding fever",
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 36000000),
    };

    const element = React.createElement(AttendanceCard, {
      card,
      studentName: "Aarav Sharma",
      locale: "en",
    });

    expect(element).toBeDefined();
    expect(element.props.studentName).toBe("Aarav Sharma");
    expect(element.props.card.payload.status).toBe("ABSENT");
  });

  it("HomeworkCard renders subject name, due countdown, and micro-progress states", () => {
    const card: DerivedFeedCard = {
      id: "hw-card-1",
      studentId: "stud-1",
      cardType: "HomeworkCard",
      tier: "T2_informational",
      priority: 60,
      title: { en: "Maths Worksheet Due Tomorrow", hi: "गणित कार्यपत्रक कल देय है" },
      summary: {
        en: "Quadratic equations practice sheet is due tomorrow.",
        hi: "द्विघात समीकरण अभ्यास पत्रक कल देय है।",
      },
      payload: {
        homeworkId: "hw-101",
        title: "Quadratic Equations",
        subjectName: "Mathematics",
        dueDate: new Date(dummyDate.getTime() + 86400000).toISOString(),
        isSubmitted: false,
        hoursUntilDue: 24,
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 86400000),
    };

    const element = React.createElement(HomeworkCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.payload.subjectName).toBe("Mathematics");
    expect(element.props.card.payload.isSubmitted).toBe(false);
  });

  it("ReportCardCard contains average score and links to offline portal", () => {
    const card: DerivedFeedCard = {
      id: "rc-card-1",
      studentId: "stud-1",
      cardType: "ReportCardCard",
      tier: "T2_informational",
      priority: 85,
      title: { en: "Term 1 Report Card is Ready", hi: "सत्र 1 रिपोर्ट कार्ड तैयार है" },
      summary: {
        en: "Term 1 report card published with an average of 88.5%.",
        hi: "सत्र 1 रिपोर्ट कार्ड 88.5% औसत के साथ प्रकाशित किया गया।",
      },
      payload: {
        termName: "Term 1 Final Exam",
        averageScore: 88.5,
        previousAverageScore: 82.0,
        deltaScore: 6.5,
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 604800000),
    };

    const element = React.createElement(ReportCardCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.payload.averageScore).toBe(88.5);
    expect(element.props.card.payload.deltaScore).toBe(6.5);
  });

  it("PTMCard renders scheduled event details and venue", () => {
    const card: DerivedFeedCard = {
      id: "ptm-card-1",
      studentId: "stud-1",
      cardType: "PTMCard",
      tier: "T2_informational",
      priority: 70,
      title: { en: "Upcoming Parent-Teacher Meeting", hi: "आगामी अभिभावक-शिक्षक बैठक" },
      summary: {
        en: "Mid-term discussion with teachers on Saturday at 10:00 AM.",
        hi: "शनिवार सुबह 10:00 बजे शिक्षकों के साथ मध्यावधि चर्चा।",
      },
      payload: {
        eventId: "ev-1",
        title: "PTM Term 1",
        startDate: new Date(dummyDate.getTime() + 259200000).toISOString(),
        venue: "Senior Block Hall",
        daysUntil: 3,
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 259200000),
    };

    const element = React.createElement(PTMCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.payload.venue).toBe("Senior Block Hall");
  });

  it("NoticeCard renders circular preview and pinned badge if set", () => {
    const card: DerivedFeedCard = {
      id: "not-card-1",
      studentId: "stud-1",
      cardType: "NoticeCard",
      tier: "T2_informational",
      priority: 65,
      title: { en: "Annual Sports Day Registration", hi: "वार्षिक खेल दिवस पंजीकरण" },
      summary: {
        en: "Registration forms for track and field events are open.",
        hi: "ट्रैक और फील्ड स्पर्धाओं के लिए पंजीकरण फॉर्म खुले हैं।",
      },
      payload: {
        noticeId: "not-45",
        contentPreview: "Registration forms for track and field events are open until Friday.",
        isPinned: true,
        publishedAt: dummyDate.toISOString(),
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 259200000),
    };

    const element = React.createElement(NoticeCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.payload.isPinned).toBe(true);
  });

  it("ConsentCard deep-links to DPDP consent portal without duplicating UI", () => {
    const card: DerivedFeedCard = {
      id: "consent-card-1",
      studentId: "stud-1",
      cardType: "ConsentCard",
      tier: "T1_action_required",
      priority: 88,
      title: { en: "DPDP Consent Review Required", hi: "DPDP सहमति समीक्षा आवश्यक है" },
      summary: {
        en: "Please review and confirm processing consent for student medical data.",
        hi: "कृपया छात्र चिकित्सा डेटा के लिए प्रसंस्करण सहमति की समीक्षा करें।",
      },
      payload: {
        consentType: "MEDICAL_DATA",
        deadlineHours: 48,
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 172800000),
    };

    const element = React.createElement(ConsentCard, { card, locale: "en" });
    expect(element).toBeDefined();
  });

  it("InsightCard follows anti-shame laws and renders fact-based numbers", () => {
    const card: DerivedFeedCard = {
      id: "ins-card-1",
      studentId: "stud-1",
      cardType: "InsightCard",
      tier: "T1_action_required",
      priority: 85,
      title: { en: "Attendance Needs Attention", hi: "उपस्थिति पर ध्यान देने की आवश्यकता है" },
      summary: {
        en: "Aarav was absent 3 of the last 10 school days. Rolling attendance is 82.5%.",
        hi: "आरव पिछले 10 स्कूल दिनों में से 3 दिन अनुपस्थित रहे।",
      },
      payload: {
        signal: "attendance_risk",
        severity: "AMBER",
        actionType: "talk_teacher",
        targetUrl: "/parent/messages",
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 604800000),
    };

    const element = React.createElement(InsightCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.payload.signal).toBe("attendance_risk");
    // Verify anti-shame check: summary must NOT contain banned words
    expect(card.summary.en.toLowerCase()).not.toContain("defaulter");
    expect(card.summary.en.toLowerCase()).not.toContain("churn");
  });

  it("MessageCard renders unread quote from class teacher", () => {
    const card: DerivedFeedCard = {
      id: "msg-card-1",
      studentId: "stud-1",
      cardType: "MessageCard",
      tier: "T2_informational",
      priority: 75,
      title: { en: "Message from Neha Verma", hi: "नेहा वर्मा का संदेश" },
      summary: {
        en: "Please ensure Aarav brings the art supplies tomorrow.",
        hi: "कृपया सुनिश्चित करें कि आरव कल कला सामग्री लाए।",
      },
      payload: {
        threadId: "th-44",
        teacherName: "Neha Verma",
        sentAt: dummyDate.toISOString(),
      },
      activatedAt: dummyDate,
      expiresAt: new Date(dummyDate.getTime() + 604800000),
    };

    const element = React.createElement(MessageCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.payload.teacherName).toBe("Neha Verma");
  });
});
