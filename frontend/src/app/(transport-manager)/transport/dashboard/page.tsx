export const dynamic = "force-dynamic";

import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertQueryBudget } from "@schoolmitra/database";
import { getTransportConsoleMetrics } from "@/lib/roleConsoleEngine";
import Link from "next/link";
import {
  Bus,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Navigation,
} from "lucide-react";

export const metadata = {
  title: "Transport Manager Workspace | SchoolMitra ERP",
  description: "Bus routes, vehicle maintenance, stop allocations & transport fee sync.",
};

export default async function TransportManagerDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "TRANSPORT_MANAGER"] as const);
  const school = await requireSchool(ctx);

  const metrics = await assertQueryBudget(
    async () => getTransportConsoleMetrics(school.id),
    { maxQueries: 6, label: "Transport Manager Dashboard" }
  );

  const isFreshFleet = metrics.activeVehiclesCount === 0 && metrics.activeRoutesCount === 0;

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-orange-950/60 backdrop-blur-xl border border-white/[0.12] p-6 sm:p-8 text-white shadow-level-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
              <Bus className="w-3.5 h-3.5" /> Transport Operations Office
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
              Transport Fleet Console
            </h1>
            <p className="text-orange-200/80 text-xs sm:text-sm mt-1 max-w-2xl">
              Live bus fleet status, GPS signal telemetry, route stops, and student transport allocations for {school.name}.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/transport"
              className="w-full sm:w-auto min-h-[38px] sm:min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-semibold text-xs shadow-level-1 transition-all flex items-center justify-center gap-2"
            >
              <Bus className="w-4 h-4" /> Open Fleet Manager
            </Link>
          </div>
        </div>
      </div>

      {/* Fresh Provisioned Fleet Next-Best-Action State */}
      {isFreshFleet && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 dark:bg-orange-950/20 p-5 shadow-level-1">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Transport Fleet Setup in Progress
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your school has no registered vehicles or routes configured. Register fleet vehicles and define bus routes to begin transport management.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/transport"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline min-h-[38px] sm:min-h-[44px] py-1 px-2"
                >
                  Configure Fleet &amp; Routes <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Bus Fleet Vehicles */}
        <div
          data-testid="transport-vehicles-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Bus Fleet Vehicles
              </span>
              <Bus className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2 tracking-tight">
              {metrics.activeVehiclesCount} {metrics.activeVehiclesCount === 1 ? "Vehicle" : "Vehicles"}
            </div>
          </div>
          <p
            className={`text-xs mt-2 ${metrics.gpsStatus.hasActivePings
              ? "text-emerald-600 dark:text-emerald-400 font-medium"
              : "text-muted-foreground"
              }`}
          >
            {metrics.activeVehiclesCount === 0
              ? "0 vehicles registered"
              : metrics.gpsStatus.pingRecencyLabel}
          </p>
        </div>

        {/* Metric 2: Configured Routes */}
        <div
          data-testid="transport-routes-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Configured Routes
              </span>
              <MapPin className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2 tracking-tight">
              {metrics.activeRoutesCount} Routes
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.activeRoutesCount === 0
              ? "0 pickup stops defined"
              : `${metrics.pickupStopsCount} Pickup Stops`}
          </p>
        </div>

        {/* Metric 3: Opt-In Students */}
        <div
          data-testid="transport-students-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Opt-In Students
              </span>
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tracking-tight">
              {metrics.optedInStudentsCount} Students
            </div>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.optedInStudentsCount === 0
              ? "No student passes issued"
              : "Auto Transport Fee Assigned"}
          </p>
        </div>

        {/* Metric 4: Maintenance Alert */}
        <div
          data-testid="transport-maintenance-metric"
          className={`rounded-2xl border p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between ${metrics.maintenanceAlertsCount > 0
            ? "border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20"
            : "border-border/80 bg-card"
            }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Maintenance Alert
              </span>
              <AlertCircle
                className={`w-5 h-5 ${metrics.maintenanceAlertsCount > 0 ? "text-amber-500" : "text-emerald-500"
                  }`}
              />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${metrics.maintenanceAlertsCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground"
                }`}
            >
              {metrics.maintenanceAlertsCount}{" "}
              {metrics.maintenanceAlertsCount === 1 ? "Vehicle" : "Vehicles"}
            </div>
          </div>
          <p
            className={`text-xs mt-2 truncate ${metrics.maintenanceAlertsCount > 0
              ? "text-amber-600 dark:text-amber-400 font-medium"
              : "text-muted-foreground"
              }`}
          >
            {metrics.maintenanceAlertsCount > 0
              ? metrics.vehiclesWithMaintenanceAlert[0]
                ? `${metrics.vehiclesWithMaintenanceAlert[0].busNumber}: ${metrics.vehiclesWithMaintenanceAlert[0].issue}`
                : "Due for fitness check"
              : "All vehicles fitness-certified"}
          </p>
        </div>
      </div>

      {/* Transport Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Link
          href="/transport"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-orange-500/50 hover:shadow-level-2 transition-all space-y-3 min-h-[38px] sm:min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <Bus className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition tracking-tight">
            Route &amp; Stop Management
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Define bus routes, pick-up stops, assign drivers/conductors, and set monthly route fees.
          </p>
        </Link>

        <Link
          href="/transport?tab=allocations"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-3 min-h-[38px] sm:min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight">
            Student Transport Allocation
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View transport opt-in students, assign bus stops, and verify fee invoice sync status.
          </p>
        </Link>
      </div>
    </div>
  );
}
