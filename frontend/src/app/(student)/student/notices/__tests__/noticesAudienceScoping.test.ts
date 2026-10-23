import { describe, it, expect } from "vitest";
import { isNoticeInStudentScope } from "../../../../../lib/studentEventEngine/noticeScoping";

describe("Phase S6: Student Notices Audience Scoping (AC-12)", () => {
  const studentScope = {
    classId: "class-10",
    sectionId: "section-10-a",
  };

  it("includes notices targeted to ALL audiences", () => {
    const notice = {
      audienceType: "ALL",
    };
    expect(isNoticeInStudentScope(notice, studentScope)).toBe(true);
  });

  it("strictly excludes notices targeted to PARENTS, TEACHERS, or STAFF", () => {
    expect(
      isNoticeInStudentScope({ audienceType: "PARENTS" }, studentScope)
    ).toBe(false);
    expect(
      isNoticeInStudentScope({ audienceType: "TEACHERS" }, studentScope)
    ).toBe(false);
    expect(
      isNoticeInStudentScope({ audienceType: "STAFF" }, studentScope)
    ).toBe(false);
  });

  it("includes STUDENTS audience with no filter (school-wide student notice)", () => {
    const notice = {
      audienceType: "STUDENTS",
      audienceFilter: {},
    };
    expect(isNoticeInStudentScope(notice, studentScope)).toBe(true);
  });

  it("filters STUDENTS audience by target classId", () => {
    const matchingNotice = {
      audienceType: "STUDENTS",
      audienceFilter: { classId: "class-10" },
    };
    expect(isNoticeInStudentScope(matchingNotice, studentScope)).toBe(true);

    const nonMatchingNotice = {
      audienceType: "STUDENTS",
      audienceFilter: { classId: "class-12" },
    };
    expect(isNoticeInStudentScope(nonMatchingNotice, studentScope)).toBe(false);
  });

  it("filters STUDENTS audience by target classIds list", () => {
    const matchingList = {
      audienceType: "STUDENTS",
      audienceFilter: { classIds: ["class-9", "class-10", "class-11"] },
    };
    expect(isNoticeInStudentScope(matchingList, studentScope)).toBe(true);

    const nonMatchingList = {
      audienceType: "STUDENTS",
      audienceFilter: { classIds: ["class-11", "class-12"] },
    };
    expect(isNoticeInStudentScope(nonMatchingList, studentScope)).toBe(false);
  });

  it("filters STUDENTS audience by target sectionId", () => {
    const matchingSection = {
      audienceType: "STUDENTS",
      audienceFilter: { sectionId: "section-10-a" },
    };
    expect(isNoticeInStudentScope(matchingSection, studentScope)).toBe(true);

    const nonMatchingSection = {
      audienceType: "STUDENTS",
      audienceFilter: { sectionId: "section-10-b" },
    };
    expect(isNoticeInStudentScope(nonMatchingSection, studentScope)).toBe(false);
  });

  it("handles CLASS audience targeting correctly", () => {
    const matchingClassNotice = {
      audienceType: "CLASS",
      audienceFilter: { classId: "class-10" },
    };
    expect(isNoticeInStudentScope(matchingClassNotice, studentScope)).toBe(true);

    const otherClassNotice = {
      audienceType: "CLASS",
      audienceFilter: { classId: "class-9" },
    };
    expect(isNoticeInStudentScope(otherClassNotice, studentScope)).toBe(false);
  });

  it("handles SECTION audience targeting correctly", () => {
    const matchingSecNotice = {
      audienceType: "SECTION",
      audienceFilter: { sectionId: "section-10-a" },
    };
    expect(isNoticeInStudentScope(matchingSecNotice, studentScope)).toBe(true);

    const otherSecNotice = {
      audienceType: "SECTION",
      audienceFilter: { sectionId: "section-10-c" },
    };
    expect(isNoticeInStudentScope(otherSecNotice, studentScope)).toBe(false);
  });
});
