import { Worker, Queue } from "bullmq";
import { getBullMQValkeyConnection, getRedisUrl } from "../lib/redisConnection";
import {
  executeImportExportJob,
  type ImportExportJobPayload,
} from "../lib/importExportProcessor";

export type { ImportExportJobPayload };

const hasRedis = Boolean(
  getRedisUrl() || process.env.VALKEY_HOST || process.env.REDIS_HOST
);

export const importExportQueue = hasRedis
  ? new Queue<ImportExportJobPayload>("import-export-jobs", {
      connection: getBullMQValkeyConnection(),
    })
  : ({
      add: async () => {
        throw new Error(
          "[ImportExportQueue] Redis is not configured in this environment."
        );
      },
    } as unknown as Queue<ImportExportJobPayload>);

export async function processImportExportJob(payload: ImportExportJobPayload) {
  if (!hasRedis) {
    throw new Error(
      "[ImportExportWorker] Redis unavailable — worker cannot process queued job."
    );
  }
  return executeImportExportJob(payload);
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
