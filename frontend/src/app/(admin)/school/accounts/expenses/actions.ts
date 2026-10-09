"use server";

import { db } from "@/db";
import { expenseVouchers, accountLedgerTransactions, bankAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import {
  assertAcademicYearNotLocked,
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
  getExpenseHeadChartAccountId,
} from "@schoolmitra/backend/lib/chartOfAccountsEngine";
import { invalidateFinanceTags } from "@/lib/financeCache";

export async function createExpenseVoucher(formData: FormData) {
  // vouchers_create: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  const expenseHeadId = (formData.get("expenseHeadId") as string)?.trim();
  const bankAccountId = (formData.get("bankAccountId") as string)?.trim() || null;
  const vendorName = (formData.get("vendorName") as string)?.trim() || null;
  const amountStr = (formData.get("amount") as string)?.trim();
  const paymentMode = (formData.get("paymentMode") as string)?.trim() || "CASH";
  const transactionReference = (formData.get("transactionReference") as string)?.trim() || null;
  const remarks = (formData.get("remarks") as string)?.trim() || null;
  const entryDateStr = (formData.get("entryDate") as string)?.trim();

  // ACCOUNTANT created vouchers ALWAYS require admin approval (RIF-01)
  const requestedStatus = (formData.get("status") as string)?.trim() || "APPROVED";
  const status = ctx.role === "ACCOUNTANT" ? "PENDING" : requestedStatus;

  if (!expenseHeadId || !amountStr) {
    throw new Error("Expense Head and Amount are required.");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const entryDate = entryDateStr ? new Date(entryDateStr) : new Date();

  // Enforce fiscal lock invariant (ACC-06)
  await assertAcademicYearNotLocked(school.id, entryDate, db);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNumber = `EXP-${Date.now().toString().slice(-6)}-${randSuffix}`;

  let createdId = "";

  await db.transaction(async (tx) => {
    // 1. Create expense voucher
    const [voucher] = await tx
      .insert(expenseVouchers)
      .values({
        schoolId: school.id,
        voucherNumber,
        expenseHeadId,
        bankAccountId: bankAccountId || null,
        vendorName,
        amount: amount.toFixed(2),
        paymentMode,
        transactionReference,
        entryDate,
        status,
        approvedById: status === "APPROVED" ? ctx.userId : null,
        approvedAt: status === "APPROVED" ? new Date() : null,
        remarks,
        createdById: ctx.userId,
      })
      .returning();

    if (!voucher) throw new Error("Failed to create expense voucher.");
    createdId = voucher.id;

    // 2. If approved, debit bank account & post debit ledger entry
    if (status === "APPROVED") {
      let newBalance = "0";
      if (bankAccountId) {
        const [bank] = await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} - ${amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.schoolId, school.id)))
          .returning();
        if (bank) {
          newBalance = bank.currentBalance;
        }
      }

      const debitAccountId = await getExpenseHeadChartAccountId(school.id, expenseHeadId, tx);
      const creditAccountId = bankAccountId
        ? await getBankAccountChartAccountId(school.id, bankAccountId, tx)
        : await getCashMainChartAccountId(school.id, tx);

      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: `TX-${voucherNumber}`,
        sourceType: "EXPENSE_VOUCHER",
        sourceId: voucher.id,
        bankAccountId: bankAccountId || null,
        debitAccountId,
        creditAccountId,
        transactionType: "DEBIT",
        amount: amount.toFixed(2),
        balanceAfter: newBalance,
        description: `Disbursement voucher ${voucherNumber} paid to ${vendorName || "Vendor"} via ${paymentMode}`,
        transactionDate: entryDate,
        createdById: ctx.userId,
      });

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "CREATE_EXPENSE_VOUCHER",
        entityType: "EXPENSE_VOUCHER",
        entityId: voucher.id,
        newData: { voucherNumber, amount, vendorName, paymentMode, status },
        reason: remarks || `Disbursement voucher ${voucherNumber} recorded`,
        performedById: ctx.userId,
      });
    } else {
      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "SUBMIT_EXPENSE_VOUCHER",
        entityType: "EXPENSE_VOUCHER",
        entityId: voucher.id,
        newData: { voucherNumber, amount, vendorName, paymentMode, status: "PENDING" },
        reason: remarks || `Disbursement voucher submitted for approval`,
        performedById: ctx.userId,
      });
    }
  });

  // Invalidate tenant S2 finance caches for accounts
  await invalidateFinanceTags(school.id, [`fin:accounts:${school.id}`]);

  revalidatePath("/school/accounts/expenses");
  revalidatePath("/school/accounting/dashboard");
  revalidatePath("/school/accounts/bank-accounts");
  return { success: true, id: createdId, voucherNumber };
}

export async function approveExpenseVoucher(voucherId: string) {
  // expenses_approve: SUPER_ADMIN, SCHOOL_ADMIN (ACCOUNTANT receives 403 / auth error)
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);

  const voucher = await db.query.expenseVouchers.findFirst({
    where: and(eq(expenseVouchers.id, voucherId), eq(expenseVouchers.schoolId, school.id)),
  });

  if (!voucher) throw new Error("Voucher not found.");
  if (voucher.status === "APPROVED") return { success: true };

  // Separation of duties: Submitter != Approver (unless SUPER_ADMIN override)
  if (voucher.createdById === ctx.userId && ctx.role !== "SUPER_ADMIN") {
    throw new Error("Separation of duties: Voucher submitter cannot approve their own expense voucher.");
  }

  // Enforce fiscal lock invariant (ACC-06)
  await assertAcademicYearNotLocked(school.id, voucher.entryDate, db);

  const amount = parseFloat(voucher.amount);

  await db.transaction(async (tx) => {
    await tx
      .update(expenseVouchers)
      .set({
        status: "APPROVED",
        approvedById: ctx.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(expenseVouchers.id, voucherId), eq(expenseVouchers.schoolId, school.id)));

    let newBalance = "0";
    if (voucher.bankAccountId) {
      const [bank] = await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`${bankAccounts.currentBalance} - ${amount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(and(eq(bankAccounts.id, voucher.bankAccountId), eq(bankAccounts.schoolId, school.id)))
        .returning();
      if (bank) {
        newBalance = bank.currentBalance;
      }
    }

    const debitAccountId = await getExpenseHeadChartAccountId(school.id, voucher.expenseHeadId, tx);
    const creditAccountId = voucher.bankAccountId
      ? await getBankAccountChartAccountId(school.id, voucher.bankAccountId, tx)
      : await getCashMainChartAccountId(school.id, tx);

    await tx.insert(accountLedgerTransactions).values({
      schoolId: school.id,
      transactionNumber: `TX-${voucher.voucherNumber}`,
      sourceType: "EXPENSE_VOUCHER",
      sourceId: voucher.id,
      bankAccountId: voucher.bankAccountId || null,
      debitAccountId,
      creditAccountId,
      transactionType: "DEBIT",
      amount: amount.toFixed(2),
      balanceAfter: newBalance,
      description: `Disbursement voucher ${voucher.voucherNumber} approved and debited`,
      transactionDate: new Date(),
      createdById: ctx.userId,
    });

    await logFeeAuditEvent(tx, {
      schoolId: school.id,
      action: "APPROVE_EXPENSE_VOUCHER",
      entityType: "EXPENSE_VOUCHER",
      entityId: voucher.id,
      previousData: { status: "PENDING" },
      newData: { status: "APPROVED", approvedAt: new Date(), debitedAmount: amount },
      reason: "Approved from Accounts Hub / Expense register",
      performedById: ctx.userId,
    });
  });

  revalidatePath("/school/accounts/expenses");
  revalidatePath("/school/accounting/dashboard");
  revalidatePath("/school/accounts/bank-accounts");
  return { success: true };
}
