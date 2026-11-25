import { describe, it, expect } from "vitest";
import { withTenant, withPlatformContext, withAuthContext } from "../tenant";
import { sql } from "drizzle-orm";

describe("Multi-Tenant RLS Policy Invariants (SEC-RLS-001 / SEC-RLS-002)", () => {
  const schoolAId = "a1111111-1111-4111-8111-111111111111";
  const schoolBId = "b2222222-2222-4222-8222-222222222222";

  it("withTenant sets local app.current_school_id within transaction scope", async () => {
    await withTenant(schoolAId, async (tx) => {
      const res = await tx.execute(sql`SELECT current_setting('app.current_school_id', true) as current_school`);
      const currentSchool = (res as any).rows?.[0]?.current_school ?? (res as any)[0]?.current_school;
      expect(currentSchool).toBe(schoolAId);
    });
  });

  it("withPlatformContext sets app.current_role = 'PLATFORM_ADMIN' and nullifies school context", async () => {
    await withPlatformContext(async (tx) => {
      const res = await tx.execute(sql`
        SELECT 
          current_setting('app.current_role', true) as current_role,
          current_setting('app.current_school_id', true) as current_school
      `);
      const row = (res as any).rows?.[0] ?? (res as any)[0];
      expect(row.current_role).toBe("PLATFORM_ADMIN");
      expect(row.current_school || null).toBeNull();
    });
  });

  it("withAuthContext sets app.current_role = 'SYSTEM_AUTH' for unauthenticated lookups", async () => {
    await withAuthContext(async (tx) => {
      const res = await tx.execute(sql`SELECT current_setting('app.current_role', true) as current_role`);
      const row = (res as any).rows?.[0] ?? (res as any)[0];
      expect(row.current_role).toBe("SYSTEM_AUTH");
    });
  });

  it("prevents cross-tenant context leakage across sequential transactions", async () => {
    await withTenant(schoolAId, async (tx) => {
      const resA = await tx.execute(sql`SELECT current_setting('app.current_school_id', true) as current_school`);
      const rowA = (resA as any).rows?.[0] ?? (resA as any)[0];
      expect(rowA.current_school).toBe(schoolAId);
    });

    await withTenant(schoolBId, async (tx) => {
      const resB = await tx.execute(sql`SELECT current_setting('app.current_school_id', true) as current_school`);
      const rowB = (resB as any).rows?.[0] ?? (resB as any)[0];
      expect(rowB.current_school).toBe(schoolBId);
      expect(rowB.current_school).not.toBe(schoolAId);
    });
  });
});
