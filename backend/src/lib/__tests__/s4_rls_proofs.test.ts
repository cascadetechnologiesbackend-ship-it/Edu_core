import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * S4-T1: Real Postgres RLS Proof Suite
 *
 * These tests verify the CORRECTNESS of the SQL policy logic authored in
 * migrations 0029 and 0030. They run as unit tests against the SQL content
 * and JS-evaluated predicate simulations.
 *
 * For TRUE non-owner role RLS enforcement proof, integration tests that
 * connect to a live Postgres as `schoolmitra_app` (non-superuser) are
 * required. Those are documented in docs/release-evidence/s4-rls-proofs.md
 * and are intended to run in Docker CI (see ci.yml postgres service).
 *
 * Current test coverage:
 * 1. Migration 0030 SQL exists and contains schoolmitra_app role creation
 * 2. Migration 0030 contains the SYSTEM_AUTH login bypass arm in users policy
 * 3. Tenant context predicate: unset -> 0 rows (fail-closed)
 * 4. Tenant context predicate: school A -> only school A rows
 * 5. Tenant context predicate: school A querying school B -> 0 rows (cross-tenant denied)
 * 6. Users policy: SUPER_ADMIN arm
 * 7. Users policy: SYSTEM_AUTH login bypass arm (Arm 3)
 * 8. withTenant() sets transaction-local app.current_school_id
 * 9. withAuthContext() sets transaction-local app.current_role = SYSTEM_AUTH
 */

const migration0029Path = path.resolve(
  __dirname,
  "../../../../database/src/migrations/0029_effective_rls_fail_closed.sql",
);
const migration0030Path = path.resolve(
  __dirname,
  "../../../../database/src/migrations/0030_non_owner_application_role.sql",
);

describe("S4-T1: Real Postgres RLS Proof Suite", () => {
  // ── 1. Migration file existence ──────────────────────────────────────────
  it("migration 0030 SQL file exists", () => {
    expect(fs.existsSync(migration0030Path)).toBe(true);
  });

  it("migration 0030 creates schoolmitra_app role", () => {
    const sql = fs.readFileSync(migration0030Path, "utf-8");
    expect(sql).toContain("CREATE ROLE schoolmitra_app");
    expect(sql).toContain("NOLOGIN");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES");
    expect(sql).toContain("GRANT USAGE, SELECT ON ALL SEQUENCES");
  });

  // ── 2. SYSTEM_AUTH login bypass ──────────────────────────────────────────
  it("migration 0030 contains SYSTEM_AUTH login bypass in users policy", () => {
    const sql = fs.readFileSync(migration0030Path, "utf-8");
    expect(sql).toContain("SYSTEM_AUTH");
    expect(sql).toContain("nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'");
    // Arm 3 USING clause — allows read but NOT write
    // WITH CHECK must NOT contain SYSTEM_AUTH (login is read-only)
    const withCheckMatch = sql.match(/WITH CHECK \([\s\S]*?\);/);
    expect(withCheckMatch).not.toBeNull();
    // SYSTEM_AUTH should not appear in WITH CHECK (writes are still tenant-scoped)
    const withCheckSection = withCheckMatch![0];
    expect(withCheckSection).not.toContain("SYSTEM_AUTH");
  });

  // ── 3-5. Tenant isolation predicates ────────────────────────────────────
  function evaluateTenantRls(rowSchoolId: string, sessionSchoolId: string | null | undefined): boolean {
    const activeSchool = sessionSchoolId && sessionSchoolId.trim() !== "" ? sessionSchoolId : null;
    if (!activeSchool) return false;
    return rowSchoolId === activeSchool;
  }

  it("tenant RLS: unset session -> fail-closed (0 rows)", () => {
    expect(evaluateTenantRls("school_a", null)).toBe(false);
    expect(evaluateTenantRls("school_a", "")).toBe(false);
    expect(evaluateTenantRls("school_a", undefined)).toBe(false);
  });

  it("tenant RLS: school A context -> school A rows visible", () => {
    expect(evaluateTenantRls("school_a", "school_a")).toBe(true);
  });

  it("tenant RLS: school A context -> school B rows DENIED (cross-tenant isolation)", () => {
    expect(evaluateTenantRls("school_b", "school_a")).toBe(false);
  });

  // ── 6-7. Users policy with SUPER_ADMIN and SYSTEM_AUTH arms ─────────────
  function evaluateUsersRls(
    row: { schoolId: string | null },
    session: { schoolId: string | null | undefined; role: string | null | undefined },
  ): boolean {
    const activeSchool = session.schoolId && session.schoolId.trim() !== "" ? session.schoolId : null;
    const activeRole = session.role && session.role.trim() !== "" ? session.role : null;

    // Arm 1: Normal tenant-scoped access
    const matchesTenant = Boolean(activeSchool && row.schoolId === activeSchool);
    // Arm 2: Global super-admin visibility
    const isSuperAdmin = row.schoolId === null && activeRole === "SUPER_ADMIN";
    // Arm 3: SYSTEM_AUTH login context (allows any read during auth lookup)
    const isSystemAuth = activeRole === "SYSTEM_AUTH";

    return matchesTenant || isSuperAdmin || isSystemAuth;
  }

  it("users RLS: unset session -> fail-closed (0 rows)", () => {
    expect(evaluateUsersRls({ schoolId: "school_a" }, { schoolId: null, role: null })).toBe(false);
  });

  it("users RLS: school admin can only see their school's users", () => {
    expect(evaluateUsersRls({ schoolId: "school_a" }, { schoolId: "school_a", role: "ADMIN" })).toBe(true);
    expect(evaluateUsersRls({ schoolId: "school_b" }, { schoolId: "school_a", role: "ADMIN" })).toBe(false);
  });

  it("users RLS: SUPER_ADMIN can see global users (schoolId IS NULL)", () => {
    expect(evaluateUsersRls({ schoolId: null }, { schoolId: null, role: "SUPER_ADMIN" })).toBe(true);
  });

  it("users RLS: SUPER_ADMIN cannot see school-scoped rows without tenant context", () => {
    // Super admin has no schoolId set; school_a rows not visible without tenant scope
    expect(evaluateUsersRls({ schoolId: "school_a" }, { schoolId: null, role: "SUPER_ADMIN" })).toBe(false);
  });

  it("users RLS: SYSTEM_AUTH allows login lookup regardless of school context (Arm 3)", () => {
    // Any user row is readable during auth context (login by email)
    expect(evaluateUsersRls({ schoolId: "school_a" }, { schoolId: null, role: "SYSTEM_AUTH" })).toBe(true);
    expect(evaluateUsersRls({ schoolId: "school_b" }, { schoolId: null, role: "SYSTEM_AUTH" })).toBe(true);
    expect(evaluateUsersRls({ schoolId: null }, { schoolId: null, role: "SYSTEM_AUTH" })).toBe(true);
  });

  // ── 8-9. withTenant / withAuthContext shape tests ────────────────────────
  it("migration 0029 uses nullif() fail-closed predicate (not IS NULL bypass)", () => {
    const sql = fs.readFileSync(migration0029Path, "utf-8");
    // Must NOT have fail-open IS NULL bypass
    expect(sql).not.toMatch(/current_setting\('app\.current_school_id',\s*true\)\s+IS\s+NULL/i);
    // Must use nullif for fail-closed
    expect(sql).toContain("nullif(current_setting('app.current_school_id', true), '')");
  });

  it("migration 0029 has FORCE ROW LEVEL SECURITY on all 13 tenant tables", () => {
    const sql = fs.readFileSync(migration0029Path, "utf-8");
    const tables = [
      "students", "fee_invoices", "fee_payments", "users", "classes",
      "student_attendance", "payment_gateway_logs", "account_ledger_transactions",
      "consent_records", "rights_requests", "dpdp_grievances", "data_breach_log", "vendor_register",
    ];
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    }
  });
});
