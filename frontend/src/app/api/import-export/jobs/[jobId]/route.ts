import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  IMPORT_EXPORT_AUTH_ROLES,
  canRoleExportDataset,
  canRoleImportDataset,
} from "@/lib/importExportEngine";

function mapAuthErrorStatus(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("unauthorized")) return 401;
  if (lower.includes("forbidden")) return 403;
  return 500;
}

export async function GET(
  _request: Request,
  context: { params: { jobId: string } }
) {
  try {
    const ctx = await requireAuth(IMPORT_EXPORT_AUTH_ROLES);
    const school = await requireSchool(ctx);

    const { jobId } = context.params;
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId parameter." }, { status: 400 });
    }

    const row = await withTenant(school.id, async (tx) => {
      const result = await tx.execute(sql`
        SELECT
          id, school_id, job_type, dataset_key, format, status,
          record_count, error_count, file_key, error_csv_key, metadata,
          expires_at, created_at, updated_at
        FROM import_export_jobs
        WHERE id = ${jobId} AND school_id = ${school.id}
        LIMIT 1
      `);
      return result.rows[0] as
        | {
            id: string;
            school_id: string;
            job_type: string;
            dataset_key: string;
            format: string | null;
            status: string;
            record_count: number | null;
            error_count: number | null;
            file_key: string | null;
            error_csv_key: string | null;
            metadata: Record<string, unknown> | null;
            expires_at: string | null;
            created_at: string;
            updated_at: string;
          }
        | undefined;
    });

    if (!row) {
      return NextResponse.json({ error: "Import/export job not found." }, { status: 404 });
    }

    const authorized =
      row.job_type === "IMPORT"
        ? canRoleImportDataset(ctx.role, row.dataset_key)
        : canRoleExportDataset(ctx.role, row.dataset_key);

    if (!authorized) {
      return NextResponse.json(
        { error: `Forbidden: Role ${ctx.role} cannot access ${row.dataset_key} job.` },
        { status: 403 }
      );
    }

    let currentStatus = row.status;
    const isExpired =
      currentStatus === "EXPIRED" ||
      (row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false);

    if (isExpired && currentStatus !== "EXPIRED") {
      currentStatus = "EXPIRED";
      await withTenant(school.id, async (tx) => {
        await tx.execute(sql`
          UPDATE import_export_jobs
          SET status = 'EXPIRED', updated_at = NOW()
          WHERE id = ${jobId} AND school_id = ${school.id}
        `);
      });
    }

    return NextResponse.json({
      jobId: row.id,
      schoolId: row.school_id,
      jobType: row.job_type,
      datasetKey: row.dataset_key,
      format: row.format,
      status: currentStatus,
      recordCount: row.record_count,
      errorCount: row.error_count,
      errorMessage:
        typeof row.metadata?.errorMessage === "string"
          ? row.metadata.errorMessage
          : null,
      downloadUrl:
        !isExpired &&
        row.job_type === "EXPORT" &&
        currentStatus === "COMPLETED" &&
        row.file_key
          ? `/api/import-export/jobs/${encodeURIComponent(jobId)}/download`
          : null,
      errorDownloadUrl:
        !isExpired && row.error_csv_key
          ? `/api/import-export/jobs/${encodeURIComponent(jobId)}/download?type=errors`
          : null,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch job status";
    return NextResponse.json({ error: message }, { status: mapAuthErrorStatus(message) });
  }
}
