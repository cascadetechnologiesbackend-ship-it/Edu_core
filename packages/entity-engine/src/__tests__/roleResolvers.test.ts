import { describe, it, expect } from "vitest";
import { parseOmniboxQuery } from "../query-ner/parser";
import {
  teacherRouteResolver,
  parentRouteResolver,
  REAL_TEACHER_ROUTES,
  REAL_PARENT_ROUTES,
  type TeacherScopeContext,
  type ParentWardContext,
} from "../query-ner/roleResolvers";

describe("Phase E6: Role-Scoped Route Resolvers (Teacher & Parent PWAs)", () => {
  describe("teacherRouteResolver", () => {
    it("resolves attendance queries to T4 attendance workbench", () => {
      const parsed = parseOmniboxQuery("10-A attendance");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toContain("/teacher/attendance");
      expect(res?.route).toContain("grade=10");
      expect(res?.route).toContain("section=A");
      expect(res?.actionLabel).toContain("Open Attendance Workbench");
      expect(REAL_TEACHER_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves Hindi attendance query (10-A उपस्थिति) to teacher attendance surface", () => {
      const parsed = parseOmniboxQuery("10-A उपस्थिति");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toContain("/teacher/attendance");
      expect(res?.actionLabelHi).toContain("उपस्थिति");
    });

    it("resolves marks entry queries to T6 grading queue", () => {
      const parsed = parseOmniboxQuery("marks entry 10-A");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toContain("/teacher/grading?tab=exams");
      expect(REAL_TEACHER_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves 'my day' to T7 My Day timeline", () => {
      const parsed = parseOmniboxQuery("my day schedule");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/teacher/classes?tab=myday");
      expect(res?.actionLabel).toBe("View My Day Timeline");
      expect(REAL_TEACHER_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves 'substitutions' to T8 substitutions workbench", () => {
      const parsed = parseOmniboxQuery("view substitutions");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/teacher/classes?tab=substitutions");
      expect(REAL_TEACHER_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves homework and assignment queries to /teacher/homework", () => {
      const parsed = parseOmniboxQuery("post 10-A homework");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/teacher/homework");
      expect(REAL_TEACHER_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves syllabus and curriculum queries to /teacher/syllabus", () => {
      const parsed = parseOmniboxQuery("view 10-A syllabus");
      const res = teacherRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/teacher/syllabus");
      expect(REAL_TEACHER_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("enforces teacher scope: sections outside allocation resolve to null", () => {
      const scope: TeacherScopeContext = {
        assignedClasses: ["Class 10-A"],
        teachingSections: [
          { sectionId: "sec-10-a", className: "Class 10", sectionName: "A" },
        ],
      };

      // In-scope section: succeeds
      const inScope = parseOmniboxQuery("Class 10-A attendance");
      expect(teacherRouteResolver(inScope, scope)).not.toBeNull();

      // Out-of-scope section: denied (returns null so app falls back to normal search)
      const outOfScope = parseOmniboxQuery("Class 12-B attendance");
      expect(teacherRouteResolver(outOfScope, scope)).toBeNull();
    });

    it("degrades to null for admin-only intents (teacher never sees admin routes)", () => {
      // Fee collection or route tracking are admin surfaces
      const adminFees = parseOmniboxQuery("tuition fee dues");
      expect(teacherRouteResolver(adminFees)).toBeNull();

      const adminBus = parseOmniboxQuery("where is bus route 4");
      expect(teacherRouteResolver(adminBus)).toBeNull();
    });
  });

  describe("parentRouteResolver", () => {
    it("resolves fee queries to P5 fee module", () => {
      const parsed = parseOmniboxQuery("tuition fees dues");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/parent/fees");
      expect(res?.actionLabel).toBe("View Fee Dues & Invoices");
      expect(REAL_PARENT_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves Hindi fee query (स्कूल फीस)", () => {
      const parsed = parseOmniboxQuery("स्कूल फीस");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/parent/fees");
      expect(res?.actionLabelHi).toBe("फीस बकाया और चालान देखें");
    });

    it("resolves bus tracking to P7 transport surface", () => {
      const parsed = parseOmniboxQuery("track bus route 4");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toContain("/parent/bus");
      expect(res?.route).toContain("route=4");
      expect(REAL_PARENT_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves PTM queries to P4 PTM booking surface", () => {
      const parsed = parseOmniboxQuery("book ptm slot");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/parent/more");
      expect(res?.actionLabel).toBe("Book PTM Appointment");
      expect(REAL_PARENT_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves notices to messages hub", () => {
      const parsed = parseOmniboxQuery("school notices");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/parent/messages");
      expect(REAL_PARENT_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves leave requests to ward leave application surface", () => {
      const parsed = parseOmniboxQuery("apply for leave");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/parent/more/leave");
      expect(REAL_PARENT_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("resolves academic feed and homework queries to /parent/dashboard", () => {
      const parsed = parseOmniboxQuery("check homework");
      const res = parentRouteResolver(parsed);
      expect(res).not.toBeNull();
      expect(res?.route).toBe("/parent/dashboard");
      expect(res?.actionLabel).toContain("Academic Feed");
      expect(REAL_PARENT_ROUTES.has(res!.route.split("?")[0])).toBe(true);
    });

    it("enforces ward scope: queries for other grades/students resolve to null", () => {
      const wards: ParentWardContext[] = [
        { id: "ward-1", name: "Aarav", grade: "5", section: "A" },
      ];

      // Query for parent's ward grade: succeeds
      const myWard = parseOmniboxQuery("Class 5 attendance");
      expect(parentRouteResolver(myWard, wards)).not.toBeNull();

      // Query for another grade: returns null
      const otherClass = parseOmniboxQuery("Class 12-B attendance");
      expect(parentRouteResolver(otherClass, wards)).toBeNull();
    });

    it("degrades to null for teacher and admin-only intents", () => {
      // Teacher grading
      const teacherGrading = parseOmniboxQuery("enter marks class 10-A");
      expect(parentRouteResolver(teacherGrading)).toBeNull();

      // Staff payroll
      const staffPayroll = parseOmniboxQuery("monthly salary payroll");
      expect(parentRouteResolver(staffPayroll)).toBeNull();
    });
  });
});
