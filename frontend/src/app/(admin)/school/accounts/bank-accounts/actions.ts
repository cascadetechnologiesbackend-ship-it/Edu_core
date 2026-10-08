"use server";

import { db } from "@/db";
import { bankAccounts, accountLedgerTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { revalidatePath } from "next/cache";

export async function createBankAccount(formData: FormData) {
  // bank_accounts_manage: SUPER_ADMIN, SCHOOL_ADMIN (ACCOUNTANT receives 403 / auth error)
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
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

  let createdId = "";

  await db.transaction(async (tx) => {
    const [created] = await tx
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
    createdId = created.id;

    // If opening balance > 0, post initial opening balance ledger transaction
    if (parsedOpening > 0) {
      await tx.insert(accountLedgerTransactions).values({
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

    await logFeeAuditEvent(tx, {
      schoolId: school.id,
      action: "CREATE_BANK_ACCOUNT",
      entityType: "BANK_ACCOUNT",
      entityId: created.id,
      newData: { bankName, accountName, accountNumber, openingBalance: parsedOpening.toFixed(2) },
      reason: `Bank account ${bankName} created with balance ₹${parsedOpening.toFixed(2)}`,
      performedById: ctx.userId,
    });
  });

  revalidatePath("/school/accounts/bank-accounts");
  revalidatePath("/school/accounting/dashboard");
  return { success: true, id: createdId };
}

export async function toggleBankAccountStatus(id: string, isActive: boolean) {
  // bank_accounts_manage: SUPER_ADMIN, SCHOOL_ADMIN (ACCOUNTANT receives 403 / auth error)
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);

  await db.transaction(async (tx) => {
    await tx
      .update(bankAccounts)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.schoolId, school.id)));

    await logFeeAuditEvent(tx, {
      schoolId: school.id,
      action: "TOGGLE_BANK_ACCOUNT_STATUS",
      entityType: "BANK_ACCOUNT",
      entityId: id,
      newData: { isActive },
      reason: `Bank account status toggled to ${isActive ? "ACTIVE" : "INACTIVE"}`,
      performedById: ctx.userId,
    });
  });

  revalidatePath("/school/accounts/bank-accounts");
  return { success: true };
}
