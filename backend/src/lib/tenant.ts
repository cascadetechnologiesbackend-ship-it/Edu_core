import { headers } from "next/headers";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache as reactCache } from "react";

const safeCache = typeof reactCache === "function" ? reactCache : <T extends (...args: any[]) => any>(fn: T): T => fn;

/**
 * Resolves the active tenant school from the request headers' subdomain.
 * Wrapped in React cache() to deduplicate queries within a single request.
 *
 * NOTE: Returns null on cloud deployment domains (*.vercel.app, *.onrender.com)
 * where no school subdomain is present. For cloud deployments, tenant context
 * must be derived from the authenticated session — see getTenantFromSession().
 */
export const getActiveTenant = safeCache(async () => {
  const host = headers().get("host") || "";
  const parts = host.split(".");
  let tenant = "";

  // Deployments on Vercel (*.vercel.app), Render (*.onrender.com), etc. are main apps, not school subdomains
  const isCloudDeploymentDomain =
    host.endsWith(".vercel.app") ||
    host.endsWith(".onrender.com") ||
    host.endsWith(".railway.app");

  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    if (parts.length > 1 && parts[0] !== "localhost" && parts[0] !== "127") {
      tenant = parts[0] || "";
    }
  } else if (!isCloudDeploymentDomain && parts.length > 2) {
    tenant = parts[0] || "";
  }

  // If no subdomain is present, return null (global fallback or master view)
  if (!tenant || tenant === "www") {
    return null;
  }

  const cleanTenant = tenant.toLowerCase().trim();
  const school = await db.query.schools.findFirst({
    where: or(
      eq(schools.slug, cleanTenant),
      eq(schools.udiseCode, cleanTenant),
    ),
  });

  if (!school) {
    notFound();
  }

  return school;
});

/**
 * Resolves tenant school from a session-provided schoolId.
 * Used on cloud deployment domains (*.onrender.com, *.vercel.app) where
 * there is no school subdomain — the schoolId comes from the JWT session.
 *
 * Returns null for SUPER_ADMIN sessions (no tenant scope).
 */
export async function getTenantFromSession(schoolId: string | null | undefined) {
  if (!schoolId) return null;

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  return school ?? null;
}

/**
 * Executes a callback within a transactional tenant context.
 * Sets the PostgreSQL session variable `app.current_school_id` locally for the transaction,
 * enforcing Row Level Security (RLS) policies at the database layer.
 *
 * SECURITY: Uses set_config(..., true) — the third argument `true` makes the
 * setting LOCAL to the current transaction, preventing leakage across pooled
 * connections. Never call SET app.current_school_id outside a transaction.
 */
export async function withTenant<T>(
  schoolId: string,
  txCallback: (tx: any) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
    return await txCallback(tx);
  });
}

/**
 * Executes a callback within a transactional context scoped for authentication
 * lookups BEFORE a session exists.
 *
 * The login path (NextAuth authorize()) queries the `users` table by email
 * before any school context is known. Since migration 0029 enforced FORCE RLS,
 * a plain query with no `app.current_school_id` would return 0 rows (fail-closed).
 *
 * This helper temporarily sets `app.current_school_id = ''` (empty string) AND
 * `app.current_role = 'SYSTEM_AUTH'` so a dedicated RLS bypass policy can permit
 * the login lookup. As an alternative to a bypass policy, this can be used with
 * a connection that has BYPASSRLS privilege granted ONLY to the migration runner role.
 *
 * For managed Render/Vercel Postgres, the practical solution is:
 * - The `users` table RLS policy already permits rows where school_id IS NULL (global
 *   super-admins). For school-scoped users, the authorize() call must pass the schoolId
 *   via a pre-auth step (e.g. the login form queries the school from the email domain first,
 *   or a separate /api/auth/school endpoint resolves school from email).
 *
 * IMMEDIATE SAFE APPROACH: Run the auth lookup in a transaction that sets
 * app.current_school_id to the school found by email lookup (two-query approach):
 * 1. Query school_id from users table using BYPASSRLS role (migration runner / postgres superuser)
 * 2. Use withTenant(school_id) for the full user fetch + password check
 *
 * Until a non-owner connection string is wired, this function serves as the
 * documented placeholder for the auth session context.
 */
export async function withAuthContext<T>(
  txCallback: (tx: any) => Promise<T>,
): Promise<T> {
  // Auth lookups run in a transaction with SYSTEM_AUTH role context.
  // The users RLS policy must include:
  //   OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
  // for this to work.
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)`);
    return await txCallback(tx);
  });
}
