import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/rateLimiter";

export async function GET() {
  try {
    // Check DB
    await db.execute(sql`SELECT 1`);

    // Check Redis
    await redis.ping();

    return NextResponse.json(
      {
        status: "ok",
        db: "connected",
        redis: "connected",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", message: "Service unhealthy" },
      { status: 503 },
    );
  }
}
