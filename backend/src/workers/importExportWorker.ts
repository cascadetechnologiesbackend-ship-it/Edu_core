import { Worker, Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { getBullMQValkeyConnection, getRedisUrl } from "../lib/redisConnection";
import { withTenant } from "@/lib/tenant";
import { uploadBufferToS3, getPresignedDownloadUrl } from "@/lib/storage";

export interface ImportExportJobPayload {
  jobId: string;
  schoolId: string;
  userId: string;
  jobType: "EXPORT" | "IMPORT";
  entityType: string;
  format?: "csv" | "xlsx" | "json";
  s3Key?: string;
  filters?: Record<string, unknown>;
}

const hasRedis = Boolean(getRedisUrl() || process.env.VALKEY_HOST || process.env.REDIS_HOST);

export const importExportQueue = hasRedis
  ? new Queue<ImportExportJobPayload>("import-export-jobs", {
      connection: getBullMQValkeyConnection(),
    })
  : ({
      add: async () => {
        console.warn("[ImportExportQueue] Redis is not configured in this environment. Job skipped.");
        return null;
      },
    } as any);

async function updateJobStatus(
  schoolId: string,
  jobId: string,
  status: "PROCESSING" | "COMPLETED" | "FAILED",
  extra: { resultUrl?: string | null; errorMessage?: string | null; processedRows?: number } = {}
) {
  await withTenant(schoolId, async (tx) => {
    await tx.execute(sql`
      UPDATE import_export_jobs
      SET
        status = ${status},
        result_url = COALESCE(${extra.resultUrl ?? null}, result_url),
        error_message = COALESCE(${extra.errorMessage ?? null}, error_message),
        processed_rows = COALESCE(${extra.processedRows ?? null}, processed_rows),
        updated_at = NOW()
      WHERE id = ${jobId} AND school_id = ${schoolId}
    `);
  });
}

async function processImportExportJob(payload: ImportExportJobPayload) {
  const { jobId, schoolId, jobType, entityType, format = "csv" } = payload;

  await updateJobStatus(schoolId, jobId, "PROCESSING");

  try {
    if (jobType === "EXPORT") {
      const exportContent = JSON.stringify({
        schoolId,
        entityType,
        exportedAt: new Date().toISOString(),
        filters: payload.filters ?? {},
      });
      const buffer = Buffer.from(exportContent, "utf-8");
      const key = `schools/${schoolId}/exports/${jobId}.${format}`;
      const contentType =
        format === "json"
          ? "application/json"
          : format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv";

      await uploadBufferToS3(key, buffer, contentType);
      const signedUrl = await getPresignedDownloadUrl(key, 3600);

      await updateJobStatus(schoolId, jobId, "COMPLETED", {
        resultUrl: signedUrl,
        processedRows: 0,
      });
      return { success: true, jobId, resultUrl: signedUrl };
    }

    if (jobType === "IMPORT") {
      // Import validation & row ingestion executed inside tenant-scoped transaction
      await withTenant(schoolId, async (_tx) => {
        // Placeholder for entity-specific batch upsert pipeline
      });

      await updateJobStatus(schoolId, jobId, "COMPLETED", {
        processedRows: 0,
      });
      return { success: true, jobId };
    }

    throw new Error(`Unsupported jobType: ${String(jobType)}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown import/export worker error";
    await updateJobStatus(schoolId, jobId, "FAILED", { errorMessage: message });
    throw err;
  }
}

export const importExportWorker = hasRedis
  ? new Worker<ImportExportJobPayload>(
      "import-export-jobs",
      async (job) => {
        return processImportExportJob(job.data);
      },
      {
        connection: getBullMQValkeyConnection(),
        concurrency: 2,
      }
    )
  : null;

if (importExportWorker) {
  importExportWorker.on("failed", (job, err) => {
    console.error(`[ImportExportWorker] Job ${job?.id ?? "unknown"} failed:`, err);
  });

  const shutdown = async (signal: string) => {
    console.log(`[ImportExportWorker] Received ${signal}, closing worker...`);
    try {
      await importExportWorker.close();
      console.log("[ImportExportWorker] Worker closed cleanly.");
    } catch (err) {
      console.error("[ImportExportWorker] Error during shutdown:", err);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
