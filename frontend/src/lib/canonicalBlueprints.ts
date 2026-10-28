/**
 * Canonical Blueprints for School Digital Twin Provisioning (Sprint S20)
 * Defines immutable, versioned, curriculum-compliant school configuration profiles
 * spanning 8 configuration packs across CBSE, ICSE, State Boards, and IB.
 */

export interface BlueprintClass {
  name: string;
  numericLevel: number;
  gradeLevel:
    | "NURSERY"
    | "LKG"
    | "UKG"
    | "CLASS_1"
    | "CLASS_2"
    | "CLASS_3"
    | "CLASS_4"
    | "CLASS_5"
    | "CLASS_6"
    | "CLASS_7"
    | "CLASS_8"
    | "CLASS_9"
    | "CLASS_10"
    | "CLASS_11"
    | "CLASS_12";
  streams: string[];
  defaultSections: string[];
  sortOrder: number;
}

export interface BlueprintSubject {
  name: string;
  code: string;
  subjectType: "THEORY" | "PRACTICAL" | "LANGUAGE" | "ACTIVITY" | "CO_SCHOLASTIC";
  classLevel: number; // mapped to numericLevel of the target class
  weeklyPeriods: number;
  isOptional: boolean;
}

export interface BlueprintBellSchedule {
  workingDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  periodsPerDay: number;
  periods: {
    periodNumber: number;
    periodType: "ASSEMBLY" | "INSTRUCTION" | "SHORT_BREAK" | "LUNCH_BREAK" | "ACTIVITY";
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
    durationMinutes: number;
  }[];
}

export interface BlueprintFeeHead {
  name: string;
  headType:
    | "TUITION"
    | "ADMISSION"
    | "TRANSPORT"
    | "HOSTEL"
    | "LAB"
    | "LIBRARY"
    | "EXAM"
    | "EXAMINATION"
    | "SPORTS"
    | "ACTIVITY"
    | "MISCELLANEOUS";
  frequency: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "ONE_TIME";
  isMandatory: boolean;
  sortOrder: number;
  defaultLedgerAccountCode?: string; // Mapped to Chart of Accounts
}

export interface BlueprintSalaryGrade {
  gradeName: string;
  basicSalaryPaise: number;
  hraPercent: number;
  daPercent: number;
  pfPercent: number;
  otherAllowances: Record<string, number>;
}

export interface BlueprintHoliday {
  name: string;
  month: number; // 1-12
  day: number;   // 1-31
  isFixedAnnual: boolean;
  holidayType: "NATIONAL" | "REGIONAL" | "FESTIVAL";
}

export interface BlueprintRoleDefault {
  roleName: string;
  displayName: string;
  permissions: string[];
}

export interface CanonicalBlueprint {
  id: string;
  version: "1.0.0";
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  jurisdiction: string;
  schoolType: "PRIMARY" | "SECONDARY" | "SENIOR_SECONDARY" | "INTEGRATED";
  displayName: string;
  description: string;
  supportedStreams?: ("SCIENCE" | "COMMERCE" | "ARTS")[];

  // 8 Canonical Configuration Packs
  academicYear: {
    name: string;
    startMonth: number; // 1-12, e.g. 4 for April
    endMonth: number;   // 1-12, e.g. 3 for March
    terms: { name: string; startMonth: number; endMonth: number }[];
  };
  classes: BlueprintClass[];
  subjects: BlueprintSubject[];
  bellSchedule: BlueprintBellSchedule;
  feeHeads: BlueprintFeeHead[];
  salaryGrades: BlueprintSalaryGrade[];
  holidays: BlueprintHoliday[];
  roleDefaults: BlueprintRoleDefault[];
}

// ─── Standard Bell Schedule Definition ─────────────────────────────────────────
const STANDARD_SECONDARY_BELL_SCHEDULE: BlueprintBellSchedule = {
  workingDays: [1, 2, 3, 4, 5, 6], // Mon - Sat (6 days)
  periodsPerDay: 8,
  periods: [
    { periodNumber: 0, periodType: "ASSEMBLY", startTime: "08:00", endTime: "08:20", durationMinutes: 20 },
    { periodNumber: 1, periodType: "INSTRUCTION", startTime: "08:20", endTime: "09:05", durationMinutes: 45 },
    { periodNumber: 2, periodType: "INSTRUCTION", startTime: "09:05", endTime: "09:50", durationMinutes: 45 },
    { periodNumber: 3, periodType: "INSTRUCTION", startTime: "09:50", endTime: "10:35", durationMinutes: 45 },
    { periodNumber: 0, periodType: "SHORT_BREAK", startTime: "10:35", endTime: "10:50", durationMinutes: 15 },
    { periodNumber: 4, periodType: "INSTRUCTION", startTime: "10:50", endTime: "11:35", durationMinutes: 45 },
    { periodNumber: 5, periodType: "INSTRUCTION", startTime: "11:35", endTime: "12:20", durationMinutes: 45 },
    { periodNumber: 0, periodType: "LUNCH_BREAK", startTime: "12:20", endTime: "13:00", durationMinutes: 40 },
    { periodNumber: 6, periodType: "INSTRUCTION", startTime: "13:00", endTime: "13:45", durationMinutes: 45 },
    { periodNumber: 7, periodType: "INSTRUCTION", startTime: "13:45", endTime: "14:30", durationMinutes: 45 },
    { periodNumber: 8, periodType: "ACTIVITY", startTime: "14:30", endTime: "15:15", durationMinutes: 45 },
  ],
};

// ─── Standard Indian National Holidays ────────────────────────────────────────
const STANDARD_NATIONAL_HOLIDAYS: BlueprintHoliday[] = [
  { name: "Republic Day", month: 1, day: 26, isFixedAnnual: true, holidayType: "NATIONAL" },
  { name: "Independence Day", month: 8, day: 15, isFixedAnnual: true, holidayType: "NATIONAL" },
  { name: "Gandhi Jayanti", month: 10, day: 2, isFixedAnnual: true, holidayType: "NATIONAL" },
  { name: "National Science Day", month: 2, day: 28, isFixedAnnual: true, holidayType: "REGIONAL" },
  { name: "Children's Day", month: 11, day: 14, isFixedAnnual: true, holidayType: "REGIONAL" },
];

// ─── Standard Role Defaults ───────────────────────────────────────────────────
const STANDARD_ROLE_DEFAULTS: BlueprintRoleDefault[] = [
  { roleName: "SUPER_ADMIN", displayName: "Super Administrator", permissions: ["*"] },
  { roleName: "SCHOOL_ADMIN", displayName: "School Administrator", permissions: ["school:*", "academics:*", "fees:*", "hr:*", "students:*"] },
  { roleName: "PRINCIPAL", displayName: "School Principal", permissions: ["academics:*", "reports:*", "attendance:*", "staff:view"] },
  { roleName: "TEACHER", displayName: "Educator / Teacher", permissions: ["attendance:take", "grades:enter", "timetable:view", "assignments:*"] },
  { roleName: "ACCOUNTANT", displayName: "Bursar / Accountant", permissions: ["fees:*", "accounts:*", "vouchers:*", "reports:finance"] },
  { roleName: "LIBRARIAN", displayName: "Librarian", permissions: ["library:*"] },
  { roleName: "TRANSPORT_MANAGER", displayName: "Fleet Logistics Manager", permissions: ["transport:*", "vehicles:*", "routes:*"] },
  { roleName: "PARENT", displayName: "Parent / Guardian", permissions: ["parent:view", "fee:pay", "attendance:view_child"] },
  { roleName: "STUDENT", displayName: "Enrolled Student", permissions: ["student:view", "homework:submit", "timetable:view_own"] },
];

// ─── 1. CBSE Secondary (Classes 1 - 10) ─────────────────────────────────────────
export const CBSE_SECONDARY_BLUEPRINT: CanonicalBlueprint = {
  id: "CBSE_SECONDARY_V1",
  version: "1.0.0",
  board: "CBSE",
  jurisdiction: "National",
  schoolType: "SECONDARY",
  displayName: "CBSE Secondary (Classes 1 - 10)",
  description: "Comprehensive NCERT/CBSE curriculum for classes 1 through 10 with 6-day academic schedule, term pattern, and standard fee heads.",
  academicYear: {
    name: "Standard Academic Cycle (April - March)",
    startMonth: 4,
    endMonth: 3,
    terms: [
      { name: "Term 1 (Half Yearly)", startMonth: 4, endMonth: 9 },
      { name: "Term 2 (Annual)", startMonth: 10, endMonth: 3 },
    ],
  },
  classes: [
    { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1", streams: [], defaultSections: ["A", "B"], sortOrder: 1 },
    { name: "Class 2", numericLevel: 2, gradeLevel: "CLASS_2", streams: [], defaultSections: ["A", "B"], sortOrder: 2 },
    { name: "Class 3", numericLevel: 3, gradeLevel: "CLASS_3", streams: [], defaultSections: ["A", "B"], sortOrder: 3 },
    { name: "Class 4", numericLevel: 4, gradeLevel: "CLASS_4", streams: [], defaultSections: ["A", "B"], sortOrder: 4 },
    { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5", streams: [], defaultSections: ["A", "B"], sortOrder: 5 },
    { name: "Class 6", numericLevel: 6, gradeLevel: "CLASS_6", streams: [], defaultSections: ["A", "B"], sortOrder: 6 },
    { name: "Class 7", numericLevel: 7, gradeLevel: "CLASS_7", streams: [], defaultSections: ["A", "B"], sortOrder: 7 },
    { name: "Class 8", numericLevel: 8, gradeLevel: "CLASS_8", streams: [], defaultSections: ["A", "B"], sortOrder: 8 },
    { name: "Class 9", numericLevel: 9, gradeLevel: "CLASS_9", streams: [], defaultSections: ["A", "B"], sortOrder: 9 },
    { name: "Class 10", numericLevel: 10, gradeLevel: "CLASS_10", streams: [], defaultSections: ["A", "B"], sortOrder: 10 },
  ],
  subjects: [
    { name: "English Language & Literature", code: "ENG", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Hindi Course A", code: "HIN", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Mathematics", code: "MATH", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 7, isOptional: false },
    { name: "Science & Technology", code: "SCI", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Social Science", code: "SST", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Information Technology", code: "IT", subjectType: "PRACTICAL", classLevel: 1, weeklyPeriods: 3, isOptional: true },
    { name: "Art & Physical Education", code: "PET", subjectType: "ACTIVITY", classLevel: 1, weeklyPeriods: 4, isOptional: false },
  ],
  bellSchedule: STANDARD_SECONDARY_BELL_SCHEDULE,
  feeHeads: [
    { name: "Tuition Fee", headType: "TUITION", frequency: "MONTHLY", isMandatory: true, sortOrder: 1, defaultLedgerAccountCode: "4001" },
    { name: "Admission & Registration Fee", headType: "ADMISSION", frequency: "ONE_TIME", isMandatory: true, sortOrder: 2, defaultLedgerAccountCode: "4002" },
    { name: "Computer & Science Lab Fee", headType: "LAB", frequency: "QUARTERLY", isMandatory: true, sortOrder: 3, defaultLedgerAccountCode: "4003" },
    { name: "Examination & Assessment Fee", headType: "EXAM", frequency: "QUARTERLY", isMandatory: true, sortOrder: 4, defaultLedgerAccountCode: "4004" },
    { name: "Library Resource Fee", headType: "LIBRARY", frequency: "ANNUAL", isMandatory: false, sortOrder: 5, defaultLedgerAccountCode: "4005" },
    { name: "Sports & Annual Development Fee", headType: "MISCELLANEOUS", frequency: "ANNUAL", isMandatory: false, sortOrder: 6, defaultLedgerAccountCode: "4006" },
  ],
  salaryGrades: [
    { gradeName: "PGT (Post Graduate Teacher)", basicSalaryPaise: 4500000, hraPercent: 20, daPercent: 15, pfPercent: 12, otherAllowances: { medical: 150000, transport: 200000 } },
    { gradeName: "TGT (Trained Graduate Teacher)", basicSalaryPaise: 3500000, hraPercent: 18, daPercent: 15, pfPercent: 12, otherAllowances: { medical: 120000, transport: 150000 } },
    { gradeName: "PRT (Primary Teacher)", basicSalaryPaise: 2800000, hraPercent: 15, daPercent: 12, pfPercent: 12, otherAllowances: { medical: 100000, transport: 100000 } },
    { gradeName: "Administrative Staff", basicSalaryPaise: 2200000, hraPercent: 12, daPercent: 10, pfPercent: 12, otherAllowances: { medical: 80000 } },
    { gradeName: "Support Staff", basicSalaryPaise: 1800000, hraPercent: 10, daPercent: 10, pfPercent: 12, otherAllowances: { medical: 50000 } },
  ],
  holidays: STANDARD_NATIONAL_HOLIDAYS,
  roleDefaults: STANDARD_ROLE_DEFAULTS,
};

// ─── 2. CBSE Primary (Nursery - Class 5) ───────────────────────────────────────
export const CBSE_PRIMARY_BLUEPRINT: CanonicalBlueprint = {
  id: "CBSE_PRIMARY_V1",
  version: "1.0.0",
  board: "CBSE",
  jurisdiction: "National",
  schoolType: "PRIMARY",
  displayName: "CBSE Primary (Nursery - Class 5)",
  description: "Early childhood and foundational primary school blueprint with experiential discovery, phonics, and play-based learning.",
  academicYear: {
    name: "Foundational Academic Cycle (April - March)",
    startMonth: 4,
    endMonth: 3,
    terms: [
      { name: "Term 1", startMonth: 4, endMonth: 9 },
      { name: "Term 2", startMonth: 10, endMonth: 3 },
    ],
  },
  classes: [
    { name: "Nursery", numericLevel: -2, gradeLevel: "NURSERY", streams: [], defaultSections: ["A"], sortOrder: 1 },
    { name: "LKG", numericLevel: -1, gradeLevel: "LKG", streams: [], defaultSections: ["A"], sortOrder: 2 },
    { name: "UKG", numericLevel: 0, gradeLevel: "UKG", streams: [], defaultSections: ["A"], sortOrder: 3 },
    { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1", streams: [], defaultSections: ["A"], sortOrder: 4 },
    { name: "Class 2", numericLevel: 2, gradeLevel: "CLASS_2", streams: [], defaultSections: ["A"], sortOrder: 5 },
    { name: "Class 3", numericLevel: 3, gradeLevel: "CLASS_3", streams: [], defaultSections: ["A"], sortOrder: 6 },
    { name: "Class 4", numericLevel: 4, gradeLevel: "CLASS_4", streams: [], defaultSections: ["A"], sortOrder: 7 },
    { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5", streams: [], defaultSections: ["A"], sortOrder: 8 },
  ],
  subjects: [
    { name: "English Phonics & Early Reading", code: "ENG_PRI", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Environmental Studies (EVS)", code: "EVS", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Foundational Numeracy & Math", code: "MATH_PRI", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Art, Craft & Discovery", code: "ART", subjectType: "ACTIVITY", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Physical Movement & Games", code: "GAMES", subjectType: "ACTIVITY", classLevel: 1, weeklyPeriods: 4, isOptional: false },
  ],
  bellSchedule: {
    workingDays: [1, 2, 3, 4, 5], // 5 days for Primary
    periodsPerDay: 6,
    periods: [
      { periodNumber: 0, periodType: "ASSEMBLY", startTime: "08:30", endTime: "08:50", durationMinutes: 20 },
      { periodNumber: 1, periodType: "INSTRUCTION", startTime: "08:50", endTime: "09:30", durationMinutes: 40 },
      { periodNumber: 2, periodType: "INSTRUCTION", startTime: "09:30", endTime: "10:10", durationMinutes: 40 },
      { periodNumber: 0, periodType: "SHORT_BREAK", startTime: "10:10", endTime: "10:30", durationMinutes: 20 },
      { periodNumber: 3, periodType: "INSTRUCTION", startTime: "10:30", endTime: "11:10", durationMinutes: 40 },
      { periodNumber: 4, periodType: "INSTRUCTION", startTime: "11:10", endTime: "11:50", durationMinutes: 40 },
      { periodNumber: 0, periodType: "LUNCH_BREAK", startTime: "11:50", endTime: "12:30", durationMinutes: 40 },
      { periodNumber: 5, periodType: "INSTRUCTION", startTime: "12:30", endTime: "13:10", durationMinutes: 40 },
      { periodNumber: 6, periodType: "ACTIVITY", startTime: "13:10", endTime: "13:50", durationMinutes: 40 },
    ],
  },
  feeHeads: [
    { name: "Tuition Fee", headType: "TUITION", frequency: "MONTHLY", isMandatory: true, sortOrder: 1, defaultLedgerAccountCode: "4001" },
    { name: "Admission Fee", headType: "ADMISSION", frequency: "ONE_TIME", isMandatory: true, sortOrder: 2, defaultLedgerAccountCode: "4002" },
    { name: "Activity & Play Kit Fee", headType: "MISCELLANEOUS", frequency: "QUARTERLY", isMandatory: true, sortOrder: 3, defaultLedgerAccountCode: "4006" },
  ],
  salaryGrades: [
    { gradeName: "NTT / Pre-Primary Educator", basicSalaryPaise: 2500000, hraPercent: 15, daPercent: 10, pfPercent: 12, otherAllowances: { medical: 100000 } },
    { gradeName: "PRT (Primary Teacher)", basicSalaryPaise: 2800000, hraPercent: 15, daPercent: 12, pfPercent: 12, otherAllowances: { medical: 100000, transport: 100000 } },
    { gradeName: "Support Staff", basicSalaryPaise: 1600000, hraPercent: 10, daPercent: 10, pfPercent: 12, otherAllowances: { medical: 50000 } },
  ],
  holidays: STANDARD_NATIONAL_HOLIDAYS,
  roleDefaults: STANDARD_ROLE_DEFAULTS,
};

// ─── 3. CBSE Senior Secondary (Classes 11 - 12) ─────────────────────────────────
export const CBSE_SR_SECONDARY_BLUEPRINT: CanonicalBlueprint = {
  id: "CBSE_SR_SECONDARY_V1",
  version: "1.0.0",
  board: "CBSE",
  jurisdiction: "National",
  schoolType: "SENIOR_SECONDARY",
  displayName: "CBSE Senior Secondary (Classes 11 - 12)",
  description: "Advanced CBSE senior secondary blueprint featuring Science, Commerce, and Humanities streams with lab allocations.",
  supportedStreams: ["SCIENCE", "COMMERCE", "ARTS"],
  academicYear: {
    name: "Senior Secondary Academic Cycle (April - March)",
    startMonth: 4,
    endMonth: 3,
    terms: [
      { name: "Semester 1", startMonth: 4, endMonth: 9 },
      { name: "Semester 2", startMonth: 10, endMonth: 3 },
    ],
  },
  classes: [
    { name: "Class 11", numericLevel: 11, gradeLevel: "CLASS_11", streams: ["SCIENCE", "COMMERCE", "ARTS"], defaultSections: ["A", "B", "C"], sortOrder: 1 },
    { name: "Class 12", numericLevel: 12, gradeLevel: "CLASS_12", streams: ["SCIENCE", "COMMERCE", "ARTS"], defaultSections: ["A", "B", "C"], sortOrder: 2 },
  ],
  subjects: [
    { name: "English Core", code: "ENG_CORE", subjectType: "LANGUAGE", classLevel: 11, weeklyPeriods: 6, isOptional: false },
    { name: "Physics & Lab Practical", code: "PHYS", subjectType: "PRACTICAL", classLevel: 11, weeklyPeriods: 7, isOptional: false },
    { name: "Chemistry & Lab Practical", code: "CHEM", subjectType: "PRACTICAL", classLevel: 11, weeklyPeriods: 7, isOptional: false },
    { name: "Mathematics", code: "MATH", subjectType: "THEORY", classLevel: 11, weeklyPeriods: 7, isOptional: true },
    { name: "Biology & Practical", code: "BIO", subjectType: "PRACTICAL", classLevel: 11, weeklyPeriods: 7, isOptional: true },
    { name: "Accountancy", code: "ACC", subjectType: "THEORY", classLevel: 11, weeklyPeriods: 7, isOptional: true },
    { name: "Business Studies", code: "BST", subjectType: "THEORY", classLevel: 11, weeklyPeriods: 6, isOptional: true },
    { name: "Economics", code: "ECON", subjectType: "THEORY", classLevel: 11, weeklyPeriods: 6, isOptional: true },
    { name: "History & Political Science", code: "HIST_POL", subjectType: "THEORY", classLevel: 11, weeklyPeriods: 6, isOptional: true },
    { name: "Computer Science (Python)", code: "CS_SR", subjectType: "PRACTICAL", classLevel: 11, weeklyPeriods: 5, isOptional: true },
  ],
  bellSchedule: STANDARD_SECONDARY_BELL_SCHEDULE,
  feeHeads: [
    { name: "Tuition Fee", headType: "TUITION", frequency: "MONTHLY", isMandatory: true, sortOrder: 1, defaultLedgerAccountCode: "4001" },
    { name: "Science & Computer Lab Fee", headType: "LAB", frequency: "QUARTERLY", isMandatory: true, sortOrder: 2, defaultLedgerAccountCode: "4003" },
    { name: "Board Examination Fee", headType: "EXAM", frequency: "ANNUAL", isMandatory: true, sortOrder: 3, defaultLedgerAccountCode: "4004" },
  ],
  salaryGrades: [
    { gradeName: "Senior PGT (Lecturer)", basicSalaryPaise: 5200000, hraPercent: 20, daPercent: 15, pfPercent: 12, otherAllowances: { research: 300000, medical: 150000 } },
    { gradeName: "Lab Demonstrator", basicSalaryPaise: 2600000, hraPercent: 15, daPercent: 12, pfPercent: 12, otherAllowances: { hazard: 100000 } },
  ],
  holidays: STANDARD_NATIONAL_HOLIDAYS,
  roleDefaults: STANDARD_ROLE_DEFAULTS,
};

// ─── 4. ICSE Secondary (Classes 1 - 10) ─────────────────────────────────────────
export const ICSE_SECONDARY_BLUEPRINT: CanonicalBlueprint = {
  id: "ICSE_SECONDARY_V1",
  version: "1.0.0",
  board: "ICSE",
  jurisdiction: "National",
  schoolType: "SECONDARY",
  displayName: "ICSE Secondary (Classes 1 - 10)",
  description: "Council for the Indian School Certificate Examinations (CISCE) curriculum with English literature, group electives, and project-based evaluation.",
  academicYear: {
    name: "ICSE Academic Cycle (April - March)",
    startMonth: 4,
    endMonth: 3,
    terms: [
      { name: "First Term", startMonth: 4, endMonth: 9 },
      { name: "Final Term", startMonth: 10, endMonth: 3 },
    ],
  },
  classes: [
    { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1", streams: [], defaultSections: ["A"], sortOrder: 1 },
    { name: "Class 2", numericLevel: 2, gradeLevel: "CLASS_2", streams: [], defaultSections: ["A"], sortOrder: 2 },
    { name: "Class 3", numericLevel: 3, gradeLevel: "CLASS_3", streams: [], defaultSections: ["A"], sortOrder: 3 },
    { name: "Class 4", numericLevel: 4, gradeLevel: "CLASS_4", streams: [], defaultSections: ["A"], sortOrder: 4 },
    { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5", streams: [], defaultSections: ["A"], sortOrder: 5 },
    { name: "Class 6", numericLevel: 6, gradeLevel: "CLASS_6", streams: [], defaultSections: ["A"], sortOrder: 6 },
    { name: "Class 7", numericLevel: 7, gradeLevel: "CLASS_7", streams: [], defaultSections: ["A"], sortOrder: 7 },
    { name: "Class 8", numericLevel: 8, gradeLevel: "CLASS_8", streams: [], defaultSections: ["A"], sortOrder: 8 },
    { name: "Class 9", numericLevel: 9, gradeLevel: "CLASS_9", streams: [], defaultSections: ["A"], sortOrder: 9 },
    { name: "Class 10", numericLevel: 10, gradeLevel: "CLASS_10", streams: [], defaultSections: ["A"], sortOrder: 10 },
  ],
  subjects: [
    { name: "English Language (Paper 1)", code: "ENG_1", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Literature in English (Paper 2)", code: "ENG_2", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Second Language (Hindi/Regional)", code: "LANG_2", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 4, isOptional: false },
    { name: "History, Civics & Geography (HCG)", code: "HCG", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Mathematics", code: "MATH", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 7, isOptional: false },
    { name: "Science (Physics, Chemistry, Biology)", code: "SCI", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 7, isOptional: false },
    { name: "Computer Applications", code: "COMP_APP", subjectType: "PRACTICAL", classLevel: 1, weeklyPeriods: 4, isOptional: true },
  ],
  bellSchedule: STANDARD_SECONDARY_BELL_SCHEDULE,
  feeHeads: [
    { name: "Tuition Fee", headType: "TUITION", frequency: "QUARTERLY", isMandatory: true, sortOrder: 1, defaultLedgerAccountCode: "4001" },
    { name: "Laboratory & Practical Assessment Fee", headType: "LAB", frequency: "ANNUAL", isMandatory: true, sortOrder: 2, defaultLedgerAccountCode: "4003" },
    { name: "Library & Co-Curricular Fee", headType: "LIBRARY", frequency: "ANNUAL", isMandatory: false, sortOrder: 3, defaultLedgerAccountCode: "4005" },
  ],
  salaryGrades: [
    { gradeName: "Senior Faculty (ICSE)", basicSalaryPaise: 4800000, hraPercent: 20, daPercent: 15, pfPercent: 12, otherAllowances: { medical: 150000 } },
    { gradeName: "Primary Faculty (ICSE)", basicSalaryPaise: 3000000, hraPercent: 15, daPercent: 12, pfPercent: 12, otherAllowances: { medical: 100000 } },
  ],
  holidays: STANDARD_NATIONAL_HOLIDAYS,
  roleDefaults: STANDARD_ROLE_DEFAULTS,
};

// ─── 5. Karnataka State Board (Classes 1 - 10) ─────────────────────────────────
export const STATE_BOARD_KARNATAKA_BLUEPRINT: CanonicalBlueprint = {
  id: "STATE_BOARD_KARNATAKA_V1",
  version: "1.0.0",
  board: "STATE_BOARD",
  jurisdiction: "Karnataka",
  schoolType: "SECONDARY",
  displayName: "Karnataka State Board (Classes 1 - 10)",
  description: "Karnataka Department of School Education and Literacy (DSEL) curriculum with Kannada 1st Language and state grading guidelines.",
  academicYear: {
    name: "Karnataka State Academic Calendar (June - April)",
    startMonth: 6, // June
    endMonth: 4,   // April
    terms: [
      { name: "Semester 1", startMonth: 6, endMonth: 10 },
      { name: "Semester 2", startMonth: 11, endMonth: 4 },
    ],
  },
  classes: [
    { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1", streams: [], defaultSections: ["A"], sortOrder: 1 },
    { name: "Class 2", numericLevel: 2, gradeLevel: "CLASS_2", streams: [], defaultSections: ["A"], sortOrder: 2 },
    { name: "Class 3", numericLevel: 3, gradeLevel: "CLASS_3", streams: [], defaultSections: ["A"], sortOrder: 3 },
    { name: "Class 4", numericLevel: 4, gradeLevel: "CLASS_4", streams: [], defaultSections: ["A"], sortOrder: 4 },
    { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5", streams: [], defaultSections: ["A"], sortOrder: 5 },
    { name: "Class 6", numericLevel: 6, gradeLevel: "CLASS_6", streams: [], defaultSections: ["A"], sortOrder: 6 },
    { name: "Class 7", numericLevel: 7, gradeLevel: "CLASS_7", streams: [], defaultSections: ["A"], sortOrder: 7 },
    { name: "Class 8", numericLevel: 8, gradeLevel: "CLASS_8", streams: [], defaultSections: ["A"], sortOrder: 8 },
    { name: "Class 9", numericLevel: 9, gradeLevel: "CLASS_9", streams: [], defaultSections: ["A"], sortOrder: 9 },
    { name: "Class 10", numericLevel: 10, gradeLevel: "CLASS_10", streams: [], defaultSections: ["A"], sortOrder: 10 },
  ],
  subjects: [
    { name: "First Language Kannada (ಪ್ರಥಮ ಭಾಷೆ)", code: "KAN_1", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Second Language English", code: "ENG_2", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Third Language Hindi", code: "HIN_3", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 4, isOptional: false },
    { name: "Mathematics (ಗಣಿತ)", code: "MATH", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 7, isOptional: false },
    { name: "General Science (ವಿಜ್ಞಾನ)", code: "SCI", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Social Science (ಸಮಾಜ ವಿಜ್ಞಾನ)", code: "SST", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Physical Education & Yoga", code: "PET", subjectType: "ACTIVITY", classLevel: 1, weeklyPeriods: 4, isOptional: false },
  ],
  bellSchedule: STANDARD_SECONDARY_BELL_SCHEDULE,
  feeHeads: [
    { name: "Government Prescribed Tuition Fee", headType: "TUITION", frequency: "ANNUAL", isMandatory: true, sortOrder: 1, defaultLedgerAccountCode: "4001" },
    { name: "Development & Special Facilities Fee", headType: "MISCELLANEOUS", frequency: "ANNUAL", isMandatory: false, sortOrder: 2, defaultLedgerAccountCode: "4006" },
  ],
  salaryGrades: [
    { gradeName: "State Scale High School Teacher", basicSalaryPaise: 3800000, hraPercent: 16, daPercent: 20, pfPercent: 12, otherAllowances: { medical: 100000 } },
    { gradeName: "State Scale Primary Teacher", basicSalaryPaise: 2700000, hraPercent: 14, daPercent: 20, pfPercent: 12, otherAllowances: { medical: 80000 } },
  ],
  holidays: [
    ...STANDARD_NATIONAL_HOLIDAYS,
    { name: "Karnataka Rajyotsava", month: 11, day: 1, isFixedAnnual: true, holidayType: "REGIONAL" },
    { name: "Kanakadasa Jayanti", month: 11, day: 28, isFixedAnnual: false, holidayType: "REGIONAL" },
  ],
  roleDefaults: STANDARD_ROLE_DEFAULTS,
};

// ─── 6. International Baccalaureate (PYP / MYP) ────────────────────────────────
export const IB_PYP_MYP_BLUEPRINT: CanonicalBlueprint = {
  id: "IB_PYP_MYP_V1",
  version: "1.0.0",
  board: "IB",
  jurisdiction: "International",
  schoolType: "INTEGRATED",
  displayName: "International Baccalaureate (PYP / MYP)",
  description: "Inquiry-based international curriculum scaffold covering Primary Years (PYP) and Middle Years (MYP) with transdisciplinary units.",
  academicYear: {
    name: "IB Academic Cycle (August - June)",
    startMonth: 8, // August
    endMonth: 6,   // June
    terms: [
      { name: "Semester 1", startMonth: 8, endMonth: 12 },
      { name: "Semester 2", startMonth: 1, endMonth: 6 },
    ],
  },
  classes: [
    { name: "PYP 1", numericLevel: 1, gradeLevel: "CLASS_1", streams: [], defaultSections: ["A"], sortOrder: 1 },
    { name: "PYP 2", numericLevel: 2, gradeLevel: "CLASS_2", streams: [], defaultSections: ["A"], sortOrder: 2 },
    { name: "PYP 3", numericLevel: 3, gradeLevel: "CLASS_3", streams: [], defaultSections: ["A"], sortOrder: 3 },
    { name: "PYP 4", numericLevel: 4, gradeLevel: "CLASS_4", streams: [], defaultSections: ["A"], sortOrder: 4 },
    { name: "PYP 5", numericLevel: 5, gradeLevel: "CLASS_5", streams: [], defaultSections: ["A"], sortOrder: 5 },
    { name: "MYP 1", numericLevel: 6, gradeLevel: "CLASS_6", streams: [], defaultSections: ["A"], sortOrder: 6 },
    { name: "MYP 2", numericLevel: 7, gradeLevel: "CLASS_7", streams: [], defaultSections: ["A"], sortOrder: 7 },
    { name: "MYP 3", numericLevel: 8, gradeLevel: "CLASS_8", streams: [], defaultSections: ["A"], sortOrder: 8 },
    { name: "MYP 4", numericLevel: 9, gradeLevel: "CLASS_9", streams: [], defaultSections: ["A"], sortOrder: 9 },
    { name: "MYP 5", numericLevel: 10, gradeLevel: "CLASS_10", streams: [], defaultSections: ["A"], sortOrder: 10 },
  ],
  subjects: [
    { name: "Language & Literature (English)", code: "IB_LANG_LIT", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Language Acquisition (Spanish/French)", code: "IB_LANG_ACQ", subjectType: "LANGUAGE", classLevel: 1, weeklyPeriods: 4, isOptional: false },
    { name: "Individuals & Societies", code: "IB_IND_SOC", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 5, isOptional: false },
    { name: "Sciences (Integrated)", code: "IB_SCI", subjectType: "PRACTICAL", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Mathematics", code: "IB_MATH", subjectType: "THEORY", classLevel: 1, weeklyPeriods: 6, isOptional: false },
    { name: "Arts (Visual & Performing)", code: "IB_ARTS", subjectType: "ACTIVITY", classLevel: 1, weeklyPeriods: 4, isOptional: false },
    { name: "Design & Technology", code: "IB_DESIGN", subjectType: "PRACTICAL", classLevel: 1, weeklyPeriods: 4, isOptional: false },
  ],
  bellSchedule: {
    workingDays: [1, 2, 3, 4, 5], // 5 days for IB
    periodsPerDay: 7,
    periods: [
      { periodNumber: 0, periodType: "ASSEMBLY", startTime: "08:30", endTime: "08:50", durationMinutes: 20 },
      { periodNumber: 1, periodType: "INSTRUCTION", startTime: "08:50", endTime: "09:40", durationMinutes: 50 },
      { periodNumber: 2, periodType: "INSTRUCTION", startTime: "09:40", endTime: "10:30", durationMinutes: 50 },
      { periodNumber: 0, periodType: "SHORT_BREAK", startTime: "10:30", endTime: "10:50", durationMinutes: 20 },
      { periodNumber: 3, periodType: "INSTRUCTION", startTime: "10:50", endTime: "11:40", durationMinutes: 50 },
      { periodNumber: 4, periodType: "INSTRUCTION", startTime: "11:40", endTime: "12:30", durationMinutes: 50 },
      { periodNumber: 0, periodType: "LUNCH_BREAK", startTime: "12:30", endTime: "13:20", durationMinutes: 50 },
      { periodNumber: 5, periodType: "INSTRUCTION", startTime: "13:20", endTime: "14:10", durationMinutes: 50 },
      { periodNumber: 6, periodType: "INSTRUCTION", startTime: "14:10", endTime: "15:00", durationMinutes: 50 },
      { periodNumber: 7, periodType: "ACTIVITY", startTime: "15:00", endTime: "15:45", durationMinutes: 45 },
    ],
  },
  feeHeads: [
    { name: "IB Programme Tuition Fee", headType: "TUITION", frequency: "QUARTERLY", isMandatory: true, sortOrder: 1, defaultLedgerAccountCode: "4001" },
    { name: "IB Learning Resources & Consumables", headType: "LAB", frequency: "ANNUAL", isMandatory: true, sortOrder: 2, defaultLedgerAccountCode: "4003" },
  ],
  salaryGrades: [
    { gradeName: "IB PYP/MYP Coordinator", basicSalaryPaise: 6500000, hraPercent: 25, daPercent: 10, pfPercent: 12, otherAllowances: { international: 500000 } },
    { gradeName: "IB Facilitator / Teacher", basicSalaryPaise: 4800000, hraPercent: 20, daPercent: 10, pfPercent: 12, otherAllowances: { international: 300000 } },
  ],
  holidays: STANDARD_NATIONAL_HOLIDAYS,
  roleDefaults: STANDARD_ROLE_DEFAULTS,
};

// ─── Blueprint Registry & Helper Functions ────────────────────────────────────
export const ALL_CANONICAL_BLUEPRINTS: CanonicalBlueprint[] = [
  CBSE_SECONDARY_BLUEPRINT,
  CBSE_PRIMARY_BLUEPRINT,
  CBSE_SR_SECONDARY_BLUEPRINT,
  ICSE_SECONDARY_BLUEPRINT,
  STATE_BOARD_KARNATAKA_BLUEPRINT,
  IB_PYP_MYP_BLUEPRINT,
];

export function getCanonicalBlueprint(id: string): CanonicalBlueprint | undefined {
  if (!id) return undefined;
  const normalized = id.trim().toUpperCase().replace(/-/g, "_");
  return ALL_CANONICAL_BLUEPRINTS.find(
    (b) => b.id === id || b.id.toUpperCase() === normalized
  );
}

export function listAvailableBlueprints(): CanonicalBlueprint[] {
  return ALL_CANONICAL_BLUEPRINTS;
}

export function getAllCanonicalBlueprints(): CanonicalBlueprint[] {
  return ALL_CANONICAL_BLUEPRINTS;
}
