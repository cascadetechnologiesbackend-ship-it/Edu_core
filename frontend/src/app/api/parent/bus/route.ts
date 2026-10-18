export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCachedSession } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  studentBusPasses,
  routes,
  routeStops,
  vehicles,
  gpsPings,
  students,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  isInsideCommuteWindow,
  computeBusTracking,
} from "@/lib/parentEventEngine/busEta";

export async function GET(req: Request) {
  try {
    const session = await getCachedSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "School context missing" },
        { status: 400 }
      );
    }

    // Verify access to student
    const student = await db.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
      columns: { id: true, primaryParentUserId: true, firstNameEncrypted: true, lastNameEncrypted: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (session.user.role === "PARENT" && student.primaryParentUserId !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied to this student record" },
        { status: 403 }
      );
    }

    const now = new Date();
    const isCommute = isInsideCommuteWindow(now);

    const busData = await withTenant(schoolId, async (tx) => {
      // Find active bus pass
      const pass = await tx.query.studentBusPasses.findFirst({
        where: and(
          eq(studentBusPasses.studentId, studentId),
          eq(studentBusPasses.schoolId, schoolId),
          eq(studentBusPasses.isActive, true)
        ),
      });

      if (!pass) {
        return { hasBusPass: false };
      }

      // Fetch route details
      const route = await tx.query.routes.findFirst({
        where: and(eq(routes.id, pass.routeId), eq(routes.schoolId, schoolId)),
      });

      // Fetch route stops in order
      const stops = await tx.query.routeStops.findMany({
        where: and(eq(routeStops.routeId, pass.routeId), eq(routeStops.schoolId, schoolId)),
        orderBy: (t, { asc }) => [asc(t.stopOrder)],
      });

      // Fetch vehicle details if assigned
      let vehicle = null;
      let latestPing = null;
      if (route?.vehicleId) {
        vehicle = await tx.query.vehicles.findFirst({
          where: and(eq(vehicles.id, route.vehicleId), eq(vehicles.schoolId, schoolId)),
        });

        // Only fetch real-time GPS pings if inside commute window (AC-P3)
        if (isCommute) {
          latestPing = await tx.query.gpsPings.findFirst({
            where: eq(gpsPings.vehicleId, route.vehicleId),
            orderBy: [desc(gpsPings.recordedAt)],
          });
        }
      }

      // Map stops for ETA engine
      const mappedStops = stops.map((s) => ({
        id: s.id,
        stopOrder: s.stopOrder,
        lat: s.gpsLatitude ? Number(s.gpsLatitude) : 0,
        lng: s.gpsLongitude ? Number(s.gpsLongitude) : 0,
        name: s.stopName,
        estimatedTime: s.estimatedArrivalTime || undefined,
      }));

      // Compute tracking if in commute window
      let tracking = null;
      if (isCommute) {
        const pingSnapshot = latestPing
          ? {
              lat: Number(latestPing.latitude),
              lng: Number(latestPing.longitude),
              speed: Number(latestPing.speed || 0),
              recordedAt: latestPing.recordedAt,
            }
          : null;

        tracking = computeBusTracking(pingSnapshot, mappedStops, pass.routeStopId, now);
      }

      const designatedStop = stops.find((s) => s.id === pass.routeStopId) || null;

      return {
        hasBusPass: true,
        isCommuteWindow: isCommute,
        passNumber: pass.passNumber,
        designatedStop: designatedStop
          ? {
              id: designatedStop.id,
              name: designatedStop.stopName,
              stopOrder: designatedStop.stopOrder,
              lat: designatedStop.gpsLatitude ? Number(designatedStop.gpsLatitude) : null,
              lng: designatedStop.gpsLongitude ? Number(designatedStop.gpsLongitude) : null,
              scheduledTime: designatedStop.estimatedArrivalTime,
            }
          : null,
        route: route
          ? {
              id: route.id,
              name: route.routeName,
              code: route.routeCode,
            }
          : null,
        vehicle: vehicle
          ? {
              id: vehicle.id,
              busNumber: vehicle.busNumber,
              capacity: vehicle.capacity,
            }
          : null,
        stops: mappedStops,
        tracking,
        latestPing: isCommute && latestPing
          ? {
              lat: Number(latestPing.latitude),
              lng: Number(latestPing.longitude),
              speed: Number(latestPing.speed || 0),
              recordedAt: latestPing.recordedAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      ...busData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load bus tracking" },
      { status: 500 }
    );
  }
}
