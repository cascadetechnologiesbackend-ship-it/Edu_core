/**
 * Demo Mode Production Guardrails
 *
 * Enforces production safety invariants for interactive prospect exploration:
 * 1. Protects core seeded demo accounts from deletion, password resets, or email modifications.
 * 2. Short-circuits external paid side-effects (SMS gateways, live emails, payment gateway charges)
 *    so demo actions never incur real third-party costs or send spam.
 * 3. Identifies demo tenant scopes across CBSE, ICSE, State Board, and International sandboxes.
 */

import { db } from "@/db";
import { schools } from "@/db/schema/core";
import { eq } from "drizzle-orm";

export const DEMO_DOMAINS = ["demo.schoolos.io", "schoolmitra.internal"];

export const CORE_DEMO_EMAILS = new Set([
  "admin@demo.schoolos.io",
  "principal@demo.schoolos.io",
  "teacher@demo.schoolos.io",
  "finance@demo.schoolos.io",
  "parent@demo.schoolos.io",
  "student@demo.schoolos.io",
  "hr@demo.schoolos.io",
  "transport@demo.schoolos.io",
  "librarian@demo.schoolos.io",
  // Board-specific aliases
  "admin.cbse@demo.schoolos.io",
  "principal.cbse@demo.schoolos.io",
  "teacher.cbse@demo.schoolos.io",
  "finance.cbse@demo.schoolos.io",
  "parent.cbse@demo.schoolos.io",
  "student.cbse@demo.schoolos.io",
  "admin.icse@demo.schoolos.io",
  "principal.icse@demo.schoolos.io",
  "teacher.icse@demo.schoolos.io",
  "finance.icse@demo.schoolos.io",
  "parent.icse@demo.schoolos.io",
  "student.icse@demo.schoolos.io",
  "admin.state@demo.schoolos.io",
  "principal.state@demo.schoolos.io",
  "teacher.state@demo.schoolos.io",
  "finance.state@demo.schoolos.io",
  "parent.state@demo.schoolos.io",
  "student.state@demo.schoolos.io",
  "admin.intl@demo.schoolos.io",
  "principal.intl@demo.schoolos.io",
  "teacher.intl@demo.schoolos.io",
  "finance.intl@demo.schoolos.io",
  "parent.intl@demo.schoolos.io",
  "student.intl@demo.schoolos.io",
]);

export const DEMO_SLUGS = new Set([
  "demo-cbse",
  "demo-icse",
  "demo-state",
  "demo-international",
  "dpa-demo",
]);

/**
 * Checks if a given email is a protected core demo persona.
 */
export function isCoreDemoEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return CORE_DEMO_EMAILS.has(normalized);
}

/**
 * Throws a user-friendly error if an operation targets a protected core demo account.
 */
export function assertNotCoreDemoUser(email?: string | null, action = "modify this account"): void {
  if (isCoreDemoEmail(email)) {
    throw new Error(
      `Action blocked: "${email}" is a protected core demo account. Modifying or deleting core demo personas is disabled in live demo mode.`
    );
  }
}

/**
 * Checks if an email belongs to any demo domain.
 */
export function isDemoEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith("@demo.schoolos.io") ||
    normalized.includes("dpa-demo") ||
    normalized.endsWith("@schoolmitra.internal")
  );
}

/**
 * Checks if a school ID belongs to an isolated demo tenant.
 */
export async function isDemoSchoolId(schoolId?: string | null): Promise<boolean> {
  if (!schoolId) return false;
  try {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: { slug: true, featureFlags: true },
    });
    if (!school) return false;
    if (school.slug && DEMO_SLUGS.has(school.slug)) return true;
    if (school.featureFlags && (school.featureFlags as any).demo_tenant === true) return true;
    return false;
  } catch {
    return false;
  }
}
