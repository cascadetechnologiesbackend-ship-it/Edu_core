import { describe, it, expect } from "vitest";
import {
  ALL_EXAM_PERMISSIONS,
  hasExamPermission,
  requireExamPermission,
  ExamAuthorizationError,
  type ExamPermission,
} from "../examPermissions";
import { canRoleAccessRoute, ROLE_MODULE_ACCESS_MATRIX } from "../../../../frontend/src/lib/routeGuards";

describe("Exam Permissions Registry", () => {
  it("SUPER_ADMIN has all 11 permissions", () => {
    for (const perm of ALL_EXAM_PERMISSIONS) {
      expect(hasExamPermission("SUPER_ADMIN", perm)).toBe(true);
    }
  });

  it("SCHOOL_ADMIN has all 13 permissions", () => {
    for (const perm of ALL_EXAM_PERMISSIONS) {
      expect(hasExamPermission("SCHOOL_ADMIN", perm)).toBe(true);
    }
  });

  it("PRINCIPAL has 12 permissions (all except exam.enrollments.manage)", () => {
    for (const perm of ALL_EXAM_PERMISSIONS) {
      if (perm === "exam.enrollments.manage") {
        expect(hasExamPermission("PRINCIPAL", perm)).toBe(false);
      } else {
        expect(hasExamPermission("PRINCIPAL", perm)).toBe(true);
      }
    }
    expect(hasExamPermission("PRINCIPAL", "exam.result.publish")).toBe(true);
    expect(hasExamPermission("PRINCIPAL", "exam.schedule.conflict.override")).toBe(true);
  });

  it("TEACHER has ONLY exam.marks.entry per Amendment 2", () => {
    expect(hasExamPermission("TEACHER", "exam.marks.entry")).toBe(true);

    const nonTeacherPerms: ExamPermission[] = [
      "exam.dashboard.view",
      "exam.setup.manage",
      "exam.schedule.manage",
      "exam.admit_card.manage",
      "exam.admit_card.view",
      "exam.marks.lock",
      "exam.marks.unlock",
      "exam.result.publish",
      "exam.result.view",
      "exam.analytics.view",
    ];

    for (const perm of nonTeacherPerms) {
      expect(hasExamPermission("TEACHER", perm)).toBe(false);
    }
  });

  it("ACCOUNTANT has admit card permissions only", () => {
    expect(hasExamPermission("ACCOUNTANT", "exam.admit_card.manage")).toBe(true);
    expect(hasExamPermission("ACCOUNTANT", "exam.admit_card.view")).toBe(true);
    expect(hasExamPermission("ACCOUNTANT", "exam.marks.entry")).toBe(false);
    expect(hasExamPermission("ACCOUNTANT", "exam.result.publish")).toBe(false);
  });

  it("STUDENT and PARENT have view permissions only", () => {
    expect(hasExamPermission("STUDENT", "exam.admit_card.view")).toBe(true);
    expect(hasExamPermission("STUDENT", "exam.result.view")).toBe(true);
    expect(hasExamPermission("STUDENT", "exam.marks.entry")).toBe(false);

    expect(hasExamPermission("PARENT", "exam.admit_card.view")).toBe(true);
    expect(hasExamPermission("PARENT", "exam.result.view")).toBe(true);
    expect(hasExamPermission("PARENT", "exam.marks.entry")).toBe(false);
  });

  it("requireExamPermission throws 403 ExamAuthorizationError when unauthorized", () => {
    expect(() => requireExamPermission("TEACHER", "exam.result.publish")).toThrow(
      ExamAuthorizationError,
    );
    expect(() => requireExamPermission(null, "exam.dashboard.view")).toThrow(
      ExamAuthorizationError,
    );
    expect(() => requireExamPermission("SCHOOL_ADMIN", "exam.result.publish")).not.toThrow();
  });

  it("requireExamPermission enforces full AuthContext and fail-closed tenant scoping (Amendment 1)", () => {
    const validCtx = {
      userId: "user-123",
      schoolId: "school-abc",
      role: "SCHOOL_ADMIN",
      email: "admin@school.com",
    };
    expect(() => requireExamPermission(validCtx, "exam.setup.manage")).not.toThrow();

    // Non-SUPER_ADMIN missing schoolId fails closed
    const unscopedCtx = {
      userId: "user-123",
      schoolId: null,
      role: "SCHOOL_ADMIN",
      email: "admin@school.com",
    };
    expect(() => requireExamPermission(unscopedCtx, "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );
    expect(() => requireExamPermission(unscopedCtx, "exam.setup.manage")).toThrow(
      /requires active tenant school scope/,
    );

    // SUPER_ADMIN without schoolId is permitted for platform-wide/impersonated operations
    const superAdminCtx = {
      userId: "super-1",
      schoolId: null,
      role: "SUPER_ADMIN",
      email: "super@platform.com",
    };
    expect(() => requireExamPermission(superAdminCtx, "exam.setup.manage")).not.toThrow();

    // Teacher lacks setup permission even with valid schoolId
    const teacherCtx = {
      userId: "t-1",
      schoolId: "school-abc",
      role: "TEACHER",
      email: "teacher@school.com",
    };
    expect(() => requireExamPermission(teacherCtx, "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );
  });
});

describe("Route Guards — Teacher /exams boundary (Amendment 2)", () => {
  it("excludes TEACHER from all /exams/* routes in ROLE_MODULE_ACCESS_MATRIX", () => {
    const teacherRoutes = ROLE_MODULE_ACCESS_MATRIX.TEACHER;
    expect(teacherRoutes).not.toContain("/exams");
    expect(teacherRoutes.some((r) => r.startsWith("/exams"))).toBe(false);

    // Can role access route
    expect(canRoleAccessRoute("TEACHER", "/exams")).toBe(false);
    expect(canRoleAccessRoute("TEACHER", "/exams/dashboard")).toBe(false);
    expect(canRoleAccessRoute("TEACHER", "/exams/schedule")).toBe(false);
    expect(canRoleAccessRoute("TEACHER", "/exams/marks")).toBe(false);
    expect(canRoleAccessRoute("TEACHER", "/exams/results")).toBe(false);

    // But TEACHER can access /teacher/grading
    expect(canRoleAccessRoute("TEACHER", "/teacher/grading")).toBe(true);
  });

  it("allows SCHOOL_ADMIN and PRINCIPAL to access /exams/*", () => {
    expect(canRoleAccessRoute("SCHOOL_ADMIN", "/exams")).toBe(true);
    expect(canRoleAccessRoute("SCHOOL_ADMIN", "/exams/dashboard")).toBe(true);
    expect(canRoleAccessRoute("PRINCIPAL", "/exams")).toBe(true);
    expect(canRoleAccessRoute("PRINCIPAL", "/exams/results")).toBe(true);
  });
});
