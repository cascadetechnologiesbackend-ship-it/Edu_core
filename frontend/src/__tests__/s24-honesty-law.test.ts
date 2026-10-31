import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Sprint S24 Layer 9: Teacher Feed Identity Truth & Honesty Law Scanner", () => {
  const getFileContent = (relativePath: string) => {
    const fullPath = path.resolve(__dirname, "../../", relativePath);
    return fs.readFileSync(fullPath, "utf-8");
  };

  describe("1. Snapshot Assembler Honesty & Zero Placeholder Law", () => {
    const content = getFileContent("../backend/src/lib/teacherEventEngine/snapshotAssembler.ts");

    it("verifies zero identity-blind placeholders exist in snapshot assembler source", () => {
      // Prior placeholders:
      // studentName: "Student" (pendingLeaveRequests & ptmBookingsToday)
      // sectionName: "Section" (ptmBookingsToday)
      // subjectName: "Subject" (marksEntryWindows)
      // maxMarks: 100 (hardcoded default in marksEntryWindows)
      expect(content).not.toMatch(/studentName:\s*["']Student["']/);
      expect(content).not.toMatch(/sectionName:\s*["']Section["']/);
      expect(content).not.toMatch(/subjectName:\s*["']Subject["']/);
      expect(content).not.toMatch(/maxMarks:\s*100\b/);
    });

    it("verifies integration of shared identity resolver functions", () => {
      expect(content).toContain("batchResolveStudentIdentities");
      expect(content).toContain("batchResolveSectionContexts");
      expect(content).toContain("batchResolveSubjectContexts");
    });

    it("verifies substitution conflict engine integration", () => {
      expect(content).toContain("checkSubstitutionClash");
      expect(content).toContain("hasConflict");
      expect(content).toContain("conflictReason");
    });

    it("verifies dead card snapshot assemblies are populated", () => {
      // HomeworkDueCard snapshot data
      expect(content).toContain("upcomingHomeworkDue");
      // ClassworkPendingCard snapshot data
      expect(content).toContain("pendingClassworkPeriods");
      // InsightCard snapshot models
      expect(content).toContain("insights");
    });
  });

  describe("2. Derive Feed Logic: 12/12 Card Types Coverage", () => {
    const content = getFileContent("../backend/src/lib/teacherEventEngine/deriveTeacherFeed.ts");

    const all12CardTypes = [
      "AttendanceNowCard",
      "NowNextCard",
      "GradingQueueCard",
      "MarksEntryCard",
      "LeaveQueueCard",
      "SubstitutionCard",
      "PTMTodayCard",
      "MessagesCard",
      "InsightCard",
      "NoticeCard",
      "HomeworkDueCard",
      "ClassworkPendingCard",
    ];

    it.each(all12CardTypes)("verifies derivation logic exists for card type %s", (cardType) => {
      expect(content).toContain(`cardType: "${cardType}"`);
    });
  });

  describe("3. TeacherFeedContainer: 12/12 Component Mapping Coverage", () => {
    const content = getFileContent("src/components/teacher/TeacherFeedContainer.tsx");

    const all12CardComponents = [
      "AttendanceNowFeedCard",
      "NowNextFeedCard",
      "GradingQueueFeedCard",
      "MarksEntryFeedCard",
      "LeaveQueueFeedCard",
      "SubstitutionFeedCard",
      "PTMTodayFeedCard",
      "MessagesFeedCard",
      "InsightFeedCard",
      "NoticeFeedCard",
      "HomeworkDueFeedCard",
      "ClassworkPendingFeedCard",
    ];

    it.each(all12CardComponents)("verifies feed container imports and renders %s", (component) => {
      expect(content).toContain(component);
    });
  });
});

