import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function GET(
  _request: Request,
  context: { params: { jobId: string } }
) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "HR_MANAGER",
      "ACCOUNTANT",
    ] as const);
    const school = await requireSchool(ctx);

    const { jobId } = context.params;
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId parameter." }, { status: 400 });
    }

    const row = await withTenant(school.id, async (tx) => {
      const result = await tx.execute(sql`
        SELECT id, school_id, job_type, dataset_key, format, status, record_count, error_count, created_at, updated_at
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
            created_at: string;
            updated_at: string;
          }
        | undefined;
    });

    if (!row) {
      return NextResponse.json({ error: "Import/export job not found." }, { status: 404 });
    }

    return NextResponse.json({
      jobId: row.id,
      schoolId: row.school_id,
      jobType: row.job_type,
      datasetKey: row.dataset_key,
      format: row.format,
      status: row.status,
      recordCount: row.record_count,
      errorCount: row.error_count,
      downloadUrl:
        row.status === "COMPLETED"
          ? `/api/import-export/jobs/${encodeURIComponent(jobId)}/download`
          : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch job status";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
