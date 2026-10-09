/**
 * Route Guards & Role-Module Access Control Matrix
 * Single authoritative source of truth for (admin)/* route access.
 * Enforces fail-closed module isolation across all ERP roles.
 */

import { type UserRole, ROLE_CONFIGS } from "./roleConfig";

export const ROLE_MODULE_ACCESS_MATRIX: Record<UserRole, readonly string[]> = {
  ACCOUNTANT: [
    "/profile",
    "/school/fees-dashboard",
    "/school/collect-fees",
    "/school/due-fees",
    "/school/transactions",
    "/school/accounting/dashboard",
    "/school/fees-discount",
    "/school/refunds",
    "/school/fee-structures",
    "/school/accounting/reports/concessions",
    "/school/accounts/bank-reconciliation",
  ],
  PRINCIPAL: [
    "/profile",
    "/principal/dashboard",
    "/settings/school-setup",
    "/school/fees-dashboard",
    "/school/due-fees",
    "/school/accounting/reports/concessions",
    "/students",
    "/academics",
    "/attendance",
    "/exams",
    "/admissions",
    "/hr",
  ],
  HR_MANAGER: [
    "/profile",
    "/hr",
    "/hr/dashboard",
    "/hr/payroll",
    "/dpdp",
    "/attendance",
  ],
  LIBRARIAN: [
    "/profile",
    "/library",
    "/librarian/dashboard",
  ],
  TRANSPORT_MANAGER: [
    "/profile",
    "/transport",
    "/transport/dashboard",
  ],
  TEACHER: [
    "/profile",
    "/teacher",
    "/teacher/dashboard",
    "/teacher/attendance",
    "/teacher/grading",
    "/teacher/classes",
    "/teacher/payroll",
    "/academics",
    "/attendance",
    "/exams",
  ],
  SCHOOL_ADMIN: [
    "/profile",
    "/dashboard",
    "/admissions",
    "/students",
    "/academics",
    "/exams",
    "/attendance",
    "/school/fees-dashboard",
    "/school/collect-fees",
    "/school/due-fees",
    "/school/transactions",
    "/school/accounting/dashboard",
    "/school/fees-discount",
    "/school/refunds",
    "/school/fee-structures",
    "/school/accounting/reports",
    "/school/accounts",
    "/school/fee-challans",
    "/school/fee-groups",
    "/school/fee-types",
    "/school/generate-due-slip",
    "/school/due-slip-history",
    "/school/fees-carry-forward",
    "/school/import-center",
    "/school/fee-audit",
    "/school/online-payments",
    "/school/assign-fees",
    "/hr",
    "/library",
    "/transport",
    "/communication",
    "/inventory",
    "/hostel",
    "/dpdp",
    "/settings",
    "/settings/school-setup",
    "/settings/roles",
    "/analytics",
  ],
  SUPER_ADMIN: [
    "/profile",
    "/super-admin",
    "/dashboard",
    "/admissions",
    "/students",
    "/academics",
    "/exams",
    "/attendance",
    "/school",
    "/hr",
    "/library",
    "/transport",
    "/communication",
    "/inventory",
    "/hostel",
    "/dpdp",
    "/settings",
    "/settings/school-setup",
    "/settings/roles",
    "/analytics",
  ],
  PARENT: ["/profile", "/portal", "/parent/dashboard", "/parent"],
  STUDENT: ["/profile", "/portal", "/student/dashboard", "/student"],
  DRIVER: ["/profile", "/driver/dashboard", "/driver"],
};

/** Full student profile (/students/[id]) allowed roles */
export const FULL_STUDENT_PROFILE_ALLOWED_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
];

export interface RouteAccessAuditRecord {
  route: string;
  actor: string;
  role: string;
  timestamp: string;
  allowed: boolean;
}

// In-memory audit trail for testing & runtime tracing
export const securityAuditLogs: RouteAccessAuditRecord[] = [];

/**
 * Checks whether a given role is allowed to access the specified pathname.
 * Semantics: Fail-closed (GT-03). Unlisted routes or undefined roles => DENY.
 */
export function canRoleAccessRoute(role: string | undefined | null, pathname: string): boolean {
  if (!role) return false;

  // SUPER_ADMIN has platform-wide access
  if (role === "SUPER_ADMIN") return true;

  const validRole = role as UserRole;
  const allowedPrefixes = ROLE_MODULE_ACCESS_MATRIX[validRole];
  if (!allowedPrefixes || allowedPrefixes.length === 0) return false;

  // Special check: Student full profile (/students/[id])
  if (pathname.startsWith("/students/")) {
    return FULL_STUDENT_PROFILE_ALLOWED_ROLES.includes(validRole);
  }

  // Exact or prefix matching
  const hasAccess = allowedPrefixes.some((prefix) => {
    if (pathname === prefix) return true;
    if (pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")) return true;
    return false;
  });

  return hasAccess;
}

/**
 * Asserts route access for a user and triggers UNAUTHORIZED_ROUTE_ATTEMPT logging on rejection.
 */
export function assertRouteAccess(
  role: string | undefined | null,
  pathname: string,
  user?: { id?: string; email?: string }
): { allowed: boolean; redirectUrl?: string } {
  const allowed = canRoleAccessRoute(role, pathname);

  const actor = user?.id || user?.email || "anonymous";
  const userRole = role || "UNKNOWN";

  if (!allowed) {
    const auditRecord: RouteAccessAuditRecord = {
      route: pathname,
      actor,
      role: userRole,
      timestamp: new Date().toISOString(),
      allowed: false,
    };
    securityAuditLogs.push(auditRecord);

    console.warn(
      `[SECURITY AUDIT] UNAUTHORIZED_ROUTE_ATTEMPT: route=${pathname} actor=${actor} role=${userRole} timestamp=${auditRecord.timestamp}`
    );

    const redirectUrl =
      role && ROLE_CONFIGS[role as UserRole]
        ? ROLE_CONFIGS[role as UserRole].defaultDashboard
        : "/login";

    return {
      allowed: false,
      redirectUrl,
    };
  }

  return { allowed: true };
}
