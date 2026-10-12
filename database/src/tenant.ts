import { sql } from "drizzle-orm";
import { db, type Db } from "./index";

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
  txCallback: (tx: Db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`,
    );
    return await txCallback(tx as any);
  });
}

/**
 * Executes a callback within a transactional context scoped for authentication
 * lookups BEFORE a session exists (e.g. NextAuth authorize() lookup by email).
 * Sets `app.current_role = 'SYSTEM_AUTH'` locally for the transaction.
 */
export async function withAuthContext<T>(
  txCallback: (tx: Db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)`,
    );
    return await txCallback(tx as any);
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
  txCallback: (tx: Db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)`,
    );
    return await txCallback(tx as any);
  });
}
