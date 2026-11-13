import { PageTourDefinition, TourDeck } from "./types";
import {
  LayoutDashboard,
  CalendarCheck,
  Award,
  BookOpen,
  FileSpreadsheet,
  CheckSquare,
  Users,
  IndianRupee,
  Receipt,
  AlertCircle,
  Landmark,
  UserCheck,
  Clock,
  Banknote,
  ShieldCheck,
  Library,
  Bus,
  MapPin,
  User,
} from "lucide-react";

// ============================================================================
// 1. TEACHER TOURS
// ============================================================================
export const TEACHER_MODULE_ORDER = [
  "teacher-attendance",
  "teacher-homework",
  "teacher-grading",
  "teacher-classes",
  "teacher-home",
  "teacher-leaves",
];

export const TEACHER_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/teacher/attendance",
    moduleId: "teacher-attendance",
    moduleTitle: "Attendance Roster",
    steps: [
      {
        anchorId: "teacher-attendance-header",
        title: "Section & Date",
        line: "Confirm your active classroom period and attendance date.",
      },
      {
        anchorId: "teacher-attendance-roster",
        title: "Roll Call Matrix",
        line: "Fast touch attendance list with present, absent, and late toggles.",
      },
      {
        anchorId: "teacher-attendance-save-btn",
        title: "Save Roll Call",
        line: "Submit morning attendance in under 4 minutes with instant parent notices.",
        ctaLabel: "Save Attendance",
      },
    ],
  },
  {
    pagePath: "/teacher/homework",
    moduleId: "teacher-homework",
    moduleTitle: "Homework Center",
    steps: [
      {
        anchorId: "teacher-homework-post-btn",
        title: "Post Homework",
        line: "Create homework tasks with subject tags, descriptions, and submission deadlines.",
        ctaLabel: "New Homework",
      },
      {
        anchorId: "teacher-homework-list",
        title: "Active Homework",
        line: "View posted assignments and track submission rates per section.",
      },
      {
        anchorId: "teacher-homework-roster-btn",
        title: "Review Submissions",
        line: "Review student uploaded homework solutions and mark completion status.",
      },
    ],
  },
  {
    pagePath: "/teacher/grading",
    moduleId: "teacher-grading",
    moduleTitle: "Examinations & Grading",
    steps: [
      {
        anchorId: "teacher-grading-class-select",
        title: "Exam & Class",
        line: "Choose examination and subject to open student marks entry matrix.",
      },
      {
        anchorId: "teacher-grading-score-table",
        title: "Marks Entry Grid",
        line: "Enter theory and practical marks with automatic validation against max marks.",
      },
      {
        anchorId: "teacher-grading-lock-btn",
        title: "Lock Marks",
        line: "Lock marks to prevent tampering and send for report card compilation.",
      },
    ],
  },
  {
    pagePath: "/teacher/classes",
    moduleId: "teacher-classes",
    moduleTitle: "Assigned Classrooms",
    steps: [
      {
        anchorId: "teacher-classes-list",
        title: "Class Sections",
        line: "View all class sections where you are appointed as class or subject teacher.",
      },
      {
        anchorId: "teacher-classes-students",
        title: "Student Roster",
        line: "Access student roll numbers, attendance rates, and guardian phone numbers.",
      },
    ],
  },
  {
    pagePath: "/teacher/dashboard",
    moduleId: "teacher-home",
    moduleTitle: "Teacher Podium & Feed",
    steps: [
      {
        anchorId: "teacher-today-periods",
        title: "Teaching Schedule",
        line: "See your daily timetable periods, classroom locations, and substitutions.",
      },
      {
        anchorId: "teacher-quick-actions",
        title: "Rapid Period Actions",
        line: "Quick buttons for roll call and homework right from your podium view.",
      },
    ],
  },
  {
    pagePath: "/teacher/leaves",
    moduleId: "teacher-leaves",
    moduleTitle: "Leave Applications",
    steps: [
      {
        anchorId: "teacher-leave-balance",
        title: "Leave Balances",
        line: "View remaining casual, medical, and earned leave balances.",
      },
      {
        anchorId: "teacher-leave-apply-btn",
        title: "Apply for Leave",
        line: "Submit absence requests with dates, reason, and substitute teacher preferences.",
        ctaLabel: "Apply Leave",
      },
    ],
  },
];

// ============================================================================
// 2. PRINCIPAL TOURS
// ============================================================================
export const PRINCIPAL_MODULE_ORDER = [
  "principal-home",
  "principal-academics",
  "principal-attendance",
  "principal-exams",
  "principal-finance",
  "principal-school-setup",
];

export const PRINCIPAL_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/principal/dashboard",
    moduleId: "principal-home",
    moduleTitle: "Principal Command Center",
    steps: [
      {
        anchorId: "principal-kpi-summary",
        title: "Executive Telemetry",
        line: "Truthful overview of student attendance, teacher coverage, and fee pace.",
      },
      {
        anchorId: "principal-approvals-queue",
        title: "Approvals Queue",
        line: "Review marks lock requests, teacher leaves, and statutory exceptions.",
      },
    ],
  },
  {
    pagePath: "/academics",
    moduleId: "principal-academics",
    moduleTitle: "Academic Oversight",
    steps: [
      {
        anchorId: "principal-classes-overview",
        title: "Classes Overview",
        line: "Canonical class structure, student strength, and faculty allocations.",
      },
      {
        anchorId: "principal-timetable-link",
        title: "Master Timetable",
        line: "Audit school-wide period schedules and teacher workload distribution.",
      },
    ],
  },
  {
    pagePath: "/attendance",
    moduleId: "principal-attendance",
    moduleTitle: "Attendance Governance",
    steps: [
      {
        anchorId: "principal-attendance-metrics",
        title: "Attendance Benchmark",
        line: "Monitor school attendance against the 85% statutory board requirement.",
      },
    ],
  },
  {
    pagePath: "/exams/dashboard",
    moduleId: "principal-exams",
    moduleTitle: "Examination Oversight",
    steps: [
      {
        anchorId: "principal-exams-lifecycle",
        title: "Assessment Milestones",
        line: "Track timetable publishing, question paper setup, and report card releases.",
      },
    ],
  },
  {
    pagePath: "/school/fees-dashboard",
    moduleId: "principal-finance",
    moduleTitle: "Financial Realization",
    steps: [
      {
        anchorId: "principal-fee-collection-trend",
        title: "Fee Realization",
        line: "Monitor fee demand recovery rate and approved scholarship concessions.",
      },
    ],
  },
  {
    pagePath: "/settings/school-setup",
    moduleId: "principal-school-setup",
    moduleTitle: "Board Affiliation",
    steps: [
      {
        anchorId: "principal-affiliation-card",
        title: "Affiliation Profile",
        line: "Institutional affiliation number, board matrix, and school metadata.",
      },
    ],
  },
];

// ============================================================================
// 3. ACCOUNTANT TOURS
// ============================================================================
export const ACCOUNTANT_MODULE_ORDER = [
  "accountant-collect",
  "accountant-defaulters",
  "accountant-home",
  "accountant-concessions",
  "accountant-bank-recon",
];

export const ACCOUNTANT_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/school/collect-fees",
    moduleId: "accountant-collect",
    moduleTitle: "Counter Fee Collection",
    steps: [
      {
        anchorId: "accountant-student-search",
        title: "Student Lookup",
        line: "Rapidly find student by admission number or name to pull pending dues.",
      },
      {
        anchorId: "accountant-payment-modes",
        title: "Payment Modes",
        line: "Choose collection channel and enter cheque/reference transaction ID.",
      },
      {
        anchorId: "accountant-record-btn",
        title: "Post & Print Receipt",
        line: "Post collection atomically and print GST/statutory thermal fee receipt.",
        ctaLabel: "Collect & Print",
      },
    ],
  },
  {
    pagePath: "/school/due-fees",
    moduleId: "accountant-defaulters",
    moduleTitle: "Fee Dues & Recovery",
    steps: [
      {
        anchorId: "accountant-defaulter-filters",
        title: "Arrears Aging",
        line: "Filter overdue student balances by class, month, and amount threshold.",
      },
      {
        anchorId: "accountant-reminder-btn",
        title: "Payment Reminders",
        line: "Send automated SMS payment reminders with direct online payment link.",
      },
    ],
  },
  {
    pagePath: "/school/fees-dashboard",
    moduleId: "accountant-home",
    moduleTitle: "Fees Command Center",
    steps: [
      {
        anchorId: "accountant-today-collection",
        title: "Daily Cash Drawer",
        line: "Real-time counter cash reconciled against payment gateway bank deposits.",
      },
      {
        anchorId: "accountant-spokes-tabs",
        title: "Accounting Spokes",
        line: "Jump directly to Fee Heads, Structure Mapping, Refunds, and Audit Logs.",
      },
    ],
  },
  {
    pagePath: "/school/accounting/reports/concessions",
    moduleId: "accountant-concessions",
    moduleTitle: "Concession Register",
    steps: [
      {
        anchorId: "accountant-concession-table",
        title: "Concession Register",
        line: "Audit sibling discounts, merit scholarships, and RTE 25% waiver ledger.",
      },
    ],
  },
  {
    pagePath: "/school/accounts/bank-reconciliation",
    moduleId: "accountant-bank-recon",
    moduleTitle: "Bank Reconciliation",
    steps: [
      {
        anchorId: "accountant-bank-selector",
        title: "Bank Account Picker",
        line: "Select active school bank account for statement clearance matching.",
      },
      {
        anchorId: "accountant-recon-table",
        title: "Reconciliation Table",
        line: "Reconcile counter collection cash batches with official bank slips.",
      },
    ],
  },
];

// ============================================================================
// 4. HR MANAGER TOURS
// ============================================================================
export const HR_MANAGER_MODULE_ORDER = [
  "hr-overview",
  "hr-staff-directory",
  "hr-leave-approvals",
  "hr-payroll-runs",
];

export const HR_MANAGER_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/hr",
    moduleId: "hr-overview",
    moduleTitle: "HR Overview & Census",
    steps: [
      {
        anchorId: "hr-stats-grid",
        title: "Operations KPI Grid",
        line: "Active faculty headcount, department distribution, and staff attendance.",
      },
      {
        anchorId: "hr-staff-table",
        title: "Staff Directory",
        line: "Faculty database with qualifications, designations, and biometric codes.",
      },
      {
        anchorId: "hr-leave-requests-list",
        title: "Leave Applications",
        line: "Review teacher leave applications with one-click approve/reject actions.",
      },
      {
        anchorId: "hr-payroll-month-select",
        title: "Monthly Payroll",
        line: "Generate monthly salary slips, statutory PF/ESI deductions, and bank lists.",
      },
    ],
  },
];

// ============================================================================
// 5. LIBRARIAN TOURS
// ============================================================================
export const LIBRARIAN_MODULE_ORDER = [
  "librarian-home",
  "librarian-catalog",
];

export const LIBRARIAN_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/librarian/dashboard",
    moduleId: "librarian-home",
    moduleTitle: "Librarian Command Desk",
    steps: [
      {
        anchorId: "librarian-metrics-row",
        title: "Circulation Metrics",
        line: "Live total book copies, active loans, and overdue fines summary.",
      },
      {
        anchorId: "librarian-catalog-btn",
        title: "Master Inventory",
        line: "Fast shortcut to access the master inventory catalog and issue desk.",
      },
    ],
  },
  {
    pagePath: "/library",
    moduleId: "librarian-catalog",
    moduleTitle: "Library Circulation Desk",
    steps: [
      {
        anchorId: "librarian-catalog-search",
        title: "Catalog Search",
        line: "Search books by title, ISBN, subject, or rack shelf location.",
      },
      {
        anchorId: "librarian-issue-btn",
        title: "Issue & Return",
        line: "Check-out book copies to students and teachers with automatic due dates.",
      },
    ],
  },
];

// ============================================================================
// 6. TRANSPORT MANAGER TOURS
// ============================================================================
export const TRANSPORT_MANAGER_MODULE_ORDER = [
  "transport-home",
  "transport-fleet",
];

export const TRANSPORT_MANAGER_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/transport/dashboard",
    moduleId: "transport-home",
    moduleTitle: "Fleet Operations Command",
    steps: [
      {
        anchorId: "transport-manager-kpi",
        title: "Fleet Health",
        line: "Active buses on route, GPS signal health, and student pass allocations.",
      },
      {
        anchorId: "transport-manager-fleet-btn",
        title: "Fleet Manager",
        line: "Jump straight to fleet vehicle registrations and transit route setup.",
      },
    ],
  },
  {
    pagePath: "/transport",
    moduleId: "transport-fleet",
    moduleTitle: "Transit Routes & Live Tracking",
    steps: [
      {
        anchorId: "transport-routes-list",
        title: "Transit Routes",
        line: "View bus routes with ordered stop sequences and assigned drivers.",
      },
      {
        anchorId: "transport-live-tracking",
        title: "Live GPS Map",
        line: "Live tracking map showing real-time GPS pings from driver apps.",
      },
    ],
  },
];

// ============================================================================
// 7. DRIVER TOURS
// ============================================================================
export const DRIVER_MODULE_ORDER = [
  "driver-home",
  "driver-profile",
];

export const DRIVER_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/driver/dashboard",
    moduleId: "driver-home",
    moduleTitle: "Driver Cockpit",
    steps: [
      {
        anchorId: "driver-trip-toggle",
        title: "Trip Broadcast",
        line: "Tap to start or end trip and broadcast live bus GPS coordinates to parents.",
      },
      {
        anchorId: "driver-live-map",
        title: "Mini Route Map",
        line: "High-contrast route map showing your live bus location and vehicle speed.",
      },
      {
        anchorId: "driver-stops-checklist",
        title: "Stops Checklist",
        line: "Clear bus stops sequentially as students embark or disembark.",
      },
    ],
  },
  {
    pagePath: "/driver/profile",
    moduleId: "driver-profile",
    moduleTitle: "Driver Licence & Bus",
    steps: [
      {
        anchorId: "driver-licence-card",
        title: "Licence & Bus Details",
        line: "View your verified commercial driving licence and allocated transit bus.",
      },
    ],
  },
];

// ============================================================================
// HELPER FOR STAFF ROLES
// ============================================================================
export function getStaffToursForRole(role: string): {
  tours: PageTourDefinition[];
  allModuleIds: string[];
} {
  switch (role) {
    case "TEACHER":
      return { tours: TEACHER_PAGE_TOURS, allModuleIds: TEACHER_MODULE_ORDER };
    case "PRINCIPAL":
      return { tours: PRINCIPAL_PAGE_TOURS, allModuleIds: PRINCIPAL_MODULE_ORDER };
    case "ACCOUNTANT":
      return { tours: ACCOUNTANT_PAGE_TOURS, allModuleIds: ACCOUNTANT_MODULE_ORDER };
    case "HR_MANAGER":
      return { tours: HR_MANAGER_PAGE_TOURS, allModuleIds: HR_MANAGER_MODULE_ORDER };
    case "LIBRARIAN":
      return { tours: LIBRARIAN_PAGE_TOURS, allModuleIds: LIBRARIAN_MODULE_ORDER };
    case "TRANSPORT_MANAGER":
      return { tours: TRANSPORT_MANAGER_PAGE_TOURS, allModuleIds: TRANSPORT_MANAGER_MODULE_ORDER };
    case "DRIVER":
      return { tours: DRIVER_PAGE_TOURS, allModuleIds: DRIVER_MODULE_ORDER };
    default:
      return { tours: [], allModuleIds: [] };
  }
}
export const TEACHER_DECK: TourDeck = {
  role: "TEACHER",
  roleDisplayName: "Educator / Teacher",
  completionTitle: "Teacher Workspace Tour Complete!",
  completionMessage: "You are ready to mark attendance, post homework, track syllabus, and record exam grades.",
  modules: [
    {
      id: "teacher-home",
      tag: "Daily Routine",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Teacher Command Hub",
      summary: "Your daily home screen showing today's teaching schedule, active notices, and pending tasks.",
      whatItIs: "A zero-clutter teacher dashboard with one-tap access to your assigned class sections.",
      whyItMatters: "Eliminates confusion about which class or period comes next.",
      ctaHref: "/teacher/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "teacher-day",
          title: "Today's Schedule & Quick Actions",
          summary: "View today's timetable periods, timetable swaps, and pending class duties.",
          ctaHref: "/teacher/dashboard",
        },
      ],
    },
    {
      id: "teacher-attendance",
      tag: "Roll Call",
      tagColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      title: "Classroom Attendance",
      summary: "Take daily morning attendance in under 4 minutes with instant absentee alerts to parents.",
      whatItIs: "An intuitive touch-friendly student roster optimized for quick present/absent toggling.",
      whyItMatters: "Keeps children safe and eliminates manual attendance paperwork.",
      ctaHref: "/teacher/attendance",
      icon: CalendarCheck,
      iconColor: "text-rose-400",
      bgGradient: "from-rose-600/20 via-red-600/10 to-transparent",
      subModules: [
        {
          id: "teacher-rollcall",
          title: "Section Roll Call Matrix",
          summary: "Mark student status, add absent remarks, and submit morning roll call.",
          ctaHref: "/teacher/attendance",
        },
      ],
    },
    {
      id: "teacher-grading",
      tag: "Evaluation",
      tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      title: "Gradebook & Marks Entry",
      summary: "Record examination scores, unit tests, and term co-scholastic remarks directly.",
      whatItIs: "Your official marks entry surface with automated validation against maximum subject marks.",
      whyItMatters: "Generates error-free CBSE and State Board grade conversions automatically.",
      ctaHref: "/teacher/grading",
      icon: FileSpreadsheet,
      iconColor: "text-amber-400",
      bgGradient: "from-amber-600/20 via-orange-600/10 to-transparent",
      subModules: [
        {
          id: "teacher-marks-sheet",
          title: "Subject Score Matrix",
          summary: "Enter theory and practical assessment scores with auto-calculating totals.",
          ctaHref: "/teacher/grading",
        },
      ],
    },
    {
      id: "teacher-classes",
      tag: "Classroom",
      tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      title: "My Assigned Classes",
      summary: "View student lists, parent contact links, and academic performance for your classes.",
      whatItIs: "Roster management for class teachers and subject instructors.",
      whyItMatters: "Provides quick access to student learning needs and contact details without office visits.",
      ctaHref: "/teacher/classes",
      icon: BookOpen,
      iconColor: "text-purple-400",
      bgGradient: "from-purple-600/20 via-violet-600/10 to-transparent",
      subModules: [
        {
          id: "teacher-roster",
          title: "Class Student Roster",
          summary: "Inspect student roll numbers, attendance percentages, and parent links.",
          ctaHref: "/teacher/classes",
        },
      ],
    },
    {
      id: "teacher-homework",
      tag: "Assignments",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      title: "Homework & Assignments",
      summary: "Post homework with due dates and instructions directly to the student and parent apps.",
      whatItIs: "Homework posting center with subject tagging and submission tracking.",
      whyItMatters: "Ensures students and parents know today's homework assignments without diary notes.",
      ctaHref: "/teacher/homework",
      icon: CheckSquare,
      iconColor: "text-emerald-400",
      bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
      subModules: [
        {
          id: "teacher-post-hw",
          title: "Create & Track Homework",
          summary: "Attach descriptions and target submission dates for each section.",
          ctaHref: "/teacher/homework",
        },
      ],
    },
    {
      id: "teacher-syllabus",
      tag: "Curriculum",
      tagColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      title: "Syllabus Coverage Tracker",
      summary: "Track completed curriculum chapters, scheduled lessons, and upcoming topics.",
      whatItIs: "A term-wise progress bar tracking covered chapters against the academic calendar.",
      whyItMatters: "Keeps teaching on schedule before term exam revision windows.",
      ctaHref: "/teacher/syllabus",
      icon: Award,
      iconColor: "text-cyan-400",
      bgGradient: "from-cyan-600/20 via-sky-600/10 to-transparent",
      subModules: [
        {
          id: "teacher-chapter-tracker",
          title: "Chapter Completion Tracker",
          summary: "Mark completed units and log revision notes for your subjects.",
          ctaHref: "/teacher/syllabus",
        },
      ],
    },
  ],
};

export const PRINCIPAL_DECK: TourDeck = {
  role: "PRINCIPAL",
  roleDisplayName: "School Principal",
  completionTitle: "Principal Oversight Tour Complete!",
  completionMessage: "Academic oversight, examination approvals, faculty appraisals, and fee dues tracking are accessible from your home surface.",
  modules: [
    {
      id: "principal-oversight",
      tag: "Oversight",
      tagColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      title: "Academic & Operational Command",
      summary: "Executive readout of today's attendance, staff on duty, and critical school indicators.",
      whatItIs: "Your morning overview surface consolidating academic health across all sections.",
      whyItMatters: "Allows proactive decisions without walking corridors or sifting through paper reports.",
      ctaHref: "/principal/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-indigo-400",
      bgGradient: "from-indigo-600/20 via-blue-600/10 to-transparent",
      subModules: [
        {
          id: "principal-summary",
          title: "School Health Indicators",
          summary: "Review daily student attendance ratios, teacher attendance, and active alerts.",
          ctaHref: "/principal/dashboard",
        },
      ],
    },
    {
      id: "principal-academics",
      tag: "Curriculum",
      tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      title: "Curriculum & Timetable Oversight",
      summary: "Audit grade level offerings, class teacher allocations, and period schedules.",
      whatItIs: "Structural oversight of class wings, subject periods, and curriculum conformity.",
      whyItMatters: "Guarantees full board syllabus coverage and prevents teacher scheduling clashes.",
      ctaHref: "/academics",
      icon: BookOpen,
      iconColor: "text-purple-400",
      bgGradient: "from-purple-600/20 via-violet-600/10 to-transparent",
      subModules: [
        {
          id: "principal-classes",
          title: "Grade Offerings & Sections",
          summary: "Audit class sizes, section allocations, and assigned faculty members.",
          ctaHref: "/academics",
        },
      ],
    },
    {
      id: "principal-attendance",
      tag: "Attendance",
      tagColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      title: "School-Wide Attendance Insights",
      summary: "Monitor morning roll-call completion across sections and flag chronic absentees.",
      whatItIs: "Holistic student and staff attendance monitoring with trend analytics.",
      whyItMatters: "Ensures compliance with board attendance thresholds for board exam eligibility.",
      ctaHref: "/attendance",
      icon: CalendarCheck,
      iconColor: "text-rose-400",
      bgGradient: "from-rose-600/20 via-red-600/10 to-transparent",
      subModules: [
        {
          id: "principal-att-trends",
          title: "Class Attendance Trends",
          summary: "Inspect low-attendance sections and trigger parent communication follow-ups.",
          ctaHref: "/attendance",
        },
      ],
    },
    {
      id: "principal-exams",
      tag: "Examinations",
      tagColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      title: "Examination Moderation & Approvals",
      summary: "Review assessment results, approve report card publication, and analyze grade distributions.",
      whatItIs: "Examination moderation center ensuring result accuracy before publication to parents.",
      whyItMatters: "Maintains academic integrity and guarantees error-free report cards.",
      ctaHref: "/exams",
      icon: Award,
      iconColor: "text-yellow-400",
      bgGradient: "from-yellow-600/20 via-amber-600/10 to-transparent",
      subModules: [
        {
          id: "principal-exam-results",
          title: "Result Moderation Hub",
          summary: "Approve class score sheets and release verified results to parents.",
          ctaHref: "/exams",
        },
      ],
    },
    {
      id: "principal-staff",
      tag: "Faculty",
      tagColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      title: "Faculty & Staff Evaluations",
      summary: "Review teaching allocations, workload distribution, and teacher profile records.",
      whatItIs: "Staff oversight surface for monitoring department workloads and professional records.",
      whyItMatters: "Ensures balanced teaching allocations and prompt staffing decisions.",
      ctaHref: "/hr",
      icon: UserCheck,
      iconColor: "text-cyan-400",
      bgGradient: "from-cyan-600/20 via-sky-600/10 to-transparent",
      subModules: [
        {
          id: "principal-staff-roster",
          title: "Faculty Profiles & Allocations",
          summary: "Review teacher qualifications, subject competencies, and assigned periods.",
          ctaHref: "/hr",
        },
      ],
    },
    {
      id: "principal-finance",
      tag: "Finance",
      tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      title: "Fee Dues & Concession Oversight",
      summary: "Read-only oversight of outstanding term dues and fee concession reports.",
      whatItIs: "Executive finance monitor tracking collection progress against term targets.",
      whyItMatters: "Provides high-level visibility to close fee cycles on time without bookkeeping burdens.",
      ctaHref: "/school/due-fees",
      icon: IndianRupee,
      iconColor: "text-amber-400",
      bgGradient: "from-amber-600/20 via-orange-600/10 to-transparent",
      subModules: [
        {
          id: "principal-dues-report",
          title: "Outstanding Dues Register",
          summary: "View total pending collections grouped by class and section.",
          ctaHref: "/school/due-fees",
        },
        {
          id: "principal-concessions",
          title: "Fee Concession Summary",
          summary: "Audit authorized fee waivers, sibling discounts, and scholarships.",
          ctaHref: "/school/accounting/reports/concessions",
        },
      ],
    },
  ],
};

export const ACCOUNTANT_DECK: TourDeck = {
  role: "ACCOUNTANT",
  roleDisplayName: "School Accountant",
  completionTitle: "Accountant Fee Tour Complete!",
  completionMessage: "Fee counter collection, dues work list, day book, and bank reconciliation are accessible.",
  modules: [
    {
      id: "accountant-hub",
      tag: "Collections",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Finance & Fee Command Hub",
      summary: "Daily collection totals, cash-in-hand counter figures, and monthly collection targets.",
      whatItIs: "The central finance dashboard tracking today's real collections versus demand.",
      whyItMatters: "Keeps financial operations on track to close the monthly fee cycle on time.",
      ctaHref: "/school/fees-dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "acct-overview",
          title: "Daily Collection Progress",
          summary: "Review cash, cheque, and UPI collections against today's target.",
          ctaHref: "/school/fees-dashboard",
        },
      ],
    },
    {
      id: "accountant-collect",
      tag: "Counter",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      title: "Counter Fee Collection",
      summary: "Fast student lookup, installment allocation, and instant receipt generation.",
      whatItIs: "Your primary daily interface for accepting cash, POS cards, cheques, and online fees.",
      whyItMatters: "Processes parent walk-ins in under 60 seconds with zero calculation errors.",
      ctaHref: "/school/collect-fees",
      icon: IndianRupee,
      iconColor: "text-emerald-400",
      bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
      subModules: [
        {
          id: "acct-cash-counter",
          title: "Collect & Print Receipt",
          summary: "Search by admission number or name and issue printed receipts.",
          ctaHref: "/school/collect-fees",
        },
      ],
    },
    {
      id: "accountant-dues",
      tag: "Dues Work List",
      tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      title: "Dues & Defaulters Work List",
      summary: "Section-wise aging analysis, outstanding demand slips, and parent reminders.",
      whatItIs: "Actionable dues register showing exactly who owes fees and for which head.",
      whyItMatters: "Prevents fee arrears from accumulating past quarterly deadlines.",
      ctaHref: "/school/due-fees",
      icon: AlertCircle,
      iconColor: "text-amber-400",
      bgGradient: "from-amber-600/20 via-orange-600/10 to-transparent",
      subModules: [
        {
          id: "acct-dues-aging",
          title: "Section Arrears Work List",
          summary: "Filter pending fee heads and generate student demand notices.",
          ctaHref: "/school/due-fees",
        },
      ],
    },
    {
      id: "accountant-daybook",
      tag: "Transactions",
      tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      title: "Day Book & Transaction Log",
      summary: "Sequenced audit trail of all receipts, voids, and counter collections.",
      whatItIs: "The immutable transaction journal showing all debits, credits, and payment modes.",
      whyItMatters: "Reconciles the cashier drawer with 100% accuracy every day at 3 PM.",
      ctaHref: "/school/transactions",
      icon: Receipt,
      iconColor: "text-purple-400",
      bgGradient: "from-purple-600/20 via-violet-600/10 to-transparent",
      subModules: [
        {
          id: "acct-daybook-journal",
          title: "Daily Collection Journal",
          summary: "Export daily collection summaries categorized by payment mode.",
          ctaHref: "/school/transactions",
        },
      ],
    },
    {
      id: "accountant-reconcile",
      tag: "Accounting",
      tagColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      title: "Bank Reconciliation & Matrix",
      summary: "Match bank deposits against fee collections and manage fee structure pricing.",
      whatItIs: "BRS clearance surface and class fee matrix management.",
      whyItMatters: "Ensures bank statement deposits match internal accounting ledger balances.",
      ctaHref: "/school/accounts/bank-reconciliation",
      icon: Landmark,
      iconColor: "text-cyan-400",
      bgGradient: "from-cyan-600/20 via-sky-600/10 to-transparent",
      subModules: [
        {
          id: "acct-brs-reconcile",
          title: "Bank Statement Match (BRS)",
          summary: "Match cleared counter cheques and online gateway settlements.",
          ctaHref: "/school/accounts/bank-reconciliation",
        },
        {
          id: "acct-pricing-matrix",
          title: "Fee Structure Pricing",
          summary: "Review quarterly installment slabs and late fee rules.",
          ctaHref: "/school/fee-structures",
        },
      ],
    },
  ],
};

export const HR_MANAGER_DECK: TourDeck = {
  role: "HR_MANAGER",
  roleDisplayName: "HR & Payroll Manager",
  completionTitle: "HR Management Tour Complete!",
  completionMessage: "Staff directory, biometric attendance, EPFO/ESIC payroll, and DPDP compliance are set up.",
  modules: [
    {
      id: "hr-dash",
      tag: "Overview",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Workforce Command Center",
      summary: "Staff headcounts, active leave requests, and upcoming payroll processing deadlines.",
      whatItIs: "The operational dashboard summarizing teaching and administrative staff capacity.",
      whyItMatters: "Ensures uninterrupted school operations through proactive staffing oversight.",
      ctaHref: "/hr/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "hr-headcount",
          title: "Staffing Capacity & Metrics",
          summary: "View active faculty, open positions, and daily staff attendance.",
          ctaHref: "/hr/dashboard",
        },
      ],
    },
    {
      id: "hr-staff",
      tag: "Faculty",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      title: "Staff Directory & KYC",
      summary: "Maintain staff qualification credentials, service records, and Aadhaar/PAN compliance.",
      whatItIs: "The authoritative staff register holding verified faculty details and documents.",
      whyItMatters: "Ensures compliance with education board affiliation and teacher qualification norms.",
      ctaHref: "/hr",
      icon: Users,
      iconColor: "text-emerald-400",
      bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
      subModules: [
        {
          id: "hr-profiles",
          title: "Faculty Profiles & KYC",
          summary: "Manage employment contracts, designations, and bank account details.",
          ctaHref: "/hr",
        },
      ],
    },
    {
      id: "hr-attendance",
      tag: "Time & Attendance",
      tagColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      title: "Staff Attendance & Leaves",
      summary: "Monitor biometric punch logs, casual/medical leave approvals, and daily presence.",
      whatItIs: "Attendance tracking engine calculating payable days for the monthly payroll run.",
      whyItMatters: "Automates leave balance tracking and prevents payroll calculation disputes.",
      ctaHref: "/attendance",
      icon: Clock,
      iconColor: "text-rose-400",
      bgGradient: "from-rose-600/20 via-red-600/10 to-transparent",
      subModules: [
        {
          id: "hr-biometric-log",
          title: "Biometric Logs & Leave Approvals",
          summary: "Approve teacher leave applications and verify biometric sync status.",
          ctaHref: "/attendance",
        },
      ],
    },
    {
      id: "hr-payroll",
      tag: "Payroll",
      tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      title: "Payroll & Statutory Remittance",
      summary: "Process monthly salaries with automated EPFO, ESIC, and Professional Tax calculations.",
      whatItIs: "Salary engine generating statutory ECR text files and employee pay slips.",
      whyItMatters: "Ensures legal statutory compliance without manual salary spreadsheet errors.",
      ctaHref: "/hr/payroll",
      icon: Banknote,
      iconColor: "text-amber-400",
      bgGradient: "from-amber-600/20 via-orange-600/10 to-transparent",
      subModules: [
        {
          id: "hr-salary-run",
          title: "Salary Register & ECR Export",
          summary: "Run monthly payroll and export EPFO ECR submission files.",
          ctaHref: "/hr/payroll",
        },
      ],
    },
  ],
};

export const LIBRARIAN_DECK: TourDeck = {
  role: "LIBRARIAN",
  roleDisplayName: "Librarian",
  completionTitle: "Library Tour Complete!",
  completionMessage: "Book inventory catalog and circulation tracking are ready for daily operation.",
  modules: [
    {
      id: "lib-dashboard",
      tag: "Overview",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Library Operations Center",
      summary: "Active book loans, overdue returns, and library capacity indicators.",
      whatItIs: "The library command center for monitoring daily borrowing activity.",
      whyItMatters: "Tracks borrowing activity and flags unreturned books before term exams.",
      ctaHref: "/librarian/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "lib-overview",
          title: "Circulation Statistics",
          summary: "Review active book checkouts, overdue titles, and student borrowings.",
          ctaHref: "/librarian/dashboard",
        },
      ],
    },
    {
      id: "lib-catalog",
      tag: "Circulation",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      title: "Book Catalog & Circulation",
      summary: "Scan book accessions, issue titles to students or staff, and accept returned volumes.",
      whatItIs: "Your primary desk interface for barcode lookup, checkout, and fine calculation.",
      whyItMatters: "Maintains book inventory and prevents loss of library volumes.",
      ctaHref: "/library",
      icon: Library,
      iconColor: "text-emerald-400",
      bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
      subModules: [
        {
          id: "lib-accession-desk",
          title: "Accession & Circulation Desk",
          summary: "Search book titles by ISBN or title and issue volumes to student library cards.",
          ctaHref: "/library",
        },
      ],
    },
  ],
};

export const TRANSPORT_MANAGER_DECK: TourDeck = {
  role: "TRANSPORT_MANAGER",
  roleDisplayName: "Transport Operations Manager",
  completionTitle: "Transport Fleet Tour Complete!",
  completionMessage: "Bus routes, stops, vehicle allocations, and driver assignments are configured.",
  modules: [
    {
      id: "trans-dash",
      tag: "Fleet",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Fleet Operations Command",
      summary: "Monitor active bus routes, vehicle maintenance status, and pupil pickup stats.",
      whatItIs: "Central transport dashboard supervising student commute safety.",
      whyItMatters: "Ensures on-time arrivals and immediate action during mechanical delays.",
      ctaHref: "/transport/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "trans-fleet-summary",
          title: "Route Operations Status",
          summary: "Monitor bus run completions, assigned drivers, and active vehicle fitness.",
          ctaHref: "/transport/dashboard",
        },
      ],
    },
    {
      id: "trans-routes",
      tag: "Routes",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      title: "Bus Routes & Stop Allocation",
      summary: "Configure morning and afternoon routes, geographic stops, and student passenger lists.",
      whatItIs: "Route mapping interface linking student transport subscriptions to bus stops.",
      whyItMatters: "Prevents bus overloading and ensures student pickup stops are planned efficiently.",
      ctaHref: "/transport",
      icon: Bus,
      iconColor: "text-emerald-400",
      bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
      subModules: [
        {
          id: "trans-stop-matrix",
          title: "Route & Stop Setup",
          summary: "Define stop pickup times, vehicle allocations, and pass holder rosters.",
          ctaHref: "/transport",
        },
      ],
    },
  ],
};

export const DRIVER_DECK: TourDeck = {
  role: "DRIVER",
  roleDisplayName: "School Bus Driver",
  completionTitle: "Driver App Tour Complete!",
  completionMessage: "Your assigned bus route, stop sequence, and driver profile are ready for duty.",
  modules: [
    {
      id: "driver-trip",
      tag: "Navigation",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Route & Trip Navigation",
      summary: "View your stop-by-stop route sequence, scheduled pickup times, and pupil manifest.",
      whatItIs: "Your active driving interface displaying student pickup stops and arrival confirmations.",
      whyItMatters: "Ensures zero missed student pickups along your designated bus route.",
      ctaHref: "/driver/dashboard",
      icon: MapPin,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "driver-active-trip",
          title: "Active Trip & Stop Sequence",
          summary: "Follow the scheduled stop list and confirm student boardings.",
          ctaHref: "/driver/dashboard",
        },
      ],
    },
    {
      id: "driver-profile",
      tag: "Profile",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      title: "Driver Profile & Vehicle",
      summary: "View your assigned school bus registration number and driving license credentials.",
      whatItIs: "Driver credentials and emergency contact details on file with the school.",
      whyItMatters: "Maintains up-to-date compliance records for school bus safety inspections.",
      ctaHref: "/driver/profile",
      icon: User,
      iconColor: "text-emerald-400",
      bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
      subModules: [
        {
          id: "driver-license-info",
          title: "License & Vehicle Assignment",
          summary: "Inspect assigned bus number and contact details.",
          ctaHref: "/driver/profile",
        },
      ],
    },
  ],
};

