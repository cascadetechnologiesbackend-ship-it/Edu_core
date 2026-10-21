"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { feeQueries, feeInvoices, students, users, userRoles, roles } from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { revalidatePath } from "next/cache";

export type FeeQueryStatusFilter = "ALL" | "OPEN" | "ANSWERED" | "RESOLVED" | "ESCALATED" | "SLA_BREACHED";

export interface AdminFeeQueryItem {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  termName?: string;
  invoiceBalance: number;
  category: string;
  message: string;
  status: "OPEN" | "ANSWERED" | "RESOLVED" | "ESCALATED";
  createdAt: string;
  hoursElapsed: number;
  slaStatus: "WITHIN_SLA" | "APPROACHING_SLA" | "SLA_BREACHED" | "CRITICAL_7D";
  answer?: string | null;
  answeredAt?: string | null;
  answeredByName?: string | null;
  escalatedAt?: string | null;
}

/**
 * Fetch fee query records for the accountant/admin inbox (surface_p8).
 */
export async function getAdminFeeQueries(filter: FeeQueryStatusFilter = "ALL") {
  try {
    const ctx = await requireAuth([
      "ACCOUNTANT",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "SUPER_ADMIN",
    ] as const);
    const school = await requireSchool(ctx);
    const now = new Date();

    return await withTenant(school.id, async (tx) => {
      const rows = await tx
        .select({
          query: feeQueries,
          invoice: feeInvoices,
          student: students,
        })
        .from(feeQueries)
        .innerJoin(feeInvoices, eq(feeQueries.invoiceId, feeInvoices.id))
        .innerJoin(students, eq(feeQueries.studentId, students.id))
        .where(eq(feeQueries.schoolId, school.id))
        .orderBy(desc(feeQueries.createdAt));

      // Resolve responder names
      const responderUserIds = Array.from(
        new Set(rows.map((r) => r.query.answeredByUserId).filter(Boolean) as string[])
      );

      const responderUsers =
        responderUserIds.length > 0
          ? await tx.query.users.findMany({
              where: and(
                eq(users.schoolId, school.id),
                inArray(users.id, responderUserIds)
              ),
            })
          : [];

      const responderMap = new Map<string, string>();
      for (const u of responderUsers) {
        responderMap.set(u.id, u.email || "Accountant");
      }

      const items: AdminFeeQueryItem[] = rows.map(({ query, invoice, student }) => {
        let studentName = `Student ${student.admissionNumber}`;
        try {
          if (student.firstNameEncrypted) {
            const first = decryptData(student.firstNameEncrypted);
            const last = student.lastNameEncrypted
              ? decryptData(student.lastNameEncrypted)
              : "";
            studentName = `${first} ${last}`.trim();
          }
        } catch {}

        const createdMs = new Date(query.createdAt).getTime();
        const hoursElapsed = Math.floor((now.getTime() - createdMs) / 3600000);

        let slaStatus: "WITHIN_SLA" | "APPROACHING_SLA" | "SLA_BREACHED" | "CRITICAL_7D" =
          "WITHIN_SLA";

        if (query.status === "OPEN") {
          if (hoursElapsed >= 120) {
            // > 5 days, critical 7d auto-escalation risk
            slaStatus = "CRITICAL_7D";
          } else if (hoursElapsed >= 48) {
            // > 48h first response SLA breached
            slaStatus = "SLA_BREACHED";
          } else if (hoursElapsed >= 24) {
            slaStatus = "APPROACHING_SLA";
          }
        }

        return {
          id: query.id,
          studentId: query.studentId,
          studentName,
          admissionNumber: student.admissionNumber,
          invoiceId: query.invoiceId,
          invoiceNumber: invoice.invoiceNumber || "Invoice",
          invoiceBalance: Number(invoice.balanceAmount || 0),
          category: query.category,
          message: query.message,
          status: query.status,
          createdAt: new Date(query.createdAt).toISOString(),
          hoursElapsed,
          slaStatus,
          answer: query.answer,
          answeredAt: query.answeredAt ? new Date(query.answeredAt).toISOString() : null,
          answeredByName: query.answeredByUserId
            ? responderMap.get(query.answeredByUserId) || "School Staff"
            : null,
          escalatedAt: query.escalatedAt ? new Date(query.escalatedAt).toISOString() : null,
        };
      });

      // Filter in memory for responsiveness
      const filtered = items.filter((item) => {
        if (filter === "ALL") return true;
        if (filter === "SLA_BREACHED") return item.status === "OPEN" && item.hoursElapsed >= 48;
        return item.status === filter;
      });

      return {
        success: true as const,
        queries: filtered,
        counts: {
          all: items.length,
          open: items.filter((i) => i.status === "OPEN").length,
          slaBreached: items.filter((i) => i.status === "OPEN" && i.hoursElapsed >= 48).length,
          answered: items.filter((i) => i.status === "ANSWERED").length,
          resolved: items.filter((i) => i.status === "RESOLVED").length,
          escalated: items.filter((i) => i.status === "ESCALATED").length,
        },
      };
    });
  } catch (error: any) {
    console.error("[getAdminFeeQueries] Error:", error);
    return { success: false as const, error: error.message || "Failed to fetch fee queries." };
  }
}

/**
 * Accountant/Admin responds to a parent fee query.
 */
export async function answerAdminFeeQuery(input: { queryId: string; answer: string }) {
  try {
    const ctx = await requireAuth([
      "ACCOUNTANT",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "SUPER_ADMIN",
    ] as const);
    const school = await requireSchool(ctx);

    if (!input.queryId || !input.answer?.trim()) {
      return { success: false as const, error: "Query ID and answer response are required." };
    }

    return await withTenant(school.id, async (tx) => {
      const query = await tx.query.feeQueries.findFirst({
        where: and(eq(feeQueries.id, input.queryId), eq(feeQueries.schoolId, school.id)),
      });

      if (!query) {
        return { success: false as const, error: "Fee query record not found." };
      }

      await tx
        .update(feeQueries)
        .set({
          status: "ANSWERED",
          answer: input.answer.trim(),
          answeredByUserId: ctx.userId,
          answeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feeQueries.id, input.queryId));

      revalidatePath("/admin/fees/queries");
      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/fees");

      return { success: true as const, message: "Response successfully recorded and notified to parent." };
    });
  } catch (error: any) {
    return { success: false as const, error: error.message || "Failed to record answer." };
  }
}

/**
 * Accountant/Admin manually escalates a dispute to the Principal.
 */
export async function escalateAdminFeeQuery(input: { queryId: string; note?: string }) {
  try {
    const ctx = await requireAuth([
      "ACCOUNTANT",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "SUPER_ADMIN",
    ] as const);
    const school = await requireSchool(ctx);
    const now = new Date();

    return await withTenant(school.id, async (tx) => {
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
        .where(
          and(eq(feeQueries.id, input.queryId), eq(feeQueries.schoolId, school.id))
        );

      revalidatePath("/admin/fees/queries");
      revalidatePath("/parent/dashboard");

      return { success: true as const, message: "Fee query escalated to Principal." };
    });
  } catch (error: any) {
    return { success: false as const, error: error.message || "Failed to escalate fee query." };
  }
}
