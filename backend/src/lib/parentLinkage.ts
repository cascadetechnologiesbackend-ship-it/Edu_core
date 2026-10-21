/**
 * S13+ Parent-Student Linkage Engine & Repair Utilities
 *
 * Provides authoritative parent user matching, account provisioning,
 * and linkage to students. Guarantees strict schoolId scoping across
 * all operations to prevent cross-tenant account contamination (Defect D4).
 */

import { db } from "@/db";
import {
  users,
  roles,
  userRoles,
  passwordResetTokens,
  persons,
  students,
  studentFamilyMembers,
  auditLogs,
  classes,
  sections,
} from "@schoolmitra/database";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  encryptData,
  decryptData,
  computeSearchHash,
} from "./encryption";
import { generateRoleTempPassword } from "./tempPassword";
import { withTenant } from "./tenant";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface ProvisionOrLinkParentInput {
  schoolId: string;
  studentId: string;
  primaryEmail?: string | null;
  primaryMobile?: string | null;
  guardianName?: string | null;
  performedByUserId: string;
  tx?: any;
}

export interface ProvisionOrLinkParentResult {
  parentUserId: string | null;
  isNewlyProvisioned: boolean;
  parentCredentials?: {
    email: string;
    claimToken: string;
    claimUrl: string;
    temporaryPassword?: string;
    mustChangePassword: true;
    mobile?: string | null;
  };
}

/**
 * Shared helper to find or provision a parent user account and link it
 * to a student profile. Used by:
 * - StudentLifecycleEngine.enrollApplicant (admission wizard enrollment)
 * - Direct admin student creation in Students module
 * - Bulk student import
 * - Admin Parent Linkage repair queue
 */
export async function provisionOrLinkParent(
  input: ProvisionOrLinkParentInput,
): Promise<ProvisionOrLinkParentResult> {
  const {
    schoolId,
    studentId,
    primaryEmail,
    primaryMobile,
    guardianName,
    performedByUserId,
    tx,
  } = input;

  const runLogic = async (executor: any) => {
    let parentUserId: string | null = null;
    let isNewlyProvisioned = false;
    let parentCredentials: ProvisionOrLinkParentResult["parentCredentials"] | undefined;

    if (primaryEmail && primaryEmail.trim()) {
      const emailNormalized = primaryEmail.trim().toLowerCase();

      // Defect D4 fix: MUST scope by schoolId to avoid linking parent from another tenant
      let parentUser = await executor.query.users.findFirst({
        where: and(
          eq(users.schoolId, schoolId),
          eq(users.email, emailNormalized),
        ),
      });

      if (!parentUser) {
        // Cryptographically random 32-byte claim token and role-based initial credential
        const claimToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(claimToken).digest("hex");
        const tempPassword = generateRoleTempPassword("PARENT", primaryMobile);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        const [createdUser] = await executor
          .insert(users)
          .values({
            schoolId,
            email: emailNormalized,
            mobileEncrypted: primaryMobile
              ? encryptData(primaryMobile.trim())
              : null,
            passwordHash,
            mustChangePassword: true,
            isActive: true,
            isEmailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (createdUser) {
          isNewlyProvisioned = true;

          // Store claim token in password_reset_tokens (7-day validity)
          await executor.insert(passwordResetTokens).values({
            userId: createdUser.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });

          const appBaseUrl =
            process.env["NEXT_PUBLIC_APP_URL"] || "https://app.schoolmitra.in";
          parentUser = createdUser;
          parentCredentials = {
            email: emailNormalized,
            claimToken,
            claimUrl: `${appBaseUrl}/claim-account?token=${claimToken}`,
            temporaryPassword: tempPassword,
            mustChangePassword: true,
            mobile: primaryMobile ? primaryMobile.trim() : null,
          };

          // Canonical Person row for parent
          const parentNameDecrypted = guardianName?.trim() || "Parent Guardian";
          const pNameParts = parentNameDecrypted.split(/\s+/);
          const pFirstName = pNameParts[0] || "Parent";
          const pLastName = pNameParts.slice(1).join(" ") || "Guardian";

          await executor.insert(persons).values({
            schoolId,
            userId: createdUser.id,
            primaryType: "PARENT",
            firstNameEncrypted: encryptData(pFirstName),
            lastNameEncrypted: encryptData(pLastName),
            firstNameSearchHash: computeSearchHash(pFirstName),
            lastNameSearchHash: computeSearchHash(pLastName),
            gender: "OTHER",
            primaryEmailEncrypted: encryptData(emailNormalized),
            primaryMobileEncrypted: primaryMobile
              ? encryptData(primaryMobile.trim())
              : null,
            createdBy: performedByUserId,
            isActive: true,
          });
        }
      }

      if (parentUser) {
        parentUserId = parentUser.id;

        // Ensure PARENT role exists and is assigned
        let parentRole = await executor.query.roles.findFirst({
          where: and(eq(roles.schoolId, schoolId), eq(roles.name, "PARENT")),
        });
        if (!parentRole) {
          const [createdRole] = await executor
            .insert(roles)
            .values({
              schoolId,
              name: "PARENT",
              displayName: "Parent / Guardian",
              isSystemRole: true,
            })
            .returning();
          parentRole = createdRole;
        }

        if (parentRole) {
          const existingRole = await executor.query.userRoles.findFirst({
            where: and(
              eq(userRoles.userId, parentUser.id),
              eq(userRoles.roleId, parentRole.id),
            ),
          });
          if (!existingRole) {
            await executor.insert(userRoles).values({
              userId: parentUser.id,
              roleId: parentRole.id,
              schoolId,
            });
          }
        }

        // Link student to primaryParentUserId
        if (studentId) {
          await executor
            .update(students)
            .set({
              primaryParentUserId: parentUserId,
              updatedAt: new Date(),
            })
            .where(
              and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
            );

          // Also update any primary family member row
          await executor
            .update(studentFamilyMembers)
            .set({
              userId: parentUserId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(studentFamilyMembers.studentId, studentId),
                eq(studentFamilyMembers.schoolId, schoolId),
                eq(studentFamilyMembers.isPrimaryContact, true),
              ),
            );
        }
      }
    }

    return {
      parentUserId,
      isNewlyProvisioned,
      parentCredentials,
    };
  };

  if (tx) {
    return await runLogic(tx);
  }
  return await withTenant(schoolId, runLogic);
}

export interface UnlinkedStudentItem {
  id: string;
  admissionNumber: string;
  studentName: string;
  className: string;
  sectionName: string;
  guardianName: string | null;
  guardianMobile: string | null;
  guardianEmail: string | null;
  guardianRelation: string | null;
  createdAt: string;
}

/**
 * Lists active students in the school who currently have no primaryParentUserId.
 */
export async function getUnlinkedStudents(
  schoolId: string,
  limit: number = 50,
): Promise<UnlinkedStudentItem[]> {
  return await withTenant(schoolId, async (tenantDb) => {
    const [unlinkedRows, schoolClasses, schoolSections] = await Promise.all([
      tenantDb.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.isActive, true),
          isNull(students.primaryParentUserId),
        ),
        orderBy: [desc(students.createdAt)],
        limit,
        with: {
          familyMembers: true,
        },
      }),
      tenantDb.query.classes.findMany({
        where: eq(classes.schoolId, schoolId),
      }),
      tenantDb.query.sections.findMany({
        where: eq(sections.schoolId, schoolId),
      }),
    ]);

    const classMap = new Map(schoolClasses.map((c) => [c.id, c.displayName || c.name]));
    const sectionMap = new Map(schoolSections.map((s) => [s.id, s.displayName || s.name]));

    return unlinkedRows.map((s) => {
      const sFirstName = decryptData(s.firstNameEncrypted) || "";
      const sLastName = decryptData(s.lastNameEncrypted) || "";
      const studentName = `${sFirstName} ${sLastName}`.trim() || "Student";

      // Primary or first guardian
      const primaryGuardian =
        s.familyMembers.find((f) => f.isPrimaryContact) || s.familyMembers[0];

      let guardianName: string | null = null;
      let guardianMobile: string | null = null;
      let guardianEmail: string | null = null;
      let guardianRelation: string | null = null;

      if (primaryGuardian) {
        guardianName = decryptData(primaryGuardian.nameEncrypted);
        guardianMobile = primaryGuardian.mobileEncrypted
          ? decryptData(primaryGuardian.mobileEncrypted)
          : null;
        guardianEmail = primaryGuardian.emailEncrypted
          ? decryptData(primaryGuardian.emailEncrypted)
          : null;
        guardianRelation = primaryGuardian.relation;
      }

      return {
        id: s.id,
        admissionNumber: s.admissionNumber,
        studentName,
        className: (s.currentClassId && classMap.get(s.currentClassId)) || "Unassigned",
        sectionName: (s.currentSectionId && sectionMap.get(s.currentSectionId)) || "-",
        guardianName,
        guardianMobile,
        guardianEmail,
        guardianRelation,
        createdAt: s.createdAt.toISOString(),
      };
    });
  });
}

export interface ParentCandidate {
  userId: string;
  email: string;
  name: string;
  mobile: string | null;
  matchReason: string;
}

/**
 * Searches users within the school to find candidates for a given student's guardian.
 */
export async function findParentCandidates(
  schoolId: string,
  studentId: string,
): Promise<ParentCandidate[]> {
  return await withTenant(schoolId, async (tenantDb) => {
    // 1. Get student's family members
    const families = await tenantDb.query.studentFamilyMembers.findMany({
      where: and(
        eq(studentFamilyMembers.schoolId, schoolId),
        eq(studentFamilyMembers.studentId, studentId),
      ),
    });

    const candidates: ParentCandidate[] = [];
    const candidateIds = new Set<string>();

    for (const fam of families) {
      const famEmail = fam.emailEncrypted ? decryptData(fam.emailEncrypted) : null;
      const famMobile = fam.mobileEncrypted ? decryptData(fam.mobileEncrypted) : null;

      if (famEmail) {
        const emailNormalized = famEmail.trim().toLowerCase();
        const matchedUsers = await tenantDb.query.users.findMany({
          where: and(
            eq(users.schoolId, schoolId),
            eq(users.email, emailNormalized),
          ),
        });

        for (const u of matchedUsers) {
          if (!candidateIds.has(u.id)) {
            candidateIds.add(u.id);
            const uMobile = u.mobileEncrypted ? decryptData(u.mobileEncrypted) : null;
            candidates.push({
              userId: u.id,
              email: u.email,
              name: decryptData(fam.nameEncrypted) || "Parent",
              mobile: uMobile || famMobile,
              matchReason: `Exact email match (${emailNormalized})`,
            });
          }
        }
      }
    }

    return candidates;
  });
}

/**
 * Explicitly links an existing parent user to a student.
 * Sets students.primaryParentUserId, updates studentFamilyMembers,
 * ensures PARENT role, and writes an audit log row.
 */
export async function linkStudentToParentUser(input: {
  schoolId: string;
  studentId: string;
  parentUserId: string;
  performedByUserId: string;
  clientIp?: string;
  tx?: any;
}): Promise<{ success: boolean; message?: string }> {
  const { schoolId, studentId, parentUserId, performedByUserId, clientIp = "0.0.0.0", tx } = input;

  const runLogic = async (executor: any) => {
    // 1. Verify parent user belongs to this school
    const targetUser = await executor.query.users.findFirst({
      where: and(
        eq(users.id, parentUserId),
        eq(users.schoolId, schoolId),
      ),
    });

    if (!targetUser) {
      throw new Error("Parent user not found in this school.");
    }

    // 2. Verify student belongs to this school
    const targetStudent = await executor.query.students.findFirst({
      where: and(
        eq(students.id, studentId),
        eq(students.schoolId, schoolId),
      ),
    });

    if (!targetStudent) {
      throw new Error("Student not found in this school.");
    }

    // 3. Ensure PARENT role
    let parentRole = await executor.query.roles.findFirst({
      where: and(eq(roles.schoolId, schoolId), eq(roles.name, "PARENT")),
    });
    if (!parentRole) {
      const [createdRole] = await executor
        .insert(roles)
        .values({
          schoolId,
          name: "PARENT",
          displayName: "Parent / Guardian",
          isSystemRole: true,
        })
        .returning();
      parentRole = createdRole;
    }

    if (parentRole) {
      const existingRole = await executor.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, targetUser.id),
          eq(userRoles.roleId, parentRole.id),
        ),
      });
      if (!existingRole) {
        await executor.insert(userRoles).values({
          userId: targetUser.id,
          roleId: parentRole.id,
          schoolId,
        });
      }
    }

    // 4. Update student
    await executor
      .update(students)
      .set({
        primaryParentUserId: parentUserId,
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)));

    // 5. Update family members
    await executor
      .update(studentFamilyMembers)
      .set({
        userId: parentUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(studentFamilyMembers.studentId, studentId),
          eq(studentFamilyMembers.schoolId, schoolId),
        ),
      );

    // 6. Write audit log
    await executor.insert(auditLogs).values({
      schoolId,
      userId: performedByUserId,
      userEmail: targetUser.email,
      userRole: "SCHOOL_ADMIN",
      action: "WRITE",
      tableName: "students",
      recordId: studentId,
      ipAddress: clientIp,
      userAgent: "Admin Parent Linkage Repair",
      metadata: {
        event: "LINK_PARENT",
        parentUserId,
        targetEmail: targetUser.email,
      },
    });

    return { success: true };
  };

  if (tx) {
    return await runLogic(tx);
  }
  return await withTenant(schoolId, runLogic);
}
