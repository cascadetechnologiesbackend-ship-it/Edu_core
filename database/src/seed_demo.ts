/**
 * Production-Grade Multi-Board Interactive Demo Seeder
 *
 * Seeds executive-ready demo schools across all four educational boards:
 * 1. CBSE (National)         -> Oakridge Global Academy (slug: "demo-cbse")
 * 2. ICSE (Comprehensive)    -> St. Xavier's International Academy (slug: "demo-icse")
 * 3. State Board (Regional)  -> Adarsh Vidya Mandir (slug: "demo-state")
 * 4. International (CAIE/IB) -> The Cambridge International School (slug: "demo-international")
 *
 * Features:
 * - 100% Tenant Isolation: demo tenants flagged with featureFlags.demo_tenant = true
 * - Clean Idempotency: supports --reset to wipe and reseed only demo tenants
 * - Universal Demo Password: "SchoolMitra@123"
 * - Personas: admin@demo.schoolos.io, principal@demo.schoolos.io, teacher@demo.schoolos.io,
 *             finance@demo.schoolos.io, parent@demo.schoolos.io, student@demo.schoolos.io
 * - Interconnected Cross-Module Data: 30-day attendance trends, fee invoices & payment receipts,
 *   assignments & submissions, examination schedules & marks, and school notices.
 */

import "dotenv/config";
import { db } from "./index";
import {
  schools,
  academicYears,
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
  timetablePeriods,
  persons,
  students,
  studentClassHistory,
  studentFamilyMembers,
  passwordResetTokens,
  feeHeads,
  feeStructures,
  feeInvoices,
  feePayments,
  studentAttendance,
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
  notices,
  sessions,
} from "./schema";
import { eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Cryptographic Helpers ───────────────────────────────────────────────────

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

// Believable Names
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

// ─── Tenant Cleanup (Strict Isolation) ───────────────────────────────────────

export async function cleanDemoSchool(targetSchoolId: string): Promise<void> {
  // Ensure we operate as superuser / session owner to bypass RLS during demo resets
  await db.execute(sql`RESET ROLE;`);

  // Clear nullable circular FK references first
  await db.update(sections).set({ classTeacherId: null }).where(eq(sections.schoolId, targetSchoolId));
  await db.update(students).set({ currentSectionId: null, primaryParentUserId: null }).where(eq(students.schoolId, targetSchoolId));

  // Clean sessions & reset tokens for users of this school
  const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, targetSchoolId));
  if (demoUsers.length > 0) {
    const userIds = demoUsers.map((u) => u.id);
    for (const chunk of chunkArray(userIds, 400)) {
      await db.delete(sessions).where(inArray(sessions.userId, chunk));
      await db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, chunk));
    }
  }

  // Delete child tables in reverse foreign-key order
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

  // Delete fee tables in strict foreign-key order
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

  // Finally delete the school
  await db.delete(schools).where(eq(schools.id, targetSchoolId));
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
  console.log(`\n🏫 Seeding Demo School: ${config.name} (${config.board})`);

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
      },
      isActive: true,
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

  // 7. Seed Core RBAC Staff Personas
  // For CBSE (flagship), seed both clean root and board-specific alias emails
  const isFlagship = config.slug === "demo-cbse";

  interface StaffSeedSpec {
    firstName: string;
    lastName: string;
    email: string;
    additionalEmail?: string | undefined;
    phone: string;
    role: string;
    desig: string;
    dept: string;
  }

  const coreStaffSpecs: StaffSeedSpec[] = [
    {
      firstName: config.principalName.split(" ")[1] || "Sharma",
      lastName: config.principalName.split(" ")[2] || "Principal",
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
      firstName: "Priya",
      lastName: "Sharma",
      email: isFlagship ? "teacher@demo.schoolos.io" : `teacher.${config.domainPrefix}@demo.schoolos.io`,
      additionalEmail: isFlagship ? "teacher.cbse@demo.schoolos.io" : undefined,
      phone: "9811000103",
      role: "TEACHER",
      desig: "Senior Teacher",
      dept: "Academics",
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
  ];

  // Helper to create user + person + staff records
  const teacherUserIds: string[] = [];
  let primaryTeacherUserId = "";

  for (const st of coreStaffSpecs) {
    const emailsToCreate = [st.email];
    if (st.additionalEmail) emailsToCreate.push(st.additionalEmail);

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

      await db.insert(staff).values({
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
      });

      if (st.role === "TEACHER") {
        teacherUserIds.push(u!.id);
        if (!primaryTeacherUserId) primaryTeacherUserId = u!.id;
      }
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
  }
  const allSections: SectionInfo[] = [];

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
      const [sec] = await db
        .insert(sections)
        .values({
          schoolId,
          classId: cls!.id,
          name: secName,
          roomNumber: `Room ${g.order}0${secName === "A" ? 1 : 2}`,
          capacity: 35,
          classTeacherId: (g.name === "Class 10" && secName === "A") ? primaryTeacherUserId : null,
          isActive: true,
        })
        .returning();

      allSections.push({
        id: sec!.id,
        classId: cls!.id,
        className: g.name,
        sectionName: secName,
        gradeOrder: g.order,
      });

      if (primaryTeacherUserId && g.name === "Class 10" && secName === "A") {
        await db.insert(classTeacherAssignments).values({
          schoolId,
          sectionId: sec!.id,
          teacherId: primaryTeacherUserId,
          academicYearId,
          effectiveFrom: "2026-04-01",
          isActive: true,
        });
      }
    }
  }

  // 9. Insert Subjects & Map to Classes
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

  const classSubjectRecords: { classId: string; subjectId: string; id: string }[] = [];
  const uniqueClassIds = Array.from(new Set(allSections.map((s) => s.classId)));
  for (const cId of uniqueClassIds) {
    for (const s of subjectRecords) {
      const [cs] = await db
        .insert(classSubjects)
        .values({
          schoolId,
          classId: cId,
          subjectId: s.id,
          assignedTeacherId: primaryTeacherUserId || null,
          periodsPerWeek: 5,
          isElective: false,
        })
        .returning();
      classSubjectRecords.push({ classId: cId, subjectId: s.id, id: cs!.id });
    }
  }

  // 10. Timetable Periods (Monday to Friday, 4 periods per day)
  const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
  const periods = [
    { num: 1, start: "08:30:00", end: "09:15:00" },
    { num: 2, start: "09:15:00", end: "10:00:00" },
    { num: 3, start: "10:15:00", end: "11:00:00" },
    { num: 4, start: "11:00:00", end: "11:45:00" },
  ];

  const timetableRows: any[] = [];
  for (const sec of allSections) {
    const cSubs = classSubjectRecords.filter((cs) => cs.classId === sec.classId);
    let subIdx = 0;
    for (const day of weekdays) {
      for (const p of periods) {
        const sub = cSubs[subIdx % cSubs.length];
        subIdx++;
        timetableRows.push({
          schoolId,
          sectionId: sec.id,
          academicYearId,
          dayOfWeek: day,
          periodNumber: p.num,
          startTime: p.start,
          endTime: p.end,
          periodType: "REGULAR",
          subjectId: sub?.subjectId || subjectRecords[0]!.id,
          teacherId: primaryTeacherUserId || null,
          roomNumber: `Room ${sec.gradeOrder}${sec.sectionName}`,
          isActive: true,
        });
      }
    }
  }
  for (const chunk of chunkArray(timetableRows, 250)) {
    await db.insert(timetablePeriods).values(chunk);
  }

  // 11. Students & Parents (10 students per section = 200 students per school)
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
  const targetSection10A = allSections.find((s) => s.className === "Class 10" && s.sectionName === "A") || allSections[0]!;

  for (const sec of allSections) {
    for (let roll = 1; roll <= 10; roll++) {
      const idx = studentSeq++;
      const isBoy = idx % 2 === 1;
      const fnList = isBoy ? INDIAN_FIRST_NAMES_BOYS : INDIAN_FIRST_NAMES_GIRLS;
      const fn = fnList[idx % fnList.length]!;
      const ln = INDIAN_LAST_NAMES[idx % INDIAN_LAST_NAMES.length]!;
      const admNo = `${config.code}-2026-${String(idx).padStart(4, "0")}`;

      const birthYear = 2021 - sec.gradeOrder;
      const dob = new Date(Date.UTC(birthYear, (idx % 12), ((idx * 5) % 27) + 1));

      // Is this the designated demo flagship student?
      const isFlagshipStudent = (sec.id === targetSection10A.id && roll === 1);
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

      // 4. Link Parent & Class History
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
        classId: sec.classId,
        sectionId: sec.id,
        academicYearId,
        rollNumber: String(roll),
      });

      // If flagship, also seed the alias emails e.g. student.cbse@demo.schoolos.io
      if (isFlagship && isFlagshipStudent) {
        // Additional alias parent
        const [aliasParent] = await db
          .insert(users)
          .values({
            schoolId,
            email: "parent.cbse@demo.schoolos.io",
            passwordHash: DEFAULT_PASSWORD_HASH,
            mobileEncrypted: encryptData("9811000999"),
            isActive: true,
            isEmailVerified: true,
            mustChangePassword: false,
          })
          .returning();
        await db.insert(userRoles).values({ schoolId, userId: aliasParent!.id, roleId: roleMap.get("PARENT")! });
        await db.insert(studentFamilyMembers).values({
          schoolId,
          studentId: stRecord!.id,
          userId: aliasParent!.id,
          relation: "GUARDIAN",
          nameEncrypted: encryptData("Guardian " + ln),
          isPrimaryContact: false,
        });

        // Additional alias student
        const [aliasStudent] = await db
          .insert(users)
          .values({
            schoolId,
            email: "student.cbse@demo.schoolos.io",
            passwordHash: DEFAULT_PASSWORD_HASH,
            mobileEncrypted: encryptData("9811000998"),
            isActive: true,
            isEmailVerified: true,
            mustChangePassword: false,
          })
          .returning();
        await db.insert(userRoles).values({ schoolId, userId: aliasStudent!.id, roleId: roleMap.get("STUDENT")! });
      }
    }
  }

  // 12. Attendance: Seed 30 Days of Past Attendance Trends
  const attendanceRows: any[] = [];
  const baseDate = new Date("2026-10-01T08:30:00Z");

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const curDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    // Skip Sundays
    if (curDate.getUTCDay() === 0) continue;

    for (const st of allStudents) {
      // 94% present, 4% absent, 2% late
      const hash = (st.id.charCodeAt(0) + dayOffset * 17) % 100;
      const status = hash < 94 ? "PRESENT" : hash < 98 ? "ABSENT" : "LATE";

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

  // 13. Fees & Invoices
  // Heads
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

  // Fee Structures per class
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

  // Invoices & Payments for All Students
  let invoicesCount = 0;
  for (let i = 0; i < allStudents.length; i++) {
    const st = allStudents[i]!;
    const invNum = `INV-${config.code}-2026-${String(i + 1).padStart(4, "0")}`;
    const gross = 28500;

    // 80% Fully Paid, 15% Partially Paid, 5% Unpaid
    const isPaid = i % 10 < 8;
    const isPartial = i % 10 === 8;
    const paidAmount = isPaid ? gross : isPartial ? 15000 : 0;
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
        dueDate: new Date("2026-05-15T00:00:00Z"),
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
        paymentMethod: i % 2 === 0 ? "UPI" : "ONLINE",
        transactionReference: `TXN${config.code}${Date.now().toString().slice(-6)}${i}`,
        paymentDate: new Date("2026-05-10T11:00:00Z"),
        collectedById: primaryTeacherUserId || null,
        remarks: "Term 1 Tuition Fee Paid",
      });
    }
  }

  // 14. Assignments & Submissions
  const mathClassSub = classSubjectRecords[0];
  if (mathClassSub) {
    const [asgn] = await db
      .insert(assignments)
      .values({
        schoolId,
        classSubjectId: mathClassSub.id,
        sectionId: targetSection10A.id,
        createdByTeacherId: primaryTeacherUserId || allStudents[0]!.studentUserId,
        title: "Polynomials & Quadratic Equations Review Problem Set",
        description: "Solve problems 1 through 15 from Chapter 2. Show all step-by-step working.",
        maxMarks: 25,
        dueDate: new Date("2026-11-30T23:59:59Z"),
      })
      .returning();

    // Seed sample submissions for students in section 10A
    const sec10Students = allStudents.filter((s) => s.sectionId === targetSection10A.id);
    for (const st of sec10Students.slice(0, 5)) {
      await db.insert(assignmentSubmissions).values({
        schoolId,
        assignmentId: asgn!.id,
        studentId: st.id,
        marksAwarded: 22,
        remarks: "Excellent analytical work and clear proofs.",
        gradedByTeacherId: primaryTeacherUserId || null,
        gradedAt: new Date(),
        submittedAt: new Date(Date.now() - 24 * 3600 * 1000),
        studentContent: "Submitted assignment responses and step-by-step proofs.",
      });
    }
  }

  // 15. Examination & Graded Marks
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

  const [exam] = await db
    .insert(exams)
    .values({
      schoolId,
      academicYearId,
      examTypeId: examType!.id,
      name: "Mid-Term Assessment 2026",
      startDate: new Date("2026-09-15T09:00:00Z"),
      endDate: new Date("2026-09-25T13:00:00Z"),
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

  const [examSched] = await db
    .insert(examSchedules)
    .values({
      schoolId,
      examId: exam!.id,
      subjectId: subjectRecords[0]!.id,
      classId: targetSection10A.classId,
      examDate: "2026-09-18",
      startTime: "09:00:00",
      durationMinutes: 180,
      maxMarks: "80.00",
      passingMarks: "28.00",
    })
    .returning();

  // Seed marks for Class 10-A
  const sec10Students = allStudents.filter((s) => s.sectionId === targetSection10A.id);
  for (let m = 0; m < sec10Students.length; m++) {
    const st = sec10Students[m]!;
    const marks = 62 + (m % 17);
    await db.insert(markEntries).values({
      schoolId,
      examId: exam!.id,
      studentId: st.id,
      subjectId: subjectRecords[0]!.id,
      componentId: examComp!.id,
      marksObtained: String(marks),
      maxMarks: "80.00",
      status: "LOCKED",
      enteredById: primaryTeacherUserId || st.studentUserId,
      isAbsent: false,
    });
  }

  // 16. Notices & Circulars
  const sampleNotices = [
    {
      title: "Annual Sports Meet & Inter-House Athletics Schedule",
      content:
        "<p>We are delighted to announce that the Annual Sports Championship will be held on the school athletic grounds. Parents are warmly invited to cheer for the athletes.</p>",
      audienceType: "ALL" as const,
      isPublished: true,
      isPinned: true,
    },
    {
      title: "Mid-Term Assessment Report Cards Published",
      content:
        "<p>The Mid-Term Examination 2026 results have been finalized and published. Parents and students can review the detailed performance scorecard and teacher remarks in their portal.</p>",
      audienceType: "PARENTS" as const,
      isPublished: true,
      isPinned: false,
    },
    {
      title: "Parent-Teacher Conference (PTM) Timing & Appointments",
      content:
        "<p>The termly Parent-Teacher Meeting is scheduled for this coming Saturday. Individual time slots can be booked directly through the SchoolMitra Parent PWA.</p>",
      audienceType: "PARENTS" as const,
      isPublished: true,
      isPinned: false,
    },
    {
      title: "Teacher Professional Development Workshop on Modern STEM Pedagogies",
      content:
        "<p>A half-day hands-on pedagogical training workshop will be conducted in the Multipurpose Hall this Friday afternoon.</p>",
      audienceType: "TEACHERS" as const,
      isPublished: true,
      isPinned: false,
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
      createdById: primaryTeacherUserId || allStudents[0]!.studentUserId,
      publishedAt: new Date("2026-10-15T10:00:00Z"),
    });
  }

  console.log(`  ✓ Seeded ${allStudents.length} students, ${coreStaffSpecs.length} staff, ${invoicesCount} invoices, and 30-day attendance.`);

  return {
    schoolId,
    name: config.name,
    board: config.board,
    studentsCount: allStudents.length,
    staffCount: coreStaffSpecs.length,
    invoicesCount,
  };
}

// ─── Main CLI Dispatcher ──────────────────────────────────────────────────────

export async function seedAllDemoSchools(options?: { reset?: boolean | undefined; board?: string | undefined }): Promise<any[]> {
  const isReset = options?.reset ?? false;
  const boardArg = options?.board?.toUpperCase();

  console.log("=================================================================");
  console.log("🚀 SchoolMitra ERP: Multi-Board Relational Demo Seeder");
  console.log("=================================================================");

  if (isReset) {
    await resetAllDemoSchools();
    console.log("✓ Reset completed cleanly. No customer schools were modified.\n");
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

  console.log("\n=================================================================");
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

  console.log("\nStandard Demo Persona Credentials (Password: SchoolMitra@123):");
  console.log("  • School Admin : admin@demo.schoolos.io");
  console.log("  • Principal    : principal@demo.schoolos.io");
  console.log("  • Teacher      : teacher@demo.schoolos.io");
  console.log("  • Accountant   : finance@demo.schoolos.io");
  console.log("  • Parent       : parent@demo.schoolos.io");
  console.log("  • Student      : student@demo.schoolos.io");
  console.log("  • (Board-specific: *.cbse@..., *.icse@..., *.state@..., *.intl@...)");
  console.log("=================================================================\n");

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Fatal Demo Seeder Error:", err);
    process.exit(1);
  });
}
