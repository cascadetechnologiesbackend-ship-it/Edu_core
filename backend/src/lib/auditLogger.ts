import { db } from "@/db";
import { auditLogs, platformAuditLogs, feeAuditLogs } from "@/db/schema";
import type { TRPCContext } from "@/server/trpc";

export async function logPlatformAuditEvent(params: {
  superAdminId: string;
  superAdminEmail: string;
  action: string;
  targetSchoolId?: string | null;
  entityType?: string;
  entityId?: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  metadata?: any;
  ipAddress?: string;
}) {
  try {
    await db.insert(platformAuditLogs).values({
      superAdminId: params.superAdminId,
      superAdminEmail: params.superAdminEmail,
      action: params.action,
      targetSchoolId: params.targetSchoolId ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      beforeSnapshot: params.beforeSnapshot ?? null,
      afterSnapshot: params.afterSnapshot ?? null,
      metadata: params.metadata ?? {},
      ipAddress: params.ipAddress ?? "127.0.0.1",
    });
  } catch (err) {
    console.error("Failed to write platform audit log:", err);
  }
}

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

export async function logFeeAuditEvent(
  txOrDb: any,
  params: {
    schoolId: string;
    action: string;
    entityType: string;
    entityId: string;
    previousData?: any;
    newData?: any;
    reason?: string | null;
    performedById: string;
    ipAddress?: string | null;
  },
) {
  try {
    const client = txOrDb || db;
    await client.insert(feeAuditLogs).values({
      schoolId: params.schoolId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousData: params.previousData ? JSON.stringify(params.previousData) : null,
      newData: params.newData ? JSON.stringify(params.newData) : null,
      reason: params.reason || null,
      performedById: params.performedById,
      ipAddress: params.ipAddress || "127.0.0.1",
    });
  } catch (err) {
    console.error("Failed to write fee audit log:", err);
  }
}

