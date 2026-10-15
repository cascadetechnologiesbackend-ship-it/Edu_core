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

  // Deployments on Vercel (*.vercel.app), Render (*.onrender.com), AWS (*.amazonaws.com), etc. are main apps, not school subdomains
  const isCloudDeploymentDomain =
    host.endsWith(".vercel.app") ||
    host.endsWith(".onrender.com") ||
    host.endsWith(".railway.app") ||
    host.endsWith(".amazonaws.com");

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
export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withTenant<T>(
  schoolId: string,
  txCallback: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
    return await txCallback(tx);
  });
}

/**
 * Executes a callback within a transactional context scoped for authentication
 * lookups BEFORE a session exists (e.g. NextAuth authorize() lookup by email).
 * Sets `app.current_role = 'SYSTEM_AUTH'` locally for the transaction.
 */
export async function withAuthContext<T>(
  txCallback: (tx: any) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)`);
    return await txCallback(tx);
  });
}

/**
 * Executes a callback within a transactional context scoped for platform super-admin operations.
 * Sets `app.current_role = 'PLATFORM_ADMIN'` locally for the transaction.
 *
 * SECURITY: Under the 13 RLS table policies, PLATFORM_ADMIN is granted read-only
 * access in USING (excluded from WITH CHECK). Cross-tenant writes outside withTenant(schoolId)
 * are rejected by RLS.
 */
export async function withPlatformContext<T>(
  txCallback: (tx: any) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)`);
    return await txCallback(tx);
  });
}
