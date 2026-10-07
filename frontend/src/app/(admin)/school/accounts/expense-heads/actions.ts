"use server";

import { db } from "@/db";
import { expenseHeads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

export async function createExpenseHead(formData: FormData) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase() || null;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) throw new Error("Expense Head name is required.");

  await db.insert(expenseHeads).values({
    schoolId: school.id,
    name,
    code,
    description,
    isActive: true,
  });

  revalidatePath("/school/accounts/expense-heads");
  revalidatePath("/school/accounts/expenses");
  return { success: true };
}

export async function toggleExpenseHeadStatus(id: string, isActive: boolean) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  await db
    .update(expenseHeads)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(expenseHeads.id, id), eq(expenseHeads.schoolId, school.id)));

  revalidatePath("/school/accounts/expense-heads");
  return { success: true };
}
