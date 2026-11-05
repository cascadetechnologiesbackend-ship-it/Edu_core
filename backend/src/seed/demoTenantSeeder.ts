/**
 * Phase D1-L5: The Demo Tenant Seeder
 *
 * Seeds a believable, production-grade 900-student demo school ("Delhi Public Academy [DEMO]")
 * for charter verification and sales demonstration per docs/school-onboarding-spec.json.
 *
 * Structure & Data Invariants:
 * 1. School: "Delhi Public Academy [DEMO]", slug: "dpa-demo", code: "DPA-DEMO", UDISE: "07010199999".
 * 2. Unambiguous Demo Labeling: Name contains "[DEMO]", every surface renders "[DEMO DATA]" badge.
 * 3. 10 Classes (Class 1 to 10) x 3 Sections (A, B, C) = 30 Sections.
 * 4. Exactly 900 Students (30 students per section) with believable Indian names, DOBs,
 *    admission numbers (DPA-2026-0001 to DPA-2026-0900), and parent contact details (email + phone-only).
 * 5. ~45 Staff: 1 Principal, 35 Subject/Class Teachers, 4 Office Admins/Accountants, 5 Transport/Drivers.
 * 6. Curricula & Timetable: CBSE subjects mapped per class wing, section-scoped timetable periods.
 * 7. Fee Structures & Invoices: Term tuition, annual fee, transport fee with realistic collection curve
 *    (80% paid with receipts, 15% pending, 5% defaulters).
 * 8. Academic Term Activity:
 *    - 45 days of classroom attendance with realistic absentees (~94% presence).
 *    - Homework assignments posted, sample submissions, and graded feedback with remarks.
 *    - 1 term exam (Mid-Term) with schedule, entered marks, locks, published results, and report card snapshots.
 *    - Parent claims issued for all 900 students (~60% claimed, ~40% pending).
 * 9. Telemetry: Seed north-star telemetry events (onboarding duration 0.85 working days, journey completion).
 * 10. Idempotency & Clean Re-run: Drops and recreates the demo school cleanly without affecting other tenants.
 */

import "dotenv/config";
import { db } from "@/db";
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
  consentRecords,
  feeHeads,
  feeStructures,
  feeInvoices,
  feePayments,
  feeConcessions,
  studentFeeAdvances,
  studentFeeAdvanceAllocations,
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
  certificates,
  usageEvents,
  auditLogs,
  notices,
  smsLogs,
  sessions,
} from "@schoolmitra/database";
import { eq, inArray, sql } from "drizzle-orm";
import { encryptData, computeSearchHash } from "../lib/encryption";
import {
  recordOnboardingDays,
  recordJourneyCompletion,
} from "../lib/northStarTelemetry";
import { withTenant } from "../lib/tenant";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const DEMO_SCHOOL_CONFIG = {
  name: "Delhi Public Academy [DEMO]",
  slug: "dpa-demo",
  code: "DPA-DEMO",
  udiseCode: "07010199999",
  board: "CBSE",
  affiliationNumber: "CBSE/AFF/2026/07999",
  phone: "011-28089999",
  email: "principal@dpa-demo.schoolmitra.internal",
  principalName: "Dr. Rajeshwar Sharma",
  establishedYear: 2012,
  schoolType: "INTEGRATED",
  address: "Sector 14, Phase 2, Dwarka",
  city: "New Delhi",
  state: "Delhi",
  pincode: "110075",
  themeColors: { light: "#0284c7", dark: "#38bdf8" },
  featureFlags: {
    student_pwa_enabled: true,
    parent_pwa_enabled: true,
    offline_exams_enabled: true,
    demo_tenant: true,
  },
};

export interface DemoSeederResult {
  schoolId: string;
  academicYearId: string;
  classesCount: number;
  sectionsCount: number;
  studentsCount: number;
  staffCount: number;
  feeInvoicesCount: number;
  feePaymentsCount: number;
  attendanceRecordsCount: number;
  timetablePeriodsCount: number;
  examSnapshotsCount: number;
  claimedCount: number;
  pendingCount: number;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Cleanly drops all demo tenant data in reverse dependency order.
 * Guarantees 100% tenant isolation with zero side-effects on real tenants.
 */
export async function cleanDemoTenant(schoolId?: string): Promise<void> {
  let targetSchoolId = schoolId;
  if (!targetSchoolId) {
    const existing = await db.query.schools.findFirst({
      where: eq(schools.slug, DEMO_SCHOOL_CONFIG.slug),
      columns: { id: true },
    });
    if (!existing) return;
    targetSchoolId = existing.id;
  }

  // Run cleanup within withTenant context to satisfy RLS deletion checks
  await withTenant(targetSchoolId, async (tenantDb) => {
    // Set extended statement timeout for bulk deletion (overriding default 2s OLTP timeout)
    await tenantDb.execute(sql`SET LOCAL statement_timeout = 60000;`);

    // 1. Delete associated password reset tokens for demo users
    const demoUsers = await tenantDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.schoolId, targetSchoolId!));

    if (demoUsers.length > 0) {
      const userIds = demoUsers.map((u) => u.id);
      for (const chunk of chunkArray(userIds, 500)) {
        await tenantDb.delete(sessions).where(inArray(sessions.userId, chunk));
        await tenantDb.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, chunk));
      }
    }

    // 2. Clear nullable circular FK references before deletion
    await tenantDb.update(sections).set({ classTeacherId: null }).where(eq(sections.schoolId, targetSchoolId!));
    await tenantDb.update(students).set({ currentSectionId: null, primaryParentUserId: null }).where(eq(students.schoolId, targetSchoolId!));

    // 3. Child tables in strict reverse dependency order
    const tablesWithSchoolId = [
      usageEvents,
      notices,
      smsLogs,
      reportCards,
      certificates,
      markEntries,
      examMarksLocks,
      examSchedules,
      examMarkDistributions,
      examClassScopes,
      examComponents,
      exams,
      examTypes,
      assignmentSubmissions,
      assignments,
      studentAttendance,
      timetablePeriods,
      classTeacherAssignments,
      classSubjects,
      studentFeeAdvanceAllocations,
      studentFeeAdvances,
      feePayments,
      feeInvoices,
      feeConcessions,
      feeStructures,
      feeHeads,
      consentRecords,
      studentFamilyMembers,
      studentClassHistory,
      students,
      sections,
      classes,
      subjects,
      staff,
      designations,
      departments,
      userRoles,
      persons,
      users,
      academicYears,
    ];

    for (const table of tablesWithSchoolId) {
      await tenantDb.delete(table as any).where(eq((table as any).schoolId, targetSchoolId!));
    }
  });

  // 3. Delete School Record itself
  await db.delete(schools).where(eq(schools.id, targetSchoolId));
}

const INDIAN_FIRST_NAMES_BOYS = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Muhammad", "Sai",
  "Arnav", "Aayush", "Shaurya", "Atharv", "Advik", "Pranav", "Advaith", "Kabir",
  "Dhruv", "Ishaan", "Rohan", "Kunal", "Rahul", "Vikas", "Rohit", "Sameer",
  "Aniket", "Siddharth", "Manish", "Nikhil", "Gaurav", "Harsh", "Karan", "Ayush",
  "Varun", "Abhishek", "Mayank", "Rishi", "Kartik", "Shivam", "Tanmay", "Dev",
  "Yash", "Chirag", "Naveen", "Akash", "Tushar", "Suraj", "Mohit", "Pankaj",
  "Lalit", "Hemant", "Sachin", "Raj", "Vijay", "Deepak", "Alok", "Aman",
];

const INDIAN_FIRST_NAMES_GIRLS = [
  "Ananya", "Diya", "Sanvi", "Aadhya", "Pari", "Saanvi", "Kiara", "Myra",
  "Riya", "Aarohi", "Anaya", "Navya", "Fatima", "Avni", "Ishita", "Meera",
  "Sara", "Siya", "Zara", "Tanya", "Neha", "Pooja", "Priya", "Sneha",
  "Simran", "Kritika", "Divya", "Anjali", "Shreya", "Aditi", "Roshni", "Swati",
  "Nikita", "Tanvi", "Sonam", "Megha", "Bhavna", "Kavya", "Payal", "Shikha",
  "Palak", "Radhika", "Geeta", "Rashmi", "Sunita", "Reena", "Jyoti", "Nisha",
  "Vandana", "Mamta", "Deepika", "Preeti", "Komal", "Barkha", "Suman", "Richa",
];

const INDIAN_LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Patel", "Singh", "Mehta", "Kumar", "Joshi",
  "Mishra", "Nair", "Rao", "Reddy", "Agarwal", "Malhotra", "Bhatia", "Choudhury",
  "Das", "Sen", "Ghosh", "Iyer", "Chatterjee", "Mukherjee", "Saxena", "Bansal",
  "Kapoor", "Tiwari", "Pandey", "Tripathi", "Shukla", "Dubey", "Chauhan", "Yadav",
  "Srivastava", "Garg", "Jain", "Bhatt", "Pillai", "Menon", "Deshmukh", "Patil",
  "Kulkarni", "Chopra", "Dutta", "Sinha", "Prasad", "Thakur", "Rathore", "Seth",
  "Narang", "Bhardwaj",
];

/**
 * Authoritative seeder for Phase D1-L5 demo tenant.
 */
export async function seedDemoTenant(): Promise<DemoSeederResult> {
  // 1. Idempotent check & clean
  const existingSchool = await db.query.schools.findFirst({
    where: eq(schools.slug, DEMO_SCHOOL_CONFIG.slug),
    columns: { id: true },
  });

  if (existingSchool) {
    await cleanDemoTenant(existingSchool.id);
  }

  // Precompute single bcrypt hash for performance (default password: "SchoolMitra@123")
  const DEFAULT_PASSWORD_HASH = await bcrypt.hash("SchoolMitra@123", 10);

  // 2. Insert School (outside tenant scope because tenant does not exist yet)
  const [demoSchool] = await db
    .insert(schools)
    .values({
      name: DEMO_SCHOOL_CONFIG.name,
      slug: DEMO_SCHOOL_CONFIG.slug,
      udiseCode: DEMO_SCHOOL_CONFIG.udiseCode,
      board: DEMO_SCHOOL_CONFIG.board as any,
      phone: DEMO_SCHOOL_CONFIG.phone,
      email: DEMO_SCHOOL_CONFIG.email,
      principalName: DEMO_SCHOOL_CONFIG.principalName,
      establishedYear: DEMO_SCHOOL_CONFIG.establishedYear,
      schoolType: DEMO_SCHOOL_CONFIG.schoolType,
      status: "ACTIVE",
      address: DEMO_SCHOOL_CONFIG.address,
      city: DEMO_SCHOOL_CONFIG.city,
      state: DEMO_SCHOOL_CONFIG.state,
      pincode: DEMO_SCHOOL_CONFIG.pincode,
      themeColors: DEMO_SCHOOL_CONFIG.themeColors,
      featureFlags: {
        ...DEMO_SCHOOL_CONFIG.featureFlags,
        school_code: DEMO_SCHOOL_CONFIG.code,
      },
      provisioningManifest: {
        code: DEMO_SCHOOL_CONFIG.code,
        affiliationNumber: DEMO_SCHOOL_CONFIG.affiliationNumber,
      },
      isActive: true,
      createdAt: new Date("2026-04-01T08:00:00Z"),
    })
    .returning();

  const schoolId = demoSchool!.id;

  // Execute all tenant-scoped data seeding inside withTenant(schoolId) to enforce RLS compliance
  return await withTenant(schoolId, async (tenantDb) => {
    // Set extended statement timeout for bulk seeding (overriding default 2s OLTP timeout)
    await tenantDb.execute(sql`SET LOCAL statement_timeout = 60000;`);

    // 3. Insert Academic Year (2026-27)
    const [academicYear] = await tenantDb
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

    // 4. Ensure System Roles
    const existingRoles = await tenantDb.select().from(roles);
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
      { name: "DRIVER", displayName: "Driver" },
      { name: "PARENT", displayName: "Parent" },
      { name: "STUDENT", displayName: "Student" },
    ] as const;

    for (const r of REQUIRED_ROLES) {
      if (!roleMap.has(r.name)) {
        const [newRole] = await tenantDb
          .insert(roles)
          .values({
            name: r.name as any,
            displayName: r.displayName,
            isSystemRole: true,
          })
          .returning();
        roleMap.set(r.name, newRole!.id);
      }
    }

    // 5. Insert Departments
    const deptConfigs = [
      "Academics",
      "Administration & Operations",
      "Finance & Accounts",
      "Transport & Safety",
      "Student Welfare",
    ];
    const deptMap = new Map<string, string>();
    for (const name of deptConfigs) {
      const [dept] = await tenantDb
        .insert(departments)
        .values({
          schoolId,
          name,
          isActive: true,
        })
        .returning();
      deptMap.set(name, dept!.id);
    }

    // 6. Insert Designations
    const desigConfigs = [
      { name: "Principal", dept: "Academics", role: "PRINCIPAL", isTeaching: true },
      { name: "Head of Department", dept: "Academics", role: "TEACHER", isTeaching: true },
      { name: "Senior Subject Teacher", dept: "Academics", role: "TEACHER", isTeaching: true },
      { name: "Primary Teacher", dept: "Academics", role: "TEACHER", isTeaching: true },
      { name: "Office Administrator", dept: "Administration & Operations", role: "SCHOOL_ADMIN", isTeaching: false },
      { name: "HR Manager", dept: "Administration & Operations", role: "HR_MANAGER", isTeaching: false },
      { name: "Senior Accountant", dept: "Finance & Accounts", role: "ACCOUNTANT", isTeaching: false },
      { name: "Transport Supervisor", dept: "Transport & Safety", role: "TRANSPORT_MANAGER", isTeaching: false },
      { name: "School Bus Driver", dept: "Transport & Safety", role: "DRIVER", isTeaching: false },
    ];
    const desigMap = new Map<string, string>();
    for (const des of desigConfigs) {
      const [d] = await tenantDb
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

    // 7. Insert Staff Members (Exactly 45 staff members)
    const staffConfigs: {
      code: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      role: string;
      desig: string;
      dept: string;
    }[] = [];

    // 1 Principal
    staffConfigs.push({
      code: "DPA-EMP-001",
      firstName: "Rajeshwar",
      lastName: "Sharma",
      email: "principal@dpa-demo.schoolmitra.internal",
      phone: "9811000001",
      role: "PRINCIPAL",
      desig: "Principal",
      dept: "Academics",
    });

    // 4 Office / Finance / HR
    staffConfigs.push(
      {
        code: "DPA-EMP-002",
        firstName: "Amit",
        lastName: "Singhal",
        email: "admin@dpa-demo.schoolmitra.internal",
        phone: "9811000002",
        role: "SCHOOL_ADMIN",
        desig: "Office Administrator",
        dept: "Administration & Operations",
      },
      {
        code: "DPA-EMP-003",
        firstName: "Sunita",
        lastName: "Kapoor",
        email: "office@dpa-demo.schoolmitra.internal",
        phone: "9811000003",
        role: "SCHOOL_ADMIN",
        desig: "Office Administrator",
        dept: "Administration & Operations",
      },
      {
        code: "DPA-EMP-004",
        firstName: "Rajiv",
        lastName: "Nambiar",
        email: "accounts@dpa-demo.schoolmitra.internal",
        phone: "9811000004",
        role: "ACCOUNTANT",
        desig: "Senior Accountant",
        dept: "Finance & Accounts",
      },
      {
        code: "DPA-EMP-005",
        firstName: "Meenakshi",
        lastName: "Sundaram",
        email: "hr@dpa-demo.schoolmitra.internal",
        phone: "9811000005",
        role: "HR_MANAGER",
        desig: "HR Manager",
        dept: "Administration & Operations",
      }
    );

    // 35 Teachers (30 section class teachers + 5 specialist teachers)
    const teacherNames = [
      ["Anjali", "Sharma"], ["Priya", "Verma"], ["Rohit", "Gupta"], ["Neha", "Patel"],
      ["Deepak", "Singh"], ["Vandana", "Rao"], ["Vikas", "Joshi"], ["Pooja", "Mishra"],
      ["Manish", "Nair"], ["Kavita", "Reddy"], ["Gaurav", "Agarwal"], ["Shreya", "Malhotra"],
      ["Rohan", "Bhatia"], ["Aditi", "Choudhury"], ["Sameer", "Das"], ["Kritika", "Sen"],
      ["Siddharth", "Ghosh"], ["Divya", "Iyer"], ["Nikhil", "Chatterjee"], ["Swati", "Mukherjee"],
      ["Harsh", "Saxena"], ["Roshni", "Bansal"], ["Karan", "Kapoor"], ["Nikita", "Tiwari"],
      ["Ayush", "Pandey"], ["Tanvi", "Tripathi"], ["Varun", "Shukla"], ["Sonam", "Dubey"],
      ["Abhishek", "Chauhan"], ["Megha", "Yadav"],
      // 5 Specialist Teachers
      ["Sanjay", "Kumar"], ["Preeti", "Agarwal"], ["Vikram", "Rathore"], ["Sneha", "Sen"], ["Arun", "Roy"],
    ];

    for (let i = 0; i < teacherNames.length; i++) {
      const [fn, ln] = teacherNames[i]!;
      const empIdx = 6 + i;
      staffConfigs.push({
        code: `DPA-EMP-${String(empIdx).padStart(3, "0")}`,
        firstName: fn!,
        lastName: ln!,
        email: `teacher.${empIdx}@dpa-demo.schoolmitra.internal`,
        phone: `98110000${String(empIdx).padStart(2, "0")}`,
        role: "TEACHER",
        desig: i < 15 ? "Primary Teacher" : "Senior Subject Teacher",
        dept: "Academics",
      });
    }

    // 5 Transport / Drivers
    staffConfigs.push(
      {
        code: "DPA-EMP-041",
        firstName: "Ramesh",
        lastName: "Yadav",
        email: "transport@dpa-demo.schoolmitra.internal",
        phone: "9811000041",
        role: "TRANSPORT_MANAGER",
        desig: "Transport Supervisor",
        dept: "Transport & Safety",
      },
      {
        code: "DPA-EMP-042",
        firstName: "Harpreet",
        lastName: "Singh",
        email: "driver.1@dpa-demo.schoolmitra.internal",
        phone: "9811000042",
        role: "DRIVER",
        desig: "School Bus Driver",
        dept: "Transport & Safety",
      },
      {
        code: "DPA-EMP-043",
        firstName: "Suresh",
        lastName: "Kumar",
        email: "driver.2@dpa-demo.schoolmitra.internal",
        phone: "9811000043",
        role: "DRIVER",
        desig: "School Bus Driver",
        dept: "Transport & Safety",
      },
      {
        code: "DPA-EMP-044",
        firstName: "Manoj",
        lastName: "Tiwari",
        email: "driver.3@dpa-demo.schoolmitra.internal",
        phone: "9811000044",
        role: "DRIVER",
        desig: "School Bus Driver",
        dept: "Transport & Safety",
      },
      {
        code: "DPA-EMP-045",
        firstName: "Balwant",
        lastName: "Singh",
        email: "driver.4@dpa-demo.schoolmitra.internal",
        phone: "9811000045",
        role: "DRIVER",
        desig: "School Bus Driver",
        dept: "Transport & Safety",
      }
    );

    // Insert Staff users & profiles
    const staffTeacherUserIds: string[] = [];
    const allStaffUsers: { id: string; email: string; role: string }[] = [];

    for (const sc of staffConfigs) {
      const [u] = await tenantDb
        .insert(users)
        .values({
          schoolId,
          email: sc.email,
          passwordHash: DEFAULT_PASSWORD_HASH,
          mobileEncrypted: encryptData(sc.phone),
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
        })
        .returning();

      allStaffUsers.push({ id: u!.id, email: u!.email, role: sc.role });

      await tenantDb.insert(userRoles).values({
        schoolId,
        userId: u!.id,
        roleId: roleMap.get(sc.role)!,
      });

      await tenantDb.insert(persons).values({
        schoolId,
        userId: u!.id,
        primaryType: "STAFF",
        firstNameEncrypted: encryptData(sc.firstName),
        lastNameEncrypted: encryptData(sc.lastName),
        firstNameSearchHash: computeSearchHash(sc.firstName),
        lastNameSearchHash: computeSearchHash(sc.lastName),
        gender: "OTHER",
        dateOfBirth: new Date("1985-05-15T00:00:00Z"),
        isActive: true,
      });

      await tenantDb.insert(staff).values({
        schoolId,
        userId: u!.id,
        employeeCode: sc.code,
        departmentId: deptMap.get(sc.dept)!,
        designationId: desigMap.get(sc.desig)!,
        contractType: "PERMANENT",
        joiningDate: new Date("2024-04-01T00:00:00Z"),
        firstNameEncrypted: encryptData(sc.firstName),
        lastNameEncrypted: encryptData(sc.lastName),
        dateOfBirthEncrypted: encryptData("1985-05-15"),
        genderEncrypted: encryptData("MALE"),
        mobileEncrypted: encryptData(sc.phone),
        emailEncrypted: encryptData(sc.email),
        isActive: true,
      });

      if (sc.role === "TEACHER") {
        staffTeacherUserIds.push(u!.id);
      }
    }

    const staffCount = staffConfigs.length; // 45

    // 8. Insert 10 Classes & 30 Sections (A, B, C)
    const classGradeLevels = [
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

    interface SectionMeta {
      id: string;
      classId: string;
      className: string;
      sectionName: string;
      classOrder: number;
      classTeacherUserId: string;
    }

    const allSectionsMeta: SectionMeta[] = [];
    const classMap = new Map<number, string>();
    let teacherCursor = 0;

    for (const c of classGradeLevels) {
      const [newClass] = await tenantDb
        .insert(classes)
        .values({
          schoolId,
          academicYearId,
          gradeLevel: c.grade as any,
          displayName: c.name,
          sortOrder: c.order,
          isActive: true,
        })
        .returning();

      classMap.set(c.order, newClass!.id);

      for (const secName of ["A", "B", "C"]) {
        const assignedTeacherId = staffTeacherUserIds[teacherCursor % staffTeacherUserIds.length]!;
        teacherCursor++;

        const [sec] = await tenantDb
          .insert(sections)
          .values({
            schoolId,
            classId: newClass!.id,
            name: secName,
            capacity: 40,
            classTeacherId: assignedTeacherId,
            isActive: true,
          })
          .returning();

        await tenantDb.insert(classTeacherAssignments).values({
          schoolId,
          academicYearId,
          sectionId: sec!.id,
          teacherId: assignedTeacherId,
          effectiveFrom: "2026-04-01",
          isActive: true,
        });

        allSectionsMeta.push({
          id: sec!.id,
          classId: newClass!.id,
          className: c.name,
          sectionName: secName,
          classOrder: c.order,
          classTeacherUserId: assignedTeacherId,
        });
      }
    }

    const classesCount = classGradeLevels.length; // 10
    const sectionsCount = allSectionsMeta.length; // 30

    // 9. Insert CBSE Subjects & Class Subjects
    const subjectList = [
      { code: "ENG", name: "English Language & Literature", type: "LANGUAGE", max: 100, pass: 33 },
      { code: "HIN", name: "Hindi Course-A", type: "LANGUAGE", nameHindi: "हिन्दी", max: 100, pass: 33 },
      { code: "MATH", name: "Mathematics", type: "THEORY", max: 100, pass: 33 },
      { code: "SCI", name: "General Science", type: "THEORY", max: 100, pass: 33 },
      { code: "SST", name: "Social Science", type: "THEORY", max: 100, pass: 33 },
      { code: "CS", name: "Computer Applications", type: "THEORY", max: 100, pass: 33 },
      { code: "SKT", name: "Sanskrit", type: "LANGUAGE", nameHindi: "संस्कृत", max: 100, pass: 33 },
      { code: "EVS", name: "Environmental Studies", type: "THEORY", max: 100, pass: 33 },
    ] as const;

    const subjectMap = new Map<string, string>();
    for (const s of subjectList) {
      const [sub] = await tenantDb
        .insert(subjects)
        .values({
          schoolId,
          code: s.code,
          name: s.name,
          nameHindi: (s as any).nameHindi || null,
          subjectType: s.type as any,
          maxMarks: s.max,
          passingMarks: s.pass,
          isActive: true,
        })
        .returning();
      subjectMap.set(s.code, sub!.id);
    }

    // Attach subjects to classes
    const classSubjectRecords: { classId: string; subjectId: string; id: string }[] = [];
    for (const c of classGradeLevels) {
      const cId = classMap.get(c.order)!;
      let codes: string[];
      if (c.order <= 5) {
        codes = ["ENG", "HIN", "MATH", "EVS", "CS"];
      } else if (c.order <= 8) {
        codes = ["ENG", "HIN", "MATH", "SCI", "SST", "CS", "SKT"];
      } else {
        codes = ["ENG", "HIN", "MATH", "SCI", "SST", "CS"];
      }

      for (let idx = 0; idx < codes.length; idx++) {
        const sCode = codes[idx]!;
        const sId = subjectMap.get(sCode)!;
        const assignedTeacherId = staffTeacherUserIds[(c.order + idx) % staffTeacherUserIds.length];

        const [cs] = await tenantDb
          .insert(classSubjects)
          .values({
            schoolId,
            classId: cId,
            subjectId: sId,
            assignedTeacherId: assignedTeacherId ?? null,
            periodsPerWeek: 5,
            isElective: false,
          })
          .returning();

        classSubjectRecords.push({ classId: cId, subjectId: sId, id: cs!.id });
      }
    }

    // 10. Insert Timetable Periods (Weekly Instructional Periods for all 30 Sections)
    const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
    const periodTimes = [
      { period: 1, start: "08:30:00", end: "09:15:00" },
      { period: 2, start: "09:15:00", end: "10:00:00" },
      { period: 3, start: "10:15:00", end: "11:00:00" },
      { period: 4, start: "11:00:00", end: "11:45:00" },
      { period: 5, start: "12:15:00", end: "13:00:00" },
      { period: 6, start: "13:00:00", end: "13:45:00" },
    ];

    const timetablePeriodRows: any[] = [];
    for (const sec of allSectionsMeta) {
      const relevantClassSubjects = classSubjectRecords.filter((cs) => cs.classId === sec.classId);
      let subjectRotator = 0;

      for (const day of daysOfWeek) {
        for (const pt of periodTimes) {
          const cs = relevantClassSubjects[subjectRotator % relevantClassSubjects.length]!;
          subjectRotator++;

          timetablePeriodRows.push({
            schoolId,
            sectionId: sec.id,
            academicYearId,
            dayOfWeek: day,
            periodNumber: pt.period,
            startTime: pt.start,
            endTime: pt.end,
            periodType: "REGULAR",
            subjectId: cs.subjectId,
            teacherId: sec.classTeacherUserId,
            roomNumber: `Room ${sec.classOrder}${sec.sectionName}`,
            isActive: true,
          });
        }
      }
    }

    for (const chunk of chunkArray(timetablePeriodRows, 300)) {
      await tenantDb.insert(timetablePeriods).values(chunk);
    }

    const timetablePeriodsCount = timetablePeriodRows.length; // 900

    // 11. Insert Exactly 900 Students (30 Students per section across 30 sections)
    interface StudentMeta {
      id: string;
      admissionNumber: string;
      sectionId: string;
      classId: string;
      firstName: string;
      lastName: string;
      gender: "MALE" | "FEMALE";
      primaryParentUserId: string;
      studentUserId: string;
      isClaimed: boolean;
    }

    const allStudentsMeta: StudentMeta[] = [];
    const parentUsersRows: any[] = [];
    const parentUserRolesRows: any[] = [];
    const parentPersonsRows: any[] = [];
    const passwordResetTokenRows: any[] = [];

    const studentUsersRows: any[] = [];
    const studentUserRolesRows: any[] = [];
    const studentPersonsRows: any[] = [];
    const studentsRows: any[] = [];
    const studentClassHistoryRows: any[] = [];
    const studentFamilyMembersRows: any[] = [];
    const consentRecordsRows: any[] = [];

    let globalStudentCounter = 1;

    for (const sec of allSectionsMeta) {
      for (let roll = 1; roll <= 30; roll++) {
        const idx = globalStudentCounter;
        const isBoy = idx % 2 === 1;
        const fnList = isBoy ? INDIAN_FIRST_NAMES_BOYS : INDIAN_FIRST_NAMES_GIRLS;
        const fn = fnList[idx % fnList.length]!;
        const ln = INDIAN_LAST_NAMES[idx % INDIAN_LAST_NAMES.length]!;
        const admNo = `DPA-2026-${String(idx).padStart(4, "0")}`;

        const birthYear = 2021 - sec.classOrder;
        const birthMonth = idx % 12;
        const birthDay = ((idx * 7) % 27) + 1;
        const dob = new Date(Date.UTC(birthYear, birthMonth, birthDay));

        const catCode = idx % 10 < 6 ? "GENERAL" : idx % 10 < 8 ? "OBC" : idx % 10 === 8 ? "SC" : "EWS";

        const hasEmail = idx % 2 === 0;
        const parentPhone = `9811${String(100000 + idx).slice(-6)}`;
        const parentEmail = hasEmail
          ? `parent.dpa2026${String(idx).padStart(4, "0")}@example.com`
          : `parent.${parentPhone}@dpa-demo.schoolmitra.internal`;

        const isClaimed = idx <= 540;

        const parentUserId = crypto.randomUUID();
        const studentUserId = crypto.randomUUID();
        const studentId = crypto.randomUUID();

        // 1. Parent User
        parentUsersRows.push({
          id: parentUserId,
          schoolId,
          email: parentEmail,
          passwordHash: DEFAULT_PASSWORD_HASH,
          mobileEncrypted: encryptData(parentPhone),
          isActive: true,
          isEmailVerified: hasEmail,
          mustChangePassword: !isClaimed,
        });

        parentUserRolesRows.push({
          schoolId,
          userId: parentUserId,
          roleId: roleMap.get("PARENT")!,
        });

        parentPersonsRows.push({
          id: crypto.randomUUID(),
          schoolId,
          userId: parentUserId,
          primaryType: "PARENT",
          firstNameEncrypted: encryptData("Guardian"),
          lastNameEncrypted: encryptData(ln),
          firstNameSearchHash: computeSearchHash("Guardian"),
          lastNameSearchHash: computeSearchHash(ln),
          gender: "OTHER",
          isActive: true,
        });

        // Claim Token
        const tokenStr = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(tokenStr).digest("hex");
        passwordResetTokenRows.push({
          userId: parentUserId,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          usedAt: isClaimed ? new Date("2026-04-12T10:00:00Z") : null,
        });

        // 2. Student User (Minor-Safe internal credential)
        const studentUsername = `student.dpa2026${String(idx).padStart(4, "0")}@dpa-demo.schoolmitra.internal`;
        studentUsersRows.push({
          id: studentUserId,
          schoolId,
          email: studentUsername,
          passwordHash: DEFAULT_PASSWORD_HASH,
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: !isClaimed,
        });

        studentUserRolesRows.push({
          schoolId,
          userId: studentUserId,
          roleId: roleMap.get("STUDENT")!,
        });

        // 3. Student Person
        studentPersonsRows.push({
          id: crypto.randomUUID(),
          schoolId,
          userId: studentUserId,
          primaryType: "STUDENT",
          firstNameEncrypted: encryptData(fn),
          lastNameEncrypted: encryptData(ln),
          firstNameSearchHash: computeSearchHash(fn),
          lastNameSearchHash: computeSearchHash(ln),
          gender: isBoy ? "MALE" : "FEMALE",
          dateOfBirth: dob,
          isActive: true,
        });

        // 4. Student Profile
        studentsRows.push({
          id: studentId,
          schoolId,
          academicYearId,
          admissionNumber: admNo,
          firstNameEncrypted: encryptData(fn),
          lastNameEncrypted: encryptData(ln),
          firstNameSearchHash: computeSearchHash(fn),
          lastNameSearchHash: computeSearchHash(ln),
          dateOfBirth: dob,
          gender: isBoy ? "MALE" : "FEMALE",
          category: catCode as any,
          currentClassId: sec.classId,
          currentSectionId: sec.id,
          rollNumber: String(roll),
          admissionDate: new Date("2026-04-01T00:00:00Z"),
          primaryParentUserId: parentUserId,
          userId: studentUserId,
          isActive: true,
        });

        // 5. Class History (ENROLLED)
        studentClassHistoryRows.push({
          schoolId,
          studentId,
          academicYearId,
          classId: sec.classId,
          sectionId: sec.id,
          promotionStatus: "ENROLLED",
        });

        // 6. Family Member Linkage
        studentFamilyMembersRows.push({
          schoolId,
          studentId,
          userId: parentUserId,
          relation: "GUARDIAN",
          nameEncrypted: encryptData(`Parent of ${fn}`),
          mobileEncrypted: encryptData(parentPhone),
          emailEncrypted: hasEmail ? encryptData(parentEmail) : null,
          mobileSearchHash: computeSearchHash(parentPhone),
          emailSearchHash: hasEmail ? computeSearchHash(parentEmail) : null,
          isPrimaryContact: true,
          isEmergencyContact: true,
          hasConsentAuthority: true,
        });

        // 7. DPDP Consent Attestations
        consentRecordsRows.push(
          {
            schoolId,
            studentId,
            parentUserId: parentUserId,
            purposeId: "admission_data",
            privacyNoticeVersion: "1.0",
            granted: true,
            method: "admin_attestation",
            ipAddress: "0.0.0.0",
          },
          {
            schoolId,
            studentId,
            parentUserId: parentUserId,
            purposeId: "academic_records",
            privacyNoticeVersion: "1.0",
            granted: true,
            method: "admin_attestation",
            ipAddress: "0.0.0.0",
          }
        );

        allStudentsMeta.push({
          id: studentId,
          admissionNumber: admNo,
          sectionId: sec.id,
          classId: sec.classId,
          firstName: fn,
          lastName: ln,
          gender: isBoy ? "MALE" : "FEMALE",
          primaryParentUserId: parentUserId,
          studentUserId: studentUserId,
          isClaimed,
        });

        globalStudentCounter++;
      }
    }

    // Insert student & parent records in high-performance chunks
    for (const chunk of chunkArray(parentUsersRows, 300)) {
      await tenantDb.insert(users).values(chunk);
    }
    for (const chunk of chunkArray(parentUserRolesRows, 300)) {
      await tenantDb.insert(userRoles).values(chunk);
    }
    for (const chunk of chunkArray(parentPersonsRows, 300)) {
      await tenantDb.insert(persons).values(chunk);
    }
    for (const chunk of chunkArray(passwordResetTokenRows, 300)) {
      await tenantDb.insert(passwordResetTokens).values(chunk);
    }

    for (const chunk of chunkArray(studentUsersRows, 300)) {
      await tenantDb.insert(users).values(chunk);
    }
    for (const chunk of chunkArray(studentUserRolesRows, 300)) {
      await tenantDb.insert(userRoles).values(chunk);
    }
    for (const chunk of chunkArray(studentPersonsRows, 300)) {
      await tenantDb.insert(persons).values(chunk);
    }
    for (const chunk of chunkArray(studentsRows, 300)) {
      await tenantDb.insert(students).values(chunk);
    }
    for (const chunk of chunkArray(studentClassHistoryRows, 300)) {
      await tenantDb.insert(studentClassHistory).values(chunk);
    }
    for (const chunk of chunkArray(studentFamilyMembersRows, 300)) {
      await tenantDb.insert(studentFamilyMembers).values(chunk);
    }
    for (const chunk of chunkArray(consentRecordsRows, 300)) {
      await tenantDb.insert(consentRecords).values(chunk);
    }

    const studentsCount = allStudentsMeta.length; // 900
    const claimedCount = allStudentsMeta.filter((s) => s.isClaimed).length; // 540
    const pendingCount = studentsCount - claimedCount; // 360

    // 12. Fee Structures & Demands
    const [fhTuition] = await tenantDb
      .insert(feeHeads)
      .values({
        schoolId,
        name: "Tuition Fee",
        code: "TUIT",
        category: "RECURRING",
        headType: "TUITION",
        priority: 1,
        isActive: true,
      })
      .returning();

    const [fhAnnual] = await tenantDb
      .insert(feeHeads)
      .values({
        schoolId,
        name: "Annual Development Fee",
        code: "ANNUAL",
        category: "ANNUAL",
        headType: "ADMISSION",
        priority: 2,
        isActive: true,
      })
      .returning();

    const [fhTransport] = await tenantDb
      .insert(feeHeads)
      .values({
        schoolId,
        name: "Transport Fee",
        code: "TRANS",
        category: "RECURRING",
        headType: "TRANSPORT",
        priority: 3,
        isActive: true,
      })
      .returning();

    const primaryFeeStructureIds: string[] = [];
    const classFeeStructureMap = new Map<string, string>();
    for (const c of classGradeLevels) {
      const cId = classMap.get(c.order)!;

      const [fsTuitionQ1] = await tenantDb
        .insert(feeStructures)
        .values({
          schoolId,
          academicYearId,
          classId: cId,
          feeHeadId: fhTuition!.id,
          term: "QUARTERLY",
          amount: "12000.00",
          dueDate: new Date("2026-04-30T23:59:59Z"),
          isActive: true,
        })
        .returning();

      await tenantDb.insert(feeStructures).values([
        {
          schoolId,
          academicYearId,
          classId: cId,
          feeHeadId: fhTuition!.id,
          term: "HALF_YEARLY",
          amount: "24000.00",
          dueDate: new Date("2026-09-30T23:59:59Z"),
          isActive: true,
        },
        {
          schoolId,
          academicYearId,
          classId: cId,
          feeHeadId: fhAnnual!.id,
          term: "ANNUAL",
          amount: "8000.00",
          dueDate: new Date("2026-05-15T23:59:59Z"),
          isActive: true,
        },
        {
          schoolId,
          academicYearId,
          classId: cId,
          feeHeadId: fhTransport!.id,
          term: "QUARTERLY",
          amount: "3000.00",
          dueDate: new Date("2026-04-30T23:59:59Z"),
          isActive: true,
        },
      ]);

      primaryFeeStructureIds.push(fsTuitionQ1!.id);
      classFeeStructureMap.set(cId, fsTuitionQ1!.id);
    }

    // Generate Invoices for all 900 students
    const invoiceRows: any[] = [];
    const paymentRows: any[] = [];
    const accountantUserId = allStaffUsers.find((u) => u.role === "ACCOUNTANT")?.id || allStaffUsers[1]!.id;

    for (let i = 0; i < allStudentsMeta.length; i++) {
      const s = allStudentsMeta[i]!;
      const invNo = `DPA-INV-2026-${String(i + 1).padStart(4, "0")}`;
      const invId = crypto.randomUUID();

      let status: "PAID" | "PENDING" | "OVERDUE";
      let paidAmount = "0.00";
      let balanceAmount = "12000.00";
      let dueDate = new Date("2026-04-30T23:59:59Z");
      let reminderD7 = false;
      let reminderD15 = false;
      let reminderD30 = false;

      if (i < 720) {
        // 80% Paid
        status = "PAID";
        paidAmount = "12000.00";
        balanceAmount = "0.00";

        paymentRows.push({
          id: crypto.randomUUID(),
          receiptNumber: `DPA-RCP-2026-${String(i + 1).padStart(4, "0")}`,
          schoolId,
          studentId: s.id,
          feeInvoiceId: invId,
          amountPaid: "12000.00",
          paymentMethod: i % 3 === 0 ? "UPI" : i % 3 === 1 ? "ONLINE" : "CASH",
          paymentDate: new Date("2026-04-18T10:30:00Z"),
          collectedById: accountantUserId,
          remarks: "Term 1 tuition fee payment",
        });
      } else if (i < 855) {
        // 15% Pending
        status = "PENDING";
        dueDate = new Date("2026-07-31T23:59:59Z");
      } else {
        // 5% Defaulters / Overdue
        status = "OVERDUE";
        dueDate = new Date("2026-04-15T23:59:59Z");
        reminderD7 = true;
        reminderD15 = true;
        reminderD30 = true;
      }

      invoiceRows.push({
        id: invId,
        invoiceNumber: invNo,
        schoolId,
        studentId: s.id,
        academicYearId,
        feeStructureId: classFeeStructureMap.get(s.classId) || primaryFeeStructureIds[0]!,
        grossAmount: "12000.00",
        discountAmount: "0.00",
        lateFeeAmount: status === "OVERDUE" ? "500.00" : "0.00",
        taxAmount: "0.00",
        netAmount: status === "OVERDUE" ? "12500.00" : "12000.00",
        paidAmount,
        balanceAmount: status === "OVERDUE" ? "12500.00" : balanceAmount,
        dueDate,
        status,
        term: "QUARTERLY",
        reminderSentD7: reminderD7,
        reminderSentD15: reminderD15,
        reminderSentD30: reminderD30,
      });
    }

    for (const chunk of chunkArray(invoiceRows, 300)) {
      await tenantDb.insert(feeInvoices).values(chunk);
    }
    for (const chunk of chunkArray(paymentRows, 300)) {
      await tenantDb.insert(feePayments).values(chunk);
    }

    const feeInvoicesCount = invoiceRows.length; // 900
    const feePaymentsCount = paymentRows.length; // 720

    // 13. Academic Term Activity: 45 Days of Attendance (~94% presence)
    const schoolDates: Date[] = [];
    const curDate = new Date("2026-04-06T00:00:00Z");
    while (schoolDates.length < 45) {
      const day = curDate.getUTCDay();
      if (day !== 0 && day !== 6) {
        schoolDates.push(new Date(curDate.getTime()));
      }
      curDate.setUTCDate(curDate.getUTCDate() + 1);
    }

    const attendanceBatch: any[] = [];
    const sectionTeacherMap = new Map<string, string>();
    for (const s of allSectionsMeta) {
      sectionTeacherMap.set(s.id, s.classTeacherUserId);
    }

    for (let dIdx = 0; dIdx < schoolDates.length; dIdx++) {
      const attDate = schoolDates[dIdx]!;
      for (let sIdx = 0; sIdx < allStudentsMeta.length; sIdx++) {
        const std = allStudentsMeta[sIdx]!;
        const hash = (sIdx * 37 + dIdx * 13) % 100;
        const status = hash < 94 ? "PRESENT" : hash < 98 ? "ABSENT" : "LEAVE";
        const teacherId = sectionTeacherMap.get(std.sectionId) || staffTeacherUserIds[0]!;

        attendanceBatch.push({
          schoolId,
          studentId: std.id,
          sectionId: std.sectionId,
          academicYearId,
          attendanceDate: attDate,
          status,
          source: "ROUTINE",
          markedById: teacherId,
          remarks: status === "ABSENT" ? "Absent without prior intimation" : null,
        });
      }
    }

    for (const chunk of chunkArray(attendanceBatch, 1000)) {
      await tenantDb.insert(studentAttendance).values(chunk);
    }

    const attendanceRecordsCount = attendanceBatch.length; // 40,500

    // 14. Homework Assignments, Submissions & Graded Feedback
    const homeworkConfigs = [
      { classOrder: 10, title: "Quadratic Equations Problem Set 1", subject: "MATH", desc: "Solve problems 1 to 10 from NCERT Chapter 4 Exercise 4.2." },
      { classOrder: 10, title: "Chemical Reactions Lab Worksheet", subject: "SCI", desc: "Complete observations table on displacement reactions." },
      { classOrder: 9, title: "Essay on Environmental Conservation", subject: "ENG", desc: "Write a 300-word essay on reducing single-use plastics." },
      { classOrder: 8, title: "Linear Equations Practice Sheet", subject: "MATH", desc: "Solve all problems on linear equations in one variable." },
      { classOrder: 7, title: "Nutrition in Plants Diagram", subject: "SCI", desc: "Draw and label the stomata and photosynthesis process." },
      { classOrder: 6, title: "Major Landforms of the Earth", subject: "SST", desc: "Answer questions on plateaus, mountains, and plains." },
      { classOrder: 5, title: "Fractions & Decimals Exercise", subject: "MATH", desc: "Exercise 3.1 word problems on fraction addition." },
      { classOrder: 4, title: "Poetry Comprehension Worksheet", subject: "ENG", desc: "Read 'The Mountain and the Squirrel' and answer questions." },
      { classOrder: 3, title: "Water Cycle Observation Diary", subject: "EVS", desc: "Document everyday observations of evaporation and condensation." },
      { classOrder: 2, title: "Addition with Regrouping Sheet", subject: "MATH", desc: "Complete the 2-digit addition worksheet." },
    ];

    for (const hw of homeworkConfigs) {
      const cId = classMap.get(hw.classOrder)!;
      const secA = allSectionsMeta.find((s) => s.classId === cId && s.sectionName === "A")!;
      const cs = classSubjectRecords.find((r) => r.classId === cId && r.subjectId === subjectMap.get(hw.subject))!;

      const [assign] = await tenantDb
        .insert(assignments)
        .values({
          schoolId,
          classSubjectId: cs.id,
          sectionId: secA.id,
          createdByTeacherId: secA.classTeacherUserId,
          title: hw.title,
          description: hw.desc,
          maxMarks: 20,
          dueDate: new Date("2026-05-15T18:00:00Z"),
          status: "GRADED",
        })
        .returning();

      const secStudents = allStudentsMeta.filter((s) => s.sectionId === secA.id).slice(0, 5);
      for (const st of secStudents) {
        await tenantDb.insert(assignmentSubmissions).values({
          assignmentId: assign!.id,
          studentId: st.id,
          schoolId,
          submittedAt: new Date("2026-05-12T14:30:00Z"),
          studentContent: `Completed all assigned questions for ${hw.title}. Checked answers thoroughly.`,
          marksAwarded: 18,
          remarks: "Excellent work! Clear steps and neat presentation.",
          gradedByTeacherId: secA.classTeacherUserId,
          gradedAt: new Date("2026-05-14T10:00:00Z"),
        });
      }
    }

    // 15. Mid-Term Exam (Term 1 Exam), Marks Entries, Locks & Report Cards
    const [examTypeHalfYearly] = await tenantDb
      .insert(examTypes)
      .values({
        schoolId,
        name: "Half-Yearly Examination",
        code: "HY",
        examType: "HALF_YEARLY",
        weightagePercent: "40.00",
        isActive: true,
      })
      .returning();

    const principalUserId = allStaffUsers.find((u) => u.role === "PRINCIPAL")!.id;

    const [examMidTerm] = await tenantDb
      .insert(exams)
      .values({
        schoolId,
        academicYearId,
        examTypeId: examTypeHalfYearly!.id,
        name: "Mid-Term Examination 2026",
        startDate: new Date("2026-09-15T09:00:00Z"),
        endDate: new Date("2026-09-25T12:00:00Z"),
        isLocked: true,
        lockedById: principalUserId,
        lockedAt: new Date("2026-09-28T16:00:00Z"),
      })
      .returning();

    const [compTheory] = await tenantDb
      .insert(examComponents)
      .values({
        schoolId,
        examId: examMidTerm!.id,
        examTypeId: examTypeHalfYearly!.id,
        displayName: "Theory",
        weightPercent: "80.00",
        sortOrder: 1,
      })
      .returning();

    const scheduledSubjectCodes = ["ENG", "MATH", "SCI", "HIN", "SST"];
    const examClassScopeRows: any[] = [];
    const examMarksLockRows: any[] = [];
    const examScheduleRows: any[] = [];

    for (const c of classGradeLevels) {
      const cId = classMap.get(c.order)!;
      examClassScopeRows.push({
        schoolId,
        examId: examMidTerm!.id,
        classId: cId,
      });

      for (let i = 0; i < scheduledSubjectCodes.length; i++) {
        const scCode = scheduledSubjectCodes[i]!;
        const subId = subjectMap.get(scCode)!;

        examMarksLockRows.push({
          schoolId,
          examId: examMidTerm!.id,
          classId: cId,
          subjectId: subId,
          status: "LOCKED",
          lockedById: principalUserId,
          lockedAt: new Date("2026-09-28T16:00:00Z"),
        });

        examScheduleRows.push({
          schoolId,
          examId: examMidTerm!.id,
          subjectId: subId,
          classId: cId,
          examDate: `2026-09-${String(16 + i).padStart(2, "0")}`,
          startTime: "09:00:00",
          durationMinutes: 180,
          maxMarks: "100.00",
          passingMarks: "33.00",
          roomNumber: "Examination Hall A",
        });
      }
    }

    await tenantDb.insert(examClassScopes).values(examClassScopeRows);
    await tenantDb.insert(examMarksLocks).values(examMarksLockRows);
    await tenantDb.insert(examSchedules).values(examScheduleRows);

    const markEntryRows: any[] = [];
    const engId = subjectMap.get("ENG")!;
    const mathId = subjectMap.get("MATH")!;

    for (let sIdx = 0; sIdx < allStudentsMeta.length; sIdx++) {
      const st = allStudentsMeta[sIdx]!;
      const engScore = 65 + ((sIdx * 19) % 32);
      const mathScore = 60 + ((sIdx * 23) % 38);

      markEntryRows.push(
        {
          schoolId,
          examId: examMidTerm!.id,
          studentId: st.id,
          subjectId: engId,
          componentId: compTheory!.id,
          marksObtained: String(engScore),
          maxMarks: "100.00",
          grade: engScore >= 90 ? "A1" : engScore >= 80 ? "A2" : "B1",
          status: "LOCKED",
          enteredById: principalUserId,
        },
        {
          schoolId,
          examId: examMidTerm!.id,
          studentId: st.id,
          subjectId: mathId,
          componentId: compTheory!.id,
          marksObtained: String(mathScore),
          maxMarks: "100.00",
          grade: mathScore >= 90 ? "A1" : mathScore >= 80 ? "A2" : "B1",
          status: "LOCKED",
          enteredById: principalUserId,
        }
      );
    }

    for (const chunk of chunkArray(markEntryRows, 500)) {
      await tenantDb.insert(markEntries).values(chunk);
    }

    // 16. Report Card Snapshots for all 900 students
    const reportCardRows: any[] = [];
    for (let sIdx = 0; sIdx < allStudentsMeta.length; sIdx++) {
      const st = allStudentsMeta[sIdx]!;
      const rank = (sIdx % 30) + 1;
      const overallGrade = rank <= 5 ? "A1" : rank <= 15 ? "A2" : "B1";

      reportCardRows.push({
        schoolId,
        studentId: st.id,
        academicYearId,
        examId: examMidTerm!.id,
        gradeData: {
          english: 75 + ((sIdx * 7) % 20),
          mathematics: 70 + ((sIdx * 11) % 25),
          science: 72 + ((sIdx * 13) % 23),
          total: 217,
          maxTotal: 300,
          percentage: 72.3,
        },
        overallGrade,
        rank,
        attendancePercent: "94.50",
        teacherRemarks: "Regular in class and shows keen interest in learning.",
        principalRemarks: "Promoted to next term with commendation.",
        generatedAt: new Date("2026-09-30T10:00:00Z"),
        generatedById: principalUserId,
      });
    }

    for (const chunk of chunkArray(reportCardRows, 450)) {
      await tenantDb.insert(reportCards).values(chunk);
    }

    const examSnapshotsCount = reportCardRows.length; // 900

    // 17. Seed North-Star Telemetry (Synthetic onboarding duration 0.85 working days)
    const adminUserId = allStaffUsers.find((u) => u.role === "SCHOOL_ADMIN")!.id;

    await tenantDb.insert(usageEvents).values([
      {
        schoolId,
        screen: "/onboard",
        elementId: "tenant_provisioning",
        elementLabel: "Provision Tenant",
        action: "submit",
        role: "SUPER_ADMIN",
        userId: adminUserId,
        createdAt: new Date("2026-04-01T08:00:00Z"),
      },
      {
        schoolId,
        screen: "/attendance",
        elementId: "first_live_attendance",
        elementLabel: "First Live Attendance Submission",
        action: "submit",
        role: "TEACHER",
        userId: staffTeacherUserIds[0]!,
        createdAt: new Date("2026-04-01T15:08:30Z"),
      },
    ]);

    await recordOnboardingDays(
      {
        schoolId,
        userId: adminUserId,
        role: "SUPER_ADMIN",
        tenantId: schoolId,
        workingDaysElapsed: 0.85,
        firstAttendanceMarked: true,
      },
      tenantDb
    );

    await recordJourneyCompletion(
      {
        schoolId,
        userId: adminUserId,
        role: "SUPER_ADMIN",
        journeyId: "J10_school_onboarding",
        durationMs: Math.round(0.85 * 8.5 * 3600 * 1000), // ~26,010,000 ms
        completed: true,
        finishedState: "A new school opens on day one and takes attendance with real data.",
      },
      tenantDb
    );

    return {
      schoolId,
      academicYearId,
      classesCount,
      sectionsCount,
      studentsCount,
      staffCount,
      feeInvoicesCount,
      feePaymentsCount,
      attendanceRecordsCount,
      timetablePeriodsCount,
      examSnapshotsCount,
      claimedCount,
      pendingCount,
    };
  });
}

// Runnable CLI execution entry point
if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("demoTenantSeeder.ts"))) {
  seedDemoTenant()
    .then((res) => {
      console.log("=================================================");
      console.log("✅ Delhi Public Academy [DEMO] Seeded Successfully");
      console.log("=================================================");
      console.log(`School ID:              ${res.schoolId}`);
      console.log(`Academic Year ID:       ${res.academicYearId}`);
      console.log(`Classes:                ${res.classesCount}`);
      console.log(`Sections:               ${res.sectionsCount}`);
      console.log(`Staff Members:          ${res.staffCount}`);
      console.log(`Students:               ${res.studentsCount}`);
      console.log(`Parent Claims (Claimed):${res.claimedCount}`);
      console.log(`Parent Claims (Pending):${res.pendingCount}`);
      console.log(`Fee Invoices:           ${res.feeInvoicesCount}`);
      console.log(`Fee Payments / Receipts:${res.feePaymentsCount}`);
      console.log(`Attendance Records:     ${res.attendanceRecordsCount}`);
      console.log(`Timetable Periods:      ${res.timetablePeriodsCount}`);
      console.log(`Exam Snapshots:         ${res.examSnapshotsCount}`);
      console.log("=================================================");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Failed to seed demo tenant:", err);
      process.exit(1);
    });
}
