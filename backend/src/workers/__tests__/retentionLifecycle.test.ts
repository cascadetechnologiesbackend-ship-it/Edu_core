import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeRetentionPolicy } from "../retention";
import { db } from "@/db";
import { students, dataRetentionPolicies } from "@/db/schema";

describe("Data Retention Lifecycle Worker (PF-R92 / Stage S2-F)", () => {
  const schoolId = "school-retention-test-123";

  const mockPolicy = [
    {
      id: "policy-students-1",
      schoolId,
      tableName: "students",
      retentionDays: 365, // 1 year
      purposeId: "purpose-student-lifecycle",
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT soft-delete active students enrolled 3 years ago without exit date", async () => {
    vi.spyOn(db.query.dataRetentionPolicies, "findMany").mockResolvedValue(
      mockPolicy as any,
    );

    // Mock query finding eligible students: active students do NOT match the lifecycle exit condition
    vi.spyOn(db.query.students, "findMany").mockResolvedValue([]); // Active students filtered out at query level

    const updateWhereSpy = vi.fn().mockResolvedValue({});
    const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
    const updateSpy = vi
      .spyOn(db, "update")
      .mockReturnValue({ set: updateSetSpy } as any);

    const result = await executeRetentionPolicy(schoolId);

    expect(result.success).toBe(true);
    expect(result.softDeletedCount).toBe(0);
    // Verifies no student update was executed (only dataRetentionPolicies updated)
    expect(updateSpy).not.toHaveBeenCalledWith(students);
    expect(updateSpy).toHaveBeenCalledWith(dataRetentionPolicies);
  });

  it("soft-deletes alumni / exited students whose exit date is older than retention window", async () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86400000);

    vi.spyOn(db.query.dataRetentionPolicies, "findMany").mockResolvedValue(
      mockPolicy as any,
    );

    const exitedStudent = {
      id: "student-alumni-1",
      schoolId,
      isActive: false,
      leavingDate: twoYearsAgo,
      legalHold: false,
      deletedAt: null,
    };

    // First call is soft-delete eligible query; second call is hard-purge query
    vi.spyOn(db.query.students, "findMany")
      .mockResolvedValueOnce([exitedStudent] as any)
      .mockResolvedValueOnce([]);

    const updateWhereSpy = vi.fn().mockResolvedValue({});
    const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
    const updateSpy = vi
      .spyOn(db, "update")
      .mockReturnValue({ set: updateSetSpy } as any);

    const insertValuesSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(db, "insert").mockReturnValue({ values: insertValuesSpy } as any);

    const result = await executeRetentionPolicy(schoolId);

    expect(result.success).toBe(true);
    expect(result.softDeletedCount).toBe(1);
    expect(updateSpy).toHaveBeenCalledWith(students);
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
      }),
    );
    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WRITE",
        tableName: "students",
        recordId: "student-alumni-1",
        metadata: expect.objectContaining({ action: "SOFT_DELETE" }),
      }),
    );
  });

  it("anonymizes student PII without deleting the row when student has linked fee invoices or payments", async () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000);

    vi.spyOn(db.query.dataRetentionPolicies, "findMany").mockResolvedValue(
      mockPolicy as any,
    );

    const softDeletedStudentWithFees = {
      id: "student-with-invoices-1",
      schoolId,
      isActive: false,
      deletedAt: fortyDaysAgo,
      legalHold: false,
    };

    // Soft delete query returns none; hard purge query returns candidate past 30-day grace period
    vi.spyOn(db.query.students, "findMany")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([softDeletedStudentWithFees] as any);

    // Linked invoice found!
    vi.spyOn(db.query.feeInvoices, "findFirst").mockResolvedValue({
      id: "inv-123",
    } as any);
    vi.spyOn(db.query.feePayments, "findFirst").mockResolvedValue(undefined);

    const deleteSpy = vi.spyOn(db, "delete");
    const updateWhereSpy = vi.fn().mockResolvedValue({});
    const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
    const updateSpy = vi
      .spyOn(db, "update")
      .mockReturnValue({ set: updateSetSpy } as any);

    const insertValuesSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(db, "insert").mockReturnValue({ values: insertValuesSpy } as any);

    const result = await executeRetentionPolicy(schoolId);

    expect(result.success).toBe(true);
    expect(result.hardPurgedCount).toBe(0); // NOT hard deleted
    expect(result.anonymizedCount).toBe(1); // ANONYMIZED
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(students);

    // Verify PII redaction fields were set
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        firstNameEncrypted: "[ANONYMIZED]",
        lastNameEncrypted: "[ANONYMIZED]",
        firstNameSearchHash: null,
        lastNameSearchHash: null,
        aadhaarLast4: null,
        photoS3Key: null,
        leavingReason: "[PURGED_ANONYMIZED]",
      }),
    );

    // Verify audit log recorded HARD_PURGE_ANONYMIZED
    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WRITE",
        tableName: "students",
        recordId: "student-with-invoices-1",
        metadata: expect.objectContaining({
          action: "HARD_PURGE_ANONYMIZED",
          reason: "Accounting audit trail preserved",
        }),
      }),
    );
  });

  it("hard purges student record completely when no fee invoices or payments exist", async () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000);

    vi.spyOn(db.query.dataRetentionPolicies, "findMany").mockResolvedValue(
      mockPolicy as any,
    );

    const softDeletedStudentWithoutFees = {
      id: "student-no-fees-1",
      schoolId,
      isActive: false,
      deletedAt: fortyDaysAgo,
      legalHold: false,
    };

    vi.spyOn(db.query.students, "findMany")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([softDeletedStudentWithoutFees] as any);

    // No fee records found
    vi.spyOn(db.query.feeInvoices, "findFirst").mockResolvedValue(undefined);
    vi.spyOn(db.query.feePayments, "findFirst").mockResolvedValue(undefined);

    const deleteWhereSpy = vi.fn().mockResolvedValue({});
    const deleteSpy = vi
      .spyOn(db, "delete")
      .mockReturnValue({ where: deleteWhereSpy } as any);

    const updateSetSpy = vi.fn().mockReturnValue({ where: vi.fn() });
    vi.spyOn(db, "update").mockReturnValue({ set: updateSetSpy } as any);

    const insertValuesSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(db, "insert").mockReturnValue({ values: insertValuesSpy } as any);

    const result = await executeRetentionPolicy(schoolId);

    expect(result.success).toBe(true);
    expect(result.hardPurgedCount).toBe(1);
    expect(result.anonymizedCount).toBe(0);
    expect(deleteSpy).toHaveBeenCalledWith(students);
    expect(deleteWhereSpy).toHaveBeenCalled();

    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        tableName: "students",
        recordId: "student-no-fees-1",
        metadata: expect.objectContaining({ action: "HARD_PURGE" }),
      }),
    );
  });

  it("dry-run mode returns would-be-affected preview lists without making database mutations", async () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86400000);
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000);

    vi.spyOn(db.query.dataRetentionPolicies, "findMany").mockResolvedValue(
      mockPolicy as any,
    );

    const softCandidate = {
      id: "student-soft-dry",
      schoolId,
      isActive: false,
      leavingDate: twoYearsAgo,
      legalHold: false,
      deletedAt: null,
    };

    const hardCandidate = {
      id: "student-hard-dry",
      schoolId,
      isActive: false,
      deletedAt: fortyDaysAgo,
      legalHold: false,
    };

    vi.spyOn(db.query.students, "findMany")
      .mockResolvedValueOnce([softCandidate] as any)
      .mockResolvedValueOnce([hardCandidate] as any);

    vi.spyOn(db.query.feeInvoices, "findFirst").mockResolvedValue({
      id: "inv-fee",
    } as any);
    vi.spyOn(db.query.feePayments, "findFirst").mockResolvedValue(undefined);

    const updateSpy = vi.spyOn(db, "update");
    const deleteSpy = vi.spyOn(db, "delete");
    const insertSpy = vi.spyOn(db, "insert");

    const result = await executeRetentionPolicy(schoolId, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.softDeletedCount).toBe(1);
    expect(result.anonymizedCount).toBe(1);
    expect(result.wouldSoftDelete).toBeDefined();
    expect(result.wouldSoftDelete![0]?.id).toBe("student-soft-dry");
    expect(result.wouldHardPurge).toBeDefined();
    expect(result.wouldHardPurge![0]?.id).toBe("student-hard-dry");
    expect(result.wouldHardPurge![0]?.action).toBe("ANONYMIZE");

    // Zero database mutations in dry run
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
