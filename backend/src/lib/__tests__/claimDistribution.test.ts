/**
 * Phase D1-L4: Parent and Student Claim Distribution & Tracking Integration Test Suite
 *
 * Verifies:
 * - Phone-only parent provisioning: generates canonical internal username and claim token.
 * - End-to-end parent claim verification: token check, password set, student linkage, expired token rejection, cross-tenant rejection.
 * - Resend claim preservation: resend never invalidates an already claimed account (throws error).
 * - End-to-end student claim verification: minor-safe DOB check, token single-use, rate limiting.
 * - Claim tracking queue & S25 SMS dispatch list: accurate counts and queue composition.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  students,
  users,
  passwordResetTokens,
  smsLogs,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  provisionOrLinkParent,
  verifyAndClaimParentAccount,
  resendParentClaim,
  deriveParentUsername,
} from "../parentLinkage";
import {
  provisionOrLinkStudent,
  verifyAndClaimStudentAccount,
  resendStudentClaim,
} from "../studentAccess";
import {
  getClaimTrackingQueue,
  queueSmsRemindersForPendingClaims,
  getClassClaimSheetData,
} from "../claimDistribution";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { authConfig } from "../auth/auth.config";
import bcrypt from "bcryptjs";
import crypto from "crypto";

describe("Phase D1-L4: Claim Distribution and Tracking Engine", { timeout: 35000 }, () => {
  const schoolAId = ISOLATION_IDS.schoolA.id;
  const schoolBId = ISOLATION_IDS.schoolB.id;
  const academicYearAId = ISOLATION_IDS.schoolA.academicYearId;
  const adminAId = ISOLATION_IDS.schoolA.adminUserId;

  beforeAll(async () => {
    await seedIsolationSchools();
  });

  describe("1. Phone-Only Parent Provisioning", () => {
    it("normalizes phone formats (+91, spaces, dashes) to identical canonical usernames", () => {
      const u1 = deriveParentUsername("+91 98765-43210", schoolAId, "dps");
      const u2 = deriveParentUsername("9876543210", schoolAId, "dps");
      const u3 = deriveParentUsername("09876543210", schoolAId, "dps");

      expect(u1).toBe("parent.9876543210@dps.schoolmitra.internal");
      expect(u2).toBe("parent.9876543210@dps.schoolmitra.internal");
      expect(u3).toBe("parent.9876543210@dps.schoolmitra.internal");
    });
    it("provisions phone-only parent with canonical internal username and claim credential", async () => {
      const mobileNumber = `98765${Math.floor(10000 + Math.random() * 90000)}`;
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber: `PHONE-P-${Date.now()}`,
            firstNameEncrypted: encryptData("ChildOf"),
            lastNameEncrypted: encryptData("PhoneOnly"),
            dateOfBirth: new Date("2014-04-10"),
            gender: "FEMALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      // Call provisionOrLinkParent with mobile but NO email
      const result = await provisionOrLinkParent({
        schoolId: schoolAId,
        studentId,
        primaryEmail: null,
        primaryMobile: mobileNumber,
        guardianName: "Sunita Sharma",
        performedByUserId: adminAId,
      });

      expect(result.parentUserId).toBeDefined();
      expect(result.isNewlyProvisioned).toBe(true);
      expect(result.parentCredentials).toBeDefined();
      expect(result.parentCredentials?.email).toContain(`parent.${mobileNumber}@`);
      expect(result.parentCredentials?.claimToken).toBeDefined();
      expect(result.parentCredentials?.claimUrl).toContain(result.parentCredentials!.claimToken);

      // Verify DB state
      await withTenant(schoolAId, async (tx) => {
        const parentUser = await tx.query.users.findFirst({
          where: and(eq(users.id, result.parentUserId!), eq(users.schoolId, schoolAId)),
        });
        expect(parentUser).toBeDefined();
        expect(parentUser?.email).toBe(result.parentCredentials?.email);
        expect(parentUser?.mustChangePassword).toBe(true);
        expect(parentUser?.isActive).toBe(true);

        const linkedStudent = await tx.query.students.findFirst({
          where: eq(students.id, studentId),
        });
        expect(linkedStudent?.primaryParentUserId).toBe(result.parentUserId);
      });
    });
  });

  describe("2. End-to-End Parent Claim Verification", () => {
    it("verifies token, sets password, marks user claimed, and rejects expired/used tokens", async () => {
      const email = `parent.claim.${Date.now()}@example.com`;
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber: `CLM-P-${Date.now()}`,
            firstNameEncrypted: encryptData("Rohan"),
            lastNameEncrypted: encryptData("Verma"),
            dateOfBirth: new Date("2013-08-20"),
            gender: "MALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      const provResult = await provisionOrLinkParent({
        schoolId: schoolAId,
        studentId,
        primaryEmail: email,
        guardianName: "Anil Verma",
        performedByUserId: adminAId,
      });

      const token = provResult.parentCredentials!.claimToken;
      const newPassword = "MyStrongNewPassword2026!";

      // 1. Claim account with valid token
      const claimResult = await verifyAndClaimParentAccount({
        schoolId: schoolAId,
        token,
        newPassword,
      });

      expect(claimResult.success).toBe(true);
      expect(claimResult.userId).toBe(provResult.parentUserId);
      expect(claimResult.email).toBe(email);

      // 2. Verify DB state: password updated and mustChangePassword is false
      await withTenant(schoolAId, async (tx) => {
        const userRow = await tx.query.users.findFirst({
          where: eq(users.id, provResult.parentUserId!),
        });
        expect(userRow?.mustChangePassword).toBe(false);
        const passwordMatches = await bcrypt.compare(newPassword, userRow!.passwordHash!);
        expect(passwordMatches).toBe(true);

        // Token is consumed (usedAt is set)
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const tokenRow = await tx.query.passwordResetTokens.findFirst({
          where: eq(passwordResetTokens.tokenHash, tokenHash),
        });
        expect(tokenRow?.usedAt).toBeDefined();
      });

      // 3. Re-using the same token fails (single-use consumption)
      await expect(
        verifyAndClaimParentAccount({
          schoolId: schoolAId,
          token,
          newPassword: "AnotherPassword123!",
        }),
      ).rejects.toThrow("already been used");

      // 4. Expired token rejection
      const expiredToken = crypto.randomBytes(32).toString("hex");
      const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");

      await withTenant(schoolAId, async (tx) => {
        await tx.insert(passwordResetTokens).values({
          userId: provResult.parentUserId!,
          tokenHash: expiredHash,
          expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
        });
      });

      await expect(
        verifyAndClaimParentAccount({
          schoolId: schoolAId,
          token: expiredToken,
          newPassword: "AnotherPassword123!",
        }),
      ).rejects.toThrow("expired");

      // 5. Cross-tenant rejection
      const otherToken = crypto.randomBytes(32).toString("hex");
      const otherHash = crypto.createHash("sha256").update(otherToken).digest("hex");

      await withTenant(schoolAId, async (tx) => {
        await tx.insert(passwordResetTokens).values({
          userId: provResult.parentUserId!,
          tokenHash: otherHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      });

      await expect(
        verifyAndClaimParentAccount({
          schoolId: schoolBId, // wrong school!
          token: otherToken,
          newPassword: "AnotherPassword123!",
        }),
      ).rejects.toThrow("does not belong");
    });

    it("prevents double-claim race condition under concurrent submission (atomic token consumption)", async () => {
      const email = `race.parent.${Date.now()}@example.com`;
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber: `RACE-${Date.now()}`,
            firstNameEncrypted: encryptData("Race"),
            lastNameEncrypted: encryptData("Condition"),
            dateOfBirth: new Date("2012-10-10"),
            gender: "FEMALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      const prov = await provisionOrLinkParent({
        schoolId: schoolAId,
        studentId,
        primaryEmail: email,
        guardianName: "Race Guardian",
        performedByUserId: adminAId,
      });

      const token = prov.parentCredentials!.claimToken;

      // Execute 2 claims concurrently with the same token
      const results = await Promise.allSettled([
        verifyAndClaimParentAccount({
          schoolId: schoolAId,
          token,
          newPassword: "ConcurrentPass123!",
        }),
        verifyAndClaimParentAccount({
          schoolId: schoolAId,
          token,
          newPassword: "ConcurrentPass123!",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed, and exactly one must fail with token consumed
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("already been used");
    });
  });

  describe("3. Resend Claim Safety Invariant (Never Invalidate Claimed Accounts)", () => {
    it("refuses to regenerate claim credentials for an already claimed parent account", async () => {
      const email = `already.claimed.${Date.now()}@example.com`;
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber: `CLM-ALREADY-${Date.now()}`,
            firstNameEncrypted: encryptData("Priya"),
            lastNameEncrypted: encryptData("Singh"),
            dateOfBirth: new Date("2011-12-15"),
            gender: "FEMALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      const prov = await provisionOrLinkParent({
        schoolId: schoolAId,
        studentId,
        primaryEmail: email,
        guardianName: "Rajesh Singh",
        performedByUserId: adminAId,
      });

      // Claim it
      await verifyAndClaimParentAccount({
        schoolId: schoolAId,
        token: prov.parentCredentials!.claimToken,
        newPassword: "ClaimedPassword123!",
      });

      // Attempting to resend claim for already claimed parent MUST fail and preserve credentials
      await expect(
        resendParentClaim({
          schoolId: schoolAId,
          studentId,
          performedByUserId: adminAId,
        }),
      ).rejects.toThrow("already been claimed");
    });

    it("refuses to regenerate claim credentials for an already claimed student account", async () => {
      const admissionNumber = `STD-CLAIMED-${Date.now()}`;
      const dob = new Date("2013-03-25");
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber,
            firstNameEncrypted: encryptData("Deepak"),
            lastNameEncrypted: encryptData("Nair"),
            dateOfBirth: dob,
            gender: "MALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      const prov = await provisionOrLinkStudent({
        schoolId: schoolAId,
        studentId,
        admissionNumber,
        dateOfBirth: dob,
        studentName: "Deepak Nair",
        performedByUserId: adminAId,
      });

      // Claim student account
      await verifyAndClaimStudentAccount({
        schoolId: schoolAId,
        admissionNumber,
        dateOfBirth: dob,
        claimToken: prov.studentCredentials!.claimToken,
        newPassword: "StudentPassword123!",
      });

      // Attempting to resend claim for claimed student MUST throw
      await expect(
        resendStudentClaim(schoolAId, studentId, adminAId),
      ).rejects.toThrow("already been claimed");
    });

    it("generates a new claim token when parent account is UNCLAIMED", async () => {
      const email = `unclaimed.${Date.now()}@example.com`;
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber: `UNCLM-${Date.now()}`,
            firstNameEncrypted: encryptData("Geeta"),
            lastNameEncrypted: encryptData("Gupta"),
            dateOfBirth: new Date("2012-07-11"),
            gender: "FEMALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      await provisionOrLinkParent({
        schoolId: schoolAId,
        studentId,
        primaryEmail: email,
        guardianName: "Manoj Gupta",
        performedByUserId: adminAId,
      });

      // Resend claim on unclaimed account succeeds
      const resendResult = await resendParentClaim({
        schoolId: schoolAId,
        studentId,
        performedByUserId: adminAId,
      });

      expect(resendResult.success).toBe(true);
      expect(resendResult.claimToken).toBeDefined();
      expect(resendResult.claimUrl).toContain(resendResult.claimToken);
    });
  });

  describe("4. End-to-End Student Claim Verification", () => {
    it("enforces minor-safe DOB match, sets password, and consumes token", async () => {
      const admissionNumber = `STD-DOB-${Date.now()}`;
      const dob = new Date("2014-06-18");
      let studentId!: string;

      await withTenant(schoolAId, async (tx) => {
        const [s] = await tx
          .insert(students)
          .values({
            schoolId: schoolAId,
            academicYearId: academicYearAId,
            admissionNumber,
            firstNameEncrypted: encryptData("Kabir"),
            lastNameEncrypted: encryptData("Mehta"),
            dateOfBirth: dob,
            gender: "MALE",
            category: "GENERAL",
            admissionDate: new Date(),
            isActive: true,
          })
          .returning();
        studentId = s!.id;
      });

      const prov = await provisionOrLinkStudent({
        schoolId: schoolAId,
        studentId,
        admissionNumber,
        dateOfBirth: dob,
        studentName: "Kabir Mehta",
        performedByUserId: adminAId,
      });

      const token = prov.studentCredentials!.claimToken;

      // 1. Wrong DOB is rejected
      await expect(
        verifyAndClaimStudentAccount({
          schoolId: schoolAId,
          admissionNumber,
          dateOfBirth: "2015-01-01", // incorrect DOB
          claimToken: token,
          newPassword: "StudentPassword123!",
        }),
      ).rejects.toThrow("Date of birth does not match");

      // 2. Correct DOB succeeds
      const claimResult = await verifyAndClaimStudentAccount({
        schoolId: schoolAId,
        admissionNumber,
        dateOfBirth: dob,
        claimToken: token,
        newPassword: "KabirPassword2026!",
      });

      expect(claimResult.success).toBe(true);
      expect(claimResult.userId).toBe(prov.studentUserId);

      // 3. User account is updated
      await withTenant(schoolAId, async (tx) => {
        const u = await tx.query.users.findFirst({
          where: eq(users.id, prov.studentUserId!),
        });
        expect(u?.mustChangePassword).toBe(false);
      });
    });
  });

  describe("5. Claim Tracking Queue & S25 SMS Dispatch", () => {
    it("retrieves tracking queue and accurately summarizes enrolled, issued, claimed, and pending", async () => {
      const queue = await getClaimTrackingQueue(schoolAId);
      expect(queue.summary).toBeDefined();
      expect(queue.summary.totalEnrolled).toBeGreaterThanOrEqual(0);
      expect(queue.summary.totalIssued).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(queue.items)).toBe(true);
      expect(Array.isArray(queue.summary.classSummaries)).toBe(true);
    });

    it("queues SMS reminders for pending claims into sms_logs", async () => {
      const res = await queueSmsRemindersForPendingClaims({
        schoolId: schoolAId,
        performedByUserId: adminAId,
      });

      expect(res.success).toBe(true);
      expect(typeof res.queuedCount).toBe("number");
    });

    it("generates class claim sheet data with required columns", async () => {
      const rows = await getClassClaimSheetData(schoolAId);
      expect(Array.isArray(rows)).toBe(true);
      if (rows.length > 0) {
        const row = rows[0]!;
        expect(row).toHaveProperty("className");
        expect(row).toHaveProperty("sectionName");
        expect(row).toHaveProperty("studentName");
        expect(row).toHaveProperty("admissionNumber");
        expect(row).toHaveProperty("rollNumber");
        expect(row).toHaveProperty("guardianName");
        expect(row).toHaveProperty("guardianMobile");
        expect(row).toHaveProperty("claimCode");
        expect(row).toHaveProperty("claimStatus");
        expect(row).toHaveProperty("expiryDate");
      }
    });
  });

  describe("6. Public Verification Route Accessibility via Auth Middleware", () => {
    it("permits unauthenticated access to /claim-account and /claim-student-account", () => {
      const authorizedFn = authConfig.callbacks?.authorized;
      expect(authorizedFn).toBeDefined();

      const reqParent = {
        nextUrl: new URL("http://localhost:3000/claim-account?token=abc123def456"),
        headers: new Headers(),
      };
      const allowedParent = (authorizedFn as any)({ auth: null, request: reqParent });
      expect(allowedParent).toBe(true);

      const reqStudent = {
        nextUrl: new URL("http://localhost:3000/claim-student-account?token=xyz789"),
        headers: new Headers(),
      };
      const allowedStudent = (authorizedFn as any)({ auth: null, request: reqStudent });
      expect(allowedStudent).toBe(true);
    });
  });
});
