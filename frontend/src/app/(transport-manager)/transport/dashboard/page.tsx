import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { Bus, MapPin, Users, AlertCircle, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Transport Manager Workspace | SchoolMitra ERP",
  description: "Bus routes, vehicle maintenance, stop allocations & transport fee sync.",
};

export default async function TransportManagerDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "TRANSPORT_MANAGER"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-900 via-amber-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
              <Bus className="w-3.5 h-3.5" /> Transport Operations Office
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Transport Fleet Console
            </h1>
            <p className="text-orange-200/80 text-sm mt-1">
              Bus fleet management, route planning, driver details, student stop allocations, and transport fee integration.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/transport"
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <Bus className="w-4 h-4" /> Open Fleet Manager
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Bus Fleet Vehicles</span>
            <Bus className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">8 Vehicles</div>
          <p className="text-xs text-emerald-600 mt-1">Active GPS Tracking</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Configured Routes</span>
            <MapPin className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-blue-600 mt-2">12 Routes</div>
          <p className="text-xs text-gray-500 mt-1">45 Pickup Stops</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Opt-In Students</span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">320 Students</div>
          <p className="text-xs text-emerald-600 mt-1">Auto Transport Fee Assigned</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Maintenance Alert</span>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-600 mt-2">1 Vehicle</div>
          <p className="text-xs text-amber-600 mt-1">Due for fitness check</p>
        </div>
      </div>

      {/* Transport Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/transport"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <Bus className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-orange-600 transition">
            Route & Stop Management
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Define bus routes, pick-up stops, assign drivers/conductors, and set monthly route fees.
          </p>
        </Link>

        <Link
          href="/transport?tab=allocations"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Student Transport Allocation
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            View transport opt-in students, assign bus stops, and verify fee invoice sync status.
          </p>
        </Link>
      </div>
    </div>
  );
}
