export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { getCachedSession } from "@/lib/serverAuth";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { drivers, routes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import DriverDashboardClient from "./DriverDashboardClient";
import { Bus, AlertCircle } from "lucide-react";

export default async function DriverDashboardPage() {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  const { driverRecord, assignedVehicle, assignedRoute } =
    await withDataPhaseTiming("/driver/dashboard", () =>
      assertQueryBudget(
        async () => {
          // 1. Fetch driver profile linked to authenticated user
          const driverRecord = await db.query.drivers.findFirst({
            where: and(eq(drivers.userId, userId), isNull(drivers.deletedAt)),
            with: {
              vehicle: true,
              school: true,
            },
          });

          // 2. Fetch assigned vehicle & routes if driver profile exists
          let assignedVehicle: any = driverRecord?.vehicle || null;
          let assignedRoute: any = null;

          if (driverRecord?.vehicleId) {
            assignedRoute = await db.query.routes.findFirst({
              where: and(
                eq(routes.vehicleId, driverRecord.vehicleId),
                isNull(routes.deletedAt)
              ),
              with: {
                stops: true,
              },
            });
          }

          return { driverRecord, assignedVehicle, assignedRoute };
        },
        { maxQueries: 5, label: "Driver Dashboard" },
      ),
    );

  // Honest Setup-Missing State (Flaw S23-F05 Closure):
  // When no driver record, assigned vehicle, or route exists, render actionable missing state.
  if (!driverRecord || !assignedVehicle || !assignedRoute) {
    const driverName = driverRecord
      ? decryptData(driverRecord.nameEncrypted) || session.user.name || "Driver"
      : null;

    return (
      <div
        data-testid="driver-setup-missing-card"
        className="rounded-2xl border border-amber-500/20 bg-slate-900/90 p-6 sm:p-8 text-center max-w-lg mx-auto mt-8 shadow-xl space-y-5"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
          <Bus className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Transport Allocation Pending
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            No Vehicle or Route Assigned
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {!driverRecord
              ? "Your account is not linked to an active driver profile in this school. Please contact the Transport Operations Office to register your commercial driving licence and mobile number."
              : !assignedVehicle
              ? `Your driver profile is registered (${driverName}), but no transit vehicle is currently assigned to you.`
              : `Vehicle ${assignedVehicle.busNumber} is assigned, but no active transit route is linked to it.`}
          </p>
        </div>
        <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
          Contact Transport Operations Office or your School Administrator to complete allocation.
        </div>
        {(session.user.role === "SUPER_ADMIN" ||
          session.user.role === "SCHOOL_ADMIN" ||
          session.user.role === "TRANSPORT_MANAGER") && (
          <div className="pt-2">
            <Link
              href="/transport"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition min-h-[38px]"
            >
              Open Transport Management Console
            </Link>
          </div>
        )}
      </div>
    );
  }

  const decryptedDriver = {
    id: driverRecord.id,
    name: decryptData(driverRecord.nameEncrypted) || "Driver",
    licence: decryptData(driverRecord.licenceEncrypted) || "LIC-PENDING",
    mobile: decryptData(driverRecord.mobileEncrypted) || "",
  };

  const stops = assignedRoute.stops
    ? [...assignedRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder)
    : [];

  return (
    <DriverDashboardClient
      driver={decryptedDriver}
      vehicle={assignedVehicle}
      route={assignedRoute}
      stops={stops}
    />
  );
}
