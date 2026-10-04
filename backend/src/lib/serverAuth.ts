import { auth } from "@/lib/auth";
import { db } from "@/db";
import { schools } from "@/db/schema";
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
const getCachedSession = cache(async () => {
  let session: any = null;
  if (process.env.NODE_ENV !== "production" && process.env.TEST_AUTH_USER) {
    try {
      session = JSON.parse(process.env.TEST_AUTH_USER);
    } catch {
      session = null;
    }
  }
  if (!session) {
    session = await auth();
  }
  return session;
});

// In-memory TTL cache for tenant school settings (infrequently mutated)
const schoolCache = new Map<string, { data: any; expiresAt: number }>();

export function invalidateSchoolCache(schoolId?: string) {
  if (schoolId) {
    schoolCache.delete(schoolId);
  } else {
    schoolCache.clear();
  }
}

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

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(effectiveRole) &&
    role !== "SUPER_ADMIN"
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
  const cached = schoolCache.get(schoolId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) {
    throw new Error(`School not found for id: ${schoolId}`);
  }

  if (!school.isActive) {
    throw new Error("School account is suspended. Contact your platform administrator.");
  }

  schoolCache.set(schoolId, { data: school, expiresAt: now + 60_000 });
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
