import { db } from "@/db";
import {
  consentPurposes,
  consentRecords,
  vendorRegister,
  students,
  staff,
  rightsRequests,
  dpdpGrievances,
  dataBreachLog,
  auditLogs,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import DpdpDashboardClient from "./DpdpDashboardClient";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export const metadata = {
  title: "DPDP Compliance Centre | SchoolMitra ERP",
  description:
    "Administrative console for DPDP Act 2023 compliance audits, data purges, and consent coverage",
};

export default async function DpdpPage() {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const access = assertRouteAccess(session.user.role, "/dpdp", { id: session.user.id, email: session.user.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    redirect("/login");
  }

  const data = await withDataPhaseTiming("/dpdp", async () => {
    return assertQueryBudget(
      async () => {
        // Run all queries concurrently in a single Promise.all (PF-R125)
        const [
          purposes,
          [studentCountRes],
          consentCounts,
          pendingRequests,
          pendingGrievances,
          softDeletedStudents,
          softDeletedStaff,
          vendors,
          breaches,
          logs,
        ] = await Promise.all([
          db.query.consentPurposes.findMany({
            where: eq(consentPurposes.isActive, true),
          }),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(students)
            .where(
              and(
                eq(students.schoolId, schoolId),
                eq(students.isActive, true),
                isNull(students.deletedAt)
              )
            ),
          db
            .select({
              purposeId: consentRecords.purposeId,
              grantedCount: sql<number>`count(distinct ${consentRecords.studentId})::int`,
            })
            .from(consentRecords)
            .where(
              and(
                eq(consentRecords.schoolId, schoolId),
                eq(consentRecords.granted, true),
                isNull(consentRecords.withdrawnAt)
              )
            )
            .groupBy(consentRecords.purposeId),
          db.query.rightsRequests.findMany({
            where: eq(rightsRequests.schoolId, schoolId),
            orderBy: (t, { asc }) => [asc(t.dueAt)],
            limit: 50,
          }),
          db.query.dpdpGrievances.findMany({
            where: eq(dpdpGrievances.schoolId, schoolId),
            orderBy: (t, { asc }) => [asc(t.dueAt)],
            limit: 50,
          }),
          db.query.students.findMany({
            where: and(eq(students.schoolId, schoolId), isNotNull(students.deletedAt)),
            limit: 50,
          }),
          db.query.staff.findMany({
            where: and(eq(staff.schoolId, schoolId), isNotNull(staff.deletedAt)),
            limit: 50,
          }),
          db.query.vendorRegister.findMany({
            where: and(eq(vendorRegister.schoolId, schoolId), isNull(vendorRegister.deletedAt)),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: 50,
          }),
          db.query.dataBreachLog.findMany({
            where: eq(dataBreachLog.schoolId, schoolId),
            orderBy: (t, { desc }) => [desc(t.detectedAt)],
            limit: 50,
          }),
          db.query.auditLogs.findMany({
            where: eq(auditLogs.schoolId, schoolId),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: 100,
          }),
        ]);

        const totalStudentsCount = Number(studentCountRes?.count ?? 0);
        const consentCountMap = new Map(
          consentCounts.map((c) => [c.purposeId, Number(c.grantedCount)])
        );

        const consentMetrics = purposes.map((p) => {
          const grantedCount = consentCountMap.get(p.purposeId) || 0;
          const percentage =
            totalStudentsCount > 0
              ? Math.round((grantedCount / totalStudentsCount) * 100)
              : 0;
          return {
            purposeId: p.purposeId,
            labelEn: p.labelEn,
            mandatory: p.mandatory,
            grantedCount,
            percentage,
          };
        });

        return {
          totalStudentsCount,
          consentMetrics,
          pendingRequests,
          pendingGrievances,
          softDeletedStudents,
          softDeletedStaff,
          vendors,
          breaches,
          logs,
        };
      },
      { maxQueries: 10, label: "DPDP Compliance Centre" }
    );
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
        totalStudentsCount={data.totalStudentsCount}
        consentMetrics={data.consentMetrics}
        initialRequests={data.pendingRequests}
        initialGrievances={data.pendingGrievances}
        softDeletedStudents={data.softDeletedStudents}
        softDeletedStaff={data.softDeletedStaff}
        vendors={data.vendors}
        breaches={data.breaches}
        auditLogs={data.logs}
      />
    </div>
  );
}
