import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { drivers, vehicles, routes, routeStops, schools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import DriverDashboardClient from "./DriverDashboardClient";

export default async function DriverDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  const schoolId = session.user.schoolId;

  // 1. Fetch driver profile
  let driverRecord = await db.query.drivers.findFirst({
    where: and(eq(drivers.userId, userId), isNull(drivers.deletedAt)),
    with: {
      vehicle: true,
      school: true,
    },
  });

  // Fallback for Admins testing the driver dashboard
  if (!driverRecord && schoolId) {
    driverRecord = await db.query.drivers.findFirst({
      where: and(eq(drivers.schoolId, schoolId), isNull(drivers.deletedAt)),
      with: {
        vehicle: true,
        school: true,
      },
    });
  }

  // 2. Fetch assigned vehicle & routes
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
  } else if (schoolId) {
    // Fallback: pick first available route for demonstration
    assignedRoute = await db.query.routes.findFirst({
      where: and(eq(routes.schoolId, schoolId), isNull(routes.deletedAt)),
      with: {
        stops: true,
        vehicle: true,
      },
    });
    if (assignedRoute?.vehicle) {
      assignedVehicle = assignedRoute.vehicle;
    }
  }

  const decryptedDriver = driverRecord
    ? {
        id: driverRecord.id,
        name: decryptData(driverRecord.nameEncrypted) || "Driver",
        licence: decryptData(driverRecord.licenceEncrypted) || "LIC-PENDING",
        mobile: decryptData(driverRecord.mobileEncrypted) || "",
      }
    : {
        id: "demo",
        name: session.user.name || "School Bus Driver",
        licence: "DL-DEMO-2026",
        mobile: "",
      };

  const stops = assignedRoute?.stops
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
