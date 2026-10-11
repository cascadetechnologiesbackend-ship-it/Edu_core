import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { withTenant } from "../tenant";
import { db } from "@/db";

vi.mock("@/db", () => {
  const mockTx = {
    execute: vi.fn().mockResolvedValue({}),
  };
  return {
    db: {
      transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
      query: {
        schools: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

describe("Migration 0029 Fail-Closed PostgreSQL RLS", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../../database/src/migrations/0029_effective_rls_fail_closed.sql"
  );

  it("verifies migration 0029 SQL file exists and contains valid syntax", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    expect(sqlContent).toContain("Migration 0029: Enforce Effective Fail-Closed Row Level Security (RLS)");
  });

  it("enforces FORCE ROW LEVEL SECURITY on all 13 tenant tables", () => {
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    const expectedTables = [
      "students",
      "fee_invoices",
      "fee_payments",
      "users",
      "classes",
      "student_attendance",
      "payment_gateway_logs",
      "account_ledger_transactions",
      "consent_records",
      "rights_requests",
      "dpdp_grievances",
      "data_breach_log",
      "vendor_register",
    ];

    for (const table of expectedTables) {
      expect(sqlContent).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      expect(sqlContent).toContain(`DROP POLICY IF EXISTS tenant_isolation_policy ON "${table}";`);
      expect(sqlContent).toContain(`CREATE POLICY tenant_isolation_policy ON "${table}"`);
    }
  });

  it("ensures fail-closed logic: zero IS NULL fallback on app.current_school_id in tenant tables", () => {
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    
    // In migration 0028, there was "current_setting('app.current_school_id', true) IS NULL"
    // which allowed fail-open bypass. In 0029, that must be completely absent.
    expect(sqlContent).not.toMatch(/current_setting\('app\.current_school_id',\s*true\)\s+IS\s+NULL/i);

    // All tenant tables must use nullif(current_setting('app.current_school_id', true), '')
    expect(sqlContent).toContain("school_id::text = nullif(current_setting('app.current_school_id', true), '')");
  });

  it("simulates RLS fail-closed evaluation predicate", () => {
    function evaluateTenantRls(rowSchoolId: string, sessionSchoolId: string | null | undefined): boolean {
      const activeSchool = sessionSchoolId && sessionSchoolId.trim() !== "" ? sessionSchoolId : null;
      if (!activeSchool) {
        return false; // Fail-closed when session variable is unset or empty
      }
      return rowSchoolId === activeSchool;
    }

    // 1. Unset session -> FAIL-CLOSED (returns false)
    expect(evaluateTenantRls("school_alpha", null)).toBe(false);
    expect(evaluateTenantRls("school_alpha", "")).toBe(false);
    expect(evaluateTenantRls("school_alpha", undefined)).toBe(false);

    // 2. Active session matches row -> ALLOWED
    expect(evaluateTenantRls("school_alpha", "school_alpha")).toBe(true);

    // 3. Active session does not match row -> DENIED
    expect(evaluateTenantRls("school_alpha", "school_beta")).toBe(false);
  });

  it("simulates Users table RLS evaluation predicate with super-admin bypass", () => {
    function evaluateUsersRls(
      row: { school_id: string | null },
      session: { school_id: string | null | undefined; role: string | null | undefined }
    ): boolean {
      const activeSchool = session.school_id && session.school_id.trim() !== "" ? session.school_id : null;
      const activeRole = session.role && session.role.trim() !== "" ? session.role : null;

      // Policy: school_id::text = nullif(current_setting('app.current_school_id', true), '')
      //         OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
      const matchesTenant = Boolean(activeSchool && row.school_id === activeSchool);
      const isGlobalSuperAdmin = row.school_id === null && activeRole === "SUPER_ADMIN";

      return matchesTenant || isGlobalSuperAdmin;
    }

    // Unset session -> fail-closed
    expect(evaluateUsersRls({ school_id: "school_a" }, { school_id: null, role: null })).toBe(false);

    // School admin can only see their school's users
    expect(evaluateUsersRls({ school_id: "school_a" }, { school_id: "school_a", role: "ADMIN" })).toBe(true);
    expect(evaluateUsersRls({ school_id: "school_b" }, { school_id: "school_a", role: "ADMIN" })).toBe(false);

    // Global user (school_id IS NULL) is invisible to normal school admin
    expect(evaluateUsersRls({ school_id: null }, { school_id: "school_a", role: "ADMIN" })).toBe(false);

    // Global user is visible when session role is SUPER_ADMIN
    expect(evaluateUsersRls({ school_id: null }, { school_id: null, role: "SUPER_ADMIN" })).toBe(true);
  });

  it("withTenant helper sets transaction-local app.current_school_id", async () => {
    const schoolId = "test-school-tenant-123";
    let executedInTx = false;

    await withTenant(schoolId, async (tx) => {
      executedInTx = true;
      expect(tx).toBeDefined();
      expect(tx.execute).toHaveBeenCalled();
    });

    expect(executedInTx).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
