"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertQueryBudget } from "@schoolmitra/database";
import {
  getTransportConsoleMetrics,
  type TransportConsoleMetrics,
} from "@/lib/roleConsoleEngine";

export async function getTransportDashboardMetricsAction(): Promise<{
  success: boolean;
  metrics: TransportConsoleMetrics | null;
  error?: string;
}> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "TRANSPORT_MANAGER"] as const);
    const school = await requireSchool(ctx);

    const metrics = await assertQueryBudget(
      async () => getTransportConsoleMetrics(school.id),
      { maxQueries: 6, label: "Transport Dashboard Metrics" }
    );

    return {
      success: true,
      metrics,
    };
  } catch (err: any) {
    console.error("[getTransportDashboardMetricsAction] Error:", err);
    return {
      success: false,
      metrics: null,
      error: err?.message || "Failed to load transport metrics",
    };
  }
}
