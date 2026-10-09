import { describe, it, expect } from "vitest";
import {
  canRoleAccessRoute,
  assertRouteAccess,
  ROLE_MODULE_ACCESS_MATRIX,
  FULL_STUDENT_PROFILE_ALLOWED_ROLES,
} from "../routeGuards";
import type { UserRole } from "../roleConfig";

describe("GAP-2 Route Guards: /profile Isolation & Fail-Closed Access", () => {
  const ALL_ROLES: UserRole[] = [
    "ACCOUNTANT",
    "PRINCIPAL",
    "HR_MANAGER",
    "LIBRARIAN",
    "TRANSPORT_MANAGER",
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PARENT",
    "STUDENT",
    "DRIVER",
  ];

  it("grants direct-URL access to /profile for every ERP role", () => {
    ALL_ROLES.forEach((role) => {
      expect(canRoleAccessRoute(role, "/profile")).toBe(true);
      expect(canRoleAccessRoute(role, "/profile/edit")).toBe(true);
      expect(canRoleAccessRoute(role, "/profile?tab=security")).toBe(true);
    });
  });

  it("verifies ROLE_MODULE_ACCESS_MATRIX explicitly defines /profile for all roles", () => {
    ALL_ROLES.forEach((role) => {
      const routes = ROLE_MODULE_ACCESS_MATRIX[role];
      expect(routes).toBeDefined();
      expect(routes).toContain("/profile");
    });
  });

  it("enforces fail-closed semantics for unauthenticated or invalid roles trying to access /profile", () => {
    expect(canRoleAccessRoute(null, "/profile")).toBe(false);
    expect(canRoleAccessRoute(undefined, "/profile")).toBe(false);
    expect(canRoleAccessRoute("", "/profile")).toBe(false);
    expect(canRoleAccessRoute("GUEST", "/profile")).toBe(false);
    expect(canRoleAccessRoute("MALICIOUS_ROLE", "/profile")).toBe(false);
  });

  it("assertRouteAccess allows /profile for valid role and rejects invalid role", () => {
    const allowedResult = assertRouteAccess("TEACHER", "/profile", { id: "usr_teacher_1" });
    expect(allowedResult.allowed).toBe(true);
    expect(allowedResult.redirectUrl).toBeUndefined();

    const deniedResult = assertRouteAccess(null, "/profile");
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.redirectUrl).toBe("/login");
  });

  it("preserves student full profile (/students/[id]) protection against unauthorized roles", () => {
    const allowed = FULL_STUDENT_PROFILE_ALLOWED_ROLES;
    allowed.forEach((role) => {
      expect(canRoleAccessRoute(role, "/students/stu-101")).toBe(true);
    });

    const forbidden: UserRole[] = ["ACCOUNTANT", "HR_MANAGER", "LIBRARIAN", "TRANSPORT_MANAGER", "PARENT", "STUDENT", "DRIVER"];
    forbidden.forEach((role) => {
      expect(canRoleAccessRoute(role, "/students/stu-101")).toBe(false);
    });
  });

  it("grants school-setup access to PRINCIPAL, SCHOOL_ADMIN, and SUPER_ADMIN", () => {
    expect(canRoleAccessRoute("PRINCIPAL", "/settings/school-setup")).toBe(true);
    expect(canRoleAccessRoute("SCHOOL_ADMIN", "/settings/school-setup")).toBe(true);
    expect(canRoleAccessRoute("SUPER_ADMIN", "/settings/school-setup")).toBe(true);
    expect(canRoleAccessRoute("ACCOUNTANT", "/settings/school-setup")).toBe(false);
    expect(canRoleAccessRoute("TEACHER", "/settings/school-setup")).toBe(false);
  });
});
