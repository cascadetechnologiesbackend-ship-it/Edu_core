import { db, withTenant } from "@/db";
import { feeInvoices, schools } from "@/db/schema";
import { eq, and, lt, gt, isNull, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/apiAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";

const SYSTEM_CRON_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

function toPaise(val: number | string | null | undefined): number {
  const n = typeof val === "string" ? parseFloat(val) : Number(val ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}

export const POST = withCronAuth(async () => {
  // Enumerate schools: iterate each school independently under its tenant context
  // so a failure in one school does not block others.
  const allSchools = await db.query.schools.findMany({
    where: eq(schools.isActive, true),
    columns: { id: true },
  });

  let totalUpdated = 0;
  const errors: string[] = [];

  for (const school of allSchools) {
    try {
      const updatedCount = await applyLateFeesForSchool(school.id);
      totalUpdated += updatedCount;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`school ${school.id}: ${msg}`);
      console.error(`[late-fees cron] school ${school.id} error:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Applied late fees to ${totalUpdated} invoices across ${allSchools.length} schools.`,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * Apply late fees for all overdue PENDING and PARTIAL invoices for a given school.
 * Uses withTenant for RLS isolation, integer-paise arithmetic, FLAT/PERCENTAGE/PER_DAY + cap, and audit logs.
 */
async function applyLateFeesForSchool(schoolId: string): Promise<number> {
  const now = new Date();
  let updatedCount = 0;

  await withTenant(schoolId, async (tx) => {
    const overdueInvoices = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, schoolId),
        isNull(feeInvoices.deletedAt),
        lt(feeInvoices.dueDate, now),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL"]),
        gt(sql`CAST(${feeInvoices.balanceAmount} AS numeric)`, 0)
      ),
      with: { feeStructure: true },
      limit: 2000,
    });

    for (const invoice of overdueInvoices) {
      const structure = invoice.feeStructure;
      if (
        !structure ||
        !structure.lateFeeType ||
        !structure.lateFeeAmount ||
        structure.lateFeeStartAfterDays == null
      ) {
        await tx
          .update(feeInvoices)
          .set({ status: "OVERDUE", updatedAt: now })
          .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.schoolId, schoolId)));

        await logFeeAuditEvent(tx, {
          schoolId,
          action: "MARK_INVOICE_OVERDUE_CRON",
          entityType: "FEE_INVOICE",
          entityId: invoice.id,
          previousData: { status: invoice.status },
          newData: { status: "OVERDUE" },
          reason: `Cron marked invoice #${invoice.invoiceNumber} OVERDUE (no late fee policy)`,
          performedById: SYSTEM_CRON_ACTOR_ID,
        });

        updatedCount++;
        continue;
      }

      const gracePeriodEnd = new Date(invoice.dueDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + structure.lateFeeStartAfterDays);

      if (now <= gracePeriodEnd) {
        continue;
      }

      const daysOverdue = Math.floor(
        (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysPastGrace = Math.max(0, daysOverdue - structure.lateFeeStartAfterDays);

      const grossPaise = toPaise(invoice.grossAmount);
      const existingLateFeePaise = toPaise(invoice.lateFeeAmount);
      let newLateFeePaise = existingLateFeePaise;

      if (structure.lateFeeType === "FLAT") {
        if (existingLateFeePaise === 0) {
          newLateFeePaise = toPaise(structure.lateFeeAmount);
        }
      } else if (structure.lateFeeType === "PERCENTAGE") {
        if (existingLateFeePaise === 0) {
          const pctBps = Math.round(parseFloat(structure.lateFeeAmount) * 100);
          newLateFeePaise = Math.round((grossPaise * pctBps) / 10000);
        }
      } else if (structure.lateFeeType === "PER_DAY") {
        const dailyRatePaise = toPaise(structure.lateFeeAmount);
        newLateFeePaise = Math.max(existingLateFeePaise, daysPastGrace * dailyRatePaise);
      }

      if (structure.lateFeeCap) {
        const capPaise = toPaise(structure.lateFeeCap);
        newLateFeePaise = Math.min(newLateFeePaise, capPaise);
      }

      if (newLateFeePaise === existingLateFeePaise && invoice.status === "OVERDUE") {
        continue;
      }

      const currentNetPaise = toPaise(invoice.netAmount);
      const currentBalancePaise = toPaise(invoice.balanceAmount);
      const lateFeeIncreasePaise = Math.max(0, newLateFeePaise - existingLateFeePaise);
      const nextNetPaise = currentNetPaise + lateFeeIncreasePaise;
      const nextBalancePaise = currentBalancePaise + lateFeeIncreasePaise;

      await tx
        .update(feeInvoices)
        .set({
          lateFeeAmount: fromPaise(newLateFeePaise),
          netAmount: fromPaise(nextNetPaise),
          balanceAmount: fromPaise(nextBalancePaise),
          status: "OVERDUE",
          updatedAt: now,
        })
        .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.schoolId, schoolId)));

      await logFeeAuditEvent(tx, {
        schoolId,
        action: "APPLY_LATE_FEE_CRON",
        entityType: "FEE_INVOICE",
        entityId: invoice.id,
        previousData: {
          status: invoice.status,
          lateFeeAmount: invoice.lateFeeAmount,
          netAmount: invoice.netAmount,
          balanceAmount: invoice.balanceAmount,
        },
        newData: {
          status: "OVERDUE",
          lateFeeAmount: fromPaise(newLateFeePaise),
          netAmount: fromPaise(nextNetPaise),
          balanceAmount: fromPaise(nextBalancePaise),
        },
        reason: `Cron applied ${structure.lateFeeType} late fee (${daysPastGrace} days past grace, cap ${structure.lateFeeCap || "none"})`,
        performedById: SYSTEM_CRON_ACTOR_ID,
      });

      updatedCount++;
    }
  });

  return updatedCount;
}
