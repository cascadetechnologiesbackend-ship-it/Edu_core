import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { TRPCContext } from "@/server/trpc";

export async function logAuditEvent(
  ctx: TRPCContext,
  params: {
    action: "READ" | "WRITE" | "DELETE";
    tableName: string;
    recordId: string;
    purposeId: string;
    metadata?: any;
    schoolId: string;
  }
) {
  const userId = ctx.session?.user?.id || "00000000-0000-0000-0000-000000000000";
  const userEmail = ctx.session?.user?.email || "public@schoolmitra.com";
  const userRole = ctx.session?.user?.role || "PARENT"; // Public users are typically parents applying

  await db.insert(auditLogs).values({
    userId,
    userEmail,
    userRole,
    schoolId: params.schoolId,
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    purposeId: params.purposeId,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: params.metadata || {},
  });
}
