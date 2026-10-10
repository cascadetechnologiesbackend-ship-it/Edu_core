import { NextResponse, type NextRequest } from "next/server";
import {
  batchSchema,
  containsProhibitedPii,
  recordFieldMetric,
  vitalsLogger,
} from "@/lib/webVitals";
import { checkRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    // Enforce per-IP rate limiting (max 30 batch uploads per minute)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const allowed = await checkRateLimit(`rate:telemetry:${ip}`, 30, 60000);
    if (!allowed) {
      vitalsLogger.warn({ ip }, "[RATE_LIMIT] Telemetry rate limit exceeded");
      return NextResponse.json(
        { error: "Too many requests. Rate limit exceeded." },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Validate structure (max 20 vitals per batch)
    const parseResult = batchSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid web vitals payload", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const batch = parseResult.data;

    // Enforce PF-R111: Reject payloads leaking student identifiers
    if (containsProhibitedPii(batch)) {
      vitalsLogger.warn(
        { schoolId: batch.schoolId, role: batch.role },
        "[PF-R111 VIOLATION] Rejected web-vitals batch containing student identifiers"
      );
      return NextResponse.json(
        { error: "Payload contains prohibited identifiers (PF-R111)" },
        { status: 422 }
      );
    }

    // Ingest into in-memory aggregates
    for (const m of batch.metrics) {
      recordFieldMetric(m.route, m.name, m.value);
    }

    vitalsLogger.info(
      {
        appVersion: batch.appVersion,
        deviceTier: batch.deviceTier,
        connectionType: batch.connectionType,
        role: batch.role,
        schoolId: batch.schoolId,
        count: batch.metrics.length,
      },
      `[WEB_VITALS] Ingested ${batch.metrics.length} metrics`
    );

    return NextResponse.json({ ok: true, count: batch.metrics.length }, { status: 200 });
  } catch (err: any) {
    vitalsLogger.error({ err }, "Error processing web vitals telemetry");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
