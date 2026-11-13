import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { canRoleAccessRoute } from "@/lib/routeGuards";
import { ADMIN_PAGE_TOURS, ADMIN_MODULE_ORDER } from "@/lib/tours/adminTour";
import {
  TEACHER_PAGE_TOURS,
  TEACHER_MODULE_ORDER,
  PRINCIPAL_PAGE_TOURS,
  PRINCIPAL_MODULE_ORDER,
  ACCOUNTANT_PAGE_TOURS,
  ACCOUNTANT_MODULE_ORDER,
  HR_MANAGER_PAGE_TOURS,
  HR_MANAGER_MODULE_ORDER,
  LIBRARIAN_PAGE_TOURS,
  LIBRARIAN_MODULE_ORDER,
  TRANSPORT_MANAGER_PAGE_TOURS,
  TRANSPORT_MANAGER_MODULE_ORDER,
  DRIVER_PAGE_TOURS,
  DRIVER_MODULE_ORDER,
} from "@/lib/tours/staffTours";
import {
  PARENT_PAGE_TOURS,
  PARENT_MODULE_ORDER,
  STUDENT_PAGE_TOURS,
  STUDENT_MODULE_ORDER,
} from "@/lib/tours/familyTours";
import {
  SUPER_ADMIN_PAGE_TOURS,
  SUPER_ADMIN_MODULE_ORDER,
} from "@/lib/tours/superAdminTour";
import { PageTourDefinition } from "@/lib/tours/types";

// Recursively find all page.tsx files under frontend/src/app
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
        const relative = path.relative(appDir, currentDir);
        const normalized = relative.split(path.sep).join("/");
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

// Recursively find all data-tour anchor tokens in frontend/src
function getAllDataTourAnchors(): Set<string> {
  const srcDir = path.resolve(__dirname, "../../../");
  const anchors = new Set<string>();

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "dist" ||
        entry.name === ".git"
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        // Exclude test files so anchors must exist in actual production code
        if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
          continue;
        }
        const content = fs.readFileSync(fullPath, "utf-8");
        // Match data-tour="token token" or data-tour: "token token"
        const regex = /(?:data-tour=["']|["']data-tour["']:\s*["'])([^"']+)["']/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          if (match[1]) {
            const tokens = match[1].split(/\s+/).filter(Boolean);
            tokens.forEach((t) => anchors.add(t));
          }
        }
      }
    }
  }

  walk(srcDir);
  return anchors;
}

interface RoleTourSuite {
  role: string;
  tours: PageTourDefinition[];
  moduleOrder: string[];
}

const ALL_ROLE_TOURS: RoleTourSuite[] = [
  { role: "SCHOOL_ADMIN", tours: ADMIN_PAGE_TOURS, moduleOrder: ADMIN_MODULE_ORDER },
  { role: "TEACHER", tours: TEACHER_PAGE_TOURS, moduleOrder: TEACHER_MODULE_ORDER },
  { role: "PRINCIPAL", tours: PRINCIPAL_PAGE_TOURS, moduleOrder: PRINCIPAL_MODULE_ORDER },
  { role: "ACCOUNTANT", tours: ACCOUNTANT_PAGE_TOURS, moduleOrder: ACCOUNTANT_MODULE_ORDER },
  { role: "HR_MANAGER", tours: HR_MANAGER_PAGE_TOURS, moduleOrder: HR_MANAGER_MODULE_ORDER },
  { role: "LIBRARIAN", tours: LIBRARIAN_PAGE_TOURS, moduleOrder: LIBRARIAN_MODULE_ORDER },
  { role: "TRANSPORT_MANAGER", tours: TRANSPORT_MANAGER_PAGE_TOURS, moduleOrder: TRANSPORT_MANAGER_MODULE_ORDER },
  { role: "DRIVER", tours: DRIVER_PAGE_TOURS, moduleOrder: DRIVER_MODULE_ORDER },
  { role: "PARENT", tours: PARENT_PAGE_TOURS, moduleOrder: PARENT_MODULE_ORDER },
  { role: "STUDENT", tours: STUDENT_PAGE_TOURS, moduleOrder: STUDENT_MODULE_ORDER },
  { role: "SUPER_ADMIN", tours: SUPER_ADMIN_PAGE_TOURS, moduleOrder: SUPER_ADMIN_MODULE_ORDER },
];

describe("Automated Anchor-Truth CI Verification (CT-L6)", () => {
  const allAppRoutes = getAllAppRoutes();
  const allAnchors = getAllDataTourAnchors();

  it("verifies full 11-role coverage", () => {
    expect(ALL_ROLE_TOURS.length).toBe(11);
    const roleNames = ALL_ROLE_TOURS.map((r) => r.role);
    expect(roleNames).toContain("SCHOOL_ADMIN");
    expect(roleNames).toContain("TEACHER");
    expect(roleNames).toContain("PRINCIPAL");
    expect(roleNames).toContain("ACCOUNTANT");
    expect(roleNames).toContain("HR_MANAGER");
    expect(roleNames).toContain("LIBRARIAN");
    expect(roleNames).toContain("TRANSPORT_MANAGER");
    expect(roleNames).toContain("DRIVER");
    expect(roleNames).toContain("PARENT");
    expect(roleNames).toContain("STUDENT");
    expect(roleNames).toContain("SUPER_ADMIN");
  });

  it("verifies physical anchor presence in production codebase", () => {
    expect(allAnchors.size).toBeGreaterThan(40);
  });

  ALL_ROLE_TOURS.forEach(({ role, tours, moduleOrder }) => {
    describe(`Anchor & Route Truth for Role: ${role}`, () => {
      it(`has non-empty tours and module trail ordering`, () => {
        expect(tours.length).toBeGreaterThan(0);
        expect(moduleOrder.length).toBeGreaterThan(0);
      });

      tours.forEach((tour) => {
        const cleanPath = tour.pagePath.split(/[?#]/)[0]!;

        it(`verifies pagePath '${tour.pagePath}' exists and role has access`, () => {
          expect(
            allAppRoutes.has(cleanPath),
            `Route ${cleanPath} should physically exist under frontend/src/app`
          ).toBe(true);

          const hasAccess = canRoleAccessRoute(role as any, cleanPath);
          expect(
            hasAccess,
            `Role ${role} should be authorized to access ${cleanPath}`
          ).toBe(true);
        });

        it(`verifies every anchorId in module '${tour.moduleId}' exists in production markup (Law 2: No Ghost Popups)`, () => {
          expect(tour.steps.length).toBeGreaterThan(0);

          tour.steps.forEach((step) => {
            expect(
              step.anchorId,
              `Step anchorId should not be empty in ${tour.moduleId}`
            ).toBeTruthy();

            expect(
              allAnchors.has(step.anchorId),
              `[Law 2 Violation] Anchor '${step.anchorId}' for role '${role}' on page '${tour.pagePath}' does not physically exist in any production .tsx component!`
            ).toBe(true);

            expect(step.title.trim().length).toBeGreaterThan(0);
            expect(step.line.trim().length).toBeGreaterThan(0);
          });
        });
      });
    });
  });
});

