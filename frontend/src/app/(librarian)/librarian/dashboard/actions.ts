"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertQueryBudget } from "@schoolmitra/database";
import {
  getLibrarianConsoleMetrics,
  type LibrarianConsoleMetrics,
} from "@/lib/roleConsoleEngine";

export async function getLibrarianDashboardMetricsAction(): Promise<{
  success: boolean;
  metrics: LibrarianConsoleMetrics | null;
  error?: string;
}> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "LIBRARIAN"] as const);
    const school = await requireSchool(ctx);

    const metrics = await assertQueryBudget(
      async () => getLibrarianConsoleMetrics(school.id),
      { maxQueries: 6, label: "Librarian Dashboard Metrics" }
    );

    return {
      success: true,
      metrics,
    };
  } catch (err: any) {
    console.error("[getLibrarianDashboardMetricsAction] Error:", err);
    return {
      success: false,
      metrics: null,
      error: err?.message || "Failed to load librarian metrics",
    };
  }
}
