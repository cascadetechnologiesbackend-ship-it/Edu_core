import { db } from "@/db";
import { admissionApplications } from "@/db/schema";
import { desc, count, eq, and } from "drizzle-orm";
import Link from "next/link";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData } from "@/lib/encryption";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export default async function AdmissionsDashboard() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/admissions", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const school = await requireSchool(ctx);

  const [applications, [totalResult], [rteResult]] = await withDataPhaseTiming(
    "/admissions",
    () =>
      assertQueryBudget(
        async () => {
          const applicationsPromise = db.query.admissionApplications.findMany({
            where: eq(admissionApplications.schoolId, school.id),
            orderBy: [desc(admissionApplications.createdAt)],
            limit: 50,
          });

          const totalPromise = db
            .select({ value: count() })
            .from(admissionApplications)
            .where(eq(admissionApplications.schoolId, school.id));

          const rtePromise = db
            .select({ value: count() })
            .from(admissionApplications)
            .where(
              and(
                eq(admissionApplications.schoolId, school.id),
                eq(admissionApplications.isRteApplicant, true)
              )
            );

          return Promise.all([
            applicationsPromise,
            totalPromise,
            rtePromise,
          ]);
        },
        { maxQueries: 5, label: "Admissions Dashboard" },
      ),
  );

  const totalApps = totalResult?.value ?? 0;
  const rteApps = rteResult?.value ?? 0;
  const rtePercentage =
    totalApps > 0 ? Math.round((rteApps / totalApps) * 100) : 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Admissions
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage student applications and enrolments.
          </p>
        </div>
        <Link href="/admissions/new" className="w-full sm:w-auto">
          <button className="w-full sm:w-auto min-h-[44px] bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center text-sm">
            + New Admission
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-slate-800">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Applications
          </h3>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {totalApps}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-slate-800">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
            RTE 25% Quota Tracker
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {rteApps}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              ({rtePercentage}% of total)
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${rtePercentage >= 25 ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${Math.min(rtePercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {rtePercentage >= 25
              ? "Quota met or exceeded"
              : "Below 25% mandate"}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-3 font-medium">App No</th>
                <th className="px-6 py-3 font-medium">Applicant Name</th>
                <th className="px-6 py-3 font-medium">Grade</th>
                <th className="px-6 py-3 font-medium">Parent Contact</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No admission applications found.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium">
                      <Link
                        href={`/admissions/${app.id}`}
                        className="text-primary hover:underline font-semibold"
                      >
                        {app.applicationNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {decryptData(app.applicantNameEncrypted)}
                    </td>
                    <td className="px-6 py-4">
                      {app.gradeAppliedFor.replace("_", " ")}
                    </td>
                    <td className="px-6 py-4">
                      {decryptData(app.primaryContactMobileEncrypted)}
                    </td>
                    <td className="px-6 py-4">
                      {app.createdAt?.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (< 768px per UX-R47) */}
        <div className="block md:hidden p-3 space-y-3">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No admission applications found.
            </div>
          ) : (
            applications.map((app) => (
              <div
                key={app.id}
                className="p-3.5 bg-gray-50/70 dark:bg-slate-800/40 rounded-xl border border-gray-200/80 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">
                      {decryptData(app.applicantNameEncrypted)}
                    </h4>
                    <p className="font-mono text-xs text-primary font-medium mt-0.5">
                      {app.applicationNumber}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 flex-shrink-0">
                    {app.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium">
                    Grade: {app.gradeAppliedFor.replace("_", " ")}
                  </span>
                  <span>Contact: {decryptData(app.primaryContactMobileEncrypted)}</span>
                  <span>{app.createdAt?.toLocaleDateString()}</span>
                </div>

                <Link
                  href={`/admissions/${app.id}`}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-all active:scale-95 shadow-sm mt-1"
                >
                  Review Application →
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
