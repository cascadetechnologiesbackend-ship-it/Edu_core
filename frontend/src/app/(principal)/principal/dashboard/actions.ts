"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertQueryBudget } from "@schoolmitra/database";
import {
  getPrincipalConsoleMetrics,
  type PrincipalConsoleMetrics,
} from "@/lib/roleConsoleEngine";

export async function getPrincipalDashboardMetricsAction(): Promise<{
  success: boolean;
  metrics: PrincipalConsoleMetrics | null;
  error?: string;
}> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const metrics = await assertQueryBudget(
      async () => getPrincipalConsoleMetrics(school.id),
      { maxQueries: 6, label: "Principal Dashboard Metrics" }
    );

    return {
      success: true,
      metrics,
    };
  } catch (err: any) {
    console.error("[getPrincipalDashboardMetricsAction] Error:", err);
    return {
      success: false,
      metrics: null,
      error: err?.message || "Failed to load principal metrics",
    };
  }
}
