/**
 * Role-Scoped Route Resolvers for Teacher and Parent PWAs.
 *
 * Requirements (docs/entity-engine-spec.json Phase E6):
 *  - Reuse parseOmniboxQuery unchanged for extraction; role resolvers only map (intent, entities, scope) -> route.
 *  - Teacher resolver points ONLY to surfaces landed in T1-T10 (/teacher/attendance, /teacher/grading, /teacher/classes).
 *    Returns null intent (plain search) for anything outside teacher scope or admin-only intents.
 *  - Parent resolver maps to landed P-surfaces (/parent/fees, /parent/bus, /parent/more, /parent/messages, etc.)
 *    Ward-scoped: entity params are intersected with the parent's own wards. Cross-ward / admin routes resolve to null.
 *  - Zero external / server dependencies; pure and client-safe.
 *
 * @module query-ner/roleResolvers
 */

import type { ParsedQuery, RecognizedEntity } from "./types";

export interface TeacherScopeContext {
  allSectionIds?: string[];
  classTeacherSections?: string[];
  teachingSections?: Array<{
    sectionId: string;
    className?: string;
    sectionName?: string;
    subjectName?: string;
  }>;
  assignedClasses?: string[]; // e.g. ["10-A", "Class 10-A", "10A"]
}

export interface ParentWardContext {
  id: string;
  name?: string;
  grade?: string;
  section?: string;
  busRoute?: string;
}

export interface ResolvedRoleRoute {
  route: string;
  actionLabel: string;
  actionLabelHi?: string;
  category: "TEACHER" | "PARENT";
  confidenceScore: number;
  entityChips: RecognizedEntity[];
}

export const REAL_TEACHER_ROUTES = new Set([
  "/teacher/dashboard",
  "/teacher/classes",
  "/teacher/attendance",
  "/teacher/grading",
  "/teacher/homework",
  "/teacher/syllabus",
  "/teacher/ptm",
  "/teacher/payroll",
  "/teacher/profile",
  "/teacher/more",
]);

export const REAL_PARENT_ROUTES = new Set([
  "/parent/dashboard",
  "/parent/fees",
  "/parent/bus",
  "/parent/attendance",
  "/parent/documents",
  "/parent/messages",
  "/parent/profile",
  "/parent/more",
  "/parent/more/leave",
]);

/**
 * Normalizes grade/section tokens (e.g. "Class 10-A" -> "10-A", "10A" -> "10-A")
 */
function normalizeClassKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/^CLASS\s+/i, "")
    .replace(/^GRADE\s+/i, "")
    .replace(/\s+/g, "")
    .replace(/([0-9]+)([A-Z])$/, "$1-$2");
}

/**
 * Verifies whether a requested class/section matches a teacher's assigned scope.
 */
function isClassInTeacherScope(
  grade: string | undefined,
  section: string | undefined,
  normalizedEntity: string,
  scope?: TeacherScopeContext
): boolean {
  if (!scope) return true; // Unrestricted if scope not provided

  const targetKey = normalizeClassKey(
    grade && section ? `${grade}-${section}` : normalizedEntity
  );

  // Check explicit assignedClasses array
  if (scope.assignedClasses && scope.assignedClasses.length > 0) {
    const hasMatch = scope.assignedClasses.some((c) => {
      const norm = normalizeClassKey(c);
      return norm === targetKey || norm.startsWith(targetKey);
    });
    if (hasMatch) return true;
  }

  // Check teachingSections
  if (scope.teachingSections && scope.teachingSections.length > 0) {
    const hasMatch = scope.teachingSections.some((ts) => {
      const cls = ts.className || "";
      const sec = ts.sectionName || "";
      const k1 = normalizeClassKey(`${cls}-${sec}`);
      const k2 = normalizeClassKey(sec);
      return k1 === targetKey || k2 === targetKey || (grade && cls.includes(grade));
    });
    if (hasMatch) return true;
  }

  // If scope has defined sections but no match was found, access denied
  const hasDefinedSections =
    (scope.assignedClasses && scope.assignedClasses.length > 0) ||
    (scope.teachingSections && scope.teachingSections.length > 0);

  return !hasDefinedSections;
}

/**
 * Verifies whether a requested ward/class/bus matches a parent's registered wards.
 */
function isWardInParentScope(
  grade: string | undefined,
  section: string | undefined,
  studentName: string | undefined,
  busRoute: string | undefined,
  wards?: ParentWardContext[]
): boolean {
  if (!wards || wards.length === 0) return true; // Unrestricted if wards not provided

  // If query mentions student name, match against wards
  if (studentName) {
    const sNorm = studentName.toLowerCase();
    const hasMatch = wards.some((w) => w.name && w.name.toLowerCase().includes(sNorm));
    if (!hasMatch) return false;
  }

  // If query mentions class/section, match against wards' grade/section
  if (grade) {
    const targetKey = normalizeClassKey(
      section ? `${grade}-${section}` : grade
    );
    const hasMatch = wards.some((w) => {
      if (!w.grade) return false;
      const wardKey = normalizeClassKey(
        w.section ? `${w.grade}-${w.section}` : w.grade
      );
      return wardKey === targetKey || wardKey.startsWith(targetKey);
    });
    if (!hasMatch) return false;
  }

  // If query mentions bus route, match against wards' route
  if (busRoute) {
    const bNorm = busRoute.toLowerCase().replace(/^(route|bus)\s*/i, "").trim();
    const hasMatch = wards.some((w) => {
      if (!w.busRoute) return true; // Ward has no bus constraint
      const wb = w.busRoute.toLowerCase().replace(/^(route|bus)\s*/i, "").trim();
      return wb === bNorm;
    });
    if (!hasMatch) return false;
  }

  return true;
}

/**
 * Resolves an omnibox query into a Teacher PWA surface route.
 * Returns null if confidence is low, intent is outside teacher role, or outside teacher scope.
 */
export function teacherRouteResolver(
  parsed: ParsedQuery,
  scope?: TeacherScopeContext
): ResolvedRoleRoute | null {
  if (!parsed) return null;

  const rawLower = parsed.rawQuery.toLowerCase();
  const isHomeworkOrSyllabus =
    rawLower.includes("homework") ||
    rawLower.includes("assignment") ||
    rawLower.includes("गृहकार्य") ||
    rawLower.includes("syllabus") ||
    rawLower.includes("curriculum") ||
    rawLower.includes("पाठ्यक्रम");

  if (parsed.confidenceScore < 0.8 && !isHomeworkOrSyllabus) return null;
  const classEntity = parsed.recognizedEntities.find((e) => e.type === "CLASS_SECTION");
  const subjectEntity = parsed.recognizedEntities.find((e) => e.type === "SUBJECT");
  const examEntity = parsed.recognizedEntities.find((e) => e.type === "EXAM_NAME");

  const grade = classEntity?.metadata?.class || classEntity?.metadata?.grade;
  const section = classEntity?.metadata?.section;

  // 1. Check scope constraint if class is present
  if (classEntity) {
    const inScope = isClassInTeacherScope(grade, section, classEntity.normalized, scope);
    if (!inScope) {
      return null; // Teacher cannot navigate to classes outside their allocation
    }
  }

  const intentType = parsed.primaryIntent?.type;

  // 2. Attendance Workbench (Phase T4 surface: /teacher/attendance)
  if (
    intentType === "TAKE_ATTENDANCE" ||
    intentType === "VIEW_ATTENDANCE" ||
    rawLower.includes("attendance") ||
    rawLower.includes("roll call") ||
    rawLower.includes("उपस्थिति") ||
    rawLower.includes("हाजिरी")
  ) {
    const params = new URLSearchParams();
    if (grade) params.set("grade", grade);
    if (section) params.set("section", section);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const labelSuffix = classEntity ? ` (${classEntity.normalized})` : "";

    return {
      route: `/teacher/attendance${qs}`,
      actionLabel: `Open Attendance Workbench${labelSuffix}`,
      actionLabelHi: `उपस्थिति रजिस्टर खोलें${labelSuffix}`,
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 3. Gradebook & Marks Entry (Phase T6 surface: /teacher/grading?tab=exams)
  if (
    intentType === "ENTER_MARKS" ||
    intentType === "VIEW_MARKS" ||
    rawLower.includes("marks") ||
    rawLower.includes("grading") ||
    rawLower.includes("अंक") ||
    rawLower.includes("नंबर")
  ) {
    const params = new URLSearchParams();
    params.set("tab", "exams");
    if (grade) params.set("grade", grade);
    if (section) params.set("section", section);
    if (subjectEntity) params.set("subject", subjectEntity.normalized);
    if (examEntity) params.set("exam", examEntity.normalized);
    const qs = `?${params.toString()}`;
    const labelSuffix = classEntity ? ` (${classEntity.normalized})` : "";

    return {
      route: `/teacher/grading${qs}`,
      actionLabel: `Open Marks Entry Grid${labelSuffix}`,
      actionLabelHi: `अंक प्रविष्टि ग्रिड खोलें${labelSuffix}`,
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 4. Substitutions Workbench (Phase T8 surface: /teacher/classes?tab=substitutions)
  if (
    rawLower.includes("substitution") ||
    rawLower.includes("substitutions") ||
    rawLower.includes("substitute") ||
    rawLower.includes("प्रतिस्थापन")
  ) {
    return {
      route: "/teacher/classes?tab=substitutions",
      actionLabel: "View Substitutions Workbench",
      actionLabelHi: "प्रतिस्थापन कार्यक्षेत्र देखें",
      category: "TEACHER",
      confidenceScore: Math.max(parsed.confidenceScore, 0.9),
      entityChips: parsed.recognizedEntities,
    };
  }

  // 5. My Day Timeline (Phase T7 surface: /teacher/classes?tab=myday)
  if (
    intentType === "VIEW_TIMETABLE" ||
    rawLower.includes("my day") ||
    rawLower.includes("myday") ||
    rawLower.includes("schedule") ||
    rawLower.includes("timetable") ||
    rawLower.includes("समय सारिणी") ||
    rawLower.includes("टाइमटेबल")
  ) {
    return {
      route: "/teacher/classes?tab=myday",
      actionLabel: "View My Day Timeline",
      actionLabelHi: "माई डे समयरेखा देखें",
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 6. Section Rosters (Phase T7 surface: /teacher/classes?tab=rosters)
  if (
    rawLower.includes("roster") ||
    rawLower.includes("students list") ||
    rawLower.includes("class list")
  ) {
    return {
      route: "/teacher/classes?tab=rosters",
      actionLabel: "View Section Rosters",
      actionLabelHi: "कक्षा रोस्टर देखें",
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 7. PTM (Teacher PTM Scheduler: /teacher/ptm)
  if (rawLower.includes("ptm") || rawLower.includes("parent meeting")) {
    return {
      route: "/teacher/ptm",
      actionLabel: "Open PTM Appointments",
      actionLabelHi: "पीटीएम नियुक्तियां खोलें",
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 8. Payroll & Payslips (/teacher/payroll)
  if (rawLower.includes("payroll") || rawLower.includes("salary") || rawLower.includes("payslip") || rawLower.includes("वेतन")) {
    return {
      route: "/teacher/payroll",
      actionLabel: "View Payslips & Payroll",
      actionLabelHi: "वेतन पर्ची और पेरोल देखें",
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 9. Homework & Assignments (/teacher/homework)
  if (
    rawLower.includes("homework") ||
    rawLower.includes("assignment") ||
    rawLower.includes("गृहकार्य") ||
    rawLower.includes("असाइनमेंट")
  ) {
    return {
      route: "/teacher/homework",
      actionLabel: "Manage Homework & Assignments",
      actionLabelHi: "गृहकार्य और असाइनमेंट प्रबंधित करें",
      category: "TEACHER",
      confidenceScore: Math.max(parsed.confidenceScore, 0.9),
      entityChips: parsed.recognizedEntities,
    };
  }

  // 10. Syllabus & Curriculum Tracker (/teacher/syllabus)
  if (
    rawLower.includes("syllabus") ||
    rawLower.includes("curriculum") ||
    rawLower.includes("पाठ्यक्रम") ||
    rawLower.includes("कोर्स")
  ) {
    return {
      route: "/teacher/syllabus",
      actionLabel: "View Syllabus & Curriculum Tracker",
      actionLabelHi: "पाठ्यक्रम एवं प्रगति ट्रैकर देखें",
      category: "TEACHER",
      confidenceScore: Math.max(parsed.confidenceScore, 0.9),
      entityChips: parsed.recognizedEntities,
    };
  }

  // 11. Calm Educator Feed (/teacher/dashboard)
  if (rawLower.includes("dashboard") || rawLower.includes("today") || rawLower.includes("आज") || rawLower === "home") {
    return {
      route: "/teacher/dashboard",
      actionLabel: "Open Today's Educator Feed",
      actionLabelHi: "आज का शिक्षक फ़ीड खोलें",
      category: "TEACHER",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // Any intent outside teacher capability (fees, bus tracking, admin operations) resolves to null
  return null;
}

/**
 * Resolves an omnibox query into a Parent PWA surface route.
 * Returns null if confidence is low, outside parent capability, or outside ward scope.
 */
export function parentRouteResolver(
  parsed: ParsedQuery,
  wards?: ParentWardContext[]
): ResolvedRoleRoute | null {
  if (!parsed) return null;

  const rawLower = parsed.rawQuery.toLowerCase();
  const isAcademicFeed =
    rawLower.includes("homework") ||
    rawLower.includes("assignment") ||
    rawLower.includes("classwork") ||
    rawLower.includes("syllabus") ||
    rawLower.includes("गृहकार्य") ||
    rawLower.includes("पाठ्यक्रम");

  if (parsed.confidenceScore < 0.8 && !isAcademicFeed) return null;
  const classEntity = parsed.recognizedEntities.find((e) => e.type === "CLASS_SECTION");
  const studentEntity = parsed.recognizedEntities.find((e) => e.type === "STUDENT_NAME");
  const busEntity = parsed.recognizedEntities.find((e) => e.type === "BUS_ROUTE");

  const grade = classEntity?.metadata?.class || classEntity?.metadata?.grade;
  const section = classEntity?.metadata?.section;
  const studentName = studentEntity?.normalized;
  const busRoute = busEntity?.normalized;

  // 1. Ward scope check: parent cannot access other students' records
  const inScope = isWardInParentScope(grade, section, studentName, busRoute, wards);
  if (!inScope) {
    return null;
  }

  const intentType = parsed.primaryIntent?.type;

  // 2. Fee Dues & Invoices (Phase P5 surface: /parent/fees)
  if (
    intentType === "VIEW_FEE_DUES" ||
    intentType === "COLLECT_FEE" ||
    rawLower.includes("fee") ||
    rawLower.includes("fees") ||
    rawLower.includes("dues") ||
    rawLower.includes("फीस") ||
    rawLower.includes("शुल्क")
  ) {
    return {
      route: "/parent/fees",
      actionLabel: "View Fee Dues & Invoices",
      actionLabelHi: "फीस बकाया और चालान देखें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 3. Live Transport Bus Tracking (Phase P7 surface: /parent/bus)
  if (
    intentType === "TRACK_BUS" ||
    busEntity ||
    rawLower.includes("bus") ||
    rawLower.includes("route") ||
    rawLower.includes("transport") ||
    rawLower.includes("बस") ||
    rawLower.includes("रूट")
  ) {
    const params = new URLSearchParams();
    if (busEntity?.metadata?.routeNumber) {
      params.set("route", busEntity.metadata.routeNumber);
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return {
      route: `/parent/bus${qs}`,
      actionLabel: "Track School Bus Live",
      actionLabelHi: "स्कूल बस को लाइव ट्रैक करें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 4. PTM Bookings (Phase P4 surface: /parent/more)
  if (rawLower.includes("ptm") || rawLower.includes("meeting") || rawLower.includes("appointment") || rawLower.includes("शिक्षक बैठक")) {
    return {
      route: "/parent/more",
      actionLabel: "Book PTM Appointment",
      actionLabelHi: "पीटीएम अपॉइंटमेंट बुक करें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 5. Notices & Messages Hub (/parent/messages)
  if (
    intentType === "CREATE_NOTICE" ||
    rawLower.includes("notice") ||
    rawLower.includes("notices") ||
    rawLower.includes("message") ||
    rawLower.includes("messages") ||
    rawLower.includes("सूचना") ||
    rawLower.includes("संदेश")
  ) {
    return {
      route: "/parent/messages",
      actionLabel: "View School Notices & Messages",
      actionLabelHi: "स्कूल की सूचनाएं और संदेश देखें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 6. Ward Attendance History (/parent/attendance)
  if (
    intentType === "VIEW_ATTENDANCE" ||
    rawLower.includes("attendance") ||
    rawLower.includes("उपस्थिति") ||
    rawLower.includes("हाजिरी")
  ) {
    return {
      route: "/parent/attendance",
      actionLabel: "View Ward Attendance History",
      actionLabelHi: "छात्र उपस्थिति इतिहास देखें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 7. Report Cards & Documents (/parent/documents)
  if (
    intentType === "VIEW_REPORT_CARD" ||
    intentType === "GENERATE_REPORT_CARD" ||
    rawLower.includes("report card") ||
    rawLower.includes("marksheet") ||
    rawLower.includes("document") ||
    rawLower.includes("documents") ||
    rawLower.includes("प्रगति पत्र")
  ) {
    return {
      route: "/parent/documents",
      actionLabel: "View Report Cards & Documents",
      actionLabelHi: "प्रगति पत्र और दस्तावेज देखें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 8. Leave Request (/parent/more/leave)
  if (rawLower.includes("leave") || rawLower.includes("chutti") || rawLower.includes("छुट्टी")) {
    return {
      route: "/parent/more/leave",
      actionLabel: "Apply for Student Leave",
      actionLabelHi: "छात्र अवकाश के लिए आवेदन करें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 9. Child Profile (/parent/profile)
  if (
    intentType === "VIEW_STUDENT_PROFILE" ||
    rawLower.includes("profile") ||
    rawLower.includes("child") ||
    rawLower.includes("ward")
  ) {
    return {
      route: "/parent/profile",
      actionLabel: "View Child Profile",
      actionLabelHi: "बच्चे की प्रोफ़ाइल देखें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // 10. Academic Feed & Homework (/parent/dashboard)
  if (
    rawLower.includes("homework") ||
    rawLower.includes("assignment") ||
    rawLower.includes("classwork") ||
    rawLower.includes("syllabus") ||
    rawLower.includes("गृहकार्य") ||
    rawLower.includes("पाठ्यक्रम")
  ) {
    return {
      route: "/parent/dashboard",
      actionLabel: "View Academic Feed & Homework",
      actionLabelHi: "शैक्षणिक फ़ीड और गृहकार्य देखें",
      category: "PARENT",
      confidenceScore: Math.max(parsed.confidenceScore, 0.9),
      entityChips: parsed.recognizedEntities,
    };
  }

  // 11. Parent Home Feed (/parent/dashboard)
  if (rawLower.includes("dashboard") || rawLower.includes("home") || rawLower.includes("today") || rawLower === "feed") {
    return {
      route: "/parent/dashboard",
      actionLabel: "Open Parent Dashboard",
      actionLabelHi: "अभिभावक डैशबोर्ड खोलें",
      category: "PARENT",
      confidenceScore: parsed.confidenceScore,
      entityChips: parsed.recognizedEntities,
    };
  }

  // Any teacher or admin intent resolves to null
  return null;
}
