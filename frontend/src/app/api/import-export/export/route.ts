import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { db, withTenant } from "@/db";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { DATASET_SCHEMAS, ImportDatasetKey } from "@/lib/importExportEngine";

const VALID_FORMATS = new Set(["CSV", "XLSX", "PDF"]);
const VALID_SCOPES = new Set(["all", "filtered", "dateRange"]);

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "HR_MANAGER",
      "ACCOUNTANT",
    ] as const);
    const school = await requireSchool(ctx);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const datasetKey = String(body.datasetKey || "").toUpperCase() as ImportDatasetKey;
    const format = String(body.format || "").toUpperCase();
    const scope = String(body.scope || "all");
    const columns = Array.isArray(body.columns) ? body.columns.map(String) : [];

    if (!DATASET_SCHEMAS[datasetKey]) {
      return NextResponse.json(
        { error: `Invalid export datasetKey: ${datasetKey || "missing"}` },
        { status: 400 }
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

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const metadataJson = JSON.stringify({ scope, columns });

    await withTenant(school.id, async (tx) => {
      await tx.execute(sql`
        INSERT INTO import_export_jobs (
          id, school_id, created_by, job_type, module, dataset_key, status, format, metadata
        ) VALUES (
          ${jobId}, ${school.id}, ${ctx.userId}, 'EXPORT', 'DATA_EXCHANGE', ${datasetKey}, 'QUEUED', ${format}, ${metadataJson}::jsonb
        )
      `);
    });

    const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL;
    const hasRedis = Boolean(redisUrl || process.env.VALKEY_HOST || process.env.REDIS_HOST);
    if (hasRedis) {
      const connection = redisUrl
        ? { url: redisUrl }
        : {
            host: process.env.VALKEY_HOST || process.env.REDIS_HOST || "127.0.0.1",
            port: Number(process.env.VALKEY_PORT || process.env.REDIS_PORT || 6379),
          };
      const queue = new Queue("import-export-jobs", { connection });
      try {
        await queue.add("export", {
          jobId,
          schoolId: school.id,
          userId: ctx.userId,
          jobType: "EXPORT",
          entityType: datasetKey,
          format: format.toLowerCase(),
          filters: { scope, columns },
        });
      } finally {
        await queue.close();
      }
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create export job";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
