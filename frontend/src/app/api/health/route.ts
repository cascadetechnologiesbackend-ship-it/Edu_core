import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
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

  // 2. Check Redis (Degraded Fallback Supported)
  try {
    if (redis) {
      await redis.ping();
    } else {
      redisStatus = "degraded";
    }
  } catch (err: any) {
    redisStatus = "degraded";
    redisError = err?.message || "Redis ping failed";
    console.warn("Health check Redis degraded:", err);
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

  // If Database fails, return 503
  if (dbStatus === "error") {
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        dbRole,
        activeRole,
        redis: redisStatus,
        valkey: redisStatus,
        version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
        commit: commitSha,
        uptime: uptimeSeconds,
        timestamp: new Date().toISOString(),
        durationMs,
        error: dbError,
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
      dbRole,
      activeRole,
      redis: redisStatus,
      valkey: redisStatus,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
      commit: commitSha,
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      durationMs,
      ...(redisError ? { redisNote: redisError, valkeyNote: redisError } : {}),
    },
    { status: 200 },
  );
}
