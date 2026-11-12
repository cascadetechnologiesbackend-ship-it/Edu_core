import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { valkey, redis } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const startTime = Date.now();

function sanitizeDiagnosticError(raw: string | null): string | null {
  if (!raw) return null;
  // Scrub any embedded URI credentials or secrets before returning diagnostics
  return raw.replace(/([a-z]+:\/\/)([^:\s@]+):([^@\s]+)@/gi, "$1***:***@");
}

function isAuthorizedDiagnosticRequest(req?: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const cronSecret = process.env.CRON_SECRET;
  const token = req?.headers.get("x-health-token");
  return Boolean(cronSecret && token && token === cronSecret);
}

export async function GET(): Promise<NextResponse>;
export async function GET(req: Request): Promise<NextResponse>;
export async function GET(req?: Request) {
  const startedAt = Date.now();
  let dbStatus = "ok";
  let redisStatus = "ok";
  let dbError: string | null = null;
  let redisError: string | null = null;

  let dbRole: string = "unknown";
  let activeRole: string = "unknown";

  // 1. Check Database (Strict Dependency) & Identity Verification (S6-T0)
  try {
    const res: any = await db.execute(
      sql`SELECT current_user AS db_user, current_setting('role', true) AS active_role`,
    );
    const row = res.rows?.[0] || res[0];
    dbRole = row?.db_user || row?.current_user || "unknown";
    activeRole = row?.active_role || "unknown";
  } catch (err: any) {
    dbStatus = "error";
    dbError = err?.message || "Database connection failed";
    console.error("Health check DB failure:", err);
  }

  // 2. Check Valkey Primary (with Redis fallback supported)
  const inMemoryClient = valkey || redis;
  try {
    if (inMemoryClient) {
      await inMemoryClient.ping();
    } else {
      redisStatus = "degraded";
    }
  } catch (err: any) {
    redisStatus = "degraded";
    redisError = err?.message || "Valkey/Redis ping failed";
    console.warn("Health check Valkey/Redis degraded:", err);
  }

  const durationMs = Date.now() - startedAt;
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const commitSha =
    process.env.RENDER_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    "dev";

  const includeDiagnostics = isAuthorizedDiagnosticRequest(req);
  const safeDbError = includeDiagnostics
    ? sanitizeDiagnosticError(dbError)
    : "Database connectivity check failed";
  const safeRedisNote = includeDiagnostics
    ? sanitizeDiagnosticError(redisError)
    : "Cache connectivity check degraded";

  // If Database fails, return 503
  if (dbStatus === "error") {
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        ...(includeDiagnostics ? { dbRole, activeRole, commit: commitSha } : {}),
        redis: redisStatus,
        valkey: redisStatus,
        version: process.env.NEXT_PUBLIC_APP_VERSION || "11.0.0",
        uptime: uptimeSeconds,
        timestamp: new Date().toISOString(),
        durationMs,
        error: safeDbError,
      },
      { status: 503 },
    );
  }

  // If Redis is unreachable, system operates in degraded mode (in-memory rate limiting / caches)
  const overallStatus = redisStatus === "degraded" ? "degraded" : "ok";

  return NextResponse.json(
    {
      status: overallStatus,
      database: "ok",
      ...(includeDiagnostics ? { dbRole, activeRole, commit: commitSha } : {}),
      redis: redisStatus,
      valkey: redisStatus,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "11.0.0",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      durationMs,
      ...(redisError ? { redisNote: safeRedisNote, valkeyNote: safeRedisNote } : {}),
    },
    { status: 200 },
  );
}
