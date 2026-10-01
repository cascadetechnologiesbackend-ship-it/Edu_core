import { db } from "@/db";
import {
  academicYears,
  leaveBalances,
  schools,
  staff,
  departments,
  designations,
  leaveTypes,
  leaveRequests,
  salaryTemplates,
  payrollRuns,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import HRDashboardClient from "./HRDashboardClient";

export const metadata: Metadata = {
  title: "HR & Payroll | SchoolMitra ERP",
  description:
    "Manage staff, designations, departments, leave balances, and payroll runs",
};

export default async function HRPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, session.user.schoolId),
    ),
  });

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, session.user.schoolId),
  });

  // Auto-carry forward check on page load if academic year has rolled over
  if (activeYear && school) {
    const activeBalancesExist = await db.query.leaveBalances.findFirst({
      where: eq(leaveBalances.academicYearId, activeYear.id),
    });

    if (!activeBalancesExist) {
      // Find the most recently ended academic year
      const prevYear = await db.query.academicYears.findFirst({
        where: and(
          eq(academicYears.isActive, false),
          eq(academicYears.schoolId, school.id),
        ),
        orderBy: (t, { desc }) => [desc(t.endDate)],
      });

      if (prevYear) {
        try {
          const { carryForwardLeaveBalances } = require("@/lib/leaveEngine");
          await carryForwardLeaveBalances(
            school.id,
            prevYear.id,
            activeYear.id,
          );
        } catch (e) {
          console.error("Auto carry-forward leaves failed:", e);
        }
      }
    }
  }

  const allStaff = await db.query.staff.findMany({
    where: eq(staff.schoolId, session.user.schoolId),
    with: {
      user: true,
      department: true,
      designation: true,
      salaryComponents: true,
      loans: true,
      documents: true,
      leaveBalances: true,
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const allDepartments = await db.query.departments.findMany({
    where: eq(departments.schoolId, session.user.schoolId),
    with: {
      staff: true,
      hod: true,
    },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const allDesignations = await db.query.designations.findMany({
    where: eq(designations.schoolId, session.user.schoolId),
    with: {
      department: true,
      staff: true,
    },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const allLeaveTypes = await db.query.leaveTypes.findMany({
    where: eq(leaveTypes.schoolId, session.user.schoolId),
  });

  const allLeaveRequests = await db.query.leaveRequests.findMany({
    where: eq(leaveRequests.schoolId, session.user.schoolId),
    with: {
      staff: true,
      leaveType: true,
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const allSalaryTemplates = await db.query.salaryTemplates.findMany({
    where: eq(salaryTemplates.schoolId, session.user.schoolId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const allPayrollRuns = await db.query.payrollRuns.findMany({
    where: eq(payrollRuns.schoolId, session.user.schoolId),
    orderBy: (t, { desc }) => [desc(t.month)],
  });

  // Decrypt staff names on the server side securely for authorized users
  const decryptedStaff = allStaff.map((s) => {
    // Decrypt names using the AES decryption helper
    // If the user role is not authorized or decryption fails, it defaults gracefully
    const decryptField = (val: string | null) => {
      if (!val) return "";
      try {
        const { decryptData } = require("@/lib/encryption");
        return decryptData(val) || "";
      } catch {
        return "[Encrypted]";
      }
    };

    return {
      ...s,
      firstName: decryptField(s.firstNameEncrypted),
      lastName: decryptField(s.lastNameEncrypted),
      mobile: decryptField(s.mobileEncrypted),
      email: decryptField(s.emailEncrypted),
    };
  });

  return (
    <HRDashboardClient
      session={session}
      activeYear={activeYear ?? null}
      school={school ?? null}
      staffList={decryptedStaff}
      departments={allDepartments}
      designations={allDesignations}
      leaveTypes={allLeaveTypes}
      leaveRequests={allLeaveRequests}
      salaryTemplates={allSalaryTemplates}
      payrollRuns={allPayrollRuns}
    />
  );
}
