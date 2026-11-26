import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getClientRequestContext } from "@/lib/requestContext";
import { getBullMQValkeyConnection, getRedisUrl } from "@/lib/redisConnection";
import { executeImportExportJob } from "@schoolmitra/backend/lib/importExportProcessor";
import {
  DATASET_SCHEMAS,
  IMPORT_EXPORT_AUTH_ROLES,
  canRoleExportDataset,
  type ImportDatasetKey,
} from "@/lib/importExportEngine";

const VALID_FORMATS = new Set(["CSV", "XLSX", "PDF"]);
const VALID_SCOPES = new Set(["all", "filtered", "dateRange"]);

function mapAuthErrorStatus(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("unauthorized")) return 401;
  if (lower.includes("forbidden")) return 403;
  return 500;
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth(IMPORT_EXPORT_AUTH_ROLES);
    const school = await requireSchool(ctx);
    const reqCtx = getClientRequestContext();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const datasetKey = String(body.datasetKey || "").toUpperCase() as ImportDatasetKey;
    const format = String(body.format || "").toUpperCase();
    const scope = String(body.scope || "all");
    const columns = Array.isArray(body.columns) ? body.columns.map(String) : [];
    const dateFrom = body.dateFrom ? String(body.dateFrom) : undefined;
    const dateTo = body.dateTo ? String(body.dateTo) : undefined;
    const academicYearId = body.academicYearId ? String(body.academicYearId) : undefined;
    const classId = body.classId ? String(body.classId) : undefined;
    const sectionId = body.sectionId ? String(body.sectionId) : undefined;

    if (!DATASET_SCHEMAS[datasetKey]) {
      return NextResponse.json(
        { error: `Invalid export datasetKey: ${datasetKey || "missing"}` },
        { status: 400 }
      );
    }

    if (!canRoleExportDataset(ctx.role, datasetKey)) {
      return NextResponse.json(
        { error: `Forbidden: Role ${ctx.role} is not authorized to export ${datasetKey}.` },
        { status: 403 }
      );
    }

    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json(
        { error: `Invalid export format: ${format}. Must be CSV, XLSX, or PDF.` },
        { status: 400 }
      );
    }

    if (!VALID_SCOPES.has(scope)) {
      return NextResponse.json(
        { error: `Invalid export scope: ${scope}.` },
        { status: 400 }
      );
    }

    if (scope === "dateRange") {
      if (!dateFrom || !dateTo) {
        return NextResponse.json(
          { error: "dateFrom and dateTo are required when scope is dateRange." },
          { status: 400 }
        );
      }
      if (dateFrom > dateTo) {
        return NextResponse.json(
          { error: "dateFrom cannot be after dateTo." },
          { status: 400 }
        );
      }
    }

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const filters = {
      scope,
      columns,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
    };
    const metadataJson = JSON.stringify(filters);

    await withTenant(school.id, async (tx) => {
      await tx.execute(sql`
        INSERT INTO import_export_jobs (
          id, school_id, created_by, job_type, module, dataset_key, status, format, metadata, expires_at
        ) VALUES (
          ${jobId}, ${school.id}, ${ctx.userId}, 'EXPORT', 'DATA_EXCHANGE', ${datasetKey}, 'QUEUED', ${format}, ${metadataJson}::jsonb, NOW() + interval '7 days'
        )
      `);

      await tx.insert(auditLogs).values({
        schoolId: school.id,
        userId: ctx.userId,
        userEmail: ctx.email || "admin@schoolmitra.internal",
        userRole: ctx.role,
        action: "EXPORT",
        tableName: "import_export_jobs",
        recordId: jobId,
        purposeId: "bulk_data_export_requested",
        ipAddress: reqCtx.ipAddress || "0.0.0.0",
        userAgent: reqCtx.userAgent || "NextAPI",
        metadata: { datasetKey, format, scope },
      });
    });

    const hasRedis = Boolean(
      getRedisUrl() || process.env.VALKEY_HOST || process.env.REDIS_HOST
    );

    if (hasRedis) {
      const { Queue } = await import("bullmq");
      const queue = new Queue("import-export-jobs", {
        connection: getBullMQValkeyConnection(),
      });
      try {
        await queue.add("export", {
          jobId,
          schoolId: school.id,
          userId: ctx.userId,
          userEmail: ctx.email,
          userRole: ctx.role,
          jobType: "EXPORT",
          entityType: datasetKey,
          format: format.toLowerCase(),
          filters,
        });
      } catch (enqueueErr) {
        const errMsg =
          enqueueErr instanceof Error ? enqueueErr.message : "Failed to enqueue export job.";
        await withTenant(school.id, async (tx) => {
          await tx.execute(sql`
            UPDATE import_export_jobs
            SET
              status = 'FAILED',
              metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{errorMessage}', ${JSON.stringify(errMsg)}::jsonb),
              updated_at = NOW()
            WHERE id = ${jobId} AND school_id = ${school.id}
          `);
        });
        return NextResponse.json(
          { jobId, status: "FAILED", error: errMsg },
          { status: 500 }
        );
      } finally {
        await queue.close().catch(() => {});
      }

      return NextResponse.json(
        {
          jobId,
          schoolId: school.id,
          datasetKey,
          format,
          scope,
          columns,
          status: "QUEUED",
          createdAt,
          downloadUrl: null,
        },
        { status: 202 }
      );
    }

    // Bounded synchronous execution when Redis is not configured (never leave job stuck in QUEUED)
    const execResult = await executeImportExportJob({
      jobId,
      schoolId: school.id,
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      jobType: "EXPORT",
      entityType: datasetKey,
      format: format.toLowerCase() as "csv" | "xlsx" | "pdf",
      filters,
    });

    return NextResponse.json(
      {
        jobId,
        schoolId: school.id,
        datasetKey,
        format,
        scope,
        columns,
        status: execResult.status,
        recordCount: execResult.recordCount,
        createdAt,
        downloadUrl: `/api/import-export/jobs/${encodeURIComponent(jobId)}/download`,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create export job";
    const status = mapAuthErrorStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}
