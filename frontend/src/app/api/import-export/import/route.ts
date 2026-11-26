import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getClientRequestContext } from "@/lib/requestContext";
import { getBullMQValkeyConnection, getRedisUrl } from "@/lib/redisConnection";
import { uploadBufferToS3, MAX_FILE_SIZE_BYTES } from "@/lib/storage";
import { executeImportExportJob } from "@schoolmitra/backend/lib/importExportProcessor";
import {
  DATASET_SCHEMAS,
  IMPORT_EXPORT_AUTH_ROLES,
  canRoleImportDataset,
  parseCsvText,
  validateImportBatch,
  MAX_IMPORT_ROWS,
  sanitizeForSpreadsheet,
  type ImportDatasetKey,
} from "@/lib/importExportEngine";

const SUPPORTED_COMMIT_DATASETS = new Set<string>([
  "STUDENTS",
  "FEE_HEADS",
  "CLASSES",
  "SUBJECTS",
  "STAFF",
  "TEACHERS",
]);

function mapAuthErrorStatus(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("unauthorized")) return 401;
  if (lower.includes("forbidden")) return 403;
  return 500;
}

function serializeRowsToCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (v: string) => {
    const safe = sanitizeForSpreadsheet(v);
    return safe.includes(",") || safe.includes('"') || safe.includes("\n")
      ? `"${safe.replace(/"/g, '""')}"`
      : safe;
  };
  return [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
  ].join("\n") + "\n";
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth(IMPORT_EXPORT_AUTH_ROLES);
    const school = await requireSchool(ctx);
    const reqCtx = getClientRequestContext();

    const contentType = request.headers.get("content-type") || "";
    let datasetKey = "" as ImportDatasetKey;
    let format: "CSV" | "XLSX" = "CSV";
    let dryRun = false;
    let fileBuffer: Buffer | null = null;
    let csvText = "";
    let jsonRows: Record<string, string>[] | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      datasetKey = String(formData.get("datasetKey") || "").toUpperCase() as ImportDatasetKey;
      dryRun = String(formData.get("dryRun") || "false").toLowerCase() === "true";

      const uploaded = formData.get("file");
      const rawCsv = formData.get("csvText");

      if (uploaded && typeof uploaded === "object" && "arrayBuffer" in uploaded) {
        const f = uploaded as File;
        if (f.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json(
            { error: "Uploaded file exceeds 10MB maximum allowed limit." },
            { status: 400 }
          );
        }
        const ab = await f.arrayBuffer();
        fileBuffer = Buffer.from(ab);
        const lowerName = (f.name || "").toLowerCase();
        if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
          format = "XLSX";
        } else {
          format = "CSV";
          csvText = fileBuffer.toString("utf-8");
        }
      } else if (typeof rawCsv === "string" && rawCsv.trim()) {
        csvText = rawCsv;
        fileBuffer = Buffer.from(csvText, "utf-8");
      }
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      }
      datasetKey = String(body.datasetKey || "").toUpperCase() as ImportDatasetKey;
      format = String(body.format || "CSV").toUpperCase() === "XLSX" ? "XLSX" : "CSV";
      dryRun = Boolean(body.dryRun);
      if (Array.isArray(body.rows)) {
        jsonRows = body.rows as Record<string, string>[];
        csvText = serializeRowsToCsv(jsonRows);
        fileBuffer = Buffer.from(csvText, "utf-8");
      } else if (typeof body.csvText === "string") {
        csvText = body.csvText;
        fileBuffer = Buffer.from(csvText, "utf-8");
      }
    }

    if (!DATASET_SCHEMAS[datasetKey]) {
      return NextResponse.json(
        { error: `Invalid import datasetKey: ${datasetKey || "missing"}` },
        { status: 400 }
      );
    }

    if (!canRoleImportDataset(ctx.role, datasetKey)) {
      return NextResponse.json(
        { error: `Forbidden: Role ${ctx.role} is not authorized to import ${datasetKey}.` },
        { status: 403 }
      );
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { error: "No import file or data rows supplied." },
        { status: 400 }
      );
    }

    if (dryRun) {
      let parsedRows: Record<string, string>[] = jsonRows ?? [];
      if (!jsonRows) {
        if (format === "XLSX") {
          const { default: ExcelJS } = await import("exceljs");
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(fileBuffer as any);
          const ws =
            wb.worksheets.find((s) => (s.actualRowCount || s.rowCount) > 1) ||
            wb.worksheets[0];
          if (!ws) {
            return NextResponse.json({ error: "XLSX file has no worksheets." }, { status: 400 });
          }
          const headers: string[] = [];
          ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
            headers[col] = String(cell.text || cell.value || "").trim();
          });
          ws.eachRow((row, rn) => {
            if (rn === 1) return;
            const rec: Record<string, string> = {};
            let hasVal = false;
            row.eachCell({ includeEmpty: true }, (cell, col) => {
              const h = headers[col];
              if (!h) return;
              const v = String(cell.text || cell.value || "").trim();
              if (v) hasVal = true;
              rec[h] = v;
            });
            if (hasVal) parsedRows.push(rec);
          });
        } else {
          parsedRows = parseCsvText(csvText).rows;
        }
      }

      if (parsedRows.length === 0) {
        return NextResponse.json({ error: "No data rows supplied for validation." }, { status: 400 });
      }
      if (parsedRows.length > MAX_IMPORT_ROWS) {
        return NextResponse.json(
          { error: `Import file exceeds maximum allowed limit of ${MAX_IMPORT_ROWS} rows.` },
          { status: 400 }
        );
      }

      const summary = validateImportBatch(datasetKey, parsedRows);
      return NextResponse.json({ dryRun: true, ...summary }, { status: 200 });
    }

    if (!SUPPORTED_COMMIT_DATASETS.has(datasetKey)) {
      return NextResponse.json(
        {
          error: `Import execution for dataset ${datasetKey} is not enabled. Supported: ${Array.from(
            SUPPORTED_COMMIT_DATASETS
          ).join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const jobId = randomUUID();
    const ext = format === "XLSX" ? "xlsx" : "csv";
    const s3Key = `schools/${school.id}/imports/${jobId}.${ext}`;
    const mimeType =
      format === "XLSX"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8";

    const uploadRes = await uploadBufferToS3(s3Key, fileBuffer, mimeType);
    if (!uploadRes.success) {
      return NextResponse.json(
        { error: uploadRes.error || "Failed to store uploaded import file." },
        { status: 500 }
      );
    }

    await withTenant(school.id, async (tx) => {
      await tx.execute(sql`
        INSERT INTO import_export_jobs (
          id, school_id, created_by, job_type, module, dataset_key, status, format, file_key, expires_at
        ) VALUES (
          ${jobId}, ${school.id}, ${ctx.userId}, 'IMPORT', 'DATA_EXCHANGE', ${datasetKey}, 'QUEUED', ${format}, ${s3Key}, NOW() + interval '7 days'
        )
      `);

      await tx.insert(auditLogs).values({
        schoolId: school.id,
        userId: ctx.userId,
        userEmail: ctx.email || "admin@schoolmitra.internal",
        userRole: ctx.role,
        action: "WRITE",
        tableName: "import_export_jobs",
        recordId: jobId,
        purposeId: "bulk_data_import_requested",
        ipAddress: reqCtx.ipAddress || "0.0.0.0",
        userAgent: reqCtx.userAgent || "NextAPI",
        metadata: { datasetKey, format },
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
        await queue.add("import", {
          jobId,
          schoolId: school.id,
          userId: ctx.userId,
          userEmail: ctx.email,
          userRole: ctx.role,
          jobType: "IMPORT",
          entityType: datasetKey,
          format: format.toLowerCase(),
          s3Key,
        });
      } catch (enqueueErr) {
        const errMsg =
          enqueueErr instanceof Error ? enqueueErr.message : "Failed to enqueue import job.";
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
        return NextResponse.json({ jobId, status: "FAILED", error: errMsg }, { status: 500 });
      } finally {
        await queue.close().catch(() => {});
      }

      return NextResponse.json(
        {
          jobId,
          schoolId: school.id,
          datasetKey,
          format,
          status: "QUEUED",
          recordCount: null,
          errorCount: null,
          errorDownloadUrl: null,
        },
        { status: 202 }
      );
    }

    const result = await executeImportExportJob({
      jobId,
      schoolId: school.id,
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      jobType: "IMPORT",
      entityType: datasetKey,
      format: format.toLowerCase() as "csv" | "xlsx",
      s3Key,
    });

    return NextResponse.json(
      {
        jobId,
        schoolId: school.id,
        datasetKey,
        format,
        status: result.status,
        recordCount: result.recordCount,
        errorCount: result.errorCount,
        errorDownloadUrl: result.errorCsvKey
          ? `/api/import-export/jobs/${encodeURIComponent(jobId)}/download?type=errors`
          : null,
      },
      { status: result.status === "FAILED" ? 422 : 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to execute import job";
    const status = mapAuthErrorStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}
