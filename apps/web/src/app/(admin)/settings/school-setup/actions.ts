"use server";

import { db } from "@/db";
import { schools, academicYears } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { z } from "zod";
import { createSchoolSchema, createAcademicYearSchema } from "@schoolmitra/validators";

const wizardSchema = createSchoolSchema.and(
  z.object({
    academicYearLabel: createAcademicYearSchema.shape.label,
    academicYearStart: createAcademicYearSchema.shape.startDate,
    academicYearEnd: createAcademicYearSchema.shape.endDate,
  })
);

export async function setupSchool(data: z.infer<typeof wizardSchema>) {
  const ctx = await requireAuth(["SCHOOL_ADMIN"]);
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

  return { success: true };
}
