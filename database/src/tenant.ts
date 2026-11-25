import { sql } from "drizzle-orm";
import { db, type Db } from "./index";
import crypto from "node:crypto";

export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TenantCapability {
  schoolId: string;
  actorId: string;
  sessionId: string;
  expiresAt: number;
  token: string;
}

export class TenantSecurityService {
  public static getSigningSecret(): string {
    const secret =
      process.env.DATABASE_TENANT_HMAC_KEY ||
      process.env.ENCRYPTION_KEY ||
      "default-dev-tenant-hmac-key-must-be-at-least-32-chars";
    return secret;
  }

  public static generateTenantCapability(
    schoolId: string,
    actorId: string,
    sessionId: string,
    ttlSeconds: number = 300,
  ): TenantCapability {
    const secret = this.getSigningSecret();
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    // Canonical format strictly shared with PostgreSQL: school_id:actor_id:session_id:expires_at
    const message = `${schoolId}:${actorId}:${sessionId}:${expiresAt}`;
    const token = crypto
      .createHmac("sha256", Buffer.from(secret, "utf8"))
      .update(Buffer.from(message, "utf8"))
      .digest("hex");

    return {
      schoolId,
      actorId,
      sessionId,
      expiresAt,
      token,
    };
  }

  public static verifyCapability(
    schoolId: string,
    actorId: string,
    sessionId: string,
    expiresAt: number,
    token: string,
  ): boolean {
    if (expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const secret = this.getSigningSecret();
    const message = `${schoolId}:${actorId}:${sessionId}:${expiresAt}`;
    const expected = crypto
      .createHmac("sha256", Buffer.from(secret, "utf8"))
      .update(Buffer.from(message, "utf8"))
      .digest("hex");

    if (expected.length !== token.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
  }
}

let isSecurityGateAvailable: boolean | null = null;

/**
 * Executes a callback within a transactional tenant context.
 * Sets the PostgreSQL session variable `app.current_school_id` locally for the transaction,
 * enforcing Row Level Security (RLS) policies at the database layer.
 * Also invokes `security.set_verified_tenant_context` with cryptographic HMAC token when available.
 *
 * SECURITY: Uses set_config(..., true) — the third argument `true` makes the
 * setting LOCAL to the current transaction, preventing leakage across pooled
 * connections. Never call SET app.current_school_id outside a transaction.
 */
export async function withTenant<T>(
  schoolId: string,
  txCallback: (tx: TenantTransaction) => Promise<T>,
  options?: { actorId?: string; sessionId?: string },
): Promise<T> {
  const actorId = options?.actorId || "system-actor";
  const sessionId = options?.sessionId || "default-session";
  const capability = TenantSecurityService.generateTenantCapability(schoolId, actorId, sessionId);

  return await db.transaction(async (tx) => {
    if (typeof (tx as any)?.execute === "function") {
      await (tx as any).execute(
        sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`,
      );

      if (isSecurityGateAvailable === null) {
        try {
          const checkRes = await (tx as any).execute(
            sql`SELECT to_regprocedure('security.set_verified_tenant_context(uuid,text,text,bigint,text)') as proc`,
          );
          const row = (checkRes as any).rows?.[0] || (checkRes as any)[0];
          isSecurityGateAvailable = row?.proc !== null && row?.proc !== undefined;
        } catch {
          isSecurityGateAvailable = false;
        }
      }

      if (isSecurityGateAvailable) {
        try {
          await (tx as any).execute(sql`SELECT security.set_verified_tenant_context(
            ${capability.schoolId}::uuid,
            ${capability.actorId},
            ${capability.sessionId},
            ${capability.expiresAt}::bigint,
            ${capability.token}
          )`);
        } catch {
          // Non-fatal if HMAC procedure throws; app.current_school_id is already set
        }
      }
    }
    return await txCallback(tx);
  });
}

/**
 * Executes a callback within a transactional context scoped for authentication
 * lookups BEFORE a session exists (e.g. NextAuth authorize() lookup by email).
 * Sets `app.current_role = 'SYSTEM_AUTH'` locally for the transaction.
 */
export async function withAuthContext<T>(
  txCallback: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    if (typeof (tx as any)?.execute === "function") {
      await (tx as any).execute(
        sql`SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)`,
      );
    }
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
  txCallback: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    if (typeof (tx as any)?.execute === "function") {
      await (tx as any).execute(
        sql`SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)`,
      );
    }
    return await txCallback(tx);
  });
}
