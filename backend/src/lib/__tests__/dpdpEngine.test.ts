import { describe, it, expect } from "vitest";

// Business logic functions to test
function isEligibleForSoftDelete(
  student: { createdAt: Date; legalHold: boolean; deletedAt: Date | null },
  retentionDays: number,
): boolean {
  if (student.legalHold) return false;
  if (student.deletedAt !== null) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return student.createdAt < cutoff;
}

function isEligibleForHardPurge(
  student: { deletedAt: Date | null; legalHold: boolean },
  graceDays: number,
): boolean {
  if (student.legalHold) return false;
  if (student.deletedAt === null) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - graceDays);
  return student.deletedAt < cutoff;
}

function calculateSlaHoursRemaining(dueAt: Date, now: Date): number {
  return Math.round((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));
}

describe("DPDP Compliance Engine Tests", () => {
  describe("Data Retention Checks", () => {
    it("should flag records for soft-delete if older than retention limit and not on legal hold", () => {
      const oldStudent = {
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
        legalHold: false,
        deletedAt: null,
      };

      const result = isEligibleForSoftDelete(oldStudent, 365);
      expect(result).toBe(true);
    });

    it("should NOT flag records for soft-delete if on legal hold", () => {
      const heldStudent = {
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        legalHold: true,
        deletedAt: null,
      };

      const result = isEligibleForSoftDelete(heldStudent, 365);
      expect(result).toBe(false);
    });

    it("should flag soft-deleted records for hard-purge after grace period", () => {
      const deletedStudent = {
        legalHold: false,
        deletedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // deleted 45 days ago
      };

      const result = isEligibleForHardPurge(deletedStudent, 30);
      expect(result).toBe(true);
    });

    it("should NOT flag soft-deleted records for hard-purge if on legal hold", () => {
      const heldDeletedStudent = {
        legalHold: true,
        deletedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      };

      const result = isEligibleForHardPurge(heldDeletedStudent, 30);
      expect(result).toBe(false);
    });
  });

  describe("SLA Tracking", () => {
    it("should calculate remaining hours accurately", () => {
      const baseTime = new Date("2026-07-15T12:00:00Z");
      const dueTime = new Date("2026-07-18T12:00:00Z"); // Exactly 72 hours later

      const hours = calculateSlaHoursRemaining(dueTime, baseTime);
      expect(hours).toBe(72);
    });

    it("should return negative values if due date is passed", () => {
      const baseTime = new Date("2026-07-19T12:00:00Z");
      const dueTime = new Date("2026-07-18T12:00:00Z"); // 24 hours overdue

      const hours = calculateSlaHoursRemaining(dueTime, baseTime);
      expect(hours).toBe(-24);
    });
  });
});
