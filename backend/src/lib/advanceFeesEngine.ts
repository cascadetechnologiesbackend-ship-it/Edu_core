// ─── Advance Fees Engine & Double-Entry Invariants ─────────────────────────
// Spec: Phase B1 AZ-05 per Amendments AM-01, AM-02
// Invariants:
// 1. Advance Receipt: Dr Cash/Bank, Cr Student Fee Advances (2110)
// 2. Invoice Allocation (AUTO-06): Dr Student Fee Advances (2110), Cr Student Receivable (1200)
// 3. Mathematical Invariant: sum(allocations) <= sum(advance_amount) strictly enforced
// 4. Refund Payout: Dr Student Fee Advances (2110), Cr Cash/Bank

import { db } from "@/db";
import {
  studentFeeAdvances,
  studentFeeAdvanceAllocations,
  feeInvoices,
  accountLedgerTransactions,
  bankAccounts,
} from "@/db/schema";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import crypto from "crypto";
import {
  assertAcademicYearNotLocked,
  getStudentFeeAdvancesChartAccountId,
  getStudentReceivableChartAccountId,
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
} from "./chartOfAccountsEngine";
import { logFeeAuditEvent } from "./auditLogger";

export interface RecordAdvancePaymentParams {
  schoolId: string;
  studentId: string;
  academicYearId?: string | null;
  amount: number;
  paymentMethod?: string;
  transactionReference?: string | null;
  bankAccountId?: string | null;
  receiptNumber?: string | null;
  remarks?: string | null;
  createdById?: string | null;
  advanceDate?: Date;
}

export interface AllocateAdvanceParams {
  schoolId: string;
  studentId: string;
  advanceId?: string;
  createdById?: string | null;
}

export interface RefundAdvanceParams {
  schoolId: string;
  advanceId: string;
  refundAmount: number;
  reason: string;
  approvedById?: string | null;
  bankAccountId?: string | null;
}

/**
 * 1. Record an advance fee payment from a student/parent.
 * Double Entry:
 *   Dr Bank Account / Cash in Hand
 *   Cr Student Fee Advances (Liability Head 2110)
 */
export async function recordAdvancePayment(
  params: RecordAdvancePaymentParams,
  executor?: any
) {
  const client = executor || db;

  if (params.amount <= 0) {
    throw new Error("Advance payment amount must be greater than zero.");
  }

  const effectiveDate = params.advanceDate || new Date();
  await assertAcademicYearNotLocked(params.schoolId, effectiveDate, client);

  const advanceNumber = `ADV-${effectiveDate.getFullYear()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

  return await client.transaction(async (tx: any) => {
    // 1. Resolve Bank or Cash Asset Chart Account
    const assetChartAccountId = params.bankAccountId
      ? await getBankAccountChartAccountId(params.schoolId, params.bankAccountId, tx)
      : await getCashMainChartAccountId(params.schoolId, tx);

    // 2. Resolve Student Fee Advances Liability Chart Account (code 2110)
    const advanceLiabilityAccountId = await getStudentFeeAdvancesChartAccountId(
      params.schoolId,
      tx
    );

    // 3. Update Bank Account Balance if bank account was specified
    let updatedBalance = "0";
    if (params.bankAccountId) {
      const [updatedBank] = await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`${bankAccounts.currentBalance} + ${params.amount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bankAccounts.id, params.bankAccountId),
            eq(bankAccounts.schoolId, params.schoolId)
          )
        )
        .returning();
      if (updatedBank) updatedBalance = updatedBank.currentBalance;
    }

    // 4. Create Student Fee Advance Record
    const [advance] = await tx
      .insert(studentFeeAdvances)
      .values({
        schoolId: params.schoolId,
        studentId: params.studentId,
        academicYearId: params.academicYearId || null,
        advanceNumber,
        advanceDate: effectiveDate,
        amount: params.amount.toFixed(2),
        allocatedAmount: "0.00",
        balanceAmount: params.amount.toFixed(2),
        paymentMethod: params.paymentMethod || "CASH",
        transactionReference: params.transactionReference || null,
        bankAccountId: params.bankAccountId || null,
        status: "UNALLOCATED",
        receiptNumber: params.receiptNumber || advanceNumber,
        remarks: params.remarks || "Student Fee Advance Deposit",
        createdById: params.createdById || null,
      })
      .returning();

    // 5. Post General Ledger Entry: Dr Asset, Cr Student Fee Advances (2110)
    const txNumber = `GL-${advanceNumber}`;
    await tx.insert(accountLedgerTransactions).values({
      schoolId: params.schoolId,
      transactionNumber: txNumber,
      sourceType: "FEE_COLLECTION",
      sourceId: advance.id,
      bankAccountId: params.bankAccountId || null,
      debitAccountId: assetChartAccountId,
      creditAccountId: advanceLiabilityAccountId,
      transactionType: "CREDIT",
      amount: params.amount.toFixed(2),
      balanceAfter: updatedBalance,
      description: `Advance Fee Collection - Ref: ${advanceNumber}`,
      transactionDate: effectiveDate,
      createdById: params.createdById || "00000000-0000-0000-0000-000000000000",
    });

    // 6. Audit Logging
    await logFeeAuditEvent(tx, {
      schoolId: params.schoolId,
      action: "RECORD_STUDENT_FEE_ADVANCE",
      entityType: "STUDENT_FEE_ADVANCE",
      entityId: advance.id,
      newData: {
        advanceNumber,
        amount: params.amount.toFixed(2),
        studentId: params.studentId,
        bankAccountId: params.bankAccountId,
      },
      reason: `Recorded fee advance ${advanceNumber} of INR ${params.amount.toFixed(2)}`,
      performedById: params.createdById || "00000000-0000-0000-0000-000000000000",
    });

    return advance;
  });
}

/**
 * 2. Auto-allocate unallocated advances to outstanding student invoices (AUTO-06).
 * Priority: Oldest due date first.
 * Invariant (AM-02):
 *   sum(allocations) <= sum(advance_amount) strictly verified inside transaction.
 * Double Entry:
 *   Dr Student Fee Advances (Liability Head 2110)
 *   Cr Student Receivable (Asset Head 1200)
 */
export async function allocateAdvanceToInvoices(
  params: AllocateAdvanceParams,
  executor?: any
) {
  const client = executor || db;

  return await client.transaction(async (tx: any) => {
    // 1. Fetch available advances for this student
    const advanceConditions = [
      eq(studentFeeAdvances.schoolId, params.schoolId),
      eq(studentFeeAdvances.studentId, params.studentId),
      inArray(studentFeeAdvances.status, ["UNALLOCATED", "PARTIALLY_ALLOCATED"]),
    ];

    if (params.advanceId) {
      advanceConditions.push(eq(studentFeeAdvances.id, params.advanceId));
    }

    const availableAdvances = await tx.query.studentFeeAdvances.findMany({
      where: and(...advanceConditions),
      orderBy: [asc(studentFeeAdvances.advanceDate)],
    });

    if (availableAdvances.length === 0) {
      return { success: true, allocatedCount: 0, totalAllocated: 0, allocations: [] };
    }

    // 2. Fetch outstanding unpaid invoices for the student (oldest first)
    const unpaidInvoices = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, params.schoolId),
        eq(feeInvoices.studentId, params.studentId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL"])
      ),
      orderBy: [asc(feeInvoices.dueDate), asc(feeInvoices.createdAt)],
    });

    if (unpaidInvoices.length === 0) {
      return { success: true, allocatedCount: 0, totalAllocated: 0, allocations: [] };
    }

    const advanceLiabilityAccountId = await getStudentFeeAdvancesChartAccountId(
      params.schoolId,
      tx
    );
    const studentReceivableAccountId = await getStudentReceivableChartAccountId(
      params.schoolId,
      tx
    );

    const allocationsMade: Array<{
      advanceId: string;
      invoiceId: string;
      amount: number;
    }> = [];
    let totalAllocatedSum = 0;

    for (const advance of availableAdvances) {
      let currentAdvanceBal = parseFloat(advance.balanceAmount);
      let currentAdvanceAlloc = parseFloat(advance.allocatedAmount);
      const originalAdvanceAmount = parseFloat(advance.amount);

      if (currentAdvanceBal <= 0) continue;

      for (const invoice of unpaidInvoices) {
        const invBalance = parseFloat(invoice.balanceAmount);
        if (invBalance <= 0 || currentAdvanceBal <= 0) continue;

        const allocAmount = Math.min(currentAdvanceBal, invBalance);
        if (allocAmount <= 0) continue;

        // IN-ENGINE MATHEMATICAL INVARIANT ENFORCEMENT (AM-02):
        // strictly enforce sum(allocations) <= sum(advance_amount)
        const proposedTotalAllocated = currentAdvanceAlloc + allocAmount;
        if (proposedTotalAllocated > originalAdvanceAmount + 0.0001) {
          throw new Error(
            `Mathematical Invariant Violation: sum(allocations) (${proposedTotalAllocated.toFixed(
              2
            )}) exceeds advance amount (${originalAdvanceAmount.toFixed(
              2
            )}) for advance #${advance.advanceNumber}. Allocation aborted.`
          );
        }

        // Apply deduction to invoice
        const updatedInvPaid = parseFloat(invoice.paidAmount) + allocAmount;
        const updatedInvBalance = invBalance - allocAmount;
        const updatedInvStatus = updatedInvBalance <= 0.001 ? "PAID" : "PARTIAL";

        invoice.paidAmount = updatedInvPaid.toFixed(2);
        invoice.balanceAmount = Math.max(0, updatedInvBalance).toFixed(2);
        invoice.status = updatedInvStatus;

        await tx
          .update(feeInvoices)
          .set({
            paidAmount: updatedInvPaid.toFixed(2),
            balanceAmount: Math.max(0, updatedInvBalance).toFixed(2),
            status: updatedInvStatus,
            updatedAt: new Date(),
          })
          .where(eq(feeInvoices.id, invoice.id));

        // Post Double Entry: Dr Student Fee Advances (2110), Cr Student Receivable (1200)
        const allocTxNumber = `GL-ALC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const [ledgerTx] = await tx
          .insert(accountLedgerTransactions)
          .values({
            schoolId: params.schoolId,
            transactionNumber: allocTxNumber,
            sourceType: "FEE_COLLECTION",
            sourceId: advance.id,
            debitAccountId: advanceLiabilityAccountId,
            creditAccountId: studentReceivableAccountId,
            transactionType: "CREDIT",
            amount: allocAmount.toFixed(2),
            description: `Advance Allocation from ${advance.advanceNumber} to Invoice ${invoice.invoiceNumber}`,
            transactionDate: new Date(),
            createdById: params.createdById || "00000000-0000-0000-0000-000000000000",
          })
          .returning();

        // Record Allocation Row
        await tx.insert(studentFeeAdvanceAllocations).values({
          schoolId: params.schoolId,
          advanceId: advance.id,
          feeInvoiceId: invoice.id,
          allocatedAmount: allocAmount.toFixed(2),
          allocationDate: new Date(),
          ledgerTransactionId: ledgerTx?.id || null,
          createdById: params.createdById || null,
        });

        currentAdvanceAlloc += allocAmount;
        currentAdvanceBal -= allocAmount;
        totalAllocatedSum += allocAmount;

        allocationsMade.push({
          advanceId: advance.id,
          invoiceId: invoice.id,
          amount: allocAmount,
        });
      }

      // Update Advance state
      const finalStatus =
        currentAdvanceBal <= 0.001
          ? "FULLY_ALLOCATED"
          : currentAdvanceAlloc > 0
          ? "PARTIALLY_ALLOCATED"
          : "UNALLOCATED";

      await tx
        .update(studentFeeAdvances)
        .set({
          allocatedAmount: currentAdvanceAlloc.toFixed(2),
          balanceAmount: Math.max(0, currentAdvanceBal).toFixed(2),
          status: finalStatus,
          updatedAt: new Date(),
        })
        .where(eq(studentFeeAdvances.id, advance.id));
    }

    return {
      success: true,
      allocatedCount: allocationsMade.length,
      totalAllocated: totalAllocatedSum,
      allocations: allocationsMade,
    };
  });
}

/**
 * 3. Refund of Unallocated Student Fee Advance.
 * Invariant:
 *   refundAmount <= advance.balanceAmount.
 * Double Entry:
 *   Dr Student Fee Advances (Liability Head 2110)
 *   Cr Bank Account / Cash in Hand
 */
export async function refundAdvancePayment(
  params: RefundAdvanceParams,
  executor?: any
) {
  const client = executor || db;

  if (params.refundAmount <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  return await client.transaction(async (tx: any) => {
    const advance = await tx.query.studentFeeAdvances.findFirst({
      where: and(
        eq(studentFeeAdvances.id, params.advanceId),
        eq(studentFeeAdvances.schoolId, params.schoolId)
      ),
    });

    if (!advance) {
      throw new Error("Student fee advance record not found.");
    }

    const availableBalance = parseFloat(advance.balanceAmount);
    if (params.refundAmount > availableBalance + 0.001) {
      throw new Error(
        `Cannot refund INR ${params.refundAmount.toFixed(
          2
        )}: exceeds available unallocated advance balance (INR ${availableBalance.toFixed(
          2
        )}).`
      );
    }

    await assertAcademicYearNotLocked(params.schoolId, new Date(), tx);

    // 1. Resolve accounts
    const advanceLiabilityAccountId = await getStudentFeeAdvancesChartAccountId(
      params.schoolId,
      tx
    );

    const assetChartAccountId = params.bankAccountId
      ? await getBankAccountChartAccountId(params.schoolId, params.bankAccountId, tx)
      : await getCashMainChartAccountId(params.schoolId, tx);

    // 2. Reduce bank balance if bank was specified
    let updatedBalance = "0";
    if (params.bankAccountId) {
      const [updatedBank] = await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`${bankAccounts.currentBalance} - ${params.refundAmount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bankAccounts.id, params.bankAccountId),
            eq(bankAccounts.schoolId, params.schoolId)
          )
        )
        .returning();
      if (updatedBank) updatedBalance = updatedBank.currentBalance;
    }

    // 3. Post Double Entry: Dr Student Fee Advances (2110), Cr Bank/Cash
    const refTxNumber = `GL-RFD-ADV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await tx.insert(accountLedgerTransactions).values({
      schoolId: params.schoolId,
      transactionNumber: refTxNumber,
      sourceType: "MANUAL_ADJUSTMENT",
      sourceId: advance.id,
      bankAccountId: params.bankAccountId || null,
      debitAccountId: advanceLiabilityAccountId,
      creditAccountId: assetChartAccountId,
      transactionType: "DEBIT",
      amount: params.refundAmount.toFixed(2),
      balanceAfter: updatedBalance,
      description: `Refund of Unallocated Advance #${advance.advanceNumber}: ${params.reason}`,
      transactionDate: new Date(),
      createdById: params.approvedById || "00000000-0000-0000-0000-000000000000",
    });

    // 4. Update Advance balance and status
    const remainingBalance = Math.max(0, availableBalance - params.refundAmount);
    const newStatus =
      remainingBalance <= 0.001
        ? "REFUNDED"
        : parseFloat(advance.allocatedAmount) > 0
        ? "PARTIALLY_ALLOCATED"
        : "UNALLOCATED";

    const [updatedAdvance] = await tx
      .update(studentFeeAdvances)
      .set({
        balanceAmount: remainingBalance.toFixed(2),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(studentFeeAdvances.id, advance.id))
      .returning();

    // 5. Audit Logging
    await logFeeAuditEvent(tx, {
      schoolId: params.schoolId,
      action: "REFUND_STUDENT_FEE_ADVANCE",
      entityType: "STUDENT_FEE_ADVANCE",
      entityId: advance.id,
      newData: {
        refundAmount: params.refundAmount.toFixed(2),
        remainingBalance: remainingBalance.toFixed(2),
        reason: params.reason,
      },
      reason: `Refunded INR ${params.refundAmount.toFixed(2)} from advance #${advance.advanceNumber}`,
      performedById: params.approvedById || "00000000-0000-0000-0000-000000000000",
    });

    return updatedAdvance;
  });
}

/**
 * 4. Get active unallocated advance balance for a student (feeds StudentFeeCard creditBalance).
 */
export async function getStudentAdvanceBalance(
  schoolId: string,
  studentId: string,
  executor?: any
): Promise<{ creditBalance: number; count: number }> {
  const client = executor || db;

  const advances = await client.query.studentFeeAdvances.findMany({
    where: and(
      eq(studentFeeAdvances.schoolId, schoolId),
      eq(studentFeeAdvances.studentId, studentId),
      inArray(studentFeeAdvances.status, ["UNALLOCATED", "PARTIALLY_ALLOCATED"])
    ),
  });

  const totalCredit = advances.reduce(
    (sum: number, a: any) => sum + parseFloat(a.balanceAmount || "0"),
    0
  );

  return {
    creditBalance: Math.round(totalCredit * 100) / 100,
    count: advances.length,
  };
}
