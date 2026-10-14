import { describe, it, expect, vi } from "vitest";
import {
  hasExamPermission,
  requireExamPermission,
  ExamAuthorizationError,
} from "@/lib/examPermissions";

describe("Layer 3 Server Actions Authorization Guards", () => {
  it("createExam rejects TEACHER role", () => {
    expect(hasExamPermission("TEACHER", "exam.setup.manage")).toBe(false);
    expect(() => requireExamPermission("TEACHER", "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );
  });

  it("createExam permits PRINCIPAL and SCHOOL_ADMIN", () => {
    expect(hasExamPermission("PRINCIPAL", "exam.setup.manage")).toBe(true);
    expect(hasExamPermission("SCHOOL_ADMIN", "exam.setup.manage")).toBe(true);
  });

  it("createExamSchedule and deleteExamSchedule require exam.schedule.manage", () => {
    expect(hasExamPermission("TEACHER", "exam.schedule.manage")).toBe(false);
    expect(hasExamPermission("PRINCIPAL", "exam.schedule.manage")).toBe(true);
    expect(hasExamPermission("SCHOOL_ADMIN", "exam.schedule.manage")).toBe(true);
  });

  it("saveMarkEntries allows TEACHER with exam.marks.entry", () => {
    expect(hasExamPermission("TEACHER", "exam.marks.entry")).toBe(true);
    expect(() => requireExamPermission("TEACHER", "exam.marks.entry")).not.toThrow();
  });

  it("lockMarks and unlockMarks reject TEACHER role", () => {
    expect(hasExamPermission("TEACHER", "exam.marks.lock")).toBe(false);
    expect(hasExamPermission("TEACHER", "exam.marks.unlock")).toBe(false);
    expect(() => requireExamPermission("TEACHER", "exam.marks.lock")).toThrow(
      ExamAuthorizationError,
    );
  });

  it("publishResults allows PRINCIPAL and SCHOOL_ADMIN", () => {
    expect(hasExamPermission("PRINCIPAL", "exam.result.publish")).toBe(true);
    expect(hasExamPermission("SCHOOL_ADMIN", "exam.result.publish")).toBe(true);
    expect(hasExamPermission("TEACHER", "exam.result.publish")).toBe(false);
  });

  it("ACCOUNTANT can manage admit cards but cannot enter marks or publish results", () => {
    expect(hasExamPermission("ACCOUNTANT", "exam.admit_card.manage")).toBe(true);
    expect(hasExamPermission("ACCOUNTANT", "exam.admit_card.view")).toBe(true);
    expect(hasExamPermission("ACCOUNTANT", "exam.marks.entry")).toBe(false);
    expect(hasExamPermission("ACCOUNTANT", "exam.result.publish")).toBe(false);
  });
});
