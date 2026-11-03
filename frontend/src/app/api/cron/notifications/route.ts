import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/apiAuth";
import {
  flushQuietHoursNotifications,
  drainQueuedSms,
} from "@schoolmitra/backend/workers/notificationQueueWorker";

export const dynamic = "force-dynamic";

/**
 * Cron Endpoint for Notification Delivery Drain & Flush.
 * Protected by CRON_SECRET Bearer authentication.
 *
 * Runs:
 * 1. flushQuietHoursNotifications: Outside quiet hours, flushes DEFERRED_QUIET_HOURS push notifications.
 * 2. drainQueuedSms: Drains queued SMS messages while enforcing the 500 SMS/day per-school cap.
 */
export const POST = withCronAuth(async (req) => {
  let targetSchoolId: string | undefined;

  try {
    const url = new URL(req.url);
    targetSchoolId = url.searchParams.get("schoolId") || undefined;
  } catch {
    // No targetSchoolId specified, iterate across all
  }

  const flushResult = await flushQuietHoursNotifications(targetSchoolId);
  const drainResult = await drainQueuedSms(targetSchoolId);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    flush: flushResult,
    drain: drainResult,
  });
});
