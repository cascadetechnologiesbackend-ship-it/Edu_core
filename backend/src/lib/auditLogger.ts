import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { TRPCContext } from "@/server/trpc";

export async function logAuditEvent(
  ctx: TRPCContext | any,
  params: {
    action: "READ" | "WRITE" | "DELETE";
    tableName: string;
    recordId: string;
    purposeId: string;
    metadata?: any;
    schoolId: string;
  },
) {
  const userId =
    ctx?.session?.user?.id ||
    ctx?.user?.id ||
    ctx?.userId ||
    "00000000-0000-0000-0000-000000000000";
  const userEmail =
    ctx?.session?.user?.email ||
    ctx?.user?.email ||
    ctx?.userEmail ||
    "system@schoolmitra.com";
  const userRole =
    ctx?.session?.user?.role ||
    ctx?.user?.role ||
    ctx?.userRole ||
    "ADMIN";

  const ipAddress =
    ctx?.ip ||
    ctx?.ipAddress ||
    (ctx?.req?.socket?.remoteAddress) ||
    "127.0.0.1";
  const userAgent =
    ctx?.userAgent ||
    (ctx?.req?.headers ? ctx.req.headers["user-agent"] : null) ||
    "system/server-action";

  await db.insert(auditLogs).values({
    userId,
    userEmail,
    userRole,
    schoolId: params.schoolId,
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    purposeId: params.purposeId,
    ipAddress: ipAddress || "127.0.0.1",
    userAgent: userAgent || "system/server-action",
    metadata: params.metadata || {},
  });
}
