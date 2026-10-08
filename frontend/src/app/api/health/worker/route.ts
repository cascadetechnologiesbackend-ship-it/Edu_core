import { NextResponse } from "next/server";
import { getWorkerHeartbeatStatus } from "@/workers/financeAutomation";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const heartbeat = await getWorkerHeartbeatStatus("educore-finance-worker");
    const durationMs = Date.now() - startedAt;

    if (!heartbeat.isAlive && heartbeat.status === "stale") {
      return NextResponse.json(
        {
          status: "degraded",
          worker: heartbeat.workerName,
          heartbeatStatus: heartbeat.status,
          ageSeconds: heartbeat.ageSeconds,
          lastSeenAt: heartbeat.lastSeenAt,
          durationMs,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: heartbeat.isAlive ? "ok" : "waiting",
        worker: heartbeat.workerName,
        heartbeatStatus: heartbeat.status,
        ageSeconds: heartbeat.ageSeconds ?? 0,
        lastSeenAt: heartbeat.lastSeenAt ?? null,
        durationMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        error: err?.message || "Failed to inspect worker heartbeat",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
