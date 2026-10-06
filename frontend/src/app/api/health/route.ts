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

  // 1. Check Database (Strict Dependency)
  try {
    await db.execute(sql`SELECT 1`);
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

  // If Database fails, return 503
  if (dbStatus === "error") {
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        redis: redisStatus,
        version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
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
      redis: redisStatus,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      durationMs,
      ...(redisError ? { redisNote: redisError } : {}),
    },
    { status: 200 },
  );
}
