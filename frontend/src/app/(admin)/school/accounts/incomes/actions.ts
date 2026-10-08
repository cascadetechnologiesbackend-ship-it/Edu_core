"use server";

import { db } from "@/db";
import { incomeVouchers, accountLedgerTransactions, bankAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { revalidatePath } from "next/cache";

export async function createIncomeVoucher(formData: FormData) {
  // vouchers_create: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  const incomeHeadId = (formData.get("incomeHeadId") as string)?.trim();
  const bankAccountId = (formData.get("bankAccountId") as string)?.trim() || null;
  const amountStr = (formData.get("amount") as string)?.trim();
  const paymentMode = (formData.get("paymentMode") as string)?.trim() || "CASH";
  const paymentSource = (formData.get("paymentSource") as string)?.trim() || null;
  const transactionReference = (formData.get("transactionReference") as string)?.trim() || null;
  const remarks = (formData.get("remarks") as string)?.trim() || null;
  const entryDateStr = (formData.get("entryDate") as string)?.trim();

  if (!incomeHeadId || !amountStr) {
    throw new Error("Income Head and Amount are required.");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const entryDate = entryDateStr ? new Date(entryDateStr) : new Date();

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNumber = `INC-${Date.now().toString().slice(-6)}-${randSuffix}`;

  let createdId = "";

  await db.transaction(async (tx) => {
    // 1. Create income voucher
    const [voucher] = await tx
      .insert(incomeVouchers)
      .values({
        schoolId: school.id,
        voucherNumber,
        incomeHeadId,
        bankAccountId: bankAccountId || null,
        amount: amount.toFixed(2),
        paymentMode,
        paymentSource,
        transactionReference,
        entryDate,
        remarks,
        createdById: ctx.userId,
      })
      .returning();

    if (!voucher) throw new Error("Failed to create income voucher.");
    createdId = voucher.id;

    // 2. Update bank account balance if bankAccountId is provided
    let newBalance = amount.toFixed(2);
    if (bankAccountId) {
      const [bank] = await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`${bankAccounts.currentBalance} + ${amount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.schoolId, school.id)))
        .returning();
      if (bank) {
        newBalance = bank.currentBalance;
      }
    }

    // 3. Post credit entry to general ledger
    await tx.insert(accountLedgerTransactions).values({
      schoolId: school.id,
      transactionNumber: `TX-${voucherNumber}`,
      sourceType: "INCOME_VOUCHER",
      sourceId: voucher.id,
      bankAccountId: bankAccountId || null,
      transactionType: "CREDIT",
      amount: amount.toFixed(2),
      balanceAfter: newBalance,
      description: `Non-fee revenue voucher ${voucherNumber} received from ${paymentSource || "General"} via ${paymentMode}`,
      transactionDate: entryDate,
      createdById: ctx.userId,
    });

    // 4. Uniform fee audit log
    await logFeeAuditEvent(tx, {
      schoolId: school.id,
      action: "CREATE_INCOME_VOUCHER",
      entityType: "INCOME_VOUCHER",
      entityId: voucher.id,
      newData: { voucherNumber, amount: amount.toFixed(2), paymentMode, bankAccountId },
      reason: remarks || `Income voucher ${voucherNumber} recorded`,
      performedById: ctx.userId,
    });
  });

  revalidatePath("/school/accounts/incomes");
  revalidatePath("/school/accounting/dashboard");
  revalidatePath("/school/accounts/bank-accounts");
  return { success: true, id: createdId, voucherNumber };
}
