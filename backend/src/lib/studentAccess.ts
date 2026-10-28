/**
 * Student PWA (v1.0) — Student Identity Provisioning & Access Engine
 *
 * Implements authoritative student user matching, account provisioning,
 * minor-safe DOB claim secret verification, and Admin Student Access queue.
 *
 * Conforms to:
 * - docs/student-pwa-spec.json (Phase S1)
 * - DPDP Act 2023 & Minor Protection: Students require no email; claim secret
 *   is admissionNumber + DOB with strict rate limiting.
 * - S12 RLS fail-closed multi-tenant isolation via withTenant(schoolId).
 */

import { db } from "@/db";
import {
  users,
  roles,
  userRoles,
  passwordResetTokens,
  persons,
  students,
  auditLogs,
  domainEvents,
  classes,
  sections,
} from "@schoolmitra/database";
import { eq, and, isNull, isNotNull, desc, sql } from "drizzle-orm";
import {
  encryptData,
  decryptData,
  computeSearchHash,
} from "./encryption";
import { generateRoleTempPassword } from "./tempPassword";
import { withTenant } from "./tenant";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function sanitizeIp(rawIp?: string | null): string {
  if (!rawIp || rawIp === "127.0.0.1" || rawIp === "::1") return "0.0.0.0";
  return rawIp;
}

export interface ProvisionOrLinkStudentInput {
  schoolId: string;
  studentId: string;
  admissionNumber: string;
  dateOfBirth: string | Date;
  studentName?: string | null | undefined;
  primaryMobile?: string | null | undefined;
  performedByUserId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  tx?: any;
}

export interface ProvisionOrLinkStudentResult {
  studentUserId: string | null;
  isNewlyProvisioned: boolean;
  studentCredentials?: {
    admissionNumber: string;
    studentIdentifier: string;
    claimToken: string;
    claimUrl: string;
    temporaryPassword?: string;
    mustChangePassword: true;
  };
}

/**
 * Derives a consistent, tenant-isolated pseudo-email/identifier for minors
 * who do not possess their own external email address.
 */
export function deriveStudentUsername(admissionNumber: string, schoolId: string): string {
  const cleanAdm = admissionNumber.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const schoolShort = schoolId.replace(/-/g, "").slice(0, 8);
  return `student.${cleanAdm}@${schoolShort}.schoolmitra.internal`;
}

/**
 * Finds or provisions a STUDENT user account, binds it to students.userId,
 * generates a 32-byte claim token, emits StudentAccessGrantedEvent, and logs audit.
 */
export async function provisionOrLinkStudent(
  input: ProvisionOrLinkStudentInput,
): Promise<ProvisionOrLinkStudentResult> {
  const {
    schoolId,
    studentId,
    admissionNumber,
    dateOfBirth,
    studentName,
    primaryMobile,
    performedByUserId,
    tx,
  } = input;

  const runLogic = async (executor: any): Promise<ProvisionOrLinkStudentResult> => {
    // 1. Verify student exists in tenant
    const existingStudent = await executor.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    });

    if (!existingStudent) {
      throw new Error(`Student ${studentId} not found in school ${schoolId}`);
    }

    // If student already has userId linked and user exists in this school
    if (existingStudent.userId) {
      const existingUser = await executor.query.users.findFirst({
        where: and(eq(users.id, existingStudent.userId), eq(users.schoolId, schoolId)),
      });
      if (existingUser) {
        return {
          studentUserId: existingUser.id,
          isNewlyProvisioned: false,
        };
      }
    }

    // 2. Derive unique internal identifier for student
    const studentIdentifier = deriveStudentUsername(admissionNumber, schoolId);

    // Look for existing user account by studentIdentifier or admission matching
    let studentUser = await executor.query.users.findFirst({
      where: and(eq(users.schoolId, schoolId), eq(users.email, studentIdentifier)),
    });

    let isNewlyProvisioned = false;
    let studentCredentials: ProvisionOrLinkStudentResult["studentCredentials"] | undefined;

    if (!studentUser) {
      // 3. Cryptographically random 32-byte claim token (valid for 7 days)
      const claimToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(claimToken).digest("hex");
      const tempPassword = generateRoleTempPassword("STUDENT", primaryMobile);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const [createdUser] = await executor
        .insert(users)
        .values({
          schoolId,
          email: studentIdentifier,
          mobileEncrypted: primaryMobile ? encryptData(primaryMobile.trim()) : null,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
          isEmailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!createdUser) {
        throw new Error("Failed to insert student user login credential");
      }

      studentUser = createdUser;
      isNewlyProvisioned = true;

      // Store claim token in passwordResetTokens
      await executor.insert(passwordResetTokens).values({
        userId: createdUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const appBaseUrl = process.env["NEXT_PUBLIC_APP_URL"] || "https://app.schoolmitra.in";
      studentCredentials = {
        admissionNumber,
        studentIdentifier,
        claimToken,
        claimUrl: `${appBaseUrl}/claim-student-account?token=${claimToken}&adm=${encodeURIComponent(admissionNumber)}`,
        temporaryPassword: tempPassword,
        mustChangePassword: true,
      };

      // 4. Update canonical persons row if student is linked
      const nameParts = (studentName || "Student").trim().split(/\s+/);
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Ensure person record is linked with userId
      const existingPerson = await executor.query.persons.findFirst({
        where: and(
          eq(persons.schoolId, schoolId),
          eq(persons.primaryType, "STUDENT"),
          eq(persons.firstNameSearchHash, computeSearchHash(firstName)),
        ),
      });

      if (existingPerson && !existingPerson.userId) {
        await executor
          .update(persons)
          .set({ userId: createdUser.id, updatedAt: new Date() })
          .where(and(eq(persons.id, existingPerson.id), eq(persons.schoolId, schoolId)));
      }
    }

    // 5. Ensure STUDENT system role exists for this school
    let studentRole = await executor.query.roles.findFirst({
      where: and(eq(roles.schoolId, schoolId), eq(roles.name, "STUDENT")),
    });

    if (!studentRole) {
      const [newRole] = await executor
        .insert(roles)
        .values({
          schoolId,
          name: "STUDENT",
          displayName: "Student",
          description: "Student role for student portal and PWA",
          isSystemRole: true,
        })
        .returning();
      studentRole = newRole;
    }

    if (studentRole) {
      const existingRoleAssignment = await executor.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, studentUser.id),
          eq(userRoles.roleId, studentRole.id),
        ),
      });

      if (!existingRoleAssignment) {
        await executor.insert(userRoles).values({
          userId: studentUser.id,
          roleId: studentRole.id,
          schoolId,
        });
      }
    }

    // 6. Authoritative link: update students.userId
    await executor
      .update(students)
      .set({
        userId: studentUser.id,
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)));

    // 7. Audit log (forensic trace)
    if (performedByUserId) {
      await executor.insert(auditLogs).values({
        schoolId,
        userId: performedByUserId,
        userEmail: studentIdentifier,
        userRole: "SYSTEM",
        action: "WRITE",
        tableName: "students",
        recordId: studentId,
        purposeId: "student_access_provisioning",
        ipAddress: sanitizeIp(input.ipAddress),
        userAgent: input.userAgent || "Student Access Engine",
        metadata: {
          action: "PROVISION_STUDENT_ACCESS",
          studentId,
          studentUserId: studentUser.id,
          admissionNumber,
          isNewlyProvisioned,
        },
      });
    }

    // 8. Durable domain event outbox
    await executor.insert(domainEvents).values({
      schoolId,
      aggregateId: studentId,
      eventType: "StudentAccessGrantedEvent",
      payload: {
        studentId,
        studentUserId: studentUser.id,
        admissionNumber,
        schoolId,
      },
      status: "PENDING",
    });

    return {
      studentUserId: studentUser.id,
      isNewlyProvisioned,
      ...(studentCredentials ? { studentCredentials } : {}),
    };
  };

  if (tx) {
    return await runLogic(tx);
  }
  return await withTenant(schoolId, runLogic);
}

// ─── Rate-Limiting for Minor DOB Claim Flow ──────────────────────────────────
const failedClaimAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CLAIM_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

function checkClaimRateLimit(key: string) {
  const record = failedClaimAttempts.get(key);
  if (!record) return;

  const now = Date.now();
  if (now - record.lastAttempt > LOCKOUT_PERIOD_MS) {
    failedClaimAttempts.delete(key);
    return;
  }

  if (record.count >= MAX_CLAIM_ATTEMPTS) {
    const remainingMins = Math.ceil((LOCKOUT_PERIOD_MS - (now - record.lastAttempt)) / 60000);
    throw new Error(
      `Too many failed verification attempts. Account claim is locked for ${remainingMins} minute(s). Please contact your school administrator.`,
    );
  }
}

function recordClaimFailure(key: string) {
  const record = failedClaimAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedClaimAttempts.set(key, record);
}

function clearClaimFailure(key: string) {
  failedClaimAttempts.delete(key);
}

export interface VerifyAndClaimStudentAccountInput {
  schoolId: string;
  admissionNumber: string;
  dateOfBirth: string | Date;
  claimToken: string;
  newPassword: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Minor-Safe DOB Account Claim Flow.
 * Verifies admissionNumber + dateOfBirth match the student record,
 * validates claimToken from passwordResetTokens, and activates user password.
 */
export async function verifyAndClaimStudentAccount(
  input: VerifyAndClaimStudentAccountInput,
): Promise<{ success: boolean; userId: string; message: string }> {
  const { schoolId, admissionNumber, dateOfBirth, claimToken, newPassword } = input;
  const rateLimitKey = `${schoolId}:${admissionNumber.trim().toLowerCase()}`;

  checkClaimRateLimit(rateLimitKey);

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const tokenHash = crypto.createHash("sha256").update(claimToken.trim()).digest("hex");

  return await withTenant(schoolId, async (tenantDb) => {
    // 1. Find student by admissionNumber
    const student = await tenantDb.query.students.findFirst({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.admissionNumber, admissionNumber.trim()),
      ),
    });

    if (!student || !student.userId) {
      recordClaimFailure(rateLimitKey);
      throw new Error("Student account not found or not yet provisioned for access.");
    }

    // 2. DOB Verification
    const expectedDob = new Date(student.dateOfBirth).toISOString().slice(0, 10);
    const providedDob = new Date(dateOfBirth).toISOString().slice(0, 10);

    if (expectedDob !== providedDob) {
      recordClaimFailure(rateLimitKey);
      throw new Error("Date of birth does not match student records.");
    }

    // 3. Verify claim token
    const tokenRecord = await tenantDb.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.userId, student.userId),
        eq(passwordResetTokens.tokenHash, tokenHash),
      ),
    });

    if (!tokenRecord) {
      recordClaimFailure(rateLimitKey);
      throw new Error("Invalid or expired claim token.");
    }

    if (tokenRecord.usedAt) {
      throw new Error("This claim token has already been used. Please log in with your password.");
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      throw new Error("Claim token has expired. Please request a new claim link from school.");
    }

    // 4. Set new password & mark mustChangePassword = false
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await tenantDb
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, student.userId), eq(users.schoolId, schoolId)));

    // 5. Mark token as used
    await tenantDb
      .update(passwordResetTokens)
      .set({
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.id, tokenRecord.id));

    // Clear rate limit
    clearClaimFailure(rateLimitKey);

    const studentUserRecord = await tenantDb.query.users.findFirst({
      where: eq(users.id, student.userId),
    });
    const studentEmail = studentUserRecord?.email || `student.${student.admissionNumber}@schoolmitra.internal`;

    // Audit log
    await tenantDb.insert(auditLogs).values({
      schoolId,
      userId: student.userId,
      userEmail: studentEmail,
      userRole: "STUDENT",
      action: "WRITE",
      tableName: "users",
      recordId: student.userId,
      purposeId: "student_account_claim",
      ipAddress: sanitizeIp(input.ipAddress),
      userAgent: input.userAgent || "Student Claim Page",
      metadata: {
        action: "STUDENT_ACCOUNT_CLAIMED",
        admissionNumber: student.admissionNumber,
      },
    });

    return {
      success: true,
      userId: student.userId,
      message: "Student account claimed and password set successfully.",
    };
  });
}

// ─── Admin Student Access Queue ───────────────────────────────────────────────

export interface StudentAccessQueueItem {
  id: string;
  admissionNumber: string;
  studentName: string;
  className: string;
  sectionName: string;
  userId: string | null;
  accessStatus: "ACTIVE" | "DISABLED" | "UNPROVISIONED";
  lastClaimUrl?: string | null;
  createdAt: string;
}

/**
 * Retrieves the Student Access Queue for admin management.
 */
export async function getStudentAccessQueue(
  schoolId: string,
  options?: {
    search?: string;
    status?: "UNPROVISIONED" | "ACTIVE" | "DISABLED" | "ALL";
    limit?: number;
  },
): Promise<StudentAccessQueueItem[]> {
  const limit = options?.limit ?? 100;
  const statusFilter = options?.status ?? "ALL";

  return await withTenant(schoolId, async (tenantDb) => {
    const [allStudents, allUsers, schoolClasses, schoolSections] = await Promise.all([
      tenantDb.query.students.findMany({
        where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
        orderBy: [desc(students.createdAt)],
        limit,
      }),
      tenantDb.query.users.findMany({
        where: eq(users.schoolId, schoolId),
      }),
      tenantDb.query.classes.findMany({
        where: eq(classes.schoolId, schoolId),
      }),
      tenantDb.query.sections.findMany({
        where: eq(sections.schoolId, schoolId),
      }),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const classMap = new Map(schoolClasses.map((c) => [c.id, c.displayName]));
    const sectionMap = new Map(schoolSections.map((s) => [s.id, s.name]));

    const items: StudentAccessQueueItem[] = [];

    for (const s of allStudents) {
      const sFirstName = decryptData(s.firstNameEncrypted) || "";
      const sLastName = decryptData(s.lastNameEncrypted) || "";
      const studentName = `${sFirstName} ${sLastName}`.trim() || "Student";

      let accessStatus: "ACTIVE" | "DISABLED" | "UNPROVISIONED" = "UNPROVISIONED";
      if (s.userId) {
        const u = userMap.get(s.userId);
        if (u) {
          accessStatus = u.isActive ? "ACTIVE" : "DISABLED";
        }
      }

      if (statusFilter !== "ALL" && accessStatus !== statusFilter) {
        continue;
      }

      if (options?.search) {
        const query = options.search.toLowerCase();
        const matchesName = studentName.toLowerCase().includes(query);
        const matchesAdm = s.admissionNumber.toLowerCase().includes(query);
        if (!matchesName && !matchesAdm) continue;
      }

      items.push({
        id: s.id,
        admissionNumber: s.admissionNumber,
        studentName,
        className: (s.currentClassId && classMap.get(s.currentClassId)) || "Unassigned",
        sectionName: (s.currentSectionId && sectionMap.get(s.currentSectionId)) || "-",
        userId: s.userId,
        accessStatus,
        createdAt: s.createdAt.toISOString(),
      });
    }

    return items;
  });
}

/**
 * Enables student portal access for a student.
 */
export async function enableStudentAccess(
  schoolId: string,
  studentId: string,
  performedByUserId: string,
  ipAddress?: string,
): Promise<{ success: boolean; studentUserId?: string; claimUrl?: string; message: string }> {
  return await withTenant(schoolId, async (tenantDb) => {
    const student = await tenantDb.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    });

    if (!student) {
      throw new Error("Student not found");
    }

    if (!student.userId) {
      const firstName = decryptData(student.firstNameEncrypted) || "";
      const lastName = decryptData(student.lastNameEncrypted) || "";
      const res = await provisionOrLinkStudent({
        schoolId,
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        dateOfBirth: student.dateOfBirth,
        studentName: `${firstName} ${lastName}`.trim(),
        performedByUserId,
        ipAddress,
        tx: tenantDb,
      });

      return {
        success: true,
        ...(res.studentUserId ? { studentUserId: res.studentUserId } : {}),
        ...(res.studentCredentials?.claimUrl ? { claimUrl: res.studentCredentials.claimUrl } : {}),
        message: "Student access provisioned and enabled successfully.",
      };
    }

    // Existing user: activate user account
    await tenantDb
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(users.id, student.userId), eq(users.schoolId, schoolId)));

    if (performedByUserId) {
      const adminUser = await tenantDb.query.users.findFirst({
        where: eq(users.id, performedByUserId),
      });
      await tenantDb.insert(auditLogs).values({
        schoolId,
        userId: performedByUserId,
        userEmail: adminUser?.email || "admin@schoolmitra.internal",
        userRole: "SCHOOL_ADMIN",
        action: "WRITE",
        tableName: "users",
        recordId: student.userId,
        purposeId: "student_access_enabled",
        ipAddress: sanitizeIp(ipAddress),
        userAgent: "Student Access Queue",
        metadata: { action: "ENABLE_STUDENT_ACCESS", studentId },
      });
    }

    return {
      success: true,
      studentUserId: student.userId,
      message: "Student access enabled successfully.",
    };
  });
}

/**
 * Disables student portal access (sets user.isActive = false, never deletes records).
 */
export async function disableStudentAccess(
  schoolId: string,
  studentId: string,
  performedByUserId: string,
  ipAddress?: string,
): Promise<{ success: boolean; message: string }> {
  return await withTenant(schoolId, async (tenantDb) => {
    const student = await tenantDb.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    });

    if (!student || !student.userId) {
      throw new Error("Student account not found or has no linked login account.");
    }

    await tenantDb
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.id, student.userId), eq(users.schoolId, schoolId)));

    if (performedByUserId) {
      const adminUser = await tenantDb.query.users.findFirst({
        where: eq(users.id, performedByUserId),
      });
      await tenantDb.insert(auditLogs).values({
        schoolId,
        userId: performedByUserId,
        userEmail: adminUser?.email || "admin@schoolmitra.internal",
        userRole: "SCHOOL_ADMIN",
        action: "WRITE",
        tableName: "users",
        recordId: student.userId,
        purposeId: "student_access_disabled",
        ipAddress: sanitizeIp(ipAddress),
        userAgent: "Student Access Queue",
        metadata: { action: "DISABLE_STUDENT_ACCESS", studentId },
      });
    }

    return {
      success: true,
      message: "Student access disabled. The student cannot log in until re-enabled.",
    };
  });
}

/**
 * Resends / generates a fresh claim token and URL for a student.
 */
export async function resendStudentClaim(
  schoolId: string,
  studentId: string,
  performedByUserId: string,
  ipAddress?: string,
): Promise<{ success: boolean; claimUrl: string; message: string }> {
  return await withTenant(schoolId, async (tenantDb) => {
    const student = await tenantDb.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    });

    if (!student || !student.userId) {
      throw new Error("Student does not have a provisioned account yet.");
    }

    const claimToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(claimToken).digest("hex");

    await tenantDb.insert(passwordResetTokens).values({
      userId: student.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const appBaseUrl = process.env["NEXT_PUBLIC_APP_URL"] || "https://app.schoolmitra.in";
    const claimUrl = `${appBaseUrl}/claim-student-account?token=${claimToken}&adm=${encodeURIComponent(student.admissionNumber)}`;

    if (performedByUserId) {
      const adminUser = await tenantDb.query.users.findFirst({
        where: eq(users.id, performedByUserId),
      });
      await tenantDb.insert(auditLogs).values({
        schoolId,
        userId: performedByUserId,
        userEmail: adminUser?.email || "admin@schoolmitra.internal",
        userRole: "SCHOOL_ADMIN",
        action: "WRITE",
        tableName: "password_reset_tokens",
        recordId: student.userId,
        purposeId: "student_claim_resend",
        ipAddress: sanitizeIp(ipAddress),
        userAgent: "Student Access Queue",
        metadata: { action: "RESEND_STUDENT_CLAIM", studentId },
      });
    }

    return {
      success: true,
      claimUrl,
      message: "New student account claim link generated successfully.",
    };
  });
}
