export interface TokenDictionaryEntry {
  canonical: string;
  aliases: string[];
  category: string;
  metadata?: Record<string, any>;
}

/**
 * Converts Devanagari numerals (०, १, २, ३, ४, ५, ६, ७, ८, ९) to standard ASCII digits (0-9).
 */
export function foldDevanagariNumerals(str: string): string {
  return (str || "").replace(/[\u0966-\u096F]/g, (d) =>
    String(d.charCodeAt(0) - 0x0966)
  );
}

/**
 * Section normalization dictionary mapping Devanagari and English section indicators.
 */
export const SECTION_NORMALIZATION: Record<string, string> = {
  // English
  a: "A", b: "B", c: "C", d: "D", e: "E", f: "F",
  // Hindi Phonetic & Alphabetic Letters
  "अ": "A", "ए": "A", "क": "A",
  "ब": "B", "बी": "B", "ख": "B",
  "स": "C", "सी": "C", "ग": "C",
  "द": "D", "डी": "D", "घ": "D",
  "इ": "E", "ई": "E",
  "एफ": "F",
};

export function normalizeSection(rawSection?: string): string | undefined {
  if (!rawSection) return undefined;
  const s = rawSection.trim().toLowerCase();
  const direct = SECTION_NORMALIZATION[s] || SECTION_NORMALIZATION[rawSection.trim()];
  if (direct) return direct;
  if (/^[a-zA-Z]$/.test(s)) return s.toUpperCase();
  return rawSection.trim();
}

export function normalizeClass(rawClass: string): string {
  const c = rawClass.trim().toLowerCase();
  if (c === "नर्सरी" || c === "nursery") return "NURSERY";
  if (c === "एलकेजी" || c === "lkg") return "LKG";
  if (c === "यूकेजी" || c === "ukg") return "UKG";
  if (c === "केजी" || c === "kg") return "KG";
  if (c === "प्रेप" || c === "prep") return "PREP";
  return rawClass.trim().toUpperCase();
}

export const SUBJECT_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "Mathematics",
    aliases: [
      "mathematics", "maths", "math", "ganit", "algebra", "geometry",
      "गणित", "मैथ्स", "अंकगणित", "बीजगणित", "रेखागणित"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Physics",
    aliases: [
      "physics", "phy", "bhautiki", "bhautik vigyan",
      "भौतिकी", "भौतिक विज्ञान"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Chemistry",
    aliases: [
      "chemistry", "chem", "rasayan", "rasayan vigyan",
      "रसायन", "रसायन विज्ञान", "रसायन शास्त्र"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Biology",
    aliases: [
      "biology", "bio", "jeev vigyan",
      "जीव विज्ञान", "जीवविज्ञान"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Science",
    aliases: [
      "science", "general science", "sci", "vigyan", "samanya vigyan",
      "विज्ञान", "सामान्य विज्ञान"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Social Science",
    aliases: [
      "social science", "social studies", "sst", "samajik vigyan", "samajik adhyayan",
      "सामाजिक विज्ञान", "सामाजिक अध्ययन"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "History",
    aliases: [
      "history", "itihas",
      "इतिहास"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Geography",
    aliases: [
      "geography", "bhugol", "geo",
      "भूगोल"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "English",
    aliases: [
      "english", "eng", "english literature", "english language", "angrezi",
      "अंग्रेज़ी", "अंग्रेजी", "इंग्लिश"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Hindi",
    aliases: [
      "hindi", "hindi core", "hindi elective",
      "हिंदी", "हिन्दी"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Sanskrit",
    aliases: [
      "sanskrit",
      "संस्कृत"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Computer Science",
    aliases: [
      "computer science", "computer", "cs", "informatics practices", "ip", "coding", "it", "information technology",
      "कंप्यूटर", "संगणक", "आईटी"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Economics",
    aliases: [
      "economics", "eco", "arthshastra", "arthashastra",
      "अर्थशास्त्र"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Accountancy",
    aliases: [
      "accountancy", "accounts", "acc", "lekha", "lekhashastra",
      "लेखाशास्त्र", "खाताबही"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Business Studies",
    aliases: [
      "business studies", "bst", "business",
      "व्यवसाय अध्ययन", "बिजनेस स्टडीज"
    ],
    category: "ACADEMICS",
  },
  {
    canonical: "Physical Education",
    aliases: [
      "physical education", "pe", "ped", "sports", "sharirik shiksha",
      "शारीरिक शिक्षा", "खेलकूद", "पीई"
    ],
    category: "ACADEMICS",
  },
];

export const EXAM_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "Unit Test 1",
    aliases: [
      "unit test 1", "unit test - 1", "ut1", "ut-1", "ut 1", "periodic test 1", "pt1", "pt 1", "pt-1",
      "इकाई परीक्षा 1", "इकाई परीक्षा १", "प्रथम इकाई परीक्षा", "यूटी 1"
    ],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Unit Test 2",
    aliases: [
      "unit test 2", "unit test - 2", "ut2", "ut-2", "ut 2", "periodic test 2", "pt2", "pt 2", "pt-2",
      "इकाई परीक्षा 2", "इकाई परीक्षा २", "द्वितीय इकाई परीक्षा", "यूटी 2"
    ],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Term 1",
    aliases: [
      "term 1", "term-1", "term 01", "t1", "t-1", "first term", "pratham satra",
      "प्रथम सत्र", "सत्र 1", "टर्म 1"
    ],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Term 2",
    aliases: [
      "term 2", "term-2", "term 02", "t2", "t-2", "second term", "dwitiya satra",
      "द्वितीय सत्र", "सत्र 2", "टर्म 2"
    ],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Half Yearly",
    aliases: [
      "half yearly", "half-yearly", "mid term", "midterm", "mid-term", "half yearly exam", "ardhvarshik", "chhamahi",
      "अर्धवार्षिक", "अर्धवार्षिक परीक्षा", "छमाही", "हाफ इयरली"
    ],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Pre Board",
    aliases: [
      "pre board", "pre-board", "preboard", "pre board 1", "pre board 2", "mock exam",
      "प्री बोर्ड", "प्री-बोर्ड"
    ],
    category: "EXAMINATIONS",
  },
  {
    canonical: "Annual Examination",
    aliases: [
      "annual exam", "annual examination", "annuals", "final exam", "finals", "year end exam", "varshik", "varshik pariksha",
      "वार्षिक", "वार्षिक परीक्षा", "सालाना परीक्षा", "फाइनल परीक्षा"
    ],
    category: "EXAMINATIONS",
  },
];

export const FEE_HEAD_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "School Fee",
    aliases: [
      "school fee", "school fees", "vidyalaya shulk",
      "स्कूल फीस", "विद्यालय शुल्क"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Tuition Fee",
    aliases: [
      "tuition fee", "tuition", "tution", "tuition charges", "shikshan shulk",
      "ट्यूशन फीस", "शिक्षण शुल्क", "पढ़ाई फीस", "पढ़ाई फीस"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Transport Fee",
    aliases: [
      "transport fee", "bus fee", "transport charges", "van fee", "conveyance fee", "pariwahan shulk",
      "परिवहन शुल्क", "बस फीस", "गाड़ी फीस"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Admission Fee",
    aliases: [
      "admission fee", "registration fee", "admission charges", "pravesh shulk", "dakhila fee",
      "प्रवेश शुल्क", "दाखिला फीस", "नामांकन शुल्क"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Annual Fee",
    aliases: [
      "annual fee", "annual charge", "development fee", "maintenance fee", "varshik shulk",
      "वार्षिक शुल्क", "विकास शुल्क"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Examination Fee",
    aliases: [
      "exam fee", "examination fee", "assessment fee", "pariksha shulk",
      "परीक्षा शुल्क", "इम्तिहान फीस"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Lab / Computer Fee",
    aliases: [
      "lab fee", "computer fee", "science lab fee", "it fee", "prayogshala shulk",
      "कंप्यूटर फीस", "प्रयोगशाला शुल्क"
    ],
    category: "FEES_FINANCE",
  },
  {
    canonical: "Caution Deposit",
    aliases: [
      "caution deposit", "security deposit", "zamanat rashi",
      "जमानत राशि", "सुरक्षा निधि"
    ],
    category: "FEES_FINANCE",
  },
];

export const INTENT_DICTIONARY: TokenDictionaryEntry[] = [
  {
    canonical: "ENTER_MARKS",
    aliases: [
      "enter marks", "marks entry", "add marks", "record marks", "fill marks",
      "enter scores", "score entry", "input marks", "marks submit",
      "ank darj", "number chadhaye", "ank bhare", "marks dale",
      "अंक दर्ज करें", "अंक दर्ज", "नंबर चढ़ाएं", "मार्क्स एंट्री", "अंक भरें", "नंबर डालें", "अंक प्रविष्टि"
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
      "marks list", "result list", "exam results", "marks obtained",
      "ank dekhe", "result dekhe", "marks dekhe", "pariksha parinam",
      "अंक देखें", "मार्क्स देखें", "रिजल्ट देखें", "परीक्षा परिणाम", "नंबर देखें", "परीक्षा अंक"
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
      "mark sheet", "marksheet", "grade card", "result card",
      "pragati patra", "anktalika",
      "प्रगति पत्र", "रिपोर्ट कार्ड", "अंकतालिका", "प्रगति पत्रक", "रिजल्ट कार्ड"
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
      "schedule exam", "exam dates", "pariksha schedule",
      "परीक्षा कार्यक्रम", "परीक्षा समय सारणी", "डेट शीट", "टाइम टेबल परीक्षा"
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
      "daily attendance", "register attendance",
      "haziri lagaye", "upasthiti darj", "haziri", "upasthiti le",
      "हाज़िरी लगाएं", "हाजिरी लगाएं", "उपस्थिति दर्ज करें", "हाज़िरी", "हाजिरी", "उपस्थिति लें"
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
      "absent list", "absentees", "present students", "attendance summary",
      "haziri dekhe", "upasthiti report", "anupasthit chhatra", "gairhazir",
      "उपस्थिति देखें", "हाज़िरी देखें", "हाजिरी रिपोर्ट", "अनुपस्थित छात्र", "गैरहाजिर", "उपस्थिति"
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
      "fee collection", "make fee payment", "record payment",
      "fees jama", "fee receipt", "shulk jama",
      "फीस जमा करें", "शुल्क जमा", "फीस लें", "फीस भुगतान", "रसीद काटें", "फीस जमा"
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
      "fee status", "fee balance", "outstanding fee", "fee report",
      "bakaya fees", "fees baki", "shulk bakaya",
      "बकाया फीस", "फीस बाकी", "शुल्क बकाया", "बकाया सूची", "फीस देनदारी"
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
      "bus tracking", "vehicle location", "bus stop timing", "bus live",
      "bus kahan hai", "gadi location",
      "बस कहां है", "बस ट्रैक करें", "गाड़ी की लोकेशन", "बस की स्थिति", "लाइव बस", "बस लोकेशन"
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
      "period schedule", "routine", "bell schedule", "my day", "myday", "my day schedule", "schedule",
      "samay sarni", "kaksha routine",
      "समय सारणी", "टाइम टेबल", "कक्षा समय सारणी", "रूटीन", "माई डे"
    ],
    category: "ACADEMICS",
    metadata: {
      action: "VIEW_TIMETABLE",
      route: "/academics",
      label: "View Timetable & Schedules",
    },
  },
  {
    canonical: "VIEW_SUBSTITUTIONS",
    aliases: [
      "substitutions", "substitution", "substitute", "view substitutions", "substitution workbench",
      "प्रतिस्थापन", "सब्सटीट्यूशन"
    ],
    category: "ACADEMICS",
    metadata: {
      action: "VIEW_TIMETABLE",
      route: "/teacher/classes?tab=substitutions",
      label: "View Substitutions Workbench",
    },
  },
  {
    canonical: "BOOK_PTM",
    aliases: [
      "ptm", "parent teacher meeting", "book ptm", "book ptm slot", "ptm appointment", "parent meeting",
      "पीटीएम", "शिक्षक अभिभावक बैठक"
    ],
    category: "COMMUNICATION",
    metadata: {
      action: "NAVIGATE_DOMAIN",
      route: "/parent/more",
      label: "Book PTM Appointment",
    },
  },
  {
    canonical: "APPLY_LEAVE",
    aliases: [
      "apply leave", "apply for leave", "student leave", "leave request", "chutti", "apply chutti",
      "अवकाश आवेदन", "छुट्टी का आवेदन", "छुट्टी", "अवकाश"
    ],
    category: "ATTENDANCE",
    metadata: {
      action: "NAVIGATE_DOMAIN",
      route: "/parent/more/leave",
      label: "Apply for Student Leave",
    },
  },
  {
    canonical: "CREATE_NOTICE",
    aliases: [
      "create notice", "post notice", "broadcast notice", "publish circular",
      "send circular", "announcement", "send message", "send sms", "notices", "notice", "school notices",
      "notice banaye", "suchna jari", "circular bheje",
      "सूचना जारी करें", "नोटिस बनाएं", "सर्कुलर भेजें", "सूचना भेजें", "घोषणा करें", "नोटिस", "सूचनाएं"
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
      "student search", "student info",
      "student khoje", "chhatra vivaran", "vidyarthi profile",
      "छात्र प्रोफाइल", "विद्यार्थी विवरण", "छात्र खोजें", "विद्यार्थी प्रोफाइल", "छात्र 360"
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
      "staff salary", "payroll", "staff directory",
      "shikshak suchi", "adhyapak profile", "karmachari vivaran",
      "शिक्षक सूची", "कर्मचारी विवरण", "अध्यापक सूची", "स्टाफ प्रोफाइल", "शिक्षकों की सूची"
    ],
    category: "HR_STAFF",
    metadata: {
      action: "VIEW_STAFF_PROFILE",
      route: "/hr",
      label: "Staff Directory & HR Profiles",
    },
  },
];

// Regex for class and section matching (English + Hindi/Devanagari)
// Matches "Class 10-A", "Class 10 A", "Grade 5 B", "Std 12", "10-A", "10A", "Nursery-B", "कक्षा 10-ए", "कक्षा 8 ब"
export const CLASS_SECTION_REGEXES = [
  /(?<=^|[^\p{L}\p{M}\p{N}])(?:class|grade|std|standard|kaksha|कक्षा|क्लास)\s*([0-9]{1,2}|nursery|lkg|ukg|kg|prep|नर्सरी|एलकेजी|यूकेजी|केजी|प्रेप)(?:[-\s]?([a-zA-Z\u0900-\u097F]{1,2}))?(?=[^\p{L}\p{M}\p{N}]|$)/iu,
  /(?<=^|[^\p{L}\p{M}\p{N}])([0-9]{1,2})[-\s]?([a-zA-Z\u0900-\u097F]{1,2})(?=[^\p{L}\p{M}\p{N}]|$)/iu,
  /(?<=^|[^\p{L}\p{M}\p{N}])(nursery|lkg|ukg|prep|नर्सरी|एलकेजी|यूकेजी|केजी|प्रेप)(?:[-\s]?([a-zA-Z\u0900-\u097F]{1,2}))?(?=[^\p{L}\p{M}\p{N}]|$)/iu,
];

// Regex for Bus / Route identification (English + Hindi/Devanagari)
// Matches "Bus 4", "Route 12", "Bus #3", "बस रूट 4", "गाड़ी नंबर 12"
export const BUS_ROUTE_REGEX = /(?<=^|[^\p{L}\p{M}\p{N}])(?:bus\s+route|route\s+bus|bus|route|van|बस\s*रूट|बस\s*नंबर|गाड़ी\s*नंबर|गाड़ी\s*नंबर|बस\s*क्रमांक|बस|गाड़ी|गाड़ी|रूट)\s*(?:no\.?|number|#|संख्या|क्रमांक|नं\.?)?\s*([0-9]{1,3}|[a-zA-Z0-9_-]+)(?=[^\p{L}\p{M}\p{N}]|$)/iu;

// Regex for temporal date matching (English + Hindi/Devanagari)
export const DATE_TEMPORAL_REGEXES = [
  /(?<=^|[^\p{L}\p{M}\p{N}])(today|yesterday|tomorrow|this week|last week|this month|last month|आज|कल|परसों|इस हफ्ते|पिछले हफ्ते|इस महीने|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार|aaj|kal|parson)(?=[^\p{L}\p{M}\p{N}]|$)/iu,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:\d{4})?\b/i,
];
