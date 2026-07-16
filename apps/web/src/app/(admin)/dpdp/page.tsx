import { db } from "@/db";
import {
  consentPurposes,
  consentRecords,
  vendorRegister,
  students,
  staff,
} from "@/db/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DpdpDashboardClient from "./DpdpDashboardClient";

export const metadata = {
  title: "DPDP Compliance Centre | SchoolMitra ERP",
  description:
    "Administrative console for DPDP Act 2023 compliance audits, data purges, and consent coverage",
};

export default async function DpdpPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  // Authorize HR_MANAGER or SUPER_ADMIN / SCHOOL_ADMIN
  const isAuthorized = ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"].includes(
    session.user.role,
  );
  if (!isAuthorized) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold text-red-650">Access Denied</h2>
        <p className="text-slate-500 mt-2">
          You do not have administrative permissions to view the compliance
          centre.
        </p>
      </div>
    );
  }

  // 1. Consent coverage dynamic calculations
  const allStudents = await db.query.students.findMany({
    where: eq(students.isActive, true),
  });
  const totalStudentsCount = allStudents.length;

  const purposes = await db.query.consentPurposes.findMany({
    where: eq(consentPurposes.isActive, true),
  });

  const consentMetrics = [];
  for (const p of purposes) {
    let grantedCount = 0;
    for (const student of allStudents) {
      const latest = await db.query.consentRecords.findFirst({
        where: and(
          eq(consentRecords.studentId, student.id),
          eq(consentRecords.purposeId, p.purposeId),
        ),
        orderBy: (t, { desc }) => [desc(t.grantedAt)],
      });
      if (latest && latest.granted) {
        grantedCount++;
      }
    }

    const percentage =
      totalStudentsCount > 0
        ? Math.round((grantedCount / totalStudentsCount) * 100)
        : 0;
    consentMetrics.push({
      purposeId: p.purposeId,
      labelEn: p.labelEn,
      mandatory: p.mandatory,
      grantedCount,
      percentage,
    });
  }

  // 2. Pending rights requests queue
  const pendingRequests = await db.query.rightsRequests.findMany({
    orderBy: (t, { asc }) => [asc(t.dueAt)],
  });

  // 3. DPDP Grievances queue
  const pendingGrievances = await db.query.dpdpGrievances.findMany({
    orderBy: (t, { asc }) => [asc(t.dueAt)],
  });

  // 4. Upcoming data purge schedule (records that are soft-deleted but not hard-purged yet)
  const softDeletedStudents = await db.query.students.findMany({
    where: isNotNull(students.deletedAt),
    limit: 50,
  });

  const softDeletedStaff = await db.query.staff.findMany({
    where: isNotNull(staff.deletedAt),
    limit: 50,
  });

  // 5. Vendor DPA Register
  const vendors = await db.query.vendorRegister.findMany({
    where: isNull(vendorRegister.deletedAt),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  // 6. Data breaches logs
  const breaches = await db.query.dataBreachLog.findMany({
    orderBy: (t, { desc }) => [desc(t.detectedAt)],
  });

  // 7. Last 100 DPDP Audit Logs
  const logs = await db.query.auditLogs.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 100,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          DPDP Compliance Centre
        </h1>
        <p className="text-sm text-slate-500">
          Admin Console — Audit trails, consent coverage levels, SLA queues, and
          data retention schedules.
        </p>
      </div>

      <DpdpDashboardClient
        totalStudentsCount={totalStudentsCount}
        consentMetrics={consentMetrics}
        initialRequests={pendingRequests}
        initialGrievances={pendingGrievances}
        softDeletedStudents={softDeletedStudents}
        softDeletedStaff={softDeletedStaff}
        vendors={vendors}
        breaches={breaches}
        auditLogs={logs}
      />
    </div>
  );
}
