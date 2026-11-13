"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import {
  ClassSetupItem,
  SubjectSetupItem,
  FeeHeadSetupItem,
  ComprehensiveOnboardPayload,
} from "@/app/actions/onboard";
import {
  SchoolBoard,
  GradingScale,
  ClassGroup,
  ALL_CLASS_GROUPS,
  mapGradeLevelToClassGroup,
  deriveClassGroupsFromClasses,
} from "@/lib/examBoardBlueprints";
import { getCanonicalSortOrder } from "@/lib/academicOrdering";

export type BoardType = SchoolBoard;

export interface MatrixSubjectItem {
  code: string;
  name: string;
  subjectType: "THEORY" | "PRACTICAL" | "LANGUAGE" | "ACTIVITY" | "CO_SCHOLASTIC";
  applicableGroups: ClassGroup[];
  isOfferedByGroup: Record<ClassGroup, boolean>;
}

export const CLASS_GROUP_INFO: Record<
  ClassGroup,
  { label: string; gradeRange: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  NURSERY_UKG: {
    label: "Pre-Primary Wing",
    gradeRange: "Nursery – UKG",
    colorClass: "text-purple-400",
    bgClass: "bg-purple-950/40",
    borderClass: "border-purple-800/50",
  },
  CLASS_1_5: {
    label: "Primary Wing",
    gradeRange: "Class 1 – 5",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-950/40",
    borderClass: "border-blue-800/50",
  },
  CLASS_6_8: {
    label: "Middle School Wing",
    gradeRange: "Class 6 – 8",
    colorClass: "text-cyan-400",
    bgClass: "bg-cyan-950/40",
    borderClass: "border-cyan-800/50",
  },
  CLASS_9_10: {
    label: "Secondary Wing",
    gradeRange: "Class 9 – 10",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-950/40",
    borderClass: "border-amber-800/50",
  },
  CLASS_11_12: {
    label: "Senior Secondary Wing",
    gradeRange: "Class 11 – 12",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-950/40",
    borderClass: "border-emerald-800/50",
  },
};

export const BOARD_DISPLAY_DATA: Record<
  BoardType,
  { name: string; subtitle: string; examSystem: string; defaultGrading: GradingScale }
> = {
  CBSE: {
    name: "Central Board of Secondary Education (CBSE)",
    subtitle: "All-India national curriculum with NCERT standards, CCE assessments, and 9-point grading",
    examSystem: "Terms & Periodic Tests with Internal Assessments",
    defaultGrading: "CBSE_9_POINT",
  },
  ICSE: {
    name: "Council for the Indian School Certificate Examinations (ICSE/ISC)",
    subtitle: "In-depth application curriculum with comprehensive practical and project coursework",
    examSystem: "Unit Tests, Half-Yearly, and Board Prelims",
    defaultGrading: "PERCENTAGE",
  },
  STATE_BOARD: {
    name: "State Education Board (SSC / Matriculation)",
    subtitle: "Regional language integration, state syllabus conformity, and continuous evaluation",
    examSystem: "Formative & Summative Assessments (FA / SA)",
    defaultGrading: "PERCENTAGE",
  },
  IGCSE: {
    name: "Cambridge Assessment International Education (CAIE)",
    subtitle: "Global inquiry-based framework with international benchmark testing and A-Levels",
    examSystem: "Progression Tests, Checkpoints, and Mock Series",
    defaultGrading: "PERCENTAGE",
  },
  IB: {
    name: "International Baccalaureate (IB - PYP, MYP, DP)",
    subtitle: "Holistic student-centric inquiry program with DP Core, Theory of Knowledge, and CAS",
    examSystem: "Criterion-Referenced Rubrics and Moderation",
    defaultGrading: "GPA",
  },
};

export function getDefaultClassesForBoard(board: BoardType): ClassSetupItem[] {
  // Pre-seed K-10 or K-12 by default
  const baseK10: ClassSetupItem[] = [
    { gradeLevel: "NURSERY", displayName: "Nursery", sections: ["A"] },
    { gradeLevel: "LKG", displayName: "LKG", sections: ["A"] },
    { gradeLevel: "UKG", displayName: "UKG", sections: ["A"] },
    { gradeLevel: "CLASS_1", displayName: "Class 1", sections: ["A"] },
    { gradeLevel: "CLASS_2", displayName: "Class 2", sections: ["A"] },
    { gradeLevel: "CLASS_3", displayName: "Class 3", sections: ["A"] },
    { gradeLevel: "CLASS_4", displayName: "Class 4", sections: ["A"] },
    { gradeLevel: "CLASS_5", displayName: "Class 5", sections: ["A"] },
    { gradeLevel: "CLASS_6", displayName: "Class 6", sections: ["A"] },
    { gradeLevel: "CLASS_7", displayName: "Class 7", sections: ["A"] },
    { gradeLevel: "CLASS_8", displayName: "Class 8", sections: ["A"] },
    { gradeLevel: "CLASS_9", displayName: "Class 9", sections: ["A"] },
    { gradeLevel: "CLASS_10", displayName: "Class 10", sections: ["A"] },
  ];

  if (board === "CBSE" || board === "ICSE") {
    return [
      ...baseK10,
      { gradeLevel: "CLASS_11", displayName: "Class 11", sections: ["A"] },
      { gradeLevel: "CLASS_12", displayName: "Class 12", sections: ["A"] },
    ];
  }

  return baseK10;
}

export function getDefaultSubjectMatrixForBoard(board: BoardType): MatrixSubjectItem[] {
  switch (board) {
    case "ICSE":
      return [
        {
          code: "ENG1",
          name: "English Language (Paper 1)",
          subjectType: "LANGUAGE",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "ENG2",
          name: "Literature in English (Paper 2)",
          subjectType: "LANGUAGE",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "SLANG",
          name: "Second Language (Hindi/Regional)",
          subjectType: "LANGUAGE",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "MATH",
          name: "Mathematics",
          subjectType: "THEORY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "SCI",
          name: "Science (Physics, Chemistry, Biology)",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "HCG",
          name: "History, Civics & Geography (HCG)",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "CTA",
          name: "Computer Applications",
          subjectType: "PRACTICAL",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "PED",
          name: "Physical Education",
          subjectType: "ACTIVITY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
      ];

    case "STATE_BOARD":
      return [
        {
          code: "FLANG",
          name: "First Language (Regional)",
          subjectType: "LANGUAGE",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "ENG",
          name: "Second Language (English)",
          subjectType: "LANGUAGE",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "HIN",
          name: "Third Language (Hindi)",
          subjectType: "LANGUAGE",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "MATH",
          name: "Mathematics",
          subjectType: "THEORY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "SCI",
          name: "General Science",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "SST",
          name: "Social Science",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "COMP",
          name: "Computer Applications",
          subjectType: "PRACTICAL",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "PHE",
          name: "Physical & Health Education",
          subjectType: "ACTIVITY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
      ];

    case "IGCSE":
      return [
        {
          code: "ENG",
          name: "First Language English",
          subjectType: "LANGUAGE",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "LIT",
          name: "Literature in English",
          subjectType: "LANGUAGE",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "MATH",
          name: "Mathematics (Extended)",
          subjectType: "THEORY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "SCI",
          name: "Co-ordinated Sciences",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "GP",
          name: "Global Perspectives",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "CS",
          name: "Computer Science",
          subjectType: "PRACTICAL",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "PE",
          name: "Physical Education",
          subjectType: "ACTIVITY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
      ];

    case "IB":
      return [
        {
          code: "LANGA",
          name: "Language & Literature",
          subjectType: "LANGUAGE",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "LANGB",
          name: "Language Acquisition",
          subjectType: "LANGUAGE",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "MATH",
          name: "Mathematics",
          subjectType: "THEORY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "SCI",
          name: "Integrated Sciences",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "INS",
          name: "Individuals & Societies",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "DES",
          name: "Design & Technology",
          subjectType: "PRACTICAL",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "PHE",
          name: "Physical & Health Education",
          subjectType: "ACTIVITY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
      ];

    case "CBSE":
    default:
      return [
        {
          code: "ENG",
          name: "English Language & Literature",
          subjectType: "LANGUAGE",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "HIN",
          name: "Hindi Course A",
          subjectType: "LANGUAGE",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "MATH",
          name: "Mathematics",
          subjectType: "THEORY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "EVS",
          name: "Environmental Studies (EVS)",
          subjectType: "THEORY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: false, CLASS_9_10: false, CLASS_11_12: false },
        },
        {
          code: "SCI",
          name: "General Science",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "SST",
          name: "Social Science",
          subjectType: "THEORY",
          applicableGroups: ["CLASS_6_8", "CLASS_9_10"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: false, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: false },
        },
        {
          code: "CS",
          name: "Computer Science & IT",
          subjectType: "PRACTICAL",
          applicableGroups: ["CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: false, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
        {
          code: "PED",
          name: "Physical Education",
          subjectType: "ACTIVITY",
          applicableGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
          isOfferedByGroup: { NURSERY_UKG: true, CLASS_1_5: true, CLASS_6_8: true, CLASS_9_10: true, CLASS_11_12: true },
        },
      ];
  }
}

export interface OnboardingContextType {
  activeStep: number;
  setActiveStep: (step: number) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  error: string;
  setError: (e: string) => void;
  successResult: { message: string; email: string } | null;
  setSuccessResult: (res: { message: string; email: string } | null) => void;

  // Board Selection (Step 1)
  board: BoardType;
  setBoard: (b: BoardType) => void;
  handleBoardSelect: (b: BoardType) => void;

  // Session & Profile (Step 2)
  academicSession: string;
  setAcademicSession: (s: string) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (s: string) => void;
  schoolName: string;
  setSchoolName: (s: string) => void;
  udiseCode: string;
  setUdiseCode: (s: string) => void;
  address: string;
  setAddress: (s: string) => void;
  city: string;
  setCity: (s: string) => void;
  state: string;
  setState: (s: string) => void;
  pincode: string;
  setPincode: (s: string) => void;
  phone: string;
  setPhone: (s: string) => void;
  email: string;
  setEmail: (s: string) => void;
  principalName: string;
  setPrincipalName: (s: string) => void;
  currencySymbol: string;
  setCurrencySymbol: (s: string) => void;

  // Classes (Step 3)
  classesList: ClassSetupItem[];
  setClassesList: React.Dispatch<React.SetStateAction<ClassSetupItem[]>>;
  addClass: (displayName: string, gradeLevel: string) => void;
  removeClass: (index: number) => void;
  toggleSectionForClass: (classIndex: number, sectionName: string) => void;

  // Curriculum Review Drawer (Step 4)
  subjectMatrix: MatrixSubjectItem[];
  setSubjectMatrix: React.Dispatch<React.SetStateAction<MatrixSubjectItem[]>>;
  toggleMatrixCell: (subjectCode: string, group: ClassGroup) => void;
  addCustomSubject: (name: string, code: string, subjectType: MatrixSubjectItem["subjectType"], groups: ClassGroup[]) => void;

  // Fees (Step 5)
  feeHeadsList: FeeHeadSetupItem[];
  setFeeHeadsList: React.Dispatch<React.SetStateAction<FeeHeadSetupItem[]>>;
  addFeeHead: (name: string, code: string, category: FeeHeadSetupItem["category"], headType: FeeHeadSetupItem["headType"]) => void;
  removeFeeHead: (index: number) => void;

  // Admin Credentials (Step 6)
  adminName: string;
  setAdminName: (s: string) => void;
  adminEmail: string;
  setAdminEmail: (s: string) => void;
  adminPassword: string;
  setAdminPassword: (s: string) => void;
  confirmPassword: string;
  setConfirmPassword: (s: string) => void;
  captchaAnswer: string;
  setCaptchaAnswer: (s: string) => void;
  captchaNum1: number;
  captchaNum2: number;

  // Grading & Seeding Options
  gradingScale: GradingScale;
  setGradingScale: (scale: GradingScale) => void;
  loadExamDefaults: boolean;
  setLoadExamDefaults: (v: boolean) => void;

  // Helper derived getters
  activeClassGroups: ClassGroup[];
  compilePayload: () => ComprehensiveOnboardPayload;
  validateAndNext: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successResult, setSuccessResult] = useState<{ message: string; email: string } | null>(null);

  // 1. Board
  const [board, setBoard] = useState<BoardType>("CBSE");

  // 2. Profile & Session
  const [academicSession, setAcademicSession] = useState("2026-27");
  const [startDate, setStartDate] = useState("2026-04-01");
  const [endDate, setEndDate] = useState("2027-03-31");
  const [schoolName, setSchoolName] = useState("");
  const [udiseCode, setUdiseCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [email, setEmail] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  // 3. Classes
  const [classesList, setClassesList] = useState<ClassSetupItem[]>(getDefaultClassesForBoard("CBSE"));

  // 4. Curriculum Matrix
  const [subjectMatrix, setSubjectMatrix] = useState<MatrixSubjectItem[]>(getDefaultSubjectMatrixForBoard("CBSE"));

  // 5. Fee Heads
  const [feeHeadsList, setFeeHeadsList] = useState<FeeHeadSetupItem[]>([
    { name: "Tuition Fee", code: "TUT", category: "RECURRING", headType: "TUITION" },
    { name: "Science & Computer Lab Fee", code: "LAB", category: "RECURRING", headType: "LAB" },
    { name: "Library & Resource Hub", code: "LIB", category: "RECURRING", headType: "LIBRARY" },
    { name: "Transport Fee (Opt-In)", code: "TRN", category: "OPTIONAL", headType: "TRANSPORT" },
    { name: "Admission Fee", code: "ADM", category: "ONE_TIME", headType: "ADMISSION" },
    { name: "Refundable Caution Deposit", code: "CAU", category: "ONE_TIME", headType: "MISCELLANEOUS", isRefundable: true },
  ]);

  // 6. Admin Credentials & Captcha
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaNum1] = useState(3);
  const [captchaNum2] = useState(7);

  // Grading
  const [gradingScale, setGradingScale] = useState<GradingScale>("CBSE_9_POINT");
  const [loadExamDefaults, setLoadExamDefaults] = useState(true);

  // Handle Board Selection
  const handleBoardSelect = (selectedBoard: BoardType) => {
    setBoard(selectedBoard);
    setClassesList(getDefaultClassesForBoard(selectedBoard));
    setSubjectMatrix(getDefaultSubjectMatrixForBoard(selectedBoard));
    setGradingScale(BOARD_DISPLAY_DATA[selectedBoard].defaultGrading);
  };

  const activeClassGroups = useMemo(() => {
    return deriveClassGroupsFromClasses(classesList);
  }, [classesList]);

  // Class actions
  const addClass = (displayName: string, gradeLevel: string) => {
    const newClass: ClassSetupItem = {
      displayName,
      gradeLevel: gradeLevel || displayName.toUpperCase().replace(/\s+/g, "_"),
      sections: ["A"],
    };
    const updated = [...classesList, newClass].sort((a, b) => {
      return getCanonicalSortOrder(a.gradeLevel, a.displayName) - getCanonicalSortOrder(b.gradeLevel, b.displayName);
    });
    setClassesList(updated);
  };

  const removeClass = (index: number) => {
    setClassesList((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSectionForClass = (classIndex: number, sectionName: string) => {
    setClassesList((prev) => {
      const copy = [...prev];
      const target = copy[classIndex];
      if (!target) return prev;
      const secSet = new Set(target.sections);
      if (secSet.has(sectionName)) {
        if (secSet.size > 1) secSet.delete(sectionName);
      } else {
        secSet.add(sectionName);
      }
      copy[classIndex] = {
        ...target,
        sections: Array.from(secSet).sort(),
      };
      return copy;
    });
  };

  // Matrix cell toggle
  const toggleMatrixCell = (subjectCode: string, group: ClassGroup) => {
    setSubjectMatrix((prev) => {
      return prev.map((item) => {
        if (item.code !== subjectCode) return item;
        const currentVal = Boolean(item.isOfferedByGroup[group]);
        return {
          ...item,
          isOfferedByGroup: {
            ...item.isOfferedByGroup,
            [group]: !currentVal,
          },
        };
      });
    });
  };

  const addCustomSubject = (
    name: string,
    code: string,
    subjectType: MatrixSubjectItem["subjectType"],
    groups: ClassGroup[],
  ) => {
    const isOffered: Record<ClassGroup, boolean> = {
      NURSERY_UKG: groups.includes("NURSERY_UKG"),
      CLASS_1_5: groups.includes("CLASS_1_5"),
      CLASS_6_8: groups.includes("CLASS_6_8"),
      CLASS_9_10: groups.includes("CLASS_9_10"),
      CLASS_11_12: groups.includes("CLASS_11_12"),
    };
    const newSub: MatrixSubjectItem = {
      name,
      code: code || name.substring(0, 4).toUpperCase(),
      subjectType,
      applicableGroups: groups,
      isOfferedByGroup: isOffered,
    };
    setSubjectMatrix((prev) => [...prev, newSub]);
  };

  const addFeeHead = (
    name: string,
    code: string,
    category: FeeHeadSetupItem["category"],
    headType: FeeHeadSetupItem["headType"],
  ) => {
    const item: FeeHeadSetupItem = {
      name,
      code: code || name.substring(0, 4).toUpperCase(),
      category,
      headType,
    };
    setFeeHeadsList((prev) => [...prev, item]);
  };

  const removeFeeHead = (index: number) => {
    setFeeHeadsList((prev) => prev.filter((_, i) => i !== index));
  };

  // Compile final registerSchoolTenant payload
  const compilePayload = (): ComprehensiveOnboardPayload => {
    // Generate subjectsSetup from matrix
    const subjectsSetup: SubjectSetupItem[] = subjectMatrix.map((m) => {
      const applicableGroups = ALL_CLASS_GROUPS.filter((g) => m.isOfferedByGroup[g]);
      return {
        name: m.name,
        code: m.code,
        subjectType: m.subjectType,
        applicableClassGroups: applicableGroups,
      };
    });

    // Populate subjectCodes per classSetupItem according to its class group!
    const classesSetupWithSubjects: ClassSetupItem[] = classesList.map((cls) => {
      const grp = mapGradeLevelToClassGroup(cls.gradeLevel || cls.displayName);
      const offeredCodes = subjectMatrix
        .filter((m) => Boolean(m.isOfferedByGroup[grp]))
        .map((m) => m.code);
      return {
        ...cls,
        subjectCodes: offeredCodes,
      };
    });

    return {
      academicYearLabel: academicSession,
      startDate,
      endDate,
      schoolName,
      board,
      udiseCode,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      principalName: principalName || adminName,
      currencySymbol,
      classesSetup: classesSetupWithSubjects,
      subjectsSetup,
      feeHeadsSetup: feeHeadsList,
      gradingScale,
      loadExamDefaults,
      adminName,
      adminEmail,
      adminPassword,
    };
  };

  const validateAndNext = () => {
    setError("");
    if (activeStep === 1) {
      if (!board) {
        setError("Please select an educational board.");
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (!schoolName || !udiseCode || !email) {
        setError("Please enter School Name, UDISE Code / Slug, and Official Email.");
        return;
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      if (classesList.length === 0) {
        setError("Please configure at least one class.");
        return;
      }
      setActiveStep(4);
    } else if (activeStep === 4) {
      // Step 4 is Review Drawer (matrix). Defaults are accepted with 0 clicks!
      setActiveStep(5);
    } else if (activeStep === 5) {
      if (feeHeadsList.length === 0) {
        setError("Please configure at least one fee head.");
        return;
      }
      setActiveStep(6);
    } else if (activeStep === 6) {
      if (!adminName || !adminEmail || !adminPassword) {
        setError("Please complete all administrator credentials.");
        return;
      }
      if (adminPassword !== confirmPassword) {
        setError("Admin passwords do not match.");
        return;
      }
      if (parseInt(captchaAnswer) !== captchaNum1 + captchaNum2) {
        setError(`Security verification failed: what is ${captchaNum1} + ${captchaNum2}?`);
        return;
      }
      setActiveStep(7);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        activeStep,
        setActiveStep,
        loading,
        setLoading,
        error,
        setError,
        successResult,
        setSuccessResult,
        board,
        setBoard,
        handleBoardSelect,
        academicSession,
        setAcademicSession,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        schoolName,
        setSchoolName,
        udiseCode,
        setUdiseCode,
        address,
        setAddress,
        city,
        setCity,
        state,
        setState,
        pincode,
        setPincode,
        phone,
        setPhone,
        email,
        setEmail,
        principalName,
        setPrincipalName,
        currencySymbol,
        setCurrencySymbol,
        classesList,
        setClassesList,
        addClass,
        removeClass,
        toggleSectionForClass,
        subjectMatrix,
        setSubjectMatrix,
        toggleMatrixCell,
        addCustomSubject,
        feeHeadsList,
        setFeeHeadsList,
        addFeeHead,
        removeFeeHead,
        adminName,
        setAdminName,
        adminEmail,
        setAdminEmail,
        adminPassword,
        setAdminPassword,
        confirmPassword,
        setConfirmPassword,
        captchaAnswer,
        setCaptchaAnswer,
        captchaNum1,
        captchaNum2,
        gradingScale,
        setGradingScale,
        loadExamDefaults,
        setLoadExamDefaults,
        activeClassGroups,
        compilePayload,
        validateAndNext,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
