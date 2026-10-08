import { describe, it, expect, beforeEach } from "vitest";
import {
  ROLE_CONFIGS,
  type UserRole,
  type NavItem,
} from "../../../lib/roleConfig";
import {
  canRoleAccessRoute,
  assertRouteAccess,
  securityAuditLogs,
  FULL_STUDENT_PROFILE_ALLOWED_ROLES,
} from "@/lib/routeGuards";

describe("Phase A1 & A2: Role-Scoped Access, Fail-Closed Navigation & Module Isolation", () => {
  beforeEach(() => {
    securityAuditLogs.length = 0;
  });

  describe("Phase A1: App Shell & Navigation Single Source of Truth", () => {
    it("ACCOUNTANT navigation contains exactly 4 groups and 10 permitted routes", () => {
      const accountantConfig = ROLE_CONFIGS.ACCOUNTANT;
      expect(accountantConfig).toBeDefined();
      expect(accountantConfig.defaultDashboard).toBe("/school/fees-dashboard");

      const items = accountantConfig.navItems;
      expect(items.length).toBe(10);

      // Verify the 4 authoritative groups
      const groups = Array.from(new Set(items.map((i) => i.group)));
      expect(groups).toEqual(["OVERVIEW", "OPERATIONS", "ACCOUNTS", "LEDGER WORK"]);

      const expectedHrefs = [
        "/school/fees-dashboard",
        "/school/collect-fees",
        "/school/due-fees",
        "/school/transactions",
        "/school/accounting/dashboard",
        "/school/accounting/reports/concessions",
        "/school/accounts/bank-reconciliation",
        "/school/fees-discount",
        "/school/refunds",
        "/school/fee-structures",
      ];
      expect(items.map((i) => i.href)).toEqual(expectedHrefs);
    });

    it("ACCOUNTANT navigation has ZERO leakage of non-finance modules", () => {
      const items = ROLE_CONFIGS.ACCOUNTANT.navItems;
      const prohibitedPrefixes = [
        "/students",
        "/admissions",
        "/academics",
        "/exams",
        "/attendance",
        "/hr",
        "/library",
        "/transport",
        "/settings",
        "/dpdp",
      ];

      items.forEach((item) => {
        prohibitedPrefixes.forEach((prohibited) => {
          expect(item.href.startsWith(prohibited)).toBe(false);
        });
      });
    });

    it("Symmetric role navigation isolation across all operational roles", () => {
      const librarianItems = ROLE_CONFIGS.LIBRARIAN.navItems;
      expect(librarianItems.every((i) => i.href.startsWith("/library") || i.href.startsWith("/librarian"))).toBe(true);

      const transportItems = ROLE_CONFIGS.TRANSPORT_MANAGER.navItems;
      expect(transportItems.every((i) => i.href.startsWith("/transport"))).toBe(true);

      const hrItems = ROLE_CONFIGS.HR_MANAGER.navItems;
      expect(hrItems.every((i) => i.href.startsWith("/hr") || i.href === "/dpdp" || i.href.startsWith("/attendance"))).toBe(true);
    });
  });

  describe("Phase A2: Server-Enforced Route Guards & AM-04 Security Audit Logging", () => {
    it("canRoleAccessRoute allows ACCOUNTANT only on permitted finance routes", () => {
      const allowed = [
        "/school/fees-dashboard",
        "/school/collect-fees",
        "/school/due-fees",
        "/school/transactions",
        "/school/accounting/dashboard",
        "/school/accounting/reports/concessions",
        "/school/accounts/bank-reconciliation",
        "/school/fees-discount",
        "/school/refunds",
        "/school/fee-structures",
      ];

      allowed.forEach((route) => {
        expect(canRoleAccessRoute("ACCOUNTANT", route)).toBe(true);
        expect(canRoleAccessRoute("ACCOUNTANT", `${route}?query=test`)).toBe(true);
      });
    });

    it("canRoleAccessRoute denies ACCOUNTANT on all non-finance routes", () => {
      const denied = [
        "/students",
        "/students/std-12345",
        "/exams",
        "/admissions",
        "/hr",
        "/library",
        "/transport",
        "/settings",
        "/settings/roles",
        "/dashboard",
      ];

      denied.forEach((route) => {
        expect(canRoleAccessRoute("ACCOUNTANT", route)).toBe(false);
      });
    });

    it("enforces fail-closed semantics (GT-03): unlisted routes and invalid roles return false", () => {
      expect(canRoleAccessRoute(undefined, "/school/fees-dashboard")).toBe(false);
      expect(canRoleAccessRoute(null, "/school/fees-dashboard")).toBe(false);
      expect(canRoleAccessRoute("" as UserRole, "/school/fees-dashboard")).toBe(false);
      expect(canRoleAccessRoute("INVALID_ROLE" as UserRole, "/school/fees-dashboard")).toBe(false);

      // Unmapped / non-existent route
      expect(canRoleAccessRoute("ACCOUNTANT", "/unmapped/route")).toBe(false);
      expect(canRoleAccessRoute("TEACHER", "/secret/admin/panel")).toBe(false);
    });

    it("Full student profile (/students/[id]) is restricted to FULL_STUDENT_PROFILE_ALLOWED_ROLES", () => {
      FULL_STUDENT_PROFILE_ALLOWED_ROLES.forEach((role) => {
        expect(canRoleAccessRoute(role, "/students/stu-abc-123")).toBe(true);
      });

      const blockedRoles: UserRole[] = ["ACCOUNTANT", "LIBRARIAN", "TRANSPORT_MANAGER", "DRIVER", "PARENT", "STUDENT"];
      blockedRoles.forEach((role) => {
        expect(canRoleAccessRoute(role, "/students/stu-abc-123")).toBe(false);
      });
    });

    it("AM-04: assertRouteAccess logs UNAUTHORIZED_ROUTE_ATTEMPT and redirects to defaultDashboard", () => {
      const user = { id: "usr_accountant_01", email: "mahesh@school.org" };
      const deniedRoute = "/students";

      const result = assertRouteAccess("ACCOUNTANT", deniedRoute, user);

      // 1. Assert result is denied
      expect(result.allowed).toBe(false);

      // 2. Assert redirect destination is ROLE_CONFIGS[role].defaultDashboard
      expect(result.redirectUrl).toBe(ROLE_CONFIGS.ACCOUNTANT.defaultDashboard);

      // 3. Assert security audit log record was created
      expect(securityAuditLogs.length).toBe(1);
      const log = securityAuditLogs[0]!;
      expect(log.route).toBe(deniedRoute);
      expect(log.actor).toBe(user.id);
      expect(log.role).toBe("ACCOUNTANT");
      expect(log.allowed).toBe(false);
      expect(log.timestamp).toBeDefined();
    });

    it("assertRouteAccess allows permitted routes without logging unauthorized attempts", () => {
      const user = { id: "usr_accountant_01", email: "mahesh@school.org" };
      const permittedRoute = "/school/collect-fees";

      const result = assertRouteAccess("ACCOUNTANT", permittedRoute, user);

      expect(result.allowed).toBe(true);
      expect(result.redirectUrl).toBeUndefined();
      expect(securityAuditLogs.length).toBe(0);
    });
  });
});
