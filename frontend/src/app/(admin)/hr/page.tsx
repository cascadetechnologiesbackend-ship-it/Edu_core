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

import { decryptData } from "@/lib/encryption";

export const metadata: Metadata = {
  title: "HR & Payroll | SchoolMitra ERP",
  description:
    "Manage staff, designations, departments, leave balances, and payroll runs",
};

export default async function HRPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  // Run all independent queries in parallel for high performance
  const [
    activeYear,
    school,
    allStaff,
    allDepartments,
    allDesignations,
    allLeaveTypes,
    allLeaveRequests,
    allSalaryTemplates,
    allPayrollRuns,
  ] = await Promise.all([
    db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.isActive, true),
        eq(academicYears.schoolId, schoolId),
      ),
    }),
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.staff.findMany({
      where: eq(staff.schoolId, schoolId),
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
    }),
    db.query.departments.findMany({
      where: eq(departments.schoolId, schoolId),
      with: {
        staff: true,
        hod: true,
      },
      orderBy: (t, { asc }) => [asc(t.name)],
    }),
    db.query.designations.findMany({
      where: eq(designations.schoolId, schoolId),
      with: {
        department: true,
        staff: true,
      },
      orderBy: (t, { asc }) => [asc(t.name)],
    }),
    db.query.leaveTypes.findMany({
      where: eq(leaveTypes.schoolId, schoolId),
    }),
    db.query.leaveRequests.findMany({
      where: eq(leaveRequests.schoolId, schoolId),
      with: {
        staff: true,
        leaveType: true,
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
    db.query.salaryTemplates.findMany({
      where: eq(salaryTemplates.schoolId, schoolId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
    db.query.payrollRuns.findMany({
      where: eq(payrollRuns.schoolId, schoolId),
      orderBy: (t, { desc }) => [desc(t.month)],
    }),
  ]);

  // Auto-carry forward check on page load if academic year has rolled over
  if (activeYear && school) {
    const activeBalancesExist = await db.query.leaveBalances.findFirst({
      where: eq(leaveBalances.academicYearId, activeYear.id),
    });

    if (!activeBalancesExist) {
      const prevYear = await db.query.academicYears.findFirst({
        where: and(
          eq(academicYears.isActive, false),
          eq(academicYears.schoolId, school.id),
        ),
        orderBy: (t, { desc }) => [desc(t.endDate)],
      });

      if (prevYear) {
        try {
          const { carryForwardLeaveBalances } = await import("@/lib/leaveEngine");
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

  // Decrypt staff names on the server side securely for authorized users
  const decryptField = (val: string | null) => {
    if (!val) return "";
    try {
      return decryptData(val) || "";
    } catch {
      return "[Encrypted]";
    }
  };

  const decryptedStaff = allStaff.map((s) => ({
    ...s,
    firstName: decryptField(s.firstNameEncrypted),
    lastName: decryptField(s.lastNameEncrypted),
    mobile: decryptField(s.mobileEncrypted),
    email: decryptField(s.emailEncrypted),
  }));

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
