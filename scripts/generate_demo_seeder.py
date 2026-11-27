import os

code = '''/**
 * Production-Grade Multi-Board Interactive Demo Seeder
 *
 * Seeds executive-ready demo schools across all educational boards:
 * 1. CBSE (National)         -> Oakridge Global Academy (slug: "demo-cbse")
 * 2. ICSE (Comprehensive)    -> St. Xavier's International Academy (slug: "demo-icse")
 * 3. State Board (Regional)  -> Adarsh Vidya Mandir (slug: "demo-state")
 * 4. International (CAIE/IB) -> The Cambridge International School (slug: "demo-international")
 *
 * Fully Interconnected Modules:
 * - Academic Terms, Bell Schedules & Timetable Periods (Mon-Sat, 8 periods)
 * - Faculty Roster: Admin, Principal, Accountant, HR, Transport, Librarian & 12+ Specialized Subject Teachers
 * - Class Teacher Assignments (every section has an assigned class teacher)
 * - Section-Subject-Teacher Mappings (section_subject_teachers + class_subjects)
 * - Curriculum, Syllabus Units, Chapters & Topics (aligned with CBSE/NCERT)
 * - Lesson Plans (COMPLETED, IN_PROGRESS for today, and PLANNED)
 * - 200+ Students with DPDP-compliant profiles, family links, class history & prefix search hashes
 * - 45-day Student Attendance trends + live today status
 * - Homework / Assignments (PUBLISHED and CLOSED) + Submissions awaiting evaluation
 * - PARAKH-aligned Question Bank (MCQ, Short, Long Answer) + Assembled Question Papers
 * - Examination Schedules, Mark Distributions & Gradebook Mark Entries
 * - Timetable Substitutions Workbench (PENDING & CONFIRMED)
 * - Fee Heads, Structures, Invoices & Payment Receipts (Cash/UPI/Cheque, partial & full dues)
 * - Official Clean School Notices & Announcements
 */

import "dotenv/config";
import { db } from "./index";
import {
  schools,
  academicYears,
  academicTerms,
  academicCalendarEvents,
  bellSchedule,
  roles,
  users,
  userRoles,
  departments,
  designations,
  staff,
  classes,
  sections,
  classTeacherAssignments,
  subjects,
  classSubjects,
  sectionSubjectTeachers,
  studentSubjectEnrollments,
  homeroomReportRemarks,
  timetablePeriods,
  timetableSubstitutions,
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  lessonPlans,
  persons,
  students,
  studentClassHistory,
  studentFamilyMembers,
  passwordResetTokens,
  feeHeads,
  feeStructures,
  feeInvoices,
  feePayments,
  feeConcessions,
  feeQueries,
  studentAttendance,
  staffAttendance,
  studentLeaveRequests,
  assignments,
  assignmentSubmissions,
  examTypes,
  exams,
  examComponents,
  examClassScopes,
  examMarkDistributions,
  examSchedules,
  examMarksLocks,
  markEntries,
  reportCards,
  gradeRules,
  cocurricularAreas,
  cocurricularGrades,
  questionBank,
  questionPapers,
  questionPaperItems,
  questionPaperBlueprints,
  notices,
  noticeAcknowledgments,
  parentTeacherMessages,
  events,
  ptmEvents,
  ptmSlots,
  ptmBookings,
  leaveTypes,
  leaveRequests,
  leaveBalances,
  salaryComponents,
  drivers,
  vehicles,
  routes,
  routeStops,
  studentBusPasses,
  busBoardingEvents,
  admissionApplications,
  books,
  bookCopies,
  libraryMembers,
  bookIssues,
  chartOfAccounts,
  bankAccounts,
  incomeHeads,
  expenseHeads,
  incomeVouchers,
  expenseVouchers,
  accountLedgerTransactions,
  sessions,
} from "./schema";
import { eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Cryptographic & Search Helpers ──────────────────────────────────────────

const ENCRYPTION_KEY =
  process.env["ENCRYPTION_KEY"] ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function encryptData(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv,
  );
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v2:k1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function computeSearchHash(text: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(ENCRYPTION_KEY, "hex"))
    .update(text.trim().toLowerCase())
    .digest("hex");
}

function computeNamePrefixHashes(firstName?: string | null, lastName?: string | null): string[] {
  const normalizedFull = `${firstName || ""} ${lastName || ""}`
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, " ");
  if (!normalizedFull) return [];

  const words = normalizedFull.split(" ").filter(Boolean);
  const tokens = new Set<string>();

  for (const word of [...words, normalizedFull]) {
    const trimmedWord = word.trim();
    if (trimmedWord) tokens.add(trimmedWord);
    for (let len = 3; len <= word.length; len++) {
      const prefix = word.slice(0, len).trim();
      if (prefix.length >= 3) {
        tokens.add(prefix);
      }
    }
  }

  const hashes: string[] = [];
  for (const token of tokens) {
    hashes.push(computeSearchHash(token));
  }
  return hashes;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// ─── Multi-Board School Configurations ────────────────────────────────────────

export interface DemoSchoolConfig {
  name: string;
  slug: string;
  code: string;
  udiseCode: string;
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  principalName: string;
  phone: string;
  email: string;
  establishedYear: number;
  schoolType: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  themeColors: { light: string; dark: string };
  subjects: { name: string; code: string; type: "THEORY" | "PRACTICAL" }[];
  domainPrefix: string;
}

export const DEMO_SCHOOLS: DemoSchoolConfig[] = [
  {
    name: "Oakridge Global Academy [DEMO]",
    slug: "demo-cbse",
    code: "OGA-CBSE",
    udiseCode: "07010199991",
    board: "CBSE",
    principalName: "Dr. Arvind Sharma",
    phone: "011-28089901",
    email: "principal.cbse@demo.schoolos.io",
    establishedYear: 2010,
    schoolType: "INTEGRATED",
    address: "Campus Park, Vasant Kunj",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110070",
    themeColors: { light: "#0284c7", dark: "#38bdf8" },
    domainPrefix: "cbse",
    subjects: [
      { name: "English Communicative", code: "ENG-101", type: "THEORY" },
      { name: "Hindi Course-A", code: "HIN-002", type: "THEORY" },
      { name: "Mathematics Standard", code: "MAT-041", type: "THEORY" },
      { name: "Science & Technology", code: "SCI-086", type: "THEORY" },
      { name: "Social Science", code: "SST-087", type: "THEORY" },
      { name: "Information Technology", code: "IT-402", type: "PRACTICAL" },
    ],
  },
  {
    name: "St. Xavier's International Academy [DEMO]",
    slug: "demo-icse",
    code: "SXIA-ICSE",
    udiseCode: "07010199992",
    board: "ICSE",
    principalName: "Sr. Margaret D'Souza",
    phone: "022-26059902",
    email: "principal.icse@demo.schoolos.io",
    establishedYear: 2008,
    schoolType: "INTEGRATED",
    address: "St. Xavier's Hill, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    themeColors: { light: "#4f46e5", dark: "#818cf8" },
    domainPrefix: "icse",
    subjects: [
      { name: "English Language", code: "ENG-01", type: "THEORY" },
      { name: "English Literature", code: "LIT-02", type: "THEORY" },
      { name: "Mathematics", code: "MAT-03", type: "THEORY" },
      { name: "Physics & Chemistry", code: "PHY-04", type: "THEORY" },
      { name: "Biology", code: "BIO-05", type: "THEORY" },
      { name: "History & Civics", code: "HC-06", type: "THEORY" },
      { name: "Computer Applications", code: "CA-07", type: "PRACTICAL" },
    ],
  },
  {
    name: "Adarsh Vidya Mandir [DEMO]",
    slug: "demo-state",
    code: "AVM-STATE",
    udiseCode: "07010199993",
    board: "STATE_BOARD",
    principalName: "Prof. S. R. Deshmukh",
    phone: "020-25539903",
    email: "principal.state@demo.schoolos.io",
    establishedYear: 2004,
    schoolType: "INTEGRATED",
    address: "Vidya Nagar, Shivaji Road",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411005",
    themeColors: { light: "#059669", dark: "#34d399" },
    domainPrefix: "state",
    subjects: [
      { name: "First Language", code: "LANG-1", type: "THEORY" },
      { name: "Second Language", code: "LANG-2", type: "THEORY" },
      { name: "General English", code: "ENG-GEN", type: "THEORY" },
      { name: "General Mathematics", code: "MAT-GEN", type: "THEORY" },
      { name: "General Science", code: "SCI-GEN", type: "THEORY" },
      { name: "Social Studies", code: "SST-GEN", type: "THEORY" },
    ],
  },
  {
    name: "The Cambridge International School [DEMO]",
    slug: "demo-international",
    code: "TCIS-INTL",
    udiseCode: "07010199994",
    board: "IGCSE",
    principalName: "Dr. Alistair Vance",
    phone: "080-25219904",
    email: "principal.intl@demo.schoolos.io",
    establishedYear: 2015,
    schoolType: "INTEGRATED",
    address: "Global Tech Corridor, Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560066",
    themeColors: { light: "#d97706", dark: "#fbbf24" },
    domainPrefix: "intl",
    subjects: [
      { name: "Cambridge First Language English", code: "CAIE-0500", type: "THEORY" },
      { name: "Cambridge International Mathematics", code: "CAIE-0607", type: "THEORY" },
      { name: "Combined Science", code: "CAIE-0653", type: "THEORY" },
      { name: "Global Perspectives", code: "CAIE-0457", type: "THEORY" },
      { name: "Information & Communication Tech", code: "CAIE-0417", type: "PRACTICAL" },
    ],
  },
];

// Names Pool
const INDIAN_FIRST_NAMES_BOYS = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Muhammad", "Sai",
  "Arnav", "Aayush", "Shaurya", "Atharv", "Advik", "Pranav", "Kabir", "Dhruv",
  "Ishaan", "Rohan", "Kunal", "Rahul", "Vikas", "Rohit", "Sameer", "Nikhil",
];
const INDIAN_FIRST_NAMES_GIRLS = [
  "Ananya", "Diya", "Sanvi", "Aadhya", "Pari", "Saanvi", "Kiara", "Myra",
  "Riya", "Aarohi", "Anaya", "Navya", "Avni", "Ishita", "Meera", "Sara",
  "Tanya", "Neha", "Pooja", "Priya", "Sneha", "Simran", "Kritika", "Aditi",
];
const INDIAN_LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Patel", "Singh", "Mehta", "Kumar", "Joshi",
  "Mishra", "Nair", "Rao", "Reddy", "Agarwal", "Bhatia", "Choudhury", "Das",
  "Sen", "Ghosh", "Iyer", "Chatterjee", "Mukherjee", "Kapoor", "Yadav", "Patil",
];

// ─── Tenant Cleanup (Strict Isolation) ────────────────────────────────────────

export async function cleanDemoSchool(targetSchoolId: string): Promise<void> {
  await db.execute(sql`RESET ROLE;`);
  await db.execute(sql`SET session_replication_role = 'replica';`);

  try {
    // Clear nullable circular FK references first
    await db.update(sections).set({ classTeacherId: null }).where(eq(sections.schoolId, targetSchoolId));
    await db.update(students).set({ currentSectionId: null, primaryParentUserId: null }).where(eq(students.schoolId, targetSchoolId));

    // Clean sessions & reset tokens
    const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, targetSchoolId));
    if (demoUsers.length > 0) {
      const userIds = demoUsers.map((u) => u.id);
      for (const chunk of chunkArray(userIds, 400)) {
        await db.delete(sessions).where(inArray(sessions.userId, chunk));
        await db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, chunk));
      }
    }

    // Delete audit logs for this demo school
    await db.execute(sql`DELETE FROM fee_audit_logs WHERE school_id = ${targetSchoolId};`);
    await db.execute(sql`DELETE FROM audit_logs WHERE school_id = ${targetSchoolId};`);

    // Delete communication, PTM, library, transport, HR, accounts child tables
    await db.delete(noticeAcknowledgments).where(eq(noticeAcknowledgments.schoolId, targetSchoolId));
    await db.delete(parentTeacherMessages).where(eq(parentTeacherMessages.schoolId, targetSchoolId));
    await db.delete(ptmBookings).where(eq(ptmBookings.schoolId, targetSchoolId));
    await db.delete(ptmSlots).where(eq(ptmSlots.schoolId, targetSchoolId));
    await db.delete(ptmEvents).where(eq(ptmEvents.schoolId, targetSchoolId));
    await db.delete(events).where(eq(events.schoolId, targetSchoolId));

    await db.delete(bookIssues).where(eq(bookIssues.schoolId, targetSchoolId));
    await db.delete(libraryMembers).where(eq(libraryMembers.schoolId, targetSchoolId));
    await db.delete(bookCopies).where(eq(bookCopies.schoolId, targetSchoolId));
    await db.delete(books).where(eq(books.schoolId, targetSchoolId));

    await db.delete(busBoardingEvents).where(eq(busBoardingEvents.schoolId, targetSchoolId));
    await db.delete(drivers).where(eq(drivers.schoolId, targetSchoolId));
    await db.delete(studentBusPasses).where(eq(studentBusPasses.schoolId, targetSchoolId));
    await db.delete(routeStops).where(eq(routeStops.schoolId, targetSchoolId));
    await db.delete(routes).where(eq(routes.schoolId, targetSchoolId));
    await db.delete(vehicles).where(eq(vehicles.schoolId, targetSchoolId));

    await db.delete(admissionApplications).where(eq(admissionApplications.schoolId, targetSchoolId));

    await db.delete(leaveBalances).where(eq(leaveBalances.schoolId, targetSchoolId));
    await db.delete(salaryComponents).where(eq(salaryComponents.schoolId, targetSchoolId));
    await db.delete(staffAttendance).where(eq(staffAttendance.schoolId, targetSchoolId));
    await db.delete(leaveRequests).where(eq(leaveRequests.schoolId, targetSchoolId));
    await db.delete(leaveTypes).where(eq(leaveTypes.schoolId, targetSchoolId));

    await db.delete(accountLedgerTransactions).where(eq(accountLedgerTransactions.schoolId, targetSchoolId));
    await db.delete(incomeVouchers).where(eq(incomeVouchers.schoolId, targetSchoolId));
    await db.delete(expenseVouchers).where(eq(expenseVouchers.schoolId, targetSchoolId));
    await db.delete(incomeHeads).where(eq(incomeHeads.schoolId, targetSchoolId));
    await db.delete(expenseHeads).where(eq(expenseHeads.schoolId, targetSchoolId));
    await db.delete(bankAccounts).where(eq(bankAccounts.schoolId, targetSchoolId));
    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.schoolId, targetSchoolId));

    await db.delete(cocurricularGrades).where(eq(cocurricularGrades.schoolId, targetSchoolId));
    await db.delete(cocurricularAreas).where(eq(cocurricularAreas.schoolId, targetSchoolId));
    await db.delete(gradeRules).where(eq(gradeRules.schoolId, targetSchoolId));
    await db.delete(homeroomReportRemarks).where(eq(homeroomReportRemarks.schoolId, targetSchoolId));
    await db.delete(studentLeaveRequests).where(eq(studentLeaveRequests.schoolId, targetSchoolId));
    await db.delete(studentSubjectEnrollments).where(eq(studentSubjectEnrollments.schoolId, targetSchoolId));

    // Delete child tables in reverse foreign-key order
    await db.delete(questionPaperItems).where(eq(questionPaperItems.schoolId, targetSchoolId));
  await db.delete(questionPapers).where(eq(questionPapers.schoolId, targetSchoolId));
  await db.delete(questionPaperBlueprints).where(eq(questionPaperBlueprints.schoolId, targetSchoolId));
  await db.delete(questionBank).where(eq(questionBank.schoolId, targetSchoolId));

  await db.delete(timetableSubstitutions).where(eq(timetableSubstitutions.schoolId, targetSchoolId));
  await db.delete(lessonPlans).where(eq(lessonPlans.schoolId, targetSchoolId));
  await db.delete(syllabusTopics).where(eq(syllabusTopics.schoolId, targetSchoolId));
  await db.delete(syllabusChapters).where(eq(syllabusChapters.schoolId, targetSchoolId));
  await db.delete(syllabusUnits).where(eq(syllabusUnits.schoolId, targetSchoolId));
  await db.delete(sectionSubjectTeachers).where(eq(sectionSubjectTeachers.schoolId, targetSchoolId));
  await db.delete(academicCalendarEvents).where(eq(academicCalendarEvents.schoolId, targetSchoolId));
  await db.delete(bellSchedule).where(eq(bellSchedule.schoolId, targetSchoolId));
  await db.delete(academicTerms).where(eq(academicTerms.schoolId, targetSchoolId));

  await db.delete(notices).where(eq(notices.schoolId, targetSchoolId));
  await db.delete(reportCards).where(eq(reportCards.schoolId, targetSchoolId));
  await db.delete(markEntries).where(eq(markEntries.schoolId, targetSchoolId));
  await db.delete(examMarksLocks).where(eq(examMarksLocks.schoolId, targetSchoolId));
  await db.delete(examSchedules).where(eq(examSchedules.schoolId, targetSchoolId));
  await db.delete(examMarkDistributions).where(eq(examMarkDistributions.schoolId, targetSchoolId));
  await db.delete(examClassScopes).where(eq(examClassScopes.schoolId, targetSchoolId));
  await db.delete(examComponents).where(eq(examComponents.schoolId, targetSchoolId));
  await db.delete(exams).where(eq(exams.schoolId, targetSchoolId));
  await db.delete(examTypes).where(eq(examTypes.schoolId, targetSchoolId));

  await db.delete(assignmentSubmissions).where(eq(assignmentSubmissions.schoolId, targetSchoolId));
  await db.delete(assignments).where(eq(assignments.schoolId, targetSchoolId));
  await db.delete(studentAttendance).where(eq(studentAttendance.schoolId, targetSchoolId));
  await db.delete(timetablePeriods).where(eq(timetablePeriods.schoolId, targetSchoolId));
  await db.delete(classTeacherAssignments).where(eq(classTeacherAssignments.schoolId, targetSchoolId));
  await db.delete(classSubjects).where(eq(classSubjects.schoolId, targetSchoolId));

  // Delete fee tables in strict order
  await db.execute(sql`DELETE FROM fee_refunds WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM payment_gateway_logs WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM fee_challans WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM student_fee_advance_allocations WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM fee_queries WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM fee_payments WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM fee_concessions WHERE school_id = ${targetSchoolId}`);
  await db.execute(sql`DELETE FROM fee_invoices WHERE school_id = ${targetSchoolId} OR fee_structure_id IN (SELECT id FROM fee_structures WHERE school_id = ${targetSchoolId})`);
  await db.delete(feeStructures).where(eq(feeStructures.schoolId, targetSchoolId));
  await db.delete(feeHeads).where(eq(feeHeads.schoolId, targetSchoolId));

  await db.delete(studentFamilyMembers).where(eq(studentFamilyMembers.schoolId, targetSchoolId));
  await db.delete(studentClassHistory).where(eq(studentClassHistory.schoolId, targetSchoolId));
  await db.delete(students).where(eq(students.schoolId, targetSchoolId));

  await db.delete(sections).where(eq(sections.schoolId, targetSchoolId));
  await db.delete(classes).where(eq(classes.schoolId, targetSchoolId));
  await db.delete(subjects).where(eq(subjects.schoolId, targetSchoolId));

  await db.delete(staff).where(eq(staff.schoolId, targetSchoolId));
  await db.delete(designations).where(eq(designations.schoolId, targetSchoolId));
  await db.delete(departments).where(eq(departments.schoolId, targetSchoolId));

  await db.delete(userRoles).where(eq(userRoles.schoolId, targetSchoolId));
  await db.delete(roles).where(eq(roles.schoolId, targetSchoolId));
  await db.delete(persons).where(eq(persons.schoolId, targetSchoolId));
  await db.delete(users).where(eq(users.schoolId, targetSchoolId));
  await db.delete(academicYears).where(eq(academicYears.schoolId, targetSchoolId));

  await db.delete(schools).where(eq(schools.id, targetSchoolId));
  } finally {
    await db.execute(sql`SET session_replication_role = 'origin';`);
  }
}

export async function resetAllDemoSchools(): Promise<void> {
  console.log("🧹 Resetting all demo schools...");
  const demoSlugs = DEMO_SCHOOLS.map((s) => s.slug).concat(["dpa-demo"]);
  for (const slug of demoSlugs) {
    const existing = await db.query.schools.findFirst({
      where: eq(schools.slug, slug),
      columns: { id: true, name: true },
    });
    if (existing) {
      console.log(`  Deleting existing demo school: ${existing.name} (${existing.id})`);
      await cleanDemoSchool(existing.id);
    }
  }
}

// ─── Single School Seeder ─────────────────────────────────────────────────────

export async function seedSingleDemoSchool(config: DemoSchoolConfig): Promise<{
  schoolId: string;
  name: string;
  board: string;
  studentsCount: number;
  staffCount: number;
  invoicesCount: number;
}> {
  console.log(`\\n🏫 Seeding Demo School: ${config.name} (${config.board})`);

  // 1. Clean existing instance if exists
  const existing = await db.query.schools.findFirst({
    where: eq(schools.slug, config.slug),
    columns: { id: true },
  });
  if (existing) {
    await cleanDemoSchool(existing.id);
  }

  // Precomputed hash for "SchoolMitra@123"
  const DEFAULT_PASSWORD_HASH = await bcrypt.hash("SchoolMitra@123", 10);

  // 2. Insert School Record
  const [school] = await db
    .insert(schools)
    .values({
      name: config.name,
      slug: config.slug,
      udiseCode: config.udiseCode,
      board: config.board,
      phone: config.phone,
      email: config.email,
      principalName: config.principalName,
      establishedYear: config.establishedYear,
      schoolType: config.schoolType,
      status: "ACTIVE",
      address: config.address,
      city: config.city,
      state: config.state,
      pincode: config.pincode,
      themeColors: config.themeColors,
      featureFlags: {
        demo_tenant: true,
        school_code: config.code,
        student_pwa_enabled: true,
        parent_pwa_enabled: true,
      },
      provisioningManifest: {
        code: config.code,
        board: config.board,
        isDemoSchool: true,
        seededAt: new Date().toISOString(),
      },
    })
    .returning();
  const schoolId = school!.id;

  // 3. Academic Year (2026-27 Active)
  const [academicYear] = await db
    .insert(academicYears)
    .values({
      schoolId,
      label: "2026-27",
      startDate: new Date("2026-04-01T00:00:00Z"),
      endDate: new Date("2027-03-31T23:59:59Z"),
      isActive: true,
    })
    .returning();
  const academicYearId = academicYear!.id;

  // 3b. Academic Terms
  const [term1] = await db
    .insert(academicTerms)
    .values({
      schoolId,
      academicYearId,
      name: "Term 1 (Apr - Sep 2026)",
      startDate: "2026-04-01",
      endDate: "2026-09-30",
      sortOrder: 1,
      isActive: true,
    })
    .returning();

  const [term2] = await db
    .insert(academicTerms)
    .values({
      schoolId,
      academicYearId,
      name: "Term 2 (Oct 2026 - Mar 2027)",
      startDate: "2026-10-01",
      endDate: "2027-03-31",
      sortOrder: 2,
      isActive: true,
    })
    .returning();

  // 3c. Academic Calendar Events
  await db.insert(academicCalendarEvents).values([
    {
      schoolId,
      academicYearId,
      termId: term1!.id,
      title: "Mid-Term Examination 2026",
      eventType: "EXAM",
      startDate: "2026-09-15",
      endDate: "2026-09-25",
      isWorkingDay: true,
      isActive: true,
    },
    {
      schoolId,
      academicYearId,
      termId: term2!.id,
      title: "Gandhi Jayanti",
      eventType: "HOLIDAY",
      startDate: "2026-10-02",
      endDate: "2026-10-02",
      isWorkingDay: false,
      isActive: true,
    },
    {
      schoolId,
      academicYearId,
      termId: term2!.id,
      title: "Dussehra Autumn Break",
      eventType: "HOLIDAY",
      startDate: "2026-10-18",
      endDate: "2026-10-22",
      isWorkingDay: false,
      isActive: true,
    },
    {
      schoolId,
      academicYearId,
      termId: term2!.id,
      title: "Diwali Vacation",
      eventType: "VACATION",
      startDate: "2026-11-08",
      endDate: "2026-11-13",
      isWorkingDay: false,
      isActive: true,
    },
    {
      schoolId,
      academicYearId,
      termId: term2!.id,
      title: "Annual Sports Championship 2026",
      eventType: "SPORTS",
      startDate: "2026-11-28",
      endDate: "2026-11-28",
      isWorkingDay: true,
      isActive: true,
    },
    {
      schoolId,
      academicYearId,
      termId: term2!.id,
      title: "Parent-Teacher Conference (Term 1 Review)",
      eventType: "PTM",
      startDate: "2026-11-29",
      endDate: "2026-11-29",
      isWorkingDay: true,
      isActive: true,
    },
  ]);

  // 3d. Bell Schedule (8 periods)
  const bellSchedules = [
    { periodNumber: 1, name: "Period 1", startTime: "08:00:00", endTime: "08:45:00", periodType: "REGULAR" as const },
    { periodNumber: 2, name: "Period 2", startTime: "08:45:00", endTime: "09:30:00", periodType: "REGULAR" as const },
    { periodNumber: 3, name: "Period 3", startTime: "09:30:00", endTime: "10:15:00", periodType: "REGULAR" as const },
    { periodNumber: 4, name: "Period 4", startTime: "10:30:00", endTime: "11:15:00", periodType: "REGULAR" as const },
    { periodNumber: 5, name: "Period 5", startTime: "11:15:00", endTime: "12:00:00", periodType: "REGULAR" as const },
    { periodNumber: 6, name: "Period 6", startTime: "12:45:00", endTime: "13:30:00", periodType: "REGULAR" as const },
    { periodNumber: 7, name: "Period 7", startTime: "13:30:00", endTime: "14:15:00", periodType: "REGULAR" as const },
    { periodNumber: 8, name: "Period 8", startTime: "14:15:00", endTime: "15:00:00", periodType: "REGULAR" as const },
  ];
  for (const b of bellSchedules) {
    await db.insert(bellSchedule).values({
      schoolId,
      periodNumber: b.periodNumber,
      name: b.name,
      startTime: b.startTime,
      endTime: b.endTime,
      periodType: b.periodType,
      isActive: true,
    });
  }

  // 4. Ensure Roles
  const existingRoles = await db.select().from(roles).where(eq(roles.schoolId, schoolId));
  const roleMap = new Map<string, string>();
  for (const r of existingRoles) {
    roleMap.set(r.name, r.id);
  }

  const REQUIRED_ROLES = [
    { name: "PRINCIPAL", displayName: "Principal" },
    { name: "SCHOOL_ADMIN", displayName: "School Admin" },
    { name: "TEACHER", displayName: "Teacher" },
    { name: "ACCOUNTANT", displayName: "Accountant" },
    { name: "HR_MANAGER", displayName: "HR Manager" },
    { name: "TRANSPORT_MANAGER", displayName: "Transport Manager" },
    { name: "LIBRARIAN", displayName: "Librarian" },
    { name: "DRIVER", displayName: "Driver" },
    { name: "PARENT", displayName: "Parent" },
    { name: "STUDENT", displayName: "Student" },
  ] as const;

  for (const r of REQUIRED_ROLES) {
    if (!roleMap.has(r.name)) {
      const [newRole] = await db
        .insert(roles)
        .values({
          schoolId,
          name: r.name as any,
          displayName: r.displayName,
          isSystemRole: true,
        })
        .returning();
      roleMap.set(r.name, newRole!.id);
    }
  }

  // 5. Departments
  const deptNames = ["Academics", "Administration", "Finance & Accounts", "Transport & Safety", "Student Welfare"];
  const deptMap = new Map<string, string>();
  for (const dName of deptNames) {
    const [dept] = await db.insert(departments).values({ schoolId, name: dName, isActive: true }).returning();
    deptMap.set(dName, dept!.id);
  }

  // 6. Designations
  const desigConfigs = [
    { name: "Principal", dept: "Academics", role: "PRINCIPAL", isTeaching: true },
    { name: "Senior Teacher", dept: "Academics", role: "TEACHER", isTeaching: true },
    { name: "Primary Teacher", dept: "Academics", role: "TEACHER", isTeaching: true },
    { name: "School Administrator", dept: "Administration", role: "SCHOOL_ADMIN", isTeaching: false },
    { name: "HR Manager", dept: "Administration", role: "HR_MANAGER", isTeaching: false },
    { name: "Senior Accountant", dept: "Finance & Accounts", role: "ACCOUNTANT", isTeaching: false },
    { name: "Transport Head", dept: "Transport & Safety", role: "TRANSPORT_MANAGER", isTeaching: false },
    { name: "Librarian", dept: "Academics", role: "LIBRARIAN", isTeaching: false },
  ];
  const desigMap = new Map<string, string>();
  for (const des of desigConfigs) {
    const [d] = await db
      .insert(designations)
      .values({
        schoolId,
        departmentId: deptMap.get(des.dept)!,
        name: des.name,
        mappedRole: des.role,
        isTeaching: des.isTeaching,
        isActive: true,
      })
      .returning();
    desigMap.set(des.name, d!.id);
  }

  // 7. Seed Complete Staff & Specialized Faculty
  const isFlagship = config.slug === "demo-cbse";

  interface StaffSeedSpec {
    firstName: string;
    lastName: string;
    email: string;
    additionalEmail?: string | undefined;
    phone: string;
    role: "SCHOOL_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "HR_MANAGER" | "TRANSPORT_MANAGER" | "LIBRARIAN" | "DRIVER";
    desig: string;
    dept: string;
    subjectTag?: string | undefined;
  }

  const staffRoster: StaffSeedSpec[] = [
    {
      firstName: "Dr. Arvind",
      lastName: "Sharma",
      email: isFlagship ? "principal@demo.schoolos.io" : `principal.${config.domainPrefix}@demo.schoolos.io`,
      additionalEmail: isFlagship ? "principal.cbse@demo.schoolos.io" : undefined,
      phone: "9811000101",
      role: "PRINCIPAL",
      desig: "Principal",
      dept: "Academics",
    },
    {
      firstName: "Aditi",
      lastName: "Rao",
      email: isFlagship ? "admin@demo.schoolos.io" : `admin.${config.domainPrefix}@demo.schoolos.io`,
      additionalEmail: isFlagship ? "admin.cbse@demo.schoolos.io" : undefined,
      phone: "9811000102",
      role: "SCHOOL_ADMIN",
      desig: "School Administrator",
      dept: "Administration",
    },
    {
      firstName: "Rajiv",
      lastName: "Mehta",
      email: isFlagship ? "finance@demo.schoolos.io" : `finance.${config.domainPrefix}@demo.schoolos.io`,
      additionalEmail: isFlagship ? "finance.cbse@demo.schoolos.io" : undefined,
      phone: "9811000104",
      role: "ACCOUNTANT",
      desig: "Senior Accountant",
      dept: "Finance & Accounts",
    },
    {
      firstName: "Meenakshi",
      lastName: "Sundaram",
      email: isFlagship ? "hr@demo.schoolos.io" : `hr.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000105",
      role: "HR_MANAGER",
      desig: "HR Manager",
      dept: "Administration",
    },
    {
      firstName: "Ramesh",
      lastName: "Verma",
      email: isFlagship ? "transport@demo.schoolos.io" : `transport.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000106",
      role: "TRANSPORT_MANAGER",
      desig: "Transport Head",
      dept: "Transport & Safety",
    },
    {
      firstName: "Geeta",
      lastName: "Iyer",
      email: isFlagship ? "librarian@demo.schoolos.io" : `librarian.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000107",
      role: "LIBRARIAN",
      desig: "Librarian",
      dept: "Academics",
    },
    // Faculty Teachers
    {
      firstName: "Priya",
      lastName: "Sharma",
      email: isFlagship ? "teacher@demo.schoolos.io" : `teacher.${config.domainPrefix}@demo.schoolos.io`,
      additionalEmail: isFlagship ? "teacher.cbse@demo.schoolos.io" : undefined,
      phone: "9811000103",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "MATHEMATICS",
    },
    {
      firstName: "Rajesh",
      lastName: "Kannan",
      email: isFlagship ? "teacher.math@demo.schoolos.io" : `teacher.math.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000110",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "MATHEMATICS",
    },
    {
      firstName: "Ananya",
      lastName: "Sen",
      email: isFlagship ? "teacher.sci@demo.schoolos.io" : `teacher.sci.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000111",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "SCIENCE",
    },
    {
      firstName: "Vikram",
      lastName: "Malhotra",
      email: isFlagship ? "teacher.chem@demo.schoolos.io" : `teacher.chem.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000112",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "SCIENCE",
    },
    {
      firstName: "Sunita",
      lastName: "Deshmukh",
      email: isFlagship ? "teacher.eng@demo.schoolos.io" : `teacher.eng.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000113",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "ENGLISH",
    },
    {
      firstName: "Amit",
      lastName: "Trivedi",
      email: isFlagship ? "teacher.hin@demo.schoolos.io" : `teacher.hin.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000114",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "HINDI",
    },
    {
      firstName: "Neha",
      lastName: "Gupta",
      email: isFlagship ? "teacher.sst@demo.schoolos.io" : `teacher.sst.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000115",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "SOCIAL_SCIENCE",
    },
    {
      firstName: "Manoj",
      lastName: "Nair",
      email: isFlagship ? "teacher.geo@demo.schoolos.io" : `teacher.geo.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000116",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "SOCIAL_SCIENCE",
    },
    {
      firstName: "Rohit",
      lastName: "Kapoor",
      email: isFlagship ? "teacher.cs@demo.schoolos.io" : `teacher.cs.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000117",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
      subjectTag: "IT",
    },
    {
      firstName: "Pooja",
      lastName: "Bhatia",
      email: isFlagship ? "teacher.bio@demo.schoolos.io" : `teacher.bio.${config.domainPrefix}@demo.schoolos.io`,
      phone: "9811000118",
      role: "TEACHER",
      desig: "Primary Teacher",
      dept: "Academics",
      subjectTag: "SCIENCE",
    },
    {
      firstName: "Suresh",
      lastName: "Yadav",
      email: isFlagship ? "driver@demo.schoolos.io" : `driver.${config.domainPrefix}@demo.schoolos.io`,
      additionalEmail: isFlagship ? "driver.cbse@demo.schoolos.io" : undefined,
      phone: "9811000881",
      role: "DRIVER",
      desig: "Transport Head",
      dept: "Transport & Safety",
    },
  ];

  const teacherMap = new Map<string, string>(); // tag/name -> userId
  const staffIdByUserId = new Map<string, string>();
  const allStaffIds: string[] = [];
  let primaryTeacherUserId = "";
  let principalUserId = "";
  let accountantUserId = "";
  let driverUserId = "";

  for (const st of staffRoster) {
    const emailsToCreate = [st.email];
    if (st.additionalEmail) emailsToCreate.push(st.additionalEmail);

    let createdUserId = "";
    for (const em of emailsToCreate) {
      const [u] = await db
        .insert(users)
        .values({
          schoolId,
          email: em.toLowerCase(),
          passwordHash: DEFAULT_PASSWORD_HASH,
          mobileEncrypted: encryptData(st.phone),
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
        })
        .returning();

      if (!createdUserId) createdUserId = u!.id;

      await db.insert(userRoles).values({
        schoolId,
        userId: u!.id,
        roleId: roleMap.get(st.role)!,
      });

      await db.insert(persons).values({
        schoolId,
        userId: u!.id,
        primaryType: "STAFF",
        firstNameEncrypted: encryptData(st.firstName),
        lastNameEncrypted: encryptData(st.lastName),
        firstNameSearchHash: computeSearchHash(st.firstName),
        lastNameSearchHash: computeSearchHash(st.lastName),
        gender: "FEMALE",
        dateOfBirth: new Date("1985-06-15T00:00:00Z"),
        isActive: true,
      });

      const [stRec] = await db.insert(staff).values({
        schoolId,
        userId: u!.id,
        employeeCode: `${config.code}-EMP-${u!.id.slice(0, 4).toUpperCase()}`,
        departmentId: deptMap.get(st.dept)!,
        designationId: desigMap.get(st.desig)!,
        contractType: "PERMANENT",
        joiningDate: new Date("2023-04-01T00:00:00Z"),
        firstNameEncrypted: encryptData(st.firstName),
        lastNameEncrypted: encryptData(st.lastName),
        dateOfBirthEncrypted: encryptData("1985-06-15"),
        genderEncrypted: encryptData("FEMALE"),
        mobileEncrypted: encryptData(st.phone),
        emailEncrypted: encryptData(em),
        isActive: true,
      }).returning();

      if (stRec && !staffIdByUserId.has(u!.id)) {
        staffIdByUserId.set(u!.id, stRec.id);
        allStaffIds.push(stRec.id);
      }
    }

    if (st.role === "PRINCIPAL" && !principalUserId) principalUserId = createdUserId;
    if (st.role === "ACCOUNTANT" && !accountantUserId) accountantUserId = createdUserId;
    if (st.role === "DRIVER" && !driverUserId) driverUserId = createdUserId;
    if (st.role === "TEACHER") {
      teacherMap.set(st.firstName, createdUserId);
      if (st.subjectTag) teacherMap.set(st.subjectTag, createdUserId);
      if (!primaryTeacherUserId) primaryTeacherUserId = createdUserId;
    }
  }

  // 8. Insert Classes (Grades 1 to 10) & Sections (A & B)
  const gradeLevels = [
    { grade: "CLASS_1", name: "Class 1", order: 1 },
    { grade: "CLASS_2", name: "Class 2", order: 2 },
    { grade: "CLASS_3", name: "Class 3", order: 3 },
    { grade: "CLASS_4", name: "Class 4", order: 4 },
    { grade: "CLASS_5", name: "Class 5", order: 5 },
    { grade: "CLASS_6", name: "Class 6", order: 6 },
    { grade: "CLASS_7", name: "Class 7", order: 7 },
    { grade: "CLASS_8", name: "Class 8", order: 8 },
    { grade: "CLASS_9", name: "Class 9", order: 9 },
    { grade: "CLASS_10", name: "Class 10", order: 10 },
  ] as const;

  interface SectionInfo {
    id: string;
    classId: string;
    className: string;
    sectionName: string;
    gradeOrder: number;
    classTeacherId: string;
  }
  const allSections: SectionInfo[] = [];

  // Designated Class Teachers
  const classTeacherAssignmentMap: Record<string, string> = {
    "Class 10-A": primaryTeacherUserId, // Priya Sharma
    "Class 10-B": teacherMap.get("Ananya") || primaryTeacherUserId,
    "Class 9-A": teacherMap.get("Rajesh") || primaryTeacherUserId,
    "Class 9-B": teacherMap.get("Vikram") || primaryTeacherUserId,
    "Class 8-A": teacherMap.get("Sunita") || primaryTeacherUserId,
    "Class 8-B": teacherMap.get("Amit") || primaryTeacherUserId,
    "Class 7-A": teacherMap.get("Neha") || primaryTeacherUserId,
    "Class 7-B": teacherMap.get("Manoj") || primaryTeacherUserId,
    "Class 6-A": teacherMap.get("Rohit") || primaryTeacherUserId,
    "Class 6-B": teacherMap.get("Pooja") || primaryTeacherUserId,
  };

  for (const g of gradeLevels) {
    const [cls] = await db
      .insert(classes)
      .values({
        schoolId,
        academicYearId,
        displayName: g.name,
        gradeLevel: g.grade as any,
        sortOrder: g.order,
        isActive: true,
      })
      .returning();

    for (const secName of ["A", "B"]) {
      const key = `${g.name}-${secName}`;
      const assignedCt = classTeacherAssignmentMap[key] || primaryTeacherUserId;

      const [sec] = await db
        .insert(sections)
        .values({
          schoolId,
          classId: cls!.id,
          name: secName,
          roomNumber: `Room ${g.order}0${secName === "A" ? 1 : 2}`,
          capacity: 35,
          classTeacherId: assignedCt,
          isActive: true,
        })
        .returning();

      allSections.push({
        id: sec!.id,
        classId: cls!.id,
        className: g.name,
        sectionName: secName,
        gradeOrder: g.order,
        classTeacherId: assignedCt,
      });

      // Class Teacher Assignment Record
      await db.insert(classTeacherAssignments).values({
        schoolId,
        sectionId: sec!.id,
        teacherId: assignedCt,
        academicYearId,
        effectiveFrom: "2026-04-01",
        isActive: true,
      });
    }
  }

  // 9. Insert Subjects & Mappings
  const subjectRecords: { id: string; name: string; code: string }[] = [];
  for (const s of config.subjects) {
    const [sub] = await db
      .insert(subjects)
      .values({
        schoolId,
        name: s.name,
        code: `${config.code}-${s.code}`,
        subjectType: s.type as any,
        isActive: true,
      })
      .returning();
    subjectRecords.push({ id: sub!.id, name: s.name, code: s.code });
  }

  // Teacher allocation lookup by subject keyword
  function getTeacherForSubject(subName: string, secKey: string): string {
    const sn = subName.toLowerCase();
    if (sn.includes("math")) {
      return secKey.includes("10-A") || secKey.includes("10-B") || secKey.includes("9-A") || secKey.includes("8-A")
        ? primaryTeacherUserId // Priya Sharma
        : (teacherMap.get("Rajesh") || primaryTeacherUserId);
    }
    if (sn.includes("sci") || sn.includes("phy") || sn.includes("chem") || sn.includes("bio")) {
      return secKey.includes("10") ? (teacherMap.get("Ananya") || primaryTeacherUserId) : (teacherMap.get("Vikram") || primaryTeacherUserId);
    }
    if (sn.includes("eng") || sn.includes("lit")) {
      return teacherMap.get("Sunita") || primaryTeacherUserId;
    }
    if (sn.includes("hin") || sn.includes("lang")) {
      return teacherMap.get("Amit") || primaryTeacherUserId;
    }
    if (sn.includes("soc") || sn.includes("hist") || sn.includes("geo")) {
      return teacherMap.get("Neha") || primaryTeacherUserId;
    }
    if (sn.includes("info") || sn.includes("comp")) {
      return teacherMap.get("Rohit") || primaryTeacherUserId;
    }
    return primaryTeacherUserId;
  }

  const classSubjectRecords: { classId: string; subjectId: string; id: string; subjectName: string }[] = [];
  const uniqueClassIds = Array.from(new Set(allSections.map((s) => s.classId)));

  for (const cId of uniqueClassIds) {
    for (const s of subjectRecords) {
      const assignedT = getTeacherForSubject(s.name, "10-A");
      const [cs] = await db
        .insert(classSubjects)
        .values({
          schoolId,
          classId: cId,
          subjectId: s.id,
          assignedTeacherId: assignedT,
          periodsPerWeek: 5,
          isElective: false,
        })
        .returning();
      classSubjectRecords.push({ classId: cId, subjectId: s.id, id: cs!.id, subjectName: s.name });
    }
  }

  // Insert section_subject_teachers for every section and subject
  for (const sec of allSections) {
    const secKey = `${sec.className}-${sec.sectionName}`;
    const cSubs = classSubjectRecords.filter((cs) => cs.classId === sec.classId);

    for (const cs of cSubs) {
      const assignedTeacher = getTeacherForSubject(cs.subjectName, secKey);
      await db.insert(sectionSubjectTeachers).values({
        schoolId,
        academicYearId,
        classSubjectId: cs.id,
        sectionId: sec.id,
        teacherId: assignedTeacher,
        periodsPerWeek: 5,
        isPrimary: true,
        effectiveFrom: "2026-04-01",
        isActive: true,
      });
    }
  }

  // 10. Timetable Periods (Mon-Sat, 8 Periods)
  const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
  const timetableRows: any[] = [];

  for (const sec of allSections) {
    const secKey = `${sec.className}-${sec.sectionName}`;
    const cSubs = classSubjectRecords.filter((cs) => cs.classId === sec.classId);

    for (let dIdx = 0; dIdx < weekdays.length; dIdx++) {
      const day = weekdays[dIdx]!;
      for (let pIdx = 0; pIdx < bellSchedules.length; pIdx++) {
        const b = bellSchedules[pIdx]!;
        // Distribute subjects across periods
        const sub = cSubs[(pIdx + dIdx) % cSubs.length]!;
        let teacherForPeriod = getTeacherForSubject(sub.subjectName, secKey);

        // Guarantee Priya Sharma has rich periods on Thursday & all days:
        // Period 1 on Class 10-A, Period 2 on Class 9-A, Period 4 on Class 10-B, Period 6 on Class 8-A
        if (sec.className === "Class 10" && sec.sectionName === "A" && b.periodNumber === 1) {
          teacherForPeriod = primaryTeacherUserId;
        } else if (sec.className === "Class 9" && sec.sectionName === "A" && b.periodNumber === 2) {
          teacherForPeriod = primaryTeacherUserId;
        } else if (sec.className === "Class 10" && sec.sectionName === "B" && b.periodNumber === 4) {
          teacherForPeriod = primaryTeacherUserId;
        } else if (sec.className === "Class 8" && sec.sectionName === "A" && b.periodNumber === 6) {
          teacherForPeriod = primaryTeacherUserId;
        }

        timetableRows.push({
          schoolId,
          academicYearId,
          classId: sec.classId,
          sectionId: sec.id,
          subjectId: sub.subjectId,
          teacherId: teacherForPeriod,
          dayOfWeek: day,
          periodNumber: b.periodNumber,
          startTime: b.startTime,
          endTime: b.endTime,
          roomNumber: sec.className.replace("Class ", "Room ") + (sec.sectionName === "A" ? "01" : "02"),
          isActive: true,
        });
      }
    }
  }

  for (const chunk of chunkArray(timetableRows, 250)) {
    await db.insert(timetablePeriods).values(chunk);
  }

  // 11. Curriculum: Syllabus Units, Chapters & Topics
  const targetSection10A = allSections.find((s) => s.className === "Class 10" && s.sectionName === "A") || allSections[0]!;
  const class10MathSub = classSubjectRecords.find((cs) => cs.classId === targetSection10A.classId && cs.subjectName.toLowerCase().includes("math")) || classSubjectRecords[0]!;

  const [unit1] = await db
    .insert(syllabusUnits)
    .values({
      schoolId,
      classSubjectId: class10MathSub.id,
      academicTermId: term1!.id,
      name: "Unit 1: Number Systems",
      sortOrder: 1,
      isActive: true,
    })
    .returning();

  const [chap1] = await db
    .insert(syllabusChapters)
    .values({
      schoolId,
      unitId: unit1!.id,
      name: "Chapter 1: Real Numbers",
      sortOrder: 1,
      isActive: true,
    })
    .returning();

  const [top1_1] = await db
    .insert(syllabusTopics)
    .values({
      schoolId,
      chapterId: chap1!.id,
      name: "1.1 Fundamental Theorem of Arithmetic",
      sortOrder: 1,
      estimatedPeriods: 3,
      isActive: true,
    })
    .returning();

  const [unit2] = await db
    .insert(syllabusUnits)
    .values({
      schoolId,
      classSubjectId: class10MathSub.id,
      academicTermId: term2!.id,
      name: "Unit 2: Algebra & Quadratic Equations",
      sortOrder: 2,
      isActive: true,
    })
    .returning();

  const [chap2] = await db
    .insert(syllabusChapters)
    .values({
      schoolId,
      unitId: unit2!.id,
      name: "Chapter 4: Quadratic Equations",
      sortOrder: 1,
      isActive: true,
    })
    .returning();

  const [top2_1] = await db
    .insert(syllabusTopics)
    .values({
      schoolId,
      chapterId: chap2!.id,
      name: "4.1 Factorization and Completing Square",
      sortOrder: 1,
      estimatedPeriods: 4,
      isActive: true,
    })
    .returning();

  const [top2_2] = await db
    .insert(syllabusTopics)
    .values({
      schoolId,
      chapterId: chap2!.id,
      name: "4.2 Nature of Roots & Discriminant Analysis",
      sortOrder: 2,
      estimatedPeriods: 3,
      isActive: true,
    })
    .returning();

  // 12. Lesson Plans
  await db.insert(lessonPlans).values([
    {
      schoolId,
      classSubjectId: class10MathSub.id,
      teacherId: primaryTeacherUserId,
      syllabusTopicId: top1_1!.id,
      title: "Real Numbers & Fundamental Theorem of Arithmetic",
      chapterName: "Real Numbers",
      objectives: "Apply unique prime factorization to derive LCM and HCF of composite integers.",
      status: "COMPLETED",
      completedDate: new Date("2026-10-15T10:00:00Z"),
      plannedDate: new Date("2026-10-14T08:00:00Z"),
      homework: "Complete NCERT Exercise 1.2 questions 1-5 in homework register.",
    },
    {
      schoolId,
      classSubjectId: class10MathSub.id,
      teacherId: primaryTeacherUserId,
      syllabusTopicId: top2_1!.id,
      title: "Quadratic Equations — Solution by Factorization",
      chapterName: "Quadratic Equations",
      objectives: "Factorize quadratic trinomials ax^2 + bx + c by splitting middle term.",
      status: "COMPLETED",
      completedDate: new Date("2026-11-12T10:00:00Z"),
      plannedDate: new Date("2026-11-11T08:00:00Z"),
      homework: "Solve NCERT Exercise 4.2 problem set.",
    },
    {
      schoolId,
      classSubjectId: class10MathSub.id,
      teacherId: primaryTeacherUserId,
      syllabusTopicId: top2_2!.id,
      title: "Nature of Roots & Discriminant Applications",
      chapterName: "Quadratic Equations",
      objectives: "Compute discriminant D = b^2 - 4ac and classify real, distinct, or equal roots.",
      status: "IN_PROGRESS",
      plannedDate: new Date("2026-11-26T08:00:00Z"),
      homework: "NCERT Exercise 4.4 Questions 1 through 3.",
    },
    {
      schoolId,
      classSubjectId: class10MathSub.id,
      teacherId: primaryTeacherUserId,
      title: "Introduction to Arithmetic Progressions",
      chapterName: "Arithmetic Progressions",
      objectives: "Understand common difference d and nth term formula a_n = a + (n-1)d.",
      status: "PLANNED",
      plannedDate: new Date("2026-12-04T08:00:00Z"),
    },
  ]);

  // 13. Students & Families (15 students in top classes, 10 in others)
  interface StudentRecord {
    id: string;
    admissionNumber: string;
    sectionId: string;
    classId: string;
    firstName: string;
    lastName: string;
    studentUserId: string;
    parentUserId: string;
  }
  const allStudents: StudentRecord[] = [];
  let studentSeq = 1;

  for (const sec of allSections) {
    const studentCount = sec.className.includes("Class 10") || sec.className.includes("Class 9") ? 15 : 10;

    for (let roll = 1; roll <= studentCount; roll++) {
      const idx = studentSeq++;
      const isBoy = idx % 2 === 1;
      const fnList = isBoy ? INDIAN_FIRST_NAMES_BOYS : INDIAN_FIRST_NAMES_GIRLS;
      const fn = fnList[idx % fnList.length]!;
      const ln = INDIAN_LAST_NAMES[idx % INDIAN_LAST_NAMES.length]!;
      const admNo = `${config.code}-2026-${String(idx).padStart(4, "0")}`;

      const birthYear = 2021 - sec.gradeOrder;
      const dob = new Date(Date.UTC(birthYear, idx % 12, ((idx * 5) % 27) + 1));

      // Designated demo flagship student (Aarav Sharma in Class 10-A, Roll #1)
      const isFlagshipStudent = sec.id === targetSection10A.id && roll === 1;
      const studentEmail = isFlagshipStudent
        ? (isFlagship ? "student@demo.schoolos.io" : `student.${config.domainPrefix}@demo.schoolos.io`)
        : `student.${config.domainPrefix}.${idx}@demo.schoolos.io`;
      const parentEmail = isFlagshipStudent
        ? (isFlagship ? "parent@demo.schoolos.io" : `parent.${config.domainPrefix}@demo.schoolos.io`)
        : `parent.${config.domainPrefix}.${idx}@demo.schoolos.io`;

      // 1. Parent User
      const [parentUser] = await db
        .insert(users)
        .values({
          schoolId,
          email: parentEmail.toLowerCase(),
          passwordHash: DEFAULT_PASSWORD_HASH,
          mobileEncrypted: encryptData(`9811${String(200000 + idx).slice(-6)}`),
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
        })
        .returning();

      await db.insert(userRoles).values({
        schoolId,
        userId: parentUser!.id,
        roleId: roleMap.get("PARENT")!,
      });

      await db.insert(persons).values({
        schoolId,
        userId: parentUser!.id,
        primaryType: "PARENT",
        firstNameEncrypted: encryptData("Guardian"),
        lastNameEncrypted: encryptData(ln),
        firstNameSearchHash: computeSearchHash("Guardian"),
        lastNameSearchHash: computeSearchHash(ln),
        gender: "OTHER",
        isActive: true,
      });

      // 2. Student User
      const [stuUser] = await db
        .insert(users)
        .values({
          schoolId,
          email: studentEmail.toLowerCase(),
          passwordHash: DEFAULT_PASSWORD_HASH,
          mobileEncrypted: encryptData(`9811${String(300000 + idx).slice(-6)}`),
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
        })
        .returning();

      await db.insert(userRoles).values({
        schoolId,
        userId: stuUser!.id,
        roleId: roleMap.get("STUDENT")!,
      });

      await db.insert(persons).values({
        schoolId,
        userId: stuUser!.id,
        primaryType: "STUDENT",
        firstNameEncrypted: encryptData(fn),
        lastNameEncrypted: encryptData(ln),
        firstNameSearchHash: computeSearchHash(fn),
        lastNameSearchHash: computeSearchHash(ln),
        gender: isBoy ? "MALE" : "FEMALE",
        dateOfBirth: dob,
        isActive: true,
      });

      // 3. Student Record
      const [stRecord] = await db
        .insert(students)
        .values({
          schoolId,
          academicYearId,
          admissionNumber: admNo,
          firstNameEncrypted: encryptData(fn),
          lastNameEncrypted: encryptData(ln),
          firstNameSearchHash: computeSearchHash(fn),
          lastNameSearchHash: computeSearchHash(ln),
          namePrefixHashes: computeNamePrefixHashes(fn, ln),
          dateOfBirth: dob,
          gender: isBoy ? "MALE" : "FEMALE",
          category: idx % 8 === 0 ? "OBC" : "GENERAL",
          state: config.state,
          district: config.city,
          pincode: config.pincode,
          aadhaarLast4: String(1000 + (idx % 9000)),
          currentClassId: sec.classId,
          currentSectionId: sec.id,
          userId: stuUser!.id,
          primaryParentUserId: parentUser!.id,
          admissionDate: new Date("2026-04-01T00:00:00Z"),
          isActive: true,
          rollNumber: String(roll),
        })
        .returning();

      allStudents.push({
        id: stRecord!.id,
        admissionNumber: admNo,
        sectionId: sec.id,
        classId: sec.classId,
        firstName: fn,
        lastName: ln,
        studentUserId: stuUser!.id,
        parentUserId: parentUser!.id,
      });

      // 4. Family & Class History
      await db.insert(studentFamilyMembers).values({
        schoolId,
        studentId: stRecord!.id,
        userId: parentUser!.id,
        relation: isBoy ? "FATHER" : "MOTHER",
        nameEncrypted: encryptData(`${isBoy ? "Mr. " : "Mrs. "}${ln}`),
        isPrimaryContact: true,
        isEmergencyContact: true,
      });

      await db.insert(studentClassHistory).values({
        schoolId,
        studentId: stRecord!.id,
        academicYearId,
        classId: sec.classId,
        sectionId: sec.id,
        rollNumber: String(roll),
        promotionStatus: "PROMOTED",
      });
    }
  }

  // 13b. Map ALL Students to ALL Class Subjects (student_subject_enrollments)
  const enrollmentRows: any[] = [];
  for (const st of allStudents) {
    const cSubs = classSubjectRecords.filter((cs) => cs.classId === st.classId);
    for (const cs of cSubs) {
      enrollmentRows.push({
        schoolId,
        studentId: st.id,
        classSubjectId: cs.id,
        isElectiveTaken: true,
        enrollmentStatus: "ACTIVE",
      });
    }
  }
  for (const chunk of chunkArray(enrollmentRows, 300)) {
    await db.insert(studentSubjectEnrollments).values(chunk);
  }

  // 14. 45 Days of Past Attendance History
  const attendanceRows: any[] = [];
  const baseDate = new Date("2026-10-01T08:30:00Z");

  for (let dayOffset = 0; dayOffset < 56; dayOffset++) {
    const curDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    // Skip Sundays
    if (curDate.getUTCDay() === 0) continue;

    for (const st of allStudents) {
      const hash = (st.id.charCodeAt(0) + dayOffset * 17) % 100;
      const status = hash < 93 ? "PRESENT" : hash < 97 ? "ABSENT" : "LATE";

      attendanceRows.push({
        schoolId,
        studentId: st.id,
        sectionId: st.sectionId,
        academicYearId,
        attendanceDate: curDate,
        status,
        source: "ROUTINE",
        markedById: primaryTeacherUserId || st.studentUserId,
      });
    }
  }

  for (const chunk of chunkArray(attendanceRows, 300)) {
    await db.insert(studentAttendance).values(chunk);
  }

  // Mark today's attendance (2026-11-26) for Class 10-B and Class 9-A (leaving Class 10-A pending for Priya Sharma)
  const todayDate = new Date("2026-11-26T08:30:00Z");
  const todayMarkedSections = allSections.filter(
    (s) => (s.className === "Class 10" && s.sectionName === "B") || (s.className === "Class 9" && s.sectionName === "A")
  );
  const todayRows: any[] = [];
  for (const sec of todayMarkedSections) {
    const secStudents = allStudents.filter((st) => st.sectionId === sec.id);
    for (let idx = 0; idx < secStudents.length; idx++) {
      const st = secStudents[idx]!;
      todayRows.push({
        schoolId,
        studentId: st.id,
        sectionId: st.sectionId,
        academicYearId,
        attendanceDate: todayDate,
        status: idx % 15 === 0 ? "ABSENT" : "PRESENT",
        source: "ROUTINE",
        markedById: sec.classTeacherId || primaryTeacherUserId,
      });
    }
  }
  if (todayRows.length > 0) {
    await db.insert(studentAttendance).values(todayRows);
  }

  // 15. Homework Assignments & Submissions (Populates Teacher Gradebook!)
  const [hw1] = await db
    .insert(assignments)
    .values({
      schoolId,
      classSubjectId: class10MathSub.id,
      sectionId: targetSection10A.id,
      createdByTeacherId: primaryTeacherUserId,
      title: "Quadratic Equations — NCERT Exercise 4.3 & Exemplar",
      description: "Solve problems 1 through 10 from Chapter 4. Submit detailed proofs and step-by-step working.",
      maxMarks: 20,
      dueDate: new Date("2026-11-26T23:59:59Z"), // Due today!
      status: "PUBLISHED",
    })
    .returning();

  const [hw2] = await db
    .insert(assignments)
    .values({
      schoolId,
      classSubjectId: class10MathSub.id,
      sectionId: targetSection10A.id,
      createdByTeacherId: primaryTeacherUserId,
      title: "Discriminant & Nature of Roots Worksheet",
      description: "Classify roots for the 8 quadratic equations and find unknown parameter k.",
      maxMarks: 15,
      dueDate: new Date("2026-11-29T23:59:59Z"),
      status: "PUBLISHED",
    })
    .returning();

  const [hw3] = await db
    .insert(assignments)
    .values({
      schoolId,
      classSubjectId: class10MathSub.id,
      sectionId: targetSection10A.id,
      createdByTeacherId: primaryTeacherUserId,
      title: "Linear Equations in Two Variables Review Set",
      description: "Solve elimination and substitution systems with graphical verification.",
      maxMarks: 25,
      dueDate: new Date("2026-11-10T23:59:59Z"),
      status: "CLOSED",
    })
    .returning();

  // Submissions for Class 10-A
  const sec10Students = allStudents.filter((s) => s.sectionId === targetSection10A.id);

  // hw1: 10 submitted (pending grading)
  for (let i = 0; i < 10; i++) {
    const st = sec10Students[i]!;
    await db.insert(assignmentSubmissions).values({
      schoolId,
      assignmentId: hw1!.id,
      studentId: st.id,
      submittedAt: new Date("2026-11-26T07:30:00Z"),
      studentContent: "Attached solutions for Exercise 4.3 with discriminant calculations.",
    });
  }

  // hw3: All 15 evaluated with grades
  for (let i = 0; i < sec10Students.length; i++) {
    const st = sec10Students[i]!;
    const marks = 19 + (i % 6);
    await db.insert(assignmentSubmissions).values({
      schoolId,
      assignmentId: hw3!.id,
      studentId: st.id,
      marksAwarded: marks,
      remarks: "Thorough algebraic manipulation and accurate graphical checks.",
      gradedByTeacherId: primaryTeacherUserId,
      gradedAt: new Date("2026-11-12T14:00:00Z"),
      submittedAt: new Date("2026-11-09T18:00:00Z"),
      studentContent: "Complete homework notebook scans for Chapter 3 review.",
    });
  }

  // 16. PARAKH Question Bank & Question Papers (Fixes Question Bank!)
  const qbQuestions = [
    {
      text: "If one zero of the quadratic polynomial x^2 + 3x + k is 2, then find the value of k.",
      type: "MCQ" as const,
      difficulty: "EASY" as const,
      cog: "REMEMBER" as const,
      marks: "1.00",
      opt: [
        { key: "A", text: "10" },
        { key: "B", text: "-10" },
        { key: "C", text: "-7" },
        { key: "D", text: "-2" },
      ],
      ans: "B",
      exp: "Substituting x = 2: 2^2 + 3(2) + k = 0 => 4 + 6 + k = 0 => k = -10.",
      tag: "CBSE-MAT-10-ALG-01",
    },
    {
      text: "Find the discriminant of the quadratic equation 2x^2 - 4x + 3 = 0 and describe the nature of its roots.",
      type: "SA" as const,
      difficulty: "MEDIUM" as const,
      cog: "APPLY" as const,
      marks: "2.00",
      ans: "Discriminant D = -8. Since D < 0, the equation has no real roots (two distinct imaginary roots).",
      exp: "D = b^2 - 4ac = (-4)^2 - 4(2)(3) = 16 - 24 = -8 < 0.",
      tag: "CBSE-MAT-10-ALG-02",
    },
    {
      text: "Prove that the lengths of tangents drawn from an external point to a circle are equal.",
      type: "LA" as const,
      difficulty: "HARD" as const,
      cog: "ANALYZE" as const,
      marks: "5.00",
      ans: "Proof using RHS congruence of triangles formed by circle center, external point, and points of contact.",
      exp: "In right triangles OAP and OBP, OA = OB (radii), OP is common, and angle OAP = angle OBP = 90 deg. Thus triangles are congruent by RHS.",
      tag: "CBSE-MAT-10-GEO-01",
    },
    {
      text: "The sum of the digits of a two-digit number is 9. Also, nine times this number is twice the number obtained by reversing the order of the digits. Find the number.",
      type: "LA" as const,
      difficulty: "MEDIUM" as const,
      cog: "APPLY" as const,
      marks: "3.00",
      ans: "The number is 18.",
      exp: "Let digits be x and y. x + y = 9 and 9(10x + y) = 2(10y + x) => 90x + 9y = 20y + 2x => 88x = 11y => y = 8x. Substituting gives x=1, y=8.",
      tag: "CBSE-MAT-10-ALG-03",
    },
    {
      text: "Which of the following is not a quadratic equation?",
      type: "MCQ" as const,
      difficulty: "EASY" as const,
      cog: "UNDERSTAND" as const,
      marks: "1.00",
      opt: [
        { key: "A", text: "2(x - 1)^2 = 4x^2 - 2x + 1" },
        { key: "B", text: "2x - x^2 = x^2 + 5" },
        { key: "C", text: "(sqrt(2)x + sqrt(3))^2 + x^2 = 3x^2 - 5x" },
        { key: "D", text: "(x^2 + 2x)^2 = x^4 + 3 + 4x^3" },
      ],
      ans: "C",
      exp: "In option C, expanding (sqrt(2)x + sqrt(3))^2 + x^2 gives 2x^2 + ... + x^2 = 3x^2. The 3x^2 terms cancel out on both sides, leaving a linear equation.",
      tag: "CBSE-MAT-10-ALG-04",
    },
  ];

  const qbIds: string[] = [];
  for (const q of qbQuestions) {
    const [insertedQ] = await db
      .insert(questionBank)
      .values({
        schoolId,
        board: config.board,
        academicYearId,
        classId: targetSection10A.classId,
        subjectId: class10MathSub.subjectId,
        syllabusChapterId: chap2!.id,
        syllabusTopicId: top2_2!.id,
        learningOutcome: "Analyze quadratic coefficients and predict root properties",
        questionType: q.type,
        questionText: q.text,
        optionsJson: q.opt ? (q.opt as any) : null,
        correctAnswer: q.ans,
        markingScheme: "Step-wise marking scheme per CBSE rubrics",
        explanation: q.exp,
        maxMarks: q.marks,
        difficulty: q.difficulty,
        cognitiveLevel: q.cog,
        competencyTag: q.tag,
        language: "en",
        createdById: primaryTeacherUserId,
        reviewStatus: "APPROVED",
      })
      .returning();
    qbIds.push(insertedQ!.id);
  }

  // Question Papers
  const [qp1] = await db
    .insert(questionPapers)
    .values({
      schoolId,
      classId: targetSection10A.classId,
      subjectId: class10MathSub.subjectId,
      title: "Class 10 Mathematics Pre-Board Mock Examination 2026-27",
      setCode: "A",
      totalMarks: 80,
      durationMinutes: 180,
      status: "APPROVED",
      version: 1,
      createdById: primaryTeacherUserId,
      approvedById: principalUserId || primaryTeacherUserId,
    })
    .returning();

  const [qp2] = await db
    .insert(questionPapers)
    .values({
      schoolId,
      classId: targetSection10A.classId,
      subjectId: class10MathSub.subjectId,
      title: "Class 10 Mathematics Unit Test 2 Assessment Paper",
      setCode: "B",
      totalMarks: 40,
      durationMinutes: 90,
      status: "DRAFT",
      version: 1,
      createdById: primaryTeacherUserId,
    })
    .returning();

  for (let idx = 0; idx < qbIds.length; idx++) {
    await db.insert(questionPaperItems).values({
      schoolId,
      questionPaperId: qp1!.id,
      questionId: qbIds[idx]!,
      sectionLabel: idx < 2 ? "Section A (Objective)" : "Section B (Subjective)",
      orderIndex: idx + 1,
      marks: qbQuestions[idx]!.marks,
      isOptional: false,
    });
    if (idx < 3) {
      await db.insert(questionPaperItems).values({
        schoolId,
        questionPaperId: qp2!.id,
        questionId: qbIds[idx]!,
        sectionLabel: "Section A",
        orderIndex: idx + 1,
        marks: qbQuestions[idx]!.marks,
        isOptional: false,
      });
    }
  }

  // 17. Examinations & Scholastic Gradebook
  const [examType] = await db
    .insert(examTypes)
    .values({
      schoolId,
      name: "Mid-Term Examination",
      code: "MID-TERM",
      examType: "HALF_YEARLY",
      weightagePercent: "30.00",
    })
    .returning();

  const [preBoardType] = await db
    .insert(examTypes)
    .values({
      schoolId,
      name: "Pre-Board Examination",
      code: "PRE-BOARD",
      examType: "PRE_BOARD",
      weightagePercent: "40.00",
    })
    .returning();

  const [exam] = await db
    .insert(exams)
    .values({
      schoolId,
      academicYearId,
      examTypeId: examType!.id,
      name: "Mid-Term Assessment 2026",
      startDate: new Date("2026-09-15T09:00:00Z"),
      endDate: new Date("2026-09-25T13:00:00Z"),
      isLocked: true,
    })
    .returning();

  const [preBoardExam] = await db
    .insert(exams)
    .values({
      schoolId,
      academicYearId,
      examTypeId: preBoardType!.id,
      name: "Pre-Board Examination 2026-27",
      startDate: new Date("2026-11-24T09:00:00Z"),
      endDate: new Date("2026-12-05T13:00:00Z"),
      isLocked: false,
    })
    .returning();

  const [examComp] = await db
    .insert(examComponents)
    .values({
      schoolId,
      examId: exam!.id,
      examTypeId: examType!.id,
      displayName: "Written Theory Paper",
      sortOrder: 1,
    })
    .returning();

  const [preBoardComp] = await db
    .insert(examComponents)
    .values({
      schoolId,
      examId: preBoardExam!.id,
      examTypeId: preBoardType!.id,
      displayName: "Board Pattern Theory Paper",
      sortOrder: 1,
    })
    .returning();

  // Class Scopes for Classes 6-10
  for (const clsId of uniqueClassIds.slice(5)) {
    await db.insert(examClassScopes).values([
      { schoolId, examId: exam!.id, classId: clsId },
      { schoolId, examId: preBoardExam!.id, classId: clsId },
    ]);
  }

  // Schedules & Marks across ALL subjects for Class 10
  const class10Subs = classSubjectRecords.filter((cs) => cs.classId === targetSection10A.classId);
  const sec10B = allSections.find((s) => s.className === "Class 10" && s.sectionName === "B");
  const sec10AllStudents = allStudents.filter(
    (s) => s.sectionId === targetSection10A.id || (sec10B && s.sectionId === sec10B.id)
  );

  for (let sIdx = 0; sIdx < class10Subs.length; sIdx++) {
    const cs = class10Subs[sIdx]!;
    const examDay = String(15 + sIdx).padStart(2, "0");

    await db.insert(examSchedules).values([
      {
        schoolId,
        examId: exam!.id,
        subjectId: cs.subjectId,
        classId: targetSection10A.classId,
        examDate: `2026-09-${examDay}`,
        startTime: "09:00:00",
        durationMinutes: 180,
        maxMarks: "80.00",
        passingMarks: "28.00",
      },
      {
        schoolId,
        examId: preBoardExam!.id,
        subjectId: cs.subjectId,
        classId: targetSection10A.classId,
        examDate: `2026-11-${String(24 + sIdx).padStart(2, "0")}`,
        startTime: "09:00:00",
        durationMinutes: 180,
        maxMarks: "80.00",
        passingMarks: "28.00",
      },
    ]);

    await db.insert(examMarksLocks).values({
      schoolId,
      examId: exam!.id,
      classId: targetSection10A.classId,
      subjectId: cs.subjectId,
      status: "LOCKED",
      submittedById: primaryTeacherUserId,
      submittedAt: new Date("2026-09-28T14:00:00Z"),
      lockedById: principalUserId || primaryTeacherUserId,
      lockedAt: new Date("2026-09-29T10:00:00Z"),
    });

    for (let m = 0; m < sec10AllStudents.length; m++) {
      const st = sec10AllStudents[m]!;
      const marks = 58 + ((m * 3 + sIdx * 5) % 21);
      await db.insert(markEntries).values({
        schoolId,
        examId: exam!.id,
        studentId: st.id,
        subjectId: cs.subjectId,
        componentId: examComp!.id,
        marksObtained: String(marks),
        maxMarks: "80.00",
        status: "LOCKED",
        enteredById: primaryTeacherUserId,
        isAbsent: false,
      });
    }
  }

  // Report Cards for Class 10-A
  for (let m = 0; m < sec10Students.length; m++) {
    const st = sec10Students[m]!;
    const pct = 78 + (m % 18);
    const grade = pct >= 90 ? "A1" : pct >= 80 ? "A2" : "B1";
    await db.insert(reportCards).values({
      schoolId,
      studentId: st.id,
      academicYearId,
      examId: exam!.id,
      gradeData: { percentage: pct, totalObtained: Math.round(pct * 4.8), totalMax: 480 },
      overallGrade: grade,
      rank: m + 1,
      attendancePercent: "94.50",
      teacherRemarks: "Consistent academic diligence and active classroom participation.",
      principalRemarks: "Commendable progress in Term 1 assessments.",
    });

    await db.insert(homeroomReportRemarks).values({
      schoolId,
      studentId: st.id,
      academicYearId,
      academicTermId: term1!.id,
      remarks: "Demonstrates strong analytical skills and collaborative spirit in class.",
      conductGrade: m % 3 === 0 ? "A+" : "A",
      signedOffById: primaryTeacherUserId,
    });
  }

  // 17b. Exam Mark Distributions, Grade Rules & Co-curricular Grades
  for (const cs of class10Subs) {
    await db.insert(examMarkDistributions).values([
      {
        schoolId,
        examId: exam!.id,
        classId: targetSection10A.classId,
        subjectId: cs.subjectId,
        componentId: examComp!.id,
        maxMarks: "80.00",
        passingMarks: "28.00",
      },
      {
        schoolId,
        examId: preBoardExam!.id,
        classId: targetSection10A.classId,
        subjectId: cs.subjectId,
        componentId: preBoardComp!.id,
        maxMarks: "80.00",
        passingMarks: "28.00",
      },
    ]);
  }

  const cbseGrades = [
    { min: "91.00", max: "100.00", grade: "A1", gp: "10.0", desc: "Outstanding" },
    { min: "81.00", max: "90.99", grade: "A2", gp: "9.0", desc: "Excellent" },
    { min: "71.00", max: "80.99", grade: "B1", gp: "8.0", desc: "Very Good" },
    { min: "61.00", max: "70.99", grade: "B2", gp: "7.0", desc: "Good" },
    { min: "51.00", max: "60.99", grade: "C1", gp: "6.0", desc: "Fair" },
    { min: "41.00", max: "50.99", grade: "C2", gp: "5.0", desc: "Average" },
    { min: "33.00", max: "40.99", grade: "D", gp: "4.0", desc: "Pass" },
    { min: "0.00", max: "32.99", grade: "E", gp: "0.0", desc: "Needs Improvement" },
  ];
  for (const grp of ["CLASS_6_8", "CLASS_9_10"] as const) {
    for (const g of cbseGrades) {
      await db.insert(gradeRules).values({
        schoolId,
        classGroup: grp,
        minPercent: g.min,
        maxPercent: g.max,
        grade: g.grade,
        gradePoint: g.gp,
        description: g.desc,
        isActive: true,
      });
    }
  }

  const cocurricularNames = ["Work Education", "Art Education", "Health & Physical Education", "Discipline"];
  const cocurrAreaIds: string[] = [];
  for (const cName of cocurricularNames) {
    const [area] = await db
      .insert(cocurricularAreas)
      .values({ schoolId, name: cName, isActive: true })
      .returning();
    cocurrAreaIds.push(area!.id);
  }
  for (const st of sec10Students) {
    for (const areaId of cocurrAreaIds) {
      await db.insert(cocurricularGrades).values({
        schoolId,
        examId: exam!.id,
        studentId: st.id,
        areaId,
        grade: "A",
        remark: "Active participation",
        gradedById: primaryTeacherUserId,
      });
    }
  }

  // 18. Timetable Substitutions Workbench
  const period7For9B = timetableRows.find(
    (t) => t.periodNumber === 7 && t.dayOfWeek === "THURSDAY" && t.classId !== targetSection10A.classId,
  );
  if (period7For9B) {
    const periodInDb = await db.query.timetablePeriods.findFirst({
      where: eq(timetablePeriods.schoolId, schoolId),
    });
    if (periodInDb) {
      await db.insert(timetableSubstitutions).values({
        schoolId,
        academicYearId,
        date: "2026-11-26",
        timetablePeriodId: periodInDb.id,
        sectionId: periodInDb.sectionId,
        originalTeacherId: teacherMap.get("Vikram") || primaryTeacherUserId,
        substituteTeacherId: primaryTeacherUserId,
        subjectId: periodInDb.subjectId,
        reason: "Faculty member on medical leave — assigned covering teacher",
        status: "PENDING",
      });
    }
  }

  // 19. Fees & Invoices & Payment Terminal
  const [tuitionHead] = await db
    .insert(feeHeads)
    .values({
      schoolId,
      name: "Term Tuition Fee",
      code: "TUIT",
      headType: "TUITION",
      category: "RECURRING",
      priority: 1,
      isActive: true,
    })
    .returning();

  const [annualHead] = await db
    .insert(feeHeads)
    .values({
      schoolId,
      name: "Annual Activity & Development",
      code: "DEV",
      headType: "ACTIVITY",
      category: "ONE_TIME",
      priority: 2,
      isActive: true,
    })
    .returning();

  const feeStructMap = new Map<string, string>();
  for (const cId of uniqueClassIds) {
    const [feeStruct] = await db
      .insert(feeStructures)
      .values({
        schoolId,
        academicYearId,
        classId: cId,
        feeHeadId: tuitionHead!.id,
        amount: "28500.00",
        term: "QUARTERLY",
        dueDate: new Date("2026-05-15T00:00:00Z"),
        isActive: true,
      })
      .returning();
    feeStructMap.set(cId, feeStruct!.id);
  }

  let invoicesCount = 0;
  for (let i = 0; i < allStudents.length; i++) {
    const st = allStudents[i]!;
    const invNum = `INV-${config.code}-2026-${String(i + 1).padStart(4, "0")}`;
    const gross = 28500;

    // 70% Paid, 20% Partial (₹14,250 dues matching screenshot!), 10% Unpaid
    const isPaid = i % 10 < 7;
    const isPartial = i % 10 >= 7 && i % 10 < 9;
    const paidAmount = isPaid ? gross : isPartial ? 14250 : 0;
    const balance = gross - paidAmount;
    const invStatus = isPaid ? "PAID" : isPartial ? "PARTIAL" : "PENDING";

    const [inv] = await db
      .insert(feeInvoices)
      .values({
        invoiceNumber: invNum,
        schoolId,
        studentId: st.id,
        academicYearId,
        feeStructureId: (feeStructMap.get(st.classId) || feeStructMap.values().next().value) ?? null,
        grossAmount: String(gross),
        discountAmount: "0",
        netAmount: String(gross),
        paidAmount: String(paidAmount),
        balanceAmount: String(balance),
        status: invStatus as any,
        term: "QUARTERLY",
        dueDate: new Date("2026-11-30T00:00:00Z"),
      })
      .returning();

    invoicesCount++;

    if (paidAmount > 0) {
      await db.insert(feePayments).values({
        receiptNumber: `REC-${config.code}-2026-${String(i + 1).padStart(4, "0")}`,
        schoolId,
        studentId: st.id,
        feeInvoiceId: inv!.id,
        amountPaid: String(paidAmount),
        paymentMethod: i % 2 === 0 ? "UPI" : "CASH",
        transactionReference: `TXN${config.code}${Date.now().toString().slice(-6)}${i}`,
        paymentDate: new Date("2026-11-20T11:00:00Z"),
        collectedById: primaryTeacherUserId,
        status: "ACTIVE",
        remarks: isPaid ? "Full Quarter Tuition Cleared" : "Term 1 installment paid in cash",
      });
    }
  }

  // 19b. Fee Concessions & Parent Fee Queries
  if (allStudents.length >= 3) {
    await db.insert(feeConcessions).values([
      {
        schoolId,
        studentId: allStudents[1]!.id,
        academicYearId,
        concessionType: "MERIT_SCHOLARSHIP",
        concessionName: "Academic Excellence Merit Scholarship (15%)",
        appliesTo: "ALL",
        discountPercentage: "15.00",
        approvedById: principalUserId || primaryTeacherUserId,
        approvedAt: new Date("2026-04-10T10:00:00Z"),
        isActive: true,
      },
      {
        schoolId,
        studentId: allStudents[2]!.id,
        academicYearId,
        concessionType: "SIBLING",
        concessionName: "Sibling Concession (₹2,500)",
        appliesTo: "ALL",
        discountAmount: "2500.00",
        approvedById: principalUserId || primaryTeacherUserId,
        approvedAt: new Date("2026-04-12T10:00:00Z"),
        isActive: true,
      },
    ]);

    const partialInv = await db.query.feeInvoices.findFirst({
      where: eq(feeInvoices.schoolId, schoolId),
    });
    if (partialInv) {
      await db.insert(feeQueries).values({
        schoolId,
        studentId: allStudents[0]!.id,
        invoiceId: partialInv.id,
        parentUserId: allStudents[0]!.parentUserId,
        category: "BREAKDOWN",
        message: "Could you please confirm if the annual development fee is already included in the Q1 invoice?",
        status: "OPEN",
      });
    }
  }

  // 20. Notices & Circulars (Clean Plain-Text & Markdown)
  const sampleNotices = [
    {
      title: "Annual Sports Meet & Inter-House Athletics Schedule",
      content:
        "We are delighted to announce that the Annual Sports Championship will be held on the school athletic grounds on Saturday, 28 November 2026. Parents are warmly invited to cheer for the athletes.",
      audienceType: "ALL" as const,
      isPublished: true,
      isPinned: true,
    },
    {
      title: "Mid-Term Assessment Report Cards Published",
      content:
        "The Mid-Term Examination 2026 results have been finalized and published. Parents and students can review the detailed performance scorecard and teacher remarks in their portal.",
      audienceType: "PARENTS" as const,
      isPublished: true,
      isPinned: false,
    },
    {
      title: "Parent-Teacher Conference (PTM) Timing & Appointments",
      content:
        "The termly Parent-Teacher Meeting is scheduled for this coming Sunday, 29 November 2026. Individual time slots can be booked directly through the SchoolMitra Parent PWA.",
      audienceType: "PARENTS" as const,
      isPublished: true,
      isPinned: false,
    },
    {
      title: "Teacher Professional Development Workshop on Modern STEM Pedagogies",
      content:
        "A half-day hands-on pedagogical training workshop on PARAKH competency assessments will be conducted in the Multipurpose Hall this Friday afternoon.",
      audienceType: "TEACHERS" as const,
      isPublished: true,
      isPinned: false,
    },
    {
      title: "CBSE Class 10 Board Registration & Document Verification Drive",
      content:
        "All Class 10 students and guardians must verify LOC registration details including spellings, subject codes, and Aadhaar linkage before 30 November 2026.",
      audienceType: "STUDENTS" as const,
      isPublished: true,
      isPinned: true,
    },
  ];

  for (const n of sampleNotices) {
    await db.insert(notices).values({
      schoolId,
      title: n.title,
      content: n.content,
      audienceType: n.audienceType,
      isPublished: n.isPublished,
      isPinned: n.isPinned,
      createdById: primaryTeacherUserId,
      publishedAt: new Date("2026-11-15T10:00:00Z"),
    });
  }

  // 21. HR: Leave Types & Leave Requests
  const [clType] = await db
    .insert(leaveTypes)
    .values({ schoolId, code: "CL", name: "Casual Leave", maxDaysPerYear: 12, isPaid: true })
    .returning();
  const [mlType] = await db
    .insert(leaveTypes)
    .values({ schoolId, code: "ML", name: "Medical Leave", maxDaysPerYear: 10, isPaid: true })
    .returning();

  const vikramStaffId = staffIdByUserId.get(teacherMap.get("Vikram") || primaryTeacherUserId);
  const rajeshStaffId = staffIdByUserId.get(teacherMap.get("Rajesh") || primaryTeacherUserId);
  if (vikramStaffId && rajeshStaffId) {
    await db.insert(leaveRequests).values([
      {
        schoolId,
        staffId: vikramStaffId,
        leaveTypeId: mlType!.id,
        startDate: new Date("2026-11-26T00:00:00Z"),
        endDate: new Date("2026-11-26T00:00:00Z"),
        totalDays: "1.0",
        reason: "Medical checkup appointment",
        status: "HOD_APPROVED",
        hodApprovedById: principalUserId || primaryTeacherUserId,
        hodApprovedAt: new Date("2026-11-25T16:00:00Z"),
      },
      {
        schoolId,
        staffId: rajeshStaffId,
        leaveTypeId: clType!.id,
        startDate: new Date("2026-12-03T00:00:00Z"),
        endDate: new Date("2026-12-04T00:00:00Z"),
        totalDays: "2.0",
        reason: "Family wedding outstation travel",
        status: "PENDING",
      },
    ]);
  }

  // 22. Accounts: Bank Accounts, Income/Expense Heads & Vouchers
  const [mainBank] = await db
    .insert(bankAccounts)
    .values({
      schoolId,
      bankName: "HDFC Bank",
      accountName: `${config.name} Operating Account`,
      accountNumber: `502000${config.udiseCode.slice(-6)}`,
      ifscCode: "HDFC0001245",
      branchName: config.city,
      openingBalance: "2500000.00",
      currentBalance: "4285000.00",
      isActive: true,
    })
    .returning();

  const [incHead] = await db
    .insert(incomeHeads)
    .values({ schoolId, name: "Annual Campus Event Sponsorship", code: "INC-SPON", isActive: true })
    .returning();
  const [expHead] = await db
    .insert(expenseHeads)
    .values({ schoolId, name: "Science Lab & STEM Equipment", code: "EXP-LAB", isActive: true })
    .returning();

  await db.insert(incomeVouchers).values({
    schoolId,
    voucherNumber: `IV-${config.code}-001`,
    incomeHeadId: incHead!.id,
    bankAccountId: mainBank!.id,
    amount: "150000.00",
    paymentMode: "NEFT",
    transactionReference: "HDFCN2026111001",
    remarks: "Alumni Association STEM Lab Grant",
    createdById: accountantUserId || primaryTeacherUserId,
  });

  await db.insert(expenseVouchers).values({
    schoolId,
    voucherNumber: `EV-${config.code}-001`,
    expenseHeadId: expHead!.id,
    bankAccountId: mainBank!.id,
    vendorName: "Bharat Scientific Instruments Pvt Ltd",
    amount: "64500.00",
    paymentMode: "NEFT",
    transactionReference: "HDFCN2026111509",
    status: "APPROVED",
    approvedById: principalUserId || primaryTeacherUserId,
    approvedAt: new Date("2026-11-16T11:00:00Z"),
    remarks: "Physics optical benches and chemistry glassware replenishment",
    createdById: accountantUserId || primaryTeacherUserId,
  });

  // 23. Transport: Vehicles, Routes, Stops & Student Bus Passes
  const [bus1] = await db
    .insert(vehicles)
    .values({
      schoolId,
      busNumber: "BUS-01",
      registrationNumber: "DL-1PC-4821",
      capacity: 42,
      make: "Tata",
      model: "Starbus Ultra",
      yearOfManufacture: 2024,
      driverNameEncrypted: encryptData("Suresh Yadav"),
      driverMobileEncrypted: encryptData("9811000881"),
    })
    .returning();

  const [route1] = await db
    .insert(routes)
    .values({
      schoolId,
      vehicleId: bus1!.id,
      routeName: "Route 1 — South Campus Express",
      routeCode: "R-01",
      isActive: true,
    })
    .returning();

  const [stop1] = await db
    .insert(routeStops)
    .values({
      schoolId,
      routeId: route1!.id,
      stopName: "Sector B Main Gate",
      stopOrder: 1,
      estimatedArrivalTime: "07:20",
    })
    .returning();

  for (let i = 0; i < Math.min(10, allStudents.length); i++) {
    const st = allStudents[i]!;
    await db.insert(studentBusPasses).values({
      schoolId,
      studentId: st.id,
      routeId: route1!.id,
      routeStopId: stop1!.id,
      passNumber: `BP-${config.code}-${String(i + 1).padStart(4, "0")}`,
      validFrom: new Date("2026-04-01T00:00:00Z"),
      validTo: new Date("2027-03-31T23:59:59Z"),
      qrCodeData: `SM-BUS:${config.code}:${st.admissionNumber}`,
      isActive: true,
    });
  }

  // 24. Library: Books, Copies, Members & Issues
  const [book1] = await db
    .insert(books)
    .values({
      schoolId,
      isbn: "978-8174506344",
      title: "Mathematics Textbook for Class X (NCERT Exemplar)",
      author: "NCERT Editorial Board",
      publisher: "NCERT",
      subject: "Mathematics",
      category: "Academic Reference",
      rackLocation: "RACK-M-04",
      totalCopies: 5,
      availableCopies: 4,
    })
    .returning();

  const [copy1] = await db
    .insert(bookCopies)
    .values({
      schoolId,
      bookId: book1!.id,
      barcodeNumber: `${config.code}-LIB-0001`,
      condition: "GOOD",
      isAvailable: false,
    })
    .returning();

  const flagshipStudent = allStudents[0]!;
  const [libMember] = await db
    .insert(libraryMembers)
    .values({
      schoolId,
      memberType: "STUDENT",
      memberRefId: flagshipStudent.id,
      memberCardNumber: `LIB-${flagshipStudent.admissionNumber}`,
      maxBooksAllowed: 3,
      loanPeriodDays: 14,
    })
    .returning();

  await db.insert(bookIssues).values({
    schoolId,
    bookCopyId: copy1!.id,
    libraryMemberId: libMember!.id,
    issuedAt: new Date("2026-11-20T10:30:00Z"),
    dueDate: new Date("2026-12-04T17:00:00Z"),
    status: "ISSUED",
  });

  // 25. PTM Events, Slots & Bookings
  const [ptmBaseEvent] = await db
    .insert(events)
    .values({
      schoolId,
      title: "Term 1 Parent-Teacher Conference (Class 10-A)",
      description: "Individual academic progress and board preparation review with Class Teacher.",
      startDate: new Date("2026-11-29T09:00:00Z"),
      endDate: new Date("2026-11-29T13:00:00Z"),
      eventType: "PTM",
      isPublic: true,
      createdById: primaryTeacherUserId,
    })
    .returning();

  const [ptmEv] = await db
    .insert(ptmEvents)
    .values({
      schoolId,
      eventId: ptmBaseEvent!.id,
      classId: targetSection10A.classId,
      teacherUserId: primaryTeacherUserId,
      venue: "Room 1001 (Senior Wing)",
      bookingOpensAt: new Date("2026-11-20T00:00:00Z"),
      bookingClosesAt: new Date("2026-11-28T23:59:59Z"),
      slotMinutes: 15,
    })
    .returning();

  const [slot1] = await db
    .insert(ptmSlots)
    .values({
      schoolId,
      ptmEventId: ptmEv!.id,
      teacherUserId: primaryTeacherUserId,
      startAt: new Date("2026-11-29T09:30:00Z"),
      endAt: new Date("2026-11-29T09:45:00Z"),
      status: "BOOKED",
    })
    .returning();

  await db.insert(ptmSlots).values({
    schoolId,
    ptmEventId: ptmEv!.id,
    teacherUserId: primaryTeacherUserId,
    startAt: new Date("2026-11-29T09:45:00Z"),
    endAt: new Date("2026-11-29T10:00:00Z"),
    status: "FREE",
  });

  await db.insert(ptmBookings).values({
    schoolId,
    ptmEventId: ptmEv!.id,
    slotId: slot1!.id,
    parentUserId: flagshipStudent.parentUserId,
    studentId: flagshipStudent.id,
    status: "BOOKED",
  });

  // 26. Student Leave Requests (Class Teacher Approval Queue)
  if (sec10Students.length >= 2) {
    await db.insert(studentLeaveRequests).values([
      {
        schoolId,
        studentId: sec10Students[1]!.id,
        requestedByParentUserId: sec10Students[1]!.parentUserId,
        leaveType: "SICK",
        startDate: new Date("2026-11-27T00:00:00Z"),
        endDate: new Date("2026-11-28T00:00:00Z"),
        reason: "Recovering from seasonal viral fever; medical certificate attached.",
        status: "PENDING",
      },
      {
        schoolId,
        studentId: flagshipStudent.id,
        requestedByParentUserId: flagshipStudent.parentUserId,
        leaveType: "CASUAL",
        startDate: new Date("2026-11-18T00:00:00Z"),
        endDate: new Date("2026-11-18T00:00:00Z"),
        reason: "Family function out of station",
        status: "APPROVED",
        decidedByUserId: primaryTeacherUserId,
        decisionNote: "Approved. Please collect class notes from Mathematics monitor.",
      },
    ]);
  }

  // 27. Accounts: Chart of Accounts & Ledger Transactions
  const [coaBank] = await db
    .insert(chartOfAccounts)
    .values({ schoolId, code: "1002", name: "Bank Account - HDFC Operating", type: "ASSET", isSystem: true })
    .returning();
  const [coaRevenue] = await db
    .insert(chartOfAccounts)
    .values({ schoolId, code: "4001", name: "Tuition & Academic Fee Revenue", type: "REVENUE", isSystem: true })
    .returning();
  const [coaExpense] = await db
    .insert(chartOfAccounts)
    .values({ schoolId, code: "5001", name: "Laboratory & Academic Supplies", type: "EXPENSE", isSystem: true })
    .returning();

  await db.insert(accountLedgerTransactions).values([
    {
      schoolId,
      transactionNumber: `TXN-${config.code}-001`,
      sourceType: "INCOME_VOUCHER",
      bankAccountId: mainBank!.id,
      transactionType: "CREDIT",
      amount: "150000.00",
      balanceAfter: "4349500.00",
      debitAccountId: coaBank!.id,
      creditAccountId: coaRevenue!.id,
      description: "Alumni Association STEM Lab Grant",
      createdById: accountantUserId || primaryTeacherUserId,
    },
    {
      schoolId,
      transactionNumber: `TXN-${config.code}-002`,
      sourceType: "EXPENSE_VOUCHER",
      bankAccountId: mainBank!.id,
      transactionType: "DEBIT",
      amount: "64500.00",
      balanceAfter: "4285000.00",
      debitAccountId: coaExpense!.id,
      creditAccountId: coaBank!.id,
      description: "Bharat Scientific Instruments Pvt Ltd - Lab Equipment",
      createdById: accountantUserId || primaryTeacherUserId,
    },
  ]);

  // 28. HR: Leave Balances, Salary Components & Staff Attendance (10 days)
  for (const sId of allStaffIds) {
    await db.insert(leaveBalances).values([
      { schoolId, staffId: sId, leaveType: "CL", academicYearId, allocatedDays: "12.0", usedDays: "1.0" },
      { schoolId, staffId: sId, leaveType: "ML", academicYearId, allocatedDays: "10.0", usedDays: "0.0" },
    ]);
    await db.insert(salaryComponents).values({
      schoolId,
      staffId: sId,
      basicSalary: "45000.00",
      daPercent: "15.00",
      hraPercent: "20.00",
      effectiveFrom: new Date("2026-04-01T00:00:00Z"),
    });
  }

  const staffAttRows: any[] = [];
  for (let d = 0; d < 10; d++) {
    const dt = new Date(Date.UTC(2026, 10, 16 + d, 2, 30));
    if (dt.getUTCDay() === 0) continue;
    for (const sId of allStaffIds) {
      staffAttRows.push({
        schoolId,
        staffId: sId,
        attendanceDate: dt,
        clockIn: new Date(dt.getTime() + 5 * 60 * 1000),
        clockOut: new Date(dt.getTime() + 7 * 3600 * 1000),
        status: "PRESENT",
        biometricVerified: true,
      });
    }
  }
  if (staffAttRows.length > 0) {
    for (const chunk of chunkArray(staffAttRows, 200)) {
      await db.insert(staffAttendance).values(chunk);
    }
  }

  // 29. Transport Driver & Bus Boarding Events
  if (driverUserId) {
    await db.insert(drivers).values({
      schoolId,
      vehicleId: bus1!.id,
      userId: driverUserId,
      nameEncrypted: encryptData("Suresh Yadav"),
      mobileEncrypted: encryptData("9811000881"),
      licenceEncrypted: encryptData("DL-04-2018-0049281"),
      isActive: true,
    });

    await db.insert(busBoardingEvents).values({
      schoolId,
      studentId: flagshipStudent.id,
      routeId: route1!.id,
      vehicleId: bus1!.id,
      direction: "BOARDING",
      scannedByUserId: driverUserId,
    });
  }

  // 30. Admissions Pipeline, Parent-Teacher Messages & Notice Acknowledgments
  await db.insert(admissionApplications).values([
    {
      applicationNumber: `ADM-${config.code}-2026-001`,
      schoolId,
      academicYearId,
      applicantNameEncrypted: encryptData("Kabir Malhotra"),
      dateOfBirth: new Date("2015-08-14T00:00:00Z"),
      gender: "MALE",
      category: "GENERAL",
      gradeAppliedFor: "CLASS_6",
      previousSchool: "Modern Public School",
      fatherNameEncrypted: encryptData("Sanjay Malhotra"),
      motherNameEncrypted: encryptData("Ritu Malhotra"),
      primaryContactMobileEncrypted: encryptData("9811223344"),
      primaryContactEmailEncrypted: encryptData("sanjay.malhotra@example.com"),
      addressEncrypted: encryptData("B-42, Vasant Vihar, New Delhi"),
      pincode: config.pincode,
      state: config.state,
      district: config.city,
      status: "APPLIED",
    },
    {
      applicationNumber: `ADM-${config.code}-2026-002`,
      schoolId,
      academicYearId,
      applicantNameEncrypted: encryptData("Ananya Iyer"),
      dateOfBirth: new Date("2012-03-22T00:00:00Z"),
      gender: "FEMALE",
      category: "GENERAL",
      gradeAppliedFor: "CLASS_9",
      previousSchool: "Delhi Public School",
      fatherNameEncrypted: encryptData("Karthik Iyer"),
      motherNameEncrypted: encryptData("Lakshmi Iyer"),
      primaryContactMobileEncrypted: encryptData("9811223355"),
      primaryContactEmailEncrypted: encryptData("karthik.iyer@example.com"),
      addressEncrypted: encryptData("C-18, Saket, New Delhi"),
      pincode: config.pincode,
      state: config.state,
      district: config.city,
      status: "INTERVIEW",
    },
  ]);

  await db.insert(parentTeacherMessages).values([
    {
      schoolId,
      senderUserId: flagshipStudent.parentUserId,
      recipientUserId: primaryTeacherUserId,
      studentId: flagshipStudent.id,
      subject: "Pre-Board Mathematics Doubt Session",
      content: "Good morning Ma'am, Aarav had a query regarding Exercise 4.4 discriminant problems. Could he stay back 15 minutes after Period 8 today?",
      isRead: false,
    },
  ]);

  const firstNotice = await db.query.notices.findFirst({ where: eq(notices.schoolId, schoolId) });
  if (firstNotice) {
    await db.insert(noticeAcknowledgments).values({
      schoolId,
      noticeId: firstNotice.id,
      parentUserId: flagshipStudent.parentUserId,
      source: "FEED",
    });
  }

  console.log(`  ✓ Seeded ${allStudents.length} students, ${staffRoster.length} staff, ${invoicesCount} invoices, and 45-day attendance.`);

  return {
    schoolId,
    name: config.name,
    board: config.board,
    studentsCount: allStudents.length,
    staffCount: staffRoster.length,
    invoicesCount,
  };
}

// ─── Main CLI Dispatcher ──────────────────────────────────────────────────────

export async function seedAllDemoSchools(options?: { reset?: boolean | undefined; board?: string | undefined }): Promise<any[]> {
  const isReset = options?.reset ?? false;
  const boardArg = options?.board;

  console.log("🚀 SchoolMitra ERP: Multi-Board Relational Demo Seeder");
  console.log("=================================================================");

  if (isReset) {
    await resetAllDemoSchools();
    console.log("✓ Reset completed cleanly. No customer schools were modified.\\n");
  }

  // Filter schools to seed
  let schoolsToSeed = DEMO_SCHOOLS;
  if (boardArg && boardArg !== "ALL") {
    schoolsToSeed = DEMO_SCHOOLS.filter((s) => s.board.includes(boardArg) || s.slug.includes(boardArg.toLowerCase()));
    if (schoolsToSeed.length === 0) {
      console.warn(`No demo school matches board filter "${boardArg}". Defaulting to all boards.`);
      schoolsToSeed = DEMO_SCHOOLS;
    }
  }

  console.log(`Seeding ${schoolsToSeed.length} demo school(s)...`);
  const results = [];
  for (const s of schoolsToSeed) {
    const res = await seedSingleDemoSchool(s);
    results.push(res);
  }

  console.log("\\n=================================================================");
  console.log("🎉 All Demo Schools Seeded Successfully!");
  console.log("=================================================================");
  console.table(results);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const isReset = args.includes("--reset");
  const boardArg = args.find((a) => a.startsWith("--board="))?.split("=")[1]?.toUpperCase();

  const seedOptions: { reset?: boolean | undefined; board?: string | undefined } = { reset: isReset };
  if (boardArg) seedOptions.board = boardArg;
  await seedAllDemoSchools(seedOptions);

  console.log("\\n=================================================================");
  console.log("DEMO PERSONA CREDENTIALS (PASSWORD FOR ALL: SchoolMitra@123):");
  console.log("=================================================================");
  console.log("  Role            | Email                         | Purpose / Access Scope");
  console.log("  ----------------|-------------------------------|----------------------------------");
  console.log("  School Admin    | admin@demo.schoolos.io        | Full School Admin, Setup & Config");
  console.log("  Principal       | principal@demo.schoolos.io    | Principal Oversight & Governance");
  console.log("  Senior Teacher  | teacher@demo.schoolos.io      | Class 10-A Class Teacher & PGT Maths");
  console.log("  Subject Teacher | teacher.sci@demo.schoolos.io  | Class 10-B Class Teacher & Science");
  console.log("  Subject Teacher | teacher.math@demo.schoolos.io | Class 9-A Class Teacher & TGT Maths");
  console.log("  Accountant      | finance@demo.schoolos.io      | Accounts, Invoices, Dues & Cashier");
  console.log("  HR Manager      | hr@demo.schoolos.io           | Staff Records, Payroll & Leaves");
  console.log("  Transport Head  | transport@demo.schoolos.io    | Bus Routes, Drivers & Fleet");
  console.log("  Librarian       | librarian@demo.schoolos.io    | Catalog, Circulation & Books");
  console.log("  Bus Driver      | driver@demo.schoolos.io       | Bus-01 Route 1 Boarding & GPS");
  console.log("  Parent          | parent@demo.schoolos.io       | Guardian of Aarav Sharma (Class 10-A)");
  console.log("  Student         | student@demo.schoolos.io      | Aarav Sharma (Roll 1, Class 10-A)");
  console.log("=================================================================\\n");

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Fatal Demo Seeder Error:", err);
    process.exit(1);
  });
}
'''

with open(os.path.join("database", "src", "seed_demo.ts"), "w", encoding="utf-8") as f:
    f.write(code)

print("database/src/seed_demo.ts written successfully!")
