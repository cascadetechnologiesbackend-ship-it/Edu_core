/**
 * Canonical Academic Ordering & Classification Engine
 * Strictly organizes K-12 classrooms according to Indian educational standards:
 * 1. Pre-Primary (Playgroup, Nursery, LKG, UKG)
 * 2. Primary / Lower Primary (Class 1 – Class 5)
 * 3. Higher Primary / Middle School (Class 6 – Class 8)
 * 4. High School / Secondary (Class 9 – Class 10)
 * 5. Senior Secondary / Higher Secondary (Class 11 – Class 12)
 */

export type AcademicBlockKey =
  | "all"
  | "pre_primary"
  | "primary"
  | "middle_school"
  | "high_school";

/**
 * Returns a strictly monotonic numerical rank for sorting classes in canonical order.
 */
export function getCanonicalSortOrder(gradeLevel: string = "", displayName: string = ""): number {
  const norm = (gradeLevel || "").toUpperCase().trim();
  const nameNorm = (displayName || "").toLowerCase().trim();

  // 1. Foundational / Pre-Primary
  if (norm === "PLAYGROUP" || /playgroup|pg\b/.test(nameNorm)) return 1;
  if (norm === "PRE_KG" || /pre-kg|prekg/.test(nameNorm)) return 2;
  if (norm === "NURSERY" || /nursery/.test(nameNorm)) return 3;
  if (norm === "LKG" || /lkg|pp1\b|kindergarten 1|kg 1/.test(nameNorm)) return 4;
  if (norm === "UKG" || /ukg|pp2\b|kindergarten 2|kg 2/.test(nameNorm)) return 5;

  // 2. Exact standard number extraction with word boundaries (\b)
  // Ensures "Class 10" produces 10 and not 1
  const numMatch = nameNorm.match(/\b(?:class|grade|std|standard)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numMatch && numMatch[1]) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 12) {
      return 10 + n; // Class 1 -> 11, Class 5 -> 15, Class 6 -> 16, Class 10 -> 20, Class 12 -> 22
    }
  }

  // 3. Fallback by canonical gradeLevel enum key
  const gradeLevelOrder: Record<string, number> = {
    PLAYGROUP: 1,
    PRE_KG: 2,
    NURSERY: 3,
    LKG: 4,
    UKG: 5,
    CLASS_1: 11,
    CLASS_2: 12,
    CLASS_3: 13,
    CLASS_4: 14,
    CLASS_5: 15,
    CLASS_6: 16,
    CLASS_7: 17,
    CLASS_8: 18,
    CLASS_9: 19,
    CLASS_10: 20,
    CLASS_11: 21,
    CLASS_12: 22,
  };

  if (gradeLevelOrder[norm]) {
    return gradeLevelOrder[norm];
  }

  return 99;
}

/**
 * Classifies a classroom into its canonical educational block.
 * Uses exact standard number parsing with word boundaries to prevent 'Class 10' from matching 'Class 1'.
 */
export function getGradeBlock(gradeLevel: string = "", displayName: string = ""): AcademicBlockKey {
  const normGrade = (gradeLevel || "").toUpperCase().trim();
  const normName = (displayName || "").toLowerCase().trim();

  // 1. Exact gradeLevel enum checks
  if (["NURSERY", "LKG", "UKG", "PRE_KG", "PLAYGROUP"].includes(normGrade)) {
    return "pre_primary";
  }
  if (["CLASS_9", "CLASS_10", "GRADE_9", "GRADE_10"].includes(normGrade)) {
    return "high_school";
  }
  if (["CLASS_6", "CLASS_7", "CLASS_8", "GRADE_6", "GRADE_7", "GRADE_8"].includes(normGrade)) {
    return "middle_school"; // Higher Primary
  }
  if (
    ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5", "GRADE_1", "GRADE_2", "GRADE_3", "GRADE_4", "GRADE_5"].includes(
      normGrade,
    )
  ) {
    return "primary";
  }

  // 2. Pre-primary semantic keyword detection
  if (/nursery|lkg|ukg|playgroup|pre-kg|prekg|pp1\b|pp2\b|pre-primary|pre primary|foundational/.test(normName)) {
    return "pre_primary";
  }

  // 3. Extract exact integer standard from display name using word boundaries (\b)
  const numMatch = normName.match(/\b(?:class|grade|std|standard)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numMatch && numMatch[1]) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 9 && num <= 10) return "high_school";
    if (num >= 6 && num <= 8) return "middle_school"; // Higher Primary
    if (num >= 1 && num <= 5) return "primary";
  }

  // 4. Semantic textual fallback
  if (/high school|secondary|highschool/.test(normName)) return "high_school";
  if (/higher primary|middle school|upper primary|middle/.test(normName)) return "middle_school";
  if (/primary|lower primary/.test(normName)) return "primary";

  return "primary";
}
