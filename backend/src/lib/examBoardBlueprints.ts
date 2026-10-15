/**
 * Pure Data Board Examination Blueprint Registry (Sprint S9)
 * 
 * Strict Architecture Boundary:
 * - PURE data and pure functions ONLY.
 * - Zero database imports, zero server-only dependencies.
 * - Safely importable by client-side Next.js components (e.g., Onboarding Wizard),
 *   background seeding engines, and test runners alike.
 */

export type SchoolBoard = "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";

export type GradingScale = "CBSE_9_POINT" | "PERCENTAGE" | "GPA";

export type ClassCategory =
  | "PRE_PRIMARY"
  | "PRIMARY"
  | "MIDDLE"
  | "SECONDARY"
  | "SENIOR_SECONDARY";

export type ClassGroup =
  | "NURSERY_UKG"
  | "CLASS_1_5"
  | "CLASS_6_8"
  | "CLASS_9_10"
  | "CLASS_11_12";

export type ExamTypeEnumValue =
  | "UNIT_TEST"
  | "HALF_YEARLY"
  | "ANNUAL"
  | "PRACTICAL"
  | "INTERNAL_ASSESSMENT"
  | "PRE_BOARD"
  | "ACTIVITY"
  | "QUARTERLY"
  | "FORMATIVE"
  | "SUMMATIVE";

export interface BlueprintExamType {
  name: string;
  code: string;
  examType: ExamTypeEnumValue;
  applicableClassGroups: ClassGroup[];
  weightPercent?: number;
  description: string;
}

export interface BlueprintGradeRule {
  minPercent: number;
  maxPercent: number;
  grade: string;
  gradePoint: number;
  description: string;
}

export interface BlueprintTermComponent {
  name: string;
  weightPercent: number;
  isPractical?: boolean;
}

export interface BlueprintTermItem {
  name: string;
  examTypeCode: string;
  applicableGroups: ClassGroup[];
  defaultProportion: number; // 0.0 to 1.0 within the academic year window
  components: BlueprintTermComponent[];
}

export interface BlueprintTermPlan {
  terms: BlueprintTermItem[];
}

export interface ExamBoardBlueprint {
  board: SchoolBoard;
  displayName: string;
  defaultGradingScale: GradingScale;
  examTypes: BlueprintExamType[];
  gradeScales: Record<ClassCategory, BlueprintGradeRule[]>;
  gradeScalesByOverride?: Partial<
    Record<GradingScale, Partial<Record<ClassCategory, BlueprintGradeRule[]>>>
  >;
  cocurricularAreas: Array<{ name: string; description: string }>;
  termPlan: BlueprintTermPlan;
}

// ─── Class Category & Group Mappings ──────────────────────────────────────────

export const CATEGORY_TO_GROUP: Record<ClassCategory, ClassGroup> = {
  PRE_PRIMARY: "NURSERY_UKG",
  PRIMARY: "CLASS_1_5",
  MIDDLE: "CLASS_6_8",
  SECONDARY: "CLASS_9_10",
  SENIOR_SECONDARY: "CLASS_11_12",
};

export const GROUP_TO_CATEGORY: Record<ClassGroup, ClassCategory> = {
  NURSERY_UKG: "PRE_PRIMARY",
  CLASS_1_5: "PRIMARY",
  CLASS_6_8: "MIDDLE",
  CLASS_9_10: "SECONDARY",
  CLASS_11_12: "SENIOR_SECONDARY",
};

export const ALL_CLASS_GROUPS: readonly ClassGroup[] = [
  "NURSERY_UKG",
  "CLASS_1_5",
  "CLASS_6_8",
  "CLASS_9_10",
  "CLASS_11_12",
] as const;

/**
 * Maps a canonical gradeLevel string (e.g. "NURSERY", "CLASS_1", "CLASS_10")
 * to its corresponding ClassGroup enum.
 */
export function mapGradeLevelToClassGroup(gradeLevel: string): ClassGroup {
  const norm = (gradeLevel || "").toUpperCase().trim().replace(/[-\s]+/g, "_");

  if (norm === "NURSERY" || norm === "LKG" || norm === "UKG" || norm.includes("NURS") || norm.includes("PRE_PRI")) {
    return "NURSERY_UKG";
  }

  const match = norm.match(/\d+/);
  if (match) {
    const classNum = parseInt(match[0], 10);
    if (classNum >= 1 && classNum <= 5) return "CLASS_1_5";
    if (classNum >= 6 && classNum <= 8) return "CLASS_6_8";
    if (classNum === 9 || classNum === 10) return "CLASS_9_10";
    if (classNum === 11 || classNum === 12) return "CLASS_11_12";
  }

  // Fallback defaults
  if (norm.includes("SEC") || norm.includes("HIGH")) return "CLASS_9_10";
  if (norm.includes("MID")) return "CLASS_6_8";
  if (norm.includes("PRI")) return "CLASS_1_5";

  return "CLASS_1_5";
}

/**
 * Derives the unique set of active ClassGroups from a list of provisioned classes.
 */
export function deriveClassGroupsFromClasses(
  classesList: Array<{ gradeLevel?: string | null; displayName?: string | null }>,
): ClassGroup[] {
  if (!classesList || classesList.length === 0) {
    return [...ALL_CLASS_GROUPS];
  }

  const set = new Set<ClassGroup>();
  for (const c of classesList) {
    const raw = c.gradeLevel || c.displayName || "";
    set.add(mapGradeLevelToClassGroup(raw));
  }

  // Preserve canonical hierarchy sort
  return ALL_CLASS_GROUPS.filter((g) => set.has(g));
}

// ─── Shared Qualitative Scales ───────────────────────────────────────────────

const QUALITATIVE_5_POINT: BlueprintGradeRule[] = [
  { minPercent: 90.0, maxPercent: 100.0, grade: "A*", gradePoint: 5.0, description: "Outstanding performance. Board default (editable)" },
  { minPercent: 75.0, maxPercent: 89.99, grade: "A", gradePoint: 4.0, description: "Very Good performance. Board default (editable)" },
  { minPercent: 56.0, maxPercent: 74.99, grade: "B", gradePoint: 3.0, description: "Good performance. Board default (editable)" },
  { minPercent: 35.0, maxPercent: 55.99, grade: "C", gradePoint: 2.0, description: "Developing performance. Board default (editable)" },
  { minPercent: 0.0, maxPercent: 34.99, grade: "D", gradePoint: 1.0, description: "Needs Support. Board default (editable)" },
];

const STANDARD_PERCENTAGE_DIVISIONS: BlueprintGradeRule[] = [
  { minPercent: 75.0, maxPercent: 100.0, grade: "Distinction", gradePoint: 0.0, description: "First Class with Distinction (75%+). Board default (editable)" },
  { minPercent: 60.0, maxPercent: 74.99, grade: "First Division", gradePoint: 0.0, description: "First Division (60-74%). Board default (editable)" },
  { minPercent: 45.0, maxPercent: 59.99, grade: "Second Division", gradePoint: 0.0, description: "Second Division (45-59%). Board default (editable)" },
  { minPercent: 33.0, maxPercent: 44.99, grade: "Pass Division", gradePoint: 0.0, description: "Third / Pass Division (33-44%). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 32.99, grade: "Essential Repeat", gradePoint: 0.0, description: "Essential Repeat (<33%). Board default (editable)" },
];

const STANDARD_10_POINT_GPA: BlueprintGradeRule[] = [
  { minPercent: 91.0, maxPercent: 100.0, grade: "A+", gradePoint: 10.0, description: "Outstanding (Grade Point 10.0). Board default (editable)" },
  { minPercent: 81.0, maxPercent: 90.99, grade: "A", gradePoint: 9.0, description: "Excellent (Grade Point 9.0). Board default (editable)" },
  { minPercent: 71.0, maxPercent: 80.99, grade: "B", gradePoint: 8.0, description: "Very Good (Grade Point 8.0). Board default (editable)" },
  { minPercent: 61.0, maxPercent: 70.99, grade: "C", gradePoint: 7.0, description: "Good (Grade Point 7.0). Board default (editable)" },
  { minPercent: 51.0, maxPercent: 60.99, grade: "D", gradePoint: 6.0, description: "Above Average (Grade Point 6.0). Board default (editable)" },
  { minPercent: 41.0, maxPercent: 50.99, grade: "E", gradePoint: 5.0, description: "Average (Grade Point 5.0). Board default (editable)" },
  { minPercent: 33.0, maxPercent: 40.99, grade: "P", gradePoint: 4.0, description: "Pass (Grade Point 4.0). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 32.99, grade: "F", gradePoint: 0.0, description: "Fail (Grade Point 0.0). Board default (editable)" },
];

// ─── 1. CBSE Blueprint ────────────────────────────────────────────────────────

const CBSE_BLUEPRINT: ExamBoardBlueprint = {
  board: "CBSE",
  displayName: "Central Board of Secondary Education (CBSE)",
  defaultGradingScale: "CBSE_9_POINT",
  examTypes: [
    {
      name: "Periodic Test",
      code: "PT",
      examType: "UNIT_TEST",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 10,
      description: "Periodic assessment and unit test. Board default (editable)",
    },
    {
      name: "Half-Yearly Examination",
      code: "HY",
      examType: "HALF_YEARLY",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 30,
      description: "Mid-term cumulative summative assessment. Board default (editable)",
    },
    {
      name: "Annual Examination",
      code: "ANN",
      examType: "ANNUAL",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 50,
      description: "End of year cumulative examination. Board default (editable)",
    },
    {
      name: "Practical & Lab Assessment",
      code: "PRAC",
      examType: "PRACTICAL",
      applicableClassGroups: ["CLASS_9_10", "CLASS_11_12"],
      weightPercent: 20,
      description: "Laboratory practical and viva examination. Board default (editable)",
    },
    {
      name: "Internal Assessment",
      code: "IA",
      examType: "INTERNAL_ASSESSMENT",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 20,
      description: "Subject enrichment, portfolio, and multiple assessment. Board default (editable)",
    },
    {
      name: "Pre-Board Examination",
      code: "PB",
      examType: "PRE_BOARD",
      applicableClassGroups: ["CLASS_9_10", "CLASS_11_12"],
      weightPercent: 100,
      description: "Comprehensive board pattern rehearsal examination. Board default (editable)",
    },
    {
      name: "Activity & Observation",
      code: "ACT_OBS",
      examType: "ACTIVITY",
      applicableClassGroups: ["NURSERY_UKG", "CLASS_1_5"],
      weightPercent: 100,
      description: "Foundational stage continuous observational assessment. Board default (editable)",
    },
  ],
  gradeScales: {
    PRE_PRIMARY: QUALITATIVE_5_POINT,
    PRIMARY: QUALITATIVE_5_POINT,
    MIDDLE: [
      { minPercent: 91.0, maxPercent: 100.0, grade: "A1", gradePoint: 10.0, description: "Top 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 81.0, maxPercent: 90.99, grade: "A2", gradePoint: 9.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 71.0, maxPercent: 80.99, grade: "B1", gradePoint: 8.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 61.0, maxPercent: 70.99, grade: "B2", gradePoint: 7.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 51.0, maxPercent: 60.99, grade: "C1", gradePoint: 6.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 41.0, maxPercent: 50.99, grade: "C2", gradePoint: 5.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 33.0, maxPercent: 40.99, grade: "D", gradePoint: 4.0, description: "Minimum passing grade. Board default (editable)" },
      { minPercent: 21.0, maxPercent: 32.99, grade: "E1", gradePoint: 0.0, description: "Needs improvement. Board default (editable)" },
      { minPercent: 0.0, maxPercent: 20.99, grade: "E2", gradePoint: 0.0, description: "Needs substantial improvement. Board default (editable)" },
    ],
    SECONDARY: [
      { minPercent: 91.0, maxPercent: 100.0, grade: "A1", gradePoint: 10.0, description: "Top 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 81.0, maxPercent: 90.99, grade: "A2", gradePoint: 9.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 71.0, maxPercent: 80.99, grade: "B1", gradePoint: 8.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 61.0, maxPercent: 70.99, grade: "B2", gradePoint: 7.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 51.0, maxPercent: 60.99, grade: "C1", gradePoint: 6.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 41.0, maxPercent: 50.99, grade: "C2", gradePoint: 5.0, description: "Next 1/8th of passed candidates. Board default (editable)" },
      { minPercent: 33.0, maxPercent: 40.99, grade: "D", gradePoint: 4.0, description: "Minimum passing grade. Board default (editable)" },
      { minPercent: 21.0, maxPercent: 32.99, grade: "E1", gradePoint: 0.0, description: "Needs improvement. Board default (editable)" },
      { minPercent: 0.0, maxPercent: 20.99, grade: "E2", gradePoint: 0.0, description: "Needs substantial improvement. Board default (editable)" },
    ],
    SENIOR_SECONDARY: STANDARD_PERCENTAGE_DIVISIONS,
  },
  gradeScalesByOverride: {
    PERCENTAGE: {
      MIDDLE: STANDARD_PERCENTAGE_DIVISIONS,
      SECONDARY: STANDARD_PERCENTAGE_DIVISIONS,
      SENIOR_SECONDARY: STANDARD_PERCENTAGE_DIVISIONS,
    },
    GPA: {
      MIDDLE: STANDARD_10_POINT_GPA,
      SECONDARY: STANDARD_10_POINT_GPA,
      SENIOR_SECONDARY: STANDARD_10_POINT_GPA,
    },
  },
  cocurricularAreas: [
    { name: "Work Education", description: "Work experience, health, and pre-vocational education. Board default (editable)" },
    { name: "Art Education", description: "Visual and performing arts expression. Board default (editable)" },
    { name: "Health and Physical Education", description: "Sports, games, yoga, and physical fitness. Board default (editable)" },
    { name: "Discipline", description: "Attendance, sincerity, behavior, and values. Board default (editable)" },
  ],
  termPlan: {
    terms: [
      {
        name: "Periodic Test 1",
        examTypeCode: "PT",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.25,
        components: [{ name: "Written Assessment", weightPercent: 100 }],
      },
      {
        name: "Half-Yearly Examination",
        examTypeCode: "HY",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.5,
        components: [
          { name: "Theory Paper", weightPercent: 80 },
          { name: "Internal Assessment", weightPercent: 20 },
        ],
      },
      {
        name: "Annual Examination",
        examTypeCode: "ANN",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.92,
        components: [
          { name: "Theory Paper", weightPercent: 80 },
          { name: "Internal Assessment", weightPercent: 20 },
        ],
      },
    ],
  },
};

// ─── 2. ICSE Blueprint ────────────────────────────────────────────────────────

const ICSE_PERCENTAGE_DIVISIONS: BlueprintGradeRule[] = [
  { minPercent: 75.0, maxPercent: 100.0, grade: "Distinction", gradePoint: 0.0, description: "Pass with Distinction (pass mark 35). Board default (editable)" },
  { minPercent: 60.0, maxPercent: 74.99, grade: "First Division", gradePoint: 0.0, description: "First Division (pass mark 35). Board default (editable)" },
  { minPercent: 45.0, maxPercent: 59.99, grade: "Second Division", gradePoint: 0.0, description: "Second Division (pass mark 35). Board default (editable)" },
  { minPercent: 35.0, maxPercent: 44.99, grade: "Pass", gradePoint: 0.0, description: "Pass Division (subject pass mark 35). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 34.99, grade: "Needs Improvement", gradePoint: 0.0, description: "Below minimum pass standard (pass mark 35). Board default (editable)" },
];

const ICSE_BLUEPRINT: ExamBoardBlueprint = {
  board: "ICSE",
  displayName: "Council for the Indian School Certificate Examinations (ICSE / ISC)",
  defaultGradingScale: "PERCENTAGE",
  examTypes: [
    {
      name: "Unit Test",
      code: "UT",
      examType: "UNIT_TEST",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 10,
      description: "Continuous formative unit evaluation. Board default (editable)",
    },
    {
      name: "Half-Yearly Examination",
      code: "HY",
      examType: "HALF_YEARLY",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 40,
      description: "Terminal mid-year examination. Board default (editable)",
    },
    {
      name: "Annual Examination",
      code: "ANN",
      examType: "ANNUAL",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 50,
      description: "Comprehensive end-of-year examination. Board default (editable)",
    },
    {
      name: "Project Work",
      code: "PROJ",
      examType: "INTERNAL_ASSESSMENT",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 20,
      description: "Subject project work and internal coursework. Board default (editable)",
    },
    {
      name: "Practical Examination",
      code: "PRAC",
      examType: "PRACTICAL",
      applicableClassGroups: ["CLASS_9_10", "CLASS_11_12"],
      weightPercent: 20,
      description: "Laboratory science practicals and viva. Board default (editable)",
    },
  ],
  gradeScales: {
    PRE_PRIMARY: QUALITATIVE_5_POINT,
    PRIMARY: QUALITATIVE_5_POINT,
    MIDDLE: ICSE_PERCENTAGE_DIVISIONS,
    SECONDARY: ICSE_PERCENTAGE_DIVISIONS,
    SENIOR_SECONDARY: ICSE_PERCENTAGE_DIVISIONS,
  },
  gradeScalesByOverride: {
    GPA: {
      MIDDLE: STANDARD_10_POINT_GPA,
      SECONDARY: STANDARD_10_POINT_GPA,
      SENIOR_SECONDARY: STANDARD_10_POINT_GPA,
    },
  },
  cocurricularAreas: [
    { name: "Art and Craft", description: "Creative drawing, painting, and craft. Board default (editable)" },
    { name: "Physical Education", description: "Physical training, sports, and team games. Board default (editable)" },
    { name: "Community Service", description: "Socially Useful Productive Work (SUPW) & service. Board default (editable)" },
    { name: "Discipline", description: "Attendance, conduct, and ethics. Board default (editable)" },
  ],
  termPlan: {
    terms: [
      {
        name: "Half-Yearly Examination",
        examTypeCode: "HY",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.5,
        components: [
          { name: "Written Paper", weightPercent: 80 },
          { name: "Project / SUPW", weightPercent: 20 },
        ],
      },
      {
        name: "Annual Examination",
        examTypeCode: "ANN",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.92,
        components: [
          { name: "Written Paper", weightPercent: 80 },
          { name: "Project / Practical", weightPercent: 20 },
        ],
      },
    ],
  },
};

// ─── 3. STATE_BOARD Blueprint ─────────────────────────────────────────────────

const STATE_BOARD_DIVISIONS: BlueprintGradeRule[] = [
  { minPercent: 75.0, maxPercent: 100.0, grade: "Distinction", gradePoint: 0.0, description: "First Class with Distinction (75%+). Board default (editable)" },
  { minPercent: 60.0, maxPercent: 74.99, grade: "First Division", gradePoint: 0.0, description: "First Division (60-74%). Board default (editable)" },
  { minPercent: 45.0, maxPercent: 59.99, grade: "Second Division", gradePoint: 0.0, description: "Second Division (45-59%). Board default (editable)" },
  { minPercent: 35.0, maxPercent: 44.99, grade: "Pass", gradePoint: 0.0, description: "Pass Division (35-44%). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 34.99, grade: "Fail", gradePoint: 0.0, description: "Below minimum passing marks (<35%). Board default (editable)" },
];

const STATE_BOARD_BLUEPRINT: ExamBoardBlueprint = {
  board: "STATE_BOARD",
  displayName: "State Secondary Education Board (State Board / SSC)",
  defaultGradingScale: "PERCENTAGE",
  examTypes: [
    {
      name: "Unit Test",
      code: "UT",
      examType: "UNIT_TEST",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 10,
      description: "Monthly / unit progress test. Board default (editable)",
    },
    {
      name: "Quarterly Examination",
      code: "QT",
      examType: "QUARTERLY",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 20,
      description: "First term quarterly summative examination. Board default (editable)",
    },
    {
      name: "Half-Yearly Examination",
      code: "HY",
      examType: "HALF_YEARLY",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 30,
      description: "Mid-term examination. Board default (editable)",
    },
    {
      name: "Annual Examination",
      code: "ANN",
      examType: "ANNUAL",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 40,
      description: "Final annual examination. Board default (editable)",
    },
    {
      name: "Formative Assessment",
      code: "FA",
      examType: "FORMATIVE",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
      weightPercent: 20,
      description: "CCE formative continuous assessment. Board default (editable)",
    },
    {
      name: "Summative Assessment",
      code: "SA",
      examType: "SUMMATIVE",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
      weightPercent: 80,
      description: "CCE summative term examination. Board default (editable)",
    },
    {
      name: "Practical Examination",
      code: "PRAC",
      examType: "PRACTICAL",
      applicableClassGroups: ["CLASS_9_10", "CLASS_11_12"],
      weightPercent: 20,
      description: "Science & lab practical examination. Board default (editable)",
    },
  ],
  gradeScales: {
    PRE_PRIMARY: QUALITATIVE_5_POINT,
    PRIMARY: QUALITATIVE_5_POINT,
    MIDDLE: STATE_BOARD_DIVISIONS,
    SECONDARY: STATE_BOARD_DIVISIONS,
    SENIOR_SECONDARY: STATE_BOARD_DIVISIONS,
  },
  gradeScalesByOverride: {
    GPA: {
      MIDDLE: STANDARD_10_POINT_GPA,
      SECONDARY: STANDARD_10_POINT_GPA,
      SENIOR_SECONDARY: STANDARD_10_POINT_GPA,
    },
  },
  cocurricularAreas: [
    { name: "Physical Education", description: "Drill, games, sports, and PT. Board default (editable)" },
    { name: "Art & Drawing", description: "Drawing, visual arts, and crafts. Board default (editable)" },
    { name: "Value Education", description: "Moral science and civic values. Board default (editable)" },
    { name: "Discipline", description: "Conduct, punctuality, and attendance. Board default (editable)" },
  ],
  termPlan: {
    terms: [
      {
        name: "Quarterly Examination",
        examTypeCode: "QT",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.33,
        components: [{ name: "Theory Paper", weightPercent: 100 }],
      },
      {
        name: "Half-Yearly Examination",
        examTypeCode: "HY",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.58,
        components: [
          { name: "Theory Paper", weightPercent: 80 },
          { name: "Practical / Internal", weightPercent: 20 },
        ],
      },
      {
        name: "Annual Examination",
        examTypeCode: "ANN",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.92,
        components: [
          { name: "Theory Paper", weightPercent: 80 },
          { name: "Practical / Internal", weightPercent: 20 },
        ],
      },
    ],
  },
};

// ─── 4. IGCSE Blueprint ───────────────────────────────────────────────────────

const IGCSE_MIDDLE_SECONDARY: BlueprintGradeRule[] = [
  { minPercent: 90.0, maxPercent: 100.0, grade: "A*", gradePoint: 8.0, description: "Outstanding performance (Grade A*). Board default (editable)" },
  { minPercent: 80.0, maxPercent: 89.99, grade: "A", gradePoint: 7.0, description: "Excellent performance (Grade A). Board default (editable)" },
  { minPercent: 70.0, maxPercent: 79.99, grade: "B", gradePoint: 6.0, description: "Very Good performance (Grade B). Board default (editable)" },
  { minPercent: 60.0, maxPercent: 69.99, grade: "C", gradePoint: 5.0, description: "Good performance / Standard credit (Grade C). Board default (editable)" },
  { minPercent: 50.0, maxPercent: 59.99, grade: "D", gradePoint: 4.0, description: "Satisfactory performance (Grade D). Board default (editable)" },
  { minPercent: 40.0, maxPercent: 49.99, grade: "E", gradePoint: 3.0, description: "Sufficient performance (Grade E). Board default (editable)" },
  { minPercent: 30.0, maxPercent: 39.99, grade: "F", gradePoint: 2.0, description: "Basic performance (Grade F). Board default (editable)" },
  { minPercent: 20.0, maxPercent: 29.99, grade: "G", gradePoint: 1.0, description: "Minimum performance (Grade G). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 19.99, grade: "U", gradePoint: 0.0, description: "Ungraded performance (<20%). Board default (editable)" },
];

const IGCSE_SENIOR_SECONDARY: BlueprintGradeRule[] = [
  { minPercent: 90.0, maxPercent: 100.0, grade: "A*", gradePoint: 6.0, description: "Cambridge International A-Level Grade A*. Board default (editable)" },
  { minPercent: 80.0, maxPercent: 89.99, grade: "A", gradePoint: 5.0, description: "Cambridge International A-Level Grade A. Board default (editable)" },
  { minPercent: 70.0, maxPercent: 79.99, grade: "B", gradePoint: 4.0, description: "Cambridge International A-Level Grade B. Board default (editable)" },
  { minPercent: 60.0, maxPercent: 69.99, grade: "C", gradePoint: 3.0, description: "Cambridge International A-Level Grade C. Board default (editable)" },
  { minPercent: 50.0, maxPercent: 59.99, grade: "D", gradePoint: 2.0, description: "Cambridge International A-Level Grade D. Board default (editable)" },
  { minPercent: 40.0, maxPercent: 49.99, grade: "E", gradePoint: 1.0, description: "Cambridge International A-Level Grade E. Board default (editable)" },
  { minPercent: 0.0, maxPercent: 39.99, grade: "U", gradePoint: 0.0, description: "Ungraded performance (<40%). Board default (editable)" },
];

const IGCSE_BLUEPRINT: ExamBoardBlueprint = {
  board: "IGCSE",
  displayName: "Cambridge Assessment International Education (IGCSE / A-Levels)",
  defaultGradingScale: "PERCENTAGE",
  examTypes: [
    {
      name: "Progression Test",
      code: "PROG",
      examType: "UNIT_TEST",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
      weightPercent: 15,
      description: "Cambridge checkpoint progression assessment. Board default (editable)",
    },
    {
      name: "Mid-Year Checkpoint",
      code: "MYC",
      examType: "HALF_YEARLY",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 35,
      description: "Mid-year checkpoint assessment. Board default (editable)",
    },
    {
      name: "End-of-Year Checkpoint",
      code: "EYC",
      examType: "ANNUAL",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 50,
      description: "Cumulative end-of-year assessment. Board default (editable)",
    },
    {
      name: "Coursework & Practical",
      code: "CW_PRAC",
      examType: "PRACTICAL",
      applicableClassGroups: ["CLASS_9_10", "CLASS_11_12"],
      weightPercent: 30,
      description: "Experimental skills and portfolio coursework. Board default (editable)",
    },
  ],
  gradeScales: {
    PRE_PRIMARY: QUALITATIVE_5_POINT,
    PRIMARY: QUALITATIVE_5_POINT,
    MIDDLE: IGCSE_MIDDLE_SECONDARY,
    SECONDARY: IGCSE_MIDDLE_SECONDARY,
    SENIOR_SECONDARY: IGCSE_SENIOR_SECONDARY,
  },
  cocurricularAreas: [
    { name: "Physical Education", description: "Sports, physical well-being, and teamwork. Board default (editable)" },
    { name: "Art and Design", description: "Visual expression and design technology. Board default (editable)" },
    { name: "Global Perspectives", description: "Critical thinking, research, and global inquiry. Board default (editable)" },
    { name: "Personal Development", description: "Communication, resilience, and leadership. Board default (editable)" },
  ],
  termPlan: {
    terms: [
      {
        name: "Mid-Year Checkpoint",
        examTypeCode: "MYC",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.5,
        components: [
          { name: "Written Paper", weightPercent: 70 },
          { name: "Coursework", weightPercent: 30 },
        ],
      },
      {
        name: "End-of-Year Checkpoint",
        examTypeCode: "EYC",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.92,
        components: [
          { name: "Written Paper", weightPercent: 70 },
          { name: "Coursework & Practical", weightPercent: 30 },
        ],
      },
    ],
  },
};

// ─── 5. IB Blueprint ──────────────────────────────────────────────────────────

const IB_PYP_QUALITATIVE: BlueprintGradeRule[] = [
  { minPercent: 85.0, maxPercent: 100.0, grade: "Exceeding", gradePoint: 4.0, description: "Consistently exceeds grade-level conceptual outcomes. Board default (editable)" },
  { minPercent: 70.0, maxPercent: 84.99, grade: "Meeting", gradePoint: 3.0, description: "Meets grade-level conceptual outcomes. Board default (editable)" },
  { minPercent: 50.0, maxPercent: 69.99, grade: "Approaching", gradePoint: 2.0, description: "Approaching grade-level conceptual outcomes. Board default (editable)" },
  { minPercent: 0.0, maxPercent: 49.99, grade: "Beginning", gradePoint: 1.0, description: "Beginning development of conceptual outcomes. Board default (editable)" },
];

const IB_MYP_1_8: BlueprintGradeRule[] = [
  { minPercent: 90.0, maxPercent: 100.0, grade: "8", gradePoint: 8.0, description: "Exceptional (MYP Criterion 8). Board default (editable)" },
  { minPercent: 80.0, maxPercent: 89.99, grade: "7", gradePoint: 7.0, description: "Excellent (MYP Criterion 7). Board default (editable)" },
  { minPercent: 70.0, maxPercent: 79.99, grade: "6", gradePoint: 6.0, description: "Substantial (MYP Criterion 6). Board default (editable)" },
  { minPercent: 60.0, maxPercent: 69.99, grade: "5", gradePoint: 5.0, description: "Competent (MYP Criterion 5). Board default (editable)" },
  { minPercent: 50.0, maxPercent: 59.99, grade: "4", gradePoint: 4.0, description: "Basic (MYP Criterion 4). Board default (editable)" },
  { minPercent: 40.0, maxPercent: 49.99, grade: "3", gradePoint: 3.0, description: "Limited (MYP Criterion 3). Board default (editable)" },
  { minPercent: 30.0, maxPercent: 39.99, grade: "2", gradePoint: 2.0, description: "Very Limited (MYP Criterion 2). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 29.99, grade: "1", gradePoint: 1.0, description: "Beginning (MYP Criterion 1). Board default (editable)" },
];

const IB_DP_1_7: BlueprintGradeRule[] = [
  { minPercent: 80.0, maxPercent: 100.0, grade: "7", gradePoint: 7.0, description: "Excellent performance (DP Grade 7). Board default (editable)" },
  { minPercent: 70.0, maxPercent: 79.99, grade: "6", gradePoint: 6.0, description: "Very Good performance (DP Grade 6). Board default (editable)" },
  { minPercent: 60.0, maxPercent: 69.99, grade: "5", gradePoint: 5.0, description: "Good performance (DP Grade 5). Board default (editable)" },
  { minPercent: 50.0, maxPercent: 59.99, grade: "4", gradePoint: 4.0, description: "Satisfactory performance (DP Grade 4). Board default (editable)" },
  { minPercent: 40.0, maxPercent: 49.99, grade: "3", gradePoint: 3.0, description: "Mediocre performance (DP Grade 3). Board default (editable)" },
  { minPercent: 30.0, maxPercent: 39.99, grade: "2", gradePoint: 2.0, description: "Poor performance (DP Grade 2). Board default (editable)" },
  { minPercent: 0.0, maxPercent: 29.99, grade: "1", gradePoint: 1.0, description: "Very Poor performance (DP Grade 1). Board default (editable)" },
];

const IB_BLUEPRINT: ExamBoardBlueprint = {
  board: "IB",
  displayName: "International Baccalaureate (IB — PYP / MYP / DP)",
  defaultGradingScale: "PERCENTAGE",
  examTypes: [
    {
      name: "Unit of Inquiry Review",
      code: "UOI",
      examType: "UNIT_TEST",
      applicableClassGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8"],
      weightPercent: 20,
      description: "Interdisciplinary unit of inquiry review. Board default (editable)",
    },
    {
      name: "Term Review",
      code: "TR",
      examType: "HALF_YEARLY",
      applicableClassGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 40,
      description: "Mid-year summative criteria assessment. Board default (editable)",
    },
    {
      name: "Internal Assessment",
      code: "IA",
      examType: "INTERNAL_ASSESSMENT",
      applicableClassGroups: ["CLASS_9_10", "CLASS_11_12"],
      weightPercent: 25,
      description: "DP internal assessment investigation. Board default (editable)",
    },
    {
      name: "Practical & Portfolio Review",
      code: "PORT",
      examType: "PRACTICAL",
      applicableClassGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
      weightPercent: 25,
      description: "Experimental sciences practical and creative portfolio. Board default (editable)",
    },
  ],
  gradeScales: {
    PRE_PRIMARY: IB_PYP_QUALITATIVE,
    PRIMARY: IB_PYP_QUALITATIVE,
    MIDDLE: IB_MYP_1_8,
    SECONDARY: IB_MYP_1_8,
    SENIOR_SECONDARY: IB_DP_1_7,
  },
  cocurricularAreas: [
    { name: "Approaches to Learning", description: "Communication, social, self-management, research, and thinking skills. Board default (editable)" },
    { name: "Creativity, Activity, Service (CAS)", description: "Arts, physical exertion, and unpaid voluntary exchange. Board default (editable)" },
    { name: "Physical and Health Education", description: "Movement, engagement, and healthy living. Board default (editable)" },
    { name: "Arts Expression", description: "Visual and performing arts synthesis. Board default (editable)" },
  ],
  termPlan: {
    terms: [
      {
        name: "Term 1 Review",
        examTypeCode: "TR",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.5,
        components: [
          { name: "Criterion Assessment", weightPercent: 75 },
          { name: "Portfolio & Inquiry", weightPercent: 25 },
        ],
      },
      {
        name: "Final Portfolio & Term Review",
        examTypeCode: "PORT",
        applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        defaultProportion: 0.92,
        components: [
          { name: "Criterion Assessment", weightPercent: 75 },
          { name: "Culminating Project / IA", weightPercent: 25 },
        ],
      },
    ],
  },
};

// ─── Blueprint Registry Index ─────────────────────────────────────────────────

export const BOARD_BLUEPRINTS: Record<SchoolBoard, ExamBoardBlueprint> = {
  CBSE: CBSE_BLUEPRINT,
  ICSE: ICSE_BLUEPRINT,
  STATE_BOARD: STATE_BOARD_BLUEPRINT,
  IGCSE: IGCSE_BLUEPRINT,
  IB: IB_BLUEPRINT,
};

/**
 * Returns the immutable blueprint for a specified school affiliation board.
 */
export function getBlueprint(board: SchoolBoard): ExamBoardBlueprint {
  return BOARD_BLUEPRINTS[board] || BOARD_BLUEPRINTS.CBSE;
}

/**
 * Resolves the effective grade rules for a class category, factoring in
 * user-chosen gradingScale override precedence over board default.
 */
export function resolveGradeRulesForCategory(
  blueprint: ExamBoardBlueprint,
  category: ClassCategory,
  overrideScale?: GradingScale,
): BlueprintGradeRule[] {
  if (overrideScale && blueprint.gradeScalesByOverride?.[overrideScale]?.[category]) {
    return blueprint.gradeScalesByOverride[overrideScale]![category]!;
  }
  return blueprint.gradeScales[category] || [];
}

/**
 * Generates an informational summary of the blueprint provisioning footprint.
 * Used by the Onboarding Wizard live preview (Step 5), review screen (Step 7),
 * and test assertions.
 */
export function blueprintSummary(
  board: SchoolBoard,
  gradingScale?: GradingScale,
  activeClassGroups?: ClassGroup[],
): {
  board: SchoolBoard;
  displayName: string;
  activeGradingScale: GradingScale;
  examTypeCount: number;
  examTypes: Array<{ name: string; code: string; examType: string }>;
  gradeRuleCountsByGroup: Record<ClassGroup, number>;
  cocurricularCount: number;
  cocurricularNames: string[];
  termPlanNames: string[];
} {
  const bp = getBlueprint(board);
  const effectiveScale = gradingScale || bp.defaultGradingScale;
  const groupsToConsider = activeClassGroups && activeClassGroups.length > 0
    ? activeClassGroups
    : ALL_CLASS_GROUPS;

  const gradeRuleCountsByGroup = {} as Record<ClassGroup, number>;
  for (const group of ALL_CLASS_GROUPS) {
    if (groupsToConsider.includes(group)) {
      const category = GROUP_TO_CATEGORY[group];
      const rules = resolveGradeRulesForCategory(bp, category, gradingScale);
      gradeRuleCountsByGroup[group] = rules.length;
    } else {
      gradeRuleCountsByGroup[group] = 0;
    }
  }

  return {
    board: bp.board,
    displayName: bp.displayName,
    activeGradingScale: effectiveScale,
    examTypeCount: bp.examTypes.length,
    examTypes: bp.examTypes.map((et) => ({
      name: et.name,
      code: et.code,
      examType: et.examType,
    })),
    gradeRuleCountsByGroup,
    cocurricularCount: bp.cocurricularAreas.length,
    cocurricularNames: bp.cocurricularAreas.map((c) => c.name),
    termPlanNames: bp.termPlan.terms.map((t) => t.name),
  };
}
