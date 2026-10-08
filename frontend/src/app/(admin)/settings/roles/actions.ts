"use server";

import { db } from "@/db";
import {
  users,
  userRoles,
  roles,
  staff,
  designations,
  departments,
  sessions,
  auditLogs,
} from "@/db/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData } from "@/lib/encryption";
import { sendSMSWithStatus } from "@/lib/sms";
import { ROLE_CONFIGS, type UserRole } from "@/lib/roleConfig";
import { generateRandomTempPassword } from "@/lib/tempPassword";
import bcrypt from "bcryptjs";

// ─── Internal Audit Helper ───────────────────────────────────────────────────
async function logRbacAudit(
  ctx: { userId: string; schoolId: string | null; role: string },
  action: "READ" | "WRITE" | "DELETE",
  tableName: string,
  recordId: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.insert(auditLogs).values({
      userId: ctx.userId,
      userEmail: ctx.role === "SUPER_ADMIN" ? "super-admin@schoolmitra.internal" : "[admin-system]",
      userRole: ctx.role,
      schoolId: ctx.schoolId || "00000000-0000-0000-0000-000000000000",
      action,
      tableName,
      recordId,
      purposeId: "rbac_governance",
      ipAddress: "127.0.0.1",
      userAgent: "RBAC Governance Action",
      metadata: metadata || {},
    });
  } catch (err) {
    console.warn("Failed to write RBAC audit log:", err);
  }
}

function safeRevalidate() {
  try {
    revalidatePath("/settings/roles");
    revalidatePath("/settings");
  } catch {}
}

// ─── 1. Fetch Roles & Users List ──────────────────────────────────────────────
export async function getRolesAndUserAccess() {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    // Fetch all roles configured for this school
    const schoolRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        displayName: roles.displayName,
        description: roles.description,
        isSystemRole: roles.isSystemRole,
        createdAt: roles.createdAt,
      })
      .from(roles)
      .where(eq(roles.schoolId, school.id))
      .orderBy(roles.displayName);

    // Fetch user counts per role
    const roleCounts = await db
      .select({
        roleId: userRoles.roleId,
        count: count(userRoles.id),
      })
      .from(userRoles)
      .where(eq(userRoles.schoolId, school.id))
      .groupBy(userRoles.roleId);

    const countMap = new Map<string, number>();
    for (const rc of roleCounts) {
      countMap.set(rc.roleId, Number(rc.count));
    }

    const rolesWithCounts = schoolRoles.map((r) => ({
      ...r,
      userCount: countMap.get(r.id) || 0,
    }));

    // Fetch school users with their assigned roles and staff profile
    const schoolUsers = await db
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        staffFirstNameEncrypted: staff.firstNameEncrypted,
        staffLastNameEncrypted: staff.lastNameEncrypted,
        staffEmployeeCode: staff.employeeCode,
        designationName: designations.name,
        designationMappedRole: designations.mappedRole,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(staff, eq(staff.userId, users.id))
      .leftJoin(designations, eq(staff.designationId, designations.id))
      .leftJoin(departments, eq(staff.departmentId, departments.id))
      .where(eq(users.schoolId, school.id))
      .orderBy(desc(users.createdAt));

    // Fetch assigned user_roles junctions
    const userRoleAssignments = await db
      .select({
        id: userRoles.id,
        userId: userRoles.userId,
        roleId: userRoles.roleId,
        roleName: roles.name,
        roleDisplayName: roles.displayName,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.schoolId, school.id));

    const userRolesMap = new Map<string, Array<{ id: string; roleId: string; name: string; displayName: string }>>();
    for (const ura of userRoleAssignments) {
      const list = userRolesMap.get(ura.userId) || [];
      list.push({
        id: ura.id,
        roleId: ura.roleId,
        name: ura.roleName,
        displayName: ura.roleDisplayName,
      });
      userRolesMap.set(ura.userId, list);
    }

    const usersWithRoles = schoolUsers.map((u) => {
      let staffFirstName: string | null = null;
      let staffLastName: string | null = null;
      if (u.staffFirstNameEncrypted) {
        staffFirstName = decryptData(u.staffFirstNameEncrypted);
      }
      if (u.staffLastNameEncrypted) {
        staffLastName = decryptData(u.staffLastNameEncrypted);
      }

      return {
        id: u.id,
        email: u.email,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        staffFirstName,
        staffLastName,
        staffEmployeeId: u.staffEmployeeCode,
        designationName: u.designationName,
        designationMappedRole: u.designationMappedRole,
        departmentName: u.departmentName,
        assignedRoles: userRolesMap.get(u.id) || [],
      };
    });

    return {
      success: true,
      roles: rolesWithCounts,
      users: usersWithRoles,
      currentUserRole: ctx.role,
      isSuperAdmin: ctx.role === "SUPER_ADMIN",
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to load roles and user access." };
  }
}

// ─── 2. Create Role (SUPER_ADMIN Only) ─────────────────────────────────────────
export async function createRole(input: {
  name: UserRole;
  displayName: string;
  description?: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!input.name || !input.displayName?.trim()) {
      return { success: false, message: "Role name and display name are required." };
    }

    // Check if role already exists for school
    const existing = await db.query.roles.findFirst({
      where: and(eq(roles.schoolId, school.id), eq(roles.name, input.name)),
    });

    if (existing) {
      return { success: false, message: `Role "${input.name}" already exists for this school.` };
    }

    const [newRole] = await db
      .insert(roles)
      .values({
        schoolId: school.id,
        name: input.name,
        displayName: input.displayName.trim(),
        description: input.description?.trim() || null,
        isSystemRole: false,
      })
      .returning();

    if (!newRole) {
      return { success: false, message: "Failed to create role." };
    }

    await logRbacAudit(ctx, "WRITE", "roles", newRole.id, {
      action: "CREATE_ROLE",
      name: input.name,
      displayName: input.displayName,
    });

    safeRevalidate();
    return { success: true, message: "Role created successfully." };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to create role." };
  }
}

// ─── 3. Update Role (SUPER_ADMIN Only) ─────────────────────────────────────────
export async function updateRole(input: {
  roleId: string;
  displayName: string;
  description?: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const existingRole = await db.query.roles.findFirst({
      where: and(eq(roles.id, input.roleId), eq(roles.schoolId, school.id)),
    });

    if (!existingRole) {
      return { success: false, message: "Role not found in this school." };
    }

    if (existingRole.isSystemRole) {
      return { success: false, message: "System roles cannot be renamed or modified." };
    }

    await db
      .update(roles)
      .set({
        displayName: input.displayName.trim(),
        description: input.description?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, existingRole.id));

    await logRbacAudit(ctx, "WRITE", "roles", existingRole.id, {
      action: "UPDATE_ROLE",
      displayName: input.displayName,
    });

    safeRevalidate();
    return { success: true, message: "Role updated successfully." };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to update role." };
  }
}

// ─── 4. Assign User Role (SUPER_ADMIN + SCHOOL_ADMIN) ──────────────────────────
export async function assignUserRole(input: {
  userId: string;
  roleId: string;
  reason?: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    // Validate target user belongs to this school
    const targetUser = await db.query.users.findFirst({
      where: and(eq(users.id, input.userId), eq(users.schoolId, school.id)),
    });
    if (!targetUser) {
      return { success: false, message: "User not found in this school." };
    }

    // Validate target role belongs to this school
    const targetRole = await db.query.roles.findFirst({
      where: and(eq(roles.id, input.roleId), eq(roles.schoolId, school.id)),
    });
    if (!targetRole) {
      return { success: false, message: "Role not found in this school." };
    }

    // Check if already assigned
    const alreadyAssigned = await db.query.userRoles.findFirst({
      where: and(
        eq(userRoles.userId, targetUser.id),
        eq(userRoles.roleId, targetRole.id),
        eq(userRoles.schoolId, school.id),
      ),
    });
    if (alreadyAssigned) {
      return { success: false, message: "User already possesses this role." };
    }

    const [assignment] = await db
      .insert(userRoles)
      .values({
        userId: targetUser.id,
        roleId: targetRole.id,
        schoolId: school.id,
        assignedById: ctx.userId,
      })
      .returning();

    if (!assignment) {
      return { success: false, message: "Failed to assign role." };
    }

    await logRbacAudit(ctx, "WRITE", "user_roles", assignment.id, {
      action: "ASSIGN_ROLE",
      userId: targetUser.id,
      roleName: targetRole.name,
      reason: input.reason || "Administrative assignment",
    });

    safeRevalidate();
    return { success: true, message: `Role "${targetRole.displayName}" assigned to user.` };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to assign role." };
  }
}

// ─── 5. Remove User Role (SUPER_ADMIN + SCHOOL_ADMIN) ──────────────────────────
export async function removeUserRole(input: {
  userId: string;
  roleId: string;
  reason?: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    // Validate target role belongs to this school
    const targetRole = await db.query.roles.findFirst({
      where: and(eq(roles.id, input.roleId), eq(roles.schoolId, school.id)),
    });
    if (!targetRole) {
      return { success: false, message: "Role not found in this school." };
    }

    // Guard invariant: Cannot remove the last active SUPER_ADMIN of a school
    if (targetRole.name === "SUPER_ADMIN") {
      const superAdminCount = await db
        .select({ count: count(userRoles.id) })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .innerJoin(users, eq(userRoles.userId, users.id))
        .where(
          and(
            eq(roles.schoolId, school.id),
            eq(roles.name, "SUPER_ADMIN"),
            eq(users.isActive, true),
          ),
        );

      const activeSuperAdmins = Number(superAdminCount[0]?.count || 0);
      if (activeSuperAdmins <= 1) {
        return {
          success: false,
          message: "Guard Violation: Cannot remove the last active SUPER_ADMIN of this school.",
        };
      }
    }

    const [deleted] = await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, input.userId),
          eq(userRoles.roleId, input.roleId),
          eq(userRoles.schoolId, school.id),
        ),
      )
      .returning();

    if (!deleted) {
      return { success: false, message: "Role assignment not found for this user." };
    }

    await logRbacAudit(ctx, "DELETE", "user_roles", deleted.id, {
      action: "REMOVE_ROLE",
      userId: input.userId,
      roleName: targetRole.name,
      reason: input.reason || "Administrative removal",
    });

    safeRevalidate();
    return { success: true, message: `Role "${targetRole.displayName}" revoked from user.` };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to remove role." };
  }
}

// ─── 6. Toggle User Access (SUPER_ADMIN + SCHOOL_ADMIN) ────────────────────────
export async function toggleUserAccess(input: {
  userId: string;
  isActive: boolean;
  reason: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const trimmedReason = input.reason?.trim();
    if (!trimmedReason) {
      return { success: false, message: "A mandatory audit reason is required to modify user access." };
    }

    const targetUser = await db.query.users.findFirst({
      where: and(eq(users.id, input.userId), eq(users.schoolId, school.id)),
    });

    if (!targetUser) {
      return { success: false, message: "User not found in this school." };
    }

    // Invariant: If deactivating, ensure we are not deactivating the last active SUPER_ADMIN
    if (!input.isActive) {
      const isSuperAdmin = await db
        .select({ id: userRoles.id })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            eq(userRoles.userId, targetUser.id),
            eq(roles.schoolId, school.id),
            eq(roles.name, "SUPER_ADMIN"),
          ),
        );

      if (isSuperAdmin.length > 0) {
        const activeSuperAdmins = await db
          .select({ count: count(userRoles.id) })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .innerJoin(users, eq(userRoles.userId, users.id))
          .where(
            and(
              eq(roles.schoolId, school.id),
              eq(roles.name, "SUPER_ADMIN"),
              eq(users.isActive, true),
            ),
          );

        if (Number(activeSuperAdmins[0]?.count || 0) <= 1) {
          return {
            success: false,
            message: "Guard Violation: Cannot deactivate the last active SUPER_ADMIN of this school.",
          };
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));

      // If deactivated, revoke all active sessions immediately
      if (!input.isActive) {
        await tx.delete(sessions).where(eq(sessions.userId, targetUser.id));
      }
    });

    await logRbacAudit(ctx, "WRITE", "users", targetUser.id, {
      action: input.isActive ? "ACTIVATE_USER_ACCESS" : "DEACTIVATE_USER_ACCESS",
      targetEmail: targetUser.email,
      reason: trimmedReason,
    });

    safeRevalidate();
    return {
      success: true,
      message: `User account ${input.isActive ? "activated" : "deactivated"} successfully.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to toggle user access." };
  }
}

// ─── 7. Reset Staff Credential Action (SUPER_ADMIN + SCHOOL_ADMIN) ─────────────
export async function resetStaffCredentialAction(input: {
  userId: string;
  reason: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const trimmedReason = input.reason?.trim();
    if (!trimmedReason) {
      return { success: false, message: "A mandatory audit reason is required to reset credentials." };
    }

    const targetUser = await db.query.users.findFirst({
      where: and(eq(users.id, input.userId), eq(users.schoolId, school.id)),
    });

    if (!targetUser) {
      return { success: false, message: "User not found in this school." };
    }

    // Resolve staff record if available
    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.userId, targetUser.id), eq(staff.schoolId, school.id)),
      with: {
        designation: true,
      },
    });

    // Resolve primary role for dashboard landing URL
    const userRoleRows = await db
      .select({ name: roles.name, displayName: roles.displayName })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, targetUser.id), eq(userRoles.schoolId, school.id)));

    let primaryRole: UserRole = "SCHOOL_ADMIN";
    let roleDisplayName = "Staff Member";

    if (staffRecord?.designation?.mappedRole) {
      primaryRole = staffRecord.designation.mappedRole as UserRole;
      roleDisplayName = staffRecord.designation.name;
    } else if (userRoleRows.length > 0 && userRoleRows[0]) {
      primaryRole = userRoleRows[0].name as UserRole;
      roleDisplayName = userRoleRows[0].displayName;
    }

    const defaultDashboard =
      ROLE_CONFIGS[primaryRole]?.defaultDashboard || "/dashboard";

    // Generate random 8-char temp password (DECIDE-17)
    const tempPassword = generateRandomTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));

      // Revoke existing sessions so old credentials cannot continue
      await tx.delete(sessions).where(eq(sessions.userId, targetUser.id));
    });

    // Decrypt mobile number if available
    let phone = "";
    if (staffRecord?.mobileEncrypted) {
      phone = decryptData(staffRecord.mobileEncrypted) || "";
    } else if (targetUser.mobileEncrypted) {
      phone = decryptData(targetUser.mobileEncrypted) || "";
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const smsMessage = `Welcome to ${school.name}! Your credentials have been reset. Role: ${roleDisplayName}. Login: ${targetUser.email} / Temp password: ${tempPassword}. Dashboard: ${defaultDashboard}. You must change your password on first login.`;

    let smsDelivered = false;
    let smsWarning = "SMS not sent: phone number not found.";
    if (cleanPhone.length === 10) {
      const smsRes = await sendSMSWithStatus(cleanPhone, smsMessage);
      smsDelivered = smsRes.delivered;
      if (!smsRes.delivered) {
        smsWarning = smsRes.error || (smsRes.unconfigured ? "SMS provider unconfigured" : "Failed to deliver SMS");
      }
    }

    await logRbacAudit(ctx, "WRITE", "users", targetUser.id, {
      action: "RESET_STAFF_CREDENTIALS",
      targetEmail: targetUser.email,
      reason: trimmedReason,
      smsDelivered,
    });

    safeRevalidate();

    if (!smsDelivered) {
      return {
        success: true,
        warning: `SMS not delivered (${smsWarning}). Please provide credentials manually.`,
        credentials: {
          email: targetUser.email,
          tempPassword,
          roleDisplayName,
          dashboardUrl: defaultDashboard,
        },
      };
    }

    return {
      success: true,
      message: `Credentials reset successfully. SMS delivered to ${cleanPhone}.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reset credentials." };
  }
}
