"use server";

import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  subjects,
  feeHeads,
  feeStructures,
  salaryTemplates,
  events,
  schoolProvisions,
  bellSchedule,
  timetablePeriods,
  sectionSubjectTeachers,
  students,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { z } from "zod";
import {
  createSchoolSchema,
  createAcademicYearSchema,
  schoolProfileUpdateSchema,
  type SchoolProfileUpdateInput,
} from "@schoolmitra/validators";
import {
  calculateSchoolProfileCompleteness,
  type CompletenessResult,
} from "@/lib/profileCompleteness";
import { uploadBufferToS3, getPresignedDownloadUrl } from "@/lib/storage";
import { revalidatePath, revalidateTag } from "next/cache";

const wizardSchema = createSchoolSchema.and(
  z.object({
    academicYearLabel: createAcademicYearSchema.shape.label,
    academicYearStart: createAcademicYearSchema.shape.startDate,
    academicYearEnd: createAcademicYearSchema.shape.endDate,
  })
);

export async function getSchoolProfile() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const school = await requireSchool(ctx);

  const schoolRecord = await db.query.schools.findFirst({
    where: eq(schools.id, school.id),
  });

  if (!schoolRecord) {
    throw new Error("School not found");
  }

  let logoUrl: string | null = null;
  if (schoolRecord.logoS3Key) {
    try {
      logoUrl = await getPresignedDownloadUrl(schoolRecord.logoS3Key, 900);
    } catch (e) {
      console.error("Failed to generate presigned url for school logo:", e);
    }
  }

  const completeness: CompletenessResult = calculateSchoolProfileCompleteness({
    name: schoolRecord.name,
    address: schoolRecord.address,
    city: schoolRecord.city,
    state: schoolRecord.state,
    pincode: schoolRecord.pincode,
    phone: schoolRecord.phone,
    email: schoolRecord.email,
    principalName: schoolRecord.principalName,
    establishedYear: schoolRecord.establishedYear,
    board: schoolRecord.board,
    udiseCode: schoolRecord.udiseCode,
    logoS3Key: schoolRecord.logoS3Key,
    themeColors: schoolRecord.themeColors,
    website: schoolRecord.website,
    motto: schoolRecord.motto,
    about: schoolRecord.about,
    socialHandles: schoolRecord.socialHandles,
  });

  return {
    school: {
      ...schoolRecord,
      logoUrl,
    },
    completeness,
  };
}

export async function updateSchoolProfile(data: SchoolProfileUpdateInput) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const school = await requireSchool(ctx);

  let validated;
  try {
    validated = schoolProfileUpdateSchema.parse(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      throw new Error(err.issues[0]?.message || "Validation failed on school profile fields.");
    }
    throw err;
  }

  // Strip prohibited keys at runtime to guarantee invariant
  const updatePayload: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updatePayload.name = validated.name;
  if (validated.board !== undefined) updatePayload.board = validated.board;
  if (validated.udiseCode !== undefined) updatePayload.udiseCode = validated.udiseCode;
  if (validated.address !== undefined) updatePayload.address = validated.address;
  if (validated.city !== undefined) updatePayload.city = validated.city;
  if (validated.state !== undefined) updatePayload.state = validated.state;
  if (validated.pincode !== undefined) updatePayload.pincode = validated.pincode;
  if (validated.phone !== undefined) updatePayload.phone = validated.phone;
  if (validated.email !== undefined) updatePayload.email = validated.email;
  if (validated.principalName !== undefined) updatePayload.principalName = validated.principalName;
  if (validated.establishedYear !== undefined) updatePayload.establishedYear = validated.establishedYear;
  if (validated.website !== undefined) updatePayload.website = validated.website;
  if (validated.motto !== undefined) updatePayload.motto = validated.motto;
  if (validated.about !== undefined) updatePayload.about = validated.about;
  if (validated.socialHandles !== undefined) updatePayload.socialHandles = validated.socialHandles;
  if (validated.themeColors !== undefined) updatePayload.themeColors = validated.themeColors;

  await db
    .update(schools)
    .set(updatePayload)
    .where(eq(schools.id, school.id));

  revalidatePath("/(admin)/settings/school-setup");
  revalidatePath("/(admin)/dashboard");

  return await getSchoolProfile();
}

export async function uploadSchoolLogo(formData: FormData) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const school = await requireSchool(ctx);

  const file = formData.get("logo") as File | null;
  if (!file) {
    throw new Error("No file provided");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid image format. Allowed formats: PNG, JPEG, WebP, SVG.");
  }

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo image must be smaller than 2MB.");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const s3Key = `${school.id}/branding/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadResult = await uploadBufferToS3(s3Key, buffer, file.type);
  if (!uploadResult.success) {
    throw new Error(uploadResult.error || "Failed to upload logo to storage.");
  }

  await db
    .update(schools)
    .set({
      logoS3Key: s3Key,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, school.id));

  revalidatePath("/(admin)/settings/school-setup");
  revalidatePath("/(admin)/dashboard");

  return await getSchoolProfile();
}

/**
 * setupSchool
 * Updates school institutional identity and initializes active academic year.
 * ENFORCES ACADEMIC YEAR GUARD (F17):
 * Deactivates existing active academic years before activating the target year,
 * guaranteeing exactly one active academic year per tenant school.
 */
export async function setupSchool(data: z.infer<typeof wizardSchema>) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const school = await requireSchool(ctx);

  const validatedData = wizardSchema.parse(data);

  // 1. Update school basic info
  await db
    .update(schools)
    .set({
      name: validatedData.name,
      address: validatedData.address,
      city: validatedData.city,
      state: validatedData.state,
      pincode: validatedData.pincode,
      phone: validatedData.phone,
      email: validatedData.email,
      principalName: validatedData.principalName,
      establishedYear: validatedData.establishedYear,
      board: validatedData.board,
      udiseCode: validatedData.udiseCode,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, school.id));

  // 2. Academic Year Guard: Deactivate any existing active academic year for this school
  await db
    .update(academicYears)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(academicYears.schoolId, school.id),
        eq(academicYears.isActive, true)
      )
    );

  // 3. Idempotently upsert the target academic year avoiding unique constraint collision
  const existingYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.schoolId, school.id),
      eq(academicYears.label, validatedData.academicYearLabel)
    ),
  });

  if (existingYear) {
    await db
      .update(academicYears)
      .set({
        startDate: new Date(validatedData.academicYearStart),
        endDate: new Date(validatedData.academicYearEnd),
        isActive: true,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(academicYears.id, existingYear.id));
  } else {
    await db.insert(academicYears).values({
      schoolId: school.id,
      label: validatedData.academicYearLabel,
      startDate: new Date(validatedData.academicYearStart),
      endDate: new Date(validatedData.academicYearEnd),
      isActive: true,
    });
  }

  revalidatePath("/(admin)/settings/school-setup");
  revalidatePath("/(admin)/dashboard");

  return { success: true };
}

export interface Milestone {
  key: string;
  name: string;
  isComplete: boolean;
  metric: string;
}

export interface OperationalMilestone {
  key: "bellSchedulePeriods" | "sectionsWithTimetable" | "feePricing" | "teacherAllocations" | "studentEnrollment";
  name: string;
  isComplete: boolean;
  status: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
  metric: string;
  details?: Record<string, any>;
}

export interface ConfigurationHealthStats {
  isProvisioned: boolean;
  provisionedAt?: string | undefined;
  blueprintVersion?: string | undefined;
  // Dual Scores
  configurationScore: number;
  operationalScore: number;
  overallScore: number; // Backward compatibility alias to configurationScore
  isOperationallyReady: boolean;
  // Milestone Breakdown Lists
  configurationMilestones: Milestone[];
  operationalMilestones: OperationalMilestone[];
  // Configuration Counts
  classesCount: number;
  sectionsCount: number;
  subjectsCount: number;
  feeHeadsCount: number;
  salaryTemplatesCount: number;
  holidaysCount: number;
  hasActiveAcademicYear: boolean;
  // Operational Counts
  bellScheduleCount: number;
  totalActiveSections: number;
  sectionsWithTimetableCount: number;
  pricedFeeHeadsCount: number;
  unpricedFeeHeadsCount: number;
  activeTeacherAllocationsCount: number;
  enrolledStudentsCount: number;
  // Setup Hub Category Cards
  categories: {
    key: string;
    title: string;
    description: string;
    href: string;
    secondaryHref?: string;
    secondaryLabel?: string;
    status: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
    metric: string;
    nextBestAction?: {
      label: string;
      href: string;
    };
  }[];
}

/**
 * getSchoolConfigurationHealthAction
 * Returns both configuration completeness score (6 milestones) and operational readiness score (5 milestones).
 * Enforces Honesty Law: isOperationallyReady strictly requires ALL 5 operational milestones to be green (operationalScore === 100).
 */
export async function getSchoolConfigurationHealthAction(): Promise<ConfigurationHealthStats> {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const school = await requireSchool(ctx);

  // Parallelized execution of all 13 tenant health queries
  const [
    [activeYearRes],
    [classesRes],
    [sectionsRes],
    [subjectsRes],
    [feeHeadsRes],
    [salaryRes],
    [holidaysRes],
    provision,
    [bellRes],
    [timetableSectionsRes],
    [pricedFeeHeadsRes],
    [teacherAllocationsRes],
    [studentsRes],
  ] = await Promise.all([
    // 1. Active Academic Year
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isActive, true))),

    // 2. Classes (active)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes)
      .where(and(eq(classes.schoolId, school.id), eq(classes.isActive, true))),

    // 3. Sections (active, not deleted)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sections)
      .where(
        and(
          eq(sections.schoolId, school.id),
          eq(sections.isActive, true),
          sql`${sections.deletedAt} IS NULL`
        )
      ),

    // 4. Subjects
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(subjects)
      .where(eq(subjects.schoolId, school.id)),

    // 5. Fee Heads (active, not deleted)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(feeHeads)
      .where(
        and(
          eq(feeHeads.schoolId, school.id),
          eq(feeHeads.isActive, true),
          sql`${feeHeads.deletedAt} IS NULL`
        )
      ),

    // 6. Salary Templates
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(salaryTemplates)
      .where(eq(salaryTemplates.schoolId, school.id)),

    // 7. Holidays & Closures
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.schoolId, school.id), eq(events.eventType, "HOLIDAY" as any))),

    // 8. Provision record
    db.query.schoolProvisions.findFirst({
      where: eq(schoolProvisions.schoolId, school.id),
    }),

    // 9. Operational Milestone A: Bell Schedule Periods (active)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bellSchedule)
      .where(and(eq(bellSchedule.schoolId, school.id), eq(bellSchedule.isActive, true))),

    // 10. Operational Milestone B: Sections with published/active Timetable Periods
    db
      .select({
        count: sql<number>`count(distinct ${timetablePeriods.sectionId})::int`,
      })
      .from(timetablePeriods)
      .innerJoin(sections, eq(timetablePeriods.sectionId, sections.id))
      .where(
        and(
          eq(timetablePeriods.schoolId, school.id),
          eq(timetablePeriods.isActive, true),
          eq(sections.isActive, true),
          sql`${sections.deletedAt} IS NULL`
        )
      ),

    // 11. Operational Milestone C: Priced Fee Heads (amount > 0)
    db
      .select({
        count: sql<number>`count(distinct ${feeStructures.feeHeadId})::int`,
      })
      .from(feeStructures)
      .innerJoin(feeHeads, eq(feeStructures.feeHeadId, feeHeads.id))
      .where(
        and(
          eq(feeStructures.schoolId, school.id),
          eq(feeStructures.isActive, true),
          sql`${feeStructures.deletedAt} IS NULL`,
          sql`CAST(${feeStructures.amount} AS NUMERIC) > 0`,
          eq(feeHeads.isActive, true),
          sql`${feeHeads.deletedAt} IS NULL`
        )
      ),

    // 12. Operational Milestone D: Teacher Allocations (active sectionSubjectTeachers)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sectionSubjectTeachers)
      .where(
        and(
          eq(sectionSubjectTeachers.schoolId, school.id),
          eq(sectionSubjectTeachers.isActive, true)
        )
      ),

    // 13. Operational Milestone E: Student Enrollment (active enrolled students)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(
        and(
          eq(students.schoolId, school.id),
          eq(students.isActive, true),
          sql`${students.deletedAt} IS NULL`
        )
      ),
  ]);

  // Derived Counts
  const hasActiveYear = (activeYearRes?.count ?? 0) > 0;
  const classesCount = classesRes?.count ?? 0;
  const sectionsCount = sectionsRes?.count ?? 0;
  const subjectsCount = subjectsRes?.count ?? 0;
  const totalActiveFeeHeads = feeHeadsRes?.count ?? 0;
  const salaryTemplatesCount = salaryRes?.count ?? 0;
  const holidaysCount = holidaysRes?.count ?? 0;

  // Operational Counts
  const bellScheduleCount = bellRes?.count ?? 0;
  const totalActiveSections = sectionsCount;
  const sectionsWithTimetableCount = timetableSectionsRes?.count ?? 0;
  const pricedFeeHeadsCount = pricedFeeHeadsRes?.count ?? 0;
  const unpricedFeeHeadsCount = Math.max(0, totalActiveFeeHeads - pricedFeeHeadsCount);
  const activeTeacherAllocationsCount = teacherAllocationsRes?.count ?? 0;
  const enrolledStudentsCount = studentsRes?.count ?? 0;

  // ─── 1. Configuration Completeness (6 Milestones) ───────────────────────────
  let completedConfigMilestones = 0;
  if (hasActiveYear) completedConfigMilestones++;
  if (classesCount > 0) completedConfigMilestones++;
  if (subjectsCount > 0) completedConfigMilestones++;
  if (totalActiveFeeHeads > 0) completedConfigMilestones++;
  if (salaryTemplatesCount > 0) completedConfigMilestones++;
  if (holidaysCount > 0) completedConfigMilestones++;

  const configurationScore = Math.round((completedConfigMilestones / 6) * 100);

  const configurationMilestones: Milestone[] = [
    {
      key: "academicCalendar",
      name: "Academic Calendar & Active Year",
      isComplete: hasActiveYear,
      metric: hasActiveYear ? "Active Session Set" : "Session Missing",
    },
    {
      key: "classesSections",
      name: "Classes & Sections Hierarchy",
      isComplete: classesCount > 0,
      metric: `${classesCount} Classes • ${totalActiveSections} Sections`,
    },
    {
      key: "curriculumSubjects",
      name: "Curriculum & Subjects",
      isComplete: subjectsCount > 0,
      metric: `${subjectsCount} Subjects Configured`,
    },
    {
      key: "feeHeads",
      name: "Fee Heads Definition",
      isComplete: totalActiveFeeHeads > 0,
      metric: `${totalActiveFeeHeads} Fee Heads Defined`,
    },
    {
      key: "salaryTemplates",
      name: "HR Salary Templates",
      isComplete: salaryTemplatesCount > 0,
      metric: `${salaryTemplatesCount} Templates Defined`,
    },
    {
      key: "holidays",
      name: "Holidays & Closures",
      isComplete: holidaysCount > 0,
      metric: `${holidaysCount} Holidays Scheduled`,
    },
  ];

  // ─── 2. Operational Readiness (5 Milestones) ────────────────────────────────
  const isBellScheduleComplete = bellScheduleCount > 0;
  const isSectionsWithTimetableComplete =
    totalActiveSections > 0 && sectionsWithTimetableCount === totalActiveSections;
  const isFeePricingComplete =
    totalActiveFeeHeads > 0 && pricedFeeHeadsCount === totalActiveFeeHeads;
  const isTeacherAllocationsComplete = activeTeacherAllocationsCount > 0;
  const isStudentEnrollmentComplete = enrolledStudentsCount > 0;

  let completedOperationalMilestones = 0;
  if (isBellScheduleComplete) completedOperationalMilestones++;
  if (isSectionsWithTimetableComplete) completedOperationalMilestones++;
  if (isFeePricingComplete) completedOperationalMilestones++;
  if (isTeacherAllocationsComplete) completedOperationalMilestones++;
  if (isStudentEnrollmentComplete) completedOperationalMilestones++;

  const operationalScore = Math.round((completedOperationalMilestones / 5) * 100);
  const isOperationallyReady = completedOperationalMilestones === 5; // strictly operationalScore === 100

  const operationalMilestones: OperationalMilestone[] = [
    {
      key: "bellSchedulePeriods",
      name: "Bell Schedule Periods",
      isComplete: isBellScheduleComplete,
      status: isBellScheduleComplete ? "COMPLETE" : "NOT_STARTED",
      metric: isBellScheduleComplete ? `${bellScheduleCount} Periods Active` : "0 Periods Active",
      details: { count: bellScheduleCount },
    },
    {
      key: "sectionsWithTimetable",
      name: "Timetable Published Coverage",
      isComplete: isSectionsWithTimetableComplete,
      status: isSectionsWithTimetableComplete
        ? "COMPLETE"
        : sectionsWithTimetableCount > 0
        ? "PARTIAL"
        : "NOT_STARTED",
      metric: `${sectionsWithTimetableCount}/${totalActiveSections} Sections Scheduled`,
      details: {
        sectionsWithTimetable: sectionsWithTimetableCount,
        totalActiveSections,
      },
    },
    {
      key: "feePricing",
      name: "Fee Structure Pricing",
      isComplete: isFeePricingComplete,
      status: isFeePricingComplete
        ? "COMPLETE"
        : totalActiveFeeHeads > 0
        ? "PARTIAL"
        : "NOT_STARTED",
      metric: `${pricedFeeHeadsCount}/${totalActiveFeeHeads} Heads Priced`,
      details: {
        pricedFeeHeads: pricedFeeHeadsCount,
        unpricedFeeHeads: unpricedFeeHeadsCount,
        totalActiveFeeHeads,
      },
    },
    {
      key: "teacherAllocations",
      name: "Teacher Section Allocations",
      isComplete: isTeacherAllocationsComplete,
      status: isTeacherAllocationsComplete ? "COMPLETE" : "NOT_STARTED",
      metric: isTeacherAllocationsComplete
        ? `${activeTeacherAllocationsCount} Active Allocations`
        : "0 Allocations",
      details: { count: activeTeacherAllocationsCount },
    },
    {
      key: "studentEnrollment",
      name: "Student Enrollment",
      isComplete: isStudentEnrollmentComplete,
      status: isStudentEnrollmentComplete ? "COMPLETE" : "NOT_STARTED",
      metric: isStudentEnrollmentComplete
        ? `${enrolledStudentsCount} Enrolled Students`
        : "0 Enrolled Students",
      details: { count: enrolledStudentsCount },
    },
  ];

  // ─── 3. Grouped Setup Category Cards (8 Categories - F15, F16) ──────────────
  const categories = [
    {
      key: "academic-calendar",
      title: "Academic Calendar & Terms",
      description: "Active academic session, term boundaries, and calendar schedule.",
      href: "/settings/calendar",
      status: hasActiveYear ? ("COMPLETE" as const) : ("NOT_STARTED" as const),
      metric: hasActiveYear ? "Active Session Set" : "Session Missing",
    },
    {
      key: "classes-sections",
      title: "Classes & Sections",
      description: "Grade hierarchy, class names, and active sections.",
      href: "/settings/classes",
      status:
        classesCount > 0
          ? totalActiveSections > 0
            ? ("COMPLETE" as const)
            : ("PARTIAL" as const)
          : ("NOT_STARTED" as const),
      metric: `${classesCount} Classes • ${totalActiveSections} Sections`,
    },
    {
      key: "curriculum-subjects",
      title: "Curriculum & Subjects",
      description: "Class-wise theory, practical, language, and co-scholastic subjects.",
      href: "/settings/subjects",
      status: subjectsCount > 0 ? ("COMPLETE" as const) : ("NOT_STARTED" as const),
      metric: `${subjectsCount} Subjects Configured`,
    },
    {
      key: "fee-structures",
      title: "Fee Structures & Heads",
      description: "Tuition, transport, lab fees and chart-of-accounts mapping.",
      href: "/school/fee-structures",
      status: isFeePricingComplete
        ? ("COMPLETE" as const)
        : totalActiveFeeHeads > 0
        ? ("PARTIAL" as const)
        : ("NOT_STARTED" as const),
      metric: `${pricedFeeHeadsCount}/${totalActiveFeeHeads} Heads Priced (${unpricedFeeHeadsCount} Unpriced)`,
      nextBestAction: {
        label: "Configure Pricing at /finance/fees",
        href: "/finance/fees",
      },
    },
    {
      key: "timetable-bell-schedule",
      title: "Timetable & Bell Schedule",
      description: "Daily bell schedule period slots and section timetable published coverage.",
      href: "/academics/timetable",
      status:
        isBellScheduleComplete && isSectionsWithTimetableComplete
          ? ("COMPLETE" as const)
          : isBellScheduleComplete || sectionsWithTimetableCount > 0
          ? ("PARTIAL" as const)
          : ("NOT_STARTED" as const),
      metric: `${bellScheduleCount} Periods • ${sectionsWithTimetableCount}/${totalActiveSections} Timetables`,
      nextBestAction: {
        label: "Open Timetable Builder",
        href: "/academics/timetable",
      },
    },
    {
      key: "enrollment-allocations",
      title: "Enrollment & Allocations",
      description: "Active enrolled students and subject-teacher section assignments.",
      href: "/students",
      secondaryHref: "/academics",
      secondaryLabel: "Allocations",
      status:
        isStudentEnrollmentComplete && isTeacherAllocationsComplete
          ? ("COMPLETE" as const)
          : isStudentEnrollmentComplete || activeTeacherAllocationsCount > 0
          ? ("PARTIAL" as const)
          : ("NOT_STARTED" as const),
      metric: `${enrolledStudentsCount} Students • ${activeTeacherAllocationsCount} Allocations`,
      nextBestAction: {
        label: "Open Universal Import",
        href: "/school/import-center",
      },
    },
    {
      key: "hr-payroll",
      title: "HR Salary Grades",
      description: "Salary templates, standard allowances, and deductions.",
      href: "/settings/hr/salary-grades",
      status: salaryTemplatesCount > 0 ? ("COMPLETE" as const) : ("NOT_STARTED" as const),
      metric: `${salaryTemplatesCount} Templates Defined`,
    },
    {
      key: "calendar-holidays",
      title: "Holidays & Closures",
      description: "National, gazetted, and school-specific holiday schedule.",
      href: "/settings/calendar",
      status: holidaysCount > 0 ? ("COMPLETE" as const) : ("NOT_STARTED" as const),
      metric: `${holidaysCount} Holidays Scheduled`,
    },
  ];

  return {
    isProvisioned: !!provision,
    provisionedAt: provision?.provisionedAt ? new Date(provision.provisionedAt).toISOString() : undefined,
    blueprintVersion: provision?.blueprintVersion,
    configurationScore,
    operationalScore,
    overallScore: configurationScore, // backward compatibility
    isOperationallyReady,
    classesCount,
    sectionsCount: totalActiveSections,
    subjectsCount,
    feeHeadsCount: totalActiveFeeHeads,
    salaryTemplatesCount,
    holidaysCount,
    hasActiveAcademicYear: hasActiveYear,
    bellScheduleCount,
    totalActiveSections,
    sectionsWithTimetableCount,
    pricedFeeHeadsCount,
    unpricedFeeHeadsCount,
    activeTeacherAllocationsCount,
    enrolledStudentsCount,
    configurationMilestones,
    operationalMilestones,
    categories,
  };
}
