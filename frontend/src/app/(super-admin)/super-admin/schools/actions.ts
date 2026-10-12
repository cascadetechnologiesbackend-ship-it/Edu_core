"use server";

import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { signImpersonationToken } from "@/lib/impersonation";
import { logPlatformAuditEvent } from "@/lib/auditLogger";

// Server action for Impersonation
export async function startImpersonationAction(formData: FormData) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  const schoolId = formData.get("schoolId") as string;
  const schoolName = formData.get("schoolName") as string;

  if (!schoolId) return;

  const token = signImpersonationToken(
    {
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      schoolId,
      schoolName: schoolName || "School Instance",
      role: "SCHOOL_ADMIN",
    },
    60,
  );

  await logPlatformAuditEvent({
    superAdminId: authCtx.userId,
    superAdminEmail: authCtx.email ?? "",
    action: "START_IMPERSONATION",
    targetSchoolId: schoolId,
    entityType: "school",
    entityId: schoolId,
    metadata: {
      schoolName: schoolName || "School Instance",
      ttlMinutes: 60,
    },
  });

  const isHttps = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").startsWith("https://");
  const cookieStore = cookies();
  cookieStore.set("sm_impersonation", token, {
    path: "/",
    maxAge: 3600, // 60 mins hard TTL
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
  });

  redirect("/dashboard");
}

// Server action for Status Lifecycle (R-14 Generic Administrative Suspension)
export async function toggleSchoolStatusAction(formData: FormData) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  const schoolId = formData.get("schoolId") as string;
  const currentStatus = formData.get("currentStatus") as string;
  const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  if (!schoolId) return;

  await db
    .update(schools)
    .set({
      status: newStatus,
      suspensionReason:
        newStatus === "SUSPENDED"
          ? "Administrative review pending"
          : null,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));

  await logPlatformAuditEvent({
    superAdminId: authCtx.userId,
    superAdminEmail: authCtx.email ?? "",
    action: newStatus === "SUSPENDED" ? "SUSPEND_SCHOOL" : "ACTIVATE_SCHOOL",
    targetSchoolId: schoolId,
    entityType: "school",
    entityId: schoolId,
    beforeSnapshot: { status: currentStatus },
    afterSnapshot: { status: newStatus },
  });

  const { invalidateSchoolCache } = await import("@/lib/schoolCache");
  await invalidateSchoolCache(schoolId);

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/super-admin/schools");
}
