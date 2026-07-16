import { db } from "@/db";
import {
  academicYears,
  leaveBalances,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import HRDashboardClient from "./HRDashboardClient";

export const metadata: Metadata = {
  title: "HR & Payroll | SchoolMitra ERP",
  description: "Manage staff, designations, departments, leave balances, and payroll runs",
};

export default async function HRPage() {
  const session = await auth();

  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  const school = await db.query.schools.findFirst();

  // Auto-carry forward check on page load if academic year has rolled over
  if (activeYear && school) {
    const activeBalancesExist = await db.query.leaveBalances.findFirst({
      where: eq(leaveBalances.academicYearId, activeYear.id),
    });

    if (!activeBalancesExist) {
      // Find the most recently ended academic year
      const prevYear = await db.query.academicYears.findFirst({
        where: eq(academicYears.isActive, false),
        orderBy: (t, { desc }) => [desc(t.endDate)],
      });

      if (prevYear) {
        try {
          const { carryForwardLeaveBalances } = require("@/lib/leaveEngine");
          await carryForwardLeaveBalances(school.id, prevYear.id, activeYear.id);
        } catch (e) {
          console.error("Auto carry-forward leaves failed:", e);
        }
      }
    }
  }

  const allStaff = await db.query.staff.findMany({
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
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const allDesignations = await db.query.designations.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const allLeaveTypes = await db.query.leaveTypes.findMany();

  const allLeaveRequests = await db.query.leaveRequests.findMany({
    with: {
      staff: true,
      leaveType: true,
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const allSalaryTemplates = await db.query.salaryTemplates.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const allPayrollRuns = await db.query.payrollRuns.findMany({
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
