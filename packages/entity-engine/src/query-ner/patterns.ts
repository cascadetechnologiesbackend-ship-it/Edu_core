export interface TokenDictionaryEntry {
  canonical: string;
  aliases: string[];
  category: string;
  metadata?: Record<string, any>;
}

export const SUBJECT_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "Mathematics",
    aliases: ["mathematics", "maths", "math", "ganit", "algebra", "geometry"],
    category: "ACADEMICS",
  },
  {
    canonical: "Physics",
    aliases: ["physics", "phy", "bhautiki"],
    category: "ACADEMICS",
  },
  {
    canonical: "Chemistry",
    aliases: ["chemistry", "chem", "rasayan"],
    category: "ACADEMICS",
  },
  {
    canonical: "Biology",
    aliases: ["biology", "bio", "jeev vigyan"],
    category: "ACADEMICS",
  },
  {
    canonical: "Science",
    aliases: ["science", "general science", "sci", "vigyan"],
    category: "ACADEMICS",
  },
  {
    canonical: "Social Science",
    aliases: ["social science", "social studies", "sst", "samajik vigyan"],
    category: "ACADEMICS",
  },
  {
    canonical: "History",
    aliases: ["history", "itihas"],
    category: "ACADEMICS",
  },
  {
    canonical: "Geography",
    aliases: ["geography", "bhugol", "geo"],
    category: "ACADEMICS",
  },
  {
    canonical: "English",
    aliases: ["english", "eng", "english literature", "english language", "angrezi"],
    category: "ACADEMICS",
  },
  {
    canonical: "Hindi",
    aliases: ["hindi", "hindi core", "hindi elective"],
    category: "ACADEMICS",
  },
  {
    canonical: "Sanskrit",
    aliases: ["sanskrit"],
    category: "ACADEMICS",
  },
  {
    canonical: "Computer Science",
    aliases: ["computer science", "computer", "cs", "informatics practices", "ip", "coding", "it", "information technology"],
    category: "ACADEMICS",
  },
  {
    canonical: "Economics",
    aliases: ["economics", "eco", "arthshastra"],
    category: "ACADEMICS",
  },
  {
    canonical: "Accountancy",
    aliases: ["accountancy", "accounts", "acc", "lekha"],
    category: "ACADEMICS",
  },
  {
    canonical: "Business Studies",
    aliases: ["business studies", "bst", "business"],
    category: "ACADEMICS",
  },
  {
    canonical: "Physical Education",
    aliases: ["physical education", "pe", "ped", "sports"],
    category: "ACADEMICS",
  },
];

export const EXAM_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "Unit Test 1",
    aliases: ["unit test 1", "unit test - 1", "ut1", "ut-1", "ut 1", "periodic test 1", "pt1", "pt 1", "pt-1"],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Unit Test 2",
    aliases: ["unit test 2", "unit test - 2", "ut2", "ut-2", "ut 2", "periodic test 2", "pt2", "pt 2", "pt-2"],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Term 1",
    aliases: ["term 1", "term-1", "term 01", "t1", "t-1", "first term"],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Term 2",
    aliases: ["term 2", "term-2", "term 02", "t2", "t-2", "second term"],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Half Yearly",
    aliases: ["half yearly", "half-yearly", "mid term", "midterm", "mid-term", "half yearly exam"],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Pre Board",
    aliases: ["pre board", "pre-board", "preboard", "pre board 1", "pre board 2", "mock exam"],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Annual Examination",
    aliases: ["annual exam", "annual examination", "annuals", "final exam", "finals", "year end exam"],
    category: "EXAMINATIONS",
  },
];

export const FEE_HEAD_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "Tuition Fee",
    aliases: ["tuition fee", "tuition", "tution", "tuition charges"],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Transport Fee",
    aliases: ["transport fee", "bus fee", "transport charges", "van fee", "conveyance fee"],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Admission Fee",
    aliases: ["admission fee", "registration fee", "admission charges"],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Annual Fee",
    aliases: ["annual fee", "annual charge", "development fee", "maintenance fee"],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Examination Fee",
    aliases: ["exam fee", "examination fee", "assessment fee"],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Lab / Computer Fee",
    aliases: ["lab fee", "computer fee", "science lab fee", "it fee"],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Caution Deposit",
    aliases: ["caution deposit", "security deposit"],
    category: "FEES_FINANCE",
  },
];

export const INTENT_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "ENTER_MARKS",
    aliases: [
      "enter marks", "marks entry", "add marks", "record marks", "fill marks",
      "enter scores", "score entry", "input marks", "marks submit"
    ],
    category: "EXAMINATIONS",
    metadata: {
      action: "ENTER_MARKS",
      route: "/exams/marks",
      label: "Open Marks Entry",
    },
  },
  {
    canonical: "VIEW_MARKS",
    aliases: [
      "view marks", "check marks", "show marks", "exam marks", "exam scores",
      "marks list", "result list", "exam results", "marks obtained"
    ],
    category: "EXAMINATIONS",
    metadata: {
      action: "VIEW_MARKS",
      route: "/exams/results",
      label: "View Examination Results",
    },
  },
  {
    canonical: "VIEW_REPORT_CARD",
    aliases: [
      "report card", "progress report", "generate report card", "print report card",
      "mark sheet", "marksheet", "grade card", "result card"
    ],
    category: "EXAMINATIONS",
    metadata: {
      action: "VIEW_REPORT_CARD",
      route: "/exams/report-cards",
      label: "Generate / View Report Cards",
    },
  },
  {
    canonical: "MANAGE_EXAM_SCHEDULE",
    aliases: [
      "exam schedule", "date sheet", "datesheet", "exam timetable", "exam routine",
      "schedule exam", "exam dates"
    ],
    category: "EXAMINATIONS",
    metadata: {
      action: "MANAGE_EXAM_SCHEDULE",
      route: "/exams/schedule",
      label: "Manage Exam Schedule & Timetable",
    },
  },
  {
    canonical: "TAKE_ATTENDANCE",
    aliases: [
      "take attendance", "mark attendance", "record attendance", "fill attendance",
      "daily attendance", "register attendance"
    ],
    category: "ATTENDANCE",
    metadata: {
      action: "TAKE_ATTENDANCE",
      route: "/attendance",
      label: "Mark Class Attendance",
    },
  },
  {
    canonical: "VIEW_ATTENDANCE",
    aliases: [
      "attendance", "view attendance", "check attendance", "attendance report",
      "absent list", "absentees", "present students", "attendance summary"
    ],
    category: "ATTENDANCE",
    metadata: {
      action: "VIEW_ATTENDANCE",
      route: "/attendance",
      label: "View Attendance Reports",
    },
  },
  {
    canonical: "COLLECT_FEE",
    aliases: [
      "collect fee", "pay fee", "accept payment", "receive fee",
      "fee collection", "make fee payment", "record payment"
    ],
    category: "FEES_FINANCE",
    metadata: {
      action: "COLLECT_FEE",
      route: "/fees/collect",
      label: "Collect / Record Fee Payment",
    },
  },
  {
    canonical: "VIEW_FEE_DUES",
    aliases: [
      "fee dues", "fee due", "dues", "pending fee", "defaulters", "unpaid fees",
      "fee status", "fee balance", "outstanding fee", "fee report"
    ],
    category: "FEES_FINANCE",
    metadata: {
      action: "VIEW_FEE_DUES",
      route: "/fees",
      label: "View Pending Fee Dues",
    },
  },
  {
    canonical: "TRACK_BUS",
    aliases: [
      "track bus", "bus location", "live bus", "where is bus", "where is", "track", "bus gps",
      "bus tracking", "vehicle location", "bus stop timing", "bus live"
    ],
    category: "TRANSPORT",
    metadata: {
      action: "TRACK_BUS",
      route: "/transport",
      label: "Open Live Transport GPS Tracking",
    },
  },
  {
    canonical: "VIEW_TIMETABLE",
    aliases: [
      "timetable", "time table", "class schedule", "teacher timetable",
      "period schedule", "routine", "bell schedule"
    ],
    category: "ACADEMICS",
    metadata: {
      action: "VIEW_TIMETABLE",
      route: "/academics",
      label: "View Timetable & Schedules",
    },
  },
  {
    canonical: "CREATE_NOTICE",
    aliases: [
      "create notice", "post notice", "broadcast notice", "publish circular",
      "send circular", "announcement", "send message", "send sms"
    ],
    category: "COMMUNICATION",
    metadata: {
      action: "CREATE_NOTICE",
      route: "/communication/notices",
      label: "Create Broadcast Notice",
    },
  },
  {
    canonical: "VIEW_STUDENT_PROFILE",
    aliases: [
      "student profile", "student details", "student 360", "find student",
      "student search", "student info"
    ],
    category: "STUDENTS_LIFECYCLE",
    metadata: {
      action: "VIEW_STUDENT_PROFILE",
      route: "/students",
      label: "Search & View Student 360 Profile",
    },
  },
  {
    canonical: "VIEW_STAFF_PROFILE",
    aliases: [
      "staff profile", "teacher profile", "faculty list", "teacher details",
      "staff salary", "payroll", "staff directory"
    ],
    category: "HR_STAFF",
    metadata: {
      action: "VIEW_STAFF_PROFILE",
      route: "/hr",
      label: "Staff Directory & HR Profiles",
    },
  },
];

// Regex for class and section matching
// Matches "Class 10-A", "Class 10 A", "Grade 5 B", "Std 12", "10-A", "10A", "Nursery-B", "LKG", "UKG"
export const CLASS_SECTION_REGEXES = [
  /\b(?:class|grade|std|standard)\s*([0-9]{1,2}|nursery|lkg|ukg|kg|prep)(?:[-\s]?([a-zA-Z]))?\b/i,
  /\b([0-9]{1,2})[-\s]?([a-zA-Z])\b/i,
  /\b(nursery|lkg|ukg|prep)(?:[-\s]?([a-zA-Z]))?\b/i,
];

// Regex for Bus / Route identification
// Matches "Bus 4", "Route 12", "Bus #3", "Route B"
export const BUS_ROUTE_REGEX = /\b(?:bus\s+route|route\s+bus|bus|route|van)\s*(?:no\.?|number|#)?\s*([0-9]{1,3}|[a-zA-Z0-9_-]+)\b/i;

// Regex for temporal date matching
export const DATE_TEMPORAL_REGEXES = [
  /\b(today|yesterday|tomorrow|this week|last week|this month|last month)\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:\d{4})?\b/i,
];
