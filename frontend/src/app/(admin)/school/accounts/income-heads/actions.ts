"use server";

import { db } from "@/db";
import { incomeHeads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

export async function createIncomeHead(formData: FormData) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase() || null;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) throw new Error("Income Head name is required.");

  await db.insert(incomeHeads).values({
    schoolId: school.id,
    name,
    code,
    description,
    isActive: true,
  });

  revalidatePath("/school/accounts/income-heads");
  revalidatePath("/school/accounts/incomes");
  return { success: true };
}

export async function toggleIncomeHeadStatus(id: string, isActive: boolean) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  await db
    .update(incomeHeads)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(incomeHeads.id, id), eq(incomeHeads.schoolId, school.id)));

  revalidatePath("/school/accounts/income-heads");
  return { success: true };
}
