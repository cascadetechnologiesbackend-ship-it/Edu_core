/**
 * Pure helper functions for deriving syllabus topic statuses and subject progress.
 * Invariant (BR8, AC-13):
 *  - "TAUGHT" derives from completed lesson plans (status = 'COMPLETED')
 *  - "NEXT" derives from planned lesson plans (status = 'PLANNED' or 'IN_PROGRESS')
 *  - "UPCOMING" when no lesson plan exists yet for the topic
 *  - Zero mutation surface for students (read-only)
 */

export type SyllabusTopicStatus = "TAUGHT" | "NEXT" | "UPCOMING";

export interface TopicStatusInput {
  topicId: string;
  completedTopicIds: Set<string>;
  plannedTopicIds: Set<string>;
}

export function deriveTopicSyllabusStatus(input: TopicStatusInput): SyllabusTopicStatus {
  const { topicId, completedTopicIds, plannedTopicIds } = input;

  if (completedTopicIds.has(topicId)) {
    return "TAUGHT";
  }

  if (plannedTopicIds.has(topicId)) {
    return "NEXT";
  }

  return "UPCOMING";
}

export interface SyllabusProgressSummary {
  totalTopics: number;
  taughtTopics: number;
  nextTopics: number;
  upcomingTopics: number;
  coveragePercentage: number;
}

export function calculateSyllabusProgress(
  topics: Array<{ status: SyllabusTopicStatus }>
): SyllabusProgressSummary {
  const totalTopics = topics.length;
  if (totalTopics === 0) {
    return {
      totalTopics: 0,
      taughtTopics: 0,
      nextTopics: 0,
      upcomingTopics: 0,
      coveragePercentage: 0,
    };
  }

  let taught = 0;
  let next = 0;
  let upcoming = 0;

  for (const t of topics) {
    if (t.status === "TAUGHT") taught++;
    else if (t.status === "NEXT") next++;
    else upcoming++;
  }

  const coveragePercentage = Math.round((taught / totalTopics) * 100);

  return {
    totalTopics,
    taughtTopics: taught,
    nextTopics: next,
    upcomingTopics: upcoming,
    coveragePercentage,
  };
}
