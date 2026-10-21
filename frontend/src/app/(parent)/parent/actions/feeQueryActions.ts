"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  feeQueries,
  feeInvoices,
  students,
  users,
  userRoles,
  roles,
  type feeQueryCategoryEnum,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  calculatePaymentAllocation,
  type InvoiceAllocationTarget,
  type InvoiceAllocationResult,
  type PaymentAllocationPlan,
} from "@/lib/feeAllocationEngine";

export {
  calculatePaymentAllocation,
  type InvoiceAllocationTarget,
  type InvoiceAllocationResult,
  type PaymentAllocationPlan,
};

export type FeeQueryCategory =
  | "BREAKDOWN"
  | "LATE_FEE"
  | "WAIVER_REQUEST"
  | "DOUBLE_PAYMENT"
  | "OTHER";

export interface CreateFeeQueryInput {
  studentId: string;
  invoiceId: string;
  category: FeeQueryCategory;
  message: string;
}

/**
 * Parent creates a fee query for a specific invoice (Workflow OP2, 3-click flow AC-P24).
 */
export async function createFeeQuery(input: CreateFeeQueryInput) {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!input.studentId || !input.invoiceId || !input.category || !input.message.trim()) {
      return { success: false, error: "All query fields are required." };
    }

    return await withTenant(school.id, async (tx) => {
      // 1. Verify student belongs to parent
      if (ctx.role === "PARENT") {
        const student = await tx.query.students.findFirst({
          where: and(
            eq(students.id, input.studentId),
            eq(students.schoolId, school.id),
            eq(students.primaryParentUserId, ctx.userId),
            eq(students.isActive, true)
          ),
        });

        if (!student) {
          return { success: false, error: "Unauthorized: student is not your registered ward." };
        }
      }

      // 2. Verify invoice belongs to student and school
      const invoice = await tx.query.feeInvoices.findFirst({
        where: and(
          eq(feeInvoices.id, input.invoiceId),
          eq(feeInvoices.studentId, input.studentId),
          eq(feeInvoices.schoolId, school.id)
        ),
      });

      if (!invoice) {
        return { success: false, error: "Selected invoice record was not found." };
      }

      // 3. Insert query record with status OPEN
      const [inserted] = await tx
        .insert(feeQueries)
        .values({
          schoolId: school.id,
          studentId: input.studentId,
          invoiceId: input.invoiceId,
          parentUserId: ctx.userId,
          category: input.category as any,
          message: input.message.trim(),
          status: "OPEN",
        })
        .returning();

      if (!inserted) {
        throw new Error("Failed to record fee query.");
      }

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/fees");

      return {
        success: true,
        queryId: inserted.id,
        message: "Fee query submitted. Typical school response time is within 2 days.",
      };
    });
  } catch (error: any) {
    console.error("[createFeeQuery] Error:", error);
    return { success: false, error: error.message || "Failed to submit fee query." };
  }
}

/**
 * Parent confirms resolution of an answered fee query.
 */
export async function resolveFeeQuery(queryId: string) {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async (tx) => {
      const query = await tx.query.feeQueries.findFirst({
        where: and(eq(feeQueries.id, queryId), eq(feeQueries.schoolId, school.id)),
      });

      if (!query) {
        return { success: false, error: "Query not found." };
      }

      if (ctx.role === "PARENT" && query.parentUserId !== ctx.userId) {
        return { success: false, error: "Unauthorized access to this query." };
      }

      await tx
        .update(feeQueries)
        .set({
          status: "RESOLVED",
          updatedAt: new Date(),
        })
        .where(eq(feeQueries.id, queryId));

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/fees");

      return { success: true, message: "Fee query marked as resolved." };
    });
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to resolve fee query." };
  }
}

/**
 * Parent escalates an answered or unresolved fee query to the Principal.
 */
export async function escalateFeeQuery(queryId: string) {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);
    const now = new Date();

    return await withTenant(school.id, async (tx) => {
      const query = await tx.query.feeQueries.findFirst({
        where: and(eq(feeQueries.id, queryId), eq(feeQueries.schoolId, school.id)),
      });

      if (!query) {
        return { success: false, error: "Query not found." };
      }

      if (ctx.role === "PARENT" && query.parentUserId !== ctx.userId) {
        return { success: false, error: "Unauthorized access to this query." };
      }

      // Find Principal of the school
      const principalRoleUser = await tx
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(userRoles.schoolId, school.id), eq(roles.name, "PRINCIPAL")))
        .limit(1);

      const principalUserId = principalRoleUser[0]?.userId || null;

      await tx
        .update(feeQueries)
        .set({
          status: "ESCALATED",
          escalatedAt: now,
          escalatedToUserId: principalUserId,
          updatedAt: now,
        })
        .where(eq(feeQueries.id, queryId));

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/fees");

      return {
        success: true,
        message: "Your query has been escalated to the Principal for executive review.",
      };
    });
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to escalate query." };
  }
}

/**
 * Combined Sibling Multi-Ward Payment preparation (OP12, AC-P21).
 * Calculates unified allocation across multiple siblings' invoices.
 */
export async function prepareCombinedSiblingPayment(invoiceIds: string[]) {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: "No invoices selected for payment." };
    }

    return await withTenant(school.id, async (tx) => {
      // Fetch requested invoices
      const invoiceRows = await tx.query.feeInvoices.findMany({
        where: and(
          inArray(feeInvoices.id, invoiceIds),
          eq(feeInvoices.schoolId, school.id)
        ),
      });

      if (invoiceRows.length !== invoiceIds.length) {
        return { success: false, error: "One or more invoices were not found." };
      }

      // If parent, verify all students belong to this parent
      if (ctx.role === "PARENT") {
        const studentIds = Array.from(new Set(invoiceRows.map((inv) => inv.studentId)));
        const wards = await tx.query.students.findMany({
          where: and(
            inArray(students.id, studentIds),
            eq(students.primaryParentUserId, ctx.userId),
            eq(students.schoolId, school.id)
          ),
        });

        if (wards.length !== studentIds.length) {
          return { success: false, error: "Invoices do not belong to your verified wards." };
        }
      }

      const targets: InvoiceAllocationTarget[] = invoiceRows.map((inv) => ({
        id: inv.id,
        studentId: inv.studentId,
        invoiceNumber: inv.invoiceNumber || undefined,
        dueDate: inv.dueDate,
        balanceAmount: Number(inv.balanceAmount || 0),
        lateFeeAmount: Number(inv.lateFeeAmount || 0),
      }));

      const totalBalance = targets.reduce(
        (sum, t) => sum + t.balanceAmount + t.lateFeeAmount,
        0
      );

      // Pre-compute plan
      const plan = calculatePaymentAllocation(targets, totalBalance);

      return {
        success: true,
        totalAmount: totalBalance,
        invoiceCount: targets.length,
        plan,
      };
    });
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to prepare sibling payment." };
  }
}
