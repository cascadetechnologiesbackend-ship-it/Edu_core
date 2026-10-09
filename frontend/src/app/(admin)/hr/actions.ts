"use server";

import { db } from "@/db";
import {
  staff,
  salaryTemplates,
  staffDocuments,
  staffLoans,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  salaryComponents,
  payrollRuns,
  payslips,
  auditLogs,
  users,
  userRoles,
  roles,
  academicYears,
  staffAttendance,
  designations,
  departments,
  classSubjects,
  sectionSubjectTeachers,
  timetablePeriods,
  sections,
  persons,
} from "@/db/schema";
import { eq, and, gte, lte, sql, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { encryptData, decryptData, computeSearchHash } from "@/lib/encryption";
import { z } from "zod";
import { runPayrollCalculations } from "@/lib/payrollEngine";
import bcrypt from "bcryptjs";
import { sendSMS, sendSMSWithStatus } from "@/lib/sms";
import { computeSalaryBreakdown } from "@/lib/salaryCalculator";
import { ROLE_CONFIGS, type UserRole } from "@/lib/roleConfig";
import { generateRandomTempPassword } from "@/lib/tempPassword";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

// ─── Internal Audit Helper ───────────────────────────────────────────────────
async function logHrAudit(
  ctx: { userId: string; schoolId: string | null; role: string },
  action: "READ" | "WRITE" | "DELETE",
  tableName: string,
  recordId: string,
  metadata?: any,
) {
  try {
    await db.insert(auditLogs).values({
      userId: ctx.userId,
      userEmail: "[audit-system]",
      userRole: ctx.role as any,
      schoolId: ctx.schoolId || "00000000-0000-0000-0000-000000000000",
      action,
      tableName,
      recordId,
      purposeId: "hr_records",
      ipAddress: "127.0.0.1",
      userAgent: "HR Phase 1 Server Action",
      metadata: metadata || {},
    });
  } catch (err) {
    console.error("Failed to log HR audit event:", err);
  }
}

// ─── Staff PII Reveal Action (DPDP Restricted & Tenant-Scoped) ───────────────
export async function revealStaffPii(
  staffId: string,
  field: "pan" | "bank" | "all" | string,
) {
  try {
    const ctx = await requireAuth([
      "HR_MANAGER",
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);

    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
    });

    if (!staffRecord)
      return { success: false, message: "Staff not found or access denied." };

    let decrypted = "";
    let data: any = undefined;

    if (field === "pan") {
      decrypted = decryptData(staffRecord.panEncrypted) ?? "—";
    } else if (field === "bank") {
      const acc = decryptData(staffRecord.bankAccountEncrypted) ?? "—";
      const ifsc = decryptData(staffRecord.bankIfscEncrypted) ?? "—";
      const bank = decryptData(staffRecord.bankNameEncrypted) ?? "—";
      decrypted = `${bank} | A/C: ${acc} | IFSC: ${ifsc}`;
    } else {
      const pan = decryptData(staffRecord.panEncrypted) ?? "—";
      const bankName = decryptData(staffRecord.bankNameEncrypted) ?? "—";
      const bankAccount = decryptData(staffRecord.bankAccountEncrypted) ?? "—";
      const bankIfsc = decryptData(staffRecord.bankIfscEncrypted) ?? "—";
      data = { pan, bankName, bankAccount, bankIfsc };
      decrypted = `PAN: ${pan} | Bank: ${bankName}`;
    }

    // Write to DPDP Audit Log without decrypted PII
    await logHrAudit(ctx, "READ", "staff", staffId, { revealedField: field });

    return { success: true, decrypted, data };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── MASTER DATA: Departments Management ─────────────────────────────────────
export async function getDepartments() {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);

    const depts = await db.query.departments.findMany({
      where: eq(departments.schoolId, school.id),
      with: {
        hod: true,
        designations: true,
        staff: true,
      },
      orderBy: [asc(departments.name)],
    });

    return {
      success: true,
      departments: depts.map((d) => ({
        id: d.id,
        name: d.name,
        hodUserId: d.hodUserId,
        hodEmail: d.hod?.email || null,
        isActive: d.isActive,
        staffCount: d.staff.filter((s) => s.isActive).length,
        totalStaffCount: d.staff.length,
        designationsCount: d.designations.filter((des) => des.isActive).length,
        createdAt: d.createdAt,
      })),
    };
  } catch (error: any) {
    return { success: false, message: error.message, departments: [] };
  }
}

export async function createDepartment(
  input: { name: string; hodUserId?: string } | string,
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const payload = typeof input === "string" ? { name: input } : input;
    const name = payload.name?.trim();
    if (!name || name.length < 2) {
      return { success: false, message: "Department name must be at least 2 characters." };
    }

    const existing = await db.query.departments.findFirst({
      where: and(
        eq(departments.schoolId, school.id),
        sql`LOWER(${departments.name}) = LOWER(${name})`,
      ),
    });

    if (existing) {
      return { success: false, message: `Department "${name}" already exists in this school.` };
    }

    let hodId: string | null = null;
    if (payload.hodUserId) {
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, payload.hodUserId), eq(users.schoolId, school.id)),
      });
      if (!user) {
        return { success: false, message: "Selected HOD user does not belong to this school." };
      }
      hodId = user.id;
    }

    const [dept] = await db
      .insert(departments)
      .values({
        schoolId: school.id,
        name,
        hodUserId: hodId,
        isActive: true,
      })
      .returning();

    if (!dept) {
      return { success: false, message: "Failed to create department record." };
    }

    await logHrAudit(ctx, "WRITE", "departments", dept.id, { action: "CREATE_DEPARTMENT", name });
    safeRevalidate("/hr");
    return { success: true, department: dept };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateDepartment(
  departmentId: string,
  input: { name?: string; hodUserId?: string | null; isActive?: boolean } | string,
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const payload = typeof input === "string" ? { name: input } : input;

    const dept = await db.query.departments.findFirst({
      where: and(eq(departments.id, departmentId), eq(departments.schoolId, school.id)),
    });

    if (!dept) {
      return { success: false, message: "Department not found or unauthorized." };
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name || name.length < 2) {
        return { success: false, message: "Department name must be at least 2 characters." };
      }

      const duplicate = await db.query.departments.findFirst({
        where: and(
          eq(departments.schoolId, school.id),
          sql`LOWER(${departments.name}) = LOWER(${name})`,
          sql`${departments.id} != ${departmentId}`,
        ),
      });

      if (duplicate) {
        return { success: false, message: `Another department with name "${name}" already exists.` };
      }
      updates.name = name;
    }

    if (payload.hodUserId !== undefined) {
      if (payload.hodUserId === null || payload.hodUserId === "") {
        updates.hodUserId = null;
      } else {
        const user = await db.query.users.findFirst({
          where: and(eq(users.id, payload.hodUserId), eq(users.schoolId, school.id)),
        });
        if (!user) {
          return { success: false, message: "Selected HOD user does not belong to this school." };
        }
        updates.hodUserId = user.id;
      }
    }

    if (payload.isActive !== undefined) {
      updates.isActive = Boolean(payload.isActive);
    }

    const [updated] = await db
      .update(departments)
      .set(updates)
      .where(and(eq(departments.id, departmentId), eq(departments.schoolId, school.id)))
      .returning();

    await logHrAudit(ctx, "WRITE", "departments", departmentId, { action: "UPDATE_DEPARTMENT", updates });
    safeRevalidate("/hr");
    return { success: true, department: updated };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function archiveDepartment(departmentId: string, isActive?: boolean) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const dept = await db.query.departments.findFirst({
      where: and(eq(departments.id, departmentId), eq(departments.schoolId, school.id)),
    });

    if (!dept) {
      return { success: false, message: "Department not found or unauthorized." };
    }

    const nextActive = isActive !== undefined ? isActive : !dept.isActive;

    await db
      .update(departments)
      .set({ isActive: nextActive, updatedAt: new Date() })
      .where(and(eq(departments.id, departmentId), eq(departments.schoolId, school.id)));

    await logHrAudit(ctx, "WRITE", "departments", departmentId, { action: "ARCHIVE_DEPARTMENT" });
    safeRevalidate("/hr");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function deleteDepartment(departmentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const dept = await db.query.departments.findFirst({
      where: and(eq(departments.id, departmentId), eq(departments.schoolId, school.id)),
      with: {
        staff: true,
        designations: true,
      },
    });

    if (!dept) {
      return { success: false, message: "Department not found or unauthorized." };
    }

    if (dept.staff.length > 0 || dept.designations.length > 0) {
      return {
        success: false,
        message: `Cannot delete department "${dept.name}" because it is referenced by ${dept.staff.length} staff member(s) and ${dept.designations.length} designation(s). Please archive it instead.`,
      };
    }

    await db
      .delete(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.schoolId, school.id)));

    await logHrAudit(ctx, "DELETE", "departments", departmentId, { action: "DELETE_DEPARTMENT" });
    safeRevalidate("/hr");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── MASTER DATA: Designations Management ────────────────────────────────────
export async function getDesignations(departmentId?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);

    const conditions = [eq(designations.schoolId, school.id)];
    if (departmentId) {
      conditions.push(eq(designations.departmentId, departmentId));
    }

    const desigs = await db.query.designations.findMany({
      where: and(...conditions),
      with: {
        department: true,
        staff: true,
      },
      orderBy: [asc(designations.name)],
    });

    return {
      success: true,
      designations: desigs.map((d) => ({
        id: d.id,
        name: d.name,
        departmentId: d.departmentId,
        departmentName: d.department?.name || "—",
        mappedRole: d.mappedRole,
        isTeaching: d.isTeaching,
        isActive: d.isActive,
        staffCount: d.staff.filter((s) => s.isActive).length,
        totalStaffCount: d.staff.length,
        createdAt: d.createdAt,
      })),
    };
  } catch (error: any) {
    return { success: false, message: error.message, designations: [] };
  }
}

export async function createDesignation(
  input:
    | {
        name: string;
        departmentId?: string;
        isTeaching?: boolean;
        mappedRole?: string;
      }
    | string,
  departmentId?: string,
  isTeaching?: boolean,
  mappedRole?: string,
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const payload =
      typeof input === "string"
        ? {
            name: input,
            departmentId: departmentId || undefined,
            isTeaching: Boolean(isTeaching),
            mappedRole: mappedRole || undefined,
          }
        : input;

    const name = payload.name?.trim();
    if (!name || name.length < 2) {
      return { success: false, message: "Designation name must be at least 2 characters." };
    }

    let targetDeptId = payload.departmentId;
    if (!targetDeptId) {
      const defaultDept = await db.query.departments.findFirst({
        where: and(eq(departments.schoolId, school.id), eq(departments.isActive, true)),
      });
      if (!defaultDept) {
        return {
          success: false,
          message:
            "A department is required to create a designation. Please create a department first.",
        };
      }
      targetDeptId = defaultDept.id;
    } else {
      const dept = await db.query.departments.findFirst({
        where: and(eq(departments.id, targetDeptId), eq(departments.schoolId, school.id)),
      });
      if (!dept) {
        return { success: false, message: "Specified department does not belong to this school." };
      }
    }

    const existing = await db.query.designations.findFirst({
      where: and(
        eq(designations.schoolId, school.id),
        sql`LOWER(${designations.name}) = LOWER(${name})`,
      ),
    });

    if (existing) {
      return { success: false, message: `Designation "${name}" already exists in this school.` };
    }

    const finalMappedRole = payload.isTeaching
      ? "TEACHER"
      : payload.mappedRole || null;

    const [desig] = await db
      .insert(designations)
      .values({
        schoolId: school.id,
        departmentId: targetDeptId,
        name,
        mappedRole: finalMappedRole,
        isTeaching: Boolean(payload.isTeaching),
        isActive: true,
      })
      .returning();

    if (!desig) {
      return { success: false, message: "Failed to create designation record." };
    }

    await logHrAudit(ctx, "WRITE", "designations", desig.id, {
      action: "CREATE_DESIGNATION",
      name,
      departmentId: targetDeptId,
      isTeaching: payload.isTeaching,
      mappedRole: finalMappedRole,
    });
    safeRevalidate("/hr");
    return { success: true, designation: desig };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateDesignation(
  designationId: string,
  input: {
    name?: string | undefined;
    departmentId?: string | undefined;
    isTeaching?: boolean | undefined;
    mappedRole?: string | undefined;
    isActive?: boolean | undefined;
  },
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const desig = await db.query.designations.findFirst({
      where: and(eq(designations.id, designationId), eq(designations.schoolId, school.id)),
    });

    if (!desig) {
      return { success: false, message: "Designation not found or unauthorized." };
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name || name.length < 2) {
        return { success: false, message: "Designation name must be at least 2 characters." };
      }

      const duplicate = await db.query.designations.findFirst({
        where: and(
          eq(designations.schoolId, school.id),
          sql`LOWER(${designations.name}) = LOWER(${name})`,
          sql`${designations.id} != ${designationId}`,
        ),
      });

      if (duplicate) {
        return { success: false, message: `Another designation with name "${name}" already exists.` };
      }
      updates.name = name;
    }

    if (input.departmentId !== undefined) {
      const dept = await db.query.departments.findFirst({
        where: and(eq(departments.id, input.departmentId), eq(departments.schoolId, school.id)),
      });
      if (!dept) {
        return { success: false, message: "Selected department does not belong to this school." };
      }
      updates.departmentId = input.departmentId;
    }

    if (input.isTeaching !== undefined) {
      updates.isTeaching = Boolean(input.isTeaching);
      if (updates.isTeaching) {
        updates.mappedRole = "TEACHER";
      }
    }

    if (input.mappedRole !== undefined && !updates.isTeaching && !desig.isTeaching) {
      updates.mappedRole = input.mappedRole;
    }

    if (input.isActive !== undefined) {
      updates.isActive = Boolean(input.isActive);
    }

    const [updated] = await db
      .update(designations)
      .set(updates)
      .where(and(eq(designations.id, designationId), eq(designations.schoolId, school.id)))
      .returning();

    await logHrAudit(ctx, "WRITE", "designations", designationId, { action: "UPDATE_DESIGNATION", updates });
    safeRevalidate("/hr");
    return { success: true, designation: updated };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function archiveDesignation(designationId: string, isActive?: boolean) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const desig = await db.query.designations.findFirst({
      where: and(eq(designations.id, designationId), eq(designations.schoolId, school.id)),
    });

    if (!desig) {
      return { success: false, message: "Designation not found or unauthorized." };
    }

    const nextActive = isActive !== undefined ? isActive : !desig.isActive;

    await db
      .update(designations)
      .set({ isActive: nextActive, updatedAt: new Date() })
      .where(and(eq(designations.id, designationId), eq(designations.schoolId, school.id)));

    await logHrAudit(ctx, "WRITE", "designations", designationId, { action: "ARCHIVE_DESIGNATION", isActive: nextActive });
    safeRevalidate("/hr");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function deleteDesignation(designationId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const desig = await db.query.designations.findFirst({
      where: and(eq(designations.id, designationId), eq(designations.schoolId, school.id)),
      with: { staff: true },
    });

    if (!desig) {
      return { success: false, message: "Designation not found or unauthorized." };
    }

    if (desig.staff.length > 0) {
      return {
        success: false,
        message: `Cannot delete designation "${desig.name}" because it is currently assigned to ${desig.staff.length} staff member(s). Please archive it instead.`,
      };
    }

    await db
      .delete(designations)
      .where(and(eq(designations.id, designationId), eq(designations.schoolId, school.id)));

    await logHrAudit(ctx, "DELETE", "designations", designationId, { action: "DELETE_DESIGNATION" });
    safeRevalidate("/hr");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── STAFF ONBOARDING (Canonical Flow & Authoritative RBAC) ───────────────────
const CreateStaffSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string(),
  gender: z.string(),
  mobile: z.string().min(10, "Mobile must be at least 10 digits"),
  email: z.string().email("Invalid email address"),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  employeeCode: z.string().min(2, "Employee code must be at least 2 characters"),
  departmentId: z.string().uuid(),
  designationId: z.string().uuid(),
  contractType: z.enum([
    "PERMANENT",
    "PROBATION",
    "CONTRACTUAL",
    "PART_TIME",
    "GUEST_FACULTY",
  ]),
  joiningDate: z.string(),
  aadhaarLast4: z.string().length(4, "Aadhaar must be last 4 digits only"),
  pan: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.string().optional(),
});

export async function createStaff(input: z.infer<typeof CreateStaffSchema>) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);
    const parsed = CreateStaffSchema.parse(input);

    // 1. Validate department
    const dept = await db.query.departments.findFirst({
      where: and(eq(departments.id, parsed.departmentId), eq(departments.schoolId, school.id)),
    });
    if (!dept || !dept.isActive) {
      return { success: false, message: "Selected department is invalid or archived." };
    }

    // 2. Validate designation
    const desig = await db.query.designations.findFirst({
      where: and(eq(designations.id, parsed.designationId), eq(designations.schoolId, school.id)),
    });
    if (!desig || !desig.isActive) {
      return { success: false, message: "Selected designation is invalid or archived." };
    }

    // 3. Validate unique employeeCode within school
    const existingCode = await db.query.staff.findFirst({
      where: and(eq(staff.schoolId, school.id), eq(staff.employeeCode, parsed.employeeCode.trim())),
    });
    if (existingCode) {
      return { success: false, message: `Staff member with employee code "${parsed.employeeCode}" already exists.` };
    }

    // 4. Validate user email uniqueness
    const emailNormalized = parsed.email.trim().toLowerCase();
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, emailNormalized),
    });
    if (existingUser) {
      return { success: false, message: `A user account with email "${parsed.email}" already exists.` };
    }

    // 5. Generate secure random temp password (DECIDE-17) and resolve authoritative role
    const authoritativeRole = (desig.isTeaching ? "TEACHER" : (desig.mappedRole || "STAFF")) as UserRole;
    const defaultPassword = generateRandomTempPassword();
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const { newUser, newStaff } = await db.transaction(async (tx) => {
      // 5a. Create user credential with default password and force change
      const [u] = await tx
        .insert(users)
        .values({
          schoolId: school.id,
          email: emailNormalized,
          mobileEncrypted: encryptData(parsed.mobile.trim()),
          passwordHash,
          mustChangePassword: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!u) {
        throw new Error("Failed to create user login credential.");
      }

      // 5b. Create canonical person record
      await tx.insert(persons).values({
        schoolId: school.id,
        userId: u.id,
        primaryType: "STAFF",
        firstNameEncrypted: encryptData(parsed.firstName.trim()),
        lastNameEncrypted: encryptData(parsed.lastName.trim()),
        firstNameSearchHash: computeSearchHash(parsed.firstName.trim()),
        lastNameSearchHash: computeSearchHash(parsed.lastName.trim()),
        gender: parsed.gender,
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
        primaryEmailEncrypted: encryptData(emailNormalized),
        primaryMobileEncrypted: encryptData(parsed.mobile.trim()),
        aadhaarLast4: parsed.aadhaarLast4 || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 6. Role Assignment: find-or-create per-school role row
      let targetRole = await tx.query.roles.findFirst({
        where: and(eq(roles.schoolId, school.id), eq(roles.name, authoritativeRole as any)),
      });
      if (!targetRole) {
        const [createdRole] = await tx
          .insert(roles)
          .values({
            schoolId: school.id,
            name: authoritativeRole as any,
            displayName: ROLE_CONFIGS[authoritativeRole]?.displayName || String(authoritativeRole),
            description: `System role for ${authoritativeRole}`,
            isSystemRole: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        targetRole = createdRole;
      }

      if (targetRole) {
        await tx.insert(userRoles).values({
          userId: u.id,
          roleId: targetRole.id,
          schoolId: school.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // 7. Insert staff record with encrypted PII
      const [s] = await tx
        .insert(staff)
        .values({
          schoolId: school.id,
          userId: u.id,
          employeeCode: parsed.employeeCode.trim(),
          departmentId: parsed.departmentId,
          designationId: parsed.designationId,
          contractType: parsed.contractType,
          joiningDate: new Date(parsed.joiningDate),
          firstNameEncrypted: encryptData(parsed.firstName.trim()),
          lastNameEncrypted: encryptData(parsed.lastName.trim()),
          dateOfBirthEncrypted: encryptData(parsed.dateOfBirth),
          genderEncrypted: encryptData(parsed.gender),
          mobileEncrypted: encryptData(parsed.mobile.trim()),
          emailEncrypted: encryptData(emailNormalized),
          addressEncrypted: parsed.address ? encryptData(parsed.address.trim()) : null,
          emergencyContactEncrypted: parsed.emergencyContact
            ? encryptData(parsed.emergencyContact.trim())
            : null,
          aadhaarLast4: parsed.aadhaarLast4,
          panEncrypted: parsed.pan ? encryptData(parsed.pan.trim().toUpperCase()) : null,
          bankNameEncrypted: parsed.bankName ? encryptData(parsed.bankName.trim()) : null,
          bankAccountEncrypted: parsed.bankAccount ? encryptData(parsed.bankAccount.trim()) : null,
          bankIfscEncrypted: parsed.bankIfsc ? encryptData(parsed.bankIfsc.trim().toUpperCase()) : null,
          qualification: parsed.qualification || null,
          experience: parsed.experience || null,
          isActive: true,
          legalHold: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!s) {
        throw new Error("Failed to create staff record.");
      }

      return { newUser: u, newStaff: s };
    });

    await logHrAudit(ctx, "WRITE", "staff", newStaff.id, {
      action: "CREATE_STAFF",
      employeeCode: parsed.employeeCode,
      isTeaching: desig.isTeaching,
      assignedRole: authoritativeRole,
    });

    // 8. Dispatch credentials via SMS (carrying role-specific dashboard link)
    const formattedMobile = parsed.mobile.trim().startsWith("+91")
      ? parsed.mobile.trim()
      : `+91${parsed.mobile.trim()}`;
    const defaultDashboard = ROLE_CONFIGS[authoritativeRole]?.defaultDashboard || "/dashboard";
    const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL || "http://localhost:3000";
    const fullDashboardUrl = `${pwaUrl}${defaultDashboard}`;
    const roleDisplayName = ROLE_CONFIGS[authoritativeRole]?.displayName || authoritativeRole;

    const smsBody =
      `Welcome to ${school.name}!\n` +
      `Role: ${roleDisplayName}\n` +
      `Login: ${emailNormalized}\n` +
      `Temp password: ${defaultPassword}\n` +
      `Dashboard: ${fullDashboardUrl}\n` +
      `Please change your password on first login.`;

    const smsRes = await sendSMSWithStatus(formattedMobile, smsBody);

    safeRevalidate("/hr");

    if (!smsRes.delivered) {
      return {
        success: true,
        staffId: newStaff.id,
        assignedRole: authoritativeRole,
        warning: "SMS not delivered — share credentials manually",
        credentials: {
          email: emailNormalized,
          tempPassword: defaultPassword,
          dashboardUrl: defaultDashboard,
          roleDisplayName,
        },
      };
    }

    return {
      success: true,
      staffId: newStaff.id,
      assignedRole: authoritativeRole,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── STAFF PROFILE EDIT (Update) ─────────────────────────────────────────────
export async function updateStaff(
  staffId: string,
  input: {
    firstName?: string | undefined;
    lastName?: string | undefined;
    mobile?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    emergencyContact?: string | undefined;
    departmentId?: string | undefined;
    designationId?: string | undefined;
    contractType?: any;
    joiningDate?: string | undefined;
    qualification?: string | undefined;
    experience?: string | undefined;
    bankName?: string | undefined;
    bankAccount?: string | undefined;
    bankIfsc?: string | undefined;
    pan?: string | undefined;
  },
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);

    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
      with: { designation: true },
    });

    if (!staffRecord) {
      return { success: false, message: "Staff record not found or unauthorized." };
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (input.firstName) updates.firstNameEncrypted = encryptData(input.firstName.trim());
    if (input.lastName) updates.lastNameEncrypted = encryptData(input.lastName.trim());
    if (input.mobile) updates.mobileEncrypted = encryptData(input.mobile.trim());
    if (input.address !== undefined) {
      updates.addressEncrypted = input.address ? encryptData(input.address.trim()) : null;
    }
    if (input.emergencyContact !== undefined) {
      updates.emergencyContactEncrypted = input.emergencyContact
        ? encryptData(input.emergencyContact.trim())
        : null;
    }
    if (input.qualification !== undefined) updates.qualification = input.qualification;
    if (input.experience !== undefined) updates.experience = input.experience;
    if (input.contractType) updates.contractType = input.contractType;
    if (input.joiningDate) updates.joiningDate = new Date(input.joiningDate);

    if (input.bankName !== undefined) {
      updates.bankNameEncrypted = input.bankName ? encryptData(input.bankName.trim()) : null;
    }
    if (input.bankAccount !== undefined) {
      updates.bankAccountEncrypted = input.bankAccount ? encryptData(input.bankAccount.trim()) : null;
    }
    if (input.bankIfsc !== undefined) {
      updates.bankIfscEncrypted = input.bankIfsc ? encryptData(input.bankIfsc.trim().toUpperCase()) : null;
    }
    if (input.pan !== undefined) {
      updates.panEncrypted = input.pan ? encryptData(input.pan.trim().toUpperCase()) : null;
    }

    // Handle email update across staff and users
    if (input.email) {
      const emailNorm = input.email.trim().toLowerCase();
      if (staffRecord.userId) {
        const emailConflict = await db.query.users.findFirst({
          where: and(eq(users.email, emailNorm), sql`${users.id} != ${staffRecord.userId}`),
        });
        if (emailConflict) {
          return { success: false, message: "Another user account already uses this email." };
        }
        await db.update(users).set({ email: emailNorm, updatedAt: new Date() }).where(eq(users.id, staffRecord.userId));
      }
      updates.emailEncrypted = encryptData(emailNorm);
    }

    // Handle department change
    if (input.departmentId) {
      const dept = await db.query.departments.findFirst({
        where: and(eq(departments.id, input.departmentId), eq(departments.schoolId, school.id)),
      });
      if (!dept || !dept.isActive) {
        return { success: false, message: "Selected department is invalid or archived." };
      }
      updates.departmentId = input.departmentId;
    }

      // Handle designation change and authoritative role synchronization
      if (input.designationId && input.designationId !== staffRecord.designationId) {
        const newDesig = await db.query.designations.findFirst({
          where: and(eq(designations.id, input.designationId), eq(designations.schoolId, school.id)),
        });
        if (!newDesig || !newDesig.isActive) {
          return { success: false, message: "Selected designation is invalid or archived." };
        }
        updates.designationId = input.designationId;

        const oldRoleName = staffRecord.designation.isTeaching ? "TEACHER" : staffRecord.designation.mappedRole;
        const newRoleName = newDesig.isTeaching ? "TEACHER" : newDesig.mappedRole;

        // Check if transitioning from Teaching -> Non-Teaching
        if (staffRecord.designation.isTeaching && !newDesig.isTeaching && staffRecord.userId) {
          // Academic safety check: Verify no active class allocations
          const [csCount, sstCount, tpCount, secCount] = await Promise.all([
            db.query.classSubjects.findMany({ where: eq(classSubjects.assignedTeacherId, staffRecord.userId) }),
            db.query.sectionSubjectTeachers.findMany({ where: eq(sectionSubjectTeachers.teacherId, staffRecord.userId) }),
            db.query.timetablePeriods.findMany({ where: eq(timetablePeriods.teacherId, staffRecord.userId) }),
            db.query.sections.findMany({ where: eq(sections.classTeacherId, staffRecord.userId) }),
          ]);

          const totalActive = csCount.length + sstCount.length + tpCount.length + secCount.length;
          if (totalActive > 0) {
            return {
              success: false,
              message: `Cannot change staff to non-teaching. This teacher has ${totalActive} active academic allocation(s). Reassign classes and timetable periods first.`,
            };
          }
        }

        if (staffRecord.userId && oldRoleName !== newRoleName && newRoleName) {
          // Remove old role
          if (oldRoleName) {
            const oldRole = await db.query.roles.findFirst({
              where: and(eq(roles.schoolId, school.id), eq(roles.name, oldRoleName as any)),
            });
            if (oldRole) {
              await db.delete(userRoles).where(
                and(eq(userRoles.userId, staffRecord.userId), eq(userRoles.roleId, oldRole.id)),
              );
            }
          }

          // Find-or-create new role
          let targetRole = await db.query.roles.findFirst({
            where: and(eq(roles.schoolId, school.id), eq(roles.name, newRoleName as any)),
          });
          if (!targetRole) {
            const [created] = await db
              .insert(roles)
              .values({
                schoolId: school.id,
                name: newRoleName as any,
                displayName: ROLE_CONFIGS[newRoleName as UserRole]?.displayName || newRoleName,
                description: `System role for ${newRoleName}`,
                isSystemRole: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            targetRole = created;
          }

          if (targetRole) {
            const existingUserRole = await db.query.userRoles.findFirst({
              where: and(eq(userRoles.userId, staffRecord.userId), eq(userRoles.roleId, targetRole.id)),
            });
            if (!existingUserRole) {
              await db.insert(userRoles).values({
                userId: staffRecord.userId,
                roleId: targetRole.id,
                schoolId: school.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }
      }

    await db.update(staff).set(updates).where(eq(staff.id, staffId));
    await logHrAudit(ctx, "WRITE", "staff", staffId, { action: "UPDATE_STAFF" });

    safeRevalidate("/hr");
    safeRevalidate(`/hr/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── STAFF PROBATION CONFIRMATION ────────────────────────────────────────────
export async function confirmStaffProbation(staffId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
    });

    if (!staffRecord) return { success: false, message: "Staff not found or unauthorized." };

    if (staffRecord.contractType === "PERMANENT") {
      return { success: true, message: "Staff member is already permanent." };
    }

    await db
      .update(staff)
      .set({
        contractType: "PERMANENT",
        confirmationDate: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(staff.id, staffId), eq(staff.schoolId, school.id)));

    await logHrAudit(ctx, "WRITE", "staff", staffId, { action: "CONFIRM_PROBATION" });

    safeRevalidate("/hr");
    safeRevalidate(`/hr/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── STAFF OFFBOARDING / SEPARATION & ACADEMIC SAFETY ─────────────────────────
export async function offboardStaff(
  staffId: string,
  input: {
    separationType: "RESIGNATION" | "TERMINATION" | "RETIREMENT" | "OTHER";
    relievingDate?: string | undefined;
    separationReason?: string | undefined;
    forceReassign?: boolean | undefined;
  },
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
      with: { designation: true },
    });

    if (!staffRecord) return { success: false, message: "Staff not found or unauthorized." };

    // 1. Legal Hold Protection
    if (staffRecord.legalHold) {
      return {
        success: false,
        message: "Cannot offboard staff member under Legal Hold. Legal hold must be removed before separation.",
      };
    }

    // 2. Idempotency Check
    if (!staffRecord.isActive) {
      return { success: true, message: "Staff member is already offboarded." };
    }

    // 3. Academic Safety Check if teaching staff
    if (staffRecord.userId && staffRecord.designation?.isTeaching) {
      const [csList, sstList, tpList, secList] = await Promise.all([
        db.query.classSubjects.findMany({ where: eq(classSubjects.assignedTeacherId, staffRecord.userId) }),
        db.query.sectionSubjectTeachers.findMany({ where: eq(sectionSubjectTeachers.teacherId, staffRecord.userId) }),
        db.query.timetablePeriods.findMany({ where: eq(timetablePeriods.teacherId, staffRecord.userId) }),
        db.query.sections.findMany({ where: eq(sections.classTeacherId, staffRecord.userId) }),
      ]);

      const totalAllocations = csList.length + sstList.length + tpList.length + secList.length;

      if (totalAllocations > 0 && !input.forceReassign) {
        return {
          success: false,
          requiresReassignment: true,
          message: `This teacher has ${csList.length} assigned class subject(s), ${sstList.length} section allocation(s), ${tpList.length} timetable period(s), and is class teacher for ${secList.length} section(s). Please confirm re-allocation before offboarding.`,
          activeAllocations: {
            classSubjects: csList.length,
            sectionTeachers: sstList.length,
            timetablePeriods: tpList.length,
            classTeacherSections: secList.length,
          },
        };
      }

      // If forceReassign is true, unassign from active classes/timetable while preserving all historical attendance and marks
      if (input.forceReassign) {
        if (csList.length > 0) {
          await db
            .update(classSubjects)
            .set({ assignedTeacherId: null, updatedAt: new Date() })
            .where(eq(classSubjects.assignedTeacherId, staffRecord.userId));
        }
        if (sstList.length > 0) {
          await db
            .delete(sectionSubjectTeachers)
            .where(eq(sectionSubjectTeachers.teacherId, staffRecord.userId));
        }
        if (tpList.length > 0) {
          await db
            .update(timetablePeriods)
            .set({ teacherId: null, updatedAt: new Date() })
            .where(eq(timetablePeriods.teacherId, staffRecord.userId));
        }
        if (secList.length > 0) {
          await db
            .update(sections)
            .set({ classTeacherId: null, updatedAt: new Date() })
            .where(eq(sections.classTeacherId, staffRecord.userId));
        }
      }
    }

    // 4. Deactivate staff and record separation metadata
    const relieving = input.relievingDate ? new Date(input.relievingDate) : new Date();
    await db
      .update(staff)
      .set({
        isActive: false,
        relievingDate: relieving,
        separationType: input.separationType,
        separationReason: input.separationReason?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, staffId));

    // 5. Deactivate linked user login account
    if (staffRecord.userId) {
      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, staffRecord.userId));
    }

    await logHrAudit(ctx, "WRITE", "staff", staffId, {
      action: "OFFBOARD_STAFF",
      separationType: input.separationType,
      relievingDate: input.relievingDate,
    });

    safeRevalidate("/hr");
    safeRevalidate(`/hr/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function reactivateStaff(staffId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);

    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
    });

    if (!staffRecord) return { success: false, message: "Staff not found or unauthorized." };

    await db
      .update(staff)
      .set({
        isActive: true,
        relievingDate: null,
        separationType: null,
        separationReason: null,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, staffId));

    if (staffRecord.userId) {
      await db
        .update(users)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(users.id, staffRecord.userId));
    }

    await logHrAudit(ctx, "WRITE", "staff", staffId, { action: "REACTIVATE_STAFF" });

    safeRevalidate("/hr");
    safeRevalidate(`/hr/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function toggleStaffLegalHold(staffId: string, legalHold: boolean) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
    });

    if (!staffRecord) return { success: false, message: "Staff not found or unauthorized." };

    await db
      .update(staff)
      .set({ legalHold: Boolean(legalHold), updatedAt: new Date() })
      .where(eq(staff.id, staffId));

    await logHrAudit(ctx, "WRITE", "staff", staffId, {
      action: "TOGGLE_LEGAL_HOLD",
      legalHold: Boolean(legalHold),
    });

    safeRevalidate("/hr");
    safeRevalidate(`/hr/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── CANONICAL TEACHING STAFF RESOLVER FOR AMS & SIS ─────────────────────────
import {
  getCanonicalTeachingStaff as _getCanonicalTeachingStaff,
  invalidateTeachingStaffCache as _invalidateTeachingStaffCache,
  type CanonicalTeacher,
} from "./teachingStaff";

export type { CanonicalTeacher };

export async function getCanonicalTeachingStaff(schoolId: string) {
  return _getCanonicalTeachingStaff(schoolId);
}

export async function invalidateTeachingStaffCache(schoolId?: string) {
  return _invalidateTeachingStaffCache(schoolId);
}



// ─── STAFF 360 PROFILED DATA FETCHER ──────────────────────────────────────────
export async function getStaff360(staffId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const s = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.schoolId, school.id)),
      with: {
        department: true,
        designation: true,
        user: true,
        salaryComponents: true,
        loans: true,
        documents: true,
        leaveBalances: true,
      },
    });

    if (!s) return { success: false, message: "Staff not found or unauthorized." };

    // Decrypt fields securely
    const firstName = decryptData(s.firstNameEncrypted) || "";
    const lastName = decryptData(s.lastNameEncrypted) || "";
    const mobile = decryptData(s.mobileEncrypted) || "";
    const email = decryptData(s.emailEncrypted) || s.user?.email || "";
    const address = decryptData(s.addressEncrypted) || "";
    const emergencyContact = decryptData(s.emergencyContactEncrypted) || "";
    const dateOfBirth = decryptData(s.dateOfBirthEncrypted) || "";
    const gender = decryptData(s.genderEncrypted) || "";

    // Academic allocations if teaching faculty
    let academicAllocations: any = null;
    if (s.userId && s.designation?.isTeaching) {
      const [classSubjs, secTeachers, classTeacherSecs, periods] = await Promise.all([
        db.query.classSubjects.findMany({
          where: eq(classSubjects.assignedTeacherId, s.userId),
          with: { class: true, subject: true },
        }),
        db.query.sectionSubjectTeachers.findMany({
          where: eq(sectionSubjectTeachers.teacherId, s.userId),
          with: { section: true, classSubject: { with: { subject: true } } },
        }),
        db.query.sections.findMany({
          where: eq(sections.classTeacherId, s.userId),
          with: { class: true },
        }),
        db.query.timetablePeriods.findMany({
          where: eq(timetablePeriods.teacherId, s.userId),
        }),
      ]);

      academicAllocations = {
        classSubjects: classSubjs.map((cs) => ({
          id: cs.id,
          className: cs.class.displayName,
          subjectName: cs.subject.name,
        })),
        sectionAllocations: secTeachers.map((st) => ({
          id: st.id,
          sectionName: st.section.name,
          subjectName: st.classSubject.subject.name,
        })),
        classTeacherOf: classTeacherSecs.map((sec) => `${sec.class.displayName} - ${sec.name}`),
        weeklyPeriodsCount: periods.length,
      };
    }

    return {
      success: true,
      profile: {
        id: s.id,
        employeeCode: s.employeeCode,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        email,
        mobile,
        address,
        emergencyContact,
        dateOfBirth,
        gender,
        aadhaarLast4: s.aadhaarLast4,
        departmentId: s.departmentId,
        departmentName: s.department?.name || "—",
        designationId: s.designationId,
        designationName: s.designation?.name || "—",
        isTeaching: s.designation?.isTeaching || false,
        contractType: s.contractType,
        joiningDate: s.joiningDate,
        confirmationDate: s.confirmationDate,
        relievingDate: s.relievingDate,
        separationType: s.separationType,
        separationReason: s.separationReason,
        isActive: s.isActive,
        legalHold: s.legalHold,
        qualification: s.qualification,
        experience: s.experience,
        academicAllocations,
        salaryConfigured: s.salaryComponents.length > 0,
        salaryComponents: s.salaryComponents[0] || null,
        salaryBreakdown: s.salaryComponents.length > 0
          ? computeSalaryBreakdown(s.salaryComponents[0])
          : null,
        activeLoansCount: s.loans.filter((l) => l.status === "ACTIVE").length,
        documentsCount: s.documents.length,
        leaveBalances: s.leaveBalances,
        createdAt: s.createdAt,
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}


// ─── Leave Request Actions ───────────────────────────────────────────────────
export async function createLeaveRequest(input: {
  staffId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const staffRecord = await db.query.staff.findFirst({
      where: eq(staff.id, input.staffId),
    });

    if (!staffRecord)
      return { success: false, message: "Staff member not found" };

    await db.insert(leaveRequests).values({
      schoolId: staffRecord.schoolId,
      staffId: input.staffId,
      leaveTypeId: input.leaveTypeId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      totalDays: input.totalDays.toFixed(1),
      reason: input.reason,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    safeRevalidate("/hr/leaves");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function approveLeaveRequest(
  id: string,
  step: "HOD" | "HR" | "PRINCIPAL",
  approve: boolean,
  rejectionReason?: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const request = await db.query.leaveRequests.findFirst({
      where: eq(leaveRequests.id, id),
    });

    if (!request) return { success: false, message: "Leave request not found" };

    const updateValues: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (!approve) {
      updateValues.status = "REJECTED";
      updateValues.rejectionReason = rejectionReason || "Rejected by reviewer";
    } else {
      if (step === "HOD") {
        updateValues.status = "HOD_APPROVED";
        updateValues.hodApprovedById = session.user.id;
        updateValues.hodApprovedAt = new Date();
      } else if (step === "HR" || step === "PRINCIPAL") {
        updateValues.status = "HR_APPROVED";
        updateValues.hrApprovedById = session.user.id;
        updateValues.hrApprovedAt = new Date();

        // Increment usedDays in leave_balances for this staff member
        const leaveTypeRecord = await db.query.leaveTypes.findFirst({
          where: eq(leaveTypes.id, request.leaveTypeId),
        });

        if (leaveTypeRecord) {
          const activeYear = await db.query.academicYears.findFirst({
            where: eq(academicYears.isActive, true),
          });

          if (activeYear) {
            const balance = await db.query.leaveBalances.findFirst({
              where: and(
                eq(leaveBalances.staffId, request.staffId),
                eq(leaveBalances.leaveType, leaveTypeRecord.code),
                eq(leaveBalances.academicYearId, activeYear.id),
              ),
            });

            if (balance) {
              const currentUsed = parseFloat(balance.usedDays);
              const requestedDays = parseFloat(request.totalDays);
              await db
                .update(leaveBalances)
                .set({
                  usedDays: (currentUsed + requestedDays).toFixed(1),
                  updatedAt: new Date(),
                })
                .where(eq(leaveBalances.id, balance.id));
            }
          }
        }
      }
    }

    await db
      .update(leaveRequests)
      .set(updateValues)
      .where(eq(leaveRequests.id, id));

    safeRevalidate("/hr/leaves");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Salary Templates & Loans ────────────────────────────────────────────────
export async function createSalaryTemplate(input: {
  name: string;
  basicPercent: number;
  daPercent: number;
  hraPercent: number;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  esiApplicable: boolean;
  professionalTaxState: string;
  otherAllowances: Array<{ name: string; amount: number }>;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);

    await db.insert(salaryTemplates).values({
      schoolId: school.id,
      name: input.name,
      basicPercent: input.basicPercent.toFixed(2),
      daPercent: input.daPercent.toFixed(2),
      hraPercent: input.hraPercent.toFixed(2),
      pfEmployeePercent: input.pfEmployeePercent.toFixed(2),
      pfEmployerPercent: input.pfEmployerPercent.toFixed(2),
      esiApplicable: input.esiApplicable,
      professionalTaxState: input.professionalTaxState,
      otherAllowances: input.otherAllowances,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    safeRevalidate("/hr/salary-templates");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function associateSalaryTemplate(
  staffId: string,
  templateId: string,
  baseGrossSalary: number,
  monthlyTds = 0,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const template = await db.query.salaryTemplates.findFirst({
      where: eq(salaryTemplates.id, templateId),
    });

    if (!template) return { success: false, message: "Template not found" };

    const basicSalary =
      (baseGrossSalary * parseFloat(template.basicPercent)) / 100;

    // Delete existing salaryComponents
    await db
      .delete(salaryComponents)
      .where(eq(salaryComponents.staffId, staffId));

    await db.insert(salaryComponents).values({
      schoolId: template.schoolId,
      staffId,
      basicSalary: basicSalary.toFixed(2),
      daPercent: template.daPercent,
      hraPercent: template.hraPercent,
      pfEmployeePercent: template.pfEmployeePercent,
      pfEmployerPercent: template.pfEmployerPercent,
      esiApplicable: template.esiApplicable,
      professionalTaxState: template.professionalTaxState,
      monthlyTdsAmount: monthlyTds.toFixed(2),
      otherAllowances: template.otherAllowances as any[],
      effectiveFrom: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Also update a monthly TDS amount setting field if needed (stored on the salaryComponents allowance or custom meta)
    // Wait, let's create/update the staff loan or TDS config if any

    safeRevalidate("/hr");
    safeRevalidate("/hr/staff");
    safeRevalidate(`/hr/staff/${staffId}`);
    safeRevalidate("/teacher/dashboard");
    safeRevalidate("/teacher/payroll");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function createStaffLoan(input: {
  staffId: string;
  principalAmount: number;
  emiAmount: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const staffRecord = await db.query.staff.findFirst({
      where: eq(staff.id, input.staffId),
    });

    if (!staffRecord) return { success: false, message: "Staff not found" };

    await db.insert(staffLoans).values({
      schoolId: staffRecord.schoolId,
      staffId: input.staffId,
      principalAmount: input.principalAmount.toFixed(2),
      emiAmount: input.emiAmount.toFixed(2),
      remainingAmount: input.principalAmount.toFixed(2),
      status: "ACTIVE",
      approvedById: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    safeRevalidate("/hr/staff");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Document Vault ──────────────────────────────────────────────────────────
export async function uploadStaffDocument(input: {
  staffId: string;
  documentType: string;
  fileName: string;
  fileS3Key: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const staffRecord = await db.query.staff.findFirst({
      where: eq(staff.id, input.staffId),
    });

    if (!staffRecord) return { success: false, message: "Staff not found" };

    await db.insert(staffDocuments).values({
      schoolId: staffRecord.schoolId,
      staffId: input.staffId,
      documentType: input.documentType,
      fileName: input.fileName,
      fileS3Key: input.fileS3Key,
      uploadedById: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    safeRevalidate("/hr/staff");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Payroll Run Actions ──────────────────────────────────────────────────────
export async function runPayrollForMonth(month: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);
    const school = await requireSchool(ctx);

    const activeYear = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.isActive, true),
        eq(academicYears.schoolId, school.id),
      ),
    });

    if (!activeYear)
      return { success: false, message: "Active Academic Year not found" };

    // Get all staff
    const allStaff = await db.query.staff.findMany({
      where: eq(staff.isActive, true),
      with: { salaryComponents: true, loans: true, leaveRequests: true },
    });

    // Create a new Payroll Run in DRAFT status
    const [run] = await db
      .insert(payrollRuns)
      .values({
        schoolId: school.id,
        month,
        status: "DRAFT",
        processedById: ctx.userId,
        processedAt: new Date(),
        totalGross: "0.00",
        totalNetPay: "0.00",
        totalDeductions: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!run)
      return { success: false, message: "Failed to create payroll run" };

    let totalGrossSum = 0;
    let totalDeductionsSum = 0;
    let totalNetSum = 0;

    const daysInMonth = 30; // Fallback constant days mapping

    // Process each staff member
    for (const s of allStaff) {
      const activeSalary = s.salaryComponents[0];
      if (!activeSalary) continue; // Skip if salary components aren't associated yet

      // Get LWP days (approved LWP leaves for this month)
      const lwpLeaves = s.leaveRequests.filter((lr) => {
        const start = new Date(lr.startDate);
        const matchMonth = start.toISOString().slice(0, 7); // e.g. "2025-06"
        return lr.status === "HR_APPROVED" && matchMonth === month;
      });

      // Sum of LWP days
      const approvedLwpDays = lwpLeaves.reduce(
        (acc, curr) => acc + parseFloat(curr.totalDays),
        0,
      );

      // Query staff attendance for unauthorised absences
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr || "2025");
      const monthNum = parseInt(monthStr || "06");
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      const attendanceRecords = await db.query.staffAttendance.findMany({
        where: and(
          eq(staffAttendance.staffId, s.id),
          gte(staffAttendance.attendanceDate, startDate),
          lte(staffAttendance.attendanceDate, endDate),
        ),
      });

      const absentDays = attendanceRecords.filter(
        (r) => r.status === "ABSENT",
      ).length;
      const totalDeductibleDays = approvedLwpDays + absentDays;

      // Get active loan
      const activeLoan = s.loans.find((l) => l.status === "ACTIVE");

      const deductionsInput = {
        lwpDays: totalDeductibleDays,
        daysInMonth,
        monthlyTdsAmount: parseFloat(activeSalary.monthlyTdsAmount),
        activeLoanEmi: activeLoan ? parseFloat(activeLoan.emiAmount) : 0,
        activeLoanRemaining: activeLoan
          ? parseFloat(activeLoan.remainingAmount)
          : 0,
      };

      const salaryInput = {
        basicSalary: parseFloat(activeSalary.basicSalary),
        daPercent: parseFloat(activeSalary.daPercent),
        hraPercent: parseFloat(activeSalary.hraPercent),
        otherAllowances: (activeSalary.otherAllowances as any[]) || [],
        pfEmployeePercent: parseFloat(activeSalary.pfEmployeePercent),
        pfEmployerPercent: parseFloat(activeSalary.pfEmployerPercent),
        esiApplicable: activeSalary.esiApplicable,
        professionalTaxState: activeSalary.professionalTaxState ?? "DL",
      };

      // Perform calculations
      const calc = runPayrollCalculations(
        salaryInput,
        deductionsInput,
        month.endsWith("-02"),
      );

      // Save payslip
      await db.insert(payslips).values({
        schoolId: school.id,
        payrollRunId: run.id,
        staffId: s.id,
        month,
        workingDays: daysInMonth,
        presentDays: daysInMonth - totalDeductibleDays,
        basicSalary: activeSalary.basicSalary,
        da: calc.daAmount.toFixed(2),
        hra: calc.hraAmount.toFixed(2),
        otherAllowances: calc.allowancesAmount.toFixed(2),
        grossSalary: calc.actualGrossSalary.toFixed(2),
        pfEmployee: calc.pfEmployee.toFixed(2),
        pfEmployer: calc.pfEmployer.toFixed(2),
        esi: calc.esiEmployee.toFixed(2),
        professionalTax: calc.professionalTax.toFixed(2),
        tds: calc.tds.toFixed(2),
        loanDeduction: calc.loanEmiApplied.toFixed(2),
        totalDeductions: calc.totalDeductions.toFixed(2),
        netPay: calc.netPay.toFixed(2),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      totalGrossSum += calc.actualGrossSalary;
      totalDeductionsSum += calc.totalDeductions;
      totalNetSum += calc.netPay;
    }

    // Update payroll run with calculated sums
    await db
      .update(payrollRuns)
      .set({
        totalGross: totalGrossSum.toFixed(2),
        totalDeductions: totalDeductionsSum.toFixed(2),
        totalNetPay: totalNetSum.toFixed(2),
        status: "PROCESSED",
        updatedAt: new Date(),
      })
      .where(eq(payrollRuns.id, run.id));

    safeRevalidate("/hr/payroll");
    return { success: true, runId: run.id };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function approveAndLockPayroll(runId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    if (
      session.user.role !== "SUPER_ADMIN" &&
      session.user.role !== "PRINCIPAL" &&
      session.user.role !== "SCHOOL_ADMIN"
    ) {
      return {
        success: false,
        message:
          "Access denied: Principal or Admin authorization required to lock payroll.",
      };
    }

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, runId),
      with: { payslips: true },
    });

    if (!run) return { success: false, message: "Payroll run not found" };

    // Update status to APPROVED
    await db
      .update(payrollRuns)
      .set({
        status: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payrollRuns.id, runId));

    // Deduct remaining amounts of loans
    for (const slip of run.payslips) {
      const loanDed = parseFloat(slip.loanDeduction);
      if (loanDed > 0) {
        const activeLoan = await db.query.staffLoans.findFirst({
          where: and(
            eq(staffLoans.staffId, slip.staffId),
            eq(staffLoans.status, "ACTIVE"),
          ),
        });

        if (activeLoan) {
          const currentRem = parseFloat(activeLoan.remainingAmount);
          const newRem = Math.max(0, currentRem - loanDed);
          await db
            .update(staffLoans)
            .set({
              remainingAmount: newRem.toFixed(2),
              status: newRem <= 0 ? "PAID_OFF" : "ACTIVE",
              updatedAt: new Date(),
            })
            .where(eq(staffLoans.id, activeLoan.id));
        }
      }
    }

    safeRevalidate("/hr/payroll");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
