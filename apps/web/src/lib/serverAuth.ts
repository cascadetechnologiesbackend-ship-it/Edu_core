import { auth } from "@/lib/auth";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "@schoolmitra/validators";

// ─── Server Action Auth Context ───────────────────────────────────────────────
// ALWAYS use requireAuth() at the top of every server action.
// NEVER use db.query.schools.findFirst() without a WHERE clause.

export interface AuthContext {
  userId: string;
  schoolId: string | null; // null only for SUPER_ADMIN platform actions
  role: Role;
  email: string;
}

/**
 * Validates the session and (optionally) enforces an allowed-roles list.
 * Use this at the top of every server action instead of raw auth() calls.
 *
 * @throws "UNAUTHORIZED" if not logged in
 * @throws "FORBIDDEN: requires roles [...]" if role not in allowedRoles
 *
 * @example
 *   const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
 *   const school = await requireSchool(ctx);
 */
export async function requireAuth(allowedRoles?: readonly Role[]): Promise<AuthContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = session.user.role as Role;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new Error(
      `FORBIDDEN: requires roles [${allowedRoles.join(", ")}], got ${role}`,
    );
  }

  return {
    userId: session.user.id,
    schoolId: (session.user as { schoolId?: string | null }).schoolId ?? null,
    role,
    email: session.user.email ?? "",
  };
}

/**
 * Resolves the active school record using the session's schoolId (tenant-scoped).
 * NEVER returns a random school — always scopes to the authenticated user's school.
 *
 * Use this to replace ALL occurrences of:
 *   db.query.schools.findFirst()
 *
 * @throws Error if schoolId is missing or school is not found / not active
 */
export async function requireSchool(ctx: AuthContext) {
  if (!ctx.schoolId) {
    throw new Error(
      "UNAUTHORIZED: no school context. SUPER_ADMIN must use platform-level actions.",
    );
  }

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, ctx.schoolId),
  });

  if (!school) {
    throw new Error(`School not found for id: ${ctx.schoolId}`);
  }

  if (!school.isActive) {
    throw new Error("School account is suspended. Contact your platform administrator.");
  }

  return school;
}

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
