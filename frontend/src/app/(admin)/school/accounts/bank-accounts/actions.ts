"use server";

import { db } from "@/db";
import { bankAccounts, accountLedgerTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

export async function createBankAccount(formData: FormData) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  const bankName = (formData.get("bankName") as string)?.trim();
  const accountName = (formData.get("accountName") as string)?.trim();
  const accountNumber = (formData.get("accountNumber") as string)?.trim();
  const ifscCode = (formData.get("ifscCode") as string)?.trim().toUpperCase() || null;
  const branchName = (formData.get("branchName") as string)?.trim() || null;
  const openingBalance = (formData.get("openingBalance") as string)?.trim() || "0";

  if (!bankName || !accountName || !accountNumber) {
    throw new Error("Bank Name, Account Name, and Account Number are required.");
  }

  const parsedOpening = parseFloat(openingBalance);
  if (isNaN(parsedOpening) || parsedOpening < 0) {
    throw new Error("Opening balance must be a valid non-negative number.");
  }

  const [created] = await db
    .insert(bankAccounts)
    .values({
      schoolId: school.id,
      bankName,
      accountName,
      accountNumber,
      ifscCode,
      branchName,
      openingBalance: parsedOpening.toFixed(2),
      currentBalance: parsedOpening.toFixed(2),
      isActive: true,
    })
    .returning();

  if (!created) throw new Error("Failed to create bank account.");

  // If opening balance > 0, post initial opening balance ledger transaction
  if (parsedOpening > 0) {
    await db.insert(accountLedgerTransactions).values({
      schoolId: school.id,
      transactionNumber: `OB-${Date.now().toString().slice(-6)}`,
      sourceType: "OPENING_BALANCE",
      sourceId: created.id,
      bankAccountId: created.id,
      transactionType: "CREDIT",
      amount: parsedOpening.toFixed(2),
      balanceAfter: parsedOpening.toFixed(2),
      description: `Opening balance configured for ${bankName} (${accountNumber})`,
      createdById: ctx.userId,
    });
  }

  revalidatePath("/school/accounts/bank-accounts");
  revalidatePath("/school/accounting/dashboard");
  return { success: true, id: created.id };
}

export async function toggleBankAccountStatus(id: string, isActive: boolean) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  await db
    .update(bankAccounts)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.schoolId, school.id)));

  revalidatePath("/school/accounts/bank-accounts");
  return { success: true };
}
