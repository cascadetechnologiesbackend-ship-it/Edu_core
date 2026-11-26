import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getClientRequestContext } from "@/lib/requestContext";
import { downloadBufferFromS3, validateSchoolScopedKey } from "@/lib/storage";
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
  request: Request,
  context: { params: { jobId: string } }
) {
  try {
    const ctx = await requireAuth(IMPORT_EXPORT_AUTH_ROLES);
    const school = await requireSchool(ctx);
    const reqCtx = getClientRequestContext();

    const { jobId } = context.params;
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId parameter." }, { status: 400 });
    }

    const downloadType = new URL(request.url).searchParams.get("type");

    const row = await withTenant(school.id, async (tx) => {
      const result = await tx.execute(sql`
        SELECT
          id, school_id, job_type, dataset_key, format, status,
          file_key, error_csv_key, expires_at
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
            file_key: string | null;
            error_csv_key: string | null;
            expires_at: string | null;
          }
        | undefined;
    });

    if (!row || row.school_id !== school.id) {
      return NextResponse.json({ error: "Import/export job not found." }, { status: 404 });
    }

    const authorized =
      row.job_type === "IMPORT"
        ? canRoleImportDataset(ctx.role, row.dataset_key)
        : canRoleExportDataset(ctx.role, row.dataset_key);

    if (!authorized) {
      return NextResponse.json(
        { error: `Forbidden: Role ${ctx.role} cannot download ${row.dataset_key} artifact.` },
        { status: 403 }
      );
    }

    const isExpired =
      row.status === "EXPIRED" ||
      (row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false);

    if (isExpired) {
      if (row.status !== "EXPIRED") {
        await withTenant(school.id, async (tx) => {
          await tx.execute(sql`
            UPDATE import_export_jobs
            SET status = 'EXPIRED', updated_at = NOW()
            WHERE id = ${jobId} AND school_id = ${school.id}
          `);
        });
      }
      return NextResponse.json(
        { error: "This export/import artifact has expired." },
        { status: 410 }
      );
    }

    const targetKey = downloadType === "errors" ? row.error_csv_key : row.file_key;
    if (!targetKey) {
      return NextResponse.json(
        { error: "Requested artifact is not available for this job." },
        { status: 404 }
      );
    }

    if (!validateSchoolScopedKey(targetKey, school.id)) {
      return NextResponse.json(
        { error: "Forbidden: Storage key outside tenant scope." },
        { status: 403 }
      );
    }

    const fileBuffer = await downloadBufferFromS3(targetKey, school.id);

    const isErrors = downloadType === "errors";
    const lowerKey = targetKey.toLowerCase();
    let contentType = "text/csv; charset=utf-8";
    let ext = "csv";
    if (!isErrors && lowerKey.endsWith(".xlsx")) {
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = "xlsx";
    } else if (!isErrors && lowerKey.endsWith(".pdf")) {
      contentType = "application/pdf";
      ext = "pdf";
    }

    const safeDataset = row.dataset_key.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const filename = isErrors
      ? `${safeDataset}_errors_${jobId.slice(0, 8)}.csv`
      : `${safeDataset}_export_${jobId.slice(0, 8)}.${ext}`;

    await withTenant(school.id, async (tx) => {
      await tx.insert(auditLogs).values({
        schoolId: school.id,
        userId: ctx.userId,
        userEmail: ctx.email || "admin@schoolmitra.internal",
        userRole: ctx.role,
        action: "EXPORT",
        tableName: "import_export_jobs",
        recordId: jobId,
        purposeId: isErrors ? "import_error_csv_download" : "bulk_export_download",
        ipAddress: reqCtx.ipAddress || "0.0.0.0",
        userAgent: reqCtx.userAgent || "NextAPI",
        metadata: {
          datasetKey: row.dataset_key,
          jobType: row.job_type,
          format: ext.toUpperCase(),
          downloadType: isErrors ? "errors" : "artifact",
        },
      });
    });

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to download artifact";
    const lower = message.toLowerCase();
    if (lower.includes("enoent") || lower.includes("nosuchkey")) {
      return NextResponse.json({ error: "Artifact file not found in storage." }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: mapAuthErrorStatus(message) });
  }
}
