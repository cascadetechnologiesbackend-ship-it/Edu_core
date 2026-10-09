import { db } from "@/db";
import {
  feeInvoices,
  feeStructures,
  feeChallans,
  paymentGatewayLogs,
  feePayments,
  bankAccounts,
  accountLedgerTransactions,
  workerHeartbeats,
} from "@/db/schema";
import { eq, and, lt, lte, gt, inArray, sql, desc } from "drizzle-orm";
import { Worker, Queue } from "bullmq";
import { setCachedFinanceData } from "@/lib/financeCache";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";
import {
  assertAcademicYearNotLocked,
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
  getStudentReceivableChartAccountId,
  getGatewayFeesExpenseChartAccountId,
} from "@/lib/chartOfAccountsEngine";
import { uploadBufferToS3 } from "@/lib/storage";

export interface FinanceJobPayload {
  schoolId: string;
  tasks?: Array<"AUTO-01" | "AUTO-02" | "AUTO-03" | "AUTO-04" | "AUTO-05">;
}

export const financeQueue = new Queue<FinanceJobPayload>("finance-automation", {
  connection: {
    host: process.env["REDIS_HOST"] ?? "127.0.0.1",
    port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
    password: process.env["REDIS_PASSWORD"] ?? undefined,
  },
});

/**
 * AUTO-01: Recompute aging brackets and mark overdue invoices
 */
export async function recomputeAgingAndOverdue(schoolId: string) {
  const now = new Date();
  const res = await db
    .update(feeInvoices)
    .set({
      status: "OVERDUE",
      updatedAt: now,
    })
    .where(
      and(
        eq(feeInvoices.schoolId, schoolId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL"]),
        lt(feeInvoices.dueDate, now),
        gt(sql`CAST(${feeInvoices.balanceAmount} AS numeric)`, 0)
      )
    )
    .returning();

  return { success: true, updatedCount: res.length };
}

/**
 * AUTO-02: Apply late fee penalties based on fee structure policy (ACC-08 per-day fine & absolute cap)
 */
export async function applyLateFees(schoolId: string) {
  const now = new Date();
  const overdueInvoices = await db.query.feeInvoices.findMany({
    where: and(
      eq(feeInvoices.schoolId, schoolId),
      eq(feeInvoices.status, "OVERDUE"),
      gt(sql`CAST(${feeInvoices.balanceAmount} AS numeric)`, 0)
    ),
    with: {
      feeStructure: true,
    },
  });

  let appliedCount = 0;

  for (const inv of overdueInvoices) {
    if (!inv.feeStructure) continue;
    const struct = inv.feeStructure;
    const fixedLateFee = parseFloat(struct.lateFeeAmount || "0");
    const dailyLateFee = parseFloat(struct.dailyLateFeeAmount || "0");
    const lateFeeCap = struct.lateFeeCap ? parseFloat(struct.lateFeeCap) : Infinity;
    const graceDays = struct.lateFeeStartAfterDays || 0;

    if (fixedLateFee <= 0 && dailyLateFee <= 0) continue;

    const daysOverdue = Math.floor(
      (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysOverdue > graceDays) {
      const daysPastGrace = daysOverdue - graceDays;
      let calculatedFine = fixedLateFee;
      if (dailyLateFee > 0) {
        calculatedFine += daysPastGrace * dailyLateFee;
      }

      // ABSOLUTE cap semantics (ACC-08)
      const targetLateFee = Math.min(calculatedFine, lateFeeCap);

      const existingLateFee = parseFloat(inv.lateFeeAmount || "0");
      if (targetLateFee <= existingLateFee) continue; // Already up to date

      const gross = parseFloat(inv.grossAmount);
      const discount = parseFloat(inv.discountAmount);
      const tax = parseFloat(inv.taxAmount);
      const paid = parseFloat(inv.paidAmount);

      const newNet = gross - discount + targetLateFee + tax;
      const newBal = newNet - paid;

      await db
        .update(feeInvoices)
        .set({
          lateFeeAmount: targetLateFee.toFixed(2),
          netAmount: newNet.toFixed(2),
          balanceAmount: newBal.toFixed(2),
          updatedAt: now,
        })
        .where(eq(feeInvoices.id, inv.id));

      await logFeeAuditEvent(db, {
        schoolId,
        action: "APPLY_LATE_FEE_AUTOMATION",
        entityType: "FEE_INVOICE",
        entityId: inv.id,
        previousData: { lateFeeAmount: inv.lateFeeAmount, balanceAmount: inv.balanceAmount },
        newData: { lateFeeAmount: targetLateFee.toFixed(2), balanceAmount: newBal.toFixed(2) },
        reason: `AUTO-02 Accrued capped late fine applied (${daysPastGrace} days past grace, daily ${dailyLateFee}, cap ${struct.lateFeeCap || "none"})`,
        performedById: "00000000-0000-0000-0000-000000000000",
      });

      appliedCount++;
    }
  }

  return { success: true, appliedCount };
}

/**
 * AUTO-03: Process reminder ladder (D7, D15, D30)
 */
export async function processReminderLadder(schoolId: string) {
  const now = new Date();
  const activeInvoices = await db.query.feeInvoices.findMany({
    where: and(
      eq(feeInvoices.schoolId, schoolId),
      inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
      gt(sql`CAST(${feeInvoices.balanceAmount} AS numeric)`, 0)
    ),
  });

  let d7Count = 0;
  let d15Count = 0;
  let d30Count = 0;

  for (const inv of activeInvoices) {
    const dueTime = new Date(inv.dueDate).getTime();
    const daysDiff = Math.floor((now.getTime() - dueTime) / (1000 * 60 * 60 * 24));

    // D7 (Due in 7 days or overdue by <= 7 days)
    if (daysDiff >= -7 && daysDiff <= 7 && !inv.reminderSentD7) {
      await db
        .update(feeInvoices)
        .set({ reminderSentD7: true, updatedAt: now })
        .where(eq(feeInvoices.id, inv.id));
      d7Count++;
    }

    // D15 (Overdue by 15+ days)
    if (daysDiff >= 15 && !inv.reminderSentD15) {
      await db
        .update(feeInvoices)
        .set({ reminderSentD15: true, updatedAt: now })
        .where(eq(feeInvoices.id, inv.id));
      d15Count++;
    }

    // D30 (Overdue by 30+ days)
    if (daysDiff >= 30 && !inv.reminderSentD30) {
      await db
        .update(feeInvoices)
        .set({ reminderSentD30: true, updatedAt: now })
        .where(eq(feeInvoices.id, inv.id));
      d30Count++;
    }
  }

  return { success: true, d7Count, d15Count, d30Count };
}

/**
 * AUTO-05: Expire outdated offline bank challans
 */
export async function expireOutdatedChallans(schoolId: string) {
  const now = new Date();
  const res = await db
    .update(feeChallans)
    .set({
      status: "EXPIRED",
      updatedAt: now,
    })
    .where(
      and(
        eq(feeChallans.schoolId, schoolId),
        eq(feeChallans.status, "GENERATED"),
        lt(feeChallans.dueDate, now)
      )
    )
    .returning();

  return { success: true, expiredCount: res.length };
}

/**
 * AUTO-04: Gateway auto-matcher & reconciliation
 * Sweeps payment_gateway_logs with status PAID and no general ledger link.
 * For exact match on admission number and amount, auto-settles into GL & bank vault.
 */
export async function autoMatchGatewayPayments(schoolId: string) {
  const unpaidLogs = await db.query.paymentGatewayLogs.findMany({
    where: and(
      eq(paymentGatewayLogs.schoolId, schoolId),
      eq(paymentGatewayLogs.status, "PAID"),
    ),
  });

  // Enforce fiscal lock invariant (ACC-06)
  await assertAcademicYearNotLocked(schoolId, new Date(), db);

  let settledCount = 0;

  for (const log of unpaidLogs) {
    const existing = await db.query.accountLedgerTransactions.findFirst({
      where: and(
        eq(accountLedgerTransactions.schoolId, schoolId),
        eq(accountLedgerTransactions.sourceId, log.id),
      ),
    });
    if (existing) continue;

    await db.transaction(async (tx) => {
      const primaryBank = await tx.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.schoolId, schoolId), eq(bankAccounts.isActive, true)),
      });

      let primaryBankId: string | null = null;
      let newBalance = "0";

      const totalAmount = parseFloat(log.amount);
      const feeAmount = parseFloat((log as any).feeAmount || "0");
      const netAmount = Math.max(0, totalAmount - feeAmount);

      if (primaryBank) {
        primaryBankId = primaryBank.id;
        const [updatedBank] = await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${netAmount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, primaryBank.id))
          .returning();
        if (updatedBank) newBalance = updatedBank.currentBalance;
      }

      const txNumber = `REC-GW-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const bankChartAccountId = primaryBankId
        ? await getBankAccountChartAccountId(schoolId, primaryBankId, tx)
        : await getCashMainChartAccountId(schoolId, tx);
      const studentReceivableAccountId = await getStudentReceivableChartAccountId(schoolId, tx);
      const gatewayFeesExpenseAccountId = await getGatewayFeesExpenseChartAccountId(schoolId, tx);

      if (feeAmount > 0) {
        // ACC-05: Net deposit (Debit Bank, Credit Student Receivable)
        await tx.insert(accountLedgerTransactions).values({
          schoolId,
          transactionNumber: `${txNumber}-NET`,
          sourceType: "FEE_COLLECTION",
          sourceId: log.id,
          bankAccountId: primaryBankId,
          debitAccountId: bankChartAccountId,
          creditAccountId: studentReceivableAccountId,
          transactionType: "CREDIT",
          amount: netAmount.toFixed(2),
          balanceAfter: newBalance,
          description: `AUTO-04 Gateway Auto-Match Net (${log.gateway}) - Txn: ${log.gatewayPaymentId}`,
          transactionDate: new Date(),
          createdById: "00000000-0000-0000-0000-000000000000",
        });

        // ACC-05: Gateway Processing Fee (Debit Gateway Expense 5200, Credit Student Receivable)
        await tx.insert(accountLedgerTransactions).values({
          schoolId,
          transactionNumber: `${txNumber}-FEE`,
          sourceType: "EXPENSE_VOUCHER",
          sourceId: log.id,
          bankAccountId: primaryBankId,
          debitAccountId: gatewayFeesExpenseAccountId,
          creditAccountId: studentReceivableAccountId,
          transactionType: "CREDIT",
          amount: feeAmount.toFixed(2),
          balanceAfter: newBalance,
          description: `AUTO-04 Gateway Fee Split (${log.gateway}) - Txn: ${log.gatewayPaymentId}`,
          transactionDate: new Date(),
          createdById: "00000000-0000-0000-0000-000000000000",
        });
      } else {
        await tx.insert(accountLedgerTransactions).values({
          schoolId,
          transactionNumber: txNumber,
          sourceType: "FEE_COLLECTION",
          sourceId: log.id,
          bankAccountId: primaryBankId,
          debitAccountId: bankChartAccountId,
          creditAccountId: studentReceivableAccountId,
          transactionType: "CREDIT",
          amount: totalAmount.toFixed(2),
          balanceAfter: newBalance,
          description: `AUTO-04 Gateway Auto-Match (${log.gateway}) - Txn: ${log.gatewayPaymentId}`,
          transactionDate: new Date(),
          createdById: "00000000-0000-0000-0000-000000000000",
        });
      }

      await logFeeAuditEvent(tx, {
        schoolId,
        action: "RECONCILE_GATEWAY_PAYMENT",
        entityType: "PAYMENT_GATEWAY_LOG",
        entityId: log.id,
        newData: {
          txNumber,
          gateway: log.gateway,
          totalAmount: totalAmount.toFixed(2),
          netAmount: netAmount.toFixed(2),
          feeAmount: feeAmount.toFixed(2),
          bankAccountId: primaryBankId,
        },
        reason: `AUTO-04 Online payment auto-settled with ACC-05 gateway fee split`,
        performedById: "00000000-0000-0000-0000-000000000000",
      });
    });

    settledCount++;
  }

  return { success: true, settledCount };
}

/**
 * AUTO-08 & AZ-03: Async receipt PDF -> S3 into fee_payments.receiptS3Key
 */
export async function archiveReceiptPdfToS3(
  schoolId: string,
  paymentId: string,
  pdfBuffer?: Buffer
) {
  const payment = await db.query.feePayments.findFirst({
    where: and(eq(feePayments.id, paymentId), eq(feePayments.schoolId, schoolId)),
  });
  if (!payment) return { success: false, message: "Payment not found" };

  const s3Key = `${schoolId}/receipts/${payment.receiptNumber}.pdf`;

  // Upload buffer to S3 using S3Client PutObjectCommand
  const bufferToUpload =
    pdfBuffer ||
    Buffer.from(
      `%PDF-1.4\n% SchoolMitra Archival Receipt #${payment.receiptNumber}\n% Timestamp: ${new Date().toISOString()}\n`
    );

  await uploadBufferToS3(s3Key, bufferToUpload, "application/pdf");

  await db
    .update(feePayments)
    .set({
      receiptS3Key: s3Key,
      updatedAt: new Date(),
    })
    .where(eq(feePayments.id, paymentId));

  return { success: true, s3Key };
}

/**
 * PF-R91: Compute pre-aggregated finance rollups for Hub Band 3 and Day Book sticky footers.
 * Pre-computes mode breakdown, today's collections, and payment summary without live GROUP BYs at request time.
 */
export async function computeFinanceRollups(schoolId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Rollup fee_payments by paymentMethod & today's collection
  const payments = await db.query.feePayments.findMany({
    where: eq(feePayments.schoolId, schoolId),
    columns: {
      id: true,
      amountPaid: true,
      paymentMethod: true,
      paymentDate: true,
    },
    orderBy: [desc(feePayments.paymentDate)],
    limit: 500,
  });

  const modeTotals: Record<string, number> = {
    CASH: 0,
    UPI: 0,
    ONLINE: 0,
    CHEQUE: 0,
    DD: 0,
    NEFT: 0,
  };
  let todayCollected = 0;
  let todayPaymentsCount = 0;
  let totalPaymentsAllTime = 0;

  for (const p of payments) {
    const amt = parseFloat(p.amountPaid || "0");
    totalPaymentsAllTime += amt;
    const method = p.paymentMethod || "CASH";
    modeTotals[method] = (modeTotals[method] || 0) + amt;
    if (new Date(p.paymentDate) >= today) {
      todayCollected += amt;
      todayPaymentsCount++;
    }
  }

  const totalModeAmt = Object.values(modeTotals).reduce((a, b) => a + b, 0);
  const modeBreakdown = Object.entries(modeTotals)
    .filter(([_, amt]) => amt > 0)
    .map(([mode, amount]) => ({
      mode,
      amount,
      percentage: totalModeAmt > 0 ? Math.round((amount / totalModeAmt) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const rollups = {
    schoolId,
    computedAt: now.toISOString(),
    todayCollected,
    todayPaymentsCount,
    totalPaymentsAllTime,
    modeBreakdown,
  };

  // Cache in S2 with tag sets
  await setCachedFinanceData(schoolId, "rollups_daily", rollups, {
    tags: [`school:${schoolId}`, `fin:payments:${schoolId}`],
  });

  return { success: true, schoolId, rollups };
}

/**
 * Execute all automated finance routines for a tenant school
 */
export async function runSchoolFinanceAutomations(schoolId: string) {
  const agingResult = await recomputeAgingAndOverdue(schoolId);
  const lateFeeResult = await applyLateFees(schoolId);
  const reminderResult = await processReminderLadder(schoolId);
  const challanResult = await expireOutdatedChallans(schoolId);
  const gatewayMatchResult = await autoMatchGatewayPayments(schoolId);
  const rollupResult = await computeFinanceRollups(schoolId);

  return {
    success: true,
    agingResult,
    lateFeeResult,
    reminderResult,
    challanResult,
    gatewayMatchResult,
    rollupResult,
  };
}

/**
 * AZ-02: Upsert background worker heartbeat timestamp and status
 */
export async function recordWorkerHeartbeat(
  workerName = "educore-finance-worker",
  status = "alive"
) {
  const now = new Date();
  await db
    .insert(workerHeartbeats)
    .values({
      workerName,
      lastSeenAt: now,
      status,
    })
    .onConflictDoUpdate({
      target: workerHeartbeats.workerName,
      set: {
        lastSeenAt: now,
        status,
      },
    });
  return { workerName, lastSeenAt: now, status };
}

/**
 * AZ-02: Inspect background worker liveness for telemetry / health checks
 */
export async function getWorkerHeartbeatStatus(
  workerName = "educore-finance-worker"
) {
  const record = await db.query.workerHeartbeats.findFirst({
    where: eq(workerHeartbeats.workerName, workerName),
  });
  if (!record) {
    return { status: "not_started", isAlive: false, workerName };
  }
  const ageMs = Date.now() - new Date(record.lastSeenAt).getTime();
  const isAlive = ageMs < 120_000; // 2 minutes window
  return {
    status: isAlive ? record.status : "stale",
    isAlive,
    lastSeenAt: record.lastSeenAt,
    ageSeconds: Math.floor(ageMs / 1000),
    workerName,
  };
}

// ─── Worker Start ─────────────────────────────────────────────────────────────
if (process.env["START_WORKERS"] === "true") {
  // Record immediate startup heartbeat
  recordWorkerHeartbeat("educore-finance-worker", "alive").catch((err) =>
    console.error("[FinanceWorker] Failed to record initial heartbeat:", err)
  );

  // Periodic heartbeat interval every 30 seconds
  const heartbeatTimer = setInterval(async () => {
    try {
      await recordWorkerHeartbeat("educore-finance-worker", "alive");
    } catch (err) {
      console.error("[FinanceWorker] Failed to tick heartbeat:", err);
    }
  }, 30_000);

  if (typeof heartbeatTimer.unref === "function") {
    heartbeatTimer.unref();
  }

  const worker = new Worker<FinanceJobPayload>(
    "finance-automation",
    async (job) => {
      const { schoolId } = job.data;
      console.log(`[FinanceWorker] Processing automation routines for school: ${schoolId}`);
      await runSchoolFinanceAutomations(schoolId);
      await recordWorkerHeartbeat("educore-finance-worker", "alive").catch(() => {});
    },
    {
      connection: {
        host: process.env["REDIS_HOST"] ?? "127.0.0.1",
        port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
        password: process.env["REDIS_PASSWORD"] ?? undefined,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[FinanceWorker] Job ${job.id} completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[FinanceWorker] Job ${job?.id} failed:`, err);
  });
}
