"use server";

import { db } from "@/db";
import { schools, academicYears } from "@/db/schema";
import { eq } from "drizzle-orm";
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

export async function setupSchool(data: z.infer<typeof wizardSchema>) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const school = await requireSchool(ctx);

  const validatedData = wizardSchema.parse(data);

  // Update school basic info
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

  // Insert the academic year
  await db.insert(academicYears).values({
    schoolId: school.id,
    label: validatedData.academicYearLabel,
    startDate: new Date(validatedData.academicYearStart),
    endDate: new Date(validatedData.academicYearEnd),
    isActive: true,
  });

  revalidatePath("/(admin)/settings/school-setup");
  revalidatePath("/(admin)/dashboard");

  return { success: true };
}

export interface ConfigurationHealthStats {
  isProvisioned: boolean;
  provisionedAt?: string | undefined;
  blueprintVersion?: string | undefined;
  overallScore: number;
  classesCount: number;
  sectionsCount: number;
  subjectsCount: number;
  feeHeadsCount: number;
  salaryTemplatesCount: number;
  holidaysCount: number;
  hasActiveAcademicYear: boolean;
  categories: {
    key: string;
    title: string;
    description: string;
    href: string;
    status: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
    metric: string;
  }[];
}

export async function getSchoolConfigurationHealthAction(): Promise<ConfigurationHealthStats> {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const school = await requireSchool(ctx);

  const {
    classes,
    sections,
    subjects,
    feeHeads,
    salaryTemplates,
    events,
    schoolProvisions,
  } = await import("@/db/schema");
  const { sql, and } = await import("drizzle-orm");

  // Query counts within school tenant context
  const [activeYear] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isActive, true)));

  const [classesRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classes)
    .where(eq(classes.schoolId, school.id));

  const [sectionsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sections)
    .where(eq(sections.schoolId, school.id));

  const [subjectsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subjects)
    .where(eq(subjects.schoolId, school.id));

  const [feeHeadsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feeHeads)
    .where(eq(feeHeads.schoolId, school.id));

  const [salaryRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salaryTemplates)
    .where(eq(salaryTemplates.schoolId, school.id));

  const [holidaysRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.schoolId, school.id), eq(events.eventType, "HOLIDAY" as any)));

  const provision = await db.query.schoolProvisions.findFirst({
    where: eq(schoolProvisions.schoolId, school.id),
  });

  const hasActiveYear = (activeYear?.count ?? 0) > 0;
  const classesCount = classesRes?.count ?? 0;
  const sectionsCount = sectionsRes?.count ?? 0;
  const subjectsCount = subjectsRes?.count ?? 0;
  const feeHeadsCount = feeHeadsRes?.count ?? 0;
  const salaryTemplatesCount = salaryRes?.count ?? 0;
  const holidaysCount = holidaysRes?.count ?? 0;

  // Calculate completeness score based on real persisted data
  let completedMilestones = 0;
  const totalMilestones = 6;
  if (hasActiveYear) completedMilestones++;
  if (classesCount > 0) completedMilestones++;
  if (subjectsCount > 0) completedMilestones++;
  if (feeHeadsCount > 0) completedMilestones++;
  if (salaryTemplatesCount > 0) completedMilestones++;
  if (holidaysCount > 0) completedMilestones++;

  const overallScore = Math.round((completedMilestones / totalMilestones) * 100);

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
      status: classesCount > 0 ? (sectionsCount > 0 ? ("COMPLETE" as const) : ("PARTIAL" as const)) : ("NOT_STARTED" as const),
      metric: `${classesCount} Classes • ${sectionsCount} Sections`,
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
      href: "/settings/fee-heads",
      status: feeHeadsCount > 0 ? ("COMPLETE" as const) : ("NOT_STARTED" as const),
      metric: `${feeHeadsCount} Fee Heads Active`,
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
    overallScore,
    classesCount,
    sectionsCount,
    subjectsCount,
    feeHeadsCount,
    salaryTemplatesCount,
    holidaysCount,
    hasActiveAcademicYear: hasActiveYear,
    categories,
  };
}

