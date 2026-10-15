// ─── First-Party UX Events Telemetry API (Sprint S10 Layer 4) ────────────────
// POST /api/ux-events
// Captures declarative user interactions for element-level heat map analytics.
// Enforces:
// 1. Session authentication & tenant scoping (school_id attached from session, never client).
// 2. Strict rate limiting (100 events/minute per user).
// 3. Known-element registry validation (rejects arbitrary element IDs).
// 4. Zero student PII (UX-R62 compliant).

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users, usageEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import { validateUxEvent, type UxEventPayload } from "@/lib/telemetryRegistry";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    if (!dbUser || !dbUser.schoolId) {
      return NextResponse.json(
        { error: "Valid school session required" },
        { status: 401 },
      );
    }

    // Rate limiting: 100 events / minute per authenticated user
    const rateLimitKey = `rate:ux-events:${dbUser.schoolId}:${dbUser.id}`;
    const allowed = await checkRateLimit(rateLimitKey, 100, 60000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many interaction events. Rate limit exceeded." },
        { status: 429 },
      );
    }

    // Parse body (supports array or { events: [...] })
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }

    const rawEvents: unknown[] = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray((rawBody as any)?.events)
        ? (rawBody as any).events
        : [rawBody];

    if (rawEvents.length === 0) {
      return NextResponse.json({ error: "No events provided" }, { status: 400 });
    }

    if (rawEvents.length > 50) {
      return NextResponse.json(
        { error: "Batch size exceeds maximum limit of 50 events" },
        { status: 400 },
      );
    }

    const validated: UxEventPayload[] = [];
    for (let i = 0; i < rawEvents.length; i++) {
      const result = validateUxEvent(rawEvents[i]);
      if (!result.valid) {
        return NextResponse.json(
          { error: `Validation failure at index ${i}: ${result.reason}` },
          { status: 400 },
        );
      }
      validated.push(result.data);
    }

    const rowsToInsert = validated.map((event) => ({
      schoolId: dbUser.schoolId!,
      screen: event.screen,
      elementId: event.elementId,
      elementLabel: event.elementLabel,
      action: event.action,
      role: session.user.role || "UNKNOWN",
      userId: dbUser.id,
      createdAt: new Date(),
    }));

    await db.insert(usageEvents).values(rowsToInsert);

    return NextResponse.json({ success: true, count: rowsToInsert.length });
  } catch (err: any) {
    console.error("[UxEventsAPI] Error processing interaction events:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
