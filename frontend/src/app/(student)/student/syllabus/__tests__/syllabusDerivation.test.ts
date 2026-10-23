import { describe, it, expect } from "vitest";
import {
  deriveTopicSyllabusStatus,
  calculateSyllabusProgress,
  type SyllabusTopicStatus,
} from "../../../../../lib/studentEventEngine/syllabusDerivation";

describe("Phase S6: Syllabus Derivation & Tracker (BR8, AC-13)", () => {
  describe("deriveTopicSyllabusStatus", () => {
    const completedTopicIds = new Set(["topic-1", "topic-2"]);
    const plannedTopicIds = new Set(["topic-3", "topic-4"]);

    it("derives 'TAUGHT' when a completed lesson plan exists for the topic", () => {
      const status = deriveTopicSyllabusStatus({
        topicId: "topic-1",
        completedTopicIds,
        plannedTopicIds,
      });
      expect(status).toBe("TAUGHT");
    });

    it("derives 'NEXT' when a planned lesson plan exists for the topic", () => {
      const status = deriveTopicSyllabusStatus({
        topicId: "topic-3",
        completedTopicIds,
        plannedTopicIds,
      });
      expect(status).toBe("NEXT");
    });

    it("derives 'UPCOMING' when no lesson plan exists yet for the topic", () => {
      const status = deriveTopicSyllabusStatus({
        topicId: "topic-5",
        completedTopicIds,
        plannedTopicIds,
      });
      expect(status).toBe("UPCOMING");
    });

    it("prioritizes 'TAUGHT' if a topic appears in both completed and planned sets", () => {
      const overlapCompleted = new Set(["topic-dup"]);
      const overlapPlanned = new Set(["topic-dup"]);

      const status = deriveTopicSyllabusStatus({
        topicId: "topic-dup",
        completedTopicIds: overlapCompleted,
        plannedTopicIds: overlapPlanned,
      });
      expect(status).toBe("TAUGHT");
    });
  });

  describe("calculateSyllabusProgress", () => {
    it("returns 0% when there are no topics in the subject", () => {
      const progress = calculateSyllabusProgress([]);
      expect(progress.totalTopics).toBe(0);
      expect(progress.taughtTopics).toBe(0);
      expect(progress.coveragePercentage).toBe(0);
    });

    it("calculates exact taught percentage and breakdown", () => {
      const topics: Array<{ status: SyllabusTopicStatus }> = [
        { status: "TAUGHT" },
        { status: "TAUGHT" },
        { status: "TAUGHT" },
        { status: "NEXT" },
        { status: "UPCOMING" },
      ];

      const progress = calculateSyllabusProgress(topics);
      expect(progress.totalTopics).toBe(5);
      expect(progress.taughtTopics).toBe(3);
      expect(progress.nextTopics).toBe(1);
      expect(progress.upcomingTopics).toBe(1);
      // 3/5 = 60%
      expect(progress.coveragePercentage).toBe(60);
    });

    it("rounds coverage percentage to the nearest integer", () => {
      const topics: Array<{ status: SyllabusTopicStatus }> = [
        { status: "TAUGHT" },
        { status: "UPCOMING" },
        { status: "UPCOMING" },
      ];

      const progress = calculateSyllabusProgress(topics);
      // 1/3 = 33.333% -> 33%
      expect(progress.coveragePercentage).toBe(33);
    });

    it("reports 100% when all topics are taught", () => {
      const topics: Array<{ status: SyllabusTopicStatus }> = [
        { status: "TAUGHT" },
        { status: "TAUGHT" },
      ];

      const progress = calculateSyllabusProgress(topics);
      expect(progress.coveragePercentage).toBe(100);
      expect(progress.nextTopics).toBe(0);
      expect(progress.upcomingTopics).toBe(0);
    });
  });
});
