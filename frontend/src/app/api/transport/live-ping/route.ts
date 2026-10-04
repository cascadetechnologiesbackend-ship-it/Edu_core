import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { gpsPings, vehicles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId");

    if (!vehicleId) {
      return NextResponse.json(
        { success: false, error: "vehicleId query parameter is required" },
        { status: 400 }
      );
    }

    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found" },
        { status: 404 }
      );
    }

    if (ctx.role !== "SUPER_ADMIN" && ctx.schoolId && vehicle.schoolId !== ctx.schoolId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: cross-tenant access denied" },
        { status: 403 }
      );
    }

    const latestPing = await db.query.gpsPings.findFirst({
      where: eq(gpsPings.vehicleId, vehicleId),
      orderBy: [desc(gpsPings.recordedAt)],
    });

    if (!latestPing) {
      return NextResponse.json({
        success: true,
        ping: null,
      });
    }

    return NextResponse.json({
      success: true,
      ping: {
        latitude: parseFloat(latestPing.latitude),
        longitude: parseFloat(latestPing.longitude),
        speed: latestPing.speed ? parseFloat(latestPing.speed) : 0,
        recordedAt: latestPing.recordedAt,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch latest GPS ping:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch GPS ping" },
      { status: 500 }
    );
  }
}
