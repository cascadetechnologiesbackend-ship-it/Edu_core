"use server";

import { db, withTenant, type Db } from "@/db";
import {
  feeInvoices,
  feePayments,
  feeHeads,
  students,
  academicYears,
  classes,
  sections,
  staff,
  departments,
  designations,
  users,
  roles,
  userRoles,
  persons,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { encryptData, decryptData, computeSearchHash } from "@/lib/encryption";
import {
  validateImportBatch,
  generateRejectedRowsCsv,
  enforceImportRowLimit,
  MAX_IMPORT_ROWS,
} from "../../../../lib/importExportEngine";
import { StudentLifecycleEngine } from "@schoolmitra/backend/lib/studentLifecycleEngine";
import {
  validateStudentImportRows,
  executeStudentImportBatch,
  validateStaffImportRows,
  executeStaffImportBatch,
  validateFeeImportRows,
  executeFeeImportBatch,
  generateClerkRejectedRowsCsv,
  type ClerkRowReport,
  type DryRunValidationSummary,
  type ImportCommitSummary,
} from "@schoolmitra/backend/lib/bulkImportResilience";
import { getClientRequestContext } from "@/lib/requestContext";
import { generateRoleTempPassword } from "@/lib/tempPassword";
import { ROLE_CONFIGS, type UserRole } from "@/lib/roleConfig";
import bcrypt from "bcryptjs";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

export interface DryRunValidationResult {
  rowNumber: number;
  admissionNumber: string;
  studentName?: string | undefined;
  amount: number;
  isValid: boolean;
  error?: string | undefined;
}

export interface ImportCommitResult {
  success: boolean;
  totalProcessed: number;
  createdCount: number;
  skippedCount: number;
  duplicatesMergedCount?: number | undefined;
  errors: string[];
  rejectedRowsCsv: string;
  message?: string | undefined;
  finishedState?: {
    title: string;
    message: string;
    nextActionLabel: string;
    nextActionHref: string;
  } | undefined;
}

/**
 * Dry-run preview validator for bulk opening fee balance import.
 * Strictly role-gated to carry_forward_and_import: SUPER_ADMIN, SCHOOL_ADMIN.
 */
export async function validateHistoricalFeeBalances(
  academicYearId: string,
  rows: {
    admissionNumber: string;
    grossAmount: number;
    dueDate?: string | undefined;
  }[]
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!academicYearId) throw new Error("Academic Year is required.");
    if (!rows || rows.length === 0) throw new Error("No data rows supplied for validation.");

    const stringRows = rows.map((r) => ({
      admissionNumber: r.admissionNumber || "",
      grossAmount: String(r.grossAmount ?? ""),
      dueDate: r.dueDate || "",
    }));

    const summary = await validateFeeImportRows(school.id, stringRows, academicYearId, db);

    const validationRows: DryRunValidationResult[] = summary.rows.map((r) => ({
      rowNumber: r.rowNumber,
      admissionNumber: r.identifier,
      studentName: r.displayName,
      amount: r.normalizedData?.grossAmount ?? (typeof r.classSection === "string" ? parseFloat(r.classSection.replace(/[^0-9.]/g, "")) : 0),
      isValid: r.isValid,
      error: r.error,
    }));

    return {
      success: true,
      totalCount: summary.totalRows,
      validCount: summary.validRowsCount,
      invalidCount: summary.invalidRowsCount,
      results: validationRows,
      summary,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to validate CSV rows",
      results: [],
    };
  }
}

/**
 * Commit imported opening/historical balances into fee_invoices.
 * Resilient row-level execution: valid rows persist, invalid rows skipped with reasons.
 */
export async function importHistoricalFeeBalances(
  academicYearId: string,
  rows: {
    admissionNumber: string;
    grossAmount: number;
    dueDate?: string | undefined;
  }[]
) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);

  if (!academicYearId) throw new Error("Academic Year is required.");
  if (!rows || rows.length === 0) throw new Error("No data rows supplied for import.");

  const stringRows = rows.map((r) => ({
    admissionNumber: r.admissionNumber || "",
    grossAmount: String(r.grossAmount ?? ""),
    dueDate: r.dueDate || "",
  }));

  const commitSummary = await executeFeeImportBatch(
    school.id,
    academicYearId,
    stringRows,
    {
      userId: ctx.userId,
      userEmail: ctx.email,
    },
    db
  );

  safeRevalidate("/school/import-center");
  safeRevalidate("/school/due-fees");

  return {
    success: commitSummary.success,
    count: commitSummary.createdCount,
    skippedCount: commitSummary.skippedCount,
    errors: commitSummary.errors,
    rejectedRowsCsv: commitSummary.rejectedRowsCsv,
    message: commitSummary.message,
    finishedState: commitSummary.finishedState,
  };
}

/**
 * Dry-run preview validator for bulk STUDENTS import.
 */
export async function validateStudentImportAction(
  rows: Record<string, string>[]
): Promise<DryRunValidationSummary> {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  enforceImportRowLimit(rows);

  return await validateStudentImportRows(school.id, rows, db);
}

/**
 * Domain-guarded commit action for bulk STUDENTS import.
 * - Row-level resilience (Charter BR4): Valid rows persist, invalid rows yield detailed clerk reasons.
 * - Idempotency: re-running creates zero duplicates (match on admissionNumber or name+class+guardian mobile).
 * - Delegates student creation exclusively to S13 StudentLifecycleEngine.
 */
export async function commitStudentImportAction(
  rows: Record<string, string>[],
  options?: { allOrNothing?: boolean; resilient?: boolean }
): Promise<ImportCommitResult> {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const reqCtx = getClientRequestContext();

  enforceImportRowLimit(rows);

  // When resilient mode is enabled (Default in D1-L3 ImportCenterClient):
  if (options?.resilient === true) {
    const commitResult = await executeStudentImportBatch(
      schoolId,
      rows,
      {
        userId: ctx.userId,
        userEmail: ctx.email || "admin@schoolmitra.internal",
        userRole: ctx.role,
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
      },
      db
    );

    safeRevalidate("/school/import-center");
    safeRevalidate("/students");

    return {
      success: commitResult.success,
      totalProcessed: commitResult.totalProcessed,
      createdCount: commitResult.createdCount,
      skippedCount: commitResult.skippedCount,
      duplicatesMergedCount: commitResult.duplicatesMergedCount,
      errors: commitResult.errors,
      rejectedRowsCsv: commitResult.rejectedRowsCsv,
      message: commitResult.message,
      finishedState: commitResult.finishedState,
    };
  }

  // Legacy S21 validation & all-or-nothing rollback behavior
  const validation = validateImportBatch("STUDENTS", rows);
  const tenantClasses = await db.query.classes.findMany({
    where: and(eq(classes.schoolId, schoolId), eq(classes.isActive, true)),
  });
  const tenantSections = await db.query.sections.findMany({
    where: and(eq(sections.schoolId, schoolId), eq(sections.isActive, true)),
  });

  for (let idx = 0; idx < validation.rows.length; idx++) {
    const r = validation.rows[idx]!;
    const rawClassName = (r.data["Class Name"] || r.data["className"] || "").trim();
    const rawSectionName = (r.data["Section"] || r.data["sectionName"] || "").trim();

    const matchedClass = tenantClasses.find(
      (c) =>
        (c.displayName || (c as any).name || "").toLowerCase().trim() ===
        rawClassName.toLowerCase()
    );

    if (!matchedClass) {
      r.errors.push(`Class '${rawClassName}' not found in current institutional curriculum.`);
      r.isValid = false;
    } else {
      const matchedSection = tenantSections.find(
        (s) =>
          s.classId === matchedClass.id &&
          (s.name || "").toLowerCase().trim() === rawSectionName.toLowerCase()
      );
      if (!matchedSection) {
        r.errors.push(`Section '${rawSectionName}' not found in Class '${rawClassName}'.`);
        r.isValid = false;
      }
    }
  }

  const invalidRows = validation.rows.filter((r) => !r.isValid);
  validation.invalidRowsCount = invalidRows.length;
  validation.validRowsCount = validation.rows.length - invalidRows.length;
  validation.canCommit = invalidRows.length === 0;

  if (!validation.canCommit) {
    const rejectedRowsCsv = generateRejectedRowsCsv(validation);
    const lineErrors = invalidRows.flatMap((r) =>
      r.errors.map((err) => (err.startsWith("Line ") ? err : `Line ${r.rowNumber}: ${err}`))
    );
    return {
      success: false,
      totalProcessed: rows.length,
      createdCount: 0,
      skippedCount: 0,
      errors: lineErrors,
      rejectedRowsCsv,
      message: `Validation failed: ${validation.invalidRowsCount} row(s) contain errors. Zero rows were committed.`,
    };
  }

  const commitResult = await withTenant(schoolId, async (tx: Db) => {
    let createdCount = 0;
    let skippedCount = 0;
    const seenAdmissionNumbers = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const adm = (row["Admission Number"] || row["admissionNumber"] || "").trim();
      const admKey = adm.toLowerCase();

      if (seenAdmissionNumbers.has(admKey)) {
        skippedCount++;
        continue;
      }
      seenAdmissionNumbers.add(admKey);

      const rawClassName = (row["Class Name"] || row["className"] || "").trim();
      const rawSectionName = (row["Section"] || row["sectionName"] || "").trim();

      const targetClass = tenantClasses.find(
        (c) =>
          (c.displayName || (c as any).name || "").toLowerCase().trim() ===
          rawClassName.toLowerCase()
      )!;
      const targetSection = tenantSections.find(
        (s) =>
          s.classId === targetClass.id &&
          (s.name || "").toLowerCase().trim() === rawSectionName.toLowerCase()
      )!;

      const result = await StudentLifecycleEngine.createImportedStudent(
        schoolId,
        {
          classId: targetClass.id,
          sectionId: targetSection.id,
          admissionNumber: adm,
          firstName: (row["First Name"] || row["firstName"] || "").trim(),
          lastName: (row["Last Name"] || row["lastName"] || "").trim(),
          dob: (row["Date of Birth (YYYY-MM-DD)"] || row["dob"] || "").trim(),
          gender: ((row["Gender"] || row["gender"] || "MALE").toUpperCase().trim()) as any,
          parentName: (row["Parent / Guardian Name"] || row["parentName"] || "").trim(),
          parentPhone: (row["Parent Phone"] || row["parentPhone"] || "").trim(),
          parentEmail: (row["Parent Email"] || row["parentEmail"] || "").trim() || null,
          category: (row["Category (Optional)"] || row["category"] || "GENERAL").trim(),
          performedByUserId: ctx.userId,
          performedByUserEmail: ctx.email || "admin@schoolmitra.internal",
          performedByUserRole: ctx.role,
          requestIp: reqCtx.ipAddress,
          userAgent: reqCtx.userAgent,
        },
        tx
      );

      if (result.isNew) {
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    return { createdCount, skippedCount };
  });

  safeRevalidate("/school/import-center");
  safeRevalidate("/students");

  return {
    success: true,
    totalProcessed: rows.length,
    createdCount: commitResult.createdCount,
    skippedCount: commitResult.skippedCount,
    errors: [],
    rejectedRowsCsv: "",
    message: `Successfully processed ${rows.length} rows (${commitResult.createdCount} created, ${commitResult.skippedCount} skipped).`,
  };
}

/**
 * Dry-run preview validator for bulk STAFF import.
 */
export async function validateStaffImportAction(
  rows: Record<string, string>[]
): Promise<DryRunValidationSummary> {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  enforceImportRowLimit(rows);

  return await validateStaffImportRows(school.id, rows, db);
}

/**
 * Domain-guarded commit action for bulk STAFF import.
 * - Row-level resilience (Charter BR4).
 * - Role clamping: strictly permits TEACHER, STAFF, ACCOUNTANT.
 * - Idempotency: re-running creates zero duplicates.
 */
export async function commitStaffImportAction(
  rows: Record<string, string>[],
  options?: { allOrNothing?: boolean; resilient?: boolean }
): Promise<ImportCommitResult> {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const reqCtx = getClientRequestContext();

  enforceImportRowLimit(rows);

  // When resilient mode is enabled (Default in D1-L3 ImportCenterClient):
  if (options?.resilient === true) {
    const commitResult = await executeStaffImportBatch(
      schoolId,
      rows,
      {
        userId: ctx.userId,
        userEmail: ctx.email || "admin@schoolmitra.internal",
        userRole: ctx.role,
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
      },
      db
    );

    safeRevalidate("/school/import-center");
    safeRevalidate("/hr");

    return {
      success: commitResult.success,
      totalProcessed: commitResult.totalProcessed,
      createdCount: commitResult.createdCount,
      skippedCount: commitResult.skippedCount,
      duplicatesMergedCount: commitResult.duplicatesMergedCount,
      errors: commitResult.errors,
      rejectedRowsCsv: commitResult.rejectedRowsCsv,
      message: commitResult.message,
      finishedState: commitResult.finishedState,
    };
  }

  // Legacy S21 validation & all-or-nothing rollback behavior
  const validation = validateImportBatch("STAFF", rows);
  const S21_PERMITTED_STAFF_ROLES = new Set(["TEACHER", "STAFF", "ACCOUNTANT"]);

  for (let idx = 0; idx < validation.rows.length; idx++) {
    const r = validation.rows[idx]!;
    const rawRole = (r.data["System Role"] || r.data["role"] || "").toUpperCase().trim();
    if (!S21_PERMITTED_STAFF_ROLES.has(rawRole)) {
      r.errors.push(
        `Role '${rawRole}' is not permitted for bulk staff import. Permitted roles are: TEACHER, STAFF, ACCOUNTANT. Administrative roles must be provisioned via Super Admin console.`
      );
      r.isValid = false;
    }
  }

  const invalidRows = validation.rows.filter((r) => !r.isValid);
  validation.invalidRowsCount = invalidRows.length;
  validation.validRowsCount = validation.rows.length - invalidRows.length;
  validation.canCommit = invalidRows.length === 0;

  if (!validation.canCommit) {
    const rejectedRowsCsv = generateRejectedRowsCsv(validation);
    const lineErrors = invalidRows.flatMap((r) =>
      r.errors.map((err) => (err.startsWith("Line ") ? err : `Line ${r.rowNumber}: ${err}`))
    );
    return {
      success: false,
      totalProcessed: rows.length,
      createdCount: 0,
      skippedCount: 0,
      errors: lineErrors,
      rejectedRowsCsv,
      message: `Validation failed: ${validation.invalidRowsCount} row(s) contain errors. Zero rows were committed.`,
    };
  }

  const commitResult = await withTenant(schoolId, async (tx: Db) => {
    let createdCount = 0;
    let skippedCount = 0;
    const seenEmployeeCodes = new Set<string>();

    // Pre-fetch existing employee codes
    const existingStaffList = await tx.query.staff.findMany({
      where: eq(staff.schoolId, schoolId),
      columns: { employeeCode: true },
    });
    const existingEmployeeCodes = new Set<string>(
      existingStaffList.map((s) => (s.employeeCode || "").toLowerCase().trim())
    );

    // Auto-resolve Departments
    const existingDepts = await tx.query.departments.findMany({
      where: eq(departments.schoolId, schoolId),
    });
    const deptMap = new Map<string, string>();
    for (const d of existingDepts) {
      deptMap.set(d.name.toLowerCase().trim(), d.id);
    }

    // Auto-resolve Designations
    const existingDesigs = await tx.query.designations.findMany({
      where: eq(designations.schoolId, schoolId),
    });
    const desigMap = new Map<string, string>();
    for (const d of existingDesigs) {
      desigMap.set(d.name.toLowerCase().trim(), d.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const empCode = (row["Employee Code"] || row["employeeCode"] || "").trim();
      const empCodeKey = empCode.toLowerCase();

      // Idempotency: skip if already present in DB or earlier in batch
      if (existingEmployeeCodes.has(empCodeKey) || seenEmployeeCodes.has(empCodeKey)) {
        skippedCount++;
        continue;
      }
      seenEmployeeCodes.add(empCodeKey);

      // Auto-resolve Department
      const deptName = (row["Department"] || row["department"] || "General").trim();
      const deptKey = deptName.toLowerCase();
      let targetDeptId: string = deptMap.get(deptKey) || "";
      if (!targetDeptId) {
        const [newDept] = await tx
          .insert(departments)
          .values({
            schoolId,
            name: deptName,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        if (!newDept?.id) throw new Error(`Failed to create department '${deptName}'`);
        targetDeptId = newDept.id as string;
        deptMap.set(deptKey, targetDeptId);
      }

      // Auto-resolve Designation
      const desigName = (row["Designation"] || row["designation"] || "Staff").trim();
      const desigKey = desigName.toLowerCase();
      const rawRole = (row["System Role"] || row["role"] || "STAFF").toUpperCase().trim();
      const isTeaching = rawRole === "TEACHER";

      let targetDesigId: string = desigMap.get(desigKey) || "";
      if (!targetDesigId) {
        const [newDesig] = await tx
          .insert(designations)
          .values({
            schoolId,
            departmentId: targetDeptId,
            name: desigName,
            mappedRole: rawRole,
            isTeaching,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        if (!newDesig?.id) throw new Error(`Failed to create designation '${desigName}'`);
        targetDesigId = newDesig.id as string;
        desigMap.set(desigKey, targetDesigId);
      }

      // User Credentials & Password
      const emailNormalized = (row["Official Email"] || row["email"] || "").trim().toLowerCase();
      const rawMobile = (row["Contact Phone"] || row["phone"] || "").trim();
      const cleanMobile = rawMobile.replace(/\D/g, "").slice(-10) || "0000000000";
      const defaultPassword = generateRoleTempPassword(
        rawRole === "TEACHER" || rawRole === "ACCOUNTANT" ? rawRole : "STAFF",
        cleanMobile
      );
      const passwordHash = await bcrypt.hash(defaultPassword, 12);

      let user = await tx.query.users.findFirst({
        where: and(eq(users.schoolId, schoolId), eq(users.email, emailNormalized)),
      });
      if (!user) {
        const [createdUser] = await tx
          .insert(users)
          .values({
            schoolId,
            email: emailNormalized,
            mobileEncrypted: encryptData(cleanMobile),
            passwordHash,
            mustChangePassword: true,
            isActive: true,
            isEmailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        if (!createdUser?.id)
          throw new Error(`Failed to create user credential for '${emailNormalized}'`);
        user = createdUser;
      }

      // Gender & Date of Birth extraction with safe defaults
      const rawGender = (row["Gender"] || row["gender"] || "").toUpperCase().trim();
      const genderVal = ["MALE", "FEMALE", "OTHER"].includes(rawGender) ? rawGender : "OTHER";

      const rawDob = (
        row["Date of Birth (YYYY-MM-DD)"] ||
        row["Date of Birth"] ||
        row["dob"] ||
        row["dateOfBirth"] ||
        ""
      ).trim();
      const validDob =
        rawDob && !isNaN(new Date(rawDob).getTime()) ? new Date(rawDob) : new Date("1990-01-01");
      const dobString = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : "1990-01-01";

      // Canonical Person Record
      const firstName = (row["First Name"] || row["firstName"] || "").trim();
      const lastName = (row["Last Name"] || row["lastName"] || "").trim();

      await tx.insert(persons).values({
        schoolId,
        userId: user.id,
        primaryType: "STAFF",
        firstNameEncrypted: encryptData(firstName),
        lastNameEncrypted: encryptData(lastName),
        firstNameSearchHash: computeSearchHash(firstName),
        lastNameSearchHash: computeSearchHash(lastName),
        gender: genderVal,
        dateOfBirth: validDob,
        primaryEmailEncrypted: encryptData(emailNormalized),
        primaryMobileEncrypted: encryptData(cleanMobile),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Role Assignment (Guarded to valid system roles: TEACHER, ACCOUNTANT)
      if (rawRole === "TEACHER" || rawRole === "ACCOUNTANT") {
        const systemRole = rawRole as UserRole;
        let targetRole = await tx.query.roles.findFirst({
          where: and(eq(roles.schoolId, schoolId), eq(roles.name, systemRole as any)),
        });
        if (!targetRole) {
          const [createdRole] = await tx
            .insert(roles)
            .values({
              schoolId,
              name: systemRole as any,
              displayName: ROLE_CONFIGS[systemRole]?.displayName || systemRole,
              description: `System role for ${systemRole}`,
              isSystemRole: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          targetRole = createdRole;
        }

        if (targetRole) {
          const existingUr = await tx.query.userRoles.findFirst({
            where: and(
              eq(userRoles.userId, user.id),
              eq(userRoles.roleId, targetRole.id),
              eq(userRoles.schoolId, schoolId)
            ),
          });
          if (!existingUr) {
            await tx.insert(userRoles).values({
              userId: user.id,
              roleId: targetRole.id,
              schoolId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }

      // Staff Profile Record
      const [newStaff] = await tx
        .insert(staff)
        .values({
          schoolId,
          userId: user.id,
          employeeCode: empCode,
          departmentId: targetDeptId,
          designationId: targetDesigId,
          contractType: "PERMANENT",
          joiningDate: new Date(),
          firstNameEncrypted: encryptData(firstName),
          lastNameEncrypted: encryptData(lastName),
          dateOfBirthEncrypted: encryptData(dobString),
          genderEncrypted: encryptData(genderVal),
          mobileEncrypted: encryptData(cleanMobile),
          emailEncrypted: encryptData(emailNormalized),
          isActive: true,
          legalHold: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!newStaff?.id) {
        throw new Error(`Failed to create staff record for employee code '${empCode}'`);
      }

      // Audit Log Record
      await tx.insert(auditLogs).values({
        schoolId,
        userId: ctx.userId,
        userEmail: ctx.email || "[audit-system]",
        userRole: ctx.role as any,
        action: "WRITE",
        tableName: "staff",
        recordId: newStaff.id,
        purposeId: "staff_import",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: {
          employeeCode: empCode,
          departmentId: targetDeptId,
          designationId: targetDesigId,
          role: rawRole,
          source: "bulk_import",
        },
      });

      createdCount++;
    }

    return { createdCount, skippedCount };
  });

  safeRevalidate("/school/import-center");
  safeRevalidate("/hr");

  return {
    success: true,
    totalProcessed: rows.length,
    createdCount: commitResult.createdCount,
    skippedCount: commitResult.skippedCount,
    errors: [],
    rejectedRowsCsv: "",
    message: `Successfully processed ${rows.length} rows (${commitResult.createdCount} created, ${commitResult.skippedCount} skipped).`,
  };
}
