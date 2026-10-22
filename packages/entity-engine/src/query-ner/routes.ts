/**
 * ROUTE_REGISTRY — single source of truth for all intent-to-route mappings.
 *
 * Rules:
 *  - Routes must match the real Next.js App Router file-system paths under
 *    frontend/src/app/(admin)/**  (without the "(admin)" segment, which is a
 *    layout group and is invisible in the URL).
 *  - SEARCH_GENERAL has no route of its own; the palette's own searchEverything
 *    results act as the fallback.
 *  - Every route here is validated by queryNER.test.ts against REAL_ROUTES.
 *
 * @module query-ner/routes
 */

import type { IntentType } from "./types";

/**
 * Canonical base routes for each intent type.
 * Query-string parameters (grade, section, exam, subject, route, feeHead)
 * are appended by resolveIntentAndRoute in parser.ts.
 */
export const ROUTE_REGISTRY: Readonly<Record<Exclude<IntentType, "SEARCH_GENERAL">, string>> = {
  // Examinations
  VIEW_MARKS: "/exams/results",
  ENTER_MARKS: "/exams/marks",
  VIEW_REPORT_CARD: "/exams/report-cards",
  GENERATE_REPORT_CARD: "/exams/report-cards",
  MANAGE_EXAM_SCHEDULE: "/exams/schedule",

  // Attendance
  TAKE_ATTENDANCE: "/attendance",
  VIEW_ATTENDANCE: "/attendance",

  // Fees
  VIEW_FEE_DUES: "/fees",
  COLLECT_FEE: "/fees/collect",

  // Transport
  TRACK_BUS: "/transport",

  // Students & Staff
  VIEW_STUDENT_PROFILE: "/students",
  VIEW_STAFF_PROFILE: "/hr",

  // Academics
  VIEW_TIMETABLE: "/academics",

  // Communication
  CREATE_NOTICE: "/communication/notices",

  // Navigation
  NAVIGATE_DOMAIN: "/dashboard",
} as const;

/**
 * All real routes that exist in the (admin) route tree.
 * Used by tests to assert zero dead-link emits.
 * Keep in sync with frontend/src/app/(admin)/
 */
export const REAL_ADMIN_ROUTES = new Set([
  "/",
  "/dashboard",
  "/students",
  "/exams",
  "/exams/marks",
  "/exams/results",
  "/exams/report-cards",
  "/exams/schedule",
  "/exams/manage",
  "/exams/analytics",
  "/exams/admit-cards",
  "/exams/setup",
  "/exams/new",
  "/fees",
  "/fees/collect",
  "/fees/structures",
  "/fees/concessions",
  "/fees/reports",
  "/fees/queries",
  "/attendance",
  "/transport",
  "/hr",
  "/admissions",
  "/communication",
  "/communication/notices",
  "/academics",
  "/library",
  "/school",
  "/settings",
  "/profile",
  "/dpdp",
  "/admin",
]);

/**
 * Resolve whether a route (base-path only, no query params) is a known real
 * app route or a prefix of one. Used by route golden-corpus tests.
 */
export function isKnownRoute(route: string): boolean {
  // Strip query params
  const basePath = route.split("?")[0] || "";
  if (REAL_ADMIN_ROUTES.has(basePath)) return true;
  // Allow dynamic-segment paths like /students/[id]
  for (const known of REAL_ADMIN_ROUTES) {
    if (basePath.startsWith(known + "/")) return true;
  }
  return false;
}
