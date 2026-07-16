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
} from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { encryptData, decryptData } from "@/lib/encryption";
import { z } from "zod";
import { runPayrollCalculations } from "@/lib/payrollEngine";

// ─── STaff PII Reveal Action (DPDP Restricted) ────────────────────────────────
export async function revealStaffPii(staffId: string, field: "pan" | "bank") {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    if (
      session.user.role !== "HR_MANAGER" &&
      session.user.role !== "SUPER_ADMIN"
    ) {
      return {
        success: false,
        message: "Access denied: HR Manager role required",
      };
    }

    const staffRecord = await db.query.staff.findFirst({
      where: eq(staff.id, staffId),
    });

    if (!staffRecord) return { success: false, message: "Staff not found" };

    let decrypted = "";
    if (field === "pan") {
      decrypted = decryptData(staffRecord.panEncrypted) ?? "—";
    } else {
      const acc = decryptData(staffRecord.bankAccountEncrypted) ?? "—";
      const ifsc = decryptData(staffRecord.bankIfscEncrypted) ?? "—";
      const bank = decryptData(staffRecord.bankNameEncrypted) ?? "—";
      decrypted = `${bank} | A/C: ${acc} | IFSC: ${ifsc}`;
    }

    // Write to DPDP Audit Log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      userEmail: "[audit-redacted]",
      userRole: session.user.role,
      schoolId: session.user.schoolId ?? staffRecord.schoolId,
      action: "READ",
      tableName: "staff",
      recordId: staffId,
      purposeId: "hr_records",
      ipAddress: "127.0.0.1",
      userAgent: "Server Action Reveal",
      metadata: { revealedField: field },
    });

    return { success: true, decrypted };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Staff CRUD Actions ────────────────────────────────────────────────────────
const CreateStaffSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(1),
  dateOfBirth: z.string(),
  gender: z.string(),
  mobile: z.string().min(10),
  email: z.string().email(),
  address: z.string().optional(),
  employeeCode: z.string().min(2),
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
  aadhaarLast4: z.string().length(4),
  pan: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.string().optional(),
});

export async function createStaff(input: z.infer<typeof CreateStaffSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const parsed = CreateStaffSchema.parse(input);

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    // Create user login credential first
    const dummyPasswordHash =
      "$2a$12$5IoYcudrg1ffKr7WS8sKVO3Xe./e.J7LaHap2qSMFpTmQgo9otUCm"; // schoolmitra_dev
    const [newUser] = await db
      .insert(users)
      .values({
        schoolId: school.id,
        email: parsed.email,
        passwordHash: dummyPasswordHash,
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!newUser)
      return { success: false, message: "Failed to create user credential" };

    // Bind Teacher or Staff role
    const staffRole = await db.query.roles.findFirst({
      where: and(eq(roles.schoolId, school.id), eq(roles.name, "TEACHER")),
    });

    if (staffRole) {
      await db.insert(userRoles).values({
        userId: newUser.id,
        roleId: staffRole.id,
        schoolId: school.id,
      });
    }

    // Insert staff record
    await db.insert(staff).values({
      schoolId: school.id,
      userId: newUser.id,
      employeeCode: parsed.employeeCode,
      departmentId: parsed.departmentId,
      designationId: parsed.designationId,
      contractType: parsed.contractType,
      joiningDate: new Date(parsed.joiningDate),
      firstNameEncrypted: encryptData(parsed.firstName),
      lastNameEncrypted: encryptData(parsed.lastName),
      dateOfBirthEncrypted: encryptData(parsed.dateOfBirth),
      genderEncrypted: encryptData(parsed.gender),
      mobileEncrypted: encryptData(parsed.mobile),
      emailEncrypted: encryptData(parsed.email),
      addressEncrypted: parsed.address ? encryptData(parsed.address) : null,
      aadhaarLast4: parsed.aadhaarLast4,
      panEncrypted: parsed.pan ? encryptData(parsed.pan) : null,
      bankNameEncrypted: parsed.bankName ? encryptData(parsed.bankName) : null,
      bankAccountEncrypted: parsed.bankAccount
        ? encryptData(parsed.bankAccount)
        : null,
      bankIfscEncrypted: parsed.bankIfsc ? encryptData(parsed.bankIfsc) : null,
      qualification: parsed.qualification || null,
      experience: parsed.experience || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath("/hr/staff");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function confirmStaffProbation(staffId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db
      .update(staff)
      .set({
        contractType: "PERMANENT",
        confirmationDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staff.id, staffId));

    revalidatePath("/hr/staff");
    return { success: true };
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

    revalidatePath("/hr/leaves");
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

    revalidatePath("/hr/leaves");
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

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

    revalidatePath("/hr/salary-templates");
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

    revalidatePath("/hr/staff");
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

    revalidatePath("/hr/staff");
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

    revalidatePath("/hr/staff");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Payroll Run Actions ──────────────────────────────────────────────────────
export async function runPayrollForMonth(month: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    const activeYear = await db.query.academicYears.findFirst({
      where: eq(academicYears.isActive, true),
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
        processedById: session.user.id,
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

    revalidatePath("/hr/payroll");
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

    revalidatePath("/hr/payroll");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
