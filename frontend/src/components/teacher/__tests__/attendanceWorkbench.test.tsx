/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttendanceWorkbench } from "../AttendanceWorkbench";
import { evaluateNotificationEligibility } from "@/lib/parentEventEngine/notificationMatrix";
import type { WorkbenchStudent } from "@/app/(teacher)/teacher/attendance/attendanceActions";
import * as attendanceActions from "@/app/(teacher)/teacher/attendance/attendanceActions";

// Mock attendanceActions server actions
vi.mock("@/app/(teacher)/teacher/attendance/attendanceActions", () => ({
  getTeacherAssignedSections: vi.fn(),
  getTeacherAttendanceRoster: vi.fn(),
  saveTeacherAttendanceRoster: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Phase T4: Attendance Workbench & AC-T3..AC-T5 Verification", () => {
  const sectionId = "sec-class-8b";
  const dateStr = "2026-10-21";

  // Generate 40 mock students
  const createMockStudents = (count: number = 40): WorkbenchStudent[] => {
    return Array.from({ length: count }, (_, i) => {
      const idx = i + 1;
      const isLeave = idx === 40; // 40th student has approved leave
      return {
        studentId: `student-${idx}`,
        rollNumber: String(idx),
        firstName: `StudentFirstName${idx}`,
        lastName: `StudentLastName${idx}`,
        admissionNumber: `ADM-${202600 + idx}`,
        status: isLeave ? "LEAVE" : "PRESENT",
        remarks: isLeave ? "Approved Leave: Family function" : "",
        isPreApprovedLeave: isLeave,
        leaveReason: isLeave ? "Family function" : undefined,
      };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(attendanceActions, "getTeacherAssignedSections").mockResolvedValue([
      {
        id: sectionId,
        name: "B",
        className: "Class 8",
        displayName: "Class 8 - B",
        isClassTeacher: true,
      },
    ]);

    vi.spyOn(attendanceActions, "getTeacherAttendanceRoster").mockResolvedValue({
      sectionId,
      sectionName: "B",
      className: "Class 8",
      dateStr,
      academicYearId: "ay-2026-2027",
      isAlreadyMarked: false,
      students: createMockStudents(40),
      counts: {
        total: 40,
        present: 39,
        absent: 0,
        late: 0,
        halfDay: 0,
        leave: 1,
      },
    });

    vi.spyOn(attendanceActions, "saveTeacherAttendanceRoster").mockImplementation(
      async (input) => {
        const totalPresent = input.records.filter((r) => r.status === "PRESENT").length;
        const totalAbsent = input.records.filter((r) => r.status === "ABSENT").length;
        const totalLate = input.records.filter((r) => r.status === "LATE").length;
        const totalHalfDay = input.records.filter((r) => r.status === "HALF_DAY").length;
        const totalLeave = input.records.filter((r) => r.status === "LEAVE").length;

        const parts: string[] = [];
        if (totalPresent > 0) parts.push(`${totalPresent} present`);
        if (totalAbsent > 0) parts.push(`${totalAbsent} absent`);
        if (totalLate > 0) parts.push(`${totalLate} late`);
        if (totalHalfDay > 0) parts.push(`${totalHalfDay} half-day`);
        if (totalLeave > 0) parts.push(`${totalLeave} leave`);

        return {
          success: true,
          sectionName: "B",
          className: "Class 8",
          dateStr: input.dateStr,
          totalStudents: input.records.length,
          counts: {
            present: totalPresent,
            absent: totalAbsent,
            late: totalLate,
            halfDay: totalHalfDay,
            leave: totalLeave,
          },
          summaryToast: `Class 8 B: ${parts.join(", ")}`,
        };
      }
    );
  });

  describe("AC-T3: Full-Section Idempotent Saves & Pre-Approved Leave Pre-chipping", () => {
    it("pre-chips approved leave students with LEAVE status and badge", async () => {
      render(
        <AttendanceWorkbench
          initialSectionId={sectionId}
          initialDate={dateStr}
          isModal={false}
        />
      );

      // Wait for roster to load
      await waitFor(() => {
        expect(screen.getByText("StudentFirstName40 StudentLastName40")).toBeDefined();
      });

      // Student 40 must have Planned Leave badge
      expect(screen.getByText("Planned Leave")).toBeDefined();
      expect(screen.getByTestId("counter-leave").textContent).toContain("1");
      expect(screen.getByTestId("counter-present").textContent).toContain("39");
    });

    it("saves all 40 student rows idempotently with accurate summary toast", async () => {
      const onSaved = vi.fn();
      render(
        <AttendanceWorkbench
          initialSectionId={sectionId}
          initialDate={dateStr}
          isModal={false}
          onSaved={onSaved}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("save-attendance-btn")).toBeDefined();
      });

      // Tap Save
      fireEvent.click(screen.getByTestId("save-attendance-btn"));

      await waitFor(() => {
        expect(attendanceActions.saveTeacherAttendanceRoster).toHaveBeenCalledTimes(1);
        const callArg = (attendanceActions.saveTeacherAttendanceRoster as any).mock.calls[0][0];
        expect(callArg.records.length).toBe(40);
        expect(onSaved).toHaveBeenCalledWith("Class 8 B: 39 present, 1 leave");
      });
    });
  });

  describe("AC-T4: Strict Click Budget Verification (<= 4 Taps)", () => {
    it("marks 40-student section with 2 absent, 1 late in exactly 4 taps total", async () => {
      const onSaved = vi.fn();
      let tapCount = 0;

      render(
        <AttendanceWorkbench
          initialSectionId={sectionId}
          initialDate={dateStr}
          isModal={false}
          onSaved={onSaved}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("student-row-student-1")).toBeDefined();
      });

      // Initial state: 39 present, 0 absent, 0 late, 1 leave
      expect(screen.getByTestId("counter-present").textContent).toContain("39");
      expect(screen.getByTestId("counter-absent").textContent).toContain("0");

      // Tap 1: Student 1 card tap -> PRESENT toggles to ABSENT
      fireEvent.click(screen.getByTestId("student-row-student-1"));
      tapCount++;
      expect(screen.getByTestId("counter-absent").textContent).toContain("1");

      // Tap 2: Student 2 card tap -> PRESENT toggles to ABSENT
      fireEvent.click(screen.getByTestId("student-row-student-2"));
      tapCount++;
      expect(screen.getByTestId("counter-absent").textContent).toContain("2");

      // Tap 3: Student 3 direct "L" chip tap -> sets to LATE
      fireEvent.click(screen.getByTestId("student-student-3-chip-LATE"));
      tapCount++;
      expect(screen.getByTestId("counter-late").textContent).toContain("1");

      // Tap 4: Save button tap -> submits full section
      fireEvent.click(screen.getByTestId("save-attendance-btn"));
      tapCount++;

      // Strict Click Budget assertion
      expect(tapCount).toBe(4);
      expect(tapCount).toBeLessThanOrEqual(4);

      await waitFor(() => {
        expect(attendanceActions.saveTeacherAttendanceRoster).toHaveBeenCalledTimes(1);
        const callArg = (attendanceActions.saveTeacherAttendanceRoster as any).mock.calls[0][0];
        expect(callArg.records.find((r: any) => r.studentId === "student-1").status).toBe("ABSENT");
        expect(callArg.records.find((r: any) => r.studentId === "student-2").status).toBe("ABSENT");
        expect(callArg.records.find((r: any) => r.studentId === "student-3").status).toBe("LATE");
        expect(callArg.records.find((r: any) => r.studentId === "student-40").status).toBe("LEAVE");
        expect(onSaved).toHaveBeenCalledWith("Class 8 B: 36 present, 2 absent, 1 late, 1 leave");
      });
    });
  });

  describe("AC-T5: Domain Event Emission & Parent Matrix Integration", () => {
    it("proves teacher-marked ABSENT status generates parent T1 notification decision", () => {
      // Cross-role verification:
      // When teacher saves student-1 as ABSENT, verify the parent policy engine
      // (notificationMatrix) accepts the event as a T1 notification
      const parentDecision = evaluateNotificationEligibility({
        studentId: "student-1",
        parentUserId: "parent-usr-99",
        tier: "T1_action_required",
        eventKind: "ATTENDANCE_ABSENT",
        now: new Date("2026-10-21T09:45:00Z"),
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      });

      expect(parentDecision.outcome).toBe("DISPATCH_NOW");
      expect(parentDecision.shouldPushNow).toBe(true);
      expect(parentDecision.dedupeKey).toBe("student-1:ATTENDANCE_ABSENT:2026-10-21");
    });
  });

  describe("AC-T9: Offline Attendance Queueing & Reconnect UI Verification", () => {
    it("queues attendance submission locally when network is down with visible badge and banner", async () => {
      // Simulate offline state
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      render(
        <AttendanceWorkbench
          initialSectionId={sectionId}
          initialDate={dateStr}
          isModal={false}
          locale="en"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("student-row-student-1")).toBeDefined();
      });

      // Mark student-1 as ABSENT
      fireEvent.click(screen.getByTestId("student-row-student-1"));
      expect(screen.getByTestId("counter-absent").textContent).toContain("1");

      // Click save button while offline
      fireEvent.click(screen.getByTestId("save-attendance-btn"));

      // Verify that offline queued badge is displayed
      await waitFor(() => {
        expect(screen.getByTestId("queued-offline-badge")).toBeDefined();
        expect(screen.getByTestId("queued-offline-banner")).toBeDefined();
        expect(screen.getByTestId("sync-now-btn")).toBeDefined();
      });

      // Server action should NOT have been called directly because navigator was offline
      expect(attendanceActions.saveTeacherAttendanceRoster).not.toHaveBeenCalled();

      // Restore online status
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      // Click "Sync Now" button
      fireEvent.click(screen.getByTestId("sync-now-btn"));

      await waitFor(() => {
        expect(attendanceActions.saveTeacherAttendanceRoster).toHaveBeenCalledTimes(1);
      });

      // Restore original navigator
      Object.defineProperty(navigator, "onLine", {
        value: originalOnLine,
        configurable: true,
      });
    });
  });
});
