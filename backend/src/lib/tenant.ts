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
 * Executes a callback within a transactional tenant context.
 * Sets the PostgreSQL session variable `app.current_school_id` locally for the transaction,
 * enforcing Row Level Security (RLS) policies at the database layer.
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
