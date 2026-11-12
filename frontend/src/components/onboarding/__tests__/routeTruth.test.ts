import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ALL_TOUR_DECKS } from "@/lib/tours/decks";
import { canRoleAccessRoute } from "@/lib/routeGuards";

// Recursively find all page.tsx / page.ts / page.jsx / page.js files under frontend/src/app
function getAllAppRoutes(): Set<string> {
  const appDir = path.resolve(__dirname, "../../../app");
  const routes = new Set<string>();

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        // Compute the Next.js route path
        const relative = path.relative(appDir, currentDir);
        // Normalize slashes
        const normalized = relative.split(path.sep).join("/");
        // Strip out route groups like (admin), (parent), etc.
        const cleanedSegments = normalized
          .split("/")
          .filter((segment) => !/^\(.*\)$/.test(segment) && segment.length > 0);
        const routePath = "/" + cleanedSegments.join("/");
        routes.add(routePath);
      }
    }
  }

  walk(appDir);
  return routes;
}

describe("Route-Truth Automated Verification (RT-L6)", () => {
  const allAppRoutes = getAllAppRoutes();

  it("discovers existing Next.js App routes correctly", () => {
    expect(allAppRoutes.size).toBeGreaterThan(50);
    expect(allAppRoutes.has("/dashboard")).toBe(true);
    expect(allAppRoutes.has("/library")).toBe(true);
    expect(allAppRoutes.has("/transport")).toBe(true);
  });

  const roles = Object.keys(ALL_TOUR_DECKS) as (keyof typeof ALL_TOUR_DECKS)[];

  roles.forEach((role) => {
    const deck = ALL_TOUR_DECKS[role];

    describe(`Tour Deck Truth for Role: ${role}`, () => {
      it(`verifies all module cards have valid physical routes and authorized role access`, () => {
        expect(deck.modules.length).toBeGreaterThan(0);

        for (const mod of deck.modules) {
          // Extract base path without query string or hash
          const [basePath] = mod.ctaHref.split(/[?#]/);
          const cleanBasePath = basePath || "";

          // 1. Assert physical page exists
          const pageExists = allAppRoutes.has(cleanBasePath);
          expect(
            pageExists,
            `Module [${mod.id}] for role [${role}] links to non-existent route [${cleanBasePath}] (from ${mod.ctaHref})`
          ).toBe(true);

          // 2. Assert role is authorized to open this route
          const isAuthorized = canRoleAccessRoute(role, mod.ctaHref);
          expect(
            isAuthorized,
            `Module [${mod.id}] for role [${role}] has forbidden route access for [${mod.ctaHref}]`
          ).toBe(true);

          // 3. Verify all sub-modules within this module
          if (mod.subModules && mod.subModules.length > 0) {
            for (const sub of mod.subModules) {
              const [subBasePath] = sub.ctaHref.split(/[?#]/);
              const cleanSubBasePath = subBasePath || "";

              const subPageExists = allAppRoutes.has(cleanSubBasePath);
              expect(
                subPageExists,
                `Sub-module [${sub.id}] in [${mod.id}] for role [${role}] links to non-existent route [${cleanSubBasePath}] (from ${sub.ctaHref})`
              ).toBe(true);

              const isSubAuthorized = canRoleAccessRoute(role, sub.ctaHref);
              expect(
                isSubAuthorized,
                `Sub-module [${sub.id}] in [${mod.id}] for role [${role}] has forbidden route access for [${sub.ctaHref}]`
              ).toBe(true);
            }
          }
        }
      });
    });
  });

  it("fail-closed assertion: rejects unauthorized routes for restricted roles", () => {
    // Teacher should not access fee management
    expect(canRoleAccessRoute("TEACHER", "/school/fees-dashboard")).toBe(false);
    // Student should not access HR payroll
    expect(canRoleAccessRoute("STUDENT", "/hr/payroll")).toBe(false);
    // Non-existent route should not be in allAppRoutes
    expect(allAppRoutes.has("/fabricated-tour-module")).toBe(false);
  });
});

