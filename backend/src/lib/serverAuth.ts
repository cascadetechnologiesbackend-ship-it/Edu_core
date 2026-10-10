import { auth } from "@/lib/auth";
import { db } from "@/db";
import { schools, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "@schoolmitra/validators";
import { cache } from "react";

// ─── Server Action Auth Context ───────────────────────────────────────────────
// ALWAYS use requireAuth() at the top of every server action.
// NEVER use db.query.schools.findFirst() without a WHERE clause.

export interface AuthContext {
  userId: string;
  schoolId: string | null; // null only for SUPER_ADMIN platform actions
  role: Role;
  email: string;
}

// Zero-arg cached session fetcher ensures 100% deduplication per RSC request
// and enforces live account active status verification (P3-T1 live drill)
export const getCachedSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  // Super admins skip school-level active checks unless impersonating
  if (session.user.role !== "SUPER_ADMIN") {
    try {
      const [u] = await db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (!u || !u.isActive) {
        return null;
      }
    } catch (err) {
      console.warn("getCachedSession: user active status check failed", err);
    }
  }

  return session;
});

import { getCachedSchool, invalidateSchoolCache } from "./schoolCache";

export { invalidateSchoolCache };

/**
 * Validates the session and (optionally) enforces an allowed-roles list.
 * Wrapped in React cache() and uses getCachedSession() — auth() is called
 * at most ONCE per request regardless of caller count.
 *
 * @throws "UNAUTHORIZED" if not logged in
 * @throws "FORBIDDEN: requires roles [...]" if role not in allowedRoles
 */
export async function requireAuth(
  allowedRoles?: readonly Role[],
): Promise<AuthContext> {
  const session = await getCachedSession();

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = session.user.role as Role;
  let schoolId = (session.user as { schoolId?: string | null }).schoolId ?? null;
  let effectiveRole = role;

  // If SUPER_ADMIN is impersonating a school tenant, resolve schoolId from cryptographically signed cookie
  if (role === "SUPER_ADMIN" && !schoolId) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = cookies();
      const impCookie = cookieStore.get("sm_impersonation");
      if (impCookie?.value) {
        const { verifyImpersonationToken } = await import("./impersonation");
        const impData = verifyImpersonationToken(impCookie.value);
        if (impData?.schoolId && impData.superAdminId === session.user.id) {
          schoolId = impData.schoolId;
          effectiveRole = "SCHOOL_ADMIN" as Role;
        }
      }
    } catch {}
  }

  // When SUPER_ADMIN is impersonating, role enforcement applies against effectiveRole (e.g. SCHOOL_ADMIN).
  // When SUPER_ADMIN is NOT impersonating, they have platform-level access unless allowedRoles explicitly excludes them.
  const isImpersonating = role === "SUPER_ADMIN" && Boolean(schoolId);

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(effectiveRole) &&
    (!isImpersonating && role !== "SUPER_ADMIN")
  ) {
    throw new Error(
      `FORBIDDEN: requires roles [${allowedRoles.join(", ")}], got ${effectiveRole}`,
    );
  }

  // If SUPER_ADMIN is impersonating, they MUST satisfy the allowedRoles list as effectiveRole
  if (
    isImpersonating &&
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(effectiveRole)
  ) {
    throw new Error(
      `FORBIDDEN: requires roles [${allowedRoles.join(", ")}], got ${effectiveRole}`,
    );
  }

  return {
    userId: session.user.id,
    schoolId,
    role: effectiveRole,
    email: session.user.email ?? "",
  };
}

/**
 * Resolves the active school record using the session's schoolId (tenant-scoped).
 * Cached with a 60s in-memory TTL so multi-module clicks avoid redundant roundtrips.
 *
 * @throws Error if schoolId is missing or school is not found / not active
 */
export const requireSchool = cache(async function requireSchoolImpl(
  ctx: AuthContext,
) {
  if (!ctx.schoolId) {
    throw new Error(
      "UNAUTHORIZED: no school context. SUPER_ADMIN must use platform-level actions.",
    );
  }

  const schoolId = ctx.schoolId;
  const now = Date.now();
  const school = await getCachedSchool(schoolId);

  if (!school) {
    throw new Error(`School not found for id: ${schoolId}`);
  }

  if (!school.isActive) {
    throw new Error("School account is suspended. Contact your platform administrator.");
  }

  if (school.subscriptionExpiresAt && new Date(school.subscriptionExpiresAt).getTime() < now) {
    throw new Error(
      "School subscription has expired. Please renew your subscription to continue accessing the portal.",
    );
  }

  return school;
});

/**
 * Convenience wrapper for server actions that return { success, message }.
 * Returns a standardised error object instead of throwing.
 */
export async function safeRequireAuth(
  allowedRoles?: readonly Role[],
): Promise<{ ctx: AuthContext } | { success: false; message: string }> {
  try {
    const ctx = await requireAuth(allowedRoles);
    return { ctx };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return { success: false, message };
  }
}
