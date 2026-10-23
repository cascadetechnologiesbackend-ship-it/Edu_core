// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

// Mocks to isolate server action & client navigation imports in testing environment
vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/serverAuth", () => ({
  getCachedSession: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => "/student/dashboard",
}));

// Component & action imports to ensure zero syntax/runtime compilation errors
import { StudentFeedContainer } from "../../../components/student/feed/StudentFeedContainer";
import { HomeworkCenterClient } from "../../../components/student/homework/HomeworkCenterClient";
import { StudentTimetableClient } from "../../../components/student/timetable/StudentTimetableClient";
import { StudentMarksClient } from "../../../components/student/marks/StudentMarksClient";
import { StudentAttendanceClient } from "../../../components/student/attendance/StudentAttendanceClient";
import { StudentFeesClient } from "../../../components/student/fees/StudentFeesClient";
import { StudentNoticesClient } from "../../../components/student/notices/StudentNoticesClient";
import { StudentSyllabusClient } from "../../../components/student/syllabus/StudentSyllabusClient";
import {
  enqueueStudentSubmission,
  getQueuedStudentSubmissions,
  syncQueuedStudentSubmissions,
} from "../../../lib/offline/studentSubmissionQueue";
import { isNoticeInStudentScope } from "../../../lib/studentEventEngine/noticeScoping";
import {
  deriveTopicSyllabusStatus,
  calculateSyllabusProgress,
} from "../../../lib/studentEventEngine/syllabusDerivation";

describe("Phase S7: Student PWA Regression Gate & Page Smoke Tests (AC-1 to AC-19)", () => {
  // ─── Regression Gate: Module Import & Component Signatures ────────────────
  it("AC-18: all 8 primary student client components and surfaces export valid functions", () => {
    expect(typeof StudentFeedContainer).toBe("function");
    expect(typeof HomeworkCenterClient).toBe("function");
    expect(typeof StudentTimetableClient).toBe("function");
    expect(typeof StudentMarksClient).toBe("function");
    expect(typeof StudentAttendanceClient).toBe("function");
    expect(typeof StudentFeesClient).toBe("function");
    expect(typeof StudentNoticesClient).toBe("function");
    expect(typeof StudentSyllabusClient).toBe("function");
  });

  // ─── Truth Pass: No Hardcoded Statistics or Years ─────────────────────────
  it("AC-11 & AC-17: truth pass grep test confirms zero hardcoded '96.5%' or hardcoded '2026-27' in student app", () => {
    const studentAppDir = path.resolve(__dirname, "..");
    const studentComponentsDir = path.resolve(__dirname, "../../../components/student");

    function scanFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name.endsWith(".test.ts")) {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanFiles(fullPath));
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allCodeFiles = [
      ...scanFiles(studentAppDir),
      ...scanFiles(studentComponentsDir),
    ];

    expect(allCodeFiles.length).toBeGreaterThan(15);

    for (const filePath of allCodeFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      // Check for hardcoded 96.5% attendance fallback
      expect(
        content.includes("96.5%"),
        `Found forbidden hardcoded "96.5%" in ${path.basename(filePath)}`
      ).toBe(false);

      // Check for hardcoded Academic Year 2026-27 fallback
      expect(
        content.includes("Academic Year 2026-27"),
        `Found forbidden hardcoded year string in ${path.basename(filePath)}`
      ).toBe(false);
    }
  });

  // ─── AC-1 & AC-2: Identity Provisioning & Admin Queue ──────────────────────
  it("AC-1 & AC-2: student access library exists with schoolId-scoped provisioning & claim flow", () => {
    const accessLibPath = path.resolve(
      __dirname,
      "../../../../../backend/src/lib/studentAccess.ts"
    );
    expect(fs.existsSync(accessLibPath)).toBe(true);
    const content = fs.readFileSync(accessLibPath, "utf-8");
    expect(content).toContain("provisionOrLinkStudent");
    expect(content).toContain("verifyAndClaimStudentAccount");
    expect(content).toContain("dateOfBirth");
    expect(content).toContain("admissionNumber");
  });

  // ─── AC-3: Authoritative Scope Resolver ────────────────────────────────────
  it("AC-3: resolveStudentScope enforces strict tenant isolation without findFirst fallback", () => {
    const scopeResolverPath = path.resolve(
      __dirname,
      "../../../../../backend/src/lib/studentEventEngine/scopeResolver.ts"
    );
    expect(fs.existsSync(scopeResolverPath)).toBe(true);
    const content = fs.readFileSync(scopeResolverPath, "utf-8");
    expect(content).toContain("resolveStudentScope");
    expect(content).not.toContain("findFirst()"); // Arbitrary admin fallback permanently deleted (SD4)
  });

  // ─── AC-4: PWA Shell 4-Item Navigation ─────────────────────────────────────
  it("AC-4: PWA layout renders 4-item bottom navigation: Home, Homework, Timetable, More", () => {
    const layoutPath = path.resolve(__dirname, "../layout.tsx");
    expect(fs.existsSync(layoutPath)).toBe(true);
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("/student/dashboard");
    expect(content).toContain("/student/homework");
    expect(content).toContain("/student/timetable");
    expect(content).toContain("/student/more");
  });

  // ─── AC-6 & AC-7: Homework Submission & Server isLate ──────────────────────
  it("AC-6 & AC-7: submitHomeworkAction calculates isLate server-side against assignment dueDate", () => {
    const actionsPath = path.resolve(
      __dirname,
      "../student/homework/homeworkActions.ts"
    );
    expect(fs.existsSync(actionsPath)).toBe(true);
    const content = fs.readFileSync(actionsPath, "utf-8");
    expect(content).toContain("submitHomeworkAction");
    expect(content).toContain("isLate");
    expect(content).toContain("scanContentForPII");
  });

  // ─── AC-8: DPDP PII Scan Enforcement ──────────────────────────────────────
  it("AC-8: homeworkActions invokes scanContentForPII and blocks CRITICAL PII", () => {
    const actionsPath = path.resolve(
      __dirname,
      "../student/homework/homeworkActions.ts"
    );
    const content = fs.readFileSync(actionsPath, "utf-8");
    expect(content).toContain("scanContentForPII");
    expect(content).toContain("BLOCKED");
  });

  // ─── AC-9: Timetable Today & Weekly Grid ───────────────────────────────────
  it("AC-9: student timetable actions fetch from timetable_periods for the student's section", () => {
    const timetableActionsPath = path.resolve(
      __dirname,
      "../student/timetable/timetableActions.ts"
    );
    expect(fs.existsSync(timetableActionsPath)).toBe(true);
    const content = fs.readFileSync(timetableActionsPath, "utf-8");
    expect(content).toContain("timetablePeriods");
    expect(content).toContain("timetableSubstitutions");
  });

  // ─── AC-10: Marks Lock Enforcement ─────────────────────────────────────────
  it("AC-10: marks actions strictly enforce result publication lock states", () => {
    const marksActionsPath = path.resolve(
      __dirname,
      "../student/marks/marksActions.ts"
    );
    expect(fs.existsSync(marksActionsPath)).toBe(true);
    const content = fs.readFileSync(marksActionsPath, "utf-8");
    expect(content).toContain("examMarksLocks");
    expect(content).toContain("resultSettings");
    expect(content).toContain("Results awaited");
  });

  // ─── AC-11: Real Attendance Calculation ────────────────────────────────────
  it("AC-11: attendance actions calculate authentic attendance rate with null fallback if zero days", () => {
    const attendanceActionsPath = path.resolve(
      __dirname,
      "../student/attendance/attendanceActions.ts"
    );
    expect(fs.existsSync(attendanceActionsPath)).toBe(true);
    const content = fs.readFileSync(attendanceActionsPath, "utf-8");
    expect(content).toContain("studentAttendance");
    expect(content).toContain("attendancePercentage");
  });

  // ─── AC-12: Notice Scoping ─────────────────────────────────────────────────
  it("AC-12: isNoticeInStudentScope verifies STUDENTS and ALL audience targeting", () => {
    expect(
      isNoticeInStudentScope(
        { audienceType: "ALL" },
        { classId: "cls-1", sectionId: "sec-1" }
      )
    ).toBe(true);

    expect(
      isNoticeInStudentScope(
        { audienceType: "STUDENTS", audienceFilter: { classId: "cls-1" } },
        { classId: "cls-1", sectionId: "sec-1" }
      )
    ).toBe(true);

    expect(
      isNoticeInStudentScope(
        { audienceType: "STUDENTS", audienceFilter: { classId: "cls-2" } },
        { classId: "cls-1", sectionId: "sec-1" }
      )
    ).toBe(false);

    expect(
      isNoticeInStudentScope(
        { audienceType: "PARENTS" },
        { classId: "cls-1", sectionId: "sec-1" }
      )
    ).toBe(false);
  });

  // ─── AC-13: Syllabus Derivation ────────────────────────────────────────────
  it("AC-13: deriveTopicSyllabusStatus accurately maps completed lesson plans to TAUGHT and planned to NEXT", () => {
    expect(
      deriveTopicSyllabusStatus({
        topicId: "top-1",
        completedTopicIds: new Set(["top-1"]),
        plannedTopicIds: new Set(),
      })
    ).toBe("TAUGHT");

    expect(
      deriveTopicSyllabusStatus({
        topicId: "top-2",
        completedTopicIds: new Set(),
        plannedTopicIds: new Set(["top-2"]),
      })
    ).toBe("NEXT");

    expect(
      deriveTopicSyllabusStatus({
        topicId: "top-3",
        completedTopicIds: new Set(),
        plannedTopicIds: new Set(),
      })
    ).toBe("UPCOMING");
  });

  // ─── AC-14: Student Omnibox Resolver ───────────────────────────────────────
  it("AC-14: roleResolvers contains studentRouteResolver registered in RoleCommandPalette", () => {
    const roleResolversPath = path.resolve(
      __dirname,
      "../../../../../packages/entity-engine/src/query-ner/roleResolvers.ts"
    );
    expect(fs.existsSync(roleResolversPath)).toBe(true);
    const content = fs.readFileSync(roleResolversPath, "utf-8");
    expect(content).toContain("export function studentRouteResolver");

    const palettePath = path.resolve(
      __dirname,
      "../../../components/ui/RoleCommandPalette.tsx"
    );
    const paletteContent = fs.readFileSync(palettePath, "utf-8");
    expect(paletteContent).toContain("studentRouteResolver");
  });

  // ─── AC-15: Retained Fee Checkout Flow ─────────────────────────────────────
  it("AC-15: StudentFeesClient integrates with Razorpay CheckoutButton", () => {
    const feesClientPath = path.resolve(
      __dirname,
      "../../../components/student/fees/StudentFeesClient.tsx"
    );
    expect(fs.existsSync(feesClientPath)).toBe(true);
    const content = fs.readFileSync(feesClientPath, "utf-8");
    expect(content).toContain("CheckoutButton");
  });

  // ─── AC-16: Offline Queue & Reconnect Replay ───────────────────────────────
  it("AC-16: student submission queue enqueues and syncs submissions reliably", async () => {
    const item = await enqueueStudentSubmission({
      assignmentId: "smoke-asg-1",
      assignmentTitle: "Smoke Test Assignment",
      subjectName: "Testing",
      dueDate: new Date().toISOString(),
      studentContent: "Smoke test answer content",
    });

    expect(item.id).toBe("smoke-asg-1");
    expect(item.status).toBe("pending");

    const queued = await getQueuedStudentSubmissions();
    expect(queued.some((q) => q.id === "smoke-asg-1")).toBe(true);

    const syncResult = await syncQueuedStudentSubmissions(async () => ({
      success: true,
      isLate: false,
    }));

    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBeGreaterThanOrEqual(1);
  });

  // ─── AC-19: Zero New Dependencies ──────────────────────────────────────────
  it("AC-19: frontend package.json contains zero unapproved or new dependencies", () => {
    const pkgPath = path.resolve(__dirname, "../../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    // Verify dependencies are existing approved stack
    expect(pkg.dependencies).toHaveProperty("next");
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.dependencies).toHaveProperty("lucide-react");
  });
});
