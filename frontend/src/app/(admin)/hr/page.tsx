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
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import HRDashboardClient from "./HRDashboardClient";
import { decryptData } from "@/lib/encryption";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export const metadata: Metadata = {
  title: "HR & Payroll | SchoolMitra ERP",
  description:
    "Manage staff, designations, departments, leave balances, and payroll runs",
};

export default async function HRPage() {
  const session = await getCachedSession();
  if (!session?.user?.schoolId) redirect("/login");

  const access = assertRouteAccess(session.user.role, "/hr", { id: session.user.id, email: session.user.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;

  const data = await withDataPhaseTiming("/hr", async () => {
    return assertQueryBudget(
      async () => {
        // Run all independent queries in parallel for high performance (PF-R125)
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
            },
            orderBy: (t, { desc }) => [desc(t.createdAt)],
          }),
          db.query.departments.findMany({
            where: eq(departments.schoolId, schoolId),
            with: {
              hod: true,
            },
            orderBy: (t, { asc }) => [asc(t.name)],
          }),
          db.query.designations.findMany({
            where: eq(designations.schoolId, schoolId),
            with: {
              department: true,
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

        return {
          activeYear,
          school,
          allStaff,
          allDepartments,
          allDesignations,
          allLeaveTypes,
          allLeaveRequests,
          allSalaryTemplates,
          allPayrollRuns,
        };
      },
      { maxQueries: 10, label: "HR & Payroll" }
    );
  });

  // Decrypt staff names on the server side securely for authorized users
  const decryptField = (val: string | null) => {
    if (!val) return "";
    try {
      return decryptData(val) || "";
    } catch {
      return "[Encrypted]";
    }
  };

  const decryptedStaff = data.allStaff.map((s) => ({
    ...s,
    firstName: decryptField(s.firstNameEncrypted),
    lastName: decryptField(s.lastNameEncrypted),
    mobile: decryptField(s.mobileEncrypted),
    email: decryptField(s.emailEncrypted),
  }));

  return (
    <HRDashboardClient
      session={session}
      activeYear={data.activeYear ?? null}
      school={data.school ?? null}
      staffList={decryptedStaff}
      departments={data.allDepartments}
      designations={data.allDesignations}
      leaveTypes={data.allLeaveTypes}
      leaveRequests={data.allLeaveRequests}
      salaryTemplates={data.allSalaryTemplates}
      payrollRuns={data.allPayrollRuns}
    />
  );
}
