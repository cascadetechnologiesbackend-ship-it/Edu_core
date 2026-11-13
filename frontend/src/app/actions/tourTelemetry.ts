"use server";

import { db } from "@/db";
import { usageEvents } from "@/db/schema";
import { auth } from "@/lib/auth";
import { UserRole } from "@schoolmitra/validators/roleConfig";
import { TourUsageEventName } from "@/lib/tours/types";

export async function recordTourUsageAction(
  eventName: TourUsageEventName,
  role: UserRole | string,
  meta?: {
    pagePath?: string;
    stepId?: string;
    moduleId?: string;
  }
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
      tour_step_viewed: "VIEW_STEP",
      tour_module_completed: "COMPLETE_MODULE",
    };

    const screenLabel = meta?.pagePath ? `tour:${meta.pagePath}` : "tour_flashcards";
    const elementLabel = meta?.stepId
      ? `J10_step:${meta.stepId}`
      : meta?.moduleId
      ? `J10_module:${meta.moduleId}`
      : "J10_school_onboarding";

    await db.insert(usageEvents).values({
      schoolId: session.user.schoolId,
      userId: session.user.id,
      screen: screenLabel,
      elementId: eventName,
      elementLabel,
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

