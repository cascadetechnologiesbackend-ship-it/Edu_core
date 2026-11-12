"use server";

import { db } from "@/db";
import { usageEvents } from "@/db/schema";
import { auth } from "@/lib/auth";
import { UserRole } from "@schoolmitra/validators/roleConfig";
import { TourUsageEventName } from "@/lib/tours/types";

export async function recordTourUsageAction(
  eventName: TourUsageEventName,
  role: UserRole | string
) {
  try {
    const session = await auth().catch(() => null);
    if (!session?.user?.id || !session?.user?.schoolId) {
      // Unauthenticated or offline: ignore without error
      return { success: false, reason: "No active authenticated session" };
    }

    const actionMap: Record<TourUsageEventName, string> = {
      tour_started: "START",
      tour_completed: "COMPLETE",
      tour_skipped: "SKIP",
    };

    await db.insert(usageEvents).values({
      schoolId: session.user.schoolId,
      userId: session.user.id,
      screen: "tour_flashcards",
      elementId: eventName,
      elementLabel: "J10_school_onboarding",
      action: actionMap[eventName] || "INTERACT",
      role: String(role || session.user.role || "UNKNOWN"),
    });

    return { success: true };
  } catch (err: any) {
    // Fail closed/silent for non-blocking telemetry
    console.warn("[TourTelemetry] Failed to record tour event:", err?.message);
    return { success: false, error: err?.message };
  }
}

