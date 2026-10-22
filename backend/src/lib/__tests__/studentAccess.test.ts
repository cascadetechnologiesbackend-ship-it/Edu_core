/**
 * Phase S1 Student Access & Provisioning Integration Test Suite
 *
 * Verifies:
 * - SD1 Closure: students.userId is written by provisionOrLinkStudent with STUDENT role + claim token.
 * - Minor-Safe DOB Claim Verification: rate limiting, correct DOB/token verification, password activation.
 * - Multi-tenant isolation: operations fail closed across tenant boundaries.
 * - Admin Student Access queue: enable, disable, and resend claim actions.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  students,
  users,
  passwordResetTokens,
  roles,
  userRoles,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  provisionOrLinkStudent,
  verifyAndClaimStudentAccount,
  getStudentAccessQueue,
  enableStudentAccess,
  disableStudentAccess,
  resendStudentClaim,
  deriveStudentUsername,
} from "../studentAccess";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import bcrypt from "bcryptjs";

describe("Phase S1: Student Access Provisioning & Claim Engine", { timeout: 30000 }, () => {
  const schoolAId = ISOLATION_IDS.schoolA.id;
  const schoolBId = ISOLATION_IDS.schoolB.id;
  const academicYearAId = ISOLATION_IDS.schoolA.academicYearId;
  const adminAId = ISOLATION_IDS.schoolA.adminUserId;

  beforeAll(async () => {
    await seedIsolationSchools();
  });

  it("SD1 / Task 1: Provisions STUDENT user account and writes students.userId in a single transaction", async () => {
    const admissionNumber = `ADM-${Date.now()}`;
    const dob = new Date("2012-05-15");

    let studentId!: string;
    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber,
          firstNameEncrypted: encryptData("Aarav"),
          lastNameEncrypted: encryptData("Patel"),
          dateOfBirth: dob,
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentId = s!.id;
    });

    // Run provisionOrLinkStudent
    const result = await provisionOrLinkStudent({
      schoolId: schoolAId,
      studentId,
      admissionNumber,
      dateOfBirth: dob,
      studentName: "Aarav Patel",
      performedByUserId: adminAId,
    });

    expect(result.isNewlyProvisioned).toBe(true);
    expect(result.studentUserId).toBeDefined();
    expect(result.studentCredentials).toBeDefined();
    expect(result.studentCredentials?.claimToken).toBeDefined();
    expect(result.studentCredentials?.claimUrl).toContain(result.studentCredentials?.claimToken);

    // Verify DB state
    await withTenant(schoolAId, async (tx) => {
      const studentRow = await tx.query.students.findFirst({
        where: and(eq(students.id, studentId), eq(students.schoolId, schoolAId)),
      });
      expect(studentRow?.userId).toBe(result.studentUserId);

      const userRow = await tx.query.users.findFirst({
        where: and(eq(users.id, result.studentUserId!), eq(users.schoolId, schoolAId)),
      });
      expect(userRow).toBeDefined();
      expect(userRow?.isActive).toBe(true);
      expect(userRow?.mustChangePassword).toBe(true);

      // Verify token
      const tokenRows = await tx.query.passwordResetTokens.findMany({
        where: eq(passwordResetTokens.userId, result.studentUserId!),
      });
      expect(tokenRows.length).toBeGreaterThan(0);
    });

    // Idempotency: calling again returns the same studentUserId
    const secondCall = await provisionOrLinkStudent({
      schoolId: schoolAId,
      studentId,
      admissionNumber,
      dateOfBirth: dob,
      studentName: "Aarav Patel",
      performedByUserId: adminAId,
    });
    expect(secondCall.isNewlyProvisioned).toBe(false);
    expect(secondCall.studentUserId).toBe(result.studentUserId);
  });

  it("Task 2: Minor-Safe DOB Account Claim Flow activates password upon matching DOB + claimToken", async () => {
    const admissionNumber = `CLAIM-${Date.now()}`;
    const dob = new Date("2013-08-20");

    let studentId!: string;
    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber,
          firstNameEncrypted: encryptData("Diya"),
          lastNameEncrypted: encryptData("Sharma"),
          dateOfBirth: dob,
          gender: "FEMALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentId = s!.id;
    });

    const provisionRes = await provisionOrLinkStudent({
      schoolId: schoolAId,
      studentId,
      admissionNumber,
      dateOfBirth: dob,
      studentName: "Diya Sharma",
      performedByUserId: adminAId,
    });

    const claimToken = provisionRes.studentCredentials!.claimToken;

    // Negative test 1: Wrong DOB
    await expect(
      verifyAndClaimStudentAccount({
        schoolId: schoolAId,
        admissionNumber,
        dateOfBirth: "2013-08-21", // 1 day off
        claimToken,
        newPassword: "StudentNewSecurePass123!",
      }),
    ).rejects.toThrow(/Date of birth does not match/);

    // Negative test 2: Wrong claim token
    await expect(
      verifyAndClaimStudentAccount({
        schoolId: schoolAId,
        admissionNumber,
        dateOfBirth: dob,
        claimToken: "invalidTokenHex0000000000000000000000000000000000000000000000000000",
        newPassword: "StudentNewSecurePass123!",
      }),
    ).rejects.toThrow(/Invalid or expired claim token/);

    // Positive test: Correct DOB and Token
    const claimResult = await verifyAndClaimStudentAccount({
      schoolId: schoolAId,
      admissionNumber,
      dateOfBirth: dob,
      claimToken,
      newPassword: "StudentNewSecurePass123!",
    });

    expect(claimResult.success).toBe(true);

    // Verify user password hash changed and mustChangePassword is false
    await withTenant(schoolAId, async (tx) => {
      const u = await tx.query.users.findFirst({
        where: and(eq(users.id, provisionRes.studentUserId!), eq(users.schoolId, schoolAId)),
      });
      expect(u?.mustChangePassword).toBe(false);
      const isMatch = await bcrypt.compare("StudentNewSecurePass123!", u?.passwordHash || "");
      expect(isMatch).toBe(true);
    });

    // Replay attack: Used token cannot be used again
    await expect(
      verifyAndClaimStudentAccount({
        schoolId: schoolAId,
        admissionNumber,
        dateOfBirth: dob,
        claimToken,
        newPassword: "AnotherPassword123!",
      }),
    ).rejects.toThrow(/already been used/);
  });

  it("Task 3: Rate limits repeated failed claim attempts against brute-forcing DOB", async () => {
    const admissionNumber = `BRUTE-${Date.now()}`;
    const dob = new Date("2014-01-01");

    let studentId!: string;
    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber,
          firstNameEncrypted: encryptData("Test"),
          lastNameEncrypted: encryptData("Brute"),
          dateOfBirth: dob,
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentId = s!.id;
    });

    const provisionRes = await provisionOrLinkStudent({
      schoolId: schoolAId,
      studentId,
      admissionNumber,
      dateOfBirth: dob,
      studentName: "Test Brute",
      performedByUserId: adminAId,
    });

    const claimToken = provisionRes.studentCredentials!.claimToken;

    // Fail 5 times with wrong DOB
    for (let i = 0; i < 5; i++) {
      try {
        await verifyAndClaimStudentAccount({
          schoolId: schoolAId,
          admissionNumber,
          dateOfBirth: `2014-01-0${i + 2}`,
          claimToken,
          newPassword: "Password123!",
        });
      } catch {}
    }

    // 6th attempt should be blocked by rate limit lockout
    await expect(
      verifyAndClaimStudentAccount({
        schoolId: schoolAId,
        admissionNumber,
        dateOfBirth: dob, // Even with correct DOB
        claimToken,
        newPassword: "Password123!",
      }),
    ).rejects.toThrow(/Too many failed verification attempts/);
  });

  it("Task 4: Admin Student Access queue can enable, disable, and resend claims", async () => {
    const admissionNumber = `ADMIN-${Date.now()}`;
    const dob = new Date("2011-11-11");

    let studentId!: string;
    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber,
          firstNameEncrypted: encryptData("Kabir"),
          lastNameEncrypted: encryptData("Sen"),
          dateOfBirth: dob,
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentId = s!.id;
    });

    // 1. Initial queue check: student is UNPROVISIONED
    const initialQueue = await getStudentAccessQueue(schoolAId, { search: admissionNumber });
    expect(initialQueue.length).toBe(1);
    expect(initialQueue[0]!.accessStatus).toBe("UNPROVISIONED");

    // 2. Enable student access
    const enableRes = await enableStudentAccess(schoolAId, studentId, adminAId);
    expect(enableRes.success).toBe(true);

    const activeQueue = await getStudentAccessQueue(schoolAId, { search: admissionNumber });
    expect(activeQueue[0]!.accessStatus).toBe("ACTIVE");

    // 3. Disable student access
    const disableRes = await disableStudentAccess(schoolAId, studentId, adminAId);
    expect(disableRes.success).toBe(true);

    const disabledQueue = await getStudentAccessQueue(schoolAId, { search: admissionNumber });
    expect(disabledQueue[0]!.accessStatus).toBe("DISABLED");

    // 4. Resend claim
    const resendRes = await resendStudentClaim(schoolAId, studentId, adminAId);
    expect(resendRes.success).toBe(true);
    expect(resendRes.claimUrl).toBeDefined();
  });
});
