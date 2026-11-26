export const dynamic = "force-dynamic";

import { db, withTenant } from "@/db";
import { academicYears } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { UploadCloud, Sparkles } from "lucide-react";
import { ImportCenterClient, type ImportExportJobSummary } from "./ImportCenterClient";
import { canRoleExportDataset, canRoleImportDataset } from "@/lib/importExportEngine";

export default async function ImportCenterPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;
  const userRole = String(session.user.role || "SCHOOL_ADMIN");

  const [allYears, initialJobs] = await Promise.all([
    db.query.academicYears.findMany({
      where: eq(academicYears.schoolId, schoolId),
      orderBy: [desc(academicYears.startDate)],
    }),
    withTenant(schoolId, async (tx) => {
      const res = await tx.execute(sql`
        SELECT
          id, job_type, dataset_key, format, status,
          record_count, error_count, file_key, error_csv_key, metadata,
          expires_at, created_at
        FROM import_export_jobs
        WHERE school_id = ${schoolId}
        ORDER BY created_at DESC
        LIMIT 25
      `);
      return (res.rows as any[])
        .filter((r) =>
          r.job_type === "IMPORT"
            ? canRoleImportDataset(userRole, r.dataset_key)
            : canRoleExportDataset(userRole, r.dataset_key)
        )
        .map((r): ImportExportJobSummary => {
          const isExpired =
            r.status === "EXPIRED" ||
            (r.expires_at ? new Date(r.expires_at).getTime() < Date.now() : false);
          return {
            jobId: r.id,
            jobType: r.job_type,
            datasetKey: r.dataset_key,
            format: r.format,
            status: isExpired ? "EXPIRED" : r.status,
            recordCount: r.record_count,
            errorCount: r.error_count,
            errorMessage:
              typeof r.metadata?.errorMessage === "string" ? r.metadata.errorMessage : null,
            downloadUrl:
              !isExpired && r.job_type === "EXPORT" && r.status === "COMPLETED" && r.file_key
                ? `/api/import-export/jobs/${encodeURIComponent(r.id)}/download`
                : null,
            errorDownloadUrl:
              !isExpired && r.error_csv_key
                ? `/api/import-export/jobs/${encodeURIComponent(r.id)}/download?type=errors`
                : null,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          };
        });
    }).catch(() => [] as ImportExportJobSummary[]),
  ]);

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" />

      {/* Header Banner - Law 1: H1 names the job */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <UploadCloud className="w-3.5 h-3.5" /> Day One Onboarding & Data Exchange
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Import & export school records across modules
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resilient bulk onboarding plus tenant-isolated CSV, Excel, and school-branded PDF exports with audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Charter BR4: Row-level resilience enabled</span>
        </div>
      </div>

      <ImportCenterClient
        academicYears={allYears.map((y) => ({
          id: y.id,
          name: y.label,
          isActive: y.isActive,
        }))}
        userRole={userRole}
        initialJobs={initialJobs}
      />
    </div>
  );
}
