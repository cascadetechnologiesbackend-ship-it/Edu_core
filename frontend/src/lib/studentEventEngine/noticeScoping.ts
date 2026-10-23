/**
 * Pure helper function to verify if a notice's audience targeting matches the student's scope.
 * Zero dependencies on next-auth or next/cache for clean testability and edge safety (AC-12).
 */
export function isNoticeInStudentScope(
  notice: {
    audienceType: string;
    audienceFilter?: any;
  },
  scope: {
    classId: string | null;
    sectionId: string | null;
  }
): boolean {
  const { audienceType, audienceFilter } = notice;
  const filter = audienceFilter || {};

  // 1. ALL audience reaches every student in the school
  if (audienceType === "ALL") {
    return true;
  }

  // 2. PARENTS, TEACHERS, STAFF audiences are strictly excluded from student view
  if (
    audienceType === "PARENTS" ||
    audienceType === "TEACHERS" ||
    audienceType === "STAFF"
  ) {
    return false;
  }

  // 3. STUDENTS audience
  if (audienceType === "STUDENTS") {
    // If targeted to specific classes
    if (filter.classId && scope.classId && filter.classId !== scope.classId) {
      return false;
    }
    if (
      Array.isArray(filter.classIds) &&
      filter.classIds.length > 0 &&
      (!scope.classId || !filter.classIds.includes(scope.classId))
    ) {
      return false;
    }
    // If targeted to specific sections
    if (filter.sectionId && scope.sectionId && filter.sectionId !== scope.sectionId) {
      return false;
    }
    if (
      Array.isArray(filter.sectionIds) &&
      filter.sectionIds.length > 0 &&
      (!scope.sectionId || !filter.sectionIds.includes(scope.sectionId))
    ) {
      return false;
    }
    return true;
  }

  // 4. CLASS audience
  if (audienceType === "CLASS") {
    if (!scope.classId) return false;
    if (filter.classId && filter.classId === scope.classId) return true;
    if (Array.isArray(filter.classIds) && filter.classIds.includes(scope.classId)) return true;
    return false;
  }

  // 5. SECTION audience
  if (audienceType === "SECTION") {
    if (!scope.sectionId) return false;
    if (filter.sectionId && filter.sectionId === scope.sectionId) return true;
    if (Array.isArray(filter.sectionIds) && filter.sectionIds.includes(scope.sectionId)) return true;
    return false;
  }

  return false;
}
